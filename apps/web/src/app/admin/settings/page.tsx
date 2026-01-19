'use client';

import { useEffect, useState } from 'react';
import { useAdminSettingsStore } from '@/stores/admin/admin-settings.store';
import { UpdateSettingsRequest, AdminSettingsResponse } from '@/lib/api';
import {
  Settings,
  DollarSign,
  Percent,
  Users,
  Gamepad2,
  AlertCircle,
  Save,
  RotateCcw,
  RefreshCw,
  Box,
} from 'lucide-react';

function settingsToFormData(settings: AdminSettingsResponse | null): UpdateSettingsRequest {
  if (!settings) return {};
  return {
    maxGlobalTier: settings.maxGlobalTier,
    minDepositAmounts: settings.minDepositAmounts,
    minWithdrawalAmount: settings.minWithdrawalAmount,
    walletConnectFeeSol: settings.walletConnectFeeSol,
    pawnshopCommission: settings.pawnshopCommission,
    taxRatesByTier: settings.taxRatesByTier,
    referralRates: settings.referralRates,
    reinvestReduction: settings.reinvestReduction,
    auctionCommissions: settings.auctionCommissions,
    earlySellCommissions: settings.earlySellCommissions,
    gambleWinMultiplier: settings.gambleWinMultiplier,
    gambleLoseMultiplier: settings.gambleLoseMultiplier,
    gambleLevels: settings.gambleLevels,
    coinBoxCapacityHours: settings.coinBoxCapacityHours,
    collectorHireCost: settings.collectorHireCost,
    collectorSalaryPercent: settings.collectorSalaryPercent,
  };
}

export default function AdminSettingsPage() {
  const { settings, isLoading, isSaving, error, fetchSettings, updateSettings, resetSettings, clearError } =
    useAdminSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Use settings.updatedAt as key to reset form when settings change
  const formKey = settings?.updatedAt ?? 'initial';

  if (isLoading && !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <SettingsForm
      key={formKey}
      settings={settings}
      isLoading={isLoading}
      isSaving={isSaving}
      error={error}
      onSave={updateSettings}
      onReset={resetSettings}
      onRefresh={fetchSettings}
      onClearError={clearError}
    />
  );
}

interface SettingsFormProps {
  settings: AdminSettingsResponse | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: (data: UpdateSettingsRequest) => Promise<AdminSettingsResponse>;
  onReset: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onClearError: () => void;
}

