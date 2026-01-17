import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { UsersFilterDto, BanUserDto, UnbanUserDto } from './dto/user.dto';

@Controller('admin/users')
@UseGuards(AdminJwtGuard)
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  /**
   * GET /admin/users
   * Get paginated list of users with filters
   */
  @Get()
  async getUsers(@Query() filters: UsersFilterDto) {
    return this.usersService.getUsers(filters);
  }

  /**
   * GET /admin/users/stats
   * Get users statistics
   */
  @Get('stats')
  async getStats() {
    return this.usersService.getStats();
  }

  /**
   * GET /admin/users/:id
   * Get detailed user information
   */
  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  /**
   * GET /admin/users/:id/referral-tree
   * Get user's referral tree (3 levels)
   */
  @Get(':id/referral-tree')
  async getReferralTree(@Param('id') id: string) {
    return this.usersService.getReferralTree(id);
  }

  /**
   * POST /admin/users/:id/ban
   * Ban a user
   */
  @Post(':id/ban')
  async banUser(@Param('id') id: string, @Body() dto: BanUserDto) {
    return this.usersService.banUser(id, dto.reason);
  }

  /**
   * POST /admin/users/:id/unban
   * Unban a user
   */
  @Post(':id/unban')
  async unbanUser(@Param('id') id: string, @Body() dto: UnbanUserDto) {
    return this.usersService.unbanUser(id, dto.note);
  }
}
