'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth.store';
import { useDepositEventsStore, type DepositCreditedEvent } from '@/stores/deposit-events.store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Re-export type for convenience
export type { DepositCreditedEvent } from '@/stores/deposit-events.store';

/**
 * Global WebSocket connection for deposit notifications.
 * Should only be used ONCE in the app (in AuthenticatedLayout).
 * Other components should use useOnDepositCredited hook to listen for events.
 */
export function useDepositsSocket() {
  const socketRef = useRef<Socket | null>(null);
  const t = useTranslations('cash');
  const { user, refreshUser } = useAuthStore();
  const emitEvent = useDepositEventsStore((s) => s.emitEvent);

  const handleDepositCredited = useCallback(
    (data: DepositCreditedEvent) => {
      console.log('[DepositsSocket] Deposit credited:', data);

      // Refresh user balance
      refreshUser();

      // Emit to store for other components to react
      emitEvent(data);

      // Show toast notification
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
    },
    [refreshUser, emitEvent, t]
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

/**
 * Hook to subscribe to deposit events.
 * Use this in components that need to react to deposits (e.g., TopUpAndBuyModal).
 */
export function useOnDepositCredited(callback: (event: DepositCreditedEvent) => void) {
  const subscribe = useDepositEventsStore((s) => s.subscribe);

  useEffect(() => {
    const unsubscribe = subscribe(callback);
    return unsubscribe;
  }, [subscribe, callback]);
}
