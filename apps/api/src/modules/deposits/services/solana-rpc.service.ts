import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  Commitment,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { LAMPORTS_PER_SOL } from '../constants/tokens';

@Injectable()
export class SolanaRpcService implements OnModuleInit {
  private readonly logger = new Logger(SolanaRpcService.name);
  private connection: Connection;
  private hotWalletKeypair: Keypair | null = null;
  private payoutWalletKeypair: Keypair | null = null;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const rpcUrl = this.config.get<string>('SOLANA_RPC_URL');
    if (!rpcUrl) {
      this.logger.warn('SOLANA_RPC_URL not configured');
      return;
    }

    this.connection = new Connection(rpcUrl, 'confirmed');
    this.logger.log(`Connected to Solana RPC: ${rpcUrl.split('?')[0]}...`);

    // Load hot wallet keypair if configured (for deposits/sweep)
    const hotWalletSecret = this.config.get<string>('SOLANA_HOT_WALLET_SECRET');
    if (hotWalletSecret) {
      try {
        this.hotWalletKeypair = this.loadKeypairFromSecret(hotWalletSecret);
        this.logger.log(
          `Hot wallet loaded: ${this.hotWalletKeypair.publicKey.toBase58()}`,
        );
      } catch (error) {
        this.logger.error('Failed to load hot wallet keypair', error);
      }
    }

    // Load payout wallet keypair if configured (for withdrawals)
    const payoutWalletSecret = this.config.get<string>(
      'SOLANA_PAYOUT_WALLET_SECRET',
    );
    if (payoutWalletSecret) {
      try {
        this.payoutWalletKeypair =
          this.loadKeypairFromSecret(payoutWalletSecret);
        this.logger.log(
          `Payout wallet loaded: ${this.payoutWalletKeypair.publicKey.toBase58()}`,
        );
      } catch (error) {
        this.logger.error('Failed to load payout wallet keypair', error);
      }
    }
  }

  /**
   * Load keypair from secret (supports base58 and JSON array formats)
   */
  private loadKeypairFromSecret(secret: string): Keypair {
    if (secret.startsWith('[')) {
      const secretArray = JSON.parse(secret) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(secretArray));
    }
    const decoded = bs58.decode(secret);
    return Keypair.fromSecretKey(new Uint8Array(decoded));
  }

  getConnection(): Connection {
    return this.connection;
  }

  getHotWalletKeypair(): Keypair | null {
    return this.hotWalletKeypair;
  }

  getHotWalletAddress(): string | null {
    return this.config.get<string>('SOLANA_HOT_WALLET') || null;
  }

  /**
   * Get payout wallet keypair (for withdrawals)
   */
  getPayoutWalletKeypair(): Keypair | null {
    return this.payoutWalletKeypair;
  }

  /**
   * Get payout wallet address
   */
  getPayoutWalletAddress(): string | null {
    return this.config.get<string>('SOLANA_PAYOUT_WALLET') || null;
  }

  /**
   * Get SOL balance in lamports
   */
  async getBalance(pubkey: PublicKey): Promise<number> {
    return this.connection.getBalance(pubkey);
  }

  /**
   * Get SPL token balance
   */
  async getTokenBalance(owner: PublicKey, mint: string): Promise<number> {
    try {
      const mintPubkey = new PublicKey(mint);
      const ata = await getAssociatedTokenAddress(mintPubkey, owner);
      const account = await getAccount(this.connection, ata);
      return Number(account.amount);
    } catch {
      // Account doesn't exist or has no balance
      return 0;
    }
  }

  /**
   * Transfer SOL
   */
  async transferSol(
    from: Keypair,
    to: PublicKey,
    lamports: number,
  ): Promise<string> {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: to,
        lamports,
      }),
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [from],
    );

    this.logger.log(
      `SOL transfer: ${lamports / LAMPORTS_PER_SOL} SOL to ${to.toBase58()}, sig: ${signature}`,
    );

    return signature;
  }

  /**
   * Transfer SPL Token
   */
  async transferToken(
    from: Keypair,
    to: PublicKey,
    mint: PublicKey,
    amount: number,
  ): Promise<string> {
    const fromAta = await getAssociatedTokenAddress(mint, from.publicKey);
    const toAta = await getAssociatedTokenAddress(mint, to);

    const transaction = new Transaction().add(
      createTransferInstruction(
        fromAta,
        toAta,
        from.publicKey,
        amount,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [from],
    );

    this.logger.log(
      `Token transfer: ${amount} to ${to.toBase58()}, mint: ${mint.toBase58()}, sig: ${signature}`,
    );

    return signature;
  }

  /**
   * Confirm transaction
   */
  async confirmTransaction(
    signature: string,
    commitment: Commitment = 'confirmed',
  ): Promise<boolean> {
    try {
      const latestBlockhash = await this.connection.getLatestBlockhash();
      const result = await this.connection.confirmTransaction(
        {
          signature,
          ...latestBlockhash,
        },
        commitment,
      );
      return !result.value.err;
    } catch {
      return false;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(signature: string) {
    return this.connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
  }
}
