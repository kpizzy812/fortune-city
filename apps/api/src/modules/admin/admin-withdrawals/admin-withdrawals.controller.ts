import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminWithdrawalsService } from './admin-withdrawals.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import {
  WithdrawalsFilterDto,
  ApproveWithdrawalDto,
  RejectWithdrawalDto,
  ProcessWithdrawalDto,
} from './dto/withdrawal.dto';

@Controller('admin/withdrawals')
@UseGuards(AdminJwtGuard)
export class AdminWithdrawalsController {
  constructor(private readonly withdrawalsService: AdminWithdrawalsService) {}

  /**
   * GET /admin/withdrawals
   * Get paginated list of withdrawals with filters
   */
  @Get()
  async getWithdrawals(@Query() filters: WithdrawalsFilterDto) {
    return this.withdrawalsService.getWithdrawals(filters);
  }

  /**
   * GET /admin/withdrawals/stats
   * Get withdrawals statistics
   */
  @Get('stats')
  async getStats() {
    return this.withdrawalsService.getStats();
  }

  /**
   * GET /admin/withdrawals/:id
   * Get detailed withdrawal information
   */
  @Get(':id')
  async getWithdrawal(@Param('id') id: string) {
    return this.withdrawalsService.getWithdrawalById(id);
  }

  /**
   * POST /admin/withdrawals/:id/approve
   * Approve a pending withdrawal (move to processing)
   */
  @Post(':id/approve')
  async approveWithdrawal(
    @Param('id') id: string,
    @Body() dto: ApproveWithdrawalDto,
  ) {
    return this.withdrawalsService.approveWithdrawal(id, dto.note);
  }

  /**
   * POST /admin/withdrawals/:id/complete
   * Mark withdrawal as completed with tx signature
   */
  @Post(':id/complete')
  async completeWithdrawal(
    @Param('id') id: string,
    @Body() dto: ProcessWithdrawalDto,
  ) {
    return this.withdrawalsService.completeWithdrawal(
      id,
      dto.txSignature,
      dto.note,
    );
  }

  /**
   * POST /admin/withdrawals/:id/reject
   * Reject a withdrawal and refund balance
   */
  @Post(':id/reject')
  async rejectWithdrawal(
    @Param('id') id: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    return this.withdrawalsService.rejectWithdrawal(id, dto.reason);
  }
}
