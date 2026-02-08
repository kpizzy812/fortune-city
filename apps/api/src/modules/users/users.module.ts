import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
