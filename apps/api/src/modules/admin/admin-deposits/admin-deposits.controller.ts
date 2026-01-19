import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminDepositsService } from './admin-deposits.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import {
  DepositsFilterDto,
  ManualCreditDto,
  RetryDepositDto,
  ApproveOtherCryptoDepositDto,
  RejectOtherCryptoDepositDto,
} from './dto/deposit.dto';

@Controller('admin/deposits')
@UseGuards(AdminJwtGuard)
export class AdminDepositsController {
  constructor(private readonly depositsService: AdminDepositsService) {}

  /**
   * GET /admin/deposits
   * Get paginated list of deposits with filters
   */
  @Get()
  async getDeposits(@Query() filters: DepositsFilterDto) {
    return this.depositsService.getDeposits(filters);
  }

  /**
   * GET /admin/deposits/stats
   * Get deposits statistics
   */
  @Get('stats')
  async getStats() {
    return this.depositsService.getStats();
  }

  /**
   * GET /admin/deposits/:id
   * Get detailed deposit information
   */
  @Get(':id')
  async getDeposit(@Param('id') id: string) {
    return this.depositsService.getDepositById(id);
  }

  /**
   * POST /admin/deposits/:id/credit
   * Manually credit a failed deposit
   */
  @Post(':id/credit')
  async manualCredit(@Param('id') id: string, @Body() dto: ManualCreditDto) {
    return this.depositsService.manualCredit(id, dto.reason);
  }

  /**
   * POST /admin/deposits/:id/retry
   * Retry a failed deposit (mark as pending)
   */
  @Post(':id/retry')
  async retryDeposit(@Param('id') id: string, @Body() dto: RetryDepositDto) {
    return this.depositsService.retryDeposit(id, dto.note);
  }

  /**
   * POST /admin/deposits/:id/approve-other-crypto
   * Approve other crypto deposit with actual amount
   */
  @Post(':id/approve-other-crypto')
  async approveOtherCrypto(
    @Param('id') id: string,
    @Body() dto: ApproveOtherCryptoDepositDto,
    @CurrentUser() admin: { username: string },
  ) {
    return this.depositsService.approveOtherCryptoDeposit(
      id,
      dto,
      admin.username,
    );
  }

  /**
   * POST /admin/deposits/:id/reject-other-crypto
   * Reject other crypto deposit with reason
   */
  @Post(':id/reject-other-crypto')
  async rejectOtherCrypto(
    @Param('id') id: string,
    @Body() dto: RejectOtherCryptoDepositDto,
    @CurrentUser() admin: { username: string },
  ) {
    return this.depositsService.rejectOtherCryptoDeposit(
      id,
      dto,
      admin.username,
    );
  }
}
