import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import type { TelegramWebhookDto } from './dto/telegram-webhook.dto';

@Controller('telegram-bot')
export class TelegramBotController {
  private readonly logger = new Logger(TelegramBotController.name);

  constructor(private readonly telegramBotService: TelegramBotService) {}

  /**
   * Webhook endpoint for Telegram Bot API
   * Telegram will POST updates to this endpoint
   *
   * Setup webhook with:
   * curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
   *   -H "Content-Type: application/json" \
   *   -d '{"url": "https://your-domain.com/telegram-bot/webhook"}'
   */
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() update: TelegramWebhookDto): Promise<void> {
    this.logger.debug(`Received webhook update: ${update.update_id}`);

    // Process webhook asynchronously (don't block Telegram)
    this.telegramBotService.handleWebhook(update).catch((error) => {
      this.logger.error(`Error processing webhook: ${error.message}`, error);
    });

    // Return 200 immediately to Telegram
    return;
  }
}
