'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Send, Wallet, Mail, Check, Copy, ExternalLink, LogOut, Bell, BellOff } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth.store';
import { TelegramLoginWidgetData } from '@/lib/api';
import { formatUserDisplayName, getUserInitial, shortenAddress } from '@/lib/utils';

// Extend Window for Telegram callback
declare global {
  interface Window {
    onTelegramLinkAuth?: (user: TelegramLoginWidgetData) => void;
  }
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const { user, linkTelegram, linkWeb3, sendLinkEmailMagicLink, clearAuth, isLoading, refreshUser } = useAuthStore();
  const tNav = useTranslations('nav');
  const [linkingTelegram, setLinkingTelegram] = useState(false);
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [linkingEmail, setLinkingEmail] = useState(false);

  const hasTelegram = !!user?.telegramId;
  const hasEmail = !!user?.email;
  const hasWallet = !!user?.web3Address;

  // Handle Telegram linking
  const handleTelegramLink = useCallback(
    async (data: TelegramLoginWidgetData) => {
      setLinkingTelegram(true);
      try {
        await linkTelegram(data);
        toast.success(t('linkSuccess'));
      } catch (error) {
        toast.error(t('linkError'));
        console.error('Link telegram error:', error);
      } finally {
        setLinkingTelegram(false);
      }
    },
    [linkTelegram, t]
  );

  // Set up Telegram widget callback
  useEffect(() => {
    if (isOpen && !hasTelegram) {
      window.onTelegramLinkAuth = handleTelegramLink;
    }
    return () => {
      window.onTelegramLinkAuth = undefined;
    };
  }, [isOpen, hasTelegram, handleTelegramLink]);

  // Handle wallet linking
  const handleLinkWallet = async () => {
    if (typeof window === 'undefined' || !window.solana) {
      toast.error('Solana wallet not found');
      return;
    }

    setLinkingWallet(true);
    try {
      await window.solana.connect();
      await linkWeb3();
      toast.success(t('linkSuccess'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        !errorMessage.includes('User rejected') &&
        !errorMessage.includes('cancelled')
      ) {
        toast.error(t('linkError'));
      }
    } finally {
      setLinkingWallet(false);
    }
  };

  // Handle email linking
  const handleSendEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setLinkingEmail(true);
    try {
      await sendLinkEmailMagicLink(emailInput.trim());
      setEmailSent(true);
      toast.success(t('emailSent'));
    } catch (error) {
      toast.error(t('linkError'));
      console.error('Send email link error:', error);
    } finally {
      setLinkingEmail(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(tCommon('copied'));
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Refresh user data when modal opens
  useEffect(() => {
    if (isOpen) {
      refreshUser();
    }
  }, [isOpen, refreshUser]);

  if (!user) return null;

  const displayName = formatUserDisplayName(user);
  const initial = getUserInitial(user);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('title')}>
      <div className="space-y-6">
        {/* User Info Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-white/10">
          <div className={`relative w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white ${
            user.isOG
              ? 'bg-gradient-to-br from-[#ffd700] via-[#ff2d95] to-[#00d4ff] ring-2 ring-[#ffd700]/50 shadow-[0_0_20px_rgba(255,215,0,0.3)]'
              : 'bg-gradient-to-br from-[#ff2d95] to-[#00d4ff]'
          }`}>
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white truncate">
                {displayName}
              </h3>
              {user.isOG && (
                <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#ffd700] to-[#ffaa00] text-black rounded-full">
                  OG
                </span>
              )}
            </div>
            {user.referralCode && (
              <p className="text-sm text-[#b0b0b0]">
                {t('referralCode')}: {user.referralCode}
              </p>
            )}
          </div>
        </div>

        {/* User ID */}
        <div className="bg-[#1a0a2e] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#b0b0b0]">{t('userId')}</span>
            <button
              onClick={() => copyToClipboard(user.id, 'userId')}
              className="text-[#00d4ff] hover:text-white transition-colors"
            >
              {copiedField === 'userId' ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-sm text-white font-mono truncate">{user.id}</p>
        </div>

        {/* Linked Accounts */}
        <div>
          <h4 className="text-sm font-medium text-[#b0b0b0] mb-3">
            {t('linkedAccounts')}
          </h4>
          <div className="space-y-3">
            {/* Telegram */}
            <div className="bg-[#1a0a2e] rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0088cc]/20 flex items-center justify-center">
                    <Send className="w-5 h-5 text-[#0088cc]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t('telegram')}</p>
                    {hasTelegram ? (
                      <p className="text-xs text-[#00ff88]">
                        {user.username ? `@${user.username}` : t('linked')}
                      </p>
                    ) : (
                      <p className="text-xs text-[#b0b0b0]">{t('notLinked')}</p>
                    )}
                  </div>
                </div>
                {hasTelegram ? (
                  <Check className="w-5 h-5 text-[#00ff88]" />
                ) : (
                  <TelegramLinkButton
                    onAuth={handleTelegramLink}
                    isLoading={linkingTelegram || isLoading}
                  />
                )}
              </div>

              {/* Telegram Notifications */}
              {hasTelegram && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {user.telegramNotificationsEnabled ? (
                        <Bell className="w-4 h-4 text-[#00ff88]" />
                      ) : (
                        <BellOff className="w-4 h-4 text-[#b0b0b0]" />
                      )}
                      <span className="text-xs text-white">
                        {t('notifications')}
                      </span>
                    </div>
                    {user.telegramNotificationsEnabled ? (
                      <span className="text-xs text-[#00ff88] font-medium">
                        {t('notificationsEnabled')}
                      </span>
                    ) : (
                      <a
                        href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'FortuneCityAppBot'}?start=connect_${user.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-[#0088cc] hover:bg-[#0088cc]/80 text-white rounded text-xs font-semibold transition-colors"
                      >
                        {t('enableNotifications')}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Email */}
            <div className="bg-[#1a0a2e] rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#ff2d95]/20 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-[#ff2d95]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t('email')}</p>
                    {hasEmail ? (
                      <p className="text-xs text-[#00ff88] truncate max-w-[150px]">
                        {user.email}
                      </p>
                    ) : (
                      <p className="text-xs text-[#b0b0b0]">{t('notLinked')}</p>
                    )}
                  </div>
                </div>
                {hasEmail ? (
                  <Check className="w-5 h-5 text-[#00ff88]" />
                ) : !showEmailForm ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEmailForm(true)}
                    className="text-xs"
                  >
                    {t('linkAccount')}
                  </Button>
                ) : null}
              </div>

              {/* Email Form */}
              {!hasEmail && showEmailForm && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  {emailSent ? (
                    <div className="text-center py-2">
                      <Check className="w-8 h-8 text-[#00ff88] mx-auto mb-2" />
                      <p className="text-sm text-[#00ff88]">{t('emailSentMessage')}</p>
                      <p className="text-xs text-[#b0b0b0] mt-1">{emailInput}</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSendEmailLink} className="flex gap-2">
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder={t('emailPlaceholder')}
                        className="flex-1 px-3 py-2 bg-[#0a0014] border border-white/10 rounded-lg text-sm text-white placeholder:text-[#b0b0b0] focus:outline-none focus:border-[#ff2d95]"
                        required
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        loading={linkingEmail}
                        className="text-xs"
                      >
                        {t('send')}
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Wallet */}
            <div className="bg-[#1a0a2e] rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/20 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-[#14F195]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t('wallet')}</p>
                    {hasWallet ? (
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-[#00ff88] font-mono">
                          {shortenAddress(user.web3Address!)}
                        </p>
                        <a
                          href={`https://solscan.io/account/${user.web3Address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#00d4ff] hover:text-white"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : (
                      <p className="text-xs text-[#b0b0b0]">{t('notLinked')}</p>
                    )}
                  </div>
                </div>
                {hasWallet ? (
                  <Check className="w-5 h-5 text-[#00ff88]" />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLinkWallet}
                    loading={linkingWallet || isLoading}
                    className="text-xs"
                  >
                    {t('linkAccount')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={() => {
            clearAuth();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 py-3 text-[#ff4444] hover:bg-[#ff4444]/10 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>{tNav('logout')}</span>
        </button>
      </div>
    </Modal>
  );
}

// Mini Telegram login button for linking
function TelegramLinkButton({
  isLoading,
}: {
  onAuth: (user: TelegramLoginWidgetData) => void;
  isLoading: boolean;
}) {
  const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'FortuneCityAppBot';

  useEffect(() => {
    const authUrl = `${window.location.origin}/auth/telegram/link`;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'small');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-auth-url', authUrl);
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    const container = document.getElementById('telegram-link-container');
    if (container) {
      container.innerHTML = '';
      container.appendChild(script);
    }
  }, [botName]);

  if (isLoading) {
    return (
      <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#0088cc] border-t-transparent" />
    );
  }

  return <div id="telegram-link-container" className="telegram-link-btn" />;
}
