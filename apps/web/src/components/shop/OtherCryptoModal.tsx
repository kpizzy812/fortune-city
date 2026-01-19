'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Copy, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useDepositsStore } from '@/stores/deposits.store';
import { useAuthStore } from '@/stores/auth.store';
import type {
  OtherCryptoNetwork,
  OtherCryptoToken,
} from '@/types';

interface OtherCryptoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4;

const NETWORKS: { id: OtherCryptoNetwork; name: string; icon: string }[] = [
  { id: 'BEP20', name: 'BNB Smart Chain (BEP20)', icon: '🔶' },
  { id: 'TON', name: 'The Open Network (TON)', icon: '💎' },
];

const TOKENS_BY_NETWORK: Record<OtherCryptoNetwork, { id: OtherCryptoToken; name: string; icon: string }[]> = {
  BEP20: [
    { id: 'USDT', name: 'USDT', icon: '$' },
    { id: 'BNB', name: 'BNB', icon: '🔶' },
  ],
  TON: [
    { id: 'USDT', name: 'USDT (TON)', icon: '$' },
    { id: 'TON', name: 'TON', icon: '💎' },
  ],
};

export function OtherCryptoModal({ isOpen, onClose }: OtherCryptoModalProps) {
  const t = useTranslations('cash');
  const { token } = useAuthStore();
  const {
    otherCryptoInstructions,
    isLoadingInstructions,
    isInitiating,
    fetchOtherCryptoInstructions,
    initiateOtherCryptoDeposit,
    fetchDeposits,
  } = useDepositsStore();

  const [step, setStep] = useState<Step>(1);
  const [selectedNetwork, setSelectedNetwork] = useState<OtherCryptoNetwork | null>(null);
  const [selectedToken, setSelectedToken] = useState<OtherCryptoToken | null>(null);
  const [claimedAmount, setClaimedAmount] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Reset state function
  const resetState = useCallback(() => {
    setStep(1);
    setSelectedNetwork(null);
    setSelectedToken(null);
    setClaimedAmount('');
    setCopiedAddress(false);
  }, []);

  // Handle modal close
  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  // Fetch instructions when network is selected
  useEffect(() => {
    if (selectedNetwork && step === 3) {
      fetchOtherCryptoInstructions(selectedNetwork);
    }
  }, [selectedNetwork, step, fetchOtherCryptoInstructions]);

  // Handle network selection
  const handleNetworkSelect = (network: OtherCryptoNetwork) => {
    setSelectedNetwork(network);
    setSelectedToken(null);
    setStep(2);
  };

  // Handle token selection
  const handleTokenSelect = (tokenId: OtherCryptoToken) => {
    setSelectedToken(tokenId);
    setStep(3);
  };

  // Copy address to clipboard
  const handleCopyAddress = useCallback(() => {
    if (otherCryptoInstructions) {
      navigator.clipboard.writeText(otherCryptoInstructions.depositAddress);
      setCopiedAddress(true);
      toast.success(t('otherCrypto.addressCopied'));
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  }, [otherCryptoInstructions, t]);

  // Handle final submission
  const handleSubmit = async () => {
    if (!token || !selectedNetwork || !selectedToken || !claimedAmount) {
      toast.error(t('otherCrypto.fillAllFields'));
      return;
    }

    const amount = parseFloat(claimedAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('otherCrypto.invalidAmount'));
      return;
    }

    // Check minimum amount
    const minAmount = otherCryptoInstructions?.minAmounts[selectedToken];
    if (minAmount && amount < minAmount) {
      toast.error(t('otherCrypto.belowMinimum', { min: minAmount, token: selectedToken }));
      return;
    }

    try {
      await initiateOtherCryptoDeposit(token, {
        network: selectedNetwork,
        token: selectedToken,
        claimedAmount: amount,
      });

      toast.success(t('otherCrypto.depositSubmitted'));
      await fetchDeposits(token);
      handleClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('otherCrypto.depositFailed');
      toast.error(message);
    }
  };

  // Get current tokens list
  const availableTokens = selectedNetwork ? TOKENS_BY_NETWORK[selectedNetwork] : [];

  // Get min amount for selected token
  const minAmount = selectedToken && otherCryptoInstructions
    ? otherCryptoInstructions.minAmounts[selectedToken]
    : null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('otherCrypto.title')}>
      <div className="p-6 space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-4">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`
                flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold
                ${
                  s === step
                    ? 'bg-[#ff2d95] text-white'
                    : s < step
                      ? 'bg-[#ff2d95]/30 text-white'
                      : 'bg-white/10 text-[#b0b0b0]'
                }
              `}
            >
              {s}
            </div>
          ))}
        </div>

        {/* Step 1: Network Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">
              {t('otherCrypto.selectNetwork')}
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {NETWORKS.map((network) => (
                <button
                  key={network.id}
                  onClick={() => handleNetworkSelect(network.id)}
                  className="
                    flex items-center justify-between p-4 rounded-lg
                    bg-white/5 hover:bg-white/10
                    border border-[#ff2d95]/20 hover:border-[#ff2d95]/50
                    transition-all
                  "
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{network.icon}</span>
                    <span className="text-white font-medium">{network.name}</span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#ff2d95]" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Token Selection */}
        {step === 2 && (
          <div className="space-y-4">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-[#b0b0b0] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('otherCrypto.back')}
            </button>
            <h3 className="text-lg font-semibold text-white">
              {t('otherCrypto.selectToken')}
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {availableTokens.map((tokenItem) => (
                <button
                  key={tokenItem.id}
                  onClick={() => handleTokenSelect(tokenItem.id)}
                  className="
                    flex items-center justify-between p-4 rounded-lg
                    bg-white/5 hover:bg-white/10
                    border border-[#ff2d95]/20 hover:border-[#ff2d95]/50
                    transition-all
                  "
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{tokenItem.icon}</span>
                    <span className="text-white font-medium">{tokenItem.name}</span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#ff2d95]" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Instructions */}
        {step === 3 && (
          <div className="space-y-4">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 text-[#b0b0b0] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('otherCrypto.back')}
            </button>

            {isLoadingInstructions ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-[#ff2d95]/30 border-t-[#ff2d95] rounded-full animate-spin" />
              </div>
            ) : otherCryptoInstructions ? (
              <>
                <h3 className="text-lg font-semibold text-white">
                  {t('otherCrypto.instructions')}
                </h3>

                {/* Deposit Address */}
                <div className="space-y-2">
                  <label className="text-sm text-[#b0b0b0]">
                    {t('otherCrypto.depositAddress')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={otherCryptoInstructions.depositAddress}
                      readOnly
                      className="
                        flex-1 px-4 py-3 rounded-lg
                        bg-white/5 border border-[#ff2d95]/20
                        text-white text-sm font-mono
                        cursor-text select-all
                      "
                    />
                    <button
                      onClick={handleCopyAddress}
                      className="
                        px-4 py-3 rounded-lg
                        bg-[#ff2d95]/20 hover:bg-[#ff2d95]/30
                        border border-[#ff2d95]/50
                        transition-colors
                      "
                    >
                      {copiedAddress ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <Copy className="w-5 h-5 text-white" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Min Amounts */}
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm text-amber-200 font-medium">
                        {t('otherCrypto.minimumAmounts')}
                      </p>
                      <ul className="space-y-1 text-sm text-amber-100">
                        {Object.entries(otherCryptoInstructions.minAmounts).map(
                          ([token, amount]) => (
                            <li key={token}>
                              {token}: {amount} {token}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Instructions text */}
                <div className="p-4 rounded-lg bg-white/5 border border-[#ff2d95]/20">
                  <p className="text-sm text-[#b0b0b0] whitespace-pre-wrap">
                    {otherCryptoInstructions.instructions}
                  </p>
                </div>

                {/* Block Explorer */}
                <a
                  href={otherCryptoInstructions.blockExplorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    flex items-center justify-center gap-2 py-3 px-4
                    rounded-lg bg-white/5 hover:bg-white/10
                    border border-[#ff2d95]/20 hover:border-[#ff2d95]/50
                    text-white transition-all
                  "
                >
                  <span>{t('otherCrypto.viewBlockExplorer')}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                {/* Next button */}
                <Button onClick={() => setStep(4)} className="w-full">
                  {t('otherCrypto.next')}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-red-400">
                {t('otherCrypto.failedToLoadInstructions')}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="space-y-4">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 text-[#b0b0b0] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('otherCrypto.back')}
            </button>

            <h3 className="text-lg font-semibold text-white">
              {t('otherCrypto.confirmDeposit')}
            </h3>

            {/* Summary */}
            <div className="p-4 rounded-lg bg-white/5 border border-[#ff2d95]/20 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#b0b0b0]">{t('otherCrypto.network')}</span>
                <span className="text-white font-medium">
                  {NETWORKS.find((n) => n.id === selectedNetwork)?.name}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#b0b0b0]">{t('otherCrypto.token')}</span>
                <span className="text-white font-medium">{selectedToken}</span>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-sm text-[#b0b0b0]">
                {t('otherCrypto.amountSent')}
              </label>
              <input
                type="number"
                step="any"
                min={minAmount || 0}
                value={claimedAmount}
                onChange={(e) => setClaimedAmount(e.target.value)}
                placeholder={minAmount ? `Min: ${minAmount}` : '0.00'}
                className="
                  w-full px-4 py-3 rounded-lg
                  bg-white/5 border border-[#ff2d95]/20 focus:border-[#ff2d95]/50
                  text-white placeholder:text-[#b0b0b0]/50
                  outline-none transition-colors
                "
              />
              {minAmount && (
                <p className="text-xs text-[#b0b0b0]">
                  {t('otherCrypto.minimumAmount')}: {minAmount} {selectedToken}
                </p>
              )}
            </div>

            {/* Warning */}
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200">
                  {t('otherCrypto.confirmationWarning')}
                </p>
              </div>
            </div>

            {/* Submit button */}
            <Button
              onClick={handleSubmit}
              disabled={isInitiating || !claimedAmount}
              className="w-full"
            >
              {isInitiating ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('otherCrypto.submitting')}
                </div>
              ) : (
                t('otherCrypto.submitDeposit')
              )}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
