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
import { WheelService } from './wheel.service';
import {
  SpinDto,
  SpinResponseDto,
  WheelStateDto,
  SpinHistoryDto,
} from './dto/spin.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

@Controller('wheel')
export class WheelController {
  constructor(private readonly wheelService: WheelService) {}

  /**
   * Spin the wheel
   * POST /wheel/spin
   */
  @Post('spin')
  @UseGuards(JwtAuthGuard)
  async spin(
    @Request() req: AuthRequest,
    @Body() dto: SpinDto,
  ): Promise<SpinResponseDto> {
    return this.wheelService.spin(req.user.sub, dto.multiplier);
  }

  /**
   * Get current wheel state (jackpot, sectors, free spins)
   * GET /wheel/state
   */
  @Get('state')
  @UseGuards(JwtAuthGuard)
  async getState(@Request() req: AuthRequest): Promise<WheelStateDto> {
    return this.wheelService.getState(req.user.sub);
  }

  /**
   * Get spin history
   * GET /wheel/history?page=1&limit=20
   */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(
    @Request() req: AuthRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<SpinHistoryDto> {
    return this.wheelService.getHistory(
      req.user.sub,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * Get jackpot info (public)
   * GET /wheel/jackpot
   */
  @Get('jackpot')
  async getJackpot(): Promise<{
    currentPool: number;
    lastWinner: string | null;
    lastAmount: number | null;
    timesWon: number;
  }> {
    return this.wheelService.getJackpotInfo();
  }
}
