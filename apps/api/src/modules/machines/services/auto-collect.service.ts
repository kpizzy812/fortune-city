import { Injectable, BadRequestException } from '@nestjs/common';
import { Machine, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MachinesService } from '../machines.service';
import { AUTO_COLLECT_COST_PERCENT } from '@fortune-city/shared';

export interface AutoCollectInfo {
  enabled: boolean;
  cost: number;
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
   * Получить информацию о модуле Auto Collect для машины
   */
  async getAutoCollectInfo(
    machineId: string,
    userId: string,
  ): Promise<AutoCollectInfo> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    const cost =
      Number(machine.purchasePrice) * (AUTO_COLLECT_COST_PERCENT / 100);

    return {
      enabled: machine.autoCollectEnabled,
      cost,
      purchasedAt: machine.autoCollectPurchasedAt,
      canPurchase: machine.status === 'active' && !machine.autoCollectEnabled,
      alreadyPurchased: machine.autoCollectEnabled,
    };
  }

  /**
   * Купить модуль Auto Collect для машины
   * Цена: 15% от цены покупки машины
   * Модуль сгорает вместе с машиной при окончании цикла
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
      throw new BadRequestException('Cannot purchase for expired machine');
    }

    if (machine.autoCollectEnabled) {
      throw new BadRequestException('Auto Collect already purchased');
    }

    // Вычисляем стоимость: 15% от цены покупки машины
    const cost =
      Number(machine.purchasePrice) * (AUTO_COLLECT_COST_PERCENT / 100);

    // Получаем пользователя и проверяем баланс
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (Number(user.fortuneBalance) < cost) {
      throw new BadRequestException(
        `Insufficient balance. Need ${cost} $FORTUNE, have ${Number(user.fortuneBalance)}`,
      );
    }

    // Атомарная транзакция
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Списываем стоимость с баланса
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: {
            decrement: cost,
          },
        },
      });

      // 2. Активируем Auto Collect на машине
      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          autoCollectEnabled: true,
          autoCollectPurchasedAt: new Date(),
        },
      });

      // 3. Создаем транзакцию покупки
      await tx.transaction.create({
        data: {
          userId,
          machineId,
          type: 'upgrade_purchase',
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
   * Выполнить автосбор для машины
   * Вызывается крон-джобом для всех машин с включенным autoCollect
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
      // Выполняем обычный сбор через MachinesService
      const result = await this.machinesService.collectCoins(
        machineId,
        machine.userId,
      );

      return {
        machineId,
        amountCollected: Number(result.collected),
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
