import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ReferralsService } from '../referrals/referrals.service';
import { Decimal } from '@prisma/client/runtime/library';
import { randomBytes } from 'crypto';
import {
  SpinResult,
  SpinResponseDto,
  WheelStateDto,
  WheelSectorDto,
  SpinHistoryDto,
} from './dto/spin.dto';
import { WheelGateway } from './wheel.gateway';
import { WheelNotificationService } from './wheel-notification.service';

interface WheelSector {
  sector: string;
  chance: number;
  multiplier: number;
}

const JACKPOT_ID = 'current';

@Injectable()
export class WheelService implements OnModuleInit {
  private readonly logger = new Logger(WheelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly wheelGateway: WheelGateway,
    private readonly notificationService: WheelNotificationService,
    @Inject(forwardRef(() => ReferralsService))
    private readonly referralsService: ReferralsService,
  ) {}

  async onModuleInit() {
    await this.ensureJackpotExists();
  }

  private async ensureJackpotExists(): Promise<void> {
    const jackpot = await this.prisma.wheelJackpot.findUnique({
      where: { id: JACKPOT_ID },
    });

    if (!jackpot) {
      await this.prisma.wheelJackpot.create({
        data: {
          id: JACKPOT_ID,
          currentPool: 0,
          poolCap: 1000,
        },
      });
      this.logger.log('Created initial jackpot record');
    }
  }

  /**
   * Main spin method — single spin with bet multiplier
   * multiplier = bet size multiplier (x1=$1, x5=$5, x50=$50)
   */
  async spin(userId: string, multiplier: number): Promise<SpinResponseDto> {
    const settings = await this.settingsService.getSettings();
    const betAmount = Number(settings.wheelBetAmount);
    const totalBet = betAmount * multiplier;
    const sectors = settings.wheelSectors as unknown as WheelSector[];
    const burnRate = Number(settings.wheelBurnRate);
    const poolRate = Number(settings.wheelPoolRate);

    // Get user and validate balance
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Free spins: each covers $1 (one betAmount unit)
    const freeSpinsAvailable = user.freeSpinsRemaining;
    const freeSpinsToUse = Math.min(freeSpinsAvailable, multiplier);
    const paidUnits = multiplier - freeSpinsToUse;
    const requiredBalance = paidUnits * betAmount;

    if (Number(user.fortuneBalance) < requiredBalance) {
      throw new BadRequestException(
        `Insufficient balance. Need $${requiredBalance.toFixed(2)}, have $${Number(user.fortuneBalance).toFixed(2)}`,
      );
    }

    // Get current jackpot pool for potential win
    const jackpot = await this.prisma.wheelJackpot.findUnique({
      where: { id: JACKPOT_ID },
    });
    const currentPool = jackpot ? Number(jackpot.currentPool) : 0;

    // Single spin with totalBet as stake
    const result = this.spinOnce(sectors, totalBet);

    let jackpotWon = false;
    let jackpotAmount = 0;

    // Handle jackpot — fixed pool payout (not multiplied by bet)
    if (result.sector === 'jackpot') {
      jackpotWon = true;
      jackpotAmount = currentPool;
      result.payout = currentPool;
      result.isJackpot = true;
    }

    const totalPayout = result.payout;
    const totalLoss = Math.max(totalBet - totalPayout, 0);

    // Calculate burn and pool contributions
    const burnAmount = totalLoss * burnRate;
    const poolAmount = totalLoss * poolRate;
    const netResult = totalPayout - totalBet;

    // Transaction: update everything atomically
    const [updatedUser, spin, updatedJackpot] = await this.prisma.$transaction(
      async (tx) => {
        // Deduct balance for paid spins
        const newBalance =
          Number(user.fortuneBalance) - requiredBalance + totalPayout;

        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            fortuneBalance: new Decimal(newBalance),
            freeSpinsRemaining: freeSpinsAvailable - freeSpinsToUse,
            lastSpinAt: new Date(),
          },
        });

