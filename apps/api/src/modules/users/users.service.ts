import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { User } from '@prisma/client';
import { nanoid } from 'nanoid';

export interface TelegramUserData {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}

export interface EmailUserData {
  supabaseId: string;
  email: string;
  emailVerified: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

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
    const isOG = await this.settingsService.isPrelaunch();

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
        avatarUrl: telegramUser.photo_url,
        referralCode,
        referredById: referrerId,
        isOG,
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
          avatarUrl: telegramUser.photo_url,
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

  // ============ Email Auth Methods ============

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findBySupabaseId(supabaseId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { supabaseId },
    });
  }

  async createFromEmail(
    emailUser: EmailUserData,
    referrerCode?: string,
  ): Promise<User> {
    const referralCode = nanoid(8);
    const isOG = await this.settingsService.isPrelaunch();

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
        supabaseId: emailUser.supabaseId,
        email: emailUser.email,
        emailVerifiedAt: emailUser.emailVerified ? new Date() : null,
        referralCode,
        referredById: referrerId,
        isOG,
      },
    });
  }

  async findOrCreateFromEmail(
    emailUser: EmailUserData,
    referrerCode?: string,
  ): Promise<{ user: User; isNewUser: boolean }> {
    // Сначала ищем по supabaseId
    let user = await this.findBySupabaseId(emailUser.supabaseId);
    let isNewUser = false;

    if (!user) {
      // Проверяем, не привязан ли email к существующему аккаунту
      user = await this.findByEmail(emailUser.email);

      if (user) {
        // Email уже есть, обновляем supabaseId (связывание аккаунта)
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            supabaseId: emailUser.supabaseId,
            emailVerifiedAt: emailUser.emailVerified
              ? new Date()
              : user.emailVerifiedAt,
          },
        });
      } else {
        // Создаем нового пользователя
        user = await this.createFromEmail(emailUser, referrerCode);
        isNewUser = true;
      }
    } else {
      // Обновляем emailVerifiedAt если нужно
      if (emailUser.emailVerified && !user.emailVerifiedAt) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        });
      }
    }

    return { user, isNewUser };
  }

  /**
   * Привязывает Telegram аккаунт к существующему пользователю
   */
  async linkTelegramToUser(
    userId: string,
    telegramUser: TelegramUserData,
  ): Promise<User> {
    const telegramId = String(telegramUser.id);

    // Проверяем, не привязан ли уже этот telegramId
    const existingTgUser = await this.findByTelegramId(telegramId);
    if (existingTgUser && existingTgUser.id !== userId) {
      throw new Error(
        'This Telegram account is already linked to another user',
      );
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        telegramId,
        username: telegramUser.username || undefined,
        firstName: telegramUser.first_name || undefined,
        lastName: telegramUser.last_name || undefined,
        avatarUrl: telegramUser.photo_url || undefined,
      },
    });
  }

  /**
   * Привязывает Email к существующему пользователю
   */
  async linkEmailToUser(
    userId: string,
    email: string,
    supabaseId: string,
  ): Promise<User> {
    // Проверяем, не привязан ли уже этот email
    const existingEmailUser = await this.findByEmail(email);
    if (existingEmailUser && existingEmailUser.id !== userId) {
      throw new Error('This email is already linked to another user');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        email,
        supabaseId,
        emailVerifiedAt: new Date(),
      },
    });
  }

  // ============ Web3 Auth Methods ============

  /**
   * Поиск пользователя по Web3 адресу
   */
  async findByWeb3Address(address: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { web3Address: address },
    });
  }

  /**
   * Создание нового пользователя с Web3 адресом
   */
  private async createUserWithWeb3(
    web3Address: string,
    referrerCode?: string,
  ): Promise<User> {
    const referralCode = nanoid(8);
    const isOG = await this.settingsService.isPrelaunch();

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
        web3Address,
        referralCode,
        referredById: referrerId,
        isOG,
      },
    });
  }

  /**
   * Найти или создать пользователя по Web3 адресу
   */
  async findOrCreateFromWeb3(
    web3Address: string,
    referrerCode?: string,
  ): Promise<{ user: User; isNewUser: boolean }> {
    // Ищем по web3Address
    let user = await this.findByWeb3Address(web3Address);
    let isNewUser = false;

    if (!user) {
      // Создаём нового пользователя
      user = await this.createUserWithWeb3(web3Address, referrerCode);
      isNewUser = true;
    }

    return { user, isNewUser };
  }

  /**
   * Привязывает Web3 кошелёк к существующему пользователю
   */
  async linkWeb3ToUser(userId: string, web3Address: string): Promise<User> {
    // Проверяем, не привязан ли уже этот адрес
    const existingWeb3User = await this.findByWeb3Address(web3Address);
    if (existingWeb3User && existingWeb3User.id !== userId) {
      throw new Error('This wallet is already linked to another user');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        web3Address,
      },
    });
  }
}
