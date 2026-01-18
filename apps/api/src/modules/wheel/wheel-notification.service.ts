import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

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
      'https://fortunecity.app';
  }

  /**
   * Broadcast jackpot win to all users with telegramId
   * Excludes the winner (they get a personal message)
   */
  async broadcastJackpotWin(data: JackpotBroadcastData): Promise<void> {
    if (!this.botToken) {
      this.logger.warn('Telegram notifications disabled: missing TELEGRAM_BOT_TOKEN');
      return;
    }

    // Get all users with telegramId except the winner
    // Note: telegramId is required field, all users have it
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: data.winnerId },
        isBanned: false,
      },
      select: {
        telegramId: true,
      },
    });

    if (users.length === 0) {
      this.logger.log('No users to notify about jackpot');
      return;
    }

    const winnerDisplay = data.winnerName || 'Someone';

    // Message with inline button to open wheel
    const messageEn =
      `🎰 <b>JACKPOT HIT!</b> 🎉\n\n` +
      `${winnerDisplay} just won <b>$${data.amount.toFixed(2)}</b> on the Fortune Wheel!\n\n` +
      `Try your luck now! 🍀`;

    const messageRu =
      `🎰 <b>ДЖЕКПОТ!</b> 🎉\n\n` +
      `${winnerDisplay} сорвал <b>$${data.amount.toFixed(2)}</b> на Колесе Фортуны!\n\n` +
      `Испытай удачу! 🍀`;

    // Bilingual message
    const message = `${messageEn}\n\n---\n\n${messageRu}`;

    // Inline keyboard with Web App button
    const keyboard: TelegramInlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: '🎡 Spin Now! / Крутить!',
            web_app: { url: `${this.webAppUrl}/wheel` },
          },
        ],
      ],
    };

    let sent = 0;
    let failed = 0;

    // Send to all users (with rate limiting to avoid Telegram limits)
    for (const user of users) {
      // Skip users without Telegram ID (email-only users)
      if (!user.telegramId) {
        continue;
      }

      try {
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
      } catch (error) {
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

    const message =
      `🎰 <b>ПОЗДРАВЛЯЕМ!</b> 🎉\n\n` +
      `Вы выиграли ДЖЕКПОТ <b>$${amount.toFixed(2)}</b> на Колесе Фортуны!\n\n` +
      `Ваш выигрыш уже на балансе. Удачи! 🍀\n\n` +
      `---\n\n` +
      `🎰 <b>CONGRATULATIONS!</b> 🎉\n\n` +
      `You won the JACKPOT <b>$${amount.toFixed(2)}</b> on the Fortune Wheel!\n\n` +
      `Your winnings are in your balance. Good luck! 🍀`;

    const keyboard: TelegramInlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: '🎡 Spin Again! / Крутить ещё!',
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
