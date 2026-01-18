'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { toast } from 'sonner';
import { Wallet, ArrowRight, AlertCircle, QrCode, Copy } from 'lucide-react';
import type { TierInfo } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useDepositsStore } from '@/stores/deposits.store';
import { useAuthStore } from '@/stores/auth.store';
import type { DepositCurrency } from '@/lib/api';

// Token mints (mainnet)
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const FORTUNE_MINT = process.env.NEXT_PUBLIC_FORTUNE_MINT_ADDRESS;

const CURRENCIES: { id: DepositCurrency; label: string; icon: string }[] = [
  { id: 'SOL', label: 'SOL', icon: '◎' },
  { id: 'USDT_SOL', label: 'USDT', icon: '$' },
  { id: 'FORTUNE', label: 'FORTUNE', icon: '🎰' },
];

interface TopUpAndBuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: TierInfo | null;
  shortfall: number;
  onSuccess: () => Promise<void>;
}

export function TopUpAndBuyModal({
  isOpen,
  onClose,
  tier,
  shortfall,
  onSuccess,
}: TopUpAndBuyModalProps) {
  const t = useTranslations('shop');
  const tCash = useTranslations('cash');
  const tCommon = useTranslations('common');

  const { user, token, refreshUser } = useAuthStore();
  const {
    rates,
    depositAddress,
    fetchRates,
    fetchDepositAddress,
    initiateDeposit,
    confirmDeposit,
    clearPendingDeposit,
  } = useDepositsStore();

  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [depositTab, setDepositTab] = useState<'wallet' | 'address'>('wallet');
  const [selectedCurrency, setSelectedCurrency] = useState<DepositCurrency>('SOL');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Fetch rates on mount
  useEffect(() => {
    if (isOpen) {
      fetchRates();
    }
  }, [isOpen, fetchRates]);

  // Fetch deposit address when switching to address tab
  useEffect(() => {
    if (isOpen && depositTab === 'address' && token && !depositAddress) {
      fetchDepositAddress(token);
    }
  }, [isOpen, depositTab, token, depositAddress, fetchDepositAddress]);

  // Calculate recommended deposit amount with 10% buffer
  const recommendedAmount = useMemo(() => {
    return shortfall * 1.1; // 10% buffer for fees/slippage
  }, [shortfall]);

  // Convert USD to selected currency
  const usdToCurrency = useCallback(
    (usdAmount: number): number => {
      if (!rates) return 0;
      switch (selectedCurrency) {
        case 'SOL':
          return usdAmount / rates.sol;
        case 'USDT_SOL':
          return usdAmount;
        case 'FORTUNE':
          return usdAmount / rates.fortune;
        default:
          return 0;
      }
    },
    [rates, selectedCurrency],
  );

  // Set initial deposit amount when modal opens or currency changes
  useEffect(() => {
    if (isOpen && rates && shortfall > 0) {
      const amount = usdToCurrency(recommendedAmount);
      setDepositAmount(amount.toFixed(selectedCurrency === 'SOL' ? 4 : 2));
    }
  }, [isOpen, rates, shortfall, selectedCurrency, recommendedAmount, usdToCurrency]);

  // Calculate USD value for current deposit amount
  const depositUsdValue = useMemo(() => {
    if (!rates || !depositAmount) return 0;
    const amountNum = parseFloat(depositAmount) || 0;
    switch (selectedCurrency) {
      case 'SOL':
        return amountNum * rates.sol;
      case 'USDT_SOL':
        return amountNum;
      case 'FORTUNE':
        return amountNum * rates.fortune;
      default:
        return 0;
    }
  }, [rates, depositAmount, selectedCurrency]);

  // Check if deposit amount is enough
  const isEnough = depositUsdValue >= shortfall;
  const userBalance = user ? parseFloat(user.fortuneBalance) : 0;

  // Handle wallet deposit
  const handleDeposit = useCallback(async () => {
    if (!connected || !publicKey || !token || !depositAmount || !tier) {
      toast.error(tCash('pleaseConnectWallet'));
      return;
    }

    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error(tCash('invalidAmount'));
      return;
    }

    setIsSending(true);
    try {
      const depositInfo = await initiateDeposit(
        token,
        selectedCurrency,
        amountNum,
        publicKey.toBase58(),
      );

      const recipientPubkey = new PublicKey(depositInfo.recipientAddress);
      const transaction = new Transaction();

      if (selectedCurrency === 'SOL') {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubkey,
            lamports: Math.floor(amountNum * LAMPORTS_PER_SOL),
          }),
        );
      } else {
        const mintAddress =
          selectedCurrency === 'USDT_SOL' ? USDT_MINT : FORTUNE_MINT;
        if (!mintAddress) {
          throw new Error('Token mint not configured');
        }

        const mint = new PublicKey(mintAddress);
        const fromAta = await getAssociatedTokenAddress(mint, publicKey);
        const toAta = await getAssociatedTokenAddress(mint, recipientPubkey);
        const decimals = selectedCurrency === 'USDT_SOL' ? 6 : 9;
        const tokenAmount = Math.floor(amountNum * Math.pow(10, decimals));

        transaction.add(
          createTransferInstruction(
            fromAta,
            toAta,
            publicKey,
            tokenAmount,
            [],
            TOKEN_PROGRAM_ID,
          ),
        );
      }

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      await confirmDeposit(token, depositInfo.depositId, signature);

      toast.success(tCash('depositConfirmed'));

      // Refresh user balance
      await refreshUser();

      // Check if we can now afford the machine
      setIsPurchasing(true);
      try {
        await onSuccess();
        toast.success(t('topUpModal.purchaseSuccess'));
      } catch (purchaseError) {
        // Purchase failed - maybe still not enough
        const errorMsg =
          purchaseError instanceof Error ? purchaseError.message : t('topUpModal.purchaseFailed');
        toast.error(errorMsg);
      } finally {
        setIsPurchasing(false);
      }
    } catch (err) {
      console.error('Deposit failed:', err);
      toast.error(err instanceof Error ? err.message : tCash('depositFailed'));
      clearPendingDeposit();
    } finally {
      setIsSending(false);
    }
  }, [
    connected,
    publicKey,
    token,
    depositAmount,
    tier,
    selectedCurrency,
    connection,
    sendTransaction,
    initiateDeposit,
    confirmDeposit,
    clearPendingDeposit,
    refreshUser,
    onSuccess,
    tCash,
    t,
  ]);

  // Copy address to clipboard
  const copyAddress = useCallback(() => {
    if (depositAddress?.address) {
      navigator.clipboard.writeText(depositAddress.address);
      toast.success(tCash('addressCopied'));
    }
  }, [depositAddress?.address, tCash]);

  if (!tier) return null;

  const isLoading = isSending || isPurchasing;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('topUpModal.title')}>
      <div className="space-y-4">
        {/* Machine preview */}
        <div className="flex items-center gap-4 p-4 bg-[#1a0a2e] rounded-xl">
          <span className="text-5xl">{tier.emoji}</span>
          <div className="flex-1">
            <h3 className="font-bold text-white text-lg">{tier.name}</h3>
            <p className="text-[#b0b0b0] text-sm">{t('tier')} {tier.tier}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#ffd700]">
              ${tier.price.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Balance info */}
        <div className="p-4 bg-[#1a0a2e] rounded-xl space-y-2">
          <div className="flex justify-between">
            <span className="text-[#b0b0b0]">{t('topUpModal.yourBalance')}</span>
            <span className="font-mono text-white">${userBalance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#b0b0b0]">{t('topUpModal.price')}</span>
            <span className="font-mono text-[#ffd700]">${tier.price.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-[#3a2a5e] pt-2">
            <span className="text-[#ff2d95] font-medium">{t('topUpModal.needMore')}</span>
            <span className="font-mono text-[#ff2d95] font-bold">${shortfall.toFixed(2)}</span>
          </div>
        </div>

        {/* Deposit method tabs */}
        <div className="flex bg-[#1a0a2e]/50 rounded-lg p-1">
          <button
            onClick={() => setDepositTab('wallet')}
            disabled={isLoading}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              depositTab === 'wallet'
                ? 'bg-[#2a1a4e] text-white'
                : 'text-[#b0b0b0] hover:text-white'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Wallet className="w-4 h-4" />
            <span>{tCash('wallet')}</span>
          </button>
          <button
            onClick={() => setDepositTab('address')}
            disabled={isLoading}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              depositTab === 'address'
                ? 'bg-[#2a1a4e] text-white'
                : 'text-[#b0b0b0] hover:text-white'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <QrCode className="w-4 h-4" />
            <span>{tCash('qrAddress')}</span>
          </button>
        </div>

        {/* Wallet deposit tab */}
        {depositTab === 'wallet' && (
          <>
            {/* Currency selector */}
            <div>
              <label className="block text-sm text-[#b0b0b0] mb-2">
                {t('topUpModal.selectCurrency')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CURRENCIES.map((currency) => (
                  <button
                    key={currency.id}
                    onClick={() => setSelectedCurrency(currency.id)}
                    disabled={isLoading}
                    className={`
                      p-3 rounded-lg border transition-all text-center
                      ${
                        selectedCurrency === currency.id
                          ? 'border-[#00d4ff] bg-[#00d4ff]/10 text-white'
                          : 'border-[#3a2a5e] bg-[#1a0a2e] text-[#b0b0b0] hover:border-[#00d4ff]/50'
                      }
                      ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <span className="text-lg">{currency.icon}</span>
                    <p className="text-xs mt-1">{currency.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount input */}
            <div>
              <label className="block text-sm text-[#b0b0b0] mb-2">
                {t('topUpModal.depositAmount')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  disabled={isLoading}
                  className={`
                    w-full p-3 pr-20 bg-[#1a0a2e] border rounded-lg
                    text-white font-mono text-lg
                    focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/50
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : 'border-[#3a2a5e]'}
                  `}
                  placeholder="0.00"
                  step="any"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b0b0b0]">
                  {CURRENCIES.find((c) => c.id === selectedCurrency)?.label}
                </span>
              </div>
              {depositAmount && (
                <p className="text-xs text-[#b0b0b0] mt-1">
                  ≈ ${depositUsdValue.toFixed(2)} USD
                </p>
              )}
            </div>

            {/* Warning if not enough */}
            {depositAmount && !isEnough && (
              <div className="p-3 bg-[#ffaa00]/10 border border-[#ffaa00]/30 rounded-lg">
                <p className="text-[#ffaa00] text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {t('topUpModal.notEnough', { amount: (shortfall - depositUsdValue).toFixed(2) })}
                </p>
              </div>
            )}

            {/* Wallet connect or deposit button */}
            <div className="pt-2">
              {!connected ? (
                <div className="space-y-3">
                  <p className="text-center text-[#b0b0b0] text-sm">
                    {t('topUpModal.connectWalletHint')}
                  </p>
                  <div className="flex justify-center">
                    <WalletMultiButton className="!bg-[#00d4ff] hover:!bg-[#00d4ff]/80 !rounded-lg !h-12 !px-6" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm text-[#00ff88]">
                    <Wallet className="w-4 h-4" />
                    <span className="truncate max-w-[200px]">
                      {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                    </span>
                  </div>
                  <Button
                    variant="gold"
                    size="lg"
                    fullWidth
                    onClick={handleDeposit}
                    loading={isLoading}
                    disabled={isLoading || !depositAmount || parseFloat(depositAmount) <= 0}
                  >
                    {isPurchasing ? (
                      <span className="flex items-center gap-2">
                        {t('topUpModal.purchasing')}
                      </span>
                    ) : isSending ? (
                      <span className="flex items-center gap-2">
                        {t('topUpModal.depositing')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {t('topUpModal.depositAndBuy')}
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {/* QR/Address deposit tab */}
        {depositTab === 'address' && (
          <div className="space-y-4">
            {!depositAddress ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin mx-auto mb-3" />
                <p className="text-[#b0b0b0] text-sm">{tCash('loadingDepositAddress')}</p>
              </div>
            ) : (
              <>
                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-xl">
                    <img
                      src={depositAddress.qrCode}
                      alt="Deposit QR Code"
                      className="w-32 h-32"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm text-[#b0b0b0] mb-2">
                    {tCash('depositAddress')}
                  </label>
                  <div className="bg-[#1a0a2e] rounded-lg p-3">
                    <code className="text-xs text-[#00d4ff] break-all font-mono">
                      {depositAddress.address}
                    </code>
                  </div>
                </div>

                {/* Copy button */}
                <button
                  onClick={copyAddress}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#2a1a4e] hover:bg-[#3a2a5e] rounded-lg text-white font-medium transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  {tCash('copyAddress')}
                </button>

                {/* Important notes */}
                <div className="p-3 bg-[#ffaa00]/10 border border-[#ffaa00]/30 rounded-lg">
                  <div className="flex gap-2">
                    <AlertCircle className="w-4 h-4 text-[#ffaa00] flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-[#b0b0b0] space-y-1">
                      <p className="text-[#ffaa00] font-medium">{tCash('important')}</p>
                      <p>• {tCash('importantNotes.onlySend')}</p>
                      <p>• {tCash('importantNotes.minDeposit', { amount: depositAddress.minDeposit })}</p>
                      <p>• {tCash('importantNotes.autoCredit')}</p>
                    </div>
                  </div>
                </div>

                {/* Info about manual refresh after deposit */}
                <p className="text-xs text-center text-[#b0b0b0]">
                  {t('topUpModal.refreshAfterDeposit')}
                </p>
              </>
            )}
          </div>
        )}

        {/* Cancel button */}
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          onClick={onClose}
          disabled={isLoading}
        >
          {tCommon('cancel')}
        </Button>
      </div>
    </Modal>
  );
}
