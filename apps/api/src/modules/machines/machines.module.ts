import { Module, forwardRef } from '@nestjs/common';
import { MachinesController } from './machines.controller';
import { MachinesService } from './machines.service';
import { TierCacheService } from './services/tier-cache.service';
import { RiskyCollectService } from './services/risky-collect.service';
import { AutoCollectService } from './services/auto-collect.service';
import { AuctionService } from './services/auction.service';
import { PawnshopService } from './services/pawnshop.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EconomyModule } from '../economy/economy.module';
import { FameModule } from '../fame/fame.module';

@Module({
  imports: [PrismaModule, AuthModule, forwardRef(() => EconomyModule), FameModule],
  controllers: [MachinesController],
  providers: [
    TierCacheService,
    MachinesService,
    RiskyCollectService,
    AutoCollectService,
    AuctionService,
    PawnshopService,
  ],
  exports: [
    TierCacheService,
    MachinesService,
    RiskyCollectService,
    AutoCollectService,
    AuctionService,
    PawnshopService,
  ],
})
export class MachinesModule {}
