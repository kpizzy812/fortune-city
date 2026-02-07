'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '@/stores/ui.store';

const MUSIC_SRC = '/Hotline Miami 2_ Wrong Number Soundtrack - Blizzard.mp3';

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasInteracted = useRef(false);
  const musicMuted = useUIStore((s) => s.musicMuted);

  const tryPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || hasInteracted.current) return;
    hasInteracted.current = true;

    audio.play().catch(() => {
      // Autoplay still blocked — will retry on next interaction
      hasInteracted.current = false;
    });
  }, []);

  // Create audio element once
  useEffect(() => {
    const audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.volume = 0.3;
    audioRef.current = audio;

    // Try autoplay immediately
    audio.play().then(() => {
      hasInteracted.current = true;
    }).catch(() => {
      // Blocked by browser — wait for user interaction
    });

    // Listen for first user interaction to unlock audio
    const unlock = () => tryPlay();
    document.addEventListener('click', unlock, { once: false });
    document.addEventListener('touchstart', unlock, { once: false });
    document.addEventListener('keydown', unlock, { once: false });

    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [tryPlay]);

  // Sync muted state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = musicMuted;
  }, [musicMuted]);

  return null;
}
