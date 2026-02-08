import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MachinesService } from '../machines.service';
import { FameService } from '../../fame/fame.service';
import {
  calculateSpeedUpFortuneCost,
  calculateSpeedUpFameCost,
} from '@fortune-city/shared';

export interface SpeedUpInfoResponse {
  machineId: string;
  tier: number;
  canSpeedUp: boolean;
  maxDays: number;
  alreadySpedUpDays: number;
  remainingDays: number;
  costPerDay: number;
  fameCostPerDay: number;
}

@Injectable()
export class SpeedUpService {
  private readonly logger = new Logger(SpeedUpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly machinesService: MachinesService,
    private readonly fameService: FameService,
  ) {}

  async getSpeedUpInfo(
    machineId: string,
    userId: string,
  ): Promise<SpeedUpInfoResponse> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    const now = new Date();
    const remainingMs = machine.expiresAt.getTime() - now.getTime();
    const remainingDays = Math.max(0, Math.floor(remainingMs / (24 * 60 * 60 * 1000)));
    const machinePrice = Number(machine.purchasePrice);

    // Max days that can be sped up: remaining days minus 1 (need at least ~1 day left)
    const maxDays = Math.max(0, remainingDays - 1);

    return {
      machineId: machine.id,
      tier: machine.tier,
      canSpeedUp: machine.status === 'active' && !machine.isFree && maxDays > 0,
      maxDays,
      alreadySpedUpDays: machine.speedUpDays,
      remainingDays,
      costPerDay: calculateSpeedUpFortuneCost(machinePrice, 1),
      fameCostPerDay: calculateSpeedUpFameCost(machine.tier, 1),
    };
  }

  async speedUp(
    machineId: string,
    userId: string,
    days: number,
    paymentMethod: 'fortune' | 'fame',
  ) {
    if (days <= 0 || !Number.isInteger(days)) {
      throw new BadRequestException('Days must be a positive integer');
    }

    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    if (machine.isFree) {
      throw new BadRequestException('Free machines cannot be sped up');
    }

    if (machine.status !== 'active') {
      throw new BadRequestException('Only active machines can be sped up');
    }

    // Check remaining time
    const now = new Date();
    const remainingMs = machine.expiresAt.getTime() - now.getTime();
    const remainingDays = remainingMs / (24 * 60 * 60 * 1000);

    if (days >= remainingDays) {
      throw new BadRequestException(
        `Cannot speed up by ${days} days. Only ${Math.floor(remainingDays)} days remaining (need at least 1 day left).`,
      );
    }

    const machinePrice = Number(machine.purchasePrice);

    if (paymentMethod === 'fame') {
      return this.speedUpWithFame(machine, userId, days);
    }

    return this.speedUpWithFortune(machine, userId, days, machinePrice);
  }

  private async speedUpWithFortune(
    machine: any,
    userId: string,
    days: number,
    machinePrice: number,
  ) {
    const cost = calculateSpeedUpFortuneCost(machinePrice, days);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (Number(user.fortuneBalance) < cost) {
      throw new BadRequestException(
        `Insufficient balance. Need $${cost.toFixed(2)}, have $${Number(user.fortuneBalance).toFixed(2)}`,
      );
    }

    const skipMs = days * 24 * 60 * 60 * 1000;
    const newExpiresAt = new Date(machine.expiresAt.getTime() - skipMs);

    // Calculate new ratePerSecond: remaining yield / remaining seconds
    const totalPaidOut = Number(machine.profitPaidOut) + Number(machine.principalPaidOut);
    const remainingYield = Number(machine.totalYield) - totalPaidOut;
    const now = new Date();
    const remainingSeconds = Math.max(1, (newExpiresAt.getTime() - now.getTime()) / 1000);
    const newRatePerSecond = remainingYield / remainingSeconds;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: { decrement: cost },
        },
      });

      const updatedMachine = await tx.machine.update({
        where: { id: machine.id },
        data: {
          expiresAt: newExpiresAt,
          ratePerSecond: newRatePerSecond,
          speedUpDays: { increment: days },
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          machineId: machine.id,
          type: 'speed_up',
          amount: cost,
          currency: 'FORTUNE',
          netAmount: cost,
          status: 'completed',
        },
      });

      return { machine: updatedMachine, user: updatedUser };
    });

    this.logger.log(
      `Speed Up: user=${userId} machine=${machine.id} tier=${machine.tier} days=${days} cost=$${cost.toFixed(2)}`,
    );

    return {
      machine: result.machine,
      days,
      cost,
      paymentMethod: 'fortune' as const,
      newExpiresAt,
      user: result.user,
    };
  }

  private async speedUpWithFame(
    machine: any,
    userId: string,
    days: number,
  ) {
    const fameCost = calculateSpeedUpFameCost(machine.tier, days);

    const skipMs = days * 24 * 60 * 60 * 1000;
    const newExpiresAt = new Date(machine.expiresAt.getTime() - skipMs);

    // Calculate new ratePerSecond
    const totalPaidOut = Number(machine.profitPaidOut) + Number(machine.principalPaidOut);
    const remainingYield = Number(machine.totalYield) - totalPaidOut;
    const now = new Date();
    const remainingSeconds = Math.max(1, (newExpiresAt.getTime() - now.getTime()) / 1000);
    const newRatePerSecond = remainingYield / remainingSeconds;

    const result = await this.prisma.$transaction(async (tx) => {
      await this.fameService.spendFame(userId, fameCost, 'speed_up', {
        description: `Speed Up ${days}d for tier ${machine.tier}`,
        tx,
      });

      const updatedMachine = await tx.machine.update({
        where: { id: machine.id },
        data: {
          expiresAt: newExpiresAt,
          ratePerSecond: newRatePerSecond,
          speedUpDays: { increment: days },
        },
      });

      const updatedUser = await tx.user.findUniqueOrThrow({
        where: { id: userId },
      });

      return { machine: updatedMachine, user: updatedUser };
    });

    this.logger.log(
      `Speed Up (Fame): user=${userId} machine=${machine.id} tier=${machine.tier} days=${days} cost=${fameCost}⚡`,
    );

    return {
      machine: result.machine,
      days,
      cost: fameCost,
      paymentMethod: 'fame' as const,
      newExpiresAt,
      user: result.user,
    };
  }
}
