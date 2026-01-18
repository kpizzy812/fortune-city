'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth.store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface DepositCreditedEvent {
  depositId: string;
  userId: string;
  amount: number;
  currency: string;
  amountUsd: number;
  newBalance: number;
  timestamp: string;
}

interface UseDepositsSocketOptions {
  onDepositCredited?: (data: DepositCreditedEvent) => void;
  showToast?: boolean;
}

export function useDepositsSocket(options: UseDepositsSocketOptions = {}) {
  const { onDepositCredited, showToast = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const t = useTranslations('cash');
  const { user, refreshUser } = useAuthStore();

  const handleDepositCredited = useCallback(
    (data: DepositCreditedEvent) => {
      console.log('[DepositsSocket] Deposit credited:', data);

      // Refresh user balance
      refreshUser();

      // Call custom callback
      onDepositCredited?.(data);

      // Show toast notification
      if (showToast) {
        const currencyLabel = data.currency === 'USDT_SOL' ? 'USDT' : data.currency;
        toast.success(
          <div className="flex flex-col gap-1">
            <div className="font-bold text-[#00ff88]">
              {t('depositSuccess')}
            </div>
            <div className="text-sm">
              +${data.amountUsd.toFixed(2)} ({data.amount.toFixed(4)} {currencyLabel})
            </div>
          </div>,
          {
            duration: 5000,
            icon: '💰',
          }
        );
      }
    },
    [onDepositCredited, showToast, refreshUser, t]
  );

  useEffect(() => {
    if (!user?.id) return;

    // Connect to deposits namespace
    const socket = io(`${API_URL}/deposits`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[DepositsSocket] Connected');
      // Subscribe to user's deposit notifications
      socket.emit('subscribe', user.id);
    });

    socket.on('disconnect', () => {
      console.log('[DepositsSocket] Disconnected');
    });

    socket.on('deposit:credited', handleDepositCredited);

    return () => {
      if (user?.id && socket.connected) {
        socket.emit('unsubscribe', user.id);
      }
      socket.off('deposit:credited', handleDepositCredited);
      // Only disconnect if socket was actually connected (avoids warning in React Strict Mode)
      if (socket.connected) {
        socket.disconnect();
      } else {
        socket.close();
      }
      socketRef.current = null;
    };
  }, [user?.id, handleDepositCredited]);

  return socketRef.current;
}
