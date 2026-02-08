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
import { AutoCollectService } from './services/auto-collect.service';
import { AuctionService } from './services/auction.service';
import { PawnshopService } from './services/pawnshop.service';
import { SpeedUpService } from './services/speed-up.service';
import { TierUnlockPurchaseService } from './services/tier-unlock-purchase.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.service';
import {
  CreateMachineDto,
  MachineResponseDto,
  MachineIncomeDto,
  CollectCoinsResponseDto,
  TierInfoDto,
  SellMachineEarlyResponseDto,
} from './dto/machine.dto';
import {
  RiskyCollectResponseDto,
  UpgradeFortuneGambleResponseDto,
  GambleInfoResponseDto,
} from './dto/risky-collect.dto';
import {
  AutoCollectInfoResponseDto,
  PurchaseAutoCollectResponseDto,
  PurchaseAutoCollectDto,
} from './dto/auto-collect.dto';
import { SpeedUpDto } from './dto/speed-up.dto';
import {
  AuctionInfoResponseDto,
  ListOnAuctionResponseDto,
  CancelAuctionResponseDto,
  AuctionQueueResponseDto,
  UserListingsResponseDto,
  PawnshopInfoResponseDto,
  PawnshopSaleResponseDto,
  SaleOptionsResponseDto,
} from './dto/sale.dto';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Controller('machines')
export class MachinesController {
  constructor(
    private readonly machinesService: MachinesService,
    private readonly riskyCollectService: RiskyCollectService,
    private readonly autoCollectService: AutoCollectService,
    private readonly auctionService: AuctionService,
    private readonly pawnshopService: PawnshopService,
    private readonly speedUpService: SpeedUpService,
    private readonly tierUnlockPurchaseService: TierUnlockPurchaseService,
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
      autoCollectEnabled: machine.autoCollectEnabled,
      autoCollectPurchasedAt: machine.autoCollectPurchasedAt,
      overclockMultiplier: machine.overclockMultiplier.toString(),
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
  getTierById(@Param('tier') tier: string): TierInfoDto | null {
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
    const result = await this.machinesService.collectCoins(
      id,
      req.user.sub,
      false,
    );

    return {
      collected: result.collected,
      machine: this.toResponseDto(
        this.machinesService.enrichWithTierInfo(result.machine),
      ),
      fameEarned: result.fameEarned,
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

  // ===== Early Sell Endpoint =====

  @UseGuards(JwtAuthGuard)
  @Post(':id/sell-early')
  async sellMachineEarly(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<SellMachineEarlyResponseDto> {
    const result = await this.machinesService.sellMachineEarly(
      id,
      req.user.sub,
    );

    return {
      machine: this.toResponseDto(
        this.machinesService.enrichWithTierInfo(result.machine),
      ),
      profitReturned: result.profitReturned,
      principalReturned: result.principalReturned,
      totalReturned: result.totalReturned,
      commission: result.commission,
      commissionRate: result.commissionRate,
      newBalance: result.newBalance,
    };
  }

  // ===== Collector (Auto Collect) Endpoints =====

  @UseGuards(JwtAuthGuard)
  @Get(':id/auto-collect-info')
  async getAutoCollectInfo(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AutoCollectInfoResponseDto> {
    return this.autoCollectService.getAutoCollectInfo(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/purchase-auto-collect')
  async purchaseAutoCollect(
    @Param('id') id: string,
    @Body() dto: PurchaseAutoCollectDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<PurchaseAutoCollectResponseDto> {
    const result = await this.autoCollectService.purchaseAutoCollect(
      id,
      req.user.sub,
      dto.paymentMethod,
    );

    return {
      machine: this.toResponseDto(
        this.machinesService.enrichWithTierInfo(result.machine),
      ),
      cost: result.cost,
      paymentMethod: result.paymentMethod,
      user: {
        fortuneBalance: result.user.fortuneBalance.toString(),
      },
      newBalance: result.newBalance,
    };
  }

  // ===== Speed Up Endpoints =====

  @UseGuards(JwtAuthGuard)
  @Get(':id/speed-up-info')
  async getSpeedUpInfo(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.speedUpService.getSpeedUpInfo(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/speed-up')
  async speedUp(
    @Param('id') id: string,
    @Body() dto: SpeedUpDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.speedUpService.speedUp(
      id,
      req.user.sub,
      dto.days,
      dto.paymentMethod,
    );

    return {
      machine: this.toResponseDto(
        this.machinesService.enrichWithTierInfo(result.machine),
      ),
      days: result.days,
      cost: result.cost,
      paymentMethod: result.paymentMethod,
      newExpiresAt: result.newExpiresAt,
      user: {
        fortuneBalance: result.user.fortuneBalance.toString(),
      },
    };
  }

  // ===== Tier Unlock Purchase Endpoints =====

  @UseGuards(JwtAuthGuard)
  @Get('tier-unlock/:tier')
  async getTierUnlockInfo(
    @Param('tier') tier: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tierUnlockPurchaseService.getUnlockInfo(
      req.user.sub,
      parseInt(tier, 10),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('tier-unlock/:tier')
  async purchaseTierUnlock(
    @Param('tier') tier: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.tierUnlockPurchaseService.purchaseUnlock(
      req.user.sub,
      parseInt(tier, 10),
    );

    return {
      tier: result.tier,
      fee: result.fee,
      maxTierUnlocked: result.maxTierUnlocked,
      user: {
        fortuneBalance: result.user.fortuneBalance.toString(),
        maxTierUnlocked: result.user.maxTierUnlocked,
      },
    };
  }

  // ===== Auction Endpoints =====

  @Get('auction/queue')
  async getAuctionQueue(): Promise<AuctionQueueResponseDto[]> {
    return this.auctionService.getAuctionQueueByTier();
  }

  @UseGuards(JwtAuthGuard)
  @Get('auction/my-listings')
  async getMyListings(
    @Req() req: AuthenticatedRequest,
  ): Promise<UserListingsResponseDto> {
    const listingsWithPosition =
      await this.auctionService.getUserListingsWithPosition(req.user.sub);

    return { listings: listingsWithPosition };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/auction-info')
  async getAuctionInfo(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AuctionInfoResponseDto> {
    return this.auctionService.getAuctionInfo(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/list-auction')
  async listOnAuction(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ListOnAuctionResponseDto> {
    const result = await this.auctionService.listOnAuction(id, req.user.sub);

    return {
      listing: {
        id: result.listing.id,
        machineId: result.listing.machineId,
        tier: result.listing.tier,
        wearPercent: result.wearPercent,
        commissionRate: result.commissionRate,
        expectedPayout: result.expectedPayout,
        status: result.listing.status,
        createdAt: result.listing.createdAt,
      },
      machine: this.toResponseDto(
        this.machinesService.enrichWithTierInfo(result.machine),
      ),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel-auction')
  async cancelAuction(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<CancelAuctionResponseDto> {
    const result = await this.auctionService.cancelAuctionListing(
      id,
      req.user.sub,
    );

    return {
      listing: {
        id: result.listing.id,
        machineId: result.listing.machineId,
        status: result.listing.status,
      },
      machine: this.toResponseDto(
        this.machinesService.enrichWithTierInfo(result.machine),
      ),
    };
  }

  // ===== Pawnshop Endpoints =====

  @UseGuards(JwtAuthGuard)
  @Get(':id/pawnshop-info')
  async getPawnshopInfo(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<PawnshopInfoResponseDto> {
    return this.pawnshopService.getPawnshopInfo(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/sell-pawnshop')
  async sellToPawnshop(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<PawnshopSaleResponseDto> {
    const result = await this.pawnshopService.sellToPawnshop(id, req.user.sub);

    return {
      machine: this.toResponseDto(
        this.machinesService.enrichWithTierInfo(result.machine),
      ),
      tierPrice: result.tierPrice,
      collectedProfit: result.collectedProfit,
      commissionRate: result.commissionRate,
      commissionAmount: result.commissionAmount,
      payout: result.payout,
      totalOnHand: result.totalOnHand,
      user: {
        fortuneBalance: result.user.fortuneBalance.toString(),
      },
    };
  }

  // ===== Combined Sale Options =====

  @UseGuards(JwtAuthGuard)
  @Get(':id/sale-options')
  async getSaleOptions(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<SaleOptionsResponseDto> {
    const [auctionInfo, pawnshopInfo] = await Promise.all([
      this.auctionService.getAuctionInfo(id, req.user.sub),
      this.pawnshopService.getPawnshopInfo(id, req.user.sub),
    ]);

    // Determine recommendation with reason code for frontend i18n
    let recommendation: 'auction' | 'pawnshop' | 'wait';
    let recommendationReasonCode: string;
    let recommendationReasonParams: Record<string, string | number> = {};

    if (!pawnshopInfo.canSell && !auctionInfo.canList) {
      recommendation = 'wait';
      recommendationReasonCode = 'notAvailable';
    } else if (!pawnshopInfo.canSell) {
      recommendation = 'auction';
      recommendationReasonCode = 'pawnshopUnavailable';
    } else if (auctionInfo.queueLength === 0) {
      recommendation = 'auction';
      recommendationReasonCode = 'noQueue';
    } else if (auctionInfo.expectedPayout > pawnshopInfo.expectedPayout * 1.2) {
      recommendation = 'auction';
      recommendationReasonCode = 'auctionPaysMore';
      recommendationReasonParams = {
        percent: Math.round(
          (auctionInfo.expectedPayout / pawnshopInfo.expectedPayout - 1) * 100,
        ),
      };
    } else {
      recommendation = 'pawnshop';
      recommendationReasonCode = 'pawnshopInstant';
    }

    return {
      auction: auctionInfo,
      pawnshop: pawnshopInfo,
      recommendation,
      recommendationReasonCode,
      recommendationReasonParams,
    };
  }
}
