'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Image from 'next/image';
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

const NETWORKS: { id: OtherCryptoNetwork; name: string; icon: string; badge?: undefined }[] = [
  { id: 'BEP20', name: 'BNB Smart Chain (BEP20)', icon: '/bsc.png' },
  { id: 'TON', name: 'The Open Network (TON)', icon: '/ton.png' },
];

const TOKENS_BY_NETWORK: Record<
  OtherCryptoNetwork,
  { id: OtherCryptoToken; name: string; icon: string; badge?: string }[]
> = {
  BEP20: [
    { id: 'USDT', name: 'USDT', icon: '/usdt.png', badge: '/bsc.png' },
    { id: 'BNB', name: 'BNB', icon: '/bsc.png' },
  ],
  TON: [
    { id: 'USDT', name: 'USDT', icon: '/usdt.png', badge: '/ton.png' },
    { id: 'TON', name: 'TON', icon: '/ton.png' },
  ],
};

function TokenIcon({ icon, badge, size = 32 }: { icon: string; badge?: string; size?: number }) {
  const badgeSize = Math.round(size * 0.45);
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <Image
        src={icon}
        alt=""
        width={size}
        height={size}
        className="rounded-full"
      />
      {badge && (
        <div
          className="absolute -bottom-0.5 -right-0.5 bg-[#1a0a2e] rounded-full p-0.5"
          style={{ width: badgeSize + 4, height: badgeSize + 4 }}
        >
          <Image
            src={badge}
            alt=""
            width={badgeSize}
            height={badgeSize}
            className="rounded-full"
          />
        </div>
      )}
    </div>
  );
}

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

  const resetState = useCallback(() => {
    setStep(1);
    setSelectedNetwork(null);
    setSelectedToken(null);
    setClaimedAmount('');
    setCopiedAddress(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  useEffect(() => {
    if (selectedNetwork && step === 3) {
      fetchOtherCryptoInstructions(selectedNetwork);
    }
  }, [selectedNetwork, step, fetchOtherCryptoInstructions]);

  const handleNetworkSelect = (network: OtherCryptoNetwork) => {
    setSelectedNetwork(network);
    setSelectedToken(null);
    setStep(2);
  };

  const handleTokenSelect = (tokenId: OtherCryptoToken) => {
    setSelectedToken(tokenId);
    setStep(3);
  };

  const handleCopyAddress = useCallback(() => {
    if (otherCryptoInstructions) {
      navigator.clipboard.writeText(otherCryptoInstructions.depositAddress);
      setCopiedAddress(true);
      toast.success(t('otherCrypto.addressCopied'));
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  }, [otherCryptoInstructions, t]);

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

  const availableTokens = selectedNetwork ? TOKENS_BY_NETWORK[selectedNetwork] : [];
  const selectedTokenInfo = selectedNetwork && selectedToken
    ? TOKENS_BY_NETWORK[selectedNetwork].find((t) => t.id === selectedToken)
    : null;

  const minAmount = selectedToken && otherCryptoInstructions
    ? otherCryptoInstructions.minAmounts[selectedToken]
    : null;

  const stepLabels = [
    t('otherCrypto.selectNetwork'),
    t('otherCrypto.selectToken'),
    t('otherCrypto.instructions'),
    t('otherCrypto.confirmDeposit'),
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('otherCrypto.title')}>
      <div className="space-y-3">
        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all ${
                s <= step ? 'bg-[#ff2d95]' : 'bg-[#2a1a4e]'
              }`}
            />
          ))}
        </div>
        <p className="text-[10px] text-gray-500 text-center">
          {step}/4 — {stepLabels[step - 1]}
        </p>

        {/* Step 1: Network Selection */}
        {step === 1 && (
          <div className="space-y-2">
            {NETWORKS.map((network) => (
              <button
                key={network.id}
                onClick={() => handleNetworkSelect(network.id)}
                className="
                  w-full flex items-center justify-between p-3 rounded-xl
                  bg-[#1a0a2e] hover:bg-[#1a0a2e]/80
                  border border-[#ff2d95]/10 hover:border-[#ff2d95]/30
                  transition-all group
                "
              >
                <div className="flex items-center gap-3">
                  <TokenIcon icon={network.icon} size={36} />
                  <span className="text-white font-medium text-sm">{network.name}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-[#ff2d95] group-hover:translate-x-0.5 transition-transform" />
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Token Selection */}
        {step === 2 && (
          <div className="space-y-2">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('otherCrypto.back')}
            </button>

            {/* Selected network chip */}
            <div className="flex items-center gap-2 bg-[#1a0a2e] rounded-lg px-3 py-2 border border-[#ff2d95]/10">
              <TokenIcon icon={NETWORKS.find((n) => n.id === selectedNetwork)!.icon} size={20} />
              <span className="text-white text-xs font-medium">
                {NETWORKS.find((n) => n.id === selectedNetwork)!.name}
              </span>
            </div>

            {availableTokens.map((tokenItem) => (
              <button
                key={tokenItem.id}
                onClick={() => handleTokenSelect(tokenItem.id)}
                className="
                  w-full flex items-center justify-between p-3 rounded-xl
                  bg-[#1a0a2e] hover:bg-[#1a0a2e]/80
                  border border-[#ff2d95]/10 hover:border-[#ff2d95]/30
                  transition-all group
                "
              >
                <div className="flex items-center gap-3">
                  <TokenIcon icon={tokenItem.icon} badge={tokenItem.badge} size={36} />
                  <span className="text-white font-medium text-sm">{tokenItem.name}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-[#ff2d95] group-hover:translate-x-0.5 transition-transform" />
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Instructions */}
        {step === 3 && (
          <div className="space-y-3">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('otherCrypto.back')}
            </button>

            {isLoadingInstructions ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#ff2d95]/30 border-t-[#ff2d95] rounded-full animate-spin" />
              </div>
            ) : otherCryptoInstructions ? (
              <>
                {/* Selected network + token summary */}
                <div className="flex items-center gap-2 bg-[#1a0a2e] rounded-lg px-3 py-2 border border-[#ff2d95]/10">
                  {selectedTokenInfo && (
                    <TokenIcon icon={selectedTokenInfo.icon} badge={selectedTokenInfo.badge} size={20} />
                  )}
                  <span className="text-white text-xs font-medium">
                    {selectedToken} — {NETWORKS.find((n) => n.id === selectedNetwork)?.name}
                  </span>
                </div>

                {/* Deposit Address */}
                <div className="bg-[#1a0a2e] rounded-xl p-3 border border-[#ff2d95]/10">
                  <label className="block text-xs text-gray-400 mb-1.5">
                    {t('otherCrypto.depositAddress')}
                  </label>
                  <div className="bg-[#0d0416] rounded-lg p-2 mb-2">
                    <code className="text-[10px] sm:text-xs text-[#ff2d95] break-all font-mono leading-tight block">
                      {otherCryptoInstructions.depositAddress}
                    </code>
                  </div>
                  <button
                    onClick={handleCopyAddress}
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#2a1a4e] hover:bg-[#3a2a5e] rounded-lg text-white text-xs font-medium transition-colors"
                  >
                    {copiedAddress ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        {t('otherCrypto.addressCopied')}
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        {t('copyAddress')}
                      </>
                    )}
                  </button>
                </div>

                {/* Min Amounts */}
                <div className="bg-[#1a0a2e] rounded-xl p-3 border border-yellow-500/20">
                  <div className="flex gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-yellow-500 font-medium mb-1">
                        {t('otherCrypto.minimumAmounts')}
                      </p>
                      <ul className="space-y-0.5 text-[10px] md:text-xs text-gray-400">
                        {Object.entries(otherCryptoInstructions.minAmounts).map(
                          ([tkn, amount]) => (
                            <li key={tkn}>
                              {tkn}: {amount} {tkn}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Instructions text */}
                {otherCryptoInstructions.instructions && (
                  <div className="bg-[#1a0a2e] rounded-xl p-3 border border-[#ff2d95]/10">
                    <p className="text-[10px] md:text-xs text-gray-400 whitespace-pre-wrap">
                      {otherCryptoInstructions.instructions}
                    </p>
                  </div>
                )}

                {/* Block Explorer */}
                <a
                  href={otherCryptoInstructions.blockExplorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    flex items-center justify-center gap-1.5 py-2 px-3
                    rounded-lg bg-[#1a0a2e] hover:bg-[#1a0a2e]/80
                    border border-[#ff2d95]/10 hover:border-[#ff2d95]/30
                    text-white text-xs transition-all
                  "
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t('otherCrypto.viewBlockExplorer')}</span>
                </a>

                {/* Next button */}
                <Button onClick={() => setStep(4)} className="w-full">
                  {t('otherCrypto.next')}
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </>
            ) : (
              <div className="text-center py-6 text-red-400 text-sm">
                {t('otherCrypto.failedToLoadInstructions')}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="space-y-3">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('otherCrypto.back')}
            </button>

            {/* Summary */}
            <div className="bg-[#1a0a2e] rounded-xl p-3 border border-[#ff2d95]/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{t('otherCrypto.network')}</span>
                <div className="flex items-center gap-2">
                  <TokenIcon icon={NETWORKS.find((n) => n.id === selectedNetwork)!.icon} size={16} />
                  <span className="text-white font-medium">
                    {NETWORKS.find((n) => n.id === selectedNetwork)?.name}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{t('otherCrypto.token')}</span>
                <div className="flex items-center gap-2">
                  {selectedTokenInfo && (
                    <TokenIcon icon={selectedTokenInfo.icon} badge={selectedTokenInfo.badge} size={16} />
                  )}
                  <span className="text-white font-medium">{selectedToken}</span>
                </div>
              </div>
            </div>

            {/* Amount Input */}
            <div className="bg-[#1a0a2e] rounded-xl p-3 border border-[#ff2d95]/10">
              <label className="block text-xs text-gray-400 mb-1.5">
                {t('otherCrypto.amountSent')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min={minAmount || 0}
                  value={claimedAmount}
                  onChange={(e) => setClaimedAmount(e.target.value)}
                  placeholder={minAmount ? `Min: ${minAmount}` : '0.00'}
                  className="
                    w-full bg-[#0d0416] border border-[#2a1a4e] rounded-lg
                    px-3 py-3 pr-16 text-lg text-white
                    placeholder-gray-600
                    focus:outline-none focus:border-[#ff2d95] transition-colors
                  "
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">
                  {selectedToken}
                </span>
              </div>
              {minAmount && (
                <p className="text-[10px] text-gray-500 mt-1.5">
                  {t('otherCrypto.minimumAmount')}: {minAmount} {selectedToken}
                </p>
              )}
            </div>

            {/* Warning */}
            <div className="bg-[#1a0a2e] rounded-xl p-3 border border-yellow-500/20">
              <div className="flex gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] md:text-xs text-gray-400">
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
