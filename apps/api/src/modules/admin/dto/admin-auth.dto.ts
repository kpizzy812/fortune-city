import { IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @MinLength(1)
  username: string;

  @IsString()
  @MinLength(1)
  password: string;
}

export class AdminAuthResponseDto {
  accessToken: string;
  admin: {
    username: string;
  };
}
