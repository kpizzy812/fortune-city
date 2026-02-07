import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError, BN } from "@coral-xyz/anchor";
import { TreasuryVault } from "../target/types/treasury_vault";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert, expect } from "chai";

describe("treasury-vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .treasuryVault as Program<TreasuryVault>;
  const authority = provider.wallet as anchor.Wallet;

  let usdtMint: PublicKey;
  let mintAuthority: Keypair;
  let payoutWallet: Keypair;
  let vaultPda: PublicKey;
  let vaultBump: number;
  let vaultTokenAccount: PublicKey;
  let authorityTokenAccount: PublicKey;

  const USDT_DECIMALS = 6;
  const ONE_USDT = 1_000_000; // 10^6

  before(async () => {
    mintAuthority = Keypair.generate();
    payoutWallet = Keypair.generate();

    // Создаём USDT-like mint (6 decimals) на localnet
    usdtMint = await createMint(
      provider.connection,
      authority.payer,
      mintAuthority.publicKey,
      null,
      USDT_DECIMALS,
      Keypair.generate(),
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Деривим vault PDA
    [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_vault"), authority.publicKey.toBuffer()],
      program.programId
    );

    // Деривим vault token account (ATA от vault PDA)
    vaultTokenAccount = await getAssociatedTokenAddress(
      usdtMint,
      vaultPda,
      true, // allowOwnerOffCurve — PDA
      TOKEN_PROGRAM_ID
    );

    // Создаём ATA authority и минтим 10 000 USDT
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      usdtMint,
      authority.publicKey,
      false,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );
    authorityTokenAccount = ata.address;

    await mintTo(
      provider.connection,
      authority.payer,
      usdtMint,
      authorityTokenAccount,
      mintAuthority,
      10_000 * ONE_USDT,
      [],
      undefined,
      TOKEN_PROGRAM_ID
    );
  });

  // ─── Initialize ──────────────────────────────────────────

  describe("initialize", () => {
    it("creates vault with correct state", async () => {
      const tx = await program.methods
        .initialize()
        .accounts({
          authority: authority.publicKey,
          usdtMint,
          payoutWallet: payoutWallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("  Initialize tx:", tx);

      const vault = await program.account.treasuryVault.fetch(vaultPda);

      assert.ok(vault.authority.equals(authority.publicKey));
      assert.ok(vault.payoutWallet.equals(payoutWallet.publicKey));
      assert.ok(vault.usdtMint.equals(usdtMint));
      assert.ok(vault.vaultTokenAccount.equals(vaultTokenAccount));
      assert.equal(vault.totalDeposited.toNumber(), 0);
      assert.equal(vault.totalPaidOut.toNumber(), 0);
      assert.equal(vault.depositCount, 0);
      assert.equal(vault.payoutCount, 0);
      assert.equal(vault.lastDepositAt.toNumber(), 0);
      assert.equal(vault.lastPayoutAt.toNumber(), 0);
      assert.equal(vault.bump, vaultBump);
      assert.equal(vault.paused, false);
    });

    it("rejects double initialization", async () => {
      try {
        await program.methods
          .initialize()
          .accounts({
            authority: authority.publicKey,
            usdtMint,
            payoutWallet: payoutWallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have failed");
      } catch (err) {
        // PDA уже существует — init constraint fails
        assert.ok(err);
      }
    });
  });

  // ─── Deposit ─────────────────────────────────────────────

  describe("deposit", () => {
    it("deposits 100 USDT into vault", async () => {
      const amount = new BN(100 * ONE_USDT);

      const tx = await program.methods
        .deposit(amount)
        .accounts({
          authority: authority.publicKey,
          usdtMint,
          vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("  Deposit tx:", tx);

      // Проверяем state vault
      const vault = await program.account.treasuryVault.fetch(vaultPda);
      assert.equal(vault.totalDeposited.toNumber(), 100 * ONE_USDT);
      assert.equal(vault.depositCount, 1);
      assert.ok(vault.lastDepositAt.toNumber() > 0);

      // Проверяем баланс vault token account
      const acc = await getAccount(
        provider.connection,
        vaultTokenAccount,
        undefined,
        TOKEN_PROGRAM_ID
      );
      assert.equal(Number(acc.amount), 100 * ONE_USDT);
    });

    it("accumulates stats on second deposit", async () => {
      const amount = new BN(50 * ONE_USDT);

      await program.methods
        .deposit(amount)
        .accounts({
          authority: authority.publicKey,
          usdtMint,
          vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const vault = await program.account.treasuryVault.fetch(vaultPda);
      assert.equal(vault.totalDeposited.toNumber(), 150 * ONE_USDT);
      assert.equal(vault.depositCount, 2);

      const acc = await getAccount(
        provider.connection,
        vaultTokenAccount,
        undefined,
        TOKEN_PROGRAM_ID
      );
      assert.equal(Number(acc.amount), 150 * ONE_USDT);
    });

    it("rejects zero amount", async () => {
      try {
        await program.methods
          .deposit(new BN(0))
          .accounts({
            authority: authority.publicKey,
            usdtMint,
            vaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have failed");
      } catch (_err) {
        expect(_err).to.be.instanceOf(AnchorError);
        const err = _err as AnchorError;
        expect(err.error.errorCode.code).to.equal("ZeroAmount");
      }
    });

    it("rejects unauthorized signer", async () => {
      const attacker = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        attacker.publicKey,
        LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      try {
        await program.methods
          .deposit(new BN(100))
          .accounts({
            authority: attacker.publicKey,
            usdtMint,
            vaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([attacker])
          .rpc();
        assert.fail("Should have failed");
      } catch (err) {
        // PDA seeds [treasury_vault, attacker] не совпадает с vault
        assert.ok(err);
      }
    });
  });

  // ─── Payout ──────────────────────────────────────────────

  describe("payout", () => {
    it("pays out 30 USDT to payout wallet", async () => {
      const amount = new BN(30 * ONE_USDT);

      const tx = await program.methods
        .payout(amount)
        .accounts({
          authority: authority.publicKey,
          usdtMint,
          vaultTokenAccount,
          payoutWallet: payoutWallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("  Payout tx:", tx);

      // Проверяем state
      const vault = await program.account.treasuryVault.fetch(vaultPda);
      assert.equal(vault.totalPaidOut.toNumber(), 30 * ONE_USDT);
      assert.equal(vault.payoutCount, 1);
      assert.ok(vault.lastPayoutAt.toNumber() > 0);

      // Vault balance: 150 - 30 = 120
      const vaultAcc = await getAccount(
        provider.connection,
        vaultTokenAccount,
        undefined,
        TOKEN_PROGRAM_ID
      );
      assert.equal(Number(vaultAcc.amount), 120 * ONE_USDT);

      // Payout wallet получил 30 USDT
      const payoutAta = await getAssociatedTokenAddress(
        usdtMint,
        payoutWallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );
      const payoutAcc = await getAccount(
        provider.connection,
        payoutAta,
        undefined,
        TOKEN_PROGRAM_ID
      );
      assert.equal(Number(payoutAcc.amount), 30 * ONE_USDT);
    });

    it("rejects payout exceeding balance", async () => {
      try {
        await program.methods
          .payout(new BN(999_999 * ONE_USDT))
          .accounts({
            authority: authority.publicKey,
            usdtMint,
            vaultTokenAccount,
            payoutWallet: payoutWallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have failed");
      } catch (_err) {
        expect(_err).to.be.instanceOf(AnchorError);
        const err = _err as AnchorError;
        expect(err.error.errorCode.code).to.equal("InsufficientBalance");
      }
    });

    it("rejects zero amount payout", async () => {
      try {
        await program.methods
          .payout(new BN(0))
          .accounts({
            authority: authority.publicKey,
            usdtMint,
            vaultTokenAccount,
            payoutWallet: payoutWallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have failed");
      } catch (_err) {
        expect(_err).to.be.instanceOf(AnchorError);
        const err = _err as AnchorError;
        expect(err.error.errorCode.code).to.equal("ZeroAmount");
      }
    });

    it("rejects payout to wrong wallet", async () => {
      const wrongWallet = Keypair.generate();

      try {
        await program.methods
          .payout(new BN(10 * ONE_USDT))
          .accounts({
            authority: authority.publicKey,
            usdtMint,
            vaultTokenAccount,
            payoutWallet: wrongWallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have failed");
      } catch (_err) {
        expect(_err).to.be.instanceOf(AnchorError);
        const err = _err as AnchorError;
        expect(err.error.errorCode.code).to.equal("InvalidPayoutWallet");
      }
    });
  });

  // ─── Pause / Unpause ────────────────────────────────────

  describe("set_paused", () => {
    it("pauses the vault", async () => {
      await program.methods
        .setPaused(true)
        .accounts({ authority: authority.publicKey })
        .rpc();

      const vault = await program.account.treasuryVault.fetch(vaultPda);
      assert.equal(vault.paused, true);
    });

    it("rejects deposit when paused", async () => {
      try {
        await program.methods
          .deposit(new BN(10 * ONE_USDT))
          .accounts({
            authority: authority.publicKey,
            usdtMint,
            vaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have failed");
      } catch (_err) {
        expect(_err).to.be.instanceOf(AnchorError);
        const err = _err as AnchorError;
        expect(err.error.errorCode.code).to.equal("VaultPaused");
      }
    });

    it("rejects payout when paused", async () => {
      try {
        await program.methods
          .payout(new BN(10 * ONE_USDT))
          .accounts({
            authority: authority.publicKey,
            usdtMint,
            vaultTokenAccount,
            payoutWallet: payoutWallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have failed");
      } catch (_err) {
        expect(_err).to.be.instanceOf(AnchorError);
        const err = _err as AnchorError;
        expect(err.error.errorCode.code).to.equal("VaultPaused");
      }
    });

    it("unpauses the vault", async () => {
      await program.methods
        .setPaused(false)
        .accounts({ authority: authority.publicKey })
        .rpc();

      const vault = await program.account.treasuryVault.fetch(vaultPda);
      assert.equal(vault.paused, false);
    });

    it("deposit works after unpause", async () => {
      await program.methods
        .deposit(new BN(10 * ONE_USDT))
        .accounts({
          authority: authority.publicKey,
          usdtMint,
          vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const vault = await program.account.treasuryVault.fetch(vaultPda);
      // 150 (prev) + 10 = 160
      assert.equal(vault.totalDeposited.toNumber(), 160 * ONE_USDT);
      assert.equal(vault.depositCount, 3);
    });

    it("rejects set_paused from unauthorized signer", async () => {
      const attacker = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        attacker.publicKey,
        LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      try {
        await program.methods
          .setPaused(true)
          .accounts({ authority: attacker.publicKey })
          .signers([attacker])
          .rpc();
        assert.fail("Should have failed");
      } catch (err) {
        // PDA seeds не совпадают — vault для attacker не существует
        assert.ok(err);
      }
    });
  });
});
