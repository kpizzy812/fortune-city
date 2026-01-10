import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

/**
 * DTO для авторизации через Telegram Mini App (initData)
 */
export class TelegramInitDataDto {
  @IsString()
  @IsNotEmpty()
  initData: string;
}

/**
 * DTO для авторизации через Telegram Login Widget (Web)
 * https://core.telegram.org/widgets/login
 */
export class TelegramLoginWidgetDto {
  @IsNumber()
  id: number;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  photo_url?: string;

  @IsNumber()
  auth_date: number;

  @IsString()
  hash: string;
}

/**
 * Ответ после успешной авторизации
 */
export class AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    telegramId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    fortuneBalance: string;
    maxTierReached: number;
    currentTaxRate: string;
  };
}