function SettingsForm({ settings, isSaving, error, onSave, onReset, onRefresh, onClearError }: SettingsFormProps) {
  const [formData, setFormData] = useState<UpdateSettingsRequest>(() => settingsToFormData(settings));
  const [hasChanges, setHasChanges] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleInputChange = (field: keyof UpdateSettingsRequest, value: number | string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleJsonChange = (field: keyof UpdateSettingsRequest, jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      setFormData((prev) => ({ ...prev, [field]: parsed }));
      setHasChanges(true);
    } catch {
      // Invalid JSON, don't update
    }
  };

  const handleSave = async () => {
    try {
      await onSave(formData);
      setSuccessMessage('Settings saved successfully');
      setHasChanges(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      // Error is handled by store
    }
  };

  const handleReset = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    try {
      await onReset();
      setSuccessMessage('Settings reset to defaults');
      setResetConfirm(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      // Error is handled by store
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Economy Settings</h1>
          <p className="text-slate-400 mt-1">Configure global economic parameters</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onRefresh()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleReset}
            disabled={isSaving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              resetConfirm
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-slate-800 hover:bg-slate-700'
            } text-white`}
          >
            <RotateCcw className="w-4 h-4" />
            {resetConfirm ? 'Confirm Reset' : 'Reset Defaults'}
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400">{error}</p>
          </div>
          <button onClick={onClearError} className="text-red-400 hover:text-red-300">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <p className="text-green-400">{successMessage}</p>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <SettingsCard
          icon={Settings}
          title="General Settings"
          description="Basic configuration"
        >
          <InputField
            label="Max Global Tier"
            value={formData.maxGlobalTier ?? 1}
            onChange={(v) => handleInputChange('maxGlobalTier', v)}
            type="number"
            min={1}
            max={10}
            hint="Maximum tier available without progression"
          />
        </SettingsCard>

        {/* Deposit/Withdrawal Settings */}
        <SettingsCard
          icon={DollarSign}
          title="Deposits & Withdrawals"
          description="Financial limits and fees"
        >
          <InputField
            label="Min Withdrawal Amount"
            value={formData.minWithdrawalAmount ?? 5}
            onChange={(v) => handleInputChange('minWithdrawalAmount', v)}
            type="number"
            min={0}
            step={0.01}
            prefix="$"
          />
          <InputField
            label="Wallet Connect Fee (SOL)"
            value={formData.walletConnectFeeSol ?? 0.003}
            onChange={(v) => handleInputChange('walletConnectFeeSol', v)}
            type="number"
            min={0}
            step={0.0001}
          />
          <JsonField
            label="Min Deposit Amounts"
            value={formData.minDepositAmounts}
            onChange={(v) => handleJsonChange('minDepositAmounts', v)}
            hint='{"SOL": 0.01, "USDT_SOL": 1, "FORTUNE": 10}'
          />
        </SettingsCard>

        {/* Commission Settings */}
        <SettingsCard
          icon={Percent}
          title="Commissions"
          description="Various platform fees"
        >
          <InputField
            label="Pawnshop Commission"
            value={(formData.pawnshopCommission ?? 0.1) * 100}
            onChange={(v) => handleInputChange('pawnshopCommission', Number(v) / 100)}
            type="number"
            min={0}
            max={100}
            suffix="%"
          />
          <JsonField
            label="Auction Commissions (by wear %)"
            value={formData.auctionCommissions}
            onChange={(v) => handleJsonChange('auctionCommissions', v)}
            hint='{"20": 0.10, "40": 0.20, ...}'
          />
          <JsonField
            label="Early Sell Commissions (by progress %)"
            value={formData.earlySellCommissions}
            onChange={(v) => handleJsonChange('earlySellCommissions', v)}
            hint='{"20": 0.20, "40": 0.35, ...}'
          />
        </SettingsCard>

        {/* Tax Settings */}
        <SettingsCard
          icon={Percent}
          title="Tax Rates"
          description="Tax rates by tier"
        >
          <JsonField
            label="Tax Rates by Tier"
            value={formData.taxRatesByTier}
            onChange={(v) => handleJsonChange('taxRatesByTier', v)}
            hint='{"1": 0.5, "2": 0.45, ...}'
            rows={6}
          />
          <JsonField
            label="Reinvest Reduction by Round"
            value={formData.reinvestReduction}
            onChange={(v) => handleJsonChange('reinvestReduction', v)}
            hint='{"1": 0, "2": 0.05, ...}'
            rows={6}
          />
        </SettingsCard>

        {/* Referral Settings */}
        <SettingsCard
          icon={Users}
          title="Referral System"
          description="Referral bonus rates"
        >
          <JsonField
            label="Referral Rates by Level"
            value={formData.referralRates}
            onChange={(v) => handleJsonChange('referralRates', v)}
            hint='{"1": 0.05, "2": 0.03, "3": 0.01}'
          />
        </SettingsCard>

        {/* Gamble Settings */}
        <SettingsCard
          icon={Gamepad2}
          title="Fortune's Gamble"
          description="Risky collect mechanics"
        >
          <InputField
            label="Win Multiplier"
            value={formData.gambleWinMultiplier ?? 2}
            onChange={(v) => handleInputChange('gambleWinMultiplier', v)}
            type="number"
            min={1}
            step={0.1}
            prefix="×"
          />
          <InputField
            label="Lose Multiplier"
            value={formData.gambleLoseMultiplier ?? 0.5}
            onChange={(v) => handleInputChange('gambleLoseMultiplier', v)}
            type="number"
            min={0}
            max={1}
            step={0.1}
            prefix="×"
          />
          <JsonField
            label="Gamble Levels"
            value={formData.gambleLevels}
            onChange={(v) => handleJsonChange('gambleLevels', v)}
            hint='[{"level": 0, "winChance": 0.13, "costPercent": 0}, ...]'
            rows={6}
          />
        </SettingsCard>

        {/* Coin Box & Collector Settings */}
        <SettingsCard
          icon={Box}
          title="Coin Box & Collector"
          description="Machine earnings storage and auto-collect"
        >
          <InputField
            label="Coin Box Capacity"
            value={formData.coinBoxCapacityHours ?? 12}
            onChange={(v) => handleInputChange('coinBoxCapacityHours', v)}
            type="number"
            min={1}
            max={168}
            suffix="hours"
            hint="How long before coin box is full (default: 12h)"
          />
          <InputField
            label="Collector Hire Cost"
            value={formData.collectorHireCost ?? 5}
            onChange={(v) => handleInputChange('collectorHireCost', v)}
            type="number"
            min={0}
            step={0.01}
            prefix="$"
            hint="One-time cost to hire collector (default: $5)"
          />
          <InputField
            label="Collector Salary"
            value={formData.collectorSalaryPercent ?? 5}
            onChange={(v) => handleInputChange('collectorSalaryPercent', v)}
            type="number"
            min={0}
            max={100}
            step={0.1}
            suffix="%"
            hint="Percentage of each collect (default: 5%)"
          />
        </SettingsCard>

      </div>

      {/* Last Updated */}
      {settings && (
        <div className="text-center text-sm text-slate-500">
          Last updated: {new Date(settings.updatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ============================================
// Components
// ============================================

interface SettingsCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingsCard({ icon: Icon, title, description, children }: SettingsCardProps) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <Icon className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

interface InputFieldProps {
  label: string;
  value: number | string;
  onChange: (value: number) => void;
  type?: 'number' | 'text';
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
}

function InputField({
  label,
  value,
  onChange,
  type = 'number',
  min,
  max,
  step,
  prefix,
  suffix,
  hint,
}: InputFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {prefix && <span className="text-slate-400">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
        />
        {suffix && <span className="text-slate-400">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

interface JsonFieldProps {
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  hint?: string;
  rows?: number;
}

function JsonField({ label, value, onChange, hint, rows = 3 }: JsonFieldProps) {
  // Initialize with stringified value - component will be remounted via key when settings change
  const [localValue, setLocalValue] = useState(() => JSON.stringify(value, null, 2));
  const [isValid, setIsValid] = useState(true);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    try {
      JSON.parse(newValue);
      setIsValid(true);
      onChange(newValue);
    } catch {
      setIsValid(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <textarea
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        rows={rows}
        className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white font-mono text-sm focus:outline-none transition-colors ${
          isValid ? 'border-slate-700 focus:border-amber-500' : 'border-red-500'
        }`}
      />
      {!isValid && <p className="text-xs text-red-400 mt-1">Invalid JSON</p>}
      {hint && isValid && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
