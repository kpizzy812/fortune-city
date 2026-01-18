export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'machine_purchase'
  | 'machine_income'
  | 'machine_early_sell'
  | 'referral_bonus'
  | 'wheel_prize'
  | 'upgrade_purchase'
  | 'collector_hire'
  | 'collector_salary'
  | 'machine_auction_list'
  | 'machine_auction_cancel'
  | 'machine_auction_sale';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export type Currency = 'FORTUNE' | 'USDT';

export interface Transaction {
  id: string;
  userId: string;
  machineId?: string;

  type: TransactionType;
  amount: number;
  currency: Currency;

  // Tax info
  taxAmount: number;
  taxRate: number;
  netAmount: number;

  // Source tracking
  fromFreshUsdt: number;
  fromProfit: number;

  // Blockchain (for deposits/withdrawals)
  chain?: string;
  txHash?: string;

  status: TransactionStatus;

  createdAt: Date;
  updatedAt: Date;
}
