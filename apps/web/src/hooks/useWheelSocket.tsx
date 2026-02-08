'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWheelStore } from '@/stores/wheel.store';
import { WS_BASE_URL } from '@/lib/socket';

interface JackpotWonEvent {
  winnerId: string;
  winnerName: string | null;
  amount: number;
  newPool: number;
  timestamp: string;
}

interface JackpotUpdatedEvent {
  currentPool: number;
  timestamp: string;
}

export function useWheelSocket(currentUserId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();
  const t = useTranslations('wheel.notification');

  const handleJackpotWon = useCallback(
    (data: JackpotWonEvent) => {
      // Don't show toast if current user won (they already see the result modal)
      if (data.winnerId === currentUserId) {
        return;
      }

      const winnerDisplay = data.winnerName || 'Someone';

      toast.success(
        <div className="flex flex-col gap-2">
          <div className="font-bold text-[#ffd700]">
            {t('jackpotWon', { winner: winnerDisplay })}
          </div>
          <div className="text-sm">{t('jackpotAmount', { amount: data.amount.toFixed(2) })}</div>
          <button
            onClick={() => router.push('/app/wheel')}
            className="
              mt-2 px-3 py-1.5 rounded-lg text-sm font-medium
              bg-gradient-to-r from-[#ff2d95] to-[#9333ea]
              text-white hover:opacity-90 transition-opacity
            "
          >
            {t('spinNow')}
          </button>
        </div>,
        {
          duration: 10000,
          icon: '🎰',
        }
      );

      // Update jackpot pool in store
      useWheelStore.setState({ jackpotPool: data.newPool });
    },
    [currentUserId, router, t]
  );

  const handleJackpotUpdated = useCallback((data: JackpotUpdatedEvent) => {
    // Only update if pool increased significantly (avoid spam)
    const currentPool = useWheelStore.getState().jackpotPool;
    if (data.currentPool > currentPool + 10) {
      useWheelStore.setState({ jackpotPool: data.currentPool });
    }
  }, []);

  useEffect(() => {
    // Connect to wheel namespace
    const socket = io(`${WS_BASE_URL}/wheel`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WheelSocket] Connected');
    });

    socket.on('disconnect', () => {
      console.log('[WheelSocket] Disconnected');
    });

    socket.on('jackpot:won', handleJackpotWon);
    socket.on('jackpot:updated', handleJackpotUpdated);

    return () => {
      socket.off('jackpot:won', handleJackpotWon);
      socket.off('jackpot:updated', handleJackpotUpdated);
      // Only disconnect if socket was actually connected (avoids warning in React Strict Mode)
      if (socket.connected) {
        socket.disconnect();
      } else {
        socket.close();
      }
      socketRef.current = null;
    };
  }, [handleJackpotWon, handleJackpotUpdated]);
}
