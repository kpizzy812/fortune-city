import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PublicKey } from '@solana/web3.js';
import { PrismaService } from '../../prisma/prisma.service';
import { SolanaRpcService } from './solana-rpc.service';
import { AddressGeneratorService } from './address-generator.service';
import {
  LAMPORTS_PER_SOL,
  SWEEP_THRESHOLDS,
  GAS_REQUIREMENTS,
  SOLANA_TOKENS,
} from '../constants/tokens';

interface SweepReport {
  processed: number;
  swept: number;
  gasDeposited: number;
  errors: Array<{ address: string; error: string }>;
}

@Injectable()
export class SweepService {
  private readonly logger = new Logger(SweepService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private solanaRpc: SolanaRpcService,
    private addressGenerator: AddressGeneratorService,
  ) {}

  /**
   * Cron: sweep deposit addresses every 15 minutes
   */
  @Cron('0 */15 * * * *')
  async sweepAllAddresses(): Promise<SweepReport> {
    const sweepEnabled = this.config.get<string>('SWEEP_ENABLED') === 'true';

    if (!sweepEnabled) {
      return { processed: 0, swept: 0, gasDeposited: 0, errors: [] };
    }

    const hotWallet = this.config.get<string>('SOLANA_HOT_WALLET');
    if (!hotWallet) {
      this.logger.warn('SOLANA_HOT_WALLET not configured - sweep skipped');
      return { processed: 0, swept: 0, gasDeposited: 0, errors: [] };
    }

    this.logger.log('Starting sweep of deposit addresses...');

    const addresses = await this.prisma.depositAddress.findMany({
      where: { chain: 'solana', isActive: true },
    });

    const report: SweepReport = {
      processed: 0,
      swept: 0,
      gasDeposited: 0,
      errors: [],
    };

    for (const addr of addresses) {
      try {
        await this.sweepAddress(addr, hotWallet, report);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        report.errors.push({ address: addr.address, error: errorMessage });
        this.logger.error(`Sweep failed for ${addr.address}:`, error);
      }
    }

    this.logger.log(
      `Sweep completed: processed=${report.processed}, swept=${report.swept}, gas=${report.gasDeposited}, errors=${report.errors.length}`,
    );

    return report;
  }

  /**
   * Sweep single deposit address
   */
  private async sweepAddress(
    depositAddr: { id: string; address: string; derivationIndex: number },
    hotWallet: string,
    report: SweepReport,
  ): Promise<void> {
    report.processed++;

    const keypair = this.addressGenerator.getKeypair(
      depositAddr.derivationIndex,
    );
    const pubkey = keypair.publicKey;

    // 1. Check SOL balance
    const solBalance = await this.solanaRpc.getBalance(pubkey);

    // 2. Sweep SPL tokens first (need SOL for gas)
    // USDT: fixed mainnet address, FORTUNE: from env
    const fortuneMint = this.config.get<string>('FORTUNE_MINT_ADDRESS');
    const mints = [SOLANA_TOKENS.USDT.mint, fortuneMint].filter(
      Boolean,
    ) as string[];

    for (const mint of mints) {
      const tokenBalance = await this.solanaRpc.getTokenBalance(pubkey, mint);

      if (tokenBalance >= SWEEP_THRESHOLDS.TOKEN) {
        // Ensure enough SOL for gas
        if (solBalance < GAS_REQUIREMENTS.MIN_SOL_FOR_GAS) {
          await this.depositGas(pubkey, report);
        }

        // Sweep token
        await this.sweepToken(keypair, hotWallet, mint, tokenBalance);
        report.swept++;

        this.logger.log(
          `Swept ${tokenBalance} tokens (${mint}) from ${depositAddr.address}`,
        );
      }
    }

    // 3. Sweep SOL (keep rent-exempt minimum)
    const sweepableSol = solBalance - GAS_REQUIREMENTS.RENT_EXEMPT_MIN;
    if (sweepableSol >= SWEEP_THRESHOLDS.SOL) {
      await this.sweepSol(keypair, hotWallet, sweepableSol);
      report.swept++;

      this.logger.log(
        `Swept ${sweepableSol / LAMPORTS_PER_SOL} SOL from ${depositAddr.address}`,
      );
    }

    // Update last swept timestamp
    await this.prisma.depositAddress.update({
      where: { id: depositAddr.id },
      data: { lastSweptAt: new Date() },
    });
  }

  /**
   * Deposit gas (SOL) to address from hot wallet
   */
  private async depositGas(
    recipient: PublicKey,
    report: SweepReport,
  ): Promise<string> {
    const hotWalletKeypair = this.solanaRpc.getHotWalletKeypair();
    if (!hotWalletKeypair) {
      throw new Error('Hot wallet keypair not configured');
    }

    const signature = await this.solanaRpc.transferSol(
      hotWalletKeypair,
      recipient,
      GAS_REQUIREMENTS.MIN_SOL_FOR_GAS,
    );

    report.gasDeposited++;
    this.logger.debug(`Deposited gas to ${recipient.toBase58()}`);

    return signature;
  }

  /**
   * Sweep SOL to hot wallet
   */
  private async sweepSol(
    from: ReturnType<typeof this.addressGenerator.getKeypair>,
    toAddress: string,
    lamports: number,
  ): Promise<string> {
    const to = new PublicKey(toAddress);
    return this.solanaRpc.transferSol(from, to, lamports);
  }

  /**
   * Sweep SPL token to hot wallet
   */
  private async sweepToken(
    from: ReturnType<typeof this.addressGenerator.getKeypair>,
    toAddress: string,
    mint: string,
    amount: number,
  ): Promise<string> {
    const to = new PublicKey(toAddress);
    const mintPubkey = new PublicKey(mint);
    return this.solanaRpc.transferToken(from, to, mintPubkey, amount);
  }

  /**
   * Manual sweep trigger (for admin use)
   */
  async triggerSweep(): Promise<SweepReport> {
    return this.sweepAllAddresses();
  }

  /**
   * Get sweep status for all addresses
   */
  async getSweepStatus(): Promise<
    Array<{
      address: string;
      lastSweptAt: Date | null;
      solBalance: number;
    }>
  > {
    const addresses = await this.prisma.depositAddress.findMany({
      where: { chain: 'solana', isActive: true },
      select: {
        address: true,
        lastSweptAt: true,
      },
    });

    const statuses = await Promise.all(
      addresses.map(async (addr) => {
        const balance = await this.solanaRpc.getBalance(
          new PublicKey(addr.address),
        );
        return {
          address: addr.address,
          lastSweptAt: addr.lastSweptAt,
          solBalance: balance / LAMPORTS_PER_SOL,
        };
      }),
    );

    return statuses;
  }
}
