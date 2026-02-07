'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationsStore } from '@/stores/notifications.store';
import type { Notification } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Global WebSocket connection for notifications.
 * Should only be used ONCE in the app (in AuthenticatedLayout).
 */
export function useNotificationsSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuthStore();
  const { addNotification, updateNotificationReadStatus, markAllAsReadLocal } =
    useNotificationsStore();

  const handleNewNotification = useCallback(
    (data: { notification: Notification; timestamp: string }) => {
      console.log('[NotificationsSocket] New notification:', data);

      const { notification } = data;

      // Add to store
      addNotification(notification);

      // Show toast notification with icon based on type
      const icon = getNotificationIcon(notification.type);
      toast(
        <div className="flex flex-col gap-1">
          <div className="font-bold">{notification.title}</div>
          <div className="text-sm text-gray-300">{notification.message}</div>
        </div>,
        {
          duration: 5000,
          icon,
        }
      );
    },
    [addNotification]
  );

  const handleNotificationRead = useCallback(
    (data: { notificationId: string; readAt: string }) => {
      console.log('[NotificationsSocket] Notification read:', data);
      updateNotificationReadStatus(data.notificationId, data.readAt);
    },
    [updateNotificationReadStatus]
  );

  const handleAllNotificationsRead = useCallback(
    (data: { readAt: string }) => {
      console.log('[NotificationsSocket] All notifications read:', data);
      markAllAsReadLocal();
    },
    [markAllAsReadLocal]
  );

  useEffect(() => {
    if (!user?.id) return;

    // Connect to notifications namespace
    const socket = io(`${API_URL}/notifications`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[NotificationsSocket] Connected');
      // Subscribe to user's notifications
      socket.emit('subscribe', user.id);
    });

    socket.on('disconnect', () => {
      console.log('[NotificationsSocket] Disconnected');
    });

    socket.on('subscribed', (data: { userId: string; success: boolean }) => {
      console.log('[NotificationsSocket] Subscribed:', data);
    });

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:read', handleNotificationRead);
    socket.on('notification:all_read', handleAllNotificationsRead);

    return () => {
      if (user?.id && socket.connected) {
        socket.emit('unsubscribe', user.id);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    user?.id,
    handleNewNotification,
    handleNotificationRead,
    handleAllNotificationsRead,
  ]);

  return null;
}

/**
 * Get emoji icon for notification type
 */
function getNotificationIcon(type: string): string {
  switch (type) {
    case 'machine_expired_soon':
    case 'machine_expired':
      return '🎰';
    case 'coin_box_full':
    case 'coin_box_almost_full':
      return '📦';
    case 'referral_joined':
      return '👥';
    case 'deposit_credited':
    case 'deposit_rejected':
      return '💰';
    case 'wheel_jackpot_won':
    case 'wheel_jackpot_alert':
      return '🎉';
    case 'withdrawal_approved':
    case 'withdrawal_completed':
    case 'withdrawal_rejected':
      return '💵';
    default:
      return '🔔';
  }
}
