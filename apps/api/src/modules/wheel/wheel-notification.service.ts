import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  type Lang,
  getLang,
  getWheelMessages,
} from '../telegram-bot/telegram-bot.messages';

interface JackpotBroadcastData {
  winnerId: string;
  winnerName: string | null;
  amount: number;
}

interface TelegramInlineKeyboard {
  inline_keyboard: Array<
    Array<{
      text: string;
      url?: string;
      web_app?: { url: string };
    }>
  >;
}

@Injectable()
export class WheelNotificationService {
  private readonly logger = new Logger(WheelNotificationService.name);
  private readonly botToken: string | undefined;
  private readonly webAppUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.webAppUrl =
      this.configService.get<string>('TELEGRAM_WEBAPP_URL') ||
      'https://fortune.syntratrade.com';
  }

  /**
   * Broadcast jackpot win to all users with telegramId
   * Excludes the winner (they get a personal message)
   */
  async broadcastJackpotWin(data: JackpotBroadcastData): Promise<void> {
    if (!this.botToken) {
      this.logger.warn(
        'Telegram notifications disabled: missing TELEGRAM_BOT_TOKEN',
      );
      return;
    }

    // Get all users with telegramId except the winner
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: data.winnerId },
        isBanned: false,
      },
      select: {
        telegramId: true,
        language: true,
      },
    });

    if (users.length === 0) {
      this.logger.log('No users to notify about jackpot');
      return;
    }

    const winnerDisplay = data.winnerName || 'Someone';
    const amountStr = data.amount.toFixed(2);

    let sent = 0;
    let failed = 0;

    // Send to all users (with rate limiting to avoid Telegram limits)
    for (const user of users) {
      // Skip users without Telegram ID (email-only users)
      if (!user.telegramId) {
        continue;
      }

      try {
        const lang: Lang = getLang(user.language ?? undefined);
        const wheel = getWheelMessages(lang);

        const message = wheel.jackpotBroadcast(winnerDisplay, amountStr);
        const keyboard: TelegramInlineKeyboard = {
          inline_keyboard: [
            [
              {
                text: wheel.spinButton,
                web_app: { url: `${this.webAppUrl}/wheel` },
              },
            ],
          ],
        };

        await this.sendTelegramMessageWithKeyboard(
          user.telegramId,
          message,
          keyboard,
        );
        sent++;

        // Rate limit: ~30 messages per second (Telegram limit)
        if (sent % 25 === 0) {
          await this.delay(1000);
        }
      } catch {
        failed++;
        // Don't log every failure - user may have blocked the bot
      }
    }

    this.logger.log(
      `Jackpot broadcast: sent to ${sent} users, ${failed} failed (${winnerDisplay} won $${data.amount})`,
    );
  }

  /**
   * Send personal message to jackpot winner
   */
  async notifyWinnerPersonally(
    telegramId: string,
    amount: number,
  ): Promise<void> {
    if (!this.botToken) {
      return;
    }

    // Fetch winner's language
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      select: { language: true },
    });

    const lang: Lang = getLang(user?.language ?? undefined);
    const wheel = getWheelMessages(lang);

    const message = wheel.jackpotPersonal(amount.toFixed(2));
    const keyboard: TelegramInlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: wheel.spinAgainButton,
            web_app: { url: `${this.webAppUrl}/wheel` },
          },
        ],
      ],
    };

    try {
      await this.sendTelegramMessageWithKeyboard(telegramId, message, keyboard);
      this.logger.log(`Notified winner ${telegramId} about jackpot $${amount}`);
    } catch (error) {
      this.logger.error(`Failed to notify winner ${telegramId}`, error);
    }
  }

  private async sendTelegramMessageWithKeyboard(
    chatId: string,
    text: string,
    keyboard?: TelegramInlineKeyboard,
  ): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };

    if (keyboard) {
      body.reply_markup = keyboard;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${error}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
