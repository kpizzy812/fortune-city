import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ReferralsService,
  ReferralStats,
  ReferralListItem,
} from './referrals.service';
import { JwtPayload } from '../auth/auth.service';

interface WithdrawDto {
  amount?: number;
}

interface SetReferrerDto {
  referralCode: string;
}

@Controller('referrals')
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  /**
   * Get referral statistics for current user
   */
  @Get('stats')
  async getStats(
    @Request() req: { user: JwtPayload },
  ): Promise<ReferralStats> {
    return this.referralsService.getReferralStats(req.user.sub);
  }

  /**
   * Get list of referrals
   */
  @Get('list')
  async getList(
    @Request() req: { user: JwtPayload },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ReferralListItem[]> {
    return this.referralsService.getReferralList(req.user.sub, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * Check if user can withdraw referral balance
   */
  @Get('can-withdraw')
  async canWithdraw(
    @Request() req: { user: JwtPayload },
  ): Promise<{ canWithdraw: boolean }> {
    const canWithdraw = await this.referralsService.canWithdrawReferralBalance(
      req.user.sub,
    );
    return { canWithdraw };
  }

  /**
   * Withdraw referral balance to fortune balance
   */
  @Post('withdraw')
  async withdraw(
    @Request() req: { user: JwtPayload },
    @Body() body: WithdrawDto,
  ): Promise<{
    success: boolean;
    newFortuneBalance: number;
    newReferralBalance: number;
  }> {
    const user = await this.referralsService.withdrawReferralBalance(
      req.user.sub,
      body.amount,
    );
    return {
      success: true,
      newFortuneBalance: Number(user.fortuneBalance),
      newReferralBalance: Number(user.referralBalance),
    };
  }

  /**
   * Set referrer for current user (one-time, during onboarding)
   */
  @Post('set-referrer')
  async setReferrer(
    @Request() req: { user: JwtPayload },
    @Body() body: SetReferrerDto,
  ): Promise<{ success: boolean }> {
    await this.referralsService.setReferrer(req.user.sub, body.referralCode);
    return { success: true };
  }
}
