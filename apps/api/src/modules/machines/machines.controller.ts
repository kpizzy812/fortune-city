import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';
import { MachinesService, MachineWithTierInfo } from './machines.service';
import { RiskyCollectService } from './services/risky-collect.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.service';
import {
  CreateMachineDto,
  MachineResponseDto,
  MachineIncomeDto,
  CollectCoinsResponseDto,
  TierInfoDto,
} from './dto/machine.dto';
import {
  RiskyCollectResponseDto,
  UpgradeFortuneGambleResponseDto,
  GambleInfoResponseDto,
} from './dto/risky-collect.dto';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Controller('machines')
export class MachinesController {
  constructor(
    private readonly machinesService: MachinesService,
    private readonly riskyCollectService: RiskyCollectService,
  ) {}

  private toResponseDto(machine: MachineWithTierInfo): MachineResponseDto {
    return {
      id: machine.id,
      userId: machine.userId,
      tier: machine.tier,
      purchasePrice: machine.purchasePrice.toString(),
      totalYield: machine.totalYield.toString(),
      profitAmount: machine.profitAmount.toString(),
      lifespanDays: machine.lifespanDays,
      startedAt: machine.startedAt,
      expiresAt: machine.expiresAt,
      ratePerSecond: machine.ratePerSecond.toString(),
      accumulatedIncome: machine.accumulatedIncome.toString(),
      coinBoxLevel: machine.coinBoxLevel,
      coinBoxCapacity: machine.coinBoxCapacity.toString(),
      coinBoxCurrent: machine.coinBoxCurrent.toString(),
      reinvestRound: machine.reinvestRound,
      profitReductionRate: machine.profitReductionRate.toString(),
      status: machine.status,
      createdAt: machine.createdAt,
      tierInfo: machine.tierInfo,
    };
  }

  @Get('tiers')
  getTiers(): TierInfoDto[] {
    return this.machinesService.getTiers();
  }

  @Get('tiers/:tier')
  getTierById(@Param('tier') tier: string): TierInfoDto | undefined {
    return this.machinesService.getTierById(parseInt(tier, 10));
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserMachines(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: 'active' | 'expired' | 'sold_early',
  ): Promise<MachineResponseDto[]> {
    const machines = await this.machinesService.findByUserId(
      req.user.sub,
      status,
    );
    return machines.map((m) =>
      this.toResponseDto(this.machinesService.enrichWithTierInfo(m)),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('active')
  async getActiveMachines(
    @Req() req: AuthenticatedRequest,
  ): Promise<MachineResponseDto[]> {
    const machines = await this.machinesService.getActiveMachines(req.user.sub);
    return machines.map((m) =>
      this.toResponseDto(this.machinesService.enrichWithTierInfo(m)),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getMachineById(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<MachineResponseDto> {
    const machine = await this.machinesService.findByIdOrThrow(id);

    // Ensure user owns this machine
    if (machine.userId !== req.user.sub) {
      throw new Error('Machine does not belong to user');
    }

    return this.toResponseDto(this.machinesService.enrichWithTierInfo(machine));
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/income')
  async getMachineIncome(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<MachineIncomeDto> {
    const machine = await this.machinesService.findByIdOrThrow(id);

    if (machine.userId !== req.user.sub) {
      throw new Error('Machine does not belong to user');
    }

    const income = await this.machinesService.calculateIncome(id);

    return {
      machineId: id,
      ...income,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createMachine(
    @Body() createMachineDto: CreateMachineDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<MachineResponseDto> {
    // Note: В реальной реализации здесь должна быть проверка баланса
    // и списание средств, но это будет в отдельном модуле покупки
    const machine = await this.machinesService.create(
      req.user.sub,
      createMachineDto,
    );

    return this.toResponseDto(this.machinesService.enrichWithTierInfo(machine));
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/collect')
  async collectCoins(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<CollectCoinsResponseDto> {
    const result = await this.machinesService.collectCoins(id, req.user.sub);

    return {
      collected: result.collected,
      machine: this.toResponseDto(
        this.machinesService.enrichWithTierInfo(result.machine),
      ),
    };
  }

  // ===== Fortune's Gamble (Risky Collect) Endpoints =====

  @UseGuards(JwtAuthGuard)
  @Post(':id/collect-risky')
  async collectRisky(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<RiskyCollectResponseDto> {
    const result = await this.riskyCollectService.riskyCollect(
      id,
      req.user.sub,
    );

    return {
      won: result.won,
      originalAmount: result.originalAmount,
      finalAmount: result.finalAmount,
      winChance: result.winChance,
      multiplier: result.multiplier,
      machine: this.toResponseDto(
        this.machinesService.enrichWithTierInfo(result.machine),
      ),
      newBalance: result.newBalance,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/upgrade-gamble')
  async upgradeFortuneGamble(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<UpgradeFortuneGambleResponseDto> {
    const result = await this.riskyCollectService.upgradeFortuneGamble(
      id,
      req.user.sub,
    );

    return {
      machine: this.toResponseDto(
        this.machinesService.enrichWithTierInfo(result.machine),
      ),
      cost: result.cost,
      newLevel: result.newLevel,
      newWinChance: result.newWinChance,
      user: {
        fortuneBalance: result.user.fortuneBalance.toString(),
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/gamble-info')
  async getGambleInfo(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<GambleInfoResponseDto> {
    return this.riskyCollectService.getGambleInfo(id, req.user.sub);
  }
}
