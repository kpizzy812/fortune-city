import { IsNotEmpty, IsIn, IsNumber } from 'class-validator';

export class PurchaseOverclockDto {
  @IsNumber()
  @IsIn([1.2, 1.5, 2.0])
  level: number;

  @IsNotEmpty()
  @IsIn(['fortune', 'fame'])
  paymentMethod: 'fortune' | 'fame';
}

export interface OverclockLevelInfo {
  level: number;
  bonusPercent: number; // 20, 50, 100
  fortunePrice: number;
  famePrice: number;
}

export interface OverclockInfoResponseDto {
  currentMultiplier: number; // 0 = none, 1.2/1.5/2.0 = active
  isActive: boolean;
  canPurchase: boolean;
  levels: OverclockLevelInfo[];
}

export interface PurchaseOverclockResponseDto {
  machine: any; // MachineResponseDto
  level: number;
  cost: number;
  paymentMethod: 'fortune' | 'fame';
  user: {
    fortuneBalance: string;
  };
}
