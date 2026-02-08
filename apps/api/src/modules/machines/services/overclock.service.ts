import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MachinesService } from '../machines.service';
import { FameService } from '../../fame/fame.service';
import { SettingsService } from '../../settings/settings.service';
import {
  OVERCLOCK_LEVELS,
  OVERCLOCK_FORTUNE_PRICES,
  OVERCLOCK_FAME_PRICES,
} from '@fortune-city/shared';
import {
  OverclockInfoResponseDto,
  OverclockLevelInfo,
} from '../dto/overclock.dto';

@Injectable()
export class OverclockService {
  private readonly logger = new Logger(OverclockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly machinesService: MachinesService,
    private readonly fameService: FameService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Получить информацию об overclock для машины
   */
  async getOverclockInfo(
    machineId: string,
    userId: string,
  ): Promise<OverclockInfoResponseDto> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    const currentMultiplier = Number(machine.overclockMultiplier);
    const isActive = currentMultiplier > 0;

    const levels = await this.getLevelsForTier(machine.tier);

    return {
      currentMultiplier,
      isActive,
      canPurchase: machine.status === 'active' && !isActive,
      levels,
    };
  }

  /**
   * Купить overclock для машины
   */
  async purchaseOverclock(
    machineId: string,
    userId: string,
    level: number,
    paymentMethod: 'fortune' | 'fame',
  ) {
    // Validate level
    if (!OVERCLOCK_LEVELS.includes(level as any)) {
      throw new BadRequestException(
        `Invalid overclock level: ${level}. Must be one of: ${OVERCLOCK_LEVELS.join(', ')}`,
      );
    }

    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    if (machine.isFree) {
      throw new BadRequestException('Free machines cannot be upgraded');
    }

    if (machine.status !== 'active') {
      throw new BadRequestException('Cannot overclock expired machine');
    }

    if (Number(machine.overclockMultiplier) > 0) {
      throw new BadRequestException('Machine already has an active overclock');
    }

    // Get prices for this tier+level
    const { fortunePrice, famePrice } = await this.getPriceForTierLevel(
      machine.tier,
      level,
    );

    if (paymentMethod === 'fame') {
      return this.purchaseWithFame(
        machineId,
        userId,
        level,
        famePrice,
        machine.tier,
      );
    }

    return this.purchaseWithFortune(
      machineId,
      userId,
      level,
      fortunePrice,
      machine.tier,
    );
  }

  private async purchaseWithFortune(
    machineId: string,
    userId: string,
    level: number,
    cost: number,
    tier: number,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (Number(user.fortuneBalance) < cost) {
      throw new BadRequestException(
        `Insufficient balance. Need $${cost}, have $${Number(user.fortuneBalance).toFixed(2)}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Deduct FORTUNE balance
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: { decrement: cost },
        },
      });

      // 2. Set overclock on machine
      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          overclockMultiplier: level,
        },
      });

      // 3. Record transaction
      await tx.transaction.create({
        data: {
          userId,
          machineId,
          type: 'overclock_purchase',
          amount: cost,
          currency: 'FORTUNE',
          netAmount: cost,
          status: 'completed',
        },
      });

      return { machine: updatedMachine, user: updatedUser };
    });

    this.logger.log(
      `Overclock purchased: user=${userId} machine=${machineId} tier=${tier} level=x${level} cost=$${cost}`,
    );

    return {
      machine: result.machine,
      level,
      cost,
      paymentMethod: 'fortune' as const,
      user: result.user,
    };
  }

  private async purchaseWithFame(
    machineId: string,
    userId: string,
    level: number,
    fameCost: number,
    tier: number,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Spend Fame
      await this.fameService.spendFame(userId, fameCost, 'overclock_purchase', {
        description: `Overclock x${level} for tier ${tier}`,
        tx,
      });

      // 2. Set overclock on machine
      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          overclockMultiplier: level,
        },
      });

      const updatedUser = await tx.user.findUniqueOrThrow({
        where: { id: userId },
      });

      return { machine: updatedMachine, user: updatedUser };
    });

    this.logger.log(
      `Overclock purchased (Fame): user=${userId} machine=${machineId} tier=${tier} level=x${level} cost=${fameCost}⚡`,
    );

    return {
      machine: result.machine,
      level,
      cost: fameCost,
      paymentMethod: 'fame' as const,
      user: result.user,
    };
  }

  // ==================== Pricing Helpers ====================

  private async getLevelsForTier(tier: number): Promise<OverclockLevelInfo[]> {
    const settings = await this.settingsService.getSettings();
    const fortunePrices = settings.overclockFortunePrices as Record<
      string,
      Record<string, number>
    >;
    const famePrices = settings.overclockFamePrices as Record<
      string,
      Record<string, number>
    >;

    const tierKey = String(tier);

    return OVERCLOCK_LEVELS.map((level) => {
      const levelKey = level === 2.0 ? '2' : String(level);
      return {
        level,
        bonusPercent: Math.round((level - 1) * 100),
        fortunePrice:
          fortunePrices?.[tierKey]?.[levelKey] ??
          OVERCLOCK_FORTUNE_PRICES[tier]?.[levelKey] ??
          0,
        famePrice:
          famePrices?.[tierKey]?.[levelKey] ??
          OVERCLOCK_FAME_PRICES[tier]?.[levelKey] ??
          0,
      };
    });
  }

  private async getPriceForTierLevel(
    tier: number,
    level: number,
  ): Promise<{ fortunePrice: number; famePrice: number }> {
    const settings = await this.settingsService.getSettings();
    const fortunePrices = settings.overclockFortunePrices as Record<
      string,
      Record<string, number>
    >;
    const famePrices = settings.overclockFamePrices as Record<
      string,
      Record<string, number>
    >;

    const tierKey = String(tier);
    const levelKey = level === 2.0 ? '2' : String(level);

    const fortunePrice =
      fortunePrices?.[tierKey]?.[levelKey] ??
      OVERCLOCK_FORTUNE_PRICES[tier]?.[levelKey];
    const famePrice =
      famePrices?.[tierKey]?.[levelKey] ??
      OVERCLOCK_FAME_PRICES[tier]?.[levelKey];

    if (fortunePrice == null || famePrice == null) {
      throw new BadRequestException(
        `No overclock price defined for tier ${tier}, level x${level}`,
      );
    }

    return { fortunePrice, famePrice };
  }
}
