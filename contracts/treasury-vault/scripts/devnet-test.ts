/**
 * Devnet E2E test: создаёт fake USDT, инициализирует vault,
 * делает deposit и payout, читает state.
 *
 * Запуск: npx ts-node scripts/devnet-test.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { TreasuryVault } from "../target/types/treasury_vault";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const USDT_DECIMALS = 6;
const ONE_USDT = 1_000_000;

function loadKeypair(filePath: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  // --- Setup ---
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const walletPath =
    process.env.WALLET_PATH || path.join(process.env.HOME!, "team-wallet.json");
  const authority = loadKeypair(walletPath);

  console.log("Authority:", authority.publicKey.toBase58());
  console.log(
    "Balance:",
    (await connection.getBalance(authority.publicKey)) / 1e9,
    "SOL"
  );

  const wallet = new anchor.Wallet(authority);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = anchor.workspace
    .treasuryVault as Program<TreasuryVault>;
  console.log("Program ID:", program.programId.toBase58());

  // --- Step 1: Создаём fake USDT mint ---
  console.log("\n=== Step 1: Создаю fake USDT mint ===");
  const mintAuthority = Keypair.generate();

  // Airdrop немного SOL для mint authority (не обязательно, authority платит)
  const usdtMint = await createMint(
    connection,
    authority, // payer
    mintAuthority.publicKey, // mint authority
    null, // freeze authority
    USDT_DECIMALS,
    Keypair.generate(),
    undefined,
    TOKEN_PROGRAM_ID
  );
  console.log("Fake USDT mint:", usdtMint.toBase58());

  // --- Step 2: Создаём ATA authority и минтим 1000 USDT ---
  console.log("\n=== Step 2: Минтю 1000 fake USDT ===");
  const authorityAta = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    usdtMint,
    authority.publicKey,
    false,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );
  console.log("Authority ATA:", authorityAta.address.toBase58());

  await mintTo(
    connection,
    authority,
    usdtMint,
    authorityAta.address,
    mintAuthority,
    1000 * ONE_USDT,
    [],
    undefined,
    TOKEN_PROGRAM_ID
  );
  console.log("Minted 1000 USDT to authority");

  // --- Step 3: Payout wallet ---
  const payoutWallet = Keypair.generate();
  console.log("\n=== Step 3: Payout wallet ===");
  console.log("Payout wallet:", payoutWallet.publicKey.toBase58());

  // Сохраняем keypair для будущего использования
  fs.writeFileSync(
    path.join(__dirname, "devnet-payout-wallet.json"),
    JSON.stringify(Array.from(payoutWallet.secretKey))
  );

  // --- Step 4: Initialize vault ---
  console.log("\n=== Step 4: Initialize vault ===");
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_vault"), authority.publicKey.toBuffer()],
    program.programId
  );
  console.log("Vault PDA:", vaultPda.toBase58());

  const vaultTokenAccount = await getAssociatedTokenAddress(
    usdtMint,
    vaultPda,
    true, // allowOwnerOffCurve (PDA)
    TOKEN_PROGRAM_ID
  );
  console.log("Vault token account:", vaultTokenAccount.toBase58());

  try {
    const tx = await program.methods
      .initialize()
      .accounts({
        authority: authority.publicKey,
        usdtMint,
        payoutWallet: payoutWallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log("Initialize tx:", tx);
    console.log(
      `https://explorer.solana.com/tx/${tx}?cluster=devnet`
    );
  } catch (err: any) {
    if (err.message?.includes("already in use")) {
      console.log("Vault already initialized, skipping...");
    } else {
      throw err;
    }
  }

  // --- Step 5: Deposit 100 USDT ---
  console.log("\n=== Step 5: Deposit 100 USDT ===");
  const depositTx = await program.methods
    .deposit(new BN(100 * ONE_USDT))
    .accounts({
      authority: authority.publicKey,
      usdtMint,
      vaultTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  console.log("Deposit tx:", depositTx);
  console.log(
    `https://explorer.solana.com/tx/${depositTx}?cluster=devnet`
  );

  // --- Step 6: Payout 30 USDT ---
  console.log("\n=== Step 6: Payout 30 USDT ===");
  const payoutTx = await program.methods
    .payout(new BN(30 * ONE_USDT))
    .accounts({
      authority: authority.publicKey,
      usdtMint,
      vaultTokenAccount,
      payoutWallet: payoutWallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  console.log("Payout tx:", payoutTx);
  console.log(
    `https://explorer.solana.com/tx/${payoutTx}?cluster=devnet`
  );

  // --- Step 7: Read vault state ---
  console.log("\n=== Step 7: Vault state ===");
  const vault = await program.account.treasuryVault.fetch(vaultPda);
  console.log("Authority:", vault.authority.toBase58());
  console.log("Payout wallet:", vault.payoutWallet.toBase58());
  console.log("USDT mint:", vault.usdtMint.toBase58());
  console.log(
    "Total deposited:",
    vault.totalDeposited.toNumber() / ONE_USDT,
    "USDT"
  );
  console.log(
    "Total paid out:",
    vault.totalPaidOut.toNumber() / ONE_USDT,
    "USDT"
  );
  console.log("Deposit count:", vault.depositCount);
  console.log("Payout count:", vault.payoutCount);
  console.log("Paused:", vault.paused);

  // Vault token balance
  const vaultAcc = await getAccount(
    connection,
    vaultTokenAccount,
    undefined,
    TOKEN_PROGRAM_ID
  );
  console.log(
    "Vault balance:",
    Number(vaultAcc.amount) / ONE_USDT,
    "USDT"
  );

  // Payout wallet balance
  const payoutAta = await getAssociatedTokenAddress(
    usdtMint,
    payoutWallet.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );
  const payoutAcc = await getAccount(
    connection,
    payoutAta,
    undefined,
    TOKEN_PROGRAM_ID
  );
  console.log(
    "Payout wallet balance:",
    Number(payoutAcc.amount) / ONE_USDT,
    "USDT"
  );

  console.log("\n=== Vault on Solscan ===");
  console.log(
    `https://solscan.io/account/${vaultPda.toBase58()}?cluster=devnet`
  );
  console.log(
    `https://solscan.io/account/${vaultTokenAccount.toBase58()}?cluster=devnet`
  );

  console.log("\n✅ Все тесты на devnet прошли успешно!");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
