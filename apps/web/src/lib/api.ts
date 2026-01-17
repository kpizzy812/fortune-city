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

  // ============================================
  // Withdrawals endpoints
  // ============================================

  /**
   * Preview withdrawal with tax calculation
   */
  async previewWithdrawal(
    token: string,
    amount: number,
  ): Promise<WithdrawalPreviewData> {
    return this.request<WithdrawalPreviewData>(
      `/withdrawals/preview?amount=${amount}`,
      { token },
    );
  }

  /**
   * Prepare atomic withdrawal (wallet_connect method)
   * Returns partially signed transaction for user to sign
   */
  async prepareAtomicWithdrawal(
    token: string,
    amount: number,
    walletAddress: string,
  ): Promise<PreparedAtomicWithdrawalData> {
    return this.request<PreparedAtomicWithdrawalData>('/withdrawals/prepare-atomic', {
      method: 'POST',
      token,
      body: JSON.stringify({ amount, walletAddress }),
    });
  }

  /**
   * Confirm atomic withdrawal after user signs and sends tx
   */
  async confirmAtomicWithdrawal(
    token: string,
    withdrawalId: string,
    txSignature: string,
  ): Promise<WithdrawalData> {
    return this.request<WithdrawalData>('/withdrawals/confirm-atomic', {
      method: 'POST',
      token,
      body: JSON.stringify({ withdrawalId, txSignature }),
    });
  }

  /**
   * Cancel pending atomic withdrawal
   */
  async cancelAtomicWithdrawal(
    token: string,
    withdrawalId: string,
  ): Promise<WithdrawalData> {
    return this.request<WithdrawalData>(`/withdrawals/cancel/${withdrawalId}`, {
      method: 'POST',
      token,
    });
  }

  /**
   * Create instant withdrawal (manual_address method)
   * Hot wallet sends USDT directly to specified address
   */
  async createInstantWithdrawal(
    token: string,
    amount: number,
    walletAddress: string,
  ): Promise<InstantWithdrawalData> {
    return this.request<InstantWithdrawalData>('/withdrawals/instant', {
      method: 'POST',
      token,
      body: JSON.stringify({ amount, walletAddress, method: 'manual_address' }),
    });
  }

  /**
   * Get user's withdrawal history
   */
  async getWithdrawals(
    token: string,
    limit = 20,
    offset = 0,
  ): Promise<WithdrawalData[]> {
    return this.request<WithdrawalData[]>(
      `/withdrawals?limit=${limit}&offset=${offset}`,
      { token },
    );
  }

  /**
   * Get single withdrawal by ID
   */
  async getWithdrawalById(token: string, id: string): Promise<WithdrawalData> {
    return this.request<WithdrawalData>(`/withdrawals/${id}`, { token });
  }

  // ============================================
  // Admin endpoints
  // ============================================

  /**
   * Admin login with username/password
   */
  async adminLogin(username: string, password: string): Promise<AdminAuthResponse> {
    return this.request<AdminAuthResponse>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  /**
   * Get current admin session
   */
  async adminGetMe(token: string): Promise<AdminMeResponse> {
    return this.request<AdminMeResponse>('/admin/auth/me', { token });
  }

  /**
   * Get admin dashboard stats
   */
  async adminGetDashboardStats(token: string): Promise<AdminDashboardStats> {
    return this.request<AdminDashboardStats>('/admin/dashboard/stats', { token });
  }

  // ============================================
  // Admin Tiers endpoints
  // ============================================

  /**
   * Get all tiers (including hidden)
   */
  async adminGetAllTiers(token: string): Promise<AdminTierResponse[]> {
    return this.request<AdminTierResponse[]>('/admin/tiers', { token });
  }

  /**
   * Get tier statistics
   */
  async adminGetTierStats(token: string): Promise<AdminTierStats> {
    return this.request<AdminTierStats>('/admin/tiers/stats', { token });
  }

  /**
   * Get a single tier by number
   */
  async adminGetTier(token: string, tier: number): Promise<AdminTierResponse> {
    return this.request<AdminTierResponse>(`/admin/tiers/${tier}`, { token });
  }

  /**
   * Create a new tier
   */
  async adminCreateTier(
    token: string,
    data: CreateTierRequest,
  ): Promise<AdminTierResponse> {
    return this.request<AdminTierResponse>('/admin/tiers', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing tier
   */
  async adminUpdateTier(
    token: string,
    tier: number,
    data: UpdateTierRequest,
  ): Promise<AdminTierResponse> {
    return this.request<AdminTierResponse>(`/admin/tiers/${tier}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a tier
   */
  async adminDeleteTier(
    token: string,
    tier: number,
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      `/admin/tiers/${tier}`,
      { method: 'DELETE', token },
    );
  }

  /**
   * Update tier visibility
   */
  async adminUpdateTierVisibility(
    token: string,
    tier: number,
    isVisible: boolean,
  ): Promise<AdminTierResponse> {
    return this.request<AdminTierResponse>(`/admin/tiers/${tier}/visibility`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ isVisible }),
    });
  }

  /**
   * Update tier public availability
   */
  async adminUpdateTierAvailability(
    token: string,
    tier: number,
    isPubliclyAvailable: boolean,
  ): Promise<AdminTierResponse> {
    return this.request<AdminTierResponse>(`/admin/tiers/${tier}/availability`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ isPubliclyAvailable }),
    });
  }

  // ============================================
  // Admin Settings endpoints
  // ============================================

  /**
   * Get all system settings
   */
  async adminGetSettings(token: string): Promise<AdminSettingsResponse> {
    return this.request<AdminSettingsResponse>('/admin/settings', { token });
  }

  /**
   * Update system settings
   */
  async adminUpdateSettings(
    token: string,
    data: UpdateSettingsRequest,
  ): Promise<AdminSettingsResponse> {
    return this.request<AdminSettingsResponse>('/admin/settings', {
      method: 'PUT',
      token,
      body: JSON.stringify(data),
    });
  }

  /**
   * Reset settings to defaults
   */
  async adminResetSettings(token: string): Promise<AdminSettingsResponse> {
    return this.request<AdminSettingsResponse>('/admin/settings/reset', {
      method: 'POST',
      token,
    });
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

// ============================================
// Withdrawals Types
// ============================================

export type WithdrawalStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type WithdrawalMethod = 'wallet_connect' | 'manual_address';

export interface WithdrawalPreviewData {
  requestedAmount: number;
  fromFreshDeposit: number;
  fromProfit: number;
  taxRate: number;
  taxAmount: number;
  netAmount: number;
  usdtAmount: number;
  feeSol: number;
}

export interface PreparedAtomicWithdrawalData {
  withdrawalId: string;
  serializedTransaction: string; // Base64 encoded, partially signed
  requestedAmount: number;
  netAmount: number;
  usdtAmount: number;
  taxAmount: number;
  feeSol: number;
  recipientAddress: string;
}

export interface WithdrawalData {
  id: string;
  status: WithdrawalStatus;
  method: WithdrawalMethod;
  requestedAmount: number;
  netAmount: number;
  usdtAmount: number;
  taxAmount: number;
  txSignature: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface InstantWithdrawalData {
  id: string;
  status: string;
  txSignature: string;
  requestedAmount: number;
  netAmount: number;
  usdtAmount: number;
}

// ============================================
// Admin Types
// ============================================

export interface AdminAuthResponse {
  accessToken: string;
  admin: {
    username: string;
  };
}

export interface AdminMeResponse {
  admin: {
    username: string;
  };
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalMachines: number;
  activeMachines: number;
  totalDeposits: number;
  totalDepositsAmount: number;
  totalWithdrawals: number;
  totalWithdrawalsAmount: number;
  pendingWithdrawals: number;
}

// ============================================
// Admin Tiers Types
// ============================================

export interface AdminTierResponse {
  id: string;
  tier: number;
  name: string;
  emoji: string;
  price: number;
  lifespanDays: number;
  yieldPercent: number;
  imageUrl: string | null;
  isVisible: boolean;
  isPubliclyAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTierStats {
  total: number;
  visible: number;
  hidden: number;
  publiclyAvailable: number;
}

export interface CreateTierRequest {
  tier: number;
  name: string;
  emoji: string;
  price: number;
  lifespanDays: number;
  yieldPercent: number;
  imageUrl?: string;
  isVisible?: boolean;
  isPubliclyAvailable?: boolean;
  sortOrder?: number;
}

export interface UpdateTierRequest {
  name?: string;
  emoji?: string;
  price?: number;
  lifespanDays?: number;
  yieldPercent?: number;
  imageUrl?: string;
  isVisible?: boolean;
  isPubliclyAvailable?: boolean;
  sortOrder?: number;
}

// ============================================
// Admin Settings Types
// ============================================

export interface GambleLevel {
  level: number;
  winChance: number;
  costPercent: number;
}

export interface CoinBoxLevel {
  level: number;
  capacityHours: number;
  costPercent: number;
}

export interface AdminSettingsResponse {
  id: string;
  maxGlobalTier: number;
  minDepositAmounts: Record<string, number>;
  minWithdrawalAmount: number;
  walletConnectFeeSol: number;
  pawnshopCommission: number;
  taxRatesByTier: Record<string, number>;
  referralRates: Record<string, number>;
  reinvestReduction: Record<string, number>;
  auctionCommissions: Record<string, number>;
  earlySellCommissions: Record<string, number>;
  gambleWinMultiplier: number;
  gambleLoseMultiplier: number;
  gambleLevels: GambleLevel[];
  coinBoxLevels: CoinBoxLevel[];
  autoCollectCostPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSettingsRequest {
  maxGlobalTier?: number;
  minDepositAmounts?: Record<string, number>;
  minWithdrawalAmount?: number;
  walletConnectFeeSol?: number;
  pawnshopCommission?: number;
  taxRatesByTier?: Record<string, number>;
  referralRates?: Record<string, number>;
  reinvestReduction?: Record<string, number>;
  auctionCommissions?: Record<string, number>;
  earlySellCommissions?: Record<string, number>;
  gambleWinMultiplier?: number;
  gambleLoseMultiplier?: number;
  gambleLevels?: GambleLevel[];
  coinBoxLevels?: CoinBoxLevel[];
  autoCollectCostPercent?: number;
}
