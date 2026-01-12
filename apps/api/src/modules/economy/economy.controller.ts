import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.service';
import { PurchaseService } from './services/purchase.service';
import { TransactionsService } from './services/transactions.service';
import { MachinesService } from '../machines/machines.service';
import {
  PurchaseMachineDto,
  PurchaseMachineResponseDto,
  CanAffordResponseDto,
  TransactionResponseDto,
  TransactionStatsDto,
} from './dto/purchase.dto';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Controller('economy')
@UseGuards(JwtAuthGuard)
export class EconomyController {
  constructor(
    private readonly purchaseService: PurchaseService,
    private readonly transactionsService: TransactionsService,
    private readonly machinesService: MachinesService,
  ) {}

  @Post('purchase')
  async purchaseMachine(
    @Body() dto: PurchaseMachineDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<PurchaseMachineResponseDto> {
    const result = await this.purchaseService.purchaseMachine(
      req.user.sub,
      dto,
    );
    const tierInfo = this.machinesService.enrichWithTierInfo(result.machine);

    return {
      machine: {
        id: result.machine.id,
        tier: result.machine.tier,
        purchasePrice: result.machine.purchasePrice.toString(),
        totalYield: result.machine.totalYield.toString(),
        profitAmount: result.machine.profitAmount.toString(),
        lifespanDays: result.machine.lifespanDays,
        startedAt: result.machine.startedAt,
        expiresAt: result.machine.expiresAt,
        status: result.machine.status,
        tierInfo: tierInfo.tierInfo,
      },
      transaction: {
        id: result.transaction.id,
        type: result.transaction.type,
        amount: result.transaction.amount.toString(),
        status: result.transaction.status,
        createdAt: result.transaction.createdAt,
      },
      user: {
        id: result.user.id,
        fortuneBalance: result.user.fortuneBalance.toString(),
        maxTierReached: result.user.maxTierReached,
        maxTierUnlocked: result.user.maxTierUnlocked,
        currentTaxRate: result.user.currentTaxRate.toString(),
      },
    };
  }

  @Get('can-afford/:tier')
  async canAffordTier(
    @Param('tier', ParseIntPipe) tier: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<CanAffordResponseDto> {
    return this.purchaseService.canAffordTier(req.user.sub, tier);
  }

  @Get('transactions')
  async getTransactions(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<TransactionResponseDto[]> {
    const transactions = await this.transactionsService.findByUserId(
      req.user.sub,
      {
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      },
    );

    return transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount.toString(),
      currency: tx.currency,
      taxAmount: tx.taxAmount.toString(),
      taxRate: tx.taxRate.toString(),
      netAmount: tx.netAmount.toString(),
      status: tx.status,
      createdAt: tx.createdAt,
      machineId: tx.machineId ?? undefined,
    }));
  }

  @Get('transactions/stats')
  async getTransactionStats(
    @Req() req: AuthenticatedRequest,
  ): Promise<TransactionStatsDto> {
    return this.transactionsService.getUserTransactionStats(req.user.sub);
  }

  @Get('purchase-history')
  async getPurchaseHistory(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<TransactionResponseDto[]> {
    const transactions = await this.purchaseService.getPurchaseHistory(
      req.user.sub,
      {
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      },
    );

    return transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount.toString(),
      currency: tx.currency,
      taxAmount: tx.taxAmount.toString(),
      taxRate: tx.taxRate.toString(),
      netAmount: tx.netAmount.toString(),
      status: tx.status,
      createdAt: tx.createdAt,
      machineId: tx.machineId ?? undefined,
    }));
  }
}
