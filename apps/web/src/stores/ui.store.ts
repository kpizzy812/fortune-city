'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  musicMuted: boolean;
  soundMuted: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleMusic: () => void;
  setMusicMuted: (muted: boolean) => void;
  toggleSound: () => void;
  setSoundMuted: (muted: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      musicMuted: false,
      soundMuted: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleMusic: () => set((state) => ({ musicMuted: !state.musicMuted })),
      setMusicMuted: (muted) => set({ musicMuted: muted }),
      toggleSound: () => set((state) => ({ soundMuted: !state.soundMuted })),
      setSoundMuted: (muted) => set({ soundMuted: muted }),
    }),
    {
      name: 'fortune-city-ui',
    }
  )
);
