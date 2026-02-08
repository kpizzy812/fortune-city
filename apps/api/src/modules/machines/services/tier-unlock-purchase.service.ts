import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getTierConfigOrThrow,
  calculateTierUnlockFee,
  getAutoUnlockThreshold,
} from '@fortune-city/shared';

export interface TierUnlockInfoResponse {
  tier: number;
  canUnlock: boolean;
  alreadyUnlocked: boolean;
  fee: number;
  autoUnlockThreshold: number;
  userTotalFameEarned: number;
  fameProgress: number; // 0..1
  maxTierUnlocked: number;
}

@Injectable()
export class TierUnlockPurchaseService {
  private readonly logger = new Logger(TierUnlockPurchaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUnlockInfo(
    userId: string,
    tier: number,
  ): Promise<TierUnlockInfoResponse> {
    if (tier < 2 || tier > 10) {
      throw new BadRequestException('Tier must be between 2 and 10');
    }

    const tierConfig = getTierConfigOrThrow(tier);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { maxTierUnlocked: true, totalFameEarned: true },
    });

    const fee = calculateTierUnlockFee(tierConfig.price);
    const threshold = getAutoUnlockThreshold(tier);
    const alreadyUnlocked = user.maxTierUnlocked >= tier;
    // Must unlock sequentially
    const canUnlock = !alreadyUnlocked && tier === user.maxTierUnlocked + 1;

    return {
      tier,
      canUnlock,
      alreadyUnlocked,
      fee,
      autoUnlockThreshold: threshold,
      userTotalFameEarned: user.totalFameEarned,
      fameProgress: threshold > 0
        ? Math.min(1, user.totalFameEarned / threshold)
        : 1,
      maxTierUnlocked: user.maxTierUnlocked,
    };
  }

  async purchaseUnlock(userId: string, tier: number) {
    if (tier < 2 || tier > 10) {
      throw new BadRequestException('Tier must be between 2 and 10');
    }

    const tierConfig = getTierConfigOrThrow(tier);
    const fee = calculateTierUnlockFee(tierConfig.price);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          maxTierUnlocked: true,
          fortuneBalance: true,
          bonusFortune: true,
          referralBalance: true,
        },
      });

      // Must unlock sequentially
      if (tier !== user.maxTierUnlocked + 1) {
        throw new BadRequestException(
          `Cannot unlock tier ${tier}. Next unlock: ${user.maxTierUnlocked + 1}`,
        );
      }

      if (user.maxTierUnlocked >= tier) {
        throw new BadRequestException(`Tier ${tier} already unlocked`);
      }

      // Check balance
      const totalBalance =
        Number(user.fortuneBalance) +
        Number(user.bonusFortune) +
        Number(user.referralBalance);

      if (totalBalance < fee) {
        throw new BadRequestException(
          `Insufficient balance. Need $${fee.toFixed(2)}, have $${totalBalance.toFixed(2)}`,
        );
      }

      // Deduct from fortuneBalance first, then bonusFortune, then referralBalance
      let remaining = fee;
      const fortuneDeduct = Math.min(Number(user.fortuneBalance), remaining);
      remaining -= fortuneDeduct;
      const bonusDeduct = Math.min(Number(user.bonusFortune), remaining);
      remaining -= bonusDeduct;
      const referralDeduct = Math.min(Number(user.referralBalance), remaining);

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: { decrement: fortuneDeduct },
          bonusFortune: { decrement: bonusDeduct },
          referralBalance: { decrement: referralDeduct },
          maxTierUnlocked: tier,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'tier_unlock_purchase',
          amount: fee,
          currency: 'FORTUNE',
          netAmount: fee,
          status: 'completed',
        },
      });

      return { user: updatedUser };
    });

    this.logger.log(
      `Tier unlock purchased: user=${userId} tier=${tier} fee=$${fee.toFixed(2)}`,
    );

    return {
      tier,
      fee,
      maxTierUnlocked: tier,
      user: result.user,
    };
  }
}
