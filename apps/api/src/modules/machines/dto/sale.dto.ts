import { MachineResponseDto } from './machine.dto';

// ===== AUCTION DTOs =====

export interface AuctionInfoResponseDto {
  canList: boolean;
  reason?: string;
  wearPercent: number;
  commissionRate: number;
  expectedPayout: number;
  tierPrice: number;
  queuePosition?: number;
  queueLength: number;
}

export interface ListOnAuctionResponseDto {
  listing: {
    id: string;
    machineId: string;
    tier: number;
    wearPercent: number;
    commissionRate: number;
    expectedPayout: number;
    status: string;
    createdAt: Date;
  };
  machine: MachineResponseDto;
}

export interface CancelAuctionResponseDto {
  listing: {
    id: string;
    machineId: string;
    status: string;
  };
  machine: MachineResponseDto;
}

export interface AuctionQueueResponseDto {
  tier: number;
  queueLength: number;
  oldestListing?: {
    id: string;
    createdAt: Date;
    wearPercent: number;
    hasUpgrades: boolean;
  };
}

export interface UserListingsResponseDto {
  listings: Array<{
    id: string;
    machineId: string;
    tier: number;
    wearPercent: number;
    commissionRate: number;
    expectedPayout: number;
    status: string;
    queuePosition: number;
    createdAt: Date;
  }>;
}

// ===== PAWNSHOP DTOs =====

export interface PawnshopInfoResponseDto {
  canSell: boolean;
  reason?: string;
  tierPrice: number;
  collectedProfit: number;
  coinBoxCurrent: number;
  commissionRate: number;
  commissionAmount: number;
  expectedPayout: number;
  totalOnHand: number; // What player will have after sale
}

export interface PawnshopSaleResponseDto {
  machine: MachineResponseDto;
  tierPrice: number;
  collectedProfit: number;
  commissionRate: number;
  commissionAmount: number;
  payout: number;
  totalOnHand: number;
  user: {
    fortuneBalance: string;
  };
}

// ===== COMBINED SALE OPTIONS DTO =====

export interface SaleOptionsResponseDto {
  auction: AuctionInfoResponseDto;
  pawnshop: PawnshopInfoResponseDto;
  recommendation: 'auction' | 'pawnshop' | 'wait';
  recommendationReasonCode: string;
  recommendationReasonParams: Record<string, string | number>;
}
