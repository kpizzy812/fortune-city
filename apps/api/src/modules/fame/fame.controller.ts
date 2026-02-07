import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FameService } from './fame.service';
import {
  UnlockTierDto,
  FameBalanceResponse,
  FameHistoryResponse,
  DailyLoginResponse,
  UnlockTierResponse,
} from './dto/fame.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

@Controller('fame')
export class FameController {
  constructor(private readonly fameService: FameService) {}

  /**
   * GET /fame/balance
   */
  @Get('balance')
  @UseGuards(JwtAuthGuard)
  async getBalance(@Request() req: AuthRequest): Promise<FameBalanceResponse> {
    return this.fameService.getBalance(req.user.sub);
  }

  /**
   * GET /fame/history?page=1&limit=20
   */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(
    @Request() req: AuthRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<FameHistoryResponse> {
    return this.fameService.getHistory(
      req.user.sub,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * POST /fame/daily-login
   */
  @Post('daily-login')
  @UseGuards(JwtAuthGuard)
  async claimDailyLogin(
    @Request() req: AuthRequest,
  ): Promise<DailyLoginResponse> {
    return this.fameService.claimDailyLogin(req.user.sub);
  }

  /**
   * POST /fame/unlock-tier
   */
  @Post('unlock-tier')
  @UseGuards(JwtAuthGuard)
  async unlockTier(
    @Request() req: AuthRequest,
    @Body() dto: UnlockTierDto,
  ): Promise<UnlockTierResponse> {
    return this.fameService.unlockTier(req.user.sub, dto.tier);
  }
}
