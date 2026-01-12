import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Machine, MachineStatus, Prisma } from '@prisma/client';
import {
  MACHINE_TIERS,
  getTierConfigOrThrow,
  COIN_BOX_LEVELS,
  REINVEST_REDUCTION,
} from '@fortune-city/shared';

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
  constructor(private readonly prisma: PrismaService) {}

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
    const tierConfig = getTierConfigOrThrow(input.tier);
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
  }> {
    const machine = await this.findByIdOrThrow(machineId);

    const now = new Date();
    const lastCalc = new Date(machine.lastCalculatedAt);
    const expiresAt = new Date(machine.expiresAt);
    const isExpired = now >= expiresAt || machine.status === 'expired';

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

    return {
      accumulated: Number(machine.accumulatedIncome.add(actualCoinBox)),
      ratePerSecond: Number(machine.ratePerSecond),
      coinBoxCapacity: Number(machine.coinBoxCapacity),
      coinBoxCurrent: Number(actualCoinBox),
      isFull,
      secondsUntilFull,
      isExpired,
      canCollect,
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
      // 1. Update machine: reset coinBox, update lastCalculatedAt
      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          coinBoxCurrent: 0,
          lastCalculatedAt: new Date(),
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

      // 3. Create transaction record
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
    const tierConfig = getTierConfigOrThrow(machine.tier);
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
    return MACHINE_TIERS.map((tier) => ({
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
    const tiers = this.getTiers();
    return tiers.find((t) => t.tier === tier);
  }
}
