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
  COIN_BOX_CAPACITY_HOURS,
  REINVEST_REDUCTION,
  calculateEarlySellCommission,
} from '@fortune-city/shared';
import { FundSourceService } from '../economy/services/fund-source.service';
import { FameService } from '../fame/fame.service';
import { SettingsService } from '../settings/settings.service';
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
    private readonly fameService: FameService,
    private readonly settingsService: SettingsService,
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

    // Fixed coin box capacity (12 hours for all machines)
    const coinBoxCapacity = ratePerSecond.mul(
      COIN_BOX_CAPACITY_HOURS * 60 * 60,
    );

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + tierConfig.lifespanDays * 24 * 60 * 60 * 1000,
    );

    // Prelaunch: machine is frozen (purchased but not generating income)
    // startedAt/expiresAt will be recalculated on unfreeze
    const isPrelaunch = await this.settingsService.isPrelaunch();
    const status = isPrelaunch ? 'frozen' : 'active';

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
        status,
      },
    });
  }

  /**
   * Create a free machine (milestone reward) — no payment, reinvestRound=1
   */
  async createFreeMachine(
    userId: string,
    tier: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Machine> {
    const client = tx ?? this.prisma;
    const tierConfig = this.tierCacheService.getTierOrThrow(tier);

    // Same yield calculation as regular purchase, reinvestRound = 1 (no penalty)
    const totalYield = new Prisma.Decimal(tierConfig.price)
      .mul(tierConfig.yieldPercent)
      .div(100);
    const profitAmount = totalYield.sub(tierConfig.price);
    const actualTotalYield = new Prisma.Decimal(tierConfig.price).add(
      profitAmount,
    );

    const lifespanSeconds = tierConfig.lifespanDays * 24 * 60 * 60;
    const ratePerSecond = actualTotalYield.div(lifespanSeconds);
    const coinBoxCapacity = ratePerSecond.mul(
      COIN_BOX_CAPACITY_HOURS * 60 * 60,
    );

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + tierConfig.lifespanDays * 24 * 60 * 60 * 1000,
    );

    const isPrelaunch = await this.settingsService.isPrelaunch();
    const status = isPrelaunch ? 'frozen' : 'active';

    return client.machine.create({
      data: {
        userId,
        tier: tierConfig.tier,
        purchasePrice: 0, // Free machine
        totalYield: actualTotalYield,
        profitAmount,
        lifespanDays: tierConfig.lifespanDays,
        startedAt: now,
        expiresAt,
        ratePerSecond,
        coinBoxCapacity,
        reinvestRound: 1,
        profitReductionRate: 0,
        status,
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
    isAutoCollect: boolean = false,
  ): Promise<{
    collected: number;
    machine: Machine;
    newBalance: number;
    fameEarned: number;
    overclockApplied: boolean;
    overclockMultiplier: number;
    baseAmount: number;
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

    const baseCollected = incomeState.coinBoxCurrent;

    if (baseCollected === 0) {
      const currentMachine = await this.findByIdOrThrow(machineId);
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      return {
        collected: 0,
        machine: currentMachine,
        newBalance: Number(user?.fortuneBalance ?? 0),
        fameEarned: 0,
        overclockApplied: false,
        overclockMultiplier: 0,
        baseAmount: 0,
      };
    }

    // Overclock: boost collection if active
    const overclockMultiplier = Number(machine.overclockMultiplier);
    const hasOverclock = overclockMultiplier > 0;
    const overclockBonus = hasOverclock
      ? baseCollected * (overclockMultiplier - 1)
      : 0;
    const effectiveCollected = baseCollected + overclockBonus;

    // Atomic transaction: coinBox → fortuneBalance + create transaction record
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update machine: reset coinBox, track payouts, reset overclock, reset notification dedup
      const machineUpdateData: any = {
        coinBoxCurrent: 0,
        lastCalculatedAt: new Date(),
        profitPaidOut: {
          increment: incomeState.currentProfit + overclockBonus,
        },
        principalPaidOut: {
          increment: incomeState.currentPrincipal,
        },
        coinBoxFullNotifiedAt: null,
        coinBoxAlmostFullNotifiedAt: null,
      };

      // Reset overclock after collection
      if (hasOverclock) {
        machineUpdateData.overclockMultiplier = 0;
      }

      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: machineUpdateData,
      });

      // 2. Add to user balance (with overclock bonus)
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: {
            increment: effectiveCollected,
          },
        },
      });

      // 3. Track profit collection (including overclock bonus as profit)
      const totalProfit = incomeState.currentProfit + overclockBonus;
      if (totalProfit > 0) {
        await this.fundSourceService.recordProfitCollection(
          userId,
          totalProfit,
          tx,
        );
      }

      // 4. Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          machineId,
          type: 'machine_income',
          amount: effectiveCollected,
          currency: 'FORTUNE',
          netAmount: effectiveCollected,
          status: 'completed',
        },
      });

      // 5. Fame: passive Fame from machine + manual collect bonus
      let fameEarned = 0;

      // Passive Fame (always, both auto and manual)
      if (machine.status === 'active') {
        fameEarned += await this.fameService.earnMachinePassiveFame(
          userId,
          machineId,
          machine.tier,
          machine.lastFameCalculatedAt,
          tx,
        );
      }

      // Manual collect bonus (only for non-auto collects)
      if (!isAutoCollect) {
        fameEarned += await this.fameService.earnManualCollectFame(
          userId,
          machineId,
          tx,
        );
      }

      return {
        machine: updatedMachine,
        newBalance: Number(updatedUser.fortuneBalance),
        fameEarned,
      };
    });

    return {
      collected: effectiveCollected,
      machine: result.machine,
      newBalance: result.newBalance,
      fameEarned: result.fameEarned,
      overclockApplied: hasOverclock,
      overclockMultiplier: hasOverclock ? overclockMultiplier : 0,
      baseAmount: baseCollected,
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

  async checkAndExpireMachines(): Promise<
    { id: string; userId: string; tier: number; accumulatedIncome: number }[]
  > {
    const now = new Date();

    const machinesToExpire = await this.prisma.machine.findMany({
      where: {
        status: 'active',
        expiresAt: { lte: now },
      },
    });

    if (machinesToExpire.length === 0) {
      return [];
    }

    await this.prisma.$transaction(async (tx) => {
      for (const machine of machinesToExpire) {
        await tx.machine.update({
          where: { id: machine.id },
          data: { status: 'expired' },
        });
      }
    });

    return machinesToExpire.map((m) => ({
      id: m.id,
      userId: m.userId,
      tier: m.tier,
      accumulatedIncome: Number(m.accumulatedIncome),
    }));
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
      profit: Math.round(
        tierConfig.price * (tierConfig.yieldPercent / 100) - tierConfig.price,
      ),
      dailyRate: +(tierConfig.yieldPercent / tierConfig.lifespanDays).toFixed(
        2,
      ),
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
}
