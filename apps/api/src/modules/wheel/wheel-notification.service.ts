import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface JackpotNotification {
  winnerId: string;
  winnerName: string | null;
  winnerTelegramId: string;
  amount: number;
}

@Injectable()
export class WheelNotificationService {
  private readonly logger = new Logger(WheelNotificationService.name);
  private readonly botToken: string | undefined;
  private readonly channelId: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.channelId = this.configService.get<string>('TELEGRAM_CHANNEL_ID');
  }

  /**
   * Send jackpot winner notification to Telegram channel
   */
  async notifyJackpotWinner(data: JackpotNotification): Promise<void> {
    if (!this.botToken || !this.channelId) {
      this.logger.warn(
        'Telegram notifications disabled: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID',
      );
      return;
    }

    const winnerDisplay = data.winnerName || `User ${data.winnerTelegramId.slice(-4)}`;

    // Message in both languages
    const message = this.formatJackpotMessage(winnerDisplay, data.amount);

    try {
      await this.sendTelegramMessage(this.channelId, message);
      this.logger.log(`Jackpot notification sent: ${winnerDisplay} won $${data.amount}`);
    } catch (error) {
      this.logger.error('Failed to send Telegram notification', error);
    }
  }

  /**
   * Send direct message to user about their jackpot win
   */
  async notifyUserJackpotWin(
    telegramId: string,
    amount: number,
    locale: string = 'en',
  ): Promise<void> {
    if (!this.botToken) {
      return;
    }

    const message =
      locale === 'ru'
        ? `🎰 ДЖЕКПОТ! 🎉\n\nПоздравляем! Вы выиграли джекпот $${amount.toFixed(2)} на Колесе Фортуны!\n\nВаш выигрыш уже на балансе. Удачи!`
        : `🎰 JACKPOT! 🎉\n\nCongratulations! You won the $${amount.toFixed(2)} jackpot on the Fortune Wheel!\n\nYour winnings are already in your balance. Good luck!`;

    try {
      await this.sendTelegramMessage(telegramId, message);
    } catch (error) {
      this.logger.error(`Failed to notify user ${telegramId}`, error);
    }
  }

  private formatJackpotMessage(winner: string, amount: number): string {
    return (
      `🎰 JACKPOT WINNER! 🎉\n\n` +
      `${winner} just hit the JACKPOT!\n` +
      `💰 Won: $${amount.toFixed(2)}\n\n` +
      `---\n\n` +
      `🎰 ДЖЕКПОТ! 🎉\n\n` +
      `${winner} сорвал ДЖЕКПОТ!\n` +
      `💰 Выигрыш: $${amount.toFixed(2)}\n\n` +
      `🎡 Spin the Fortune Wheel!\n` +
      `🎡 Крути Колесо Фортуны!`
    );
  }

  private async sendTelegramMessage(
    chatId: string,
    text: string,
  ): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${error}`);
    }
  }
}
