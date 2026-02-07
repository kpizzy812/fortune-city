import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { SolanaRpcService } from '../deposits/services/solana-rpc.service';
import { SOLANA_TOKENS } from '../deposits/constants/tokens';
import { TREASURY_VAULT_IDL } from './idl/treasury_vault';
import { VaultInfoResponseDto } from './dto';

@Injectable()
export class TreasuryService implements OnModuleInit {
  private readonly logger = new Logger(TreasuryService.name);
  private program: Program | null = null;
  private vaultPda: PublicKey | null = null;
  private vaultTokenAccount: PublicKey | null = null;
  private authorityKeypair: Keypair | null = null;
  private enabled = false;

  constructor(
    private readonly config: ConfigService,
    private readonly solanaRpc: SolanaRpcService,
  ) {}

  async onModuleInit() {
    const treasuryEnabled = this.config.get<string>('TREASURY_ENABLED');
    if (treasuryEnabled !== 'true') {
      this.logger.log('Treasury disabled (TREASURY_ENABLED != true)');
      return;
    }

    try {
      const connection = this.solanaRpc.getConnection();
      if (!connection) {
        this.logger.warn('No Solana connection — treasury disabled');
        return;
      }

      // Authority = hot wallet (same keypair that sweeps deposits)
      this.authorityKeypair = this.solanaRpc.getHotWalletKeypair();
      if (!this.authorityKeypair) {
        this.logger.warn('Hot wallet keypair not loaded — treasury disabled');
        return;
      }

      // Program ID from env or IDL default
      const programId = new PublicKey(
        this.config.get<string>('TREASURY_PROGRAM_ID') ||
          TREASURY_VAULT_IDL.address,
      );

      // Anchor provider
      const wallet = new Wallet(this.authorityKeypair);
      const provider = new AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
      });

      this.program = new Program(TREASURY_VAULT_IDL, provider);

