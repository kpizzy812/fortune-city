'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';

const MACHINES = Array.from({ length: 10 }, (_, i) => ({
  tier: i + 1,
  src: `/machines/tier-${i + 1}.png`,
  name: `Tier ${i + 1}`,
}));

interface PlacedMachine {
  id: string;
  tier: number;
  src: string;
  name: string;
  x: number;
  y: number;
  scale: number;
}

type LayoutMode = 'vertical' | 'horizontal';

export default function TestLayoutPage() {
  const [mode, setMode] = useState<LayoutMode>('vertical');
  const [placedMachines, setPlacedMachines] = useState<PlacedMachine[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [globalScale, setGlobalScale] = useState(0.15);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; machineX: number; machineY: number } | null>(null);

  const bgSrc = mode === 'vertical' ? '/machines/vertical.png' : '/machines/horizontal.png';
  const canvasWidth = mode === 'vertical' ? 540 : 960;
  const canvasHeight = mode === 'vertical' ? 960 : 540;

  const addMachine = useCallback((tier: number) => {
    const m = MACHINES[tier - 1];
    setPlacedMachines(prev => [
      ...prev,
      {
        id: `${Date.now()}-${tier}`,
        tier: m.tier,
        src: m.src,
        name: m.name,
        x: canvasWidth / 2 - 50,
        y: canvasHeight / 2 - 50,
        scale: globalScale,
      },
    ]);
  }, [canvasWidth, canvasHeight, globalScale]);

  const removeMachine = useCallback((id: string) => {
    setPlacedMachines(prev => prev.filter(m => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const updateMachineScale = useCallback((id: string, delta: number) => {
    setPlacedMachines(prev =>
      prev.map(m =>
        m.id === id ? { ...m, scale: Math.max(0.05, Math.min(1, m.scale + delta)) } : m
      )
    );
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    const machine = placedMachines.find(m => m.id === id);
    if (!machine) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      machineX: machine.x,
      machineY: machine.y,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const newX = drag.machineX + (ev.clientX - drag.startX);
      const newY = drag.machineY + (ev.clientY - drag.startY);
      setPlacedMachines(prev =>
        prev.map(m => m.id === id ? { ...m, x: newX, y: newY } : m)
      );
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [placedMachines]);

  const handleTouchStart = useCallback((e: React.TouchEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    const touch = e.touches[0];
    const machine = placedMachines.find(m => m.id === id);
    if (!machine) return;
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      machineX: machine.x,
      machineY: machine.y,
    };

    const handleTouchMove = (ev: TouchEvent) => {
      ev.preventDefault();
      const drag = dragRef.current;
      if (!drag) return;
      const t = ev.touches[0];
      const newX = drag.machineX + (t.clientX - drag.startX);
      const newY = drag.machineY + (t.clientY - drag.startY);
      setPlacedMachines(prev =>
        prev.map(m => m.id === id ? { ...m, x: newX, y: newY } : m)
      );
    };

    const handleTouchEnd = () => {
      dragRef.current = null;
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
  }, [placedMachines]);

  const applyGlobalScale = useCallback(() => {
    setPlacedMachines(prev => prev.map(m => ({ ...m, scale: globalScale })));
  }, [globalScale]);

  const exportPositions = useCallback(() => {
    const data = placedMachines.map(m => ({
      tier: m.tier,
      x: Math.round(m.x),
      y: Math.round(m.y),
      scale: Number(m.scale.toFixed(3)),
    }));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert('Positions copied to clipboard!');
  }, [placedMachines]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <h1 className="text-2xl font-bold text-white mb-4">Machine Layout Test</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Mode toggle */}
        <div className="flex gap-1 bg-[#1a1a2e] rounded-lg p-1">
          <button
            onClick={() => setMode('vertical')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition ${
              mode === 'vertical' ? 'bg-[#00d4ff] text-black' : 'text-[#b0b0b0] hover:text-white'
            }`}
          >
            Vertical (9:16)
          </button>
          <button
            onClick={() => setMode('horizontal')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition ${
              mode === 'horizontal' ? 'bg-[#00d4ff] text-black' : 'text-[#b0b0b0] hover:text-white'
            }`}
          >
            Horizontal (16:9)
          </button>
        </div>

        {/* Global scale */}
        <div className="flex items-center gap-2 bg-[#1a1a2e] rounded-lg px-3 py-1.5">
          <span className="text-xs text-[#b0b0b0]">Scale:</span>
          <input
            type="range"
            min={0.05}
            max={0.5}
            step={0.01}
            value={globalScale}
            onChange={e => setGlobalScale(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-xs text-white font-mono w-10">{(globalScale * 100).toFixed(0)}%</span>
          <button
            onClick={applyGlobalScale}
            className="text-xs bg-[#ff2d95] text-white px-2 py-0.5 rounded hover:bg-[#ff2d95]/80"
          >
            Apply All
          </button>
        </div>

        {/* Export */}
        <button
          onClick={exportPositions}
          className="px-3 py-1.5 bg-[#00ff88] text-black text-sm font-medium rounded-lg hover:bg-[#00ff88]/80"
        >
          Export Positions
        </button>

        {/* Clear */}
        <button
          onClick={() => { setPlacedMachines([]); setSelectedId(null); }}
          className="px-3 py-1.5 bg-[#ff4444] text-white text-sm font-medium rounded-lg hover:bg-[#ff4444]/80"
        >
          Clear All
        </button>
      </div>

      {/* Machine palette */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {MACHINES.map(m => (
          <button
            key={m.tier}
            onClick={() => addMachine(m.tier)}
            className="flex-shrink-0 flex flex-col items-center gap-1 bg-[#1a1a2e] border border-[#333] rounded-lg p-2 hover:border-[#00d4ff] transition w-16"
          >
            <div className="relative w-12 h-12">
              <Image src={m.src} alt={m.name} fill className="object-contain" sizes="48px" />
            </div>
            <span className="text-[10px] text-[#b0b0b0]">T{m.tier}</span>
          </button>
        ))}
        <button
          onClick={() => MACHINES.forEach(m => addMachine(m.tier))}
          className="flex-shrink-0 flex items-center justify-center bg-[#1a1a2e] border border-[#ffd700]/30 rounded-lg p-2 hover:border-[#ffd700] transition w-16"
        >
          <span className="text-xs text-[#ffd700] font-bold">ALL</span>
        </button>
      </div>

      {/* Canvas */}
      <div className="flex gap-4">
        <div
          ref={canvasRef}
          className="relative border-2 border-[#333] rounded-xl overflow-hidden flex-shrink-0"
          style={{ width: canvasWidth, height: canvasHeight }}
          onClick={() => setSelectedId(null)}
        >
          {/* Background */}
          <Image
            src={bgSrc}
            alt={`${mode} background`}
            fill
            className="object-cover"
            priority
            sizes={`${canvasWidth}px`}
          />

          {/* Placed machines */}
          {placedMachines.map(m => {
            const size = 600 * m.scale;
            return (
              <div
                key={m.id}
                className={`absolute cursor-grab active:cursor-grabbing ${
                  selectedId === m.id ? 'ring-2 ring-[#00d4ff] ring-offset-1 ring-offset-transparent' : ''
                }`}
                style={{
                  left: m.x,
                  top: m.y,
                  width: size,
                  height: size,
                  zIndex: selectedId === m.id ? 50 : 10,
                }}
                onMouseDown={e => handleMouseDown(e, m.id)}
                onTouchStart={e => handleTouchStart(e, m.id)}
                onClick={e => { e.stopPropagation(); setSelectedId(m.id); }}
              >
                <Image src={m.src} alt={m.name} fill className="object-contain pointer-events-none" sizes={`${size}px`} />
                {selectedId === m.id && (
                  <div className="absolute -top-6 left-0 flex gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); updateMachineScale(m.id, -0.01); }}
                      className="w-5 h-5 bg-black/80 text-white text-xs rounded flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="text-[9px] text-white bg-black/60 px-1 rounded">
                      {(m.scale * 100).toFixed(0)}%
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); updateMachineScale(m.id, 0.01); }}
                      className="w-5 h-5 bg-black/80 text-white text-xs rounded flex items-center justify-center"
                    >
                      +
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); removeMachine(m.id); }}
                      className="w-5 h-5 bg-red-600 text-white text-xs rounded flex items-center justify-center"
                    >
                      x
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info panel */}
        <div className="bg-[#1a1a2e] rounded-xl p-4 w-64 flex-shrink-0">
          <h3 className="text-sm font-bold text-white mb-3">Placed Machines</h3>
          {placedMachines.length === 0 ? (
            <p className="text-xs text-[#666]">Click a machine above to place it on the canvas</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {placedMachines.map(m => (
                <div
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs ${
                    selectedId === m.id ? 'bg-[#00d4ff]/20 border border-[#00d4ff]/50' : 'bg-[#0a0a0a] hover:bg-[#222]'
                  }`}
                >
                  <div className="relative w-8 h-8 flex-shrink-0">
                    <Image src={m.src} alt={m.name} fill className="object-contain" sizes="32px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium">T{m.tier}</div>
                    <div className="text-[#666]">
                      {Math.round(m.x)}, {Math.round(m.y)} @ {(m.scale * 100).toFixed(0)}%
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); removeMachine(m.id); }}
                    className="text-[#ff4444] hover:text-[#ff6666]"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          {placedMachines.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[#333]">
              <h4 className="text-[10px] text-[#666] uppercase mb-2">JSON Preview</h4>
              <pre className="text-[9px] text-[#00ff88] bg-[#0a0a0a] rounded p-2 max-h-40 overflow-auto">
                {JSON.stringify(
                  placedMachines.map(m => ({
                    tier: m.tier,
                    x: Math.round(m.x),
                    y: Math.round(m.y),
                    scale: Number(m.scale.toFixed(3)),
                  })),
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
