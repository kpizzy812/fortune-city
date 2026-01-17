import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminAuthController } from './admin-auth/admin-auth.controller';
import { AdminAuthService } from './admin-auth/admin-auth.service';
import { AdminDashboardController } from './admin-dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard/admin-dashboard.service';
import { AdminTiersController } from './admin-tiers/admin-tiers.controller';
import { AdminTiersService } from './admin-tiers/admin-tiers.service';
import { AdminSettingsController } from './admin-settings/admin-settings.controller';
import { AdminSettingsService } from './admin-settings/admin-settings.service';
import { AdminUsersController } from './admin-users/admin-users.controller';
import { AdminUsersService } from './admin-users/admin-users.service';
import { AdminWithdrawalsController } from './admin-withdrawals/admin-withdrawals.controller';
import { AdminWithdrawalsService } from './admin-withdrawals/admin-withdrawals.service';
import { AdminDepositsController } from './admin-deposits/admin-deposits.controller';
import { AdminDepositsService } from './admin-deposits/admin-deposits.service';
import { AdminAuditController } from './admin-audit/admin-audit.controller';
import { AdminAuditService } from './admin-audit/admin-audit.service';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { MachinesModule } from '../machines/machines.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MachinesModule,
    JwtModule.register({}), // Используем динамическую конфигурацию в сервисе
  ],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    AdminTiersController,
    AdminSettingsController,
    AdminUsersController,
    AdminWithdrawalsController,
    AdminDepositsController,
    AdminAuditController,
  ],
  providers: [
    AdminAuthService,
    AdminDashboardService,
    AdminTiersService,
    AdminSettingsService,
    AdminUsersService,
    AdminWithdrawalsService,
    AdminDepositsService,
    AdminAuditService,
    AdminJwtGuard,
  ],
  exports: [AdminAuthService, AdminJwtGuard],
})
export class AdminModule {}
