import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { nanoid } from 'nanoid';

export interface TelegramUserData {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { telegramId },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async createFromTelegram(telegramUser: TelegramUserData): Promise<User> {
    const referralCode = nanoid(8);

    return this.prisma.user.create({
      data: {
        telegramId: String(telegramUser.id),
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        referralCode,
      },
    });
  }

  async findOrCreateFromTelegram(telegramUser: TelegramUserData): Promise<User> {
    const telegramId = String(telegramUser.id);

    let user = await this.findByTelegramId(telegramId);

    if (!user) {
      user = await this.createFromTelegram(telegramUser);
    } else {
      // Update user info if changed
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          username: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
        },
      });
    }

    return user;
  }

  async updateMaxTier(userId: string, tier: number): Promise<User> {
    const user = await this.findById(userId);

    if (!user || tier <= user.maxTierReached) {
      return user!;
    }

    // Update tax rate based on new tier
    const taxRates: Record<number, number> = {
      1: 0.5,
      2: 0.45,
      3: 0.4,
      4: 0.35,
      5: 0.3,
      6: 0.25,
      7: 0.2,
      8: 0.15,
      9: 0.12,
      10: 0.1,
    };

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        maxTierReached: tier,
        currentTaxRate: taxRates[tier] ?? 0.5,
      },
    });
  }
}
