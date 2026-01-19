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
    <div className="flex flex-col max-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-lg font-bold text-white">Notifications</h3>
        {notifications.length > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-400">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-2">🔔</div>
            <p className="text-gray-400">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleMarkAsRead(notification.id)}
                className={`p-4 cursor-pointer transition-colors ${
                  notification.readAt
                    ? 'bg-transparent hover:bg-gray-800/50'
                    : 'bg-blue-900/20 hover:bg-blue-900/30'
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
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
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
        <div className="p-3 border-t border-gray-700 text-center">
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-white transition-colors"
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
