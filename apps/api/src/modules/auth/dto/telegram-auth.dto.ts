import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from 'class-validator';

/**
 * DTO для авторизации через Telegram Mini App (initData)
 */
export class TelegramInitDataDto {
  @IsString()
  @IsNotEmpty()
  initData: string;

  @IsString()
  @IsOptional()
  referralCode?: string;

  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
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

  @IsString()
  @IsOptional()
  referralCode?: string;

  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}

/**
 * DTO для авторизации через Supabase (email magic link)
 */
export class SupabaseAuthDto {
  @IsString()
  @IsNotEmpty()
  accessToken: string; // Supabase access token

  @IsString()
  @IsOptional()
  referralCode?: string;

  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}

/**
 * Ответ после успешной авторизации
 */
export class AuthResponseDto {
  accessToken: string;
  refreshToken?: string; // Present only when rememberMe is true
  user: {
    id: string;
    telegramId: string | null;
    email: string | null;
    web3Address: string | null; // Solana wallet address
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    fortuneBalance: string;
    referralBalance: string;
    maxTierReached: number;
    currentTaxRate: string;
    referralCode: string;
  };
}

/**
 * DTO для обновления access token через refresh token
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
