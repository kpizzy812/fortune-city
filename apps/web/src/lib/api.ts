import type {
  TierInfo,
  Machine,
  MachineIncome,
  CollectResult,
  RiskyCollectResult,
  GambleInfo,
  UpgradeGambleResult,
  CoinBoxInfo,
  UpgradeCoinBoxResult,
  AutoCollectInfo,
  PurchaseAutoCollectResult,
  CanAffordResponse,
  PurchaseResult,
  Transaction,
  SaleOptions,
  ListOnAuctionResult,
  CancelAuctionResult,
  PawnshopSaleResult,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FetchOptions extends RequestInit {
  token?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: FetchOptions = {},
  ): Promise<T> {
    const { token, ...fetchOptions } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // ============================================
  // Auth endpoints
  // ============================================

  async authWithInitData(initData: string, referralCode?: string) {
    return this.request<AuthResponse>('/auth/telegram/init-data', {
      method: 'POST',
      body: JSON.stringify({ initData, referralCode }),
    });
  }

  async authWithLoginWidget(data: TelegramLoginWidgetData, referralCode?: string) {
    return this.request<AuthResponse>('/auth/telegram/login-widget', {
      method: 'POST',
      body: JSON.stringify({ ...data, referralCode }),
    });
  }

  async getMe(token: string) {
    return this.request<UserData>('/auth/me', { token });
  }

  async devLogin() {
    return this.request<AuthResponse>('/auth/dev-login', {
      method: 'POST',
    });
  }

  // ============================================
  // Tiers endpoints
  // ============================================

  async getTiers(): Promise<TierInfo[]> {
    return this.request<TierInfo[]>('/machines/tiers');
  }

  async getTierById(tier: number): Promise<TierInfo | null> {
    return this.request<TierInfo | null>(`/machines/tiers/${tier}`);
  }

  // ============================================
  // Machines endpoints
  // ============================================

  async getMachines(token: string, status?: string): Promise<Machine[]> {
    const query = status ? `?status=${status}` : '';
    return this.request<Machine[]>(`/machines${query}`, { token });
  }

  async getActiveMachines(token: string): Promise<Machine[]> {
    return this.request<Machine[]>('/machines/active', { token });
  }

  async getMachineById(token: string, machineId: string): Promise<Machine> {
    return this.request<Machine>(`/machines/${machineId}`, { token });
  }

  async getMachineIncome(token: string, machineId: string): Promise<MachineIncome> {
    return this.request<MachineIncome>(`/machines/${machineId}/income`, { token });
  }

  async collectCoins(token: string, machineId: string): Promise<CollectResult> {
    return this.request<CollectResult>(`/machines/${machineId}/collect`, {
      token,
      method: 'POST',
    });
  }

  async collectCoinsRisky(token: string, machineId: string): Promise<RiskyCollectResult> {
    return this.request<RiskyCollectResult>(`/machines/${machineId}/collect-risky`, {
      token,
      method: 'POST',
    });
  }

  async getGambleInfo(token: string, machineId: string): Promise<GambleInfo> {
    return this.request<GambleInfo>(`/machines/${machineId}/gamble-info`, { token });
  }

  async upgradeFortuneGamble(token: string, machineId: string): Promise<UpgradeGambleResult> {
    return this.request<UpgradeGambleResult>(`/machines/${machineId}/upgrade-gamble`, {
      token,
      method: 'POST',
    });
  }

  async getCoinBoxInfo(token: string, machineId: string): Promise<CoinBoxInfo> {
    return this.request<CoinBoxInfo>(`/machines/${machineId}/coinbox-info`, { token });
  }

  async upgradeCoinBox(token: string, machineId: string): Promise<UpgradeCoinBoxResult> {
    return this.request<UpgradeCoinBoxResult>(`/machines/${machineId}/upgrade-coinbox`, {
      token,
      method: 'POST',
    });
  }

  async getAutoCollectInfo(token: string, machineId: string): Promise<AutoCollectInfo> {
    return this.request<AutoCollectInfo>(`/machines/${machineId}/auto-collect-info`, { token });
  }

  async purchaseAutoCollect(token: string, machineId: string): Promise<PurchaseAutoCollectResult> {
    return this.request<PurchaseAutoCollectResult>(`/machines/${machineId}/purchase-auto-collect`, {
      token,
      method: 'POST',
    });
  }

  // ============================================
  // Sale endpoints (Auction & Pawnshop)
  // ============================================

  async getSaleOptions(token: string, machineId: string): Promise<SaleOptions> {
    return this.request<SaleOptions>(`/machines/${machineId}/sale-options`, { token });
  }

  async listOnAuction(token: string, machineId: string): Promise<ListOnAuctionResult> {
    return this.request<ListOnAuctionResult>(`/machines/${machineId}/list-auction`, {
      token,
      method: 'POST',
    });
  }

  async cancelAuction(token: string, machineId: string): Promise<CancelAuctionResult> {
    return this.request<CancelAuctionResult>(`/machines/${machineId}/cancel-auction`, {
      token,
      method: 'POST',
    });
  }

  async sellToPawnshop(token: string, machineId: string): Promise<PawnshopSaleResult> {
    return this.request<PawnshopSaleResult>(`/machines/${machineId}/sell-pawnshop`, {
      token,
      method: 'POST',
    });
  }

  // ============================================
  // Economy endpoints
  // ============================================

  async canAfford(token: string, tier: number): Promise<CanAffordResponse> {
    return this.request<CanAffordResponse>(`/economy/can-afford/${tier}`, { token });
  }

  async purchaseMachine(
    token: string,
    tier: number,
    reinvestRound?: number
  ): Promise<PurchaseResult> {
    return this.request<PurchaseResult>('/economy/purchase', {
      token,
      method: 'POST',
      body: JSON.stringify({ tier, reinvestRound }),
    });
  }

  async getTransactions(
    token: string,
    limit = 50,
    offset = 0
  ): Promise<Transaction[]> {
    return this.request<Transaction[]>(
      `/economy/transactions?limit=${limit}&offset=${offset}`,
      { token }
    );
  }

  async getTransactionStats(token: string): Promise<{
    totalDeposits: number;
    totalWithdrawals: number;
    totalMachinesPurchased: number;
    totalEarnings: number;
  }> {
    return this.request(`/economy/transactions/stats`, { token });
  }

  // ============================================
  // Referral endpoints
  // ============================================

  async getReferralStats(token: string): Promise<ReferralStats> {
    return this.request<ReferralStats>('/referrals/stats', { token });
  }

  async getReferralList(
    token: string,
    limit = 50,
    offset = 0
  ): Promise<ReferralListItem[]> {
    return this.request<ReferralListItem[]>(
      `/referrals/list?limit=${limit}&offset=${offset}`,
      { token }
    );
  }

  async canWithdrawReferralBalance(token: string): Promise<{ canWithdraw: boolean }> {
    return this.request<{ canWithdraw: boolean }>('/referrals/can-withdraw', { token });
  }

  async withdrawReferralBalance(
    token: string,
    amount?: number
  ): Promise<WithdrawReferralResult> {
    return this.request<WithdrawReferralResult>('/referrals/withdraw', {
      token,
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async setReferrer(token: string, referralCode: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/referrals/set-referrer', {
      token,
      method: 'POST',
      body: JSON.stringify({ referralCode }),
    });
  }

  // ============================================
  // Fortune Rate endpoints
  // ============================================

  async getFortuneRate(): Promise<FortuneRateResponse> {
    return this.request<FortuneRateResponse>('/fortune-rate');
  }

  // ============================================
  // Deposits endpoints
  // ============================================

  async connectWallet(
    token: string,
    walletAddress: string,
  ): Promise<{ connected: boolean }> {
    return this.request<{ connected: boolean }>('/deposits/wallet-connect', {
      method: 'POST',
      token,
      body: JSON.stringify({ walletAddress }),
    });
  }

  async getConnectedWallet(token: string): Promise<WalletConnectionData | null> {
    const result = await this.request<{ wallet: WalletConnectionData | null }>(
      '/deposits/wallet',
      { token },
    );
    return result.wallet;
  }

  async initiateDeposit(
    token: string,
    data: InitiateDepositRequest,
  ): Promise<InitiateDepositResponse> {
    return this.request<InitiateDepositResponse>('/deposits/initiate', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  }

  async confirmDeposit(
    token: string,
    depositId: string,
    txSignature: string,
  ): Promise<{ status: string }> {
    return this.request<{ status: string }>('/deposits/confirm', {
      method: 'POST',
      token,
      body: JSON.stringify({ depositId, txSignature }),
    });
  }

  async getDepositAddress(token: string): Promise<DepositAddressResponse> {
    return this.request<DepositAddressResponse>('/deposits/address', { token });
  }

  async getDeposits(token: string): Promise<DepositData[]> {
    return this.request<DepositData[]>('/deposits', { token });
  }

  async getDepositRates(): Promise<DepositRatesResponse> {
    return this.request<DepositRatesResponse>('/deposits/rates');
  }
}

export const api = new ApiClient(API_URL);

// ============================================
// Types (keep for backward compatibility)
// ============================================

export interface UserData {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  fortuneBalance: string;
  referralBalance: string;
  maxTierReached: number;
  currentTaxRate: string;
  referralCode: string;
}

export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  byLevel: {
    level: number;
    count: number;
    earned: number;
  }[];
  totalEarned: number;
  referralBalance: number;
  referralCode: string;
}

export interface ReferralListItem {
  id: string;
  username: string | null;
  firstName: string | null;
  level: number;
  isActive: boolean;
  totalContributed: number;
  joinedAt: string;
}

export interface WithdrawReferralResult {
  success: boolean;
  newFortuneBalance: number;
  newReferralBalance: number;
}

export interface AuthResponse {
  accessToken: string;
  user: UserData;
}

export interface TelegramLoginWidgetData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface FortuneRateData {
  priceInSol: number;
  priceInUsd: number;
  fortunePerUsd: number | null;
  marketCapSol: number;
  marketCapUsd: number;
  solPriceUsd: number;
  updatedAt: string;
  source: 'pumpportal';
}

export interface FortuneRateResponse {
  success: boolean;
  data: FortuneRateData | null;
}

// ============================================
// Deposits Types
// ============================================

export type DepositCurrency = 'SOL' | 'USDT_SOL' | 'FORTUNE';
export type DepositStatus =
  | 'pending'
  | 'confirmed'
  | 'credited'
  | 'failed'
  | 'expired';

export interface WalletConnectionData {
  id: string;
  userId: string;
  chain: string;
  walletAddress: string;
  connectedAt: string;
}

export interface InitiateDepositRequest {
  currency: DepositCurrency;
  amount: number;
  walletAddress: string;
}

export interface InitiateDepositResponse {
  depositId: string;
  memo: string;
  recipientAddress: string;
  amount: number;
  currency: DepositCurrency;
}

export interface DepositAddressResponse {
  address: string;
  qrCode: string;
  minDeposit: number;
}

export interface DepositData {
  id: string;
  userId: string;
  method: 'wallet_connect' | 'deposit_address';
  chain: string;
  currency: DepositCurrency;
  txSignature: string;
  amount: string;
  amountUsd: string;
  rateToUsd: string | null;
  memo: string | null;
  status: DepositStatus;
  slot: string | null;
  confirmedAt: string | null;
  creditedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepositRatesResponse {
  sol: number;
  fortune: number;
  usdt: number;
}
