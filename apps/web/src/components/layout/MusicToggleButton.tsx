'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';

interface MusicToggleButtonProps {
  /** Compact mode for collapsed sidebar */
  collapsed?: boolean;
  /** Additional className */
  className?: string;
}

export function MusicToggleButton({ collapsed, className }: MusicToggleButtonProps) {
  const { musicMuted, toggleMusic } = useUIStore();

  return (
    <button
      onClick={toggleMusic}
      className={`
        flex items-center justify-center
        rounded-lg text-[#b0b0b0]
        hover:text-[#00d4ff] hover:bg-[#00d4ff]/10
        transition-colors
        ${collapsed ? 'w-10 h-10' : 'px-2 py-2'}
        ${className ?? ''}
      `}
      title={musicMuted ? 'Unmute music' : 'Mute music'}
    >
      {musicMuted ? (
        <VolumeX className="w-5 h-5 shrink-0" />
      ) : (
        <Volume2 className="w-5 h-5 shrink-0" />
      )}
    </button>
  );
}
