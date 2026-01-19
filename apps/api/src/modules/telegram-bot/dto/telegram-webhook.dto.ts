// Telegram Bot API types for webhook updates
// Based on: https://core.telegram.org/bots/api#update

export interface TelegramWebhookDto {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: TelegramMessageEntity[];
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

// Helper to extract deep link parameter from /start command
export function extractDeepLinkParam(text?: string): string | null {
  if (!text) return null;

  const match = text.match(/^\/start\s+(.+)$/);
  return match ? match[1] : null;
}

// Helper to extract bot command
export function extractCommand(text?: string): string | null {
  if (!text) return null;

  const match = text.match(/^\/([a-z_]+)/);
  return match ? match[1] : null;
}
