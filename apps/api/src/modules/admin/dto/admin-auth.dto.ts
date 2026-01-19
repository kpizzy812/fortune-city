import { IsString, MinLength, IsBoolean, IsOptional } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @MinLength(1)
  username: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}

export class AdminAuthResponseDto {
  accessToken: string;
  refreshToken?: string; // Present only when rememberMe is true
  admin: {
    username: string;
  };
}

/**
 * DTO для обновления токена через refresh token
 */
export class RefreshTokenDto {
  @IsString()
  @MinLength(1)
  refreshToken: string;
}
