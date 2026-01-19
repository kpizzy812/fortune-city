import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import {
  UsersFilterDto,
  BanUserDto,
  UnbanUserDto,
  UpdateBalanceDto,
  AdjustBalanceDto,
  UpdateReferrerDto,
  UpdateFreeSpinsDto,
} from './dto/user.dto';

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

  /**
   * PUT /admin/users/:id/balance
   * Update user balance (set exact value)
   */
  @Put(':id/balance')
  async updateBalance(
    @Param('id') id: string,
    @Body() dto: UpdateBalanceDto,
  ) {
    return this.usersService.updateBalance(id, dto);
  }

  /**
   * POST /admin/users/:id/adjust-balance
   * Adjust user balance (add/subtract/set)
   */
  @Post(':id/adjust-balance')
  async adjustBalance(
    @Param('id') id: string,
    @Body() dto: AdjustBalanceDto,
  ) {
    return this.usersService.adjustBalance(id, dto);
  }

  /**
   * PUT /admin/users/:id/referrer
   * Update user referrer
   */
  @Put(':id/referrer')
  async updateReferrer(
    @Param('id') id: string,
    @Body() dto: UpdateReferrerDto,
  ) {
    return this.usersService.updateReferrer(id, dto);
  }

  /**
   * PUT /admin/users/:id/free-spins
   * Update user free spins
   */
  @Put(':id/free-spins')
  async updateFreeSpins(
    @Param('id') id: string,
    @Body() dto: UpdateFreeSpinsDto,
  ) {
    return this.usersService.updateFreeSpins(id, dto);
  }
}
