'use client';

import { useCallback, useRef } from 'react';
import { useUIStore } from '@/stores/ui.store';

// Sound file paths (relative to /public)
const SOUNDS = {
  collect: '/sounds/coin-collect.mp3',
  win: '/sounds/win.mp3',
  lose: '/sounds/lose.mp3',
  purchase: '/sounds/purchase.mp3',
  click: '/sounds/click.mp3',
  spin: '/sounds/spin.mp3',
  notification: '/sounds/notification.mp3',
} as const;

export type SoundName = keyof typeof SOUNDS;

// Vibration patterns (ms)
const VIBRATION_PATTERNS: Record<string, number | number[]> = {
  collect: 50,
  win: [50, 30, 100],
  lose: [200, 100, 200],
  purchase: [30, 20, 30],
  click: 10,
  spin: 30,
  notification: [30, 20, 30],
};

// Telegram haptic mapping
type TgImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type TgNotificationType = 'error' | 'success' | 'warning';

interface TgHapticConfig {
  type: 'impact' | 'notification' | 'selection';
  style?: TgImpactStyle;
  notificationType?: TgNotificationType;
}

const TG_HAPTIC_MAP: Record<string, TgHapticConfig> = {
  collect: { type: 'impact', style: 'medium' },
  win: { type: 'notification', notificationType: 'success' },
  lose: { type: 'notification', notificationType: 'error' },
  purchase: { type: 'impact', style: 'heavy' },
  click: { type: 'impact', style: 'light' },
  spin: { type: 'impact', style: 'soft' },
  notification: { type: 'notification', notificationType: 'warning' },
};

// Audio cache to avoid re-creating Audio objects
const audioCache = new Map<string, HTMLAudioElement>();

function getAudio(name: SoundName): HTMLAudioElement {
  const cached = audioCache.get(name);
  if (cached) return cached;

  const audio = new Audio(SOUNDS[name]);
  audio.preload = 'auto';
  audioCache.set(name, audio);
  return audio;
}

function playSound(name: SoundName, muted: boolean) {
  if (muted) return;
  try {
    const audio = getAudio(name);
    // Reset if already playing
    audio.currentTime = 0;
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Autoplay blocked — ignore silently
    });
  } catch {
    // Ignore audio errors
  }
}

function vibrate(name: string) {
  const pattern = VIBRATION_PATTERNS[name];
  if (!pattern) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration not supported — ignore
  }
}

function telegramHaptic(name: string) {
  const config = TG_HAPTIC_MAP[name];
  if (!config) return;

  try {
    const webApp = window.Telegram?.WebApp;
    if (!webApp?.HapticFeedback) return;

    switch (config.type) {
      case 'impact':
        webApp.HapticFeedback.impactOccurred(config.style || 'medium');
        break;
      case 'notification':
        webApp.HapticFeedback.notificationOccurred(config.notificationType || 'success');
        break;
      case 'selection':
        webApp.HapticFeedback.selectionChanged();
        break;
    }
  } catch {
    // Telegram not available — ignore
  }
}

/**
 * Unified feedback hook: sound + vibration + Telegram haptics.
 * Respects the musicMuted setting from UIStore for sounds.
 */
export function useFeedback() {
  const musicMuted = useUIStore((s) => s.musicMuted);
  const lastFeedback = useRef<Record<string, number>>({});

  const feedback = useCallback(
    (name: SoundName) => {
      // Debounce: prevent same feedback within 100ms
      const now = Date.now();
      if (now - (lastFeedback.current[name] || 0) < 100) return;
      lastFeedback.current[name] = now;

      playSound(name, musicMuted);
      vibrate(name);
      telegramHaptic(name);
    },
    [musicMuted]
  );

  return {
    feedback,
    collect: useCallback(() => feedback('collect'), [feedback]),
    win: useCallback(() => feedback('win'), [feedback]),
    lose: useCallback(() => feedback('lose'), [feedback]),
    purchase: useCallback(() => feedback('purchase'), [feedback]),
    click: useCallback(() => feedback('click'), [feedback]),
    spin: useCallback(() => feedback('spin'), [feedback]),
    notification: useCallback(() => feedback('notification'), [feedback]),
  };
}
