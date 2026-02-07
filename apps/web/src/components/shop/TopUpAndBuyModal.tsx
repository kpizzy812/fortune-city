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
import { Wallet, ArrowRight, AlertCircle, QrCode, Copy, CheckCircle } from 'lucide-react';
import type { TierInfo } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CurrencyIcon } from '@/components/ui/CurrencyIcon';
import { useDepositsStore } from '@/stores/deposits.store';
import { useAuthStore } from '@/stores/auth.store';
import { useOnDepositCredited, type DepositCreditedEvent } from '@/hooks/useDepositsSocket';
import type { DepositCurrency } from '@/lib/api';

// Token mints (mainnet)
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const FORTUNE_MINT = process.env.NEXT_PUBLIC_FORTUNE_MINT_ADDRESS;

const CURRENCIES: { id: DepositCurrency; label: string }[] = [
  { id: 'SOL', label: 'SOL' },
  { id: 'USDT_SOL', label: 'USDT' },
  { id: 'FORTUNE', label: 'FORTUNE' },
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
  const [depositReceived, setDepositReceived] = useState<DepositCreditedEvent | null>(null);

  // Handle real-time deposit notification
  const handleDepositCredited = useCallback(async (data: DepositCreditedEvent) => {
    if (!isOpen || !tier) return;

    setDepositReceived(data);

    // Try to purchase if we now have enough balance
    if (data.newBalance >= tier.price) {
      setIsPurchasing(true);
      try {
        await onSuccess();
        toast.success(t('topUpModal.purchaseSuccess'));
        onClose();
      } catch (purchaseError) {
        const errorMsg = purchaseError instanceof Error
          ? purchaseError.message
          : t('topUpModal.purchaseFailed');
        toast.error(errorMsg);
      } finally {
        setIsPurchasing(false);
      }
    }
  }, [isOpen, tier, onSuccess, onClose, t]);

  // Subscribe to deposit events (toast is shown globally, we just react in UI)
  useOnDepositCredited(handleDepositCredited);

  // Reset deposit received when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDepositReceived(null);
    }
  }, [isOpen]);

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
      <div className="space-y-3">
        {/* Machine preview + Balance info combined */}
        <div className="p-3 bg-[#1a0a2e] rounded-xl">
          <div className="flex items-center gap-3 pb-3 border-b border-[#3a2a5e]">
            <span className="text-4xl">{tier.emoji}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white truncate">{tier.name}</h3>
              <p className="text-[#b0b0b0] text-xs">{t('tier')} {tier.tier}</p>
            </div>
            <p className="text-xl font-bold text-[#ffd700]">${tier.price.toLocaleString()}</p>
          </div>
          <div className="pt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#b0b0b0]">{t('topUpModal.yourBalance')}</span>
              <span className="font-mono text-white">${userBalance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#ff2d95]">{t('topUpModal.needMore')}</span>
              <span className="font-mono text-[#ff2d95] font-bold">${shortfall.toFixed(2)}</span>
            </div>
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
              <label className="block text-xs text-[#b0b0b0] mb-1.5">
                {t('topUpModal.selectCurrency')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CURRENCIES.map((currency) => (
                  <button
                    key={currency.id}
                    onClick={() => setSelectedCurrency(currency.id)}
                    disabled={isLoading}
                    className={`
                      py-2 px-2 rounded-lg border transition-all text-center flex flex-col items-center gap-1.5
                      ${
                        selectedCurrency === currency.id
                          ? 'border-[#00d4ff] bg-[#00d4ff]/10 text-white'
                          : 'border-[#3a2a5e] bg-[#1a0a2e] text-[#b0b0b0] hover:border-[#00d4ff]/50'
                      }
                      ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <CurrencyIcon currency={currency.id} size="sm" />
                    <p className="text-xs">{currency.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount input */}
            <div>
              <label className="block text-xs text-[#b0b0b0] mb-1.5">
                {t('topUpModal.depositAmount')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  disabled={isLoading}
                  className={`
                    w-full py-2.5 px-3 pr-16 bg-[#1a0a2e] border rounded-lg
                    text-white font-mono text-base
                    focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/50
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : 'border-[#3a2a5e]'}
                  `}
                  placeholder="0.00"
                  step="any"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b0b0b0] text-sm">
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
              <div className="p-2 bg-[#ffaa00]/10 border border-[#ffaa00]/30 rounded-lg">
                <p className="text-[#ffaa00] text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {t('topUpModal.notEnough', { amount: (shortfall - depositUsdValue).toFixed(2) })}
                </p>
              </div>
            )}

            {/* Wallet connect or deposit button */}
            <div>
              {!connected ? (
                <div className="space-y-2">
                  <p className="text-center text-[#b0b0b0] text-xs">
                    {t('topUpModal.connectWalletHint')}
                  </p>
                  <div className="flex justify-center">
                    <WalletMultiButton className="!bg-[#00d4ff] hover:!bg-[#00d4ff]/80 !rounded-lg !h-10 !px-5 !text-sm" />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-[#00ff88]">
                    <Wallet className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[180px]">
                      {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                    </span>
                  </div>
                  <Button
                    variant="gold"
                    size="md"
                    fullWidth
                    onClick={handleDeposit}
                    loading={isLoading}
                    disabled={isLoading || !depositAmount || parseFloat(depositAmount) <= 0}
                  >
                    {isPurchasing ? (
                      t('topUpModal.purchasing')
                    ) : isSending ? (
                      t('topUpModal.depositing')
                    ) : (
                      <span className="flex items-center gap-1.5">
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
          <div className="space-y-3">
            {!depositAddress ? (
              <div className="py-6 text-center">
                <div className="w-5 h-5 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin mx-auto mb-2" />
                <p className="text-[#b0b0b0] text-xs">{tCash('loadingDepositAddress')}</p>
              </div>
            ) : (
              <>
                {/* QR Code + Address row */}
                <div className="flex gap-3 items-start">
                  <div className="bg-white p-2 rounded-lg flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={depositAddress.qrCode}
                      alt="Deposit QR Code"
                      className="w-24 h-24"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs text-[#b0b0b0] mb-1">
                      {tCash('depositAddress')}
                    </label>
                    <div className="bg-[#1a0a2e] rounded-lg p-2 mb-2">
                      <code className="text-[10px] text-[#00d4ff] break-all font-mono leading-tight block">
                        {depositAddress.address}
                      </code>
                    </div>
                    <button
                      onClick={copyAddress}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#2a1a4e] hover:bg-[#3a2a5e] rounded-lg text-white text-sm font-medium transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {tCash('copyAddress')}
                    </button>
                  </div>
                </div>

                {/* Deposit received success */}
                {depositReceived ? (
                  <div className="p-3 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-[#00ff88]" />
                      <div>
                        <p className="text-[#00ff88] font-medium text-sm">
                          {tCash('depositSuccess')}
                        </p>
                        <p className="text-xs text-[#b0b0b0]">
                          +${depositReceived.amountUsd.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {isPurchasing && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-[#b0b0b0]">
                        <div className="w-3 h-3 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" />
                        {t('topUpModal.purchasing')}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Important notes - compact */}
                    <div className="p-2 bg-[#ffaa00]/10 border border-[#ffaa00]/30 rounded-lg">
                      <div className="flex gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-[#ffaa00] flex-shrink-0 mt-0.5" />
                        <div className="text-[10px] text-[#b0b0b0] space-y-0.5">
                          <p className="text-[#ffaa00] font-medium text-xs">{tCash('important')}</p>
                          <p>• {tCash('importantNotes.onlySend')}</p>
                          <p>• {tCash('importantNotes.minDeposit', { amount: depositAddress.minDeposit })}</p>
                          <p>• {tCash('importantNotes.autoCredit')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Waiting for deposit */}
                    <div className="flex items-center justify-center gap-2 text-xs text-[#b0b0b0]">
                      <div className="w-3 h-3 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full animate-spin" />
                      {t('topUpModal.waitingForDeposit')}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
