import { Module, forwardRef } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { ReferralMilestonesService } from './referral-milestones.service';
import { ReferralsController } from './referrals.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MachinesModule } from '../machines/machines.module';

@Module({
  imports: [PrismaModule, AuthModule, forwardRef(() => MachinesModule)],
  controllers: [ReferralsController],
  providers: [ReferralsService, ReferralMilestonesService],
  exports: [ReferralsService, ReferralMilestonesService],
})
export class ReferralsModule {}
