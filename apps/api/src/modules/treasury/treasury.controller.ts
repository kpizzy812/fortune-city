import { Controller, Get } from '@nestjs/common';
import { TreasuryService } from './treasury.service';
import { VaultInfoResponseDto } from './dto';

@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  /** GET /treasury/info — public, no auth */
  @Get('info')
  async getVaultInfo(): Promise<VaultInfoResponseDto> {
    return this.treasuryService.getVaultInfo();
  }
}
