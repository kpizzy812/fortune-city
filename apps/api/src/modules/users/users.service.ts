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

  async createFromTelegram(
    telegramUser: TelegramUserData,
    referrerCode?: string,
  ): Promise<User> {
    const referralCode = nanoid(8);

    // Find referrer by their code (if provided)
    let referrerId: string | undefined;
    if (referrerCode) {
      const referrer = await this.prisma.user.findUnique({
        where: { referralCode: referrerCode },
        select: { id: true },
      });
      if (referrer) {
        referrerId = referrer.id;
      }
    }

    return this.prisma.user.create({
      data: {
        telegramId: String(telegramUser.id),
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        referralCode,
        referredById: referrerId,
      },
    });
  }

  async findOrCreateFromTelegram(
    telegramUser: TelegramUserData,
    referrerCode?: string,
  ): Promise<{ user: User; isNewUser: boolean }> {
    const telegramId = String(telegramUser.id);

    let user = await this.findByTelegramId(telegramId);
    let isNewUser = false;

    if (!user) {
      user = await this.createFromTelegram(telegramUser, referrerCode);
      isNewUser = true;
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

    return { user, isNewUser };
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
