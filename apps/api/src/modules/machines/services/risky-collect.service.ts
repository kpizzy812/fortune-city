import { Injectable, BadRequestException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { Machine, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MachinesService } from '../machines.service';
import {
  getGambleLevelConfig,
  GAMBLE_WIN_MULTIPLIER,
  GAMBLE_LOSE_MULTIPLIER,
  FORTUNE_GAMBLE_LEVELS,
  calculateGambleEV,
} from '@fortune-city/shared';

export interface RiskyCollectResult {
  won: boolean;
  originalAmount: number;
  finalAmount: number;
  winChance: number;
  multiplier: number;
  machine: Machine;
  newBalance: number;
}

export interface UpgradeGambleResult {
  machine: Machine;
  cost: number;
  newLevel: number;
  newWinChance: number;
  user: User;
}

export interface GambleInfo {
  currentLevel: number;
  currentWinChance: number;
  currentEV: number;
  canUpgrade: boolean;
  nextLevel: number | null;
  nextWinChance: number | null;
  nextEV: number | null;
  upgradeCost: number | null;
}

@Injectable()
export class RiskyCollectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly machinesService: MachinesService,
  ) {}

  /**
   * Криптографически безопасная проверка выигрыша
   * @param winChance - шанс от 0 до 1 (например, 0.1333 = 13.33%)
   */
  private rollGamble(winChance: number): boolean {
    // Генерируем число от 0 до 999999 (миллион вариантов)
    const precision = 1_000_000;
    const roll = randomInt(0, precision);
    const threshold = Math.floor(winChance * precision);
    return roll < threshold;
  }

  /**
   * Рискованный сбор прибыли (Fortune's Gamble)
   * Win: 2x, Lose: 0.5x
   * Overclock applies BEFORE gamble: boostedAmount * gambleMultiplier
   */
  async riskyCollect(
    machineId: string,
    userId: string,
  ): Promise<RiskyCollectResult> {
    // Получаем машину и проверяем ownership
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    // Рассчитываем текущий доход
    const incomeState = await this.machinesService.calculateIncome(machineId);

    // Проверяем, что coin box полный
    if (!incomeState.canCollect) {
      throw new BadRequestException(
        `CoinBox is not full yet. Wait ${incomeState.secondsUntilFull} seconds.`,
      );
    }

    const baseAmount = Number(incomeState.coinBoxCurrent);

    if (baseAmount === 0) {
      throw new BadRequestException('Nothing to collect');
    }

    // Overclock: apply BEFORE gamble
    const overclockMultiplier = Number(machine.overclockMultiplier);
    const hasOverclock = overclockMultiplier > 0;
    const boostedAmount = hasOverclock
      ? baseAmount * overclockMultiplier
      : baseAmount;

    // Track profit/principal from income (before multiplier)
    const currentProfit = incomeState.currentProfit;
    const currentPrincipal = incomeState.currentPrincipal;
    const overclockBonus = hasOverclock
      ? baseAmount * (overclockMultiplier - 1)
      : 0;

    // Получаем конфиг гамбла для уровня машины
    const gambleConfig = getGambleLevelConfig(machine.fortuneGambleLevel);
    const winChance: number = gambleConfig.winChance;

    // Криптографически безопасный бросок (gamble applies to boosted amount)
    const won = this.rollGamble(winChance);
    const multiplier = won ? GAMBLE_WIN_MULTIPLIER : GAMBLE_LOSE_MULTIPLIER;
    const finalAmount = boostedAmount * multiplier;

    // Атомарная транзакция
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Обновляем машину: сбрасываем coin box, track payouts, reset overclock
      const machineUpdateData: any = {
        coinBoxCurrent: 0,
        lastCalculatedAt: new Date(),
        profitPaidOut: {
          increment: currentProfit + overclockBonus,
        },
        principalPaidOut: {
          increment: currentPrincipal,
        },
      };

      if (hasOverclock) {
        machineUpdateData.overclockMultiplier = 0;
      }

      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: machineUpdateData,
      });

      // 2. Добавляем finalAmount к балансу пользователя
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: {
            increment: finalAmount,
          },
        },
      });

      // 3. Создаем транзакцию с gamble metadata
      await tx.transaction.create({
        data: {
          userId,
          machineId,
          type: 'machine_income_risky',
          amount: finalAmount,
          currency: 'FORTUNE',
          netAmount: finalAmount,
          status: 'completed',
          // Gamble metadata
          gambleWon: won,
          gambleChance: winChance,
        },
      });

      return {
        machine: updatedMachine,
        newBalance: Number(updatedUser.fortuneBalance),
      };
    });

    return {
      won,
      originalAmount: boostedAmount,
      finalAmount,
      winChance,
      multiplier,
      machine: result.machine,
      newBalance: result.newBalance,
    };
  }

  /**
   * Апгрейд уровня Fortune's Gamble
   */
  async upgradeFortuneGamble(
    machineId: string,
    userId: string,
  ): Promise<UpgradeGambleResult> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    if (machine.status !== 'active') {
      throw new BadRequestException('Cannot upgrade expired machine');
    }

    const currentLevel = machine.fortuneGambleLevel;
    const nextLevel = currentLevel + 1;

    // Проверяем, что не достигли максимума
    if (nextLevel >= FORTUNE_GAMBLE_LEVELS.length) {
      throw new BadRequestException('Maximum Fortune Gamble level reached');
    }

    const nextLevelConfig = FORTUNE_GAMBLE_LEVELS[nextLevel];
    if (!nextLevelConfig) {
      throw new BadRequestException('Invalid gamble level');
    }

    // Стоимость = процент от цены покупки машины
    const upgradeCost: number =
      Number(machine.purchasePrice) *
      (Number(nextLevelConfig.costPercent) / 100);

    // Получаем пользователя и проверяем баланс
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (Number(user.fortuneBalance) < upgradeCost) {
      throw new BadRequestException(
        `Insufficient balance. Need ${upgradeCost} $FORTUNE, have ${Number(user.fortuneBalance)}`,
      );
    }

    // Атомарная транзакция
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Списываем стоимость с баланса
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: {
            decrement: upgradeCost,
          },
        },
      });

      // 2. Апгрейдим машину
      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          fortuneGambleLevel: nextLevel,
        },
      });

      // 3. Создаем транзакцию апгрейда
      await tx.transaction.create({
        data: {
          userId,
          machineId,
          type: 'upgrade_purchase',
          amount: upgradeCost,
          currency: 'FORTUNE',
          netAmount: upgradeCost,
          status: 'completed',
        },
      });

      return { machine: updatedMachine, user: updatedUser };
    });

    return {
      machine: result.machine,
      cost: upgradeCost,
      newLevel: nextLevel,
      newWinChance: Number(nextLevelConfig.winChance),
      user: result.user,
    };
  }

  /**
   * Получить информацию о текущем уровне гамбла и следующем апгрейде
   */
  async getGambleInfo(machineId: string, userId: string): Promise<GambleInfo> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    const currentLevel = machine.fortuneGambleLevel;
    const currentConfig = getGambleLevelConfig(currentLevel);

    const nextLevel = currentLevel + 1;
    const canUpgrade = nextLevel < FORTUNE_GAMBLE_LEVELS.length;
    const nextConfig = canUpgrade ? FORTUNE_GAMBLE_LEVELS[nextLevel] : null;

    const upgradeCost: number | null = nextConfig
      ? Number(machine.purchasePrice) * (Number(nextConfig.costPercent) / 100)
      : null;

    return {
      currentLevel,
      currentWinChance: Number(currentConfig.winChance),
      currentEV: Number(calculateGambleEV(currentLevel)),
      canUpgrade,
      nextLevel: canUpgrade ? nextLevel : null,
      nextWinChance: nextConfig ? Number(nextConfig.winChance) : null,
      nextEV: canUpgrade ? Number(calculateGambleEV(nextLevel)) : null,
      upgradeCost,
    };
  }
}
