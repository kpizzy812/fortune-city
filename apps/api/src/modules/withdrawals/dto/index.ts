import { IsNumber, IsString, IsEnum, Min, Max } from 'class-validator';

// ============== Enums ==============

export enum WithdrawalMethodDto {
  WALLET_CONNECT = 'wallet_connect',
  MANUAL_ADDRESS = 'manual_address',
}

// ============== Request DTOs ==============

export class PreviewWithdrawalDto {
  @IsNumber()
  @Min(1, { message: 'Minimum withdrawal is $1' })
  @Max(10000, { message: 'Maximum withdrawal is $10,000' })
  amount: number;
}

export class CreateWithdrawalDto {
  @IsNumber()
  @Min(1, { message: 'Minimum withdrawal is $1' })
  @Max(10000, { message: 'Maximum withdrawal is $10,000' })
  amount: number;

  @IsString()
  walletAddress: string;

  @IsEnum(WithdrawalMethodDto)
  method: WithdrawalMethodDto;
}

export class PrepareAtomicWithdrawalDto {
  @IsNumber()
  @Min(1)
  @Max(10000)
  amount: number;
}

export class ConfirmAtomicWithdrawalDto {
  @IsString()
  withdrawalId: string;

  @IsString()
  txSignature: string;
}

// ============== Response DTOs ==============

export interface WithdrawalPreviewResponse {
  requestedAmount: number;
  fromFreshDeposit: number;
  fromProfit: number;
  taxRate: number;
  taxAmount: number;
  netAmount: number;
  usdtAmount: number;
  feeSol: number; // SOL fee for wallet_connect method
}

export interface PreparedAtomicWithdrawalResponse {
  withdrawalId: string;
  // Base64 encoded serialized transaction (partially signed by hot wallet)
  serializedTransaction: string;
  // Amounts for display
  requestedAmount: number;
  netAmount: number;
  usdtAmount: number;
  taxAmount: number;
  feeSol: number;
  // Recipient address (user's wallet)
  recipientAddress: string;
}

export interface WithdrawalResponse {
  id: string;
  status: string;
  method: string;
  requestedAmount: number;
  netAmount: number;
  usdtAmount: number;
  taxAmount: number;
  txSignature: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface InstantWithdrawalResponse {
  id: string;
  status: string;
  txSignature: string;
  requestedAmount: number;
  netAmount: number;
  usdtAmount: number;
}
