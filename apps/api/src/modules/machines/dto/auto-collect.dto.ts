import { IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class PurchaseAutoCollectDto {
  @IsOptional()
  @IsIn(['fortune', 'fame'])
  paymentMethod?: 'fortune' | 'fame';
}

// Response DTOs
export class AutoCollectInfoResponseDto {
  @IsNotEmpty()
  enabled: boolean;

  @IsNotEmpty()
  hireCost: number;

  @IsNotEmpty()
  hireCostFame: number;

  @IsNotEmpty()
  salaryPercent: number;

  purchasedAt: Date | null;

  @IsNotEmpty()
  canPurchase: boolean;

  @IsNotEmpty()
  alreadyPurchased: boolean;
}

export class PurchaseAutoCollectResponseDto {
  @IsNotEmpty()
  machine: any; // MachineResponseDto

  @IsNotEmpty()
  cost: number;

  @IsNotEmpty()
  paymentMethod: 'fortune' | 'fame';

  @IsNotEmpty()
  user: {
    fortuneBalance: string;
  };

  @IsNotEmpty()
  newBalance: number;
}
