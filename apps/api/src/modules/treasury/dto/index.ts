export interface VaultInfoResponseDto {
  vaultAddress: string;
  authority: string;
  payoutWallet: string;
  usdtMint: string;
  /** Actual on-chain token balance (USD) */
  currentBalance: number;
  /** Total deposited historically (USD) */
  totalDeposited: number;
  /** Total paid out historically (USD) */
  totalPaidOut: number;
  depositCount: number;
  payoutCount: number;
  lastDepositAt: string | null;
  lastPayoutAt: string | null;
  paused: boolean;
  solscanUrl: string;
}
