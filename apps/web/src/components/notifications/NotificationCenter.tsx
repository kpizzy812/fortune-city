'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationsStore } from '@/stores/notifications.store';
import { formatDistanceToNow } from 'date-fns';

interface NotificationCenterProps {
  onClose: () => void;
}

export function NotificationCenter({ onClose }: NotificationCenterProps) {
  const { token } = useAuthStore();
  const {
    notifications,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationsStore();

  useEffect(() => {
    if (token) {
      fetchNotifications(token, { limit: 10, offset: 0 });
    }
  }, [token, fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    if (token) {
      await markAsRead(token, notificationId);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (token) {
      await markAllAsRead(token);
    }
  };

  return (
    <div className="flex flex-col max-h-[70vh] md:max-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-lg font-bold text-white">Notifications</h3>
        {notifications.length > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-sm text-[#00d4ff] hover:text-[#00d4ff]/80 transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-white/60">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <svg
              className="w-16 h-16 mx-auto mb-3 text-white/20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="text-white/40">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleMarkAsRead(notification.id)}
                className={`p-4 cursor-pointer transition-colors ${
                  notification.readAt
                    ? 'bg-transparent hover:bg-white/5'
                    : 'bg-[#ff2d95]/10 hover:bg-[#ff2d95]/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="text-2xl flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {notification.title}
                      </h4>
                      {!notification.readAt && (
                        <span className="w-2 h-2 bg-[#ff2d95] rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(255,45,149,0.5)]" />
                      )}
                    </div>
                    <p className="text-sm text-white/70 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-white/40 mt-1">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-white/10 text-center">
          <button
            onClick={onClose}
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

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
