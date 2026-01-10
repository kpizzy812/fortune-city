export interface User {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;

  // Balances
  fortuneBalance: number;  // In-game currency
  usdtBalance: number;     // Withdrawable

  // Progression
  maxTierReached: number;
  currentTaxRate: number;

  // Referral
  referralCode: string;
  referredById?: string;

  // Wheel
  freeSpinsRemaining: number;
  lastSpinAt?: Date;

  // Wallet addresses per chain
  walletAddresses: WalletAddresses;

  createdAt: Date;
  updatedAt: Date;
}

export interface WalletAddresses {
  ton?: string;
  solana?: string;
  bsc?: string;
  tron?: string;
}

export type Chain = 'ton' | 'solana' | 'bsc' | 'tron';

export interface UserStats {
  totalMachines: number;
  activeMachines: number;
  totalEarned: number;
  totalWithdrawn: number;
  referralEarnings: number;
}