      // Derive vault PDA
      [this.vaultPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('treasury_vault'),
          this.authorityKeypair.publicKey.toBuffer(),
        ],
        programId,
      );

      // Derive vault token account (ATA owned by vault PDA)
      const usdtMint = this.getUsdtMint();
      this.vaultTokenAccount = await getAssociatedTokenAddress(
        usdtMint,
        this.vaultPda,
        true, // allowOwnerOffCurve — PDA
        TOKEN_PROGRAM_ID,
      );

      this.enabled = true;
      this.logger.log(
        `Treasury initialized: vault=${this.vaultPda.toBase58()}, programId=${programId.toBase58()}`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize treasury:', error);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Deposit USDT from hot wallet into vault
   */
  async deposit(amountUsd: number): Promise<string> {
    this.ensureEnabled();

    if (amountUsd <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const amountRaw = this.usdToRaw(amountUsd);
    const usdtMint = this.getUsdtMint();

    try {
      const txSignature = await this.program!.methods.deposit(amountRaw)
        .accounts({
          authority: this.authorityKeypair!.publicKey,
          usdtMint,
          vaultTokenAccount: this.vaultTokenAccount!,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      this.logger.log(
        `Deposited $${amountUsd} USDT into vault: ${txSignature}`,
      );
      return txSignature;
    } catch (error) {
      this.logger.error(`Deposit $${amountUsd} failed:`, error);
      throw new BadRequestException('Vault deposit transaction failed');
    }
  }

  /**
   * Payout USDT from vault to payout wallet
   */
  async payout(amountUsd: number): Promise<string> {
    this.ensureEnabled();

    if (amountUsd <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const amountRaw = this.usdToRaw(amountUsd);
    const usdtMint = this.getUsdtMint();

    const payoutWalletAddress = this.config.get<string>('SOLANA_PAYOUT_WALLET');
    if (!payoutWalletAddress) {
      throw new BadRequestException('SOLANA_PAYOUT_WALLET not configured');
    }
    const payoutWallet = new PublicKey(payoutWalletAddress);

    try {
      const txSignature = await this.program!.methods.payout(amountRaw)
        .accounts({
          authority: this.authorityKeypair!.publicKey,
          usdtMint,
          vaultTokenAccount: this.vaultTokenAccount!,
          payoutWallet,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      this.logger.log(`Paid out $${amountUsd} USDT from vault: ${txSignature}`);
      return txSignature;
    } catch (error) {
      this.logger.error(`Payout $${amountUsd} failed:`, error);
      throw new BadRequestException('Vault payout transaction failed');
    }
  }

  /**
   * Get vault info (public)
   */
  async getVaultInfo(): Promise<VaultInfoResponseDto> {
    this.ensureEnabled();

    try {
      // Fetch vault state

      const vault = await (this.program!.account as any).treasuryVault.fetch(
        this.vaultPda!,
      );

      const decimals = SOLANA_TOKENS.USDT.decimals;
      const divisor = Math.pow(10, decimals);

      // Fetch actual on-chain token balance
      let currentBalance = 0;
      try {
        const tokenAcc = await getAccount(
          this.solanaRpc.getConnection(),
          this.vaultTokenAccount!,
          'confirmed',
          TOKEN_PROGRAM_ID,
        );
        currentBalance = Number(tokenAcc.amount) / divisor;
      } catch {
        // Token account might not exist yet
        currentBalance = 0;
      }

      return {
        vaultAddress: this.vaultPda!.toBase58(),
        authority: vault.authority.toBase58(),
        payoutWallet: vault.payoutWallet.toBase58(),
        usdtMint: vault.usdtMint.toBase58(),
        currentBalance,
        totalDeposited: Number(vault.totalDeposited) / divisor,
        totalPaidOut: Number(vault.totalPaidOut) / divisor,
        depositCount: Number(vault.depositCount),
        payoutCount: Number(vault.payoutCount),
        lastDepositAt: this.timestampToIso(vault.lastDepositAt),
        lastPayoutAt: this.timestampToIso(vault.lastPayoutAt),
        paused: vault.paused,
        solscanUrl: `https://solscan.io/account/${this.vaultTokenAccount!.toBase58()}`,
      };
    } catch (error) {
      this.logger.error('Failed to fetch vault info:', error);
      throw new BadRequestException('Could not fetch vault information');
    }
  }

  // ─── Withdrawal Requests ────────────────────────────────

  /**
   * Create on-chain withdrawal request PDA for a user.
   * User can then claim USDT by signing with their wallet.
   */
  async createWithdrawalRequest(
    userPubkey: string,
    amountUsd: number,
    expiresInSeconds = 3600,
  ): Promise<string> {
    this.ensureEnabled();

    if (amountUsd <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const amountRaw = this.usdToRaw(amountUsd);
    const usdtMint = this.getUsdtMint();
    const user = new PublicKey(userPubkey);

    try {
      const txSignature = await this.program!.methods.createWithdrawal(
        amountRaw,
        new BN(expiresInSeconds),
      )
        .accounts({
          authority: this.authorityKeypair!.publicKey,
          usdtMint,
          vaultTokenAccount: this.vaultTokenAccount!,
          user,
        })
        .rpc();

      this.logger.log(
        `Created withdrawal request: $${amountUsd} USDT for ${userPubkey}, tx: ${txSignature}`,
      );
      return txSignature;
    } catch (error) {
      this.logger.error(
        `Create withdrawal request failed for ${userPubkey}:`,
        error,
      );
      throw new BadRequestException(
        'Failed to create on-chain withdrawal request',
      );
    }
  }

  /**
   * Cancel an expired withdrawal request.
   * Returns rent to authority.
   */
  async cancelWithdrawalRequest(userPubkey: string): Promise<string> {
    this.ensureEnabled();

    const user = new PublicKey(userPubkey);

    try {
      const txSignature = await this.program!.methods.cancelWithdrawal()
        .accounts({
          authority: this.authorityKeypair!.publicKey,
          user,
        })
        .rpc();

      this.logger.log(
        `Cancelled withdrawal request for ${userPubkey}: ${txSignature}`,
      );
      return txSignature;
    } catch (error) {
      this.logger.error(`Cancel withdrawal failed for ${userPubkey}:`, error);
      throw new BadRequestException('Failed to cancel withdrawal request');
    }
  }

  /**
   * Read on-chain withdrawal request PDA state for a user.
   * Returns null if no active request exists.
   */
  async getWithdrawalRequest(userPubkey: string): Promise<{
    vault: string;
    user: string;
    amount: number;
    createdAt: string;
    expiresAt: string;
    pdaAddress: string;
  } | null> {
    this.ensureEnabled();

    const user = new PublicKey(userPubkey);

    // Derive withdrawal request PDA
    const [withdrawalPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('withdrawal'), this.vaultPda!.toBuffer(), user.toBuffer()],
      this.program!.programId,
    );

    try {
      const request = await (
        this.program!.account as any
      ).withdrawalRequest.fetch(withdrawalPda);

      const decimals = SOLANA_TOKENS.USDT.decimals;
      const divisor = Math.pow(10, decimals);

      return {
        vault: request.vault.toBase58(),
        user: request.user.toBase58(),
        amount: Number(request.amount) / divisor,
        createdAt: new Date(Number(request.createdAt) * 1000).toISOString(),
        expiresAt: new Date(Number(request.expiresAt) * 1000).toISOString(),
        pdaAddress: withdrawalPda.toBase58(),
      };
    } catch {
      // Account doesn't exist — no active withdrawal request
      return null;
    }
  }

  /**
   * Get info needed for frontend to build claim transaction
   */
  getClaimInfo(): {
    programId: string;
    vaultAddress: string;
    authorityAddress: string;
    usdtMint: string;
    vaultTokenAccount: string;
  } {
    this.ensureEnabled();

    return {
      programId: this.program!.programId.toBase58(),
      vaultAddress: this.vaultPda!.toBase58(),
      authorityAddress: this.authorityKeypair!.publicKey.toBase58(),
      usdtMint: this.getUsdtMint().toBase58(),
      vaultTokenAccount: this.vaultTokenAccount!.toBase58(),
    };
  }

  // ─── Deposit Cron ────────────────────────────────────────

  /** Every 30 min: deposit hot wallet USDT surplus into vault */
  @Cron('0 */30 * * * *')
  async depositCron(): Promise<void> {
    if (!this.enabled) return;

    const minDepositUsd = 10; // Minimum $10 to deposit

    try {
      const usdtMint = this.getUsdtMint();
      const hotWalletBalance = await this.solanaRpc.getTokenBalance(
        this.authorityKeypair!.publicKey,
        usdtMint.toBase58(),
      );

      const decimals = SOLANA_TOKENS.USDT.decimals;
      const balanceUsd = hotWalletBalance / Math.pow(10, decimals);

      if (balanceUsd < minDepositUsd) return;

      this.logger.log(
        `Deposit cron: hot wallet has $${balanceUsd.toFixed(2)} USDT, depositing into vault...`,
      );

      await this.deposit(balanceUsd);
    } catch (error) {
      this.logger.error('Deposit cron failed:', error);
    }
  }

  // ─── Helpers ────────────────────────────────────────────

  private ensureEnabled() {
    if (!this.enabled || !this.program) {
      throw new BadRequestException('Treasury vault is not enabled');
    }
  }

  private getUsdtMint(): PublicKey {
    return new PublicKey(
      this.config.get<string>('USDT_MINT') || SOLANA_TOKENS.USDT.mint,
    );
  }

  private usdToRaw(amountUsd: number): BN {
    return new BN(
      Math.floor(amountUsd * Math.pow(10, SOLANA_TOKENS.USDT.decimals)),
    );
  }

  private timestampToIso(ts: { toNumber(): number }): string | null {
    const n = ts.toNumber();
    return n > 0 ? new Date(n * 1000).toISOString() : null;
  }
}
