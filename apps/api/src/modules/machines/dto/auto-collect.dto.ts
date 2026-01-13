import { IsNotEmpty } from 'class-validator';

// Response DTOs
export class AutoCollectInfoResponseDto {
  @IsNotEmpty()
  enabled: boolean;

  @IsNotEmpty()
  cost: number;

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
