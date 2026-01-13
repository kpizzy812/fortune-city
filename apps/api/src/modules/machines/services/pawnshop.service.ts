import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Machine, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MachinesService } from '../machines.service';
import { FundSourceService } from '../../economy/services/fund-source.service';
import {
  calculatePawnshopPayout,
  PAWNSHOP_COMMISSION_RATE,
  getTierConfigOrThrow,
} from '@fortune-city/shared';

export interface PawnshopSaleResult {
  machine: Machine;
  user: User;
  tierPrice: number;
  collectedProfit: number;
  commissionRate: number;
  commissionAmount: number;
  payout: number;
  totalOnHand: number; // collected + payout = P * 0.9
}

export interface PawnshopInfo {
  canSell: boolean;
  reason?: string;
  tierPrice: number;
  collectedProfit: number;
  coinBoxCurrent: number;
  commissionRate: number;
  commissionAmount: number;
  expectedPayout: number;
  totalOnHand: number; // What player will have after sale
}

@Injectable()
export class PawnshopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly machinesService: MachinesService,
    @Inject(forwardRef(() => FundSourceService))
    private readonly fundSourceService: FundSourceService,
  ) {}

  /**
   * Sell machine to pawnshop (instant sale to system)
   *
   * Formula: Payout = P × 0.9 - collected_profit
   * Result: Player always exits with -10% of investment
   *
   * Available only before BE (when payout > 0)
   */
  async sellToPawnshop(
    machineId: string,
    userId: string,
  ): Promise<PawnshopSaleResult> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    if (machine.status !== 'active') {
      throw new BadRequestException(
        'Only active machines can be sold to pawnshop',
      );
    }

    // Calculate income state
    const incomeState = await this.machinesService.calculateIncome(machineId);

    const tierConfig = getTierConfigOrThrow(machine.tier);
    const tierPrice = tierConfig.price;

    // Total collected profit = already paid out + current in coin box (profit portion)
    const collectedProfit =
      Number(machine.profitPaidOut) + incomeState.currentProfit;

    // Calculate pawnshop payout
    const { payout, isAvailable } = calculatePawnshopPayout(
      tierPrice,
      collectedProfit,
    );

    if (!isAvailable) {
      throw new BadRequestException(
        'Pawnshop is not available after breakeven. Use auction instead.',
      );
    }

    const commissionAmount = tierPrice * PAWNSHOP_COMMISSION_RATE;

    // Total that player will have after sale:
    // collected profit (kept) + coin box current (collected) + payout
    const coinBoxCurrent = Number(incomeState.coinBoxCurrent);
    const totalOnHand = collectedProfit + coinBoxCurrent + payout;

    // Atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update machine status
      const updatedMachine = await tx.machine.update({
        where: { id: machineId },
        data: {
          status: 'sold_pawnshop',
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

      // 2. Pay user: payout + whatever is in coin box
      const payoutWithCoinBox = payout + coinBoxCurrent;
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: {
            increment: payoutWithCoinBox,
          },
        },
      });

      // 3. Track profit from coin box collection
      if (incomeState.currentProfit > 0) {
        await this.fundSourceService.recordProfitCollection(
          userId,
          incomeState.currentProfit,
          tx,
        );
      }

      // 4. Propagate fund source from pawnshop payout (principal return) back to balance trackers
      // Note: payout is the principal portion returned (tierPrice * 0.9 - collected_profit)
      // This maintains correct fresh/profit ratio for tax calculation on withdrawal
      if (payout > 0) {
        await this.fundSourceService.propagateMachineFundSourceToBalance(
          userId,
          machineId,
          payout,
          tx,
        );
      }

      // 5. Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          machineId,
          type: 'machine_pawnshop_sale',
          amount: tierPrice,
          currency: 'FORTUNE',
          taxAmount: tierPrice - payout, // Commission + forfeited profit
          taxRate: PAWNSHOP_COMMISSION_RATE,
          netAmount: payoutWithCoinBox,
          status: 'completed',
        },
      });

      return { machine: updatedMachine, user: updatedUser };
    });

    return {
      machine: result.machine,
      user: result.user,
      tierPrice,
      collectedProfit,
      commissionRate: PAWNSHOP_COMMISSION_RATE,
      commissionAmount,
      payout,
      totalOnHand,
    };
  }

  /**
   * Get pawnshop info for a machine
   */
  async getPawnshopInfo(
    machineId: string,
    userId: string,
  ): Promise<PawnshopInfo> {
    const machine = await this.machinesService.findByIdOrThrow(machineId);

    if (machine.userId !== userId) {
      throw new BadRequestException('Machine does not belong to user');
    }

    const tierConfig = getTierConfigOrThrow(machine.tier);
    const tierPrice = tierConfig.price;

    // Calculate income state
    const incomeState = await this.machinesService.calculateIncome(machineId);

    // Total collected profit = already paid out + current in coin box (profit portion)
    const collectedProfit =
      Number(machine.profitPaidOut) + incomeState.currentProfit;
    const coinBoxCurrent = Number(incomeState.coinBoxCurrent);

    // Calculate pawnshop payout
    const { payout, isAvailable } = calculatePawnshopPayout(
      tierPrice,
      collectedProfit,
    );

    const commissionAmount = tierPrice * PAWNSHOP_COMMISSION_RATE;

    // Total that player will have after sale
    const totalOnHand = collectedProfit + coinBoxCurrent + payout;

    // Determine if can sell
    let canSell = true;
    let reason: string | undefined;

    if (machine.status !== 'active') {
      canSell = false;
      reason = 'Only active machines can be sold to pawnshop';
    } else if (!isAvailable) {
      canSell = false;
      reason =
        'Pawnshop is not available after breakeven. Use auction instead.';
    }

    return {
      canSell,
      reason,
      tierPrice,
      collectedProfit,
      coinBoxCurrent,
      commissionRate: PAWNSHOP_COMMISSION_RATE,
      commissionAmount,
      expectedPayout: payout,
      totalOnHand,
    };
  }
}