        // Create spin record
        const spin = await tx.wheelSpin.create({
          data: {
            userId,
            betAmount: new Decimal(betAmount),
            spinCount: 1,
            totalBet: new Decimal(totalBet),
            totalPayout: new Decimal(totalPayout),
            netResult: new Decimal(netResult),
            spinResults: [result] as unknown as object,
            jackpotWon,
            jackpotAmount: new Decimal(jackpotAmount),
            burnAmount: new Decimal(burnAmount),
            poolAmount: new Decimal(poolAmount),
            freeSpinsUsed: freeSpinsToUse,
          },
        });

        // Update jackpot
        let updatedJackpot;
        if (jackpotWon) {
          // Won jackpot - reset pool
          updatedJackpot = await tx.wheelJackpot.update({
            where: { id: JACKPOT_ID },
            data: {
              currentPool: new Decimal(poolAmount), // Start fresh with this spin's contribution
              totalPaidOut: { increment: new Decimal(jackpotAmount) },
              totalBurned: { increment: new Decimal(burnAmount) },
              totalContributed: { increment: new Decimal(poolAmount) },
              timesWon: { increment: 1 },
              lastWinnerId: userId,
              lastWonAmount: new Decimal(jackpotAmount),
              lastWonAt: new Date(),
            },
          });
        } else {
          // Add to pool (check cap)
          const poolCap = Number(settings.wheelJackpotCap);
          const newPoolAmount = Math.min(currentPool + poolAmount, poolCap);
          const actualPoolContribution = newPoolAmount - currentPool;
          const extraBurn = poolAmount - actualPoolContribution;

          updatedJackpot = await tx.wheelJackpot.update({
            where: { id: JACKPOT_ID },
            data: {
              currentPool: new Decimal(newPoolAmount),
              totalContributed: {
                increment: new Decimal(actualPoolContribution),
              },
              totalBurned: { increment: new Decimal(burnAmount + extraBurn) },
            },
          });
        }

        // Create transaction record for payout if positive
        if (totalPayout > 0) {
          await tx.transaction.create({
            data: {
              userId,
              type: 'wheel_prize',
              amount: new Decimal(totalPayout),
              currency: 'FORTUNE',
              netAmount: new Decimal(totalPayout),
              status: 'completed',
            },
          });
        }

