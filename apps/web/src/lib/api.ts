import type {
  TierInfo,
  Machine,
  MachineIncome,
  CollectResult,
  CanAffordResponse,
  PurchaseResult,
  Transaction,
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

  async authWithInitData(initData: string) {
    return this.request<AuthResponse>('/auth/telegram/init-data', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    });
  }

  async authWithLoginWidget(data: TelegramLoginWidgetData) {
    return this.request<AuthResponse>('/auth/telegram/login-widget', {
      method: 'POST',
      body: JSON.stringify(data),
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
  maxTierReached: number;
  currentTaxRate: string;
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
