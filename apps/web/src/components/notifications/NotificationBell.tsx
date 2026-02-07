'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationsStore } from '@/stores/notifications.store';
import { NotificationCenter } from './NotificationCenter';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { token, user } = useAuthStore();
  const { unreadCount, fetchUnreadCount } = useNotificationsStore();
  const isMounted = typeof document !== 'undefined';

  // Fetch unread count on mount
  useEffect(() => {
    if (token) {
      fetchUnreadCount(token);
    }
  }, [token, fetchUnreadCount]);

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 640; // sm breakpoint

      if (isMobile) {
        // On mobile, center dropdown with margin from edges
        setDropdownStyle({
          position: 'fixed',
          top: `${rect.bottom + 8}px`,
          left: '1rem',
          right: '1rem',
          maxWidth: 'calc(100vw - 2rem)',
        });
      } else {
        // On desktop, check if button is on the left side (sidebar)
        const isLeftSide = rect.left < window.innerWidth / 2;

        if (isLeftSide) {
          // Button is on left side (sidebar) - position dropdown to the right
          setDropdownStyle({
            position: 'fixed',
            top: `${rect.bottom + 8}px`,
            left: `${rect.left}px`,
            width: '24rem', // w-96
            maxWidth: '28rem', // max-w-md
          });
        } else {
          // Button is on right side (header) - align to right of button
          setDropdownStyle({
            position: 'fixed',
            top: `${rect.bottom + 8}px`,
            right: `${window.innerWidth - rect.right}px`,
            width: '24rem', // w-96
            maxWidth: '28rem', // max-w-md
          });
        }
      }
    }
  }, [isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) return null;

  return (
    <>
      {/* Bell Icon Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        {/* Bell Icon */}
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Portal */}
      {isMounted &&
        isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="bg-[#1a0a2e]/95 backdrop-blur-xl border border-[#ff2d95]/20 rounded-xl shadow-[0_0_30px_rgba(255,45,149,0.2)] z-[9999]"
          >
            <NotificationCenter onClose={() => setIsOpen(false)} />
          </div>,
          document.body
        )}
    </>
  );
}
