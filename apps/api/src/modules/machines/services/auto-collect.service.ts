import { Injectable, BadRequestException } from '@nestjs/common';
import { Machine, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MachinesService } from '../machines.service';
import {
  COLLECTOR_HIRE_COST,
  COLLECTOR_SALARY_PERCENT,
} from '@fortune-city/shared';

export interface AutoCollectInfo {
  enabled: boolean;
  hireCost: number; // Fixed $5 hire cost
  salaryPercent: number; // 5% of each collection
  purchasedAt: Date | null;
  canPurchase: boolean;
  alreadyPurchased: boolean;
}

export interface PurchaseAutoCollectResult {
  machine: Machine;
  cost: number;
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
  ) {}

  /**
   * Получить информацию о модуле Collector (Auto Collect) для машины
   * Механика: $5 найм + 5% от каждого сбора
   */
  async getAutoCollectInfo(
    machineId: string,
    userId: string,
  ): Promise<AutoCollectInfo> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    return {
      enabled: machine.autoCollectEnabled,
      hireCost: COLLECTOR_HIRE_COST,
      salaryPercent: COLLECTOR_SALARY_PERCENT,
      purchasedAt: machine.autoCollectPurchasedAt,
      canPurchase: machine.status === 'active' && !machine.autoCollectEnabled,
      alreadyPurchased: machine.autoCollectEnabled,
    };
  }

  /**
   * Нанять инкассатора (Collector) для машины
   * Цена: $5 фиксированная плата за найм
   * Зарплата: 5% от каждого автосбора
   * Инкассатор "увольняется" когда машина изнашивается
   */
  async purchaseAutoCollect(
    machineId: string,
    userId: string,
  ): Promise<PurchaseAutoCollectResult> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    if (machine.status !== 'active') {
      throw new BadRequestException(
        'Cannot hire collector for expired machine',
      );
    }

    if (machine.autoCollectEnabled) {
      throw new BadRequestException('Collector already hired');
    }

    // Фиксированная стоимость найма: $5
    const cost = COLLECTOR_HIRE_COST;

    // Получаем пользователя и проверяем баланс
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

    // Атомарная транзакция
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Списываем стоимость найма с баланса
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: {
            decrement: cost,
          },
        },
      });

      // 2. Активируем инкассатора на машине
      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          autoCollectEnabled: true,
          autoCollectPurchasedAt: new Date(),
        },
      });

      // 3. Создаем транзакцию найма
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
      user: result.user,
      newBalance: Number(result.user.fortuneBalance),
    };
  }

  /**
   * Проверить, нужен ли автосбор для машины
   * Автосбор срабатывает когда:
   * - Машина активна
   * - autoCollectEnabled = true
   * - Coin Box полный (canCollect = true)
   */
  async shouldAutoCollect(machine: Machine): Promise<boolean> {
    if (!machine.autoCollectEnabled) {
      return false;
    }

    if (machine.status !== 'active') {
      return false;
    }

    // Проверяем состояние дохода
    const incomeState = await this.machinesService.calculateIncome(machine.id);

    // Автосбор срабатывает только при полном coin box
    return incomeState.canCollect && Number(incomeState.coinBoxCurrent) > 0;
  }

  /**
   * Выполнить автосбор для машины с зарплатой инкассатора
   * Вызывается крон-джобом для всех машин с включенным autoCollect
   * Списывает 5% от собранной суммы как зарплату инкассатора
   */
  async executeAutoCollect(
    machineId: string,
  ): Promise<AutoCollectExecutionResult> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    // Проверяем условия автосбора
    const shouldCollect = await this.shouldAutoCollect(machine);

    if (!shouldCollect) {
      return {
        machineId,
        amountCollected: 0,
        success: false,
      };
    }

    try {
      // Выполняем обычный сбор через MachinesService (isAutoCollect = true → без Fame за ручной сбор)
      const result = await this.machinesService.collectCoins(
        machineId,
        machine.userId,
        true,
      );

      const collected = Number(result.collected);

      // Списываем зарплату инкассатора (5% от сбора)
      const salary = collected * (COLLECTOR_SALARY_PERCENT / 100);

      if (salary > 0) {
        await this.prisma.$transaction(async (tx) => {
          // Списываем зарплату с баланса пользователя
          await tx.user.update({
            where: { id: machine.userId },
            data: {
              fortuneBalance: {
                decrement: salary,
              },
            },
          });

          // Создаем транзакцию зарплаты
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

      // Возвращаем чистую сумму (после вычета зарплаты)
      return {
        machineId,
        amountCollected: collected - salary,
        success: true,
      };
    } catch (error) {
      // Если сбор не удался, просто пропускаем (не кидаем ошибку)
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
   * Вызывается крон-джобом каждые несколько минут
   */
  async executeAutoCollectForAll(): Promise<AutoCollectExecutionResult[]> {
    // Получаем все активные машины с включенным Auto Collect
    const machines = await this.prisma.machine.findMany({
      where: {
        status: 'active',
        autoCollectEnabled: true,
      },
    });

    // Выполняем автосбор для каждой машины
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
