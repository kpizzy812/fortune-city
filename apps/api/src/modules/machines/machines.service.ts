import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Machine, MachineStatus, Prisma } from '@prisma/client';
import {
  COIN_BOX_LEVELS,
  REINVEST_REDUCTION,
  calculateEarlySellCommission,
} from '@fortune-city/shared';
import { FundSourceService } from '../economy/services/fund-source.service';
import { TierCacheService } from './services/tier-cache.service';

export interface CreateMachineInput {
  tier: number;
  reinvestRound?: number;
}

export interface MachineWithTierInfo extends Machine {
  tierInfo: {
    name: string;
    emoji: string;
    imageUrl: string;
    yieldPercent: number;
  };
}

@Injectable()
export class MachinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tierCacheService: TierCacheService,
    @Inject(forwardRef(() => FundSourceService))
    private readonly fundSourceService: FundSourceService,
  ) {}

  async findById(id: string): Promise<Machine | null> {
    return this.prisma.machine.findUnique({
      where: { id },
      include: { fundSource: true },
    });
  }

  async findByIdOrThrow(id: string): Promise<Machine> {
    const machine = await this.findById(id);
    if (!machine) {
      throw new NotFoundException(`Machine ${id} not found`);
    }
    return machine;
  }

  async findByUserId(
    userId: string,
    status?: MachineStatus,
  ): Promise<Machine[]> {
    return this.prisma.machine.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
      include: { fundSource: true },
    });
  }

  async getActiveMachines(userId: string): Promise<Machine[]> {
    return this.findByUserId(userId, 'active');
  }

  async create(userId: string, input: CreateMachineInput): Promise<Machine> {
    const tierConfig = this.tierCacheService.getTierOrThrow(input.tier);
    const reinvestRound = input.reinvestRound ?? 1;

    // Calculate profit reduction for reinvest
    const reductionRate = REINVEST_REDUCTION[reinvestRound] ?? 0.85;

    // Calculate yields
    const totalYield = new Prisma.Decimal(tierConfig.price)
      .mul(tierConfig.yieldPercent)
      .div(100);

    const profitBase = totalYield.sub(tierConfig.price);
    const profitAmount = profitBase.mul(1 - reductionRate);

    const actualTotalYield = new Prisma.Decimal(tierConfig.price).add(
      profitAmount,
    );

    // Calculate rate per second
    const lifespanSeconds = tierConfig.lifespanDays * 24 * 60 * 60;
    const ratePerSecond = actualTotalYield.div(lifespanSeconds);

    // Get initial coin box capacity (level 1)
    const coinBoxConfig = COIN_BOX_LEVELS[0];
    const coinBoxCapacity = ratePerSecond.mul(
      coinBoxConfig.capacityHours * 60 * 60,
    );

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + tierConfig.lifespanDays * 24 * 60 * 60 * 1000,
    );

    return this.prisma.machine.create({
      data: {
        userId,
        tier: tierConfig.tier,
        purchasePrice: tierConfig.price,
        totalYield: actualTotalYield,
        profitAmount,
        lifespanDays: tierConfig.lifespanDays,
        startedAt: now,
        expiresAt,
        ratePerSecond,
        coinBoxCapacity,
        reinvestRound,
        profitReductionRate: reductionRate,
        status: 'active',
      },
    });
  }

  async calculateIncome(machineId: string): Promise<{
    accumulated: number;
    ratePerSecond: number;
    coinBoxCapacity: number;
    coinBoxCurrent: number;
    isFull: boolean;
    secondsUntilFull: number;
    isExpired: boolean;
    canCollect: boolean;
    // Payout tracking
    profitPaidOut: number;
    principalPaidOut: number;
    profitRemaining: number;
    principalRemaining: number;
    currentProfit: number;
    currentPrincipal: number;
    isBreakevenReached: boolean;
  }> {
    const machine = await this.findByIdOrThrow(machineId);

    const now = new Date();
    const lastCalc = new Date(machine.lastCalculatedAt);
    const expiresAt = new Date(machine.expiresAt);
    const isExpired = now >= expiresAt || machine.status === 'expired';

    // Calculate payout tracking
    const profitPaidOut = Number(machine.profitPaidOut);
    const principalPaidOut = Number(machine.principalPaidOut);
    const profitAmount = Number(machine.profitAmount);
    const purchasePrice = Number(machine.purchasePrice);

    const profitRemaining = Math.max(0, profitAmount - profitPaidOut);
    const principalRemaining = Math.max(0, purchasePrice - principalPaidOut);
    const isBreakevenReached = profitPaidOut >= profitAmount;

    // For sold_early machines, return current values without recalculation
    if (machine.status === 'sold_early') {
      return {
        accumulated: Number(machine.accumulatedIncome),
        ratePerSecond: Number(machine.ratePerSecond),
        coinBoxCapacity: Number(machine.coinBoxCapacity),
        coinBoxCurrent: Number(machine.coinBoxCurrent),
        isFull: true,
        secondsUntilFull: 0,
        isExpired: true,
        canCollect: Number(machine.coinBoxCurrent) > 0,
        profitPaidOut,
        principalPaidOut,
        profitRemaining,
        principalRemaining,
        currentProfit: 0,
        currentPrincipal: 0,
        isBreakevenReached,
      };
    }

    // Calculate new income since last calculation
    let newIncome: Prisma.Decimal;
    if (isExpired) {
      // Calculate income only until expiry time
      const secondsUntilExpiry = Math.max(
        0,
        Math.floor((expiresAt.getTime() - lastCalc.getTime()) / 1000),
      );
      newIncome = machine.ratePerSecond.mul(secondsUntilExpiry);
    } else {
      const elapsedSeconds = Math.floor(
        (now.getTime() - lastCalc.getTime()) / 1000,
      );
      newIncome = machine.ratePerSecond.mul(elapsedSeconds);
    }

    const currentCoinBox = machine.coinBoxCurrent.add(newIncome);
    const isFull = currentCoinBox.gte(machine.coinBoxCapacity);
    const actualCoinBox = isFull ? machine.coinBoxCapacity : currentCoinBox;

    // Calculate seconds until full (only for active machines)
    const remaining = machine.coinBoxCapacity.sub(actualCoinBox);
    const secondsUntilFull =
      isFull || isExpired
        ? 0
        : Math.ceil(Number(remaining.div(machine.ratePerSecond)));

    // Can collect: expired machines always, active only when full
    const canCollect = isExpired || isFull;

    // Calculate current profit and principal in coinBox
    // Rule: profit is paid first, then principal
    const coinBoxValue = Number(actualCoinBox);
    const currentProfit = Math.min(coinBoxValue, profitRemaining);
    const currentPrincipal = Math.max(0, coinBoxValue - currentProfit);

    return {
      accumulated: Number(machine.accumulatedIncome.add(actualCoinBox)),
      ratePerSecond: Number(machine.ratePerSecond),
      coinBoxCapacity: Number(machine.coinBoxCapacity),
      coinBoxCurrent: Number(actualCoinBox),
      isFull,
      secondsUntilFull,
      isExpired,
      canCollect,
      profitPaidOut,
      principalPaidOut,
      profitRemaining,
      principalRemaining,
      currentProfit,
      currentPrincipal,
      isBreakevenReached,
    };
  }

  async updateCoinBox(machineId: string): Promise<Machine> {
    const income = await this.calculateIncome(machineId);

    return this.prisma.machine.update({
      where: { id: machineId },
      data: {
        coinBoxCurrent: income.coinBoxCurrent,
        lastCalculatedAt: new Date(),
      },
    });
  }

  async collectCoins(
    machineId: string,
    userId: string,
  ): Promise<{
    collected: number;
    machine: Machine;
    newBalance: number;
  }> {
    const machine = await this.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    // Calculate current income state
    const incomeState = await this.calculateIncome(machineId);

    // Check if collection is allowed
    if (!incomeState.canCollect) {
      throw new BadRequestException(
        `CoinBox is not full yet. Wait ${incomeState.secondsUntilFull} seconds.`,
      );
    }

    const collected = incomeState.coinBoxCurrent;

    if (collected === 0) {
      const currentMachine = await this.findByIdOrThrow(machineId);
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      return {
        collected: 0,
        machine: currentMachine,
        newBalance: Number(user?.fortuneBalance ?? 0),
      };
    }

    // Atomic transaction: coinBox → fortuneBalance + create transaction record
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update machine: reset coinBox, update lastCalculatedAt, track payouts
      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          coinBoxCurrent: 0,
          lastCalculatedAt: new Date(),
          profitPaidOut: {
            increment: incomeState.currentProfit,
          },
          principalPaidOut: {
            increment: incomeState.currentPrincipal,
          },
        },
      });

      // 2. Add to user balance
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: {
            increment: collected,
          },
        },
      });

      // 3. Track profit collection for user-level fund source tracking
      // Only the profit portion counts as profit collected (for tax calculation on withdrawal)
      if (incomeState.currentProfit > 0) {
        await this.fundSourceService.recordProfitCollection(
          userId,
          incomeState.currentProfit,
          tx,
        );
      }

      // 4. Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          machineId,
          type: 'machine_income',
          amount: collected,
          currency: 'FORTUNE',
          netAmount: collected,
          status: 'completed',
        },
      });

      return {
        machine: updatedMachine,
        newBalance: Number(updatedUser.fortuneBalance),
      };
    });

    return {
      collected,
      machine: result.machine,
      newBalance: result.newBalance,
    };
  }

  async expireMachine(machineId: string): Promise<Machine> {
    return this.prisma.machine.update({
      where: { id: machineId },
      data: {
        status: 'expired',
      },
    });
  }

  async checkAndExpireMachines(): Promise<number> {
    const now = new Date();

    // Find all machines that need to expire (with user info)
    const machinesToExpire = await this.prisma.machine.findMany({
      where: {
        status: 'active',
        expiresAt: { lte: now },
      },
      include: {
        user: true,
      },
    });

    if (machinesToExpire.length === 0) {
      return 0;
    }

    // Process each machine in a transaction
    await this.prisma.$transaction(async (tx) => {
      for (const machine of machinesToExpire) {
        // 1. Mark machine as expired
        await tx.machine.update({
          where: { id: machine.id },
          data: { status: 'expired' },
        });

        // 2. Unlock next tier for user if this tier >= current maxTierUnlocked
        // Only unlock if this was a progression machine (not buying lower tiers again)
        const nextTier = machine.tier + 1;
        if (nextTier <= 10 && machine.tier >= machine.user.maxTierUnlocked) {
          await tx.user.update({
            where: { id: machine.userId },
            data: {
              maxTierUnlocked: Math.max(machine.user.maxTierUnlocked, nextTier),
            },
          });
        }
      }
    });

    return machinesToExpire.length;
  }

  enrichWithTierInfo(machine: Machine): MachineWithTierInfo {
    const tierConfig = this.tierCacheService.getTierOrThrow(machine.tier);
    return {
      ...machine,
      tierInfo: {
        name: tierConfig.name,
        emoji: tierConfig.emoji,
        imageUrl: tierConfig.imageUrl,
        yieldPercent: tierConfig.yieldPercent,
      },
    };
  }

  getTiers() {
    // Get visible tiers from cache (reads from DB)
    return this.tierCacheService.getAllTiers().map((tier) => ({
      tier: tier.tier,
      name: tier.name,
      emoji: tier.emoji,
      imageUrl: tier.imageUrl,
      price: tier.price,
      lifespanDays: tier.lifespanDays,
      yieldPercent: tier.yieldPercent,
      profit: Math.round(tier.price * (tier.yieldPercent / 100) - tier.price),
      dailyRate: +(tier.yieldPercent / tier.lifespanDays).toFixed(2),
    }));
  }

  getTierById(tier: number) {
    const tierConfig = this.tierCacheService.getTier(tier);
    if (!tierConfig) return null;

    return {
      tier: tierConfig.tier,
      name: tierConfig.name,
      emoji: tierConfig.emoji,
      imageUrl: tierConfig.imageUrl,
      price: tierConfig.price,
      lifespanDays: tierConfig.lifespanDays,
      yieldPercent: tierConfig.yieldPercent,
      profit: Math.round(tierConfig.price * (tierConfig.yieldPercent / 100) - tierConfig.price),
      dailyRate: +(tierConfig.yieldPercent / tierConfig.lifespanDays).toFixed(2),
    };
  }

  async sellMachineEarly(
    machineId: string,
    userId: string,
  ): Promise<{
    machine: Machine;
    profitReturned: number;
    principalReturned: number;
    totalReturned: number;
    commission: number;
    commissionRate: number;
    newBalance: number;
  }> {
    const machine = await this.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    if (machine.status !== 'active') {
      throw new BadRequestException('Can only sell active machines');
    }

    // Calculate current income state
    const incomeState = await this.calculateIncome(machineId);

    // Calculate what's in coinBox and what's already paid out
    const coinBoxAmount = incomeState.coinBoxCurrent;
    const profitPaidOut = incomeState.profitPaidOut;
    const principalPaidOut = incomeState.principalPaidOut;
    const profitAmount = Number(machine.profitAmount);
    const purchasePrice = Number(machine.purchasePrice);

    // Calculate remaining principal
    const principalRemaining = Math.max(0, purchasePrice - principalPaidOut);

    // Early sell commission based on progress to BE
    const commissionRate = calculateEarlySellCommission(
      profitPaidOut,
      profitAmount,
    );

    // Calculate what user gets back
    // 1. Profit in coinBox (not paid out yet) - no commission on collection
    const profitInCoinBox = incomeState.currentProfit;
    const principalInCoinBox = incomeState.currentPrincipal;

    // 2. Remaining principal (not yet paid out) - with commission
    const principalNotInCoinBox = principalRemaining - principalInCoinBox;
    const principalReturned = principalNotInCoinBox * (1 - commissionRate);

    // Total returned
    const totalReturned = coinBoxAmount + principalReturned;
    const commission = principalNotInCoinBox * commissionRate;

    // Atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Mark machine as sold_early
      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          status: 'sold_early',
          coinBoxCurrent: 0,
          lastCalculatedAt: new Date(),
          profitPaidOut: {
            increment: profitInCoinBox,
          },
          principalPaidOut: {
            increment: principalInCoinBox + principalReturned,
          },
        },
      });

      // 2. Add to user balance
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: {
            increment: totalReturned,
          },
        },
      });

      // 3. Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          machineId,
          type: 'machine_early_sell',
          amount: totalReturned,
          currency: 'FORTUNE',
          taxAmount: commission,
          taxRate: commissionRate,
          netAmount: totalReturned,
          status: 'completed',
        },
      });

      return {
        machine: updatedMachine,
        newBalance: Number(updatedUser.fortuneBalance),
      };
    });

    return {
      machine: result.machine,
      profitReturned: profitInCoinBox,
      principalReturned: principalInCoinBox + principalReturned,
      totalReturned,
      commission,
      commissionRate,
      newBalance: result.newBalance,
    };
  }

  /**
   * Получить информацию о текущем уровне Coin Box и следующем апгрейде
   */
  async getCoinBoxInfo(
    machineId: string,
    userId: string,
  ): Promise<{
    currentLevel: number;
    currentCapacityHours: number;
    canUpgrade: boolean;
    nextLevel: number | null;
    nextCapacityHours: number | null;
    upgradeCost: number | null;
  }> {
    const machine = await this.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    const currentLevel = machine.coinBoxLevel;
    const currentConfig = COIN_BOX_LEVELS[currentLevel - 1]; // 0-indexed

    const nextLevel = currentLevel + 1;
    const canUpgrade = nextLevel <= COIN_BOX_LEVELS.length;
    const nextConfig = canUpgrade ? COIN_BOX_LEVELS[nextLevel - 1] : null;

    const upgradeCost = nextConfig
      ? Number(machine.purchasePrice) * (Number(nextConfig.costPercent) / 100)
      : null;

    return {
      currentLevel,
      currentCapacityHours: currentConfig.capacityHours,
      canUpgrade,
      nextLevel: canUpgrade ? nextLevel : null,
      nextCapacityHours: nextConfig ? nextConfig.capacityHours : null,
      upgradeCost,
    };
  }

  /**
   * Апгрейд уровня Coin Box (увеличение capacity)
   */
  async upgradeCoinBox(
    machineId: string,
    userId: string,
  ): Promise<{
    machine: Machine;
    cost: number;
    newLevel: number;
    newCapacity: number;
    user: { id: string; fortuneBalance: Prisma.Decimal };
  }> {
    const machine = await this.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    if (machine.status !== 'active') {
      throw new BadRequestException('Cannot upgrade expired machine');
    }

    const currentLevel = machine.coinBoxLevel;
    const nextLevel = currentLevel + 1;

    // Проверяем, что не достигли максимума (5 уровней)
    if (nextLevel > COIN_BOX_LEVELS.length) {
      throw new BadRequestException(
        `Maximum Coin Box level reached (${COIN_BOX_LEVELS.length})`,
      );
    }

    const nextLevelConfig = COIN_BOX_LEVELS[nextLevel - 1]; // Array is 0-indexed
    if (!nextLevelConfig) {
      throw new BadRequestException('Invalid coin box level');
    }

    // Стоимость = процент от цены покупки машины
    const upgradeCost =
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

    // Рассчитываем новую capacity
    const newCapacity =
      Number(machine.ratePerSecond) * (nextLevelConfig.capacityHours * 60 * 60);

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

      // 2. Апгрейдим машину (уровень и capacity)
      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          coinBoxLevel: nextLevel,
          coinBoxCapacity: newCapacity,
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
      newCapacity,
      user: {
        id: result.user.id,
        fortuneBalance: result.user.fortuneBalance,
      },
    };
  }
}
