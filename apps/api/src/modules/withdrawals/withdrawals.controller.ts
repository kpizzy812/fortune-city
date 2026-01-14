import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { WithdrawalsService } from './withdrawals.service';
import {
  CreateWithdrawalDto,
  PrepareAtomicWithdrawalDto,
  ConfirmAtomicWithdrawalDto,
  WithdrawalMethodDto,
  WithdrawalPreviewResponse,
  PreparedAtomicWithdrawalResponse,
  WithdrawalResponse,
  InstantWithdrawalResponse,
} from './dto';

@Controller('withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  /**
   * GET /withdrawals/preview?amount=100
   * Preview withdrawal with tax calculation
   */
  @Get('preview')
  async previewWithdrawal(
    @CurrentUser() user: JwtPayload,
    @Query('amount', new DefaultValuePipe(0), ParseIntPipe) amount: number,
  ): Promise<WithdrawalPreviewResponse> {
    return this.withdrawalsService.previewWithdrawal(user.sub, amount);
  }

  /**
   * POST /withdrawals/prepare-atomic
   * Prepare atomic withdrawal transaction for wallet_connect method.
   * Returns partially signed transaction for user to sign.
   */
  @Post('prepare-atomic')
  async prepareAtomicWithdrawal(
    @CurrentUser() user: JwtPayload,
    @Body() dto: PrepareAtomicWithdrawalDto & { walletAddress: string },
  ): Promise<PreparedAtomicWithdrawalResponse> {
    return this.withdrawalsService.prepareAtomicWithdrawal(
      user.sub,
      dto.amount,
      dto.walletAddress,
    );
  }

  /**
   * POST /withdrawals/confirm-atomic
   * Confirm atomic withdrawal after user signs and sends transaction.
   */
  @Post('confirm-atomic')
  async confirmAtomicWithdrawal(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ConfirmAtomicWithdrawalDto,
  ): Promise<WithdrawalResponse> {
    return this.withdrawalsService.confirmAtomicWithdrawal(
      user.sub,
      dto.withdrawalId,
      dto.txSignature,
    );
  }

  /**
   * POST /withdrawals/cancel/:id
   * Cancel pending atomic withdrawal.
   */
  @Post('cancel/:id')
  async cancelAtomicWithdrawal(
    @CurrentUser() user: JwtPayload,
    @Param('id') withdrawalId: string,
  ): Promise<WithdrawalResponse> {
    return this.withdrawalsService.cancelAtomicWithdrawal(
      user.sub,
      withdrawalId,
    );
  }

  /**
   * POST /withdrawals/instant
   * Create instant withdrawal to specified address.
   * Hot wallet sends USDT directly.
   */
  @Post('instant')
  async createInstantWithdrawal(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateWithdrawalDto,
  ): Promise<InstantWithdrawalResponse> {
    return this.withdrawalsService.createInstantWithdrawal(user.sub, {
      ...dto,
      method: WithdrawalMethodDto.MANUAL_ADDRESS,
    });
  }

  /**
   * GET /withdrawals
   * Get user's withdrawal history
   */
  @Get()
  async getWithdrawals(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<WithdrawalResponse[]> {
    return this.withdrawalsService.getUserWithdrawals(user.sub, limit, offset);
  }

  /**
   * GET /withdrawals/:id
   * Get single withdrawal by ID
   */
  @Get(':id')
  async getWithdrawalById(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<WithdrawalResponse> {
    return this.withdrawalsService.getWithdrawalById(user.sub, id);
  }
}
