'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useWheelStore } from '@/stores/wheel.store';
import { useWheelSocket } from '@/hooks/useWheelSocket';
import {
  FortuneWheel,
  JackpotDisplay,
  SpinControls,
  SpinResultModal,
  SpinHistory,
  RecentWins,
} from '@/components/wheel';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useFeedback } from '@/hooks/useFeedback';
import type { WheelMultiplier } from '@/lib/api';

export default function WheelPage() {
  const { user, token, refreshUser } = useAuthStore();
  const {
    jackpotPool,
    betAmount,
    multipliers,
    freeSpinsRemaining,
    sectors,
    lastWinner,
    timesWon,
    lastSpinResult,
    history,
    isLoadingState,
    isSpinning,
    isLoadingHistory,
    error,
    fetchState,
    fetchHistory,
    spin,
    clearLastResult,
    clearError,
  } = useWheelStore();

  const { spin: fbSpin, win: fbWin, lose: fbLose } = useFeedback();

  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [currentResultSector, setCurrentResultSector] = useState<string | undefined>();
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);

  const hasFetched = useRef(false);

  // Connect to WebSocket for realtime jackpot updates
  useWheelSocket(user?.id);

  // Fetch wheel state on mount
  useEffect(() => {
    if (token && !hasFetched.current) {
      hasFetched.current = true;
      fetchState(token);
      fetchHistory(token);
    }
  }, [token, fetchState, fetchHistory]);

  // Handle spin
  const handleSpin = useCallback(
    async (multiplier: WheelMultiplier) => {
      if (!token || isSpinning) return;

      try {
        clearError();
        fbSpin();
        const result = await spin(token, multiplier);

        setIsWheelSpinning(true);
        setCurrentResultSector(result.result.sector);
      } catch {
        // Error handled in store
      }
    },
    [token, isSpinning, spin, clearError, fbSpin]
  );

  // Handle wheel animation complete
  const handleSpinComplete = useCallback(() => {
    setIsWheelSpinning(false);
    setIsResultModalOpen(true);
    // Play win/lose sound based on last result
    const result = useWheelStore.getState().lastSpinResult;
    if (result && result.netResult > 0) {
      fbWin();
    } else {
      fbLose();
    }
    refreshUser();
  }, [refreshUser, fbWin, fbLose]);

  // Close result modal
  const handleCloseResult = useCallback(() => {
    setIsResultModalOpen(false);
    clearLastResult();
    setCurrentResultSector(undefined);
    // Refresh history
    if (token) {
      fetchHistory(token);
    }
  }, [clearLastResult, token, fetchHistory]);

  const balance = user ? parseFloat(user.fortuneBalance) : 0;

  // Loading state
  if (isLoadingState && sectors.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a0a2e] to-[#0d0015] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#ff2d95]/30 border-t-[#ff2d95] rounded-full animate-spin mx-auto" />
          <p className="text-white/60 mt-4">Loading Fortune Wheel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0a2e] to-[#0d0015] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#1a0a2e]/95 backdrop-blur-lg border-b border-[#ff2d95]/20 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-white">Fortune Wheel</h1>
          <div className="text-right">
            <div className="text-lg lg:text-xl text-[#ffd700] font-mono font-bold">${balance.toFixed(2)}</div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Error message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={clearError}
              className="text-xs text-red-300 underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Jackpot display */}
        <JackpotDisplay
          currentPool={jackpotPool}
          timesWon={timesWon}
          lastWinner={lastWinner}
        />

        {/* Wheel */}
        <FortuneWheel
          sectors={sectors}
          isSpinning={isWheelSpinning}
          resultSector={currentResultSector}
          onSpinComplete={handleSpinComplete}
        />

        {/* Spin controls */}
        <SpinControls
          betAmount={betAmount}
          multipliers={multipliers}
          freeSpins={freeSpinsRemaining}
          balance={balance}
          isSpinning={isSpinning || isWheelSpinning}
          onSpin={handleSpin}
        />

        {/* Recent global wins (social proof) */}
        <RecentWins />

        {/* Spin history */}
        <SpinHistory items={history} isLoading={isLoadingHistory} />
      </main>

      {/* Result modal */}
      <SpinResultModal
        isOpen={isResultModalOpen}
        onClose={handleCloseResult}
        result={lastSpinResult}
      />

      {/* Bottom navigation */}
      <BottomNavigation />
    </div>
  );
}
