'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { useAuthStore } from '@/stores/auth.store';
import { useDepositsStore } from '@/stores/deposits.store';
import type { DepositCurrency } from '@/lib/api';

// Token mints (mainnet)
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const FORTUNE_MINT = process.env.NEXT_PUBLIC_FORTUNE_MINT_ADDRESS;

type TabType = 'wallet' | 'address';

export default function CashPage() {
  const router = useRouter();
  const { user, token, refreshUser } = useAuthStore();
  const {
    deposits,
    depositAddress,
    rates,
    isLoading,
    isInitiating,
    isConfirming,
    error,
    fetchDeposits,
    fetchDepositAddress,
    fetchRates,
    connectWallet: saveWalletToBackend,
    initiateDeposit,
    confirmDeposit,
    clearPendingDeposit,
    clearError,
  } = useDepositsStore();

  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [activeTab, setActiveTab] = useState<TabType>('wallet');
  const [selectedCurrency, setSelectedCurrency] = useState<DepositCurrency>('SOL');
  const [amount, setAmount] = useState<string>('');
  const [isSending, setIsSending] = useState(false);

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
      fetchRates();
    }
  }, [token, fetchDeposits, fetchRates]);

  // Save wallet connection when connected
  useEffect(() => {
    if (connected && publicKey && token) {
      saveWalletToBackend(token, publicKey.toBase58()).catch(() => {
        // Silently fail
      });
    }
  }, [connected, publicKey, token, saveWalletToBackend]);

  // Fetch deposit address when switching to address tab
  useEffect(() => {
    if (activeTab === 'address' && token && !depositAddress) {
      fetchDepositAddress(token);
    }
  }, [activeTab, token, depositAddress, fetchDepositAddress]);

  // Clear error on currency change
  useEffect(() => {
    clearError();
  }, [selectedCurrency, clearError]);

  // Calculate USD value
  const usdValue = useCallback(() => {
    if (!rates || !amount) return 0;
    const amountNum = parseFloat(amount) || 0;
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
  }, [rates, amount, selectedCurrency]);

  // Handle deposit with wallet
  const handleWalletDeposit = useCallback(async () => {
    if (!connected || !publicKey || !token || !amount) {
      toast.error('Please connect wallet and enter amount');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Invalid amount');
      return;
    }

    setIsSending(true);
    try {
      // 1. Initiate deposit on backend
      const depositInfo = await initiateDeposit(
        token,
        selectedCurrency,
        amountNum,
        publicKey.toBase58(),
      );

      // 2. Build and send transaction
      const recipientPubkey = new PublicKey(depositInfo.recipientAddress);
      const transaction = new Transaction();

      if (selectedCurrency === 'SOL') {
        // SOL transfer
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubkey,
            lamports: Math.floor(amountNum * LAMPORTS_PER_SOL),
          }),
        );
      } else {
        // SPL Token transfer
        const mintAddress =
          selectedCurrency === 'USDT_SOL' ? USDT_MINT : FORTUNE_MINT;
        if (!mintAddress) {
          throw new Error('Token mint not configured');
        }

        const mint = new PublicKey(mintAddress);
        const fromAta = await getAssociatedTokenAddress(mint, publicKey);
        const toAta = await getAssociatedTokenAddress(mint, recipientPubkey);

        // Get token decimals (USDT = 6, FORTUNE = 9)
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

      // Add memo if available
      // Note: memo program would need to be imported and added here

      const signature = await sendTransaction(transaction, connection);

      // 3. Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      // 4. Confirm on backend
      await confirmDeposit(token, depositInfo.depositId, signature);

      toast.success('Deposit confirmed!');
      setAmount('');
      refreshUser();
    } catch (err) {
      console.error('Deposit failed:', err);
      toast.error(err instanceof Error ? err.message : 'Deposit failed');
      clearPendingDeposit();
    } finally {
      setIsSending(false);
    }
  }, [
    connected,
    publicKey,
    token,
    amount,
    selectedCurrency,
    connection,
    sendTransaction,
    initiateDeposit,
    confirmDeposit,
    clearPendingDeposit,
    refreshUser,
  ]);

  // Copy address to clipboard
  const copyAddress = useCallback(() => {
    if (depositAddress?.address) {
      navigator.clipboard.writeText(depositAddress.address);
      toast.success('Address copied!');
    }
  }, [depositAddress?.address]);

  if (!token || !user) {
    return null;
  }

  return (
    <div className="min-h-screen p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="text-pink-400 hover:text-pink-300"
        >
          &larr; Back
        </button>
        <h1 className="text-xl font-bold">Deposit</h1>
        <div className="w-16" />
      </div>

      {/* Balance */}
      <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-xl p-4 mb-6 border border-pink-500/30">
        <div className="text-sm text-gray-400">Current Balance</div>
        <div className="text-2xl font-bold text-pink-400">
          ${parseFloat(user.fortuneBalance).toFixed(2)}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            activeTab === 'wallet'
              ? 'bg-pink-600 text-white'
              : 'bg-purple-900/50 text-gray-400 hover:bg-purple-800/50'
          }`}
        >
          Wallet Connect
        </button>
        <button
          onClick={() => setActiveTab('address')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            activeTab === 'address'
              ? 'bg-pink-600 text-white'
              : 'bg-purple-900/50 text-gray-400 hover:bg-purple-800/50'
          }`}
        >
          Deposit Address
        </button>
      </div>

      {/* Wallet Connect Tab */}
      {activeTab === 'wallet' && (
        <div className="space-y-4">
          {/* Wallet Button */}
          <div className="flex justify-center">
            <WalletMultiButton className="!bg-gradient-to-r !from-pink-600 !to-purple-600 !rounded-lg" />
          </div>

          {connected && publicKey && (
            <>
              {/* Connected Wallet */}
              <div className="bg-purple-900/30 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400">Connected</div>
                <div className="text-sm font-mono text-pink-400 truncate">
                  {publicKey.toBase58().slice(0, 8)}...
                  {publicKey.toBase58().slice(-8)}
                </div>
              </div>

              {/* Currency Selection */}
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Select Currency</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['SOL', 'USDT_SOL', 'FORTUNE'] as DepositCurrency[]).map(
                    (currency) => (
                      <button
                        key={currency}
                        onClick={() => setSelectedCurrency(currency)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          selectedCurrency === currency
                            ? 'bg-pink-600 text-white'
                            : 'bg-purple-900/50 text-gray-400 hover:bg-purple-800/50'
                        }`}
                      >
                        {currency === 'USDT_SOL' ? 'USDT' : currency}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-purple-900/30 border border-purple-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                    min="0"
                    step="0.01"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    {selectedCurrency === 'USDT_SOL' ? 'USDT' : selectedCurrency}
                  </div>
                </div>
                {amount && rates && (
                  <div className="text-sm text-gray-400 text-right">
                    ≈ ${usdValue().toFixed(2)} USD
                  </div>
                )}
              </div>

              {/* Deposit Button */}
              <button
                onClick={handleWalletDeposit}
                disabled={
                  !amount ||
                  parseFloat(amount) <= 0 ||
                  isSending ||
                  isInitiating ||
                  isConfirming
                }
                className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending || isInitiating || isConfirming
                  ? 'Processing...'
                  : 'Deposit'}
              </button>
            </>
          )}

          {!connected && (
            <div className="text-center text-gray-400 py-8">
              Connect your wallet to deposit
            </div>
          )}
        </div>
      )}

      {/* Deposit Address Tab */}
      {activeTab === 'address' && (
        <div className="space-y-4">
          {isLoading && !depositAddress && (
            <div className="text-center py-8 text-gray-400">
              Loading deposit address...
            </div>
          )}

          {depositAddress && (
            <>
              {/* QR Code */}
              <div className="bg-white p-4 rounded-xl flex justify-center">
                <img
                  src={depositAddress.qrCode}
                  alt="Deposit QR Code"
                  className="w-48 h-48"
                />
              </div>

              {/* Address */}
              <div className="bg-purple-900/30 rounded-lg p-4 space-y-2">
                <div className="text-sm text-gray-400">Deposit Address</div>
                <div className="font-mono text-sm text-pink-400 break-all">
                  {depositAddress.address}
                </div>
                <button
                  onClick={copyAddress}
                  className="w-full py-2 bg-purple-800/50 rounded-lg text-sm text-white hover:bg-purple-700/50 transition-colors"
                >
                  Copy Address
                </button>
              </div>

              {/* Info */}
              <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 text-sm text-yellow-400">
                <p className="font-medium mb-2">Important:</p>
                <ul className="list-disc list-inside space-y-1 text-yellow-400/80">
                  <li>Send only SOL, USDT or FORTUNE to this address</li>
                  <li>Minimum deposit: {depositAddress.minDeposit} SOL</li>
                  <li>Deposits are credited automatically after confirmation</li>
                </ul>
              </div>
            </>
          )}
        </div>
      )}

      {/* Recent Deposits */}
      {deposits.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-4">Recent Deposits</h2>
          <div className="space-y-2">
            {deposits.slice(0, 5).map((deposit) => (
              <div
                key={deposit.id}
                className="bg-purple-900/30 rounded-lg p-3 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium">
                    {deposit.amount}{' '}
                    {deposit.currency === 'USDT_SOL' ? 'USDT' : deposit.currency}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(deposit.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div
                  className={`text-sm px-2 py-1 rounded ${
                    deposit.status === 'credited'
                      ? 'bg-green-900/50 text-green-400'
                      : deposit.status === 'failed'
                        ? 'bg-red-900/50 text-red-400'
                        : 'bg-yellow-900/50 text-yellow-400'
                  }`}
                >
                  {deposit.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 left-4 right-4 bg-red-900/90 text-red-200 p-4 rounded-lg">
          {error}
          <button onClick={clearError} className="ml-2 text-red-400">
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
