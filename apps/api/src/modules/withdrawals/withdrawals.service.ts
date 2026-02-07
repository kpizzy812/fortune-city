import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PrismaService } from '../prisma/prisma.service';
import { SolanaRpcService } from '../deposits/services/solana-rpc.service';
import { FundSourceService } from '../economy/services/fund-source.service';
import { SOLANA_TOKENS } from '../deposits/constants/tokens';
import {
  CreateWithdrawalDto,
  WithdrawalPreviewResponse,
  PreparedAtomicWithdrawalResponse,
  WithdrawalResponse,
  InstantWithdrawalResponse,
} from './dto';
import { Withdrawal } from '@prisma/client';

// Withdrawal fee in SOL (user pays this for atomic withdrawal)
const WITHDRAWAL_FEE_SOL = 0.001; // 0.001 SOL

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly solanaRpc: SolanaRpcService,
    private readonly fundSource: FundSourceService,
  ) {}

  /**
   * Preview withdrawal - calculate tax and net amount
   */
  async previewWithdrawal(
    userId: string,
    amount: number,
  ): Promise<WithdrawalPreviewResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        fortuneBalance: true,
        totalFreshDeposits: true,
        totalProfitCollected: true,
        currentTaxRate: true,
        taxDiscount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const balance = Number(user.fortuneBalance);
    if (amount > balance) {
      throw new BadRequestException('Insufficient balance');
    }

    // Calculate fund source breakdown (profit is taxed, fresh is not)
    const breakdown = this.fundSource.calculateSourceBreakdown(
      user.fortuneBalance,
      user.totalFreshDeposits,
      amount,
    );

    // Apply personal tax discount from referral milestones
    const baseTaxRate = Number(user.currentTaxRate);
    const discount = Number(user.taxDiscount);
    const taxRate = Math.max(0, baseTaxRate - discount);
    // Tax only applies to profit portion
    const taxAmount = breakdown.profitDerived * taxRate;
    const netAmount = amount - taxAmount;

    return {
      requestedAmount: amount,
      fromFreshDeposit: breakdown.freshDeposit,
      fromProfit: breakdown.profitDerived,
      taxRate,
      taxAmount,
      netAmount,
      usdtAmount: netAmount, // 1:1 for USDT
      feeSol: WITHDRAWAL_FEE_SOL,
    };
  }

  /**
   * Prepare atomic withdrawal transaction for wallet_connect method.
   * Creates a transaction with:
   * 1. User → Hot Wallet: fee in SOL
   * 2. Hot Wallet → User: USDT payout
   *
   * Returns partially signed transaction (signed by hot wallet) for user to sign.
   */
  async prepareAtomicWithdrawal(
    userId: string,
    amount: number,
    userWalletAddress: string,
  ): Promise<PreparedAtomicWithdrawalResponse> {
    // Validate user wallet address
    let userPubkey: PublicKey;
    try {
      userPubkey = new PublicKey(userWalletAddress);
    } catch {
      throw new BadRequestException('Invalid wallet address');
    }

    // Get preview for tax calculation
    const preview = await this.previewWithdrawal(userId, amount);

    // Check payout wallet (separate from hot wallet for security)
    const payoutWallet = this.solanaRpc.getPayoutWalletKeypair();
    if (!payoutWallet) {
      throw new BadRequestException('Withdrawal service not configured');
    }

    // Check payout wallet USDT balance
    const usdtMint =
      this.config.get<string>('USDT_MINT') || SOLANA_TOKENS.USDT.mint;
    const payoutWalletUsdtBalance = await this.solanaRpc.getTokenBalance(
      payoutWallet.publicKey,
      usdtMint,
    );
    const requiredUsdtRaw = Math.floor(
      preview.usdtAmount * Math.pow(10, SOLANA_TOKENS.USDT.decimals),
    );

    if (payoutWalletUsdtBalance < requiredUsdtRaw) {
      throw new BadRequestException('Withdrawal temporarily unavailable');
    }

    // Create withdrawal record (pending)
    const withdrawal = await this.prisma.$transaction(async (tx) => {
      // Deduct from user balance
      await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: { decrement: amount },
        },
      });

      // Update fund trackers
      await this.fundSource.recordWithdrawal(userId, amount, tx);

      // Create withdrawal record
      return tx.withdrawal.create({
        data: {
          userId,
          method: 'wallet_connect',
          chain: 'solana',
          currency: 'USDT_SOL',
          walletAddress: userWalletAddress,
          requestedAmount: amount,
          fromFreshDeposit: preview.fromFreshDeposit,
          fromProfit: preview.fromProfit,
          taxAmount: preview.taxAmount,
          taxRate: preview.taxRate,
          netAmount: preview.netAmount,
          usdtAmount: preview.usdtAmount,
          feeSolAmount: WITHDRAWAL_FEE_SOL,
          status: 'pending',
        },
      });
    });

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        userId,
        type: 'withdrawal',
        amount,
        currency: 'USDT',
        taxAmount: preview.taxAmount,
        taxRate: preview.taxRate,
        netAmount: preview.netAmount,
        fromFreshDeposit: preview.fromFreshDeposit,
        fromProfit: preview.fromProfit,
        chain: 'solana',
        status: 'pending',
      },
    });

    // Build transaction
    const connection = this.solanaRpc.getConnection();
    const transaction = new Transaction();

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;

    // Instruction 1: User pays fee to payout wallet
    const feeInLamports = Math.floor(WITHDRAWAL_FEE_SOL * LAMPORTS_PER_SOL);
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: payoutWallet.publicKey,
        lamports: feeInLamports,
      }),
    );

    // Instruction 2: Payout wallet sends USDT to user
    const usdtMintPubkey = new PublicKey(usdtMint);
    const payoutWalletAta = await getAssociatedTokenAddress(
      usdtMintPubkey,
      payoutWallet.publicKey,
    );
    const userAta = await getAssociatedTokenAddress(usdtMintPubkey, userPubkey);

    // Check if user has USDT ATA, if not create it
    try {
      await getAccount(connection, userAta);
    } catch {
      // ATA doesn't exist, add instruction to create it
      transaction.add(
        createAssociatedTokenAccountInstruction(
          payoutWallet.publicKey, // payer (payout wallet pays for ATA creation)
          userAta,
          userPubkey,
          usdtMintPubkey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    // USDT transfer instruction
    const usdtAmountRaw = Math.floor(
      preview.usdtAmount * Math.pow(10, SOLANA_TOKENS.USDT.decimals),
    );
    transaction.add(
      createTransferInstruction(
        payoutWalletAta,
        userAta,
        payoutWallet.publicKey,
        usdtAmountRaw,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );

    // Set fee payer to user (they pay the network fee + our fee)
    transaction.feePayer = userPubkey;

    // Partially sign with payout wallet
    transaction.partialSign(payoutWallet);

    // Serialize and return
    const serializedTransaction = transaction
      .serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      })
      .toString('base64');

    this.logger.log(
      `Prepared atomic withdrawal ${withdrawal.id} for user ${userId}: $${amount} → $${preview.netAmount} USDT`,
    );

    return {
      withdrawalId: withdrawal.id,
      serializedTransaction,
      requestedAmount: amount,
      netAmount: preview.netAmount,
      usdtAmount: preview.usdtAmount,
      taxAmount: preview.taxAmount,
      feeSol: WITHDRAWAL_FEE_SOL,
      recipientAddress: userWalletAddress,
    };
  }

  /**
   * Confirm atomic withdrawal after user signs and sends transaction.
   * Called by frontend with tx signature.
   */
  async confirmAtomicWithdrawal(
    userId: string,
    withdrawalId: string,
    txSignature: string,
  ): Promise<WithdrawalResponse> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }

    if (withdrawal.userId !== userId) {
      throw new BadRequestException('Withdrawal does not belong to user');
    }

    if (withdrawal.status !== 'pending') {
      throw new BadRequestException('Withdrawal already processed');
    }

    // Verify transaction on chain
    const confirmed = await this.solanaRpc.confirmTransaction(
      txSignature,
      'confirmed',
    );

    if (!confirmed) {
      // Transaction failed - rollback
      await this.rollbackWithdrawal(withdrawal);

      const updated = await this.prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'failed',
          errorMessage: 'Transaction not confirmed',
        },
      });

      return this.mapWithdrawalToResponse(updated);
    }

    // Success - update withdrawal
    const updated = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'completed',
        txSignature,
        processedAt: new Date(),
      },
    });

    // Update transaction record
    await this.prisma.transaction.updateMany({
      where: {
        userId,
        type: 'withdrawal',
        status: 'pending',
      },
      data: {
        status: 'completed',
        txHash: txSignature,
      },
    });

    this.logger.log(
      `Atomic withdrawal ${withdrawalId} completed: ${txSignature}`,
    );

    return this.mapWithdrawalToResponse(updated);
  }

  /**
   * Cancel pending atomic withdrawal (if user didn't sign).
   */
  async cancelAtomicWithdrawal(
    userId: string,
    withdrawalId: string,
  ): Promise<WithdrawalResponse> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }

    if (withdrawal.userId !== userId) {
      throw new BadRequestException('Withdrawal does not belong to user');
    }

    if (withdrawal.status !== 'pending') {
      throw new BadRequestException('Withdrawal already processed');
    }

    // Rollback and cancel
    await this.rollbackWithdrawal(withdrawal);

    const updated = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'cancelled',
      },
    });

    // Update transaction record
    await this.prisma.transaction.updateMany({
      where: {
        userId,
        type: 'withdrawal',
        status: 'pending',
      },
      data: {
        status: 'cancelled',
      },
    });

    this.logger.log(`Atomic withdrawal ${withdrawalId} cancelled by user`);

    return this.mapWithdrawalToResponse(updated);
  }

  /**
   * Create instant withdrawal (manual address method).
   * Payout wallet sends USDT directly to specified address.
   */
  async createInstantWithdrawal(
    userId: string,
    dto: CreateWithdrawalDto,
  ): Promise<InstantWithdrawalResponse> {
    const { amount, walletAddress } = dto;

    // Validate address
    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(walletAddress);
    } catch {
      throw new BadRequestException('Invalid Solana wallet address');
    }

    // Get preview
    const preview = await this.previewWithdrawal(userId, amount);

    // Check payout wallet (separate from hot wallet for security)
    const payoutWallet = this.solanaRpc.getPayoutWalletKeypair();
    if (!payoutWallet) {
      throw new BadRequestException('Withdrawal service not configured');
    }

    // Check payout wallet USDT balance
    const usdtMint =
      this.config.get<string>('USDT_MINT') || SOLANA_TOKENS.USDT.mint;
    const payoutWalletUsdtBalance = await this.solanaRpc.getTokenBalance(
      payoutWallet.publicKey,
      usdtMint,
    );
    const requiredUsdtRaw = Math.floor(
      preview.usdtAmount * Math.pow(10, SOLANA_TOKENS.USDT.decimals),
    );

    if (payoutWalletUsdtBalance < requiredUsdtRaw) {
      throw new BadRequestException('Withdrawal temporarily unavailable');
    }

    // Create withdrawal and send in transaction
    let withdrawal: Withdrawal;
    let txSignature: string;

    try {
      // Deduct balance and create record
      withdrawal = await this.prisma.$transaction(async (tx) => {
        // Deduct from user balance
        await tx.user.update({
          where: { id: userId },
          data: {
            fortuneBalance: { decrement: amount },
          },
        });

        // Update fund trackers
        await this.fundSource.recordWithdrawal(userId, amount, tx);

        // Create withdrawal record
        return tx.withdrawal.create({
          data: {
            userId,
            method: 'manual_address',
            chain: 'solana',
            currency: 'USDT_SOL',
            walletAddress,
            requestedAmount: amount,
            fromFreshDeposit: preview.fromFreshDeposit,
            fromProfit: preview.fromProfit,
            taxAmount: preview.taxAmount,
            taxRate: preview.taxRate,
            netAmount: preview.netAmount,
            usdtAmount: preview.usdtAmount,
            status: 'processing',
          },
        });
      });

      // Send USDT from payout wallet
      const usdtMintPubkey = new PublicKey(usdtMint);
      const usdtAmountRaw = Math.floor(
        preview.usdtAmount * Math.pow(10, SOLANA_TOKENS.USDT.decimals),
      );

      txSignature = await this.solanaRpc.transferToken(
        payoutWallet,
        recipientPubkey,
        usdtMintPubkey,
        usdtAmountRaw,
      );

      // Update withdrawal as completed
      await this.prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'completed',
          txSignature,
          processedAt: new Date(),
        },
      });

      // Create transaction record
      await this.prisma.transaction.create({
        data: {
          userId,
          type: 'withdrawal',
          amount,
          currency: 'USDT',
          taxAmount: preview.taxAmount,
          taxRate: preview.taxRate,
          netAmount: preview.netAmount,
          fromFreshDeposit: preview.fromFreshDeposit,
          fromProfit: preview.fromProfit,
          chain: 'solana',
          txHash: txSignature,
          status: 'completed',
        },
      });

      this.logger.log(
        `Instant withdrawal ${withdrawal.id} completed: ${txSignature}`,
      );

      return {
        id: withdrawal.id,
        status: 'completed',
        txSignature,
        requestedAmount: amount,
        netAmount: preview.netAmount,
        usdtAmount: preview.usdtAmount,
      };
    } catch (error) {
      this.logger.error(`Instant withdrawal failed for user ${userId}:`, error);

      // If we already created the withdrawal, rollback
      if (withdrawal!) {
        await this.rollbackWithdrawal(withdrawal);
        await this.prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: 'failed',
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }

      throw new BadRequestException('Withdrawal failed. Please try again.');
    }
  }

  /**
   * Get user's withdrawal history.
   */
  async getUserWithdrawals(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<WithdrawalResponse[]> {
    const withdrawals = await this.prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return withdrawals.map((w) => this.mapWithdrawalToResponse(w));
  }

  /**
   * Get single withdrawal by ID.
   */
  async getWithdrawalById(
    userId: string,
    withdrawalId: string,
  ): Promise<WithdrawalResponse> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }

    if (withdrawal.userId !== userId) {
      throw new BadRequestException('Withdrawal does not belong to user');
    }

    return this.mapWithdrawalToResponse(withdrawal);
  }

  /**
   * Rollback withdrawal - return funds to user.
   */
  private async rollbackWithdrawal(withdrawal: Withdrawal): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Return balance
      await tx.user.update({
        where: { id: withdrawal.userId },
        data: {
          fortuneBalance: { increment: withdrawal.requestedAmount },
          totalFreshDeposits: { increment: withdrawal.fromFreshDeposit },
          totalProfitCollected: { increment: withdrawal.fromProfit },
        },
      });
    });

    this.logger.log(`Rolled back withdrawal ${withdrawal.id}`);
  }

  /**
   * Map withdrawal to response DTO.
   */
  private mapWithdrawalToResponse(withdrawal: Withdrawal): WithdrawalResponse {
    return {
      id: withdrawal.id,
      status: withdrawal.status,
      method: withdrawal.method,
      requestedAmount: Number(withdrawal.requestedAmount),
      netAmount: Number(withdrawal.netAmount),
      usdtAmount: Number(withdrawal.usdtAmount),
      taxAmount: Number(withdrawal.taxAmount),
      txSignature: withdrawal.txSignature,
      createdAt: withdrawal.createdAt.toISOString(),
      processedAt: withdrawal.processedAt?.toISOString() || null,
    };
  }
}
