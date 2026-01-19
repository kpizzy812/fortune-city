import { create } from 'zustand';
import type { Notification, NotificationFilters } from '@/types';
import { api } from '@/lib/api';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  total: number;
  isLoading: boolean;
  error: string | null;

  // Fetch notifications with filters
  fetchNotifications: (token: string, filters?: NotificationFilters) => Promise<void>;

  // Fetch unread count
  fetchUnreadCount: (token: string) => Promise<void>;

  // Mark notification as read
  markAsRead: (token: string, notificationId: string) => Promise<void>;

  // Mark all as read
  markAllAsRead: (token: string) => Promise<void>;

  // Add new notification (from WebSocket)
  addNotification: (notification: Notification) => void;

  // Update notification read status (from WebSocket)
  updateNotificationReadStatus: (notificationId: string, readAt: string) => void;

  // Update all as read (from WebSocket)
  markAllAsReadLocal: () => void;

  // Clear state (on logout)
  clear: () => void;
}

const initialState = {
  notifications: [],
  unreadCount: 0,
  total: 0,
  isLoading: false,
  error: null,
};

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  ...initialState,

  fetchNotifications: async (token, filters) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getNotifications(token, filters);
      set({
        notifications: response.notifications,
        unreadCount: response.unreadCount,
        total: response.total,
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error('[Notifications] Fetch error:', error);
    }
  },

  fetchUnreadCount: async (token) => {
    try {
      const response = await api.getUnreadCount(token);
      set({ unreadCount: response.count });
    } catch (error: any) {
      console.error('[Notifications] Fetch unread count error:', error);
    }
  },

  markAsRead: async (token, notificationId) => {
    try {
      await api.markNotificationAsRead(token, notificationId);

      // Update local state
      const notifications = get().notifications.map((n) =>
        n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n
      );
      const unreadCount = Math.max(0, get().unreadCount - 1);

      set({ notifications, unreadCount });
    } catch (error: any) {
      console.error('[Notifications] Mark as read error:', error);
    }
  },

  markAllAsRead: async (token) => {
    try {
      const response = await api.markAllNotificationsAsRead(token);

      // Update local state
      const now = new Date().toISOString();
      const notifications = get().notifications.map((n) => ({
        ...n,
        readAt: n.readAt || now,
      }));

      set({ notifications, unreadCount: 0 });
    } catch (error: any) {
      console.error('[Notifications] Mark all as read error:', error);
    }
  },

  addNotification: (notification) => {
    const notifications = [notification, ...get().notifications];
    const unreadCount = notification.readAt ? get().unreadCount : get().unreadCount + 1;
    set({ notifications, unreadCount, total: get().total + 1 });
  },

  updateNotificationReadStatus: (notificationId, readAt) => {
    const notifications = get().notifications.map((n) =>
      n.id === notificationId ? { ...n, readAt } : n
    );
    const unreadCount = Math.max(0, get().unreadCount - 1);
    set({ notifications, unreadCount });
  },

  markAllAsReadLocal: () => {
    const now = new Date().toISOString();
    const notifications = get().notifications.map((n) => ({
      ...n,
      readAt: n.readAt || now,
    }));
    set({ notifications, unreadCount: 0 });
  },

  clear: () => {
    set(initialState);
  },
}));
