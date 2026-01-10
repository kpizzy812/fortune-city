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
  }> {
    const machine = await this.findByIdOrThrow(machineId);

    if (machine.status !== 'active') {
      return {
        accumulated: Number(machine.accumulatedIncome),
        ratePerSecond: Number(machine.ratePerSecond),
        coinBoxCapacity: Number(machine.coinBoxCapacity),
        coinBoxCurrent: Number(machine.coinBoxCurrent),
        isFull: true,
        secondsUntilFull: 0,
      };
    }

    const now = new Date();
    const lastCalc = new Date(machine.lastCalculatedAt);
    const elapsedSeconds = Math.floor(
      (now.getTime() - lastCalc.getTime()) / 1000,
    );

    // Check if machine expired
    const expiresAt = new Date(machine.expiresAt);
    const isExpired = now >= expiresAt;

    let newIncome: Prisma.Decimal;
    if (isExpired) {
      // Calculate remaining income until expiry
      const secondsUntilExpiry = Math.max(
        0,
        Math.floor((expiresAt.getTime() - lastCalc.getTime()) / 1000),
      );
      newIncome = machine.ratePerSecond.mul(secondsUntilExpiry);
    } else {
      newIncome = machine.ratePerSecond.mul(elapsedSeconds);
    }

    const currentCoinBox = machine.coinBoxCurrent.add(newIncome);
    const isFull = currentCoinBox.gte(machine.coinBoxCapacity);
    const actualCoinBox = isFull ? machine.coinBoxCapacity : currentCoinBox;

    // Calculate seconds until full
    const remaining = machine.coinBoxCapacity.sub(actualCoinBox);
    const secondsUntilFull = isFull
      ? 0
      : Math.ceil(Number(remaining.div(machine.ratePerSecond)));

    return {
      accumulated: Number(machine.accumulatedIncome.add(actualCoinBox)),
      ratePerSecond: Number(machine.ratePerSecond),
      coinBoxCapacity: Number(machine.coinBoxCapacity),
      coinBoxCurrent: Number(actualCoinBox),
      isFull,
      secondsUntilFull,
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
  }> {
    const machine = await this.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    // Update coin box first
    await this.updateCoinBox(machineId);
    const updatedMachine = await this.findByIdOrThrow(machineId);

    const collected = Number(updatedMachine.coinBoxCurrent);

    if (collected === 0) {
      return { collected: 0, machine: updatedMachine };
    }

    // Move coins from coinBox to accumulated and reset coinBox
    const resultMachine = await this.prisma.machine.update({
      where: { id: machineId },
      data: {
        accumulatedIncome: {
          increment: updatedMachine.coinBoxCurrent,
        },
        coinBoxCurrent: 0,
        lastCalculatedAt: new Date(),
      },
    });

    return { collected, machine: resultMachine };
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

    const result = await this.prisma.machine.updateMany({
      where: {
        status: 'active',
        expiresAt: { lte: now },
      },
      data: {
        status: 'expired',
      },
    });

    return result.count;
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
