import { Controller, Get, Param } from '@nestjs/common';
import { TreasuryService } from './treasury.service';
import type {
  VaultInfoResponseDto,
  ClaimInfoResponseDto,
  WithdrawalRequestResponseDto,
} from './dto';

@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  /** GET /treasury/info — public, no auth */
  @Get('info')
  async getVaultInfo(): Promise<VaultInfoResponseDto> {
    return this.treasuryService.getVaultInfo();
  }

  /** GET /treasury/claim-info — public, returns addresses for building claim tx */
  @Get('claim-info')
  getClaimInfo(): ClaimInfoResponseDto {
    return this.treasuryService.getClaimInfo();
  }

  /** GET /treasury/withdrawal-request/:userPubkey — public, check active PDA */
  @Get('withdrawal-request/:userPubkey')
  async getWithdrawalRequest(
    @Param('userPubkey') userPubkey: string,
  ): Promise<WithdrawalRequestResponseDto | null> {
    return this.treasuryService.getWithdrawalRequest(userPubkey);
  }
}
