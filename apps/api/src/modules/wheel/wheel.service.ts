import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
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
   * Main spin method
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

    // Calculate free spins available vs paid spins needed
    const freeSpinsAvailable = user.freeSpinsRemaining;
    const freeSpinsToUse = Math.min(freeSpinsAvailable, multiplier);
    const paidSpins = multiplier - freeSpinsToUse;
    const requiredBalance = paidSpins * betAmount;

    if (Number(user.fortuneBalance) < requiredBalance) {
      throw new BadRequestException(
        `Insufficient balance. Need $${requiredBalance.toFixed(2)}, have $${Number(user.fortuneBalance).toFixed(2)}`,
      );
    }

    // Perform all spins
    const results: SpinResult[] = [];
    let totalPayout = 0;
    let jackpotWon = false;
    let jackpotAmount = 0;
    let totalLoss = 0;

    // Get current jackpot pool for potential win
    const jackpot = await this.prisma.wheelJackpot.findUnique({
      where: { id: JACKPOT_ID },
    });
    const currentPool = jackpot ? Number(jackpot.currentPool) : 0;

    for (let i = 0; i < multiplier; i++) {
      const result = this.spinOnce(sectors, betAmount);

      // Handle jackpot
      if (result.sector === 'jackpot' && !jackpotWon) {
        jackpotWon = true;
        jackpotAmount = currentPool;
        result.payout = currentPool;
        result.isJackpot = true;
      }

      results.push(result);
      totalPayout += result.payout;

      // Calculate loss for this spin
      const spinLoss = betAmount - result.payout;
      if (spinLoss > 0) {
        totalLoss += spinLoss;
      }
    }

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
            spinCount: multiplier,
            totalBet: new Decimal(totalBet),
            totalPayout: new Decimal(totalPayout),
            netResult: new Decimal(netResult),
            spinResults: results as unknown as object,
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
      spinCount: multiplier,
      totalBet,
      totalPayout,
      netResult,
      results,
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
      jackpotCap: Number(settings.wheelJackpotCap),
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
        spinCount: item.spinCount,
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
   * Reset daily free spins (called by cron)
   */
  async resetDailyFreeSpins(): Promise<number> {
    const settings = await this.settingsService.getSettings();
    const baseSpins = settings.wheelFreeSpinsBase;

    // For now, just reset to base. Referral bonus can be added later.
    const result = await this.prisma.user.updateMany({
      data: {
        freeSpinsRemaining: baseSpins,
      },
    });

    this.logger.log(`Reset daily free spins for ${result.count} users`);
    return result.count;
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
}
