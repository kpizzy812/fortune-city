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
  solscanUrl: string;
}

export interface ClaimInfoResponseDto {
  programId: string;
  vaultAddress: string;
  authorityAddress: string;
  usdtMint: string;
  vaultTokenAccount: string;
}

export interface WithdrawalRequestResponseDto {
  vault: string;
  user: string;
  amount: number;
  createdAt: string;
  expiresAt: string;
  pdaAddress: string;
}
