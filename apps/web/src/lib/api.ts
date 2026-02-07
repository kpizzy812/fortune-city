import type {
  TierInfo,
  Machine,
  MachineIncome,
  CollectResult,
  RiskyCollectResult,
  GambleInfo,
  UpgradeGambleResult,
  AutoCollectInfo,
  PurchaseAutoCollectResult,
  CanAffordResponse,
  PurchaseResult,
  Transaction,
  SaleOptions,
  ListOnAuctionResult,
  CancelAuctionResult,
  PawnshopSaleResult,
  OtherCryptoNetwork,
  OtherCryptoInstructions,
  InitiateOtherCryptoDepositRequest,
  OtherCryptoDepositResponse,
  Notification,
  GetNotificationsResponse,
  NotificationFilters,
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

  async authWithInitData(initData: string, referralCode?: string, rememberMe?: boolean) {
    return this.request<AuthResponse>('/auth/telegram/init-data', {
      method: 'POST',
      body: JSON.stringify({ initData, referralCode, rememberMe }),
    });
  }

  async authWithLoginWidget(data: TelegramLoginWidgetData, referralCode?: string, rememberMe?: boolean) {
    return this.request<AuthResponse>('/auth/telegram/login-widget', {
      method: 'POST',
      body: JSON.stringify({ ...data, referralCode, rememberMe }),
    });
  }

  async getMe(token: string) {
    return this.request<UserData>('/auth/me', { token });
  }

  async authWithTelegramBotToken(token: string) {
    return this.request<AuthResponse>('/auth/telegram-bot-login', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async devLogin() {
    return this.request<AuthResponse>('/auth/dev-login', {
      method: 'POST',
    });
  }

  async authWithSupabase(accessToken: string, referralCode?: string, rememberMe?: boolean) {
    return this.request<AuthResponse>('/auth/supabase', {
      method: 'POST',
      body: JSON.stringify({ accessToken, referralCode, rememberMe }),
    });
  }

  async refreshToken(refreshToken: string) {
    return this.request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logout(token: string) {
    return this.request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      token,
    });
  }

  async linkTelegram(token: string, data: TelegramLoginWidgetData) {
    return this.request<AuthResponse>('/auth/link-telegram', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  }

  async linkEmail(token: string, supabaseAccessToken: string) {
    return this.request<AuthResponse>('/auth/link-email', {
      method: 'POST',
      token,
      body: JSON.stringify({ accessToken: supabaseAccessToken }),
    });
  }

  async authWithWeb3(accessToken: string, referralCode?: string, rememberMe?: boolean) {
    return this.request<AuthResponse>('/auth/web3', {
      method: 'POST',
      body: JSON.stringify({ accessToken, referralCode, rememberMe }),
    });
  }

  async linkWeb3(token: string, supabaseAccessToken: string) {
    return this.request<AuthResponse>('/auth/link-web3', {
      method: 'POST',
      token,
      body: JSON.stringify({ accessToken: supabaseAccessToken }),
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

  async getReferralMilestones(token: string): Promise<MilestoneProgress> {
    return this.request<MilestoneProgress>('/referrals/milestones', { token });
  }

  async claimReferralMilestone(
    token: string,
    milestoneId: string,
  ): Promise<{ success: boolean; reward: string }> {
    return this.request<{ success: boolean; reward: string }>(
      `/referrals/milestones/${milestoneId}/claim`,
      { token, method: 'POST' },
    );
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

  async getOtherCryptoInstructions(
    network: OtherCryptoNetwork,
  ): Promise<OtherCryptoInstructions> {
    return this.request<OtherCryptoInstructions>(`/deposits/other-crypto/instructions/${network}`);
  }

  async initiateOtherCryptoDeposit(
    token: string,
    data: InitiateOtherCryptoDepositRequest,
  ): Promise<OtherCryptoDepositResponse> {
    return this.request<OtherCryptoDepositResponse>('/deposits/other-crypto', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
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
  async adminLogin(username: string, password: string, rememberMe?: boolean): Promise<AdminAuthResponse> {
    return this.request<AdminAuthResponse>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe }),
    });
  }

  /**
   * Get current admin session
   */
  async adminGetMe(token: string): Promise<AdminMeResponse> {
    return this.request<AdminMeResponse>('/admin/auth/me', { token });
  }

  /**
   * Admin refresh token
   */
  async adminRefreshToken(refreshToken: string): Promise<AdminAuthResponse> {
    return this.request<AdminAuthResponse>('/admin/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  /**
   * Admin logout
   */
  async adminLogout(token: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/admin/auth/logout', {
      method: 'POST',
      token,
    });
  }

  /**
   * Get admin dashboard stats
   */
  async adminGetDashboardStats(token: string): Promise<AdminDashboardStats> {
    return this.request<AdminDashboardStats>('/admin/dashboard/stats', { token });
  }

  /**
   * Get chart data for dashboard
   */
  async adminGetChartData(token: string, days: number = 30): Promise<DashboardChartData> {
    return this.request<DashboardChartData>(`/admin/dashboard/charts?days=${days}`, { token });
  }

  /**
   * Get tier distribution for dashboard
   */
  async adminGetTierDistribution(token: string): Promise<TierDistribution[]> {
    return this.request<TierDistribution[]>('/admin/dashboard/tier-distribution', { token });
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

  // ============================================
  // Admin Users endpoints
  // ============================================

  /**
   * Get paginated list of users with filters
   */
  async adminGetUsers(
    token: string,
    filters?: AdminUsersFilter,
  ): Promise<AdminUsersListResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<AdminUsersListResponse>(`/admin/users${query}`, { token });
  }

  /**
   * Get users statistics
   */
  async adminGetUsersStats(token: string): Promise<AdminUsersStatsResponse> {
    return this.request<AdminUsersStatsResponse>('/admin/users/stats', { token });
  }

  /**
   * Get detailed user information
   */
  async adminGetUser(token: string, userId: string): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>(`/admin/users/${userId}`, { token });
  }

  /**
   * Get user's referral tree (3 levels)
   */
  async adminGetReferralTree(
    token: string,
    userId: string,
  ): Promise<ReferralTreeResponse> {
    return this.request<ReferralTreeResponse>(
      `/admin/users/${userId}/referral-tree`,
      { token },
    );
  }

  /**
   * Ban a user
   */
  async adminBanUser(
    token: string,
    userId: string,
    reason: string,
  ): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>(`/admin/users/${userId}/ban`, {
      method: 'POST',
      token,
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Unban a user
   */
  async adminUnbanUser(
    token: string,
    userId: string,
    note?: string,
  ): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>(`/admin/users/${userId}/unban`, {
      method: 'POST',
      token,
      body: JSON.stringify({ note }),
    });
  }

  /**
   * Update user balance (set exact value)
   */
  async adminUpdateBalance(
    token: string,
    userId: string,
    data: { fortuneBalance?: number; referralBalance?: number },
  ): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>(`/admin/users/${userId}/balance`, {
      method: 'PUT',
      token,
      body: JSON.stringify(data),
    });
  }

  /**
   * Adjust user balance (add/subtract/set)
   */
  async adminAdjustBalance(
    token: string,
    userId: string,
    data: {
      operation: 'add' | 'subtract' | 'set';
      fortuneAmount?: number;
      referralAmount?: number;
      reason?: string;
    },
  ): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>(`/admin/users/${userId}/adjust-balance`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  }

  /**
   * Update user referrer
   */
  async adminUpdateReferrer(
    token: string,
    userId: string,
    data: { referredById?: string | null },
  ): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>(`/admin/users/${userId}/referrer`, {
      method: 'PUT',
      token,
      body: JSON.stringify(data),
    });
  }

  /**
   * Update user free spins
   */
  async adminUpdateFreeSpins(
    token: string,
    userId: string,
    data: { freeSpinsRemaining: number },
  ): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>(`/admin/users/${userId}/free-spins`, {
      method: 'PUT',
      token,
      body: JSON.stringify(data),
    });
  }

  /**
   * Add machine to user (admin gift/compensation)
   */
  async adminAddMachine(
    token: string,
    userId: string,
    data: { tier: number; reinvestRound?: number; reason?: string },
  ): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>(`/admin/users/${userId}/machines`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete machine (without returning coinBox balance)
   */
  async adminDeleteMachine(
    token: string,
    userId: string,
    machineId: string,
    data?: { reason?: string },
  ): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>(`/admin/users/${userId}/machines/${machineId}`, {
      method: 'DELETE',
      token,
      body: JSON.stringify(data || {}),
    });
  }

  /**
   * Extend machine lifespan
   */
  async adminExtendMachineLifespan(
    token: string,
    userId: string,
    machineId: string,
    data: { daysToAdd: number; reason?: string },
  ): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>(`/admin/users/${userId}/machines/${machineId}/extend`, {
      method: 'PUT',
      token,
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // Admin Withdrawals endpoints
  // ============================================

  /**
   * Get paginated list of withdrawals with filters
   */
  async adminGetWithdrawals(
    token: string,
    filters?: AdminWithdrawalsFilter,
  ): Promise<AdminWithdrawalsListResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<AdminWithdrawalsListResponse>(`/admin/withdrawals${query}`, { token });
  }

  /**
   * Get withdrawals statistics
   */
  async adminGetWithdrawalsStats(token: string): Promise<AdminWithdrawalsStatsResponse> {
    return this.request<AdminWithdrawalsStatsResponse>('/admin/withdrawals/stats', { token });
  }

  /**
   * Get detailed withdrawal information
   */
  async adminGetWithdrawal(token: string, id: string): Promise<AdminWithdrawalDetail> {
    return this.request<AdminWithdrawalDetail>(`/admin/withdrawals/${id}`, { token });
  }

  /**
   * Approve a pending withdrawal
   */
  async adminApproveWithdrawal(
    token: string,
    id: string,
    note?: string,
  ): Promise<AdminWithdrawalDetail> {
    return this.request<AdminWithdrawalDetail>(`/admin/withdrawals/${id}/approve`, {
      method: 'POST',
      token,
      body: JSON.stringify({ note }),
    });
  }

  /**
   * Complete a withdrawal with tx signature
   */
  async adminCompleteWithdrawal(
    token: string,
    id: string,
    txSignature: string,
    note?: string,
  ): Promise<AdminWithdrawalDetail> {
    return this.request<AdminWithdrawalDetail>(`/admin/withdrawals/${id}/complete`, {
      method: 'POST',
      token,
      body: JSON.stringify({ txSignature, note }),
    });
  }

  /**
   * Reject a withdrawal
   */
  async adminRejectWithdrawal(
    token: string,
    id: string,
    reason: string,
  ): Promise<AdminWithdrawalDetail> {
    return this.request<AdminWithdrawalDetail>(`/admin/withdrawals/${id}/reject`, {
      method: 'POST',
      token,
      body: JSON.stringify({ reason }),
    });
  }

  // ============================================
  // Admin Deposits endpoints
  // ============================================

  /**
   * Get paginated list of deposits with filters
   */
  async adminGetDeposits(
    token: string,
    filters?: AdminDepositsFilter,
  ): Promise<AdminDepositsListResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<AdminDepositsListResponse>(`/admin/deposits${query}`, { token });
  }

  /**
   * Get deposits statistics
   */
  async adminGetDepositsStats(token: string): Promise<AdminDepositsStatsResponse> {
    return this.request<AdminDepositsStatsResponse>('/admin/deposits/stats', { token });
  }

  /**
   * Get detailed deposit information
   */
  async adminGetDeposit(token: string, id: string): Promise<AdminDepositDetail> {
    return this.request<AdminDepositDetail>(`/admin/deposits/${id}`, { token });
  }

  /**
   * Manually credit a failed deposit
   */
  async adminCreditDeposit(
    token: string,
    id: string,
    reason: string,
  ): Promise<AdminDepositDetail> {
    return this.request<AdminDepositDetail>(`/admin/deposits/${id}/credit`, {
      method: 'POST',
      token,
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Retry a failed deposit
   */
  async adminRetryDeposit(
    token: string,
    id: string,
    note?: string,
  ): Promise<AdminDepositDetail> {
    return this.request<AdminDepositDetail>(`/admin/deposits/${id}/retry`, {
      method: 'POST',
      token,
      body: JSON.stringify({ note }),
    });
  }

  /**
   * Approve other crypto deposit with actual amount
   */
  async adminApproveOtherCryptoDeposit(
    token: string,
    id: string,
    data: { actualAmount: number; notes?: string },
  ): Promise<AdminDepositDetail> {
    return this.request<AdminDepositDetail>(`/admin/deposits/${id}/approve-other-crypto`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  }

  /**
   * Reject other crypto deposit with reason
   */
  async adminRejectOtherCryptoDeposit(
    token: string,
    id: string,
    data: { reason: string },
  ): Promise<AdminDepositDetail> {
    return this.request<AdminDepositDetail>(`/admin/deposits/${id}/reject-other-crypto`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // Admin Audit endpoints
  // ============================================

  /**
   * Get paginated list of audit logs
   */
  async adminGetAuditLogs(
    token: string,
    filters?: AdminAuditFilter,
  ): Promise<AdminAuditListResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<AdminAuditListResponse>(`/admin/audit${query}`, { token });
  }

  /**
   * Get audit statistics
   */
  async adminGetAuditStats(token: string): Promise<AdminAuditStatsResponse> {
    return this.request<AdminAuditStatsResponse>('/admin/audit/stats', { token });
  }

  /**
   * Get audit history for a specific resource
   */
  async adminGetResourceHistory(
    token: string,
    resource: string,
    resourceId: string,
  ): Promise<AdminAuditLogItem[]> {
    return this.request<AdminAuditLogItem[]>(
      `/admin/audit/resource/${resource}/${resourceId}`,
      { token },
    );
  }

  // ============================================
  // Fortune Wheel endpoints
  // ============================================

  /**
   * Spin the wheel (1x/5x/10x/25x/50x)
   */
  async wheelSpin(token: string, multiplier: WheelMultiplier): Promise<WheelSpinResponse> {
    return this.request<WheelSpinResponse>('/wheel/spin', {
      method: 'POST',
      token,
      body: JSON.stringify({ multiplier }),
    });
  }

  /**
   * Get current wheel state (jackpot, sectors, free spins)
   */
  async getWheelState(token: string): Promise<WheelStateResponse> {
    return this.request<WheelStateResponse>('/wheel/state', { token });
  }

  /**
   * Get spin history
   */
  async getWheelHistory(
    token: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<WheelHistoryResponse> {
    return this.request<WheelHistoryResponse>(
      `/wheel/history?page=${page}&limit=${limit}`,
      { token },
    );
  }

  /**
   * Get jackpot info (public)
   */
  async getWheelJackpot(): Promise<WheelJackpotResponse> {
    return this.request<WheelJackpotResponse>('/wheel/jackpot');
  }

  /**
   * Get recent wins for wheel (public, for social proof)
   */
  async getWheelRecentWins(limit: number = 20): Promise<RecentWinItem[]> {
    return this.request<RecentWinItem[]>(`/wheel/recent-wins?limit=${limit}`);
  }

  // ============================================
  // Activity Feed endpoints
  // ============================================

  /**
   * Get activity feed (public, for social proof)
   */
  async getActivityFeed(limit: number = 30): Promise<ActivityFeedItem[]> {
    return this.request<ActivityFeedItem[]>(`/activity/feed?limit=${limit}`);
  }

  // ============================================
  // Notification endpoints
  // ============================================

  /**
   * Get notifications for current user
   */
  async getNotifications(
    token: string,
    filters?: {
      limit?: number;
      offset?: number;
      type?: string;
      unreadOnly?: boolean;
    },
  ) {
    const params = new URLSearchParams();
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    if (filters?.type) params.append('type', filters.type);
    if (filters?.unreadOnly) params.append('unreadOnly', 'true');

    const query = params.toString();
    return this.request<import('@/types').GetNotificationsResponse>(
      `/notifications${query ? `?${query}` : ''}`,
      { token },
    );
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(token: string): Promise<{ count: number }> {
    return this.request<{ count: number }>('/notifications/unread-count', {
      token,
    });
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(
    token: string,
    notificationId: string,
  ): Promise<import('@/types').Notification> {
    return this.request<import('@/types').Notification>(
      `/notifications/${notificationId}/read`,
      {
        method: 'POST',
        token,
      },
    );
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsAsRead(token: string): Promise<{ count: number }> {
    return this.request<{ count: number }>('/notifications/read-all', {
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
  telegramId: string | null; // Nullable для email/web3 auth
  email: string | null;
  web3Address: string | null; // Solana wallet address
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  fortuneBalance: string;
  referralBalance: string;
  maxTierReached: number;
  currentTaxRate: string;
  taxDiscount: string;
  referralCode: string;
  telegramNotificationsEnabled: boolean;
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

export interface MilestoneStatus {
  milestone: string;
  threshold: number;
  reward: string;
  description: string;
  claimed: boolean;
  claimedAt: string | null;
  canClaim: boolean;
}

export interface MilestoneProgress {
  activeReferrals: number;
  milestones: MilestoneStatus[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
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
  refreshToken?: string;
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
  newUsersToday: number;
  newUsersWeek: number;
  totalMachines: number;
  activeMachines: number;
  totalDeposits: number;
  totalDepositsAmount: number;
  depositsToday: number;
  depositsAmountToday: number;
  totalWithdrawals: number;
  totalWithdrawalsAmount: number;
  pendingWithdrawals: number;
  withdrawalsToday: number;
  withdrawalsAmountToday: number;
  totalFortuneBalance: number;
  totalTaxCollected: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface DashboardChartData {
  usersChart: ChartDataPoint[];
  depositsChart: ChartDataPoint[];
  withdrawalsChart: ChartDataPoint[];
  revenueChart: ChartDataPoint[];
  machinesChart: ChartDataPoint[];
}

export interface TierDistribution {
  [key: string]: string | number;
  tier: number;
  count: number;
  totalValue: number;
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
  // Coin Box & Collector
  coinBoxCapacityHours: number;
  collectorHireCost: number;
  collectorSalaryPercent: number;
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
  // Coin Box & Collector
  coinBoxCapacityHours?: number;
  collectorHireCost?: number;
  collectorSalaryPercent?: number;
}

// ============================================
// Admin Users Types
// ============================================

export type UserSortField = 'createdAt' | 'fortuneBalance' | 'maxTierReached' | 'username';
export type SortOrder = 'asc' | 'desc';

export interface AdminUsersFilter {
  search?: string;
  isBanned?: boolean;
  hasReferrer?: boolean;
  minTier?: number;
  maxTier?: number;
  limit?: number;
  offset?: number;
  sortBy?: UserSortField;
  sortOrder?: SortOrder;
}

export interface AdminUserListItem {
  id: string;
  telegramId: string | null;
  email: string | null;
  web3Address: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  fortuneBalance: number;
  referralBalance: number;
  maxTierReached: number;
  maxTierUnlocked: number;
  currentTaxRate: number;
  isBanned: boolean;
  bannedAt: string | null;
  referralCode: string;
  hasReferrer: boolean;
  referralsCount: number;
  machinesCount: number;
  createdAt: string;
}

export interface MachineItem {
  id: string;
  tier: number;
  purchasePrice: number;
  totalYield: number;
  profitAmount: number;
  lifespanDays: number;
  startedAt: string;
  expiresAt: string;
  ratePerSecond: number;
  accumulatedIncome: number;
  lastCalculatedAt: string;
  profitPaidOut: number;
  principalPaidOut: number;
  reinvestRound: number;
  profitReductionRate: number;
  coinBoxLevel: number;
  coinBoxCapacity: number;
  coinBoxCurrent: number;
  fortuneGambleLevel: number;
  autoCollectEnabled: boolean;
  status: string;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserListItem {
  totalFreshDeposits: number;
  totalProfitCollected: number;
  bannedReason: string | null;
  freeSpinsRemaining: number;
  lastSpinAt: string | null;
  referrer: {
    id: string;
    username: string | null;
    telegramId: string;
  } | null;
  machines: MachineItem[];
  stats: {
    totalDeposits: number;
    totalDepositsAmount: number;
    totalWithdrawals: number;
    totalWithdrawalsAmount: number;
    totalMachinesPurchased: number;
    activeMachines: number;
    expiredMachines: number;
    totalReferralEarnings: number;
  };
}

export interface AdminUsersListResponse {
  users: AdminUserListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminUsersStatsResponse {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  usersWithReferrer: number;
  usersByTier: Record<number, number>;
}

export interface ReferralTreeNode {
  id: string;
  telegramId: string | null;
  email: string | null;
  web3Address: string | null;
  username: string | null;
  firstName: string | null;
  fortuneBalance: number;
  maxTierReached: number;
  isBanned: boolean;
  level: number;
  totalContributed: number;
  machinesCount: number;
  joinedAt: string;
  children?: ReferralTreeNode[];
}

export interface ReferralTreeResponse {
  user: {
    id: string;
    username: string | null;
    referralCode: string;
  };
  tree: ReferralTreeNode[];
  stats: {
    level1Count: number;
    level2Count: number;
    level3Count: number;
    totalEarned: number;
  };
}

// ============================================
// Admin Withdrawals Types
// ============================================

export type WithdrawalSortField = 'createdAt' | 'requestedAmount' | 'netAmount';
export type WithdrawalStatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface AdminWithdrawalsFilter {
  search?: string;
  status?: WithdrawalStatusFilter;
  chain?: string;
  method?: string;
  limit?: number;
  offset?: number;
  sortBy?: WithdrawalSortField;
  sortOrder?: SortOrder;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdminWithdrawalUserInfo {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
}

export interface AdminWithdrawalListItem {
  id: string;
  user: AdminWithdrawalUserInfo;
  method: string;
  chain: string;
  currency: string;
  walletAddress: string;
  requestedAmount: number;
  fromFreshDeposit: number;
  fromProfit: number;
  taxAmount: number;
  taxRate: number;
  netAmount: number;
  usdtAmount: number;
  feeSolAmount: number | null;
  txSignature: string | null;
  status: string;
  errorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface AdminWithdrawalDetail extends AdminWithdrawalListItem {
  user: AdminWithdrawalUserInfo & {
    fortuneBalance: number;
    maxTierReached: number;
    isBanned: boolean;
  };
}

export interface AdminWithdrawalsListResponse {
  withdrawals: AdminWithdrawalListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminWithdrawalsStatsResponse {
  totalWithdrawals: number;
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  totalRequestedAmount: number;
  totalNetAmount: number;
  totalTaxCollected: number;
  todayCount: number;
  todayAmount: number;
}

// ============================================
// Admin Deposits Types
// ============================================

export type DepositSortField = 'createdAt' | 'amount' | 'amountUsd';
export type DepositStatusFilter = 'all' | 'pending' | 'confirmed' | 'credited' | 'failed';

export interface AdminDepositsFilter {
  search?: string;
  status?: DepositStatusFilter;
  chain?: string;
  currency?: string;
  method?: string;
  limit?: number;
  offset?: number;
  sortBy?: DepositSortField;
  sortOrder?: SortOrder;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdminDepositUserInfo {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
}

export interface AdminDepositListItem {
  id: string;
  user: AdminDepositUserInfo;
  method: string;
  chain: string;
  currency: string;
  txSignature: string;
  amount: number;
  amountUsd: number;
  rateToUsd: number | null;
  memo: string | null;
  status: string;
  slot: string | null;
  confirmedAt: string | null;
  creditedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  otherCryptoNetwork: string | null;
  otherCryptoToken: string | null;
  claimedAmount: number | null;
  rejectionReason: string | null;
  processedBy: string | null;
  processedAt: string | null;
  adminNotes: string | null;
}

export interface AdminDepositDetail extends AdminDepositListItem {
  user: AdminDepositUserInfo & {
    fortuneBalance: number;
    maxTierReached: number;
    isBanned: boolean;
  };
}

export interface AdminDepositsListResponse {
  deposits: AdminDepositListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminDepositsStatsResponse {
  totalDeposits: number;
  pendingCount: number;
  confirmedCount: number;
  creditedCount: number;
  failedCount: number;
  totalAmountUsd: number;
  todayCount: number;
  todayAmountUsd: number;
  byCurrency: Record<string, { count: number; amount: number }>;
}

// ============================================
// Admin Audit Types
// ============================================

export interface AdminAuditFilter {
  action?: string;
  resource?: string;
  resourceId?: string;
  adminUser?: string;
  limit?: number;
  offset?: number;
  sortOrder?: SortOrder;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdminAuditLogItem {
  id: string;
  adminAction: string;
  resource: string;
  resourceId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  adminUser: string | null;
  createdAt: string;
}

export interface AdminAuditListResponse {
  logs: AdminAuditLogItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminAuditStatsResponse {
  totalLogs: number;
  todayCount: number;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  recentActions: AdminAuditLogItem[];
}

// ============================================
// Fortune Wheel Types
// ============================================

export type WheelMultiplier = 1 | 5 | 10 | 25 | 50;

export interface WheelSector {
  sector: string;
  chance: number;
  multiplier: number;
}

export interface WheelSpinResult {
  sector: string;
  multiplier: number;
  payout: number;
  isJackpot: boolean;
}

export interface WheelSpinResponse {
  success: boolean;
  spinId: string;
  spinCount: number;
  totalBet: number;
  totalPayout: number;
  netResult: number;
  results: WheelSpinResult[];
  jackpotWon: boolean;
  jackpotAmount: number;
  burnAmount: number;
  poolAmount: number;
  freeSpinsUsed: number;
  freeSpinsRemaining: number;
  newBalance: number;
  currentJackpotPool: number;
}

export interface WheelStateResponse {
  jackpotPool: number;
  jackpotCap: number;
  lastWinner: {
    userId: string;
    amount: number | null;
    wonAt: string | null;
  } | null;
  timesWon: number;
  totalPaidOut: number;
  betAmount: number;
  multipliers: number[];
  freeSpinsRemaining: number;
  sectors: WheelSector[];
}

export interface WheelHistoryItem {
  id: string;
  spinCount: number;
  totalBet: number;
  totalPayout: number;
  netResult: number;
  jackpotWon: boolean;
  jackpotAmount: number;
  createdAt: string;
}

export interface WheelHistoryResponse {
  items: WheelHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface WheelJackpotResponse {
  currentPool: number;
  lastWinner: string | null;
  lastAmount: number | null;
  timesWon: number;
}

export interface ActivityFeedItem {
  type: 'machine_purchase' | 'withdrawal' | 'wheel_win' | 'jackpot';
  username: string;
  amount: number;
  tier?: number;
  multiplier?: string;
  createdAt: string;
}

export interface RecentWinItem {
  id: string;
  username: string;
  payout: number;
  netResult: number;
  isJackpot: boolean;
  jackpotAmount: number;
  multiplier: string;
  createdAt: string;
}
