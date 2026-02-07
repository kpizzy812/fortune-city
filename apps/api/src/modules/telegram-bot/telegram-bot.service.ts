import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  TelegramWebhookDto,
  extractDeepLinkParam,
  extractCommand,
} from './dto/telegram-webhook.dto';

interface TelegramInlineKeyboard {
  inline_keyboard: Array<
    Array<{
      text: string;
      url?: string;
      web_app?: { url: string };
      callback_data?: string;
    }>
  >;
}

@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);
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

    if (!this.botToken) {
      this.logger.warn(
        'Telegram Bot disabled: missing TELEGRAM_BOT_TOKEN in environment',
      );
    }
  }

  /**
   * Handle incoming webhook update from Telegram
   */
  async handleWebhook(update: TelegramWebhookDto): Promise<void> {
    if (!this.botToken) {
      return;
    }

    try {
      const message = update.message;
      if (!message || !message.text) {
        return;
      }

      const command = extractCommand(message.text);
      const telegramChatId = String(message.chat.id);

      switch (command) {
        case 'start':
          await this.handleStart(telegramChatId, message.text);
          break;

        case 'help':
          await this.handleHelp(telegramChatId);
          break;

        case 'notifications':
          await this.handleNotifications(telegramChatId);
          break;

        case 'disconnect':
          await this.handleDisconnect(telegramChatId);
          break;

        default:
          await this.handleUnknownCommand(telegramChatId);
      }
    } catch (error) {
      this.logger.error(`Error handling webhook: ${error.message}`, error);
    }
  }

  /**
   * Handle /start command with optional deep link parameter
   * Deep link format: /start connect_USER_ID
   */
  private async handleStart(
    telegramChatId: string,
    text: string,
  ): Promise<void> {
    const deepLinkParam = extractDeepLinkParam(text);

    if (deepLinkParam && deepLinkParam.startsWith('connect_')) {
      const userId = deepLinkParam.replace('connect_', '');
      await this.connectUser(telegramChatId, userId);
    } else {
      await this.sendWelcomeMessage(telegramChatId);
    }
  }

  /**
   * Connect Telegram chat to user account
   */
  private async connectUser(
    telegramChatId: string,
    userId: string,
  ): Promise<void> {
    try {
      // Find user by ID
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          telegramId: true,
          telegramNotificationsEnabled: true,
        },
      });

      if (!user) {
        await this.sendMessage(
          telegramChatId,
          '❌ <b>Connection Failed</b>\n\n' +
            'User not found. Please try again from the app.\n\n' +
            '---\n\n' +
            '❌ <b>Ошибка подключения</b>\n\n' +
            'Пользователь не найден. Попробуйте снова из приложения.',
        );
        return;
      }

      // Check if user is already connected
      if (
        user.telegramNotificationsEnabled &&
        user.telegramId === telegramChatId
      ) {
        await this.sendMessage(
          telegramChatId,
          '✅ <b>Already Connected!</b>\n\n' +
            'Your Telegram is already linked to Fortune City.\n\n' +
            'You will receive notifications about:\n' +
            '• 💰 Deposits\n' +
            '• 🎰 Machine updates\n' +
            '• 📦 Full Coin Boxes\n' +
            '• 👥 New referrals\n' +
            '• 🎡 Wheel jackpots\n\n' +
            '---\n\n' +
            '✅ <b>Уже подключено!</b>\n\n' +
            'Ваш Telegram уже привязан к Fortune City.',
        );
        return;
      }

      // Update user with Telegram chat ID
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          telegramChatId,
          telegramNotificationsEnabled: true,
          telegramBotConnectedAt: new Date(),
        },
      });

      const userName = user.firstName || 'Player';

      // Send success message with inline keyboard
      const keyboard: TelegramInlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: '🎰 Open Fortune City',
              web_app: { url: this.webAppUrl },
            },
          ],
        ],
      };

      await this.sendMessageWithKeyboard(
        telegramChatId,
        `🎉 <b>Connected Successfully!</b>\n\n` +
          `Welcome, ${userName}! Your Telegram is now linked to Fortune City.\n\n` +
          `You will receive instant notifications about:\n` +
          `• 💰 Deposits and withdrawals\n` +
          `• 🎰 Machine status updates\n` +
          `• 📦 Full Coin Boxes (collect now!)\n` +
          `• 👥 New referrals\n` +
          `• 🎡 Wheel jackpots\n\n` +
          `<b>Commands:</b>\n` +
          `/help - Show all commands\n` +
          `/notifications - Notification settings\n` +
          `/disconnect - Unlink Telegram\n\n` +
          `---\n\n` +
          `🎉 <b>Успешно подключено!</b>\n\n` +
          `Добро пожаловать, ${userName}! Ваш Telegram привязан к Fortune City.\n\n` +
          `Вы будете получать уведомления о:\n` +
          `• 💰 Депозитах и выводах\n` +
          `• 🎰 Статусе машин\n` +
          `• 📦 Заполненных Coin Box\n` +
          `• 👥 Новых рефералах\n` +
          `• 🎡 Джекпотах колеса`,
        keyboard,
      );

      this.logger.log(
        `Connected Telegram chat ${telegramChatId} to user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to connect user ${userId}: ${error.message}`,
        error,
      );
      await this.sendMessage(
        telegramChatId,
        '❌ <b>Connection Failed</b>\n\n' +
          'An error occurred. Please try again later.\n\n' +
          '---\n\n' +
          '❌ <b>Ошибка подключения</b>\n\n' +
          'Произошла ошибка. Попробуйте позже.',
      );
    }
  }

  /**
   * Send welcome message for users who just started bot
   */
  private async sendWelcomeMessage(telegramChatId: string): Promise<void> {
    const keyboard: TelegramInlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: '🎰 Open Fortune City',
            web_app: { url: this.webAppUrl },
          },
        ],
      ],
    };

    await this.sendMessageWithKeyboard(
      telegramChatId,
      '🎰 <b>Welcome to Fortune City!</b>\n\n' +
        'Build your casino empire and earn $FORTUNE.\n\n' +
        'To receive notifications, please:\n' +
        '1. Open Fortune City app\n' +
        '2. Click "Enable Telegram Notifications"\n' +
        '3. Return here to connect\n\n' +
        'Use /help to see all commands.\n\n' +
        '---\n\n' +
        '🎰 <b>Добро пожаловать в Fortune City!</b>\n\n' +
        'Создай империю казино и зарабатывай $FORTUNE.\n\n' +
        'Чтобы получать уведомления:\n' +
        '1. Открой приложение Fortune City\n' +
        '2. Нажми "Подключить Telegram"\n' +
        '3. Вернись сюда для подключения',
      keyboard,
    );
  }

  /**
   * Handle /help command
   */
  private async handleHelp(telegramChatId: string): Promise<void> {
    await this.sendMessage(
      telegramChatId,
      '📖 <b>Fortune City Bot Commands</b>\n\n' +
        '<b>Available commands:</b>\n' +
        '/start - Start bot and connect account\n' +
        '/help - Show this help message\n' +
        '/notifications - Notification settings\n' +
        '/disconnect - Unlink Telegram from account\n\n' +
        '---\n\n' +
        '📖 <b>Команды Fortune City Bot</b>\n\n' +
        '<b>Доступные команды:</b>\n' +
        '/start - Запуск бота и подключение\n' +
        '/help - Показать эту справку\n' +
        '/notifications - Настройки уведомлений\n' +
        '/disconnect - Отключить Telegram',
    );
  }

  /**
   * Handle /notifications command
   */
  private async handleNotifications(telegramChatId: string): Promise<void> {
    // Find user by telegram chat ID
    const user = await this.prisma.user.findFirst({
      where: { telegramChatId },
      select: {
        telegramNotificationsEnabled: true,
      },
    });

    if (!user) {
      await this.sendMessage(
        telegramChatId,
        '❌ <b>Not Connected</b>\n\n' +
          'Your Telegram is not linked to any Fortune City account.\n' +
          'Use /start to connect.\n\n' +
          '---\n\n' +
          '❌ <b>Не подключено</b>\n\n' +
          'Ваш Telegram не привязан к аккаунту.\n' +
          'Используйте /start для подключения.',
      );
      return;
    }

    const status = user.telegramNotificationsEnabled
      ? 'Enabled ✅'
      : 'Disabled ❌';
    const statusRu = user.telegramNotificationsEnabled
      ? 'Включены ✅'
      : 'Выключены ❌';

    await this.sendMessage(
      telegramChatId,
      '🔔 <b>Notification Settings</b>\n\n' +
        `Status: <b>${status}</b>\n\n` +
        'You receive notifications about:\n' +
        '• 💰 Deposits and withdrawals\n' +
        '• 🎰 Machine status\n' +
        '• 📦 Coin Box alerts\n' +
        '• 👥 New referrals\n' +
        '• 🎡 Wheel jackpots\n\n' +
        'To change settings, visit the app.\n\n' +
        '---\n\n' +
        '🔔 <b>Настройки уведомлений</b>\n\n' +
        `Статус: <b>${statusRu}</b>\n\n` +
        'Вы получаете уведомления о:\n' +
        '• 💰 Депозитах и выводах\n' +
        '• 🎰 Статусе машин\n' +
        '• 📦 Заполненных Coin Box\n' +
        '• 👥 Новых рефералах\n' +
        '• 🎡 Джекпотах колеса',
    );
  }

  /**
   * Handle /disconnect command
   */
  private async handleDisconnect(telegramChatId: string): Promise<void> {
    // Find and disconnect user
    const user = await this.prisma.user.findFirst({
      where: { telegramChatId },
    });

    if (!user) {
      await this.sendMessage(
        telegramChatId,
        '❌ <b>Not Connected</b>\n\n' +
          'Your Telegram is not linked to any account.\n\n' +
          '---\n\n' +
          '❌ <b>Не подключено</b>\n\n' +
          'Ваш Telegram не привязан к аккаунту.',
      );
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        telegramChatId: null,
        telegramNotificationsEnabled: false,
      },
    });

    await this.sendMessage(
      telegramChatId,
      '✅ <b>Disconnected Successfully</b>\n\n' +
        'Your Telegram has been unlinked from Fortune City.\n' +
        'You will no longer receive notifications.\n\n' +
        'Use /start to reconnect anytime.\n\n' +
        '---\n\n' +
        '✅ <b>Успешно отключено</b>\n\n' +
        'Ваш Telegram отключён от Fortune City.\n' +
        'Вы больше не будете получать уведомления.\n\n' +
        'Используйте /start для повторного подключения.',
    );

    this.logger.log(
      `Disconnected Telegram chat ${telegramChatId} from user ${user.id}`,
    );
  }

  /**
   * Handle unknown commands
   */
  private async handleUnknownCommand(telegramChatId: string): Promise<void> {
    await this.sendMessage(
      telegramChatId,
      '❓ <b>Unknown Command</b>\n\n' +
        'Use /help to see all available commands.\n\n' +
        '---\n\n' +
        '❓ <b>Неизвестная команда</b>\n\n' +
        'Используйте /help для списка команд.',
    );
  }

  /**
   * Send message to Telegram user
   */
  async sendMessage(chatId: string, text: string): Promise<void> {
    return this.sendMessageWithKeyboard(chatId, text);
  }

  /**
   * Send message with inline keyboard to Telegram user
   */
  async sendMessageWithKeyboard(
    chatId: string,
    text: string,
    keyboard?: TelegramInlineKeyboard,
  ): Promise<void> {
    if (!this.botToken) {
      return;
    }

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
}