        return [updatedUser, spin, updatedJackpot];
      },
    );

    this.logger.log(
      `User ${userId} spun ${multiplier}x: bet=$${totalBet}, payout=$${totalPayout}, net=$${netResult}${jackpotWon ? `, JACKPOT $${jackpotAmount}` : ''}`,
    );

    // Send notifications for jackpot win
    if (jackpotWon) {
      // WebSocket broadcast to all connected clients
      this.wheelGateway.emitJackpotWon({
        winnerId: userId,
        winnerName: user.username || user.firstName,
        amount: jackpotAmount,
        newPool: Number(updatedJackpot.currentPool),
        timestamp: new Date().toISOString(),
      });

      // Telegram: personal message to winner (if they have telegramId)
      if (user.telegramId) {
        this.notificationService.notifyWinnerPersonally(
          user.telegramId,
          jackpotAmount,
        );
      }

      // Telegram: broadcast to all users with telegramId (except winner)
      this.notificationService.broadcastJackpotWin({
        winnerId: userId,
        winnerName: user.username || user.firstName,
        amount: jackpotAmount,
      });
    } else {
      // Just update jackpot pool for all clients
      this.wheelGateway.emitJackpotUpdated({
        currentPool: Number(updatedJackpot.currentPool),
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: true,
      spinId: spin.id,
      betMultiplier: multiplier,
      totalBet,
      totalPayout,
      netResult,
      result,
      jackpotWon,
      jackpotAmount,
      burnAmount,
      poolAmount,
      freeSpinsUsed: freeSpinsToUse,
      freeSpinsRemaining: updatedUser.freeSpinsRemaining,
      newBalance: Number(updatedUser.fortuneBalance),
      currentJackpotPool: Number(updatedJackpot.currentPool),
    };
  }

  /**
   * Single spin using cryptographically secure random
   */
  private spinOnce(sectors: WheelSector[], betAmount: number): SpinResult {
    const random = this.secureRandom();

    let cumulative = 0;
    for (const sector of sectors) {
      cumulative += sector.chance;
      if (random < cumulative) {
        return {
          sector: sector.sector,
          multiplier: sector.multiplier,
          payout: betAmount * sector.multiplier,
          isJackpot: sector.sector === 'jackpot',
        };
      }
    }

    // Fallback (should never happen if chances sum to 1)
    const lastSector = sectors[sectors.length - 1];
    return {
      sector: lastSector.sector,
      multiplier: lastSector.multiplier,
      payout: betAmount * lastSector.multiplier,
      isJackpot: lastSector.sector === 'jackpot',
    };
  }

  /**
   * Cryptographically secure random number [0, 1)
   */
  private secureRandom(): number {
    const bytes = randomBytes(4);
    const value = bytes.readUInt32BE(0);
    return value / 0x100000000;
  }

  /**
   * Get current wheel state
   */
  async getState(userId: string): Promise<WheelStateDto> {
    const [settings, jackpot, user] = await Promise.all([
      this.settingsService.getSettings(),
      this.prisma.wheelJackpot.findUnique({ where: { id: JACKPOT_ID } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);

    const sectors = settings.wheelSectors as unknown as WheelSector[];

    return {
      jackpotPool: jackpot ? Number(jackpot.currentPool) : 0,
      lastWinner: jackpot?.lastWinnerId
        ? {
            userId: jackpot.lastWinnerId,
            amount: jackpot.lastWonAmount
              ? Number(jackpot.lastWonAmount)
              : null,
            wonAt: jackpot.lastWonAt?.toISOString() ?? null,
          }
        : null,
      timesWon: jackpot?.timesWon ?? 0,
      totalPaidOut: jackpot ? Number(jackpot.totalPaidOut) : 0,
      betAmount: Number(settings.wheelBetAmount),
      multipliers: settings.wheelMultipliers as number[],
      freeSpinsRemaining: user?.freeSpinsRemaining ?? 0,
      sectors: sectors.map(
        (s): WheelSectorDto => ({
          sector: s.sector,
          chance: s.chance,
          multiplier: s.multiplier,
        }),
      ),
    };
  }

  /**
   * Get spin history for user
   */
  async getHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<SpinHistoryDto> {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.wheelSpin.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.wheelSpin.count({ where: { userId } }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        betMultiplier: Math.round(
          Number(item.totalBet) / Number(item.betAmount),
        ),
        totalBet: Number(item.totalBet),
        totalPayout: Number(item.totalPayout),
        netResult: Number(item.netResult),
        jackpotWon: item.jackpotWon,
        jackpotAmount: Number(item.jackpotAmount),
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Reset daily free spins at midnight UTC.
   * Formula: base + activeReferrals × perRef
   * Non-referrers get base spins, referrers get individual calculation.
   */
  @Cron('0 0 0 * * *')
  async resetDailyFreeSpins(): Promise<number> {
    const settings = await this.settingsService.getSettings();
    const baseSpins = settings.wheelFreeSpinsBase;
    const perRef = settings.wheelFreeSpinsPerRef;

    // Users who have at least one referral — need individual calculation
    const referrers = await this.prisma.user.findMany({
      where: { referrals: { some: {} } },
      select: { id: true },
    });

    const referrerIds = referrers.map((u) => u.id);

    // All non-referrers — simple bulk update to base
    const bulkResult = await this.prisma.user.updateMany({
      where: { id: { notIn: referrerIds } },
      data: { freeSpinsRemaining: baseSpins },
    });

    // Referrers — calculate individually based on active referral count
    let referrerCount = 0;
    for (const referrer of referrers) {
      const activeCount = await this.referralsService.getActiveReferralCount(
        referrer.id,
      );
      const totalSpins = baseSpins + activeCount * perRef;

      await this.prisma.user.update({
        where: { id: referrer.id },
        data: { freeSpinsRemaining: totalSpins },
      });
      referrerCount++;
    }

    this.logger.log(
      `Reset daily free spins: ${bulkResult.count} users → ${baseSpins}, ${referrerCount} referrers → individual`,
    );
    return bulkResult.count + referrerCount;
  }

  /**
   * Get global jackpot info (for display without auth)
   */
  async getJackpotInfo(): Promise<{
    currentPool: number;
    lastWinner: string | null;
    lastAmount: number | null;
    timesWon: number;
  }> {
    const jackpot = await this.prisma.wheelJackpot.findUnique({
      where: { id: JACKPOT_ID },
    });

    if (!jackpot) {
      return {
        currentPool: 0,
        lastWinner: null,
        lastAmount: null,
        timesWon: 0,
      };
    }

    return {
      currentPool: Number(jackpot.currentPool),
      lastWinner: jackpot.lastWinnerId,
      lastAmount: jackpot.lastWonAmount ? Number(jackpot.lastWonAmount) : null,
      timesWon: jackpot.timesWon,
    };
  }

  /**
   * Get recent wins from all users (public, for social proof)
   * Fills with seed data if not enough real wins
   */
  async getRecentWins(limit: number = 20) {
    const MIN_ITEMS = 15;

    const spins = await this.prisma.wheelSpin.findMany({
      where: { netResult: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        totalPayout: true,
        netResult: true,
        jackpotWon: true,
        jackpotAmount: true,
        spinCount: true,
        spinResults: true,
        createdAt: true,
      },
    });

    // Get usernames
    const userIds = [...new Set(spins.map((s) => s.userId))];
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, firstName: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const items = spins.map((spin) => {
      const user = userMap.get(spin.userId);
      return {
        id: spin.id,
        username: this.maskUsername(
          user?.username || user?.firstName || 'Player',
        ),
        payout: Number(spin.totalPayout),
        netResult: Number(spin.netResult),
        isJackpot: spin.jackpotWon,
        jackpotAmount: Number(spin.jackpotAmount),
        multiplier: this.extractTopMultiplier(spin.spinResults),
        createdAt: spin.createdAt.toISOString(),
      };
    });

    // Fill with seed if not enough
    if (items.length < MIN_ITEMS) {
      items.push(...this.generateWinSeedData(MIN_ITEMS - items.length));
    }

    return items
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit);
  }

  private maskUsername(name: string): string {
    if (name.length <= 3) return name[0] + '***';
    return name.substring(0, 2) + '***' + name.substring(name.length - 2);
  }

  private extractTopMultiplier(spinResults: unknown): string {
    try {
      const results = spinResults as { multiplier: number }[];
      if (!Array.isArray(results) || results.length === 0) return '1x';
      const maxMult = Math.max(...results.map((r) => r.multiplier || 0));
      return maxMult > 0 ? `${maxMult}x` : '1x';
    } catch {
      return '1x';
    }
  }

  private generateWinSeedData(count: number) {
    const names = [
      'Al***ex',
      'Vi***or',
      'Ni***ai',
      'An***ey',
      'Se***ey',
      'Di***ry',
      'Ma***im',
      'Pa***el',
      'Ar***em',
      'Iv***an',
      'Da***la',
      'Mi***el',
      'Ol***eg',
      'Ro***an',
      'Ti***ey',
    ];
    const now = Date.now();

    return Array.from({ length: count }, (_, i) => {
      const mults = ['1.5x', '2x', '2x', '5x', '1.5x', '2x'];
      const mult = mults[i % mults.length];
      const multNum = parseFloat(mult);
      const payout = multNum;

      return {
        id: `seed_${i}_${now}`,
        username: names[i % names.length],
        payout,
        netResult: payout - 1,
        isJackpot: false,
        jackpotAmount: 0,
        multiplier: mult,
        createdAt: new Date(
          now - (2 + Math.floor(Math.random() * 50)) * 60000,
        ).toISOString(),
      };
    });
  }
}
