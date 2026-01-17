import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminAuthController } from './admin-auth/admin-auth.controller';
import { AdminAuthService } from './admin-auth/admin-auth.service';
import { AdminDashboardController } from './admin-dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard/admin-dashboard.service';
import { AdminTiersController } from './admin-tiers/admin-tiers.controller';
import { AdminTiersService } from './admin-tiers/admin-tiers.service';
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
  ],
  providers: [
    AdminAuthService,
    AdminDashboardService,
    AdminTiersService,
    AdminJwtGuard,
  ],
  exports: [AdminAuthService, AdminJwtGuard],
})
export class AdminModule {}
