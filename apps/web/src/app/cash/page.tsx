'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  Copy,
  QrCode,
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useDepositsStore } from '@/stores/deposits.store';
import { useWithdrawalsStore } from '@/stores/withdrawals.store';
import { useOnDepositCredited } from '@/hooks/useDepositsSocket';
import { OtherCryptoModal } from '@/components/shop/OtherCryptoModal';
import type { DepositCurrency } from '@/lib/api';

// Token mints (mainnet)
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const FORTUNE_MINT = process.env.NEXT_PUBLIC_FORTUNE_MINT_ADDRESS;

type MainTabType = 'deposit' | 'withdraw';
type DepositTabType = 'wallet' | 'address';
type WithdrawTabType = 'wallet' | 'address';

const CURRENCIES: { id: DepositCurrency; label: string; icon: string }[] = [
  { id: 'SOL', label: 'SOL', icon: '◎' },
  { id: 'USDT_SOL', label: 'USDT', icon: '$' },
  { id: 'FORTUNE', label: 'FORTUNE', icon: '🎰' },
];

export default function CashPage() {
  const router = useRouter();
  const t = useTranslations('cash');
  const tCommon = useTranslations('common');
  const { user, token, refreshUser } = useAuthStore();

  // Deposits store
  const {
    deposits,
    depositAddress,
    rates,
    isLoading: isDepositsLoading,
    isInitiating,
    isConfirming: isDepositConfirming,
    error: depositsError,
    fetchDeposits,
    fetchDepositAddress,
    fetchRates,
    connectWallet: saveWalletToBackend,
    initiateDeposit,
    confirmDeposit,
    clearPendingDeposit,
    clearError: clearDepositsError,
  } = useDepositsStore();

  // Withdrawals store
  const {
    withdrawals,
    preview,
    isPreparing,
    isConfirming: isWithdrawConfirming,
    isProcessing,
    error: withdrawalsError,
    fetchWithdrawals,
    previewWithdrawal,
    prepareAtomicWithdrawal,
    confirmAtomicWithdrawal,
    cancelAtomicWithdrawal,
    createInstantWithdrawal,
    clearPreview,
    clearError: clearWithdrawalsError,
  } = useWithdrawalsStore();

  const { publicKey, connected, sendTransaction, signTransaction } = useWallet();
  const { connection } = useConnection();

  // Main tab: deposit or withdraw
  const [mainTab, setMainTab] = useState<MainTabType>('deposit');
  // Deposit sub-tabs
  const [depositTab, setDepositTab] = useState<DepositTabType>('wallet');
  // Withdraw sub-tabs
  const [withdrawTab, setWithdrawTab] = useState<WithdrawTabType>('wallet');

  const [selectedCurrency, setSelectedCurrency] = useState<DepositCurrency>('SOL');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawAddress, setWithdrawAddress] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [isOtherCryptoModalOpen, setIsOtherCryptoModalOpen] = useState(false);

  // Memoize wallet address to prevent re-renders
  const walletAddress = useMemo(
    () => (publicKey ? publicKey.toBase58() : null),
    [publicKey],
  );

  // Redirect if not authenticated
  useEffect(() => {
    if (!token) {
      router.push('/');
    }
  }, [token, router]);

  // Fetch initial data
  useEffect(() => {
    if (token) {
      fetchDeposits(token);
      fetchWithdrawals(token);
      fetchRates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Real-time deposit updates
  useOnDepositCredited(
    useCallback(() => {
      // Refresh deposits list when new deposit is credited
      if (token) {
        fetchDeposits(token);
      }
    }, [token, fetchDeposits])
  );

  // Auto-connect wallet if user has web3Address
  useEffect(() => {
    const autoConnectWallet = async () => {
      // Only auto-connect if:
      // 1. User has a web3Address (previously connected via Web3 auth)
      // 2. Wallet is not already connected
      // 3. Solana wallet is available
      if (user?.web3Address && !connected && typeof window !== 'undefined' && window.solana) {
        try {
          // Silent connect - won't show popup if previously approved
          await window.solana.connect({ onlyIfTrusted: true });
        } catch (error) {
          // Silent connect failed - user needs to manually connect
          console.log('Auto-connect skipped - user needs to manually approve');
        }
      }
    };

    autoConnectWallet();
  }, [user?.web3Address, connected]);

  // Save wallet connection when connected
  useEffect(() => {
    if (connected && walletAddress && token) {
      saveWalletToBackend(token, walletAddress).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, walletAddress, token]);

  // Fetch deposit address when switching to address tab
  useEffect(() => {
    if (mainTab === 'deposit' && depositTab === 'address' && token && !depositAddress) {
      fetchDepositAddress(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, depositTab, token]);

  // Preview withdrawal when amount changes (debounced)
  useEffect(() => {
    if (mainTab !== 'withdraw' || !token) return;

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      clearPreview();
      return;
    }

    const timer = setTimeout(() => {
      previewWithdrawal(token, amount).catch(() => {});
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawAmount, mainTab, token]);

  // Clear errors on tab change
  useEffect(() => {
    clearDepositsError();
    clearWithdrawalsError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, depositTab, withdrawTab]);

  // Calculate USD value for deposit
  const depositUsdValue = useCallback(() => {
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

  // Handle deposit with wallet
  const handleWalletDeposit = useCallback(async () => {
    if (!connected || !publicKey || !token || !depositAmount) {
      toast.error(t('pleaseConnectWallet'));
      return;
    }

    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error(t('invalidAmount'));
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

      toast.success(t('depositConfirmed'));
      setDepositAmount('');
      refreshUser();
    } catch (err) {
      console.error('Deposit failed:', err);
      toast.error(err instanceof Error ? err.message : t('depositFailed'));
      clearPendingDeposit();
    } finally {
      setIsSending(false);
    }
  }, [
    connected,
    publicKey,
    token,
    depositAmount,
    selectedCurrency,
    connection,
    sendTransaction,
    initiateDeposit,
    confirmDeposit,
    clearPendingDeposit,
    refreshUser,
    t,
  ]);

  // Handle atomic withdrawal (wallet connect)
  const handleAtomicWithdrawal = useCallback(async () => {
    if (!connected || !publicKey || !token || !signTransaction) {
      toast.error(t('pleaseConnectWallet'));
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('invalidAmount'));
      return;
    }

    setIsSending(true);
    let preparedId: string | null = null;
    try {
      // Prepare withdrawal (get partially signed transaction)
      const prepared = await prepareAtomicWithdrawal(
        token,
        amount,
        publicKey.toBase58(),
      );
      preparedId = prepared.withdrawalId;

      // Deserialize the transaction
      const txBuffer = Buffer.from(prepared.serializedTransaction, 'base64');
      const transaction = Transaction.from(txBuffer);

      // User signs the transaction
      const signedTx = await signTransaction(transaction);

      // Send to network
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      // Confirm with backend
      await confirmAtomicWithdrawal(token, prepared.withdrawalId, signature);

      toast.success(t('withdrawalSuccessful', { amount: prepared.usdtAmount.toFixed(2) }));
      setWithdrawAmount('');
      refreshUser();
    } catch (err) {
      console.error('Withdrawal failed:', err);
      toast.error(err instanceof Error ? err.message : t('withdrawalFailed'));

      // Cancel the prepared withdrawal if it exists
      if (preparedId) {
        try {
          await cancelAtomicWithdrawal(token, preparedId);
        } catch {
          // Ignore cancel errors
        }
      }
    } finally {
      setIsSending(false);
    }
  }, [
    connected,
    publicKey,
    token,
    signTransaction,
    withdrawAmount,
    connection,
    prepareAtomicWithdrawal,
    confirmAtomicWithdrawal,
    cancelAtomicWithdrawal,
    refreshUser,
    t,
  ]);

  // Handle instant withdrawal (manual address)
  const handleInstantWithdrawal = useCallback(async () => {
    if (!token || !withdrawAddress) {
      toast.error(t('pleaseEnterAddress'));
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('invalidAmount'));
      return;
    }

    // Validate Solana address
    try {
      new PublicKey(withdrawAddress);
    } catch {
      toast.error(t('invalidSolanaAddress'));
      return;
    }

    setIsSending(true);
    try {
      const result = await createInstantWithdrawal(token, amount, withdrawAddress);

      toast.success(t('withdrawalSuccessful', { amount: result.usdtAmount.toFixed(2) }));
      setWithdrawAmount('');
      setWithdrawAddress('');
      refreshUser();
    } catch (err) {
      console.error('Withdrawal failed:', err);
      toast.error(err instanceof Error ? err.message : t('withdrawalFailed'));
    } finally {
      setIsSending(false);
    }
  }, [token, withdrawAddress, withdrawAmount, createInstantWithdrawal, refreshUser, t]);

  // Copy address to clipboard
  const copyAddress = useCallback(() => {
    if (depositAddress?.address) {
      navigator.clipboard.writeText(depositAddress.address);
      toast.success(t('addressCopied'));
    }
  }, [depositAddress?.address, t]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'credited':
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  if (!token || !user) {
    return null;
  }

  const isDepositProcessing = isSending || isInitiating || isDepositConfirming;
  const isWithdrawProcessing =
    isSending || isPreparing || isWithdrawConfirming || isProcessing;
  const error = depositsError || withdrawalsError;

  // Tax rate display (convert from decimal)
  const taxRatePercent = preview ? (preview.taxRate * 100).toFixed(0) : (parseFloat(user.currentTaxRate) * 100).toFixed(0);

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-[#1a0a2e] to-[#2a1040] rounded-2xl p-6 mb-6 border border-[#ff2d95]/20">
          <div className="text-sm text-gray-400 mb-1">{t('availableBalance')}</div>
          <div className="text-3xl font-bold text-white">
            $
            {parseFloat(user.fortuneBalance).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {t('taxRate', { rate: taxRatePercent, tier: user.maxTierReached || 1 })}
          </div>
        </div>

        {/* Main Tabs: Deposit / Withdraw */}
        <div className="flex bg-[#1a0a2e] rounded-xl p-1 mb-6">
          <button
            onClick={() => setMainTab('deposit')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
              mainTab === 'deposit'
                ? 'bg-[#ff2d95] text-white shadow-lg shadow-[#ff2d95]/25'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>{t('deposit')}</span>
          </button>
          <button
            onClick={() => setMainTab('withdraw')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
              mainTab === 'withdraw'
                ? 'bg-[#ff2d95] text-white shadow-lg shadow-[#ff2d95]/25'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowUpFromLine className="w-4 h-4" />
            <span>{t('withdraw')}</span>
          </button>
        </div>

        {/* ==================== DEPOSIT TAB ==================== */}
        {mainTab === 'deposit' && (
          <>
            {/* Deposit Sub-tabs */}
            <div className="flex bg-[#1a0a2e]/50 rounded-xl p-1 mb-6">
              <button
                onClick={() => setDepositTab('wallet')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  depositTab === 'wallet'
                    ? 'bg-[#2a1a4e] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>{t('wallet')}</span>
              </button>
              <button
                onClick={() => setDepositTab('address')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  depositTab === 'address'
                    ? 'bg-[#2a1a4e] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>{t('qrAddress')}</span>
              </button>
            </div>

            {/* Other Networks Button */}
            <button
              onClick={() => setIsOtherCryptoModalOpen(true)}
              className="
                w-full mb-6 p-4 rounded-xl
                bg-gradient-to-r from-amber-500/10 to-orange-500/10
                border border-amber-500/30 hover:border-amber-500/50
                flex items-center justify-between
                transition-all group
              "
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <span className="text-xl">🌐</span>
                </div>
                <div className="text-left">
                  <div className="text-white font-medium">
                    {t('otherNetworks')}
                  </div>
                  <div className="text-xs text-amber-200/80">
                    {t('otherNetworksDescription')}
                  </div>
                </div>
              </div>
              <div className="text-amber-400 group-hover:translate-x-1 transition-transform">
                →
              </div>
            </button>

            {/* Wallet Connect Deposit */}
            {depositTab === 'wallet' && (
              <div className="space-y-6">
                <div className="bg-[#1a0a2e] rounded-2xl p-6 border border-[#ff2d95]/10">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-white mb-1">
                        {t('connectWallet')}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {connected
                          ? t('walletConnectedDeposit')
                          : t('connectWalletToDeposit')}
                      </p>
                    </div>
                    <WalletMultiButton className="!bg-gradient-to-r !from-[#ff2d95] !to-[#8b5cf6] !rounded-xl !h-11 !text-sm !font-medium" />
                  </div>
                </div>

                {connected && (
                  <>
                    {/* Currency Selection */}
                    <div className="bg-[#1a0a2e] rounded-2xl p-6 border border-[#ff2d95]/10">
                      <h3 className="font-medium text-white mb-4">
                        {t('selectCurrency')}
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        {CURRENCIES.map((currency) => (
                          <button
                            key={currency.id}
                            onClick={() => setSelectedCurrency(currency.id)}
                            className={`relative p-4 rounded-xl border-2 transition-all ${
                              selectedCurrency === currency.id
                                ? 'border-[#ff2d95] bg-[#ff2d95]/10'
                                : 'border-transparent bg-[#0d0416] hover:border-[#ff2d95]/30'
                            }`}
                          >
                            <div className="text-2xl mb-2">{currency.icon}</div>
                            <div className="font-medium text-white text-sm">
                              {currency.label}
                            </div>
                            {rates && currency.id === 'SOL' && (
                              <div className="text-xs text-gray-500 mt-1">
                                ${rates.sol.toFixed(2)}
                              </div>
                            )}
                            {rates &&
                              currency.id === 'FORTUNE' &&
                              rates.fortune > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  ${rates.fortune.toFixed(6)}
                                </div>
                              )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Amount Input */}
                    <div className="bg-[#1a0a2e] rounded-2xl p-6 border border-[#ff2d95]/10">
                      <h3 className="font-medium text-white mb-4">{t('amount')}</h3>
                      <div className="relative">
                        <input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-[#0d0416] border border-[#2a1a4e] rounded-xl px-4 py-4 text-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff2d95] transition-colors"
                          min="0"
                          step="0.01"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                          {CURRENCIES.find((c) => c.id === selectedCurrency)?.label}
                        </div>
                      </div>
                      {depositAmount && parseFloat(depositAmount) > 0 && rates && (
                        <div className="mt-3 text-right text-gray-400">
                          ≈{' '}
                          <span className="text-white font-medium">
                            $
                            {depositUsdValue().toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>{' '}
                          USD
                        </div>
                      )}
                    </div>

                    {/* Deposit Button */}
                    <button
                      onClick={handleWalletDeposit}
                      disabled={
                        !depositAmount ||
                        parseFloat(depositAmount) <= 0 ||
                        isDepositProcessing
                      }
                      className="w-full py-4 bg-gradient-to-r from-[#ff2d95] to-[#8b5cf6] rounded-xl font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shadow-lg shadow-[#ff2d95]/20"
                    >
                      {isDepositProcessing ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {tCommon('processing')}
                        </span>
                      ) : (
                        t('deposit')
                      )}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Deposit Address Tab */}
            {depositTab === 'address' && (
              <div className="space-y-6">
                {isDepositsLoading && !depositAddress ? (
                  <div className="bg-[#1a0a2e] rounded-2xl p-12 border border-[#ff2d95]/10 text-center">
                    <div className="w-8 h-8 border-2 border-[#ff2d95]/30 border-t-[#ff2d95] rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">{t('loadingDepositAddress')}</p>
                  </div>
                ) : depositAddress ? (
                  <>
                    <div className="bg-[#1a0a2e] rounded-2xl p-6 border border-[#ff2d95]/10">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                        <div className="flex-shrink-0 mx-auto lg:mx-0">
                          <div className="bg-white p-4 rounded-xl">
                            <img
                              src={depositAddress.qrCode}
                              alt="Deposit QR Code"
                              className="w-40 h-40 lg:w-48 lg:h-48"
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white mb-2">
                            {t('depositAddress')}
                          </h3>
                          <p className="text-sm text-gray-400 mb-4">
                            {t('sendToAddress')}
                          </p>
                          <div className="bg-[#0d0416] rounded-xl p-4 mb-4">
                            <code className="text-sm text-[#ff2d95] break-all font-mono">
                              {depositAddress.address}
                            </code>
                          </div>
                          <button
                            onClick={copyAddress}
                            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-[#2a1a4e] hover:bg-[#3a2a5e] rounded-xl text-white font-medium transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                            {t('copyAddress')}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#1a0a2e] rounded-2xl p-6 border border-yellow-500/20">
                      <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-500 mb-2">
                            {t('important')}
                          </h4>
                          <ul className="text-sm text-gray-400 space-y-1">
                            <li>• {t('importantNotes.onlySend')}</li>
                            <li>
                              • {t('importantNotes.minDeposit', { amount: depositAddress.minDeposit })}
                            </li>
                            <li>
                              • {t('importantNotes.autoCredit')}
                            </li>
                            <li>
                              • {t('importantNotes.otherTokensLoss')}
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {/* Recent Deposits */}
            {deposits.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-white mb-4">
                  {t('recentDeposits')}
                </h2>
                <div className="bg-[#1a0a2e] rounded-2xl border border-[#ff2d95]/10 overflow-hidden">
                  {deposits.slice(0, 5).map((deposit, index) => (
                    <div
                      key={deposit.id}
                      className={`flex items-center justify-between p-4 ${
                        index !== 0 ? 'border-t border-[#2a1a4e]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(deposit.status)}
                        <div>
                          <div className="font-medium text-white">
                            {deposit.amount}{' '}
                            {deposit.currency === 'USDT_SOL'
                              ? 'USDT'
                              : deposit.currency}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(deposit.createdAt).toLocaleDateString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`text-xs font-medium px-3 py-1 rounded-full ${
                          deposit.status === 'credited'
                            ? 'bg-green-500/10 text-green-400'
                            : deposit.status === 'failed'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-yellow-500/10 text-yellow-400'
                        }`}
                      >
                        {deposit.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== WITHDRAW TAB ==================== */}
        {mainTab === 'withdraw' && (
          <>
            {/* Withdraw Sub-tabs */}
            <div className="flex bg-[#1a0a2e]/50 rounded-xl p-1 mb-6">
              <button
                onClick={() => setWithdrawTab('wallet')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  withdrawTab === 'wallet'
                    ? 'bg-[#2a1a4e] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>{t('walletConnect')}</span>
              </button>
              <button
                onClick={() => setWithdrawTab('address')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  withdrawTab === 'address'
                    ? 'bg-[#2a1a4e] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Copy className="w-4 h-4" />
                <span>{t('enterAddress')}</span>
              </button>
            </div>

            {/* Wallet Connect Withdrawal */}
            {withdrawTab === 'wallet' && (
              <div className="space-y-6">
                <div className="bg-[#1a0a2e] rounded-2xl p-6 border border-[#ff2d95]/10">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-white mb-1">
                        {t('connectWallet')}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {connected
                          ? t('walletConnectedWithdraw')
                          : t('connectWalletToReceive')}
                      </p>
                    </div>
                    <WalletMultiButton className="!bg-gradient-to-r !from-[#ff2d95] !to-[#8b5cf6] !rounded-xl !h-11 !text-sm !font-medium" />
                  </div>
                </div>

                {connected && (
                  <>
                    {/* Amount Input */}
                    <div className="bg-[#1a0a2e] rounded-2xl p-6 border border-[#ff2d95]/10">
                      <h3 className="font-medium text-white mb-4">
                        {t('amountUsd')}
                      </h3>
                      <div className="relative">
                        <input
                          type="number"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-[#0d0416] border border-[#2a1a4e] rounded-xl px-4 py-4 text-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff2d95] transition-colors"
                          min="1"
                          max={parseFloat(user.fortuneBalance)}
                          step="0.01"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                          USD
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-500">
                        {t('minMax', { min: '1', max: Math.min(parseFloat(user.fortuneBalance), 10000).toFixed(2) })}
                      </div>
                    </div>

                    {/* Tax Breakdown */}
                    {preview && (
                      <div className="bg-[#1a0a2e] rounded-2xl p-6 border border-[#ff2d95]/10">
                        <h3 className="font-medium text-white mb-4">
                          {t('breakdown')}
                        </h3>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between text-gray-400">
                            <span>{t('fromDeposits')}</span>
                            <span className="text-white">
                              ${preview.fromFreshDeposit.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>{t('fromProfit', { rate: (preview.taxRate * 100).toFixed(0) })}</span>
                            <span className="text-white">
                              ${preview.fromProfit.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-red-400">
                            <span>{t('taxAmount')}</span>
                            <span>-${preview.taxAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>{t('networkFee')}</span>
                            <span className="text-white">
                              {preview.feeSol} SOL
                            </span>
                          </div>
                          <div className="border-t border-[#2a1a4e] pt-3 flex justify-between font-semibold">
                            <span className="text-white">{t('youReceive')}</span>
                            <span className="text-green-400 text-lg">
                              {preview.usdtAmount.toFixed(2)} USDT
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Info */}
                    <div className="bg-[#1a0a2e] rounded-2xl p-6 border border-blue-500/20">
                      <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-400 mb-2">
                            {t('atomicWithdrawal')}
                          </h4>
                          <p className="text-sm text-gray-400">
                            {t('atomicDescription')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Withdraw Button */}
                    <button
                      onClick={handleAtomicWithdrawal}
                      disabled={
                        !withdrawAmount ||
                        parseFloat(withdrawAmount) <= 0 ||
                        !preview ||
                        isWithdrawProcessing
                      }
                      className="w-full py-4 bg-gradient-to-r from-[#ff2d95] to-[#8b5cf6] rounded-xl font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shadow-lg shadow-[#ff2d95]/20"
                    >
                      {isWithdrawProcessing ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {tCommon('processing')}
                        </span>
                      ) : preview ? (
                        t('withdrawButton', { amount: withdrawAmount, usdt: preview.usdtAmount.toFixed(2) })
                      ) : (
                        t('enterAmount')
                      )}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Manual Address Withdrawal */}
            {withdrawTab === 'address' && (
              <div className="space-y-6">
                {/* Amount Input */}
                <div className="bg-[#1a0a2e] rounded-2xl p-6 border border-[#ff2d95]/10">
                  <h3 className="font-medium text-white mb-4">{t('amountUsd')}</h3>
                  <div className="relative">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#0d0416] border border-[#2a1a4e] rounded-xl px-4 py-4 text-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff2d95] transition-colors"
                      min="1"
                      max={parseFloat(user.fortuneBalance)}
                      step="0.01"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                      USD
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    {t('minMax', { min: '1', max: Math.min(parseFloat(user.fortuneBalance), 10000).toFixed(2) })}
                  </div>
                </div>

                {/* Wallet Address Input */}
                <div className="bg-[#1a0a2e] rounded-2xl p-6 border border-[#ff2d95]/10">
                  <h3 className="font-medium text-white mb-4">
                    {t('usdtAddressSolana')}
                  </h3>
                  <input
                    type="text"
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    placeholder={t('enterSolanaAddress')}
                    className="w-full bg-[#0d0416] border border-[#2a1a4e] rounded-xl px-4 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-[#ff2d95] transition-colors font-mono text-sm"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    {t('makeAddressNote')}
                  </p>
                </div>

                {/* Tax Breakdown */}
                {preview && (
                  <div className="bg-[#1a0a2e] rounded-2xl p-6 border border-[#ff2d95]/10">
                    <h3 className="font-medium text-white mb-4">{t('breakdown')}</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between text-gray-400">
                        <span>{t('fromDeposits')}</span>
                        <span className="text-white">
                          ${preview.fromFreshDeposit.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>{t('fromProfit', { rate: (preview.taxRate * 100).toFixed(0) })}</span>
                        <span className="text-white">
                          ${preview.fromProfit.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-red-400">
                        <span>{t('taxAmount')}</span>
                        <span>-${preview.taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-[#2a1a4e] pt-3 flex justify-between font-semibold">
                        <span className="text-white">{t('youReceive')}</span>
                        <span className="text-green-400 text-lg">
                          {preview.usdtAmount.toFixed(2)} USDT
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info */}
                <div className="bg-[#1a0a2e] rounded-2xl p-6 border border-green-500/20">
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-400 mb-2">
                        {t('instantWithdrawal')}
                      </h4>
                      <p className="text-sm text-gray-400">
                        {t('instantDescription')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Withdraw Button */}
                <button
                  onClick={handleInstantWithdrawal}
                  disabled={
                    !withdrawAmount ||
                    parseFloat(withdrawAmount) <= 0 ||
                    !withdrawAddress ||
                    !preview ||
                    isWithdrawProcessing
                  }
                  className="w-full py-4 bg-gradient-to-r from-[#ff2d95] to-[#8b5cf6] rounded-xl font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shadow-lg shadow-[#ff2d95]/20"
                >
                  {isWithdrawProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('sending')}
                    </span>
                  ) : preview ? (
                    t('withdrawButton', { amount: withdrawAmount, usdt: preview.usdtAmount.toFixed(2) })
                  ) : (
                    t('enterAmount')
                  )}
                </button>
              </div>
            )}

            {/* Recent Withdrawals */}
            {withdrawals.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-white mb-4">
                  {t('recentWithdrawals')}
                </h2>
                <div className="bg-[#1a0a2e] rounded-2xl border border-[#ff2d95]/10 overflow-hidden">
                  {withdrawals.slice(0, 5).map((withdrawal, index) => (
                    <div
                      key={withdrawal.id}
                      className={`flex items-center justify-between p-4 ${
                        index !== 0 ? 'border-t border-[#2a1a4e]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(withdrawal.status)}
                        <div>
                          <div className="font-medium text-white">
                            ${withdrawal.requestedAmount.toFixed(2)} →{' '}
                            {withdrawal.usdtAmount.toFixed(2)} USDT
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(withdrawal.createdAt).toLocaleDateString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`text-xs font-medium px-3 py-1 rounded-full ${
                          withdrawal.status === 'completed'
                            ? 'bg-green-500/10 text-green-400'
                            : withdrawal.status === 'failed'
                              ? 'bg-red-500/10 text-red-400'
                              : withdrawal.status === 'cancelled'
                                ? 'bg-gray-500/10 text-gray-400'
                                : 'bg-yellow-500/10 text-yellow-400'
                        }`}
                      >
                        {withdrawal.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Other Crypto Modal */}
      <OtherCryptoModal
        isOpen={isOtherCryptoModalOpen}
        onClose={() => setIsOtherCryptoModalOpen(false)}
      />

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto bg-red-900/95 backdrop-blur text-red-200 px-4 py-3 rounded-xl flex items-center justify-between shadow-xl">
          <span className="text-sm">{error}</span>
          <button
            onClick={() => {
              clearDepositsError();
              clearWithdrawalsError();
            }}
            className="p-1 hover:bg-red-800 rounded"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
