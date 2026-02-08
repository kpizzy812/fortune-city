import { Injectable, BadRequestException } from '@nestjs/common';
import { Machine, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MachinesService } from '../machines.service';
import { FameService } from '../../fame/fame.service';
import { SettingsService } from '../../settings/settings.service';
import {
  COLLECTOR_SALARY_PERCENT,
  calculateCollectorHireCost,
  calculateCollectorHireFameCost,
} from '@fortune-city/shared';

export type PaymentMethod = 'fortune' | 'fame';

export interface AutoCollectInfo {
  enabled: boolean;
  hireCost: number; // 10% of gross profit (dynamic per tier)
  hireCostFame: number; // Fame alternative (5h of passive farming)
  salaryPercent: number; // 5% of each collection
  purchasedAt: Date | null;
  canPurchase: boolean;
  alreadyPurchased: boolean;
}

export interface PurchaseAutoCollectResult {
  machine: Machine;
  cost: number;
  paymentMethod: PaymentMethod;
  user: User;
  newBalance: number;
}

export interface AutoCollectExecutionResult {
  machineId: string;
  amountCollected: number;
  success: boolean;
}

@Injectable()
export class AutoCollectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly machinesService: MachinesService,
    private readonly fameService: FameService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Получить информацию о модуле Collector (Auto Collect) для машины
   * Механика: 10% от gross прибыли найм + 5% от каждого сбора
   */
  async getAutoCollectInfo(
    machineId: string,
    userId: string,
  ): Promise<AutoCollectInfo> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    const settings = await this.settingsService.getSettings();

    // Dynamic hire cost based on machine's tier gross profit (admin-configurable %)
    const hirePercent = Number(settings.collectorHirePercent);
    const hireCost = calculateCollectorHireCost(machine.tier, hirePercent);
    const hireCostFame = calculateCollectorHireFameCost(machine.tier);

    return {
      enabled: machine.autoCollectEnabled,
      hireCost,
      hireCostFame,
      salaryPercent: Number(settings.collectorSalaryPercent),
      purchasedAt: machine.autoCollectPurchasedAt,
      canPurchase: machine.status === 'active' && !machine.autoCollectEnabled,
      alreadyPurchased: machine.autoCollectEnabled,
    };
  }

  /**
   * Нанять инкассатора (Collector) для машины
   * Оплата: 10% от gross прибыли (FORTUNE) или эквивалент в Fame
   * Зарплата: 5% от каждого автосбора
   * Инкассатор "увольняется" когда машина изнашивается
   */
  async purchaseAutoCollect(
    machineId: string,
    userId: string,
    paymentMethod: PaymentMethod = 'fortune',
  ): Promise<PurchaseAutoCollectResult> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    if (machine.isFree) {
      throw new BadRequestException('Free machines cannot be upgraded');
    }

    if (machine.status !== 'active') {
      throw new BadRequestException(
        'Cannot hire collector for expired machine',
      );
    }

    if (machine.autoCollectEnabled) {
      throw new BadRequestException('Collector already hired');
    }

    // Dynamic cost based on machine's tier (admin-configurable %)
    const settings = await this.settingsService.getSettings();
    const hirePercent = Number(settings.collectorHirePercent);
    const fortuneCost = calculateCollectorHireCost(machine.tier, hirePercent);
    const fameCost = calculateCollectorHireFameCost(machine.tier);

    if (paymentMethod === 'fame') {
      return this.purchaseWithFame(machineId, userId, fameCost);
    }

    return this.purchaseWithFortune(machineId, userId, fortuneCost);
  }

  private async purchaseWithFortune(
    machineId: string,
    userId: string,
    cost: number,
  ): Promise<PurchaseAutoCollectResult> {
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
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: { decrement: cost },
        },
      });

      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          autoCollectEnabled: true,
          autoCollectPurchasedAt: new Date(),
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          machineId,
          type: 'collector_hire',
          amount: cost,
          currency: 'FORTUNE',
          netAmount: cost,
          status: 'completed',
        },
      });

      return { machine: updatedMachine, user: updatedUser };
    });

    return {
      machine: result.machine,
      cost,
      paymentMethod: 'fortune',
      user: result.user,
      newBalance: Number(result.user.fortuneBalance),
    };
  }

  private async purchaseWithFame(
    machineId: string,
    userId: string,
    fameCost: number,
  ): Promise<PurchaseAutoCollectResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Spend Fame (atomic, throws if insufficient)
      await this.fameService.spendFame(userId, fameCost, 'collector_hire', {
        description: 'Hired collector',
        tx,
      });

      // 2. Enable auto-collect on machine
      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          autoCollectEnabled: true,
          autoCollectPurchasedAt: new Date(),
        },
      });

      const updatedUser = await tx.user.findUniqueOrThrow({
        where: { id: userId },
      });

      return { machine: updatedMachine, user: updatedUser };
    });

    return {
      machine: result.machine,
      cost: fameCost,
      paymentMethod: 'fame',
      user: result.user,
      newBalance: Number(result.user.fortuneBalance),
    };
  }

  /**
   * Проверить, нужен ли автосбор для машины
   */
  async shouldAutoCollect(machine: Machine): Promise<boolean> {
    if (!machine.autoCollectEnabled) {
      return false;
    }

    if (machine.status !== 'active') {
      return false;
    }

    const incomeState = await this.machinesService.calculateIncome(machine.id);
    return incomeState.canCollect && Number(incomeState.coinBoxCurrent) > 0;
  }

  /**
   * Выполнить автосбор для машины с зарплатой инкассатора
   */
  async executeAutoCollect(
    machineId: string,
  ): Promise<AutoCollectExecutionResult> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    const shouldCollect = await this.shouldAutoCollect(machine);

    if (!shouldCollect) {
      return {
        machineId,
        amountCollected: 0,
        success: false,
      };
    }

    try {
      const result = await this.machinesService.collectCoins(
        machineId,
        machine.userId,
        true,
      );

      const collected = Number(result.collected);
      const salary = collected * (COLLECTOR_SALARY_PERCENT / 100);

      if (salary > 0) {
        await this.prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: machine.userId },
            data: {
              fortuneBalance: { decrement: salary },
            },
          });

          await tx.transaction.create({
            data: {
              userId: machine.userId,
              machineId,
              type: 'collector_salary',
              amount: salary,
              currency: 'FORTUNE',
              netAmount: salary,
              status: 'completed',
            },
          });
        });
      }

      return {
        machineId,
        amountCollected: collected - salary,
        success: true,
      };
    } catch (error) {
      console.error(`Auto collect failed for machine ${machineId}:`, error);
      return {
        machineId,
        amountCollected: 0,
        success: false,
      };
    }
  }

  /**
   * Выполнить автосбор для всех машин с включенным Auto Collect
   */
  async executeAutoCollectForAll(): Promise<AutoCollectExecutionResult[]> {
    const machines = await this.prisma.machine.findMany({
      where: {
        status: 'active',
        autoCollectEnabled: true,
      },
    });

    const results: AutoCollectExecutionResult[] = [];

    for (const machine of machines) {
      const result = await this.executeAutoCollect(machine.id);
      if (result.success) {
        results.push(result);
      }
    }

    return results;
  }
}
