import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ReferralsService,
  ReferralStats,
  ReferralListItem,
} from './referrals.service';
import {
  ReferralMilestonesService,
  MilestoneProgress,
} from './referral-milestones.service';
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
  constructor(
    private readonly referralsService: ReferralsService,
    private readonly milestonesService: ReferralMilestonesService,
  ) {}

  /**
   * Get referral statistics for current user
   */
  @Get('stats')
  async getStats(@Request() req: { user: JwtPayload }): Promise<ReferralStats> {
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
   * Get milestone progress
   */
  @Get('milestones')
  async getMilestones(
    @Request() req: { user: JwtPayload },
  ): Promise<MilestoneProgress> {
    return this.milestonesService.getMilestoneProgress(req.user.sub);
  }

  /**
   * Claim a milestone reward
   */
  @Post('milestones/:milestoneId/claim')
  async claimMilestone(
    @Request() req: { user: JwtPayload },
    @Param('milestoneId') milestoneId: string,
  ): Promise<{ success: boolean; reward: string }> {
    try {
      return await this.milestonesService.claimMilestone(
        req.user.sub,
        milestoneId,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to claim milestone',
      );
    }
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
