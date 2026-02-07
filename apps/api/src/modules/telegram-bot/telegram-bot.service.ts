import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  TelegramWebhookDto,
  extractDeepLinkParam,
  extractCommand,
} from './dto/telegram-webhook.dto';
import { getLang, getMessages, type Lang } from './telegram-bot.messages';

const LOGIN_TOKEN_BYTES = 32;
const LOGIN_TOKEN_TTL_MINUTES = 5;

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

  // ============ Login Token helpers ============

  private generateLoginToken(): string {
    return crypto.randomBytes(LOGIN_TOKEN_BYTES).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async createLoginTokenForUser(userId: string): Promise<string> {
    const token = this.generateLoginToken();
    const hashedToken = this.hashToken(token);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + LOGIN_TOKEN_TTL_MINUTES);

    // Удаляем старые токены этого юзера
    await this.prisma.telegramLoginToken.deleteMany({ where: { userId } });

    await this.prisma.telegramLoginToken.create({
      data: { userId, token: hashedToken, expiresAt },
    });

    return token;
  }

  /**
   * Строим URL для "Открыть в браузере" с одноразовым токеном
   */
  private async buildBrowserUrl(telegramUserId?: string): Promise<string> {
    if (!telegramUserId) return this.webAppUrl;

    try {
      const user = await this.prisma.user.findUnique({
        where: { telegramId: telegramUserId },
        select: { id: true },
      });

      if (!user) return this.webAppUrl;

      const token = await this.createLoginTokenForUser(user.id);
      return `${this.webAppUrl}/auth/tg-login?token=${token}`;
    } catch (error) {
      this.logger.error(`Failed to build browser URL: ${error.message}`);
      return this.webAppUrl;
    }
  }

  // ============ Keyboard builder ============

  private buildAppKeyboard(
    lang: Lang,
    browserUrl: string,
  ): TelegramInlineKeyboard {
    const msg = getMessages(lang);
    return {
      inline_keyboard: [
        [{ text: msg.welcome.openMiniApp, web_app: { url: this.webAppUrl } }],
        [{ text: msg.welcome.openBrowser, url: browserUrl }],
      ],
    };
  }

  // ============ Webhook handler ============

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
      const lang = getLang(message.from?.language_code);
      const telegramUserId = message.from
        ? String(message.from.id)
        : undefined;

      switch (command) {
        case 'start':
          await this.handleStart(
            telegramChatId,
            message.text,
            lang,
            telegramUserId,
          );
          break;

        case 'help':
          await this.handleHelp(telegramChatId, lang);
          break;

        case 'notifications':
          await this.handleNotifications(telegramChatId, lang);
          break;

        case 'disconnect':
          await this.handleDisconnect(telegramChatId, lang);
          break;

        default:
          await this.handleUnknownCommand(telegramChatId, lang);
      }
    } catch (error) {
      this.logger.error(`Error handling webhook: ${error.message}`, error);
    }
  }

  // ============ Command handlers ============

  /**
   * /start с опциональным deep link параметром
   * Deep link формат: /start connect_USER_ID
   */
  private async handleStart(
    telegramChatId: string,
    text: string,
    lang: Lang,
    telegramUserId?: string,
  ): Promise<void> {
    const deepLinkParam = extractDeepLinkParam(text);

    if (deepLinkParam && deepLinkParam.startsWith('connect_')) {
      const userId = deepLinkParam.replace('connect_', '');
      await this.connectUser(telegramChatId, userId, lang, telegramUserId);
    } else {
      await this.sendWelcomeMessage(telegramChatId, lang, telegramUserId);
    }
  }

  /**
   * Подключение Telegram чата к аккаунту пользователя
   */
  private async connectUser(
    telegramChatId: string,
    userId: string,
    lang: Lang,
    telegramUserId?: string,
  ): Promise<void> {
    const msg = getMessages(lang);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          telegramId: true,
          telegramNotificationsEnabled: true,
        },
      });

      if (!user) {
        await this.sendMessage(telegramChatId, msg.connectionFailed.notFound);
        return;
      }

      // Уже подключён
      if (
        user.telegramNotificationsEnabled &&
        user.telegramId === telegramChatId
      ) {
        await this.sendMessage(telegramChatId, msg.alreadyConnected);
        return;
      }

      // Привязываем Telegram chat
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          telegramChatId,
          telegramNotificationsEnabled: true,
          telegramBotConnectedAt: new Date(),
        },
      });

      const userName =
        user.firstName || (lang === 'ru' ? 'Игрок' : 'Player');
      const browserUrl = await this.buildBrowserUrl(telegramUserId);

      const keyboard: TelegramInlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: msg.connected.openMiniApp,
              web_app: { url: this.webAppUrl },
            },
          ],
          [{ text: msg.connected.openBrowser, url: browserUrl }],
        ],
      };

      await this.sendMessageWithKeyboard(
        telegramChatId,
        msg.connected.text(userName),
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
      await this.sendMessage(telegramChatId, msg.connectionFailed.error);
    }
  }

  /**
   * Приветственное сообщение — точка входа в приложение
   */
  private async sendWelcomeMessage(
    telegramChatId: string,
    lang: Lang,
    telegramUserId?: string,
  ): Promise<void> {
    const msg = getMessages(lang);
    const browserUrl = await this.buildBrowserUrl(telegramUserId);
    const keyboard = this.buildAppKeyboard(lang, browserUrl);

    await this.sendMessageWithKeyboard(
      telegramChatId,
      msg.welcome.text,
      keyboard,
    );
  }

  /**
   * /help
   */
  private async handleHelp(
    telegramChatId: string,
    lang: Lang,
  ): Promise<void> {
    const msg = getMessages(lang);
    await this.sendMessage(telegramChatId, msg.help);
  }

  /**
   * /notifications
   */
  private async handleNotifications(
    telegramChatId: string,
    lang: Lang,
  ): Promise<void> {
    const msg = getMessages(lang);

    const user = await this.prisma.user.findFirst({
      where: { telegramChatId },
      select: { telegramNotificationsEnabled: true },
    });

    if (!user) {
      await this.sendMessage(telegramChatId, msg.notifications.notConnected);
      return;
    }

    await this.sendMessage(
      telegramChatId,
      msg.notifications.settings(user.telegramNotificationsEnabled),
    );
  }

  /**
   * /disconnect
   */
  private async handleDisconnect(
    telegramChatId: string,
    lang: Lang,
  ): Promise<void> {
    const msg = getMessages(lang);

    const user = await this.prisma.user.findFirst({
      where: { telegramChatId },
    });

    if (!user) {
      await this.sendMessage(telegramChatId, msg.disconnect.notConnected);
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        telegramChatId: null,
        telegramNotificationsEnabled: false,
      },
    });

    await this.sendMessage(telegramChatId, msg.disconnect.success);

    this.logger.log(
      `Disconnected Telegram chat ${telegramChatId} from user ${user.id}`,
    );
  }

  /**
   * Неизвестная команда
   */
  private async handleUnknownCommand(
    telegramChatId: string,
    lang: Lang,
  ): Promise<void> {
    const msg = getMessages(lang);
    await this.sendMessage(telegramChatId, msg.unknownCommand);
  }

  // ============ Message sending ============

  async sendMessage(chatId: string, text: string): Promise<void> {
    return this.sendMessageWithKeyboard(chatId, text);
  }

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
