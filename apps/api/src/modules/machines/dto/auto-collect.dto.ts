import { IsNotEmpty } from 'class-validator';

// Response DTOs
export class AutoCollectInfoResponseDto {
  @IsNotEmpty()
  enabled: boolean;

  @IsNotEmpty()
  hireCost: number; // Fixed $5 hire cost

  @IsNotEmpty()
  salaryPercent: number; // 5% of each collection

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
  user: {
    fortuneBalance: string;
  };

  @IsNotEmpty()
  newBalance: number;
}
