import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DepositCurrency } from '@prisma/client';
import {
  OtherCryptoNetwork,
  OtherCryptoToken,
} from '../constants/other-crypto';

// ============== WALLET CONNECT ==============

export class ConnectWalletDto {
  @IsString()
  walletAddress: string;

  @IsString()
  @IsOptional()
  signature?: string; // Optional signature for verification
}

export class InitiateDepositDto {
  @IsEnum(DepositCurrency)
  currency: DepositCurrency;

  @IsNumber()
  @Min(0.000001)
  amount: number;

  @IsString()
  walletAddress: string;
}

export class InitiateDepositResponseDto {
  depositId: string;
  memo: string;
  recipientAddress: string;
  amount: number;
  currency: DepositCurrency;
}

export class ConfirmDepositDto {
  @IsString()
  depositId: string;

  @IsString()
  txSignature: string;
}

// ============== DEPOSIT ADDRESS ==============

export class GetDepositAddressDto {
  @IsEnum(DepositCurrency)
  @IsOptional()
  currency?: DepositCurrency;
}

export class DepositAddressResponseDto {
  address: string;
  qrCode: string; // Base64 PNG
  minDeposit: number;
}

// ============== RATES ==============

export class DepositRatesResponseDto {
  sol: number;
  fortune: number;
  usdt: number;
}

// ============== HELIUS WEBHOOK ==============

export class HeliusNativeTransferDto {
  @IsString()
  fromUserAccount: string;

  @IsString()
  toUserAccount: string;

  @IsNumber()
  amount: number;
}

export class HeliusTokenTransferDto {
  @IsString()
  fromUserAccount: string;

  @IsString()
  toUserAccount: string;

  @IsString()
  mint: string;

  @IsNumber()
  tokenAmount: number;
}

export class HeliusWebhookTransactionDto {
  @IsString()
  signature: string;

  @IsNumber()
  slot: number;

  @IsString()
  @IsOptional()
  type?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HeliusNativeTransferDto)
  @IsOptional()
  nativeTransfers?: HeliusNativeTransferDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HeliusTokenTransferDto)
  @IsOptional()
  tokenTransfers?: HeliusTokenTransferDto[];
}

// Helius sends array of transactions
export type HeliusWebhookPayload = HeliusWebhookTransactionDto[];

// ============== PARSED DEPOSIT ==============

export interface ParsedDeposit {
  currency: DepositCurrency;
  amount: number;
  toAddress: string;
  fromAddress: string;
  signature: string;
  slot: number;
  mint?: string;
}

// ============== OTHER CRYPTO ==============

export class InitiateOtherCryptoDepositDto {
  @IsEnum(OtherCryptoNetwork)
  network: OtherCryptoNetwork;

  @IsEnum(OtherCryptoToken)
  token: OtherCryptoToken;

  @IsNumber()
  @Min(0.000001)
  claimedAmount: number; // Amount user claims to have sent
}

export class OtherCryptoDepositResponseDto {
  depositId: string;
  network: OtherCryptoNetwork;
  token: OtherCryptoToken;
  claimedAmount: number;
  status: 'pending';
  message: string;
}

export class OtherCryptoInstructionsDto {
  network: OtherCryptoNetwork;
  depositAddress: string;
  supportedTokens: OtherCryptoToken[];
  minAmounts: Record<string, number>;
  blockExplorer: string;
  instructions: string;
}
