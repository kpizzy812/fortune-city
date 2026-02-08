'use client';

import { useCallback, useRef } from 'react';
import { useUIStore } from '@/stores/ui.store';

// Sound file paths (relative to /public)
const SOUNDS = {
  collect: '/sounds/coin-collect.mp3',
  win: '/sounds/win.mp3',
  lose: '/sounds/lose.mp3',
  purchase: '/sounds/purchase.mp3',
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
  tick: 5,
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
  tick: { type: 'selection' },
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

// ── Web Audio tick generator (ultra-short mechanical click) ──────────
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    audioCtx = new AudioContext();
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a short synthesised laser zap (~60ms frequency sweep).
 * Used for navigation taps and UI clicks. No debounce, instant.
 */
export function playLaser(muted: boolean) {
  vibrate('click');
  telegramHaptic('click');

  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  } catch {
    // Ignore
  }
}

/**
 * Play a short synthesised tick (~30ms).
 * Used for rapid-fire wheel sector ticking. No debounce.
 */
export function playTick(muted: boolean) {
  // Haptics always fire (independent of muted)
  vibrate('tick');
  telegramHaptic('tick');

  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Resume context if suspended (autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.value = 1800;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.03);
  } catch {
    // Ignore
  }
}

/**
 * Unified feedback hook: sound + vibration + Telegram haptics.
 * Sound effects respect soundMuted (separate from musicMuted which only controls background music).
 */
export function useFeedback() {
  const soundMuted = useUIStore((s) => s.soundMuted);
  const lastFeedback = useRef<Record<string, number>>({});

  const feedback = useCallback(
    (name: SoundName) => {
      // Debounce: prevent same feedback within 100ms
      const now = Date.now();
      if (now - (lastFeedback.current[name] || 0) < 100) return;
      lastFeedback.current[name] = now;

      playSound(name, soundMuted);
      vibrate(name);
      telegramHaptic(name);
    },
    [soundMuted]
  );

  const tick = useCallback(() => playTick(soundMuted), [soundMuted]);
  const laser = useCallback(() => playLaser(soundMuted), [soundMuted]);

  return {
    feedback,
    collect: useCallback(() => feedback('collect'), [feedback]),
    win: useCallback(() => feedback('win'), [feedback]),
    lose: useCallback(() => feedback('lose'), [feedback]),
    purchase: useCallback(() => feedback('purchase'), [feedback]),
    click: laser,
    spin: useCallback(() => feedback('spin'), [feedback]),
    notification: useCallback(() => feedback('notification'), [feedback]),
    tick,
    laser,
  };
}
