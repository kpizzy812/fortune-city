export interface ActivityItem {
  type: 'machine_purchase' | 'withdrawal' | 'wheel_win' | 'jackpot';
  username: string;
  amount: number;
  tier?: number;
  multiplier?: string;
  createdAt: string;
}
