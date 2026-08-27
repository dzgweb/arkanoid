/**
 * @file components/Controls/TouchControls.tsx
 * Production-ready mobile touch controls overlay with Virtual Trackpad/Slider,
 * Retro D-Pad, context-aware Action/Laser button, and Pause toggle.
 */

'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { GameStatus } from '@/game/types';

export interface TouchControlsProps {
  status: GameStatus;
  hasLasers?: boolean;
  hasStuckBall?: boolean;
  onLeftChange?: (active: boolean) => void;
  onRightChange?: (active: boolean) => void;
  onTrackpadMove?: (normalizedX: number) => void;
  onLaunch?: () => void;
  onFireLaser?: () => void;
  onPauseToggle: () => void;
  className?: string;
}

type ControlMode = 'TRACKPAD' | 'DPAD';

export const TouchControls: React.FC<TouchControlsProps> = ({
  status,
  hasLasers = false,
  hasStuckBall = false,
  onLeftChange,
  onRightChange,
  onTrackpadMove,
  onLaunch,
  onFireLaser,
  onPauseToggle,
  className = '',
}) => {
  const [mode, setMode] = useState<ControlMode>('TRACKPAD');
  const [sliderRatio, setSliderRatio] = useState<number>(0.5);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [leftActive, setLeftActive] = useState<boolean>(false);
  const [rightActive, setRightActive] = useState<boolean>(false);

  const trackpadRef = useRef<HTMLDivElement | null>(null);

  // Trigger optional subtle haptic vibration on mobile
  const triggerHaptic = useCallback((duration: number = 10) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {
        // Ignore haptic errors on unsupported platforms
      }
    }
  }, []);

  // Update trackpad position from clientX
  const updateTrackpadFromClientX = useCallback(
    (clientX: number) => {
      const trackpad = trackpadRef.current;
      if (!trackpad) return;

      const rect = trackpad.getBoundingClientRect();
      if (rect.width <= 0) return;

      const relativeX = clientX - rect.left;
      const clampedRatio = Math.max(0, Math.min(1, relativeX / rect.width));
      setSliderRatio(clampedRatio);

      const canonicalX = clampedRatio * 800;
      onTrackpadMove?.(canonicalX);
    },
    [onTrackpadMove]
  );

  // Trackpad Touch Event Handlers
  const handleTrackpadTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length > 0) {
        setIsDragging(true);
        triggerHaptic(8);
        updateTrackpadFromClientX(e.touches[0].clientX);
      }
    },
    [triggerHaptic, updateTrackpadFromClientX]
  );

  const handleTrackpadTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length > 0) {
        updateTrackpadFromClientX(e.touches[0].clientX);
      }
    },
    [updateTrackpadFromClientX]
  );

  const handleTrackpadTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Directional D-Pad Handlers
  const handleLeftDown = useCallback(
    (e?: React.SyntheticEvent) => {
      e?.preventDefault();
      setLeftActive(true);
      triggerHaptic(12);
      onLeftChange?.(true);
    },
    [onLeftChange, triggerHaptic]
  );

  const handleLeftUp = useCallback(
    (e?: React.SyntheticEvent) => {
      e?.preventDefault();
      setLeftActive(false);
      onLeftChange?.(false);
    },
    [onLeftChange]
  );

  const handleRightDown = useCallback(
    (e?: React.SyntheticEvent) => {
      e?.preventDefault();
      setRightActive(true);
      triggerHaptic(12);
      onRightChange?.(true);
    },
    [onRightChange, triggerHaptic]
  );

  const handleRightUp = useCallback(
    (e?: React.SyntheticEvent) => {
      e?.preventDefault();
      setRightActive(false);
      onRightChange?.(false);
    },
    [onRightChange]
  );

  // Action / Fire / Launch Trigger
  const handleActionClick = useCallback(() => {
    triggerHaptic(15);
    if (hasLasers && onFireLaser) {
      onFireLaser();
    } else if (onLaunch) {
      onLaunch();
    }
  }, [hasLasers, onFireLaser, onLaunch, triggerHaptic]);

  // Clean up directional state on unmount
  useEffect(() => {
    return () => {
      onLeftChange?.(false);
      onRightChange?.(false);
    };
  }, [onLeftChange, onRightChange]);

  const isPaused = status === 'PAUSED';

  return (
    <div
      role="toolbar"
      aria-label="Mobile Game Controls"
      className={`flex flex-col gap-2 w-full select-none touch-none ${className}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Utility & Mode Switcher Bar */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center bg-slate-900/90 rounded-lg p-0.5 border border-cyan-500/20 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setMode('TRACKPAD')}
            className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
              mode === 'TRACKPAD'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_#06b6d4]'
                : 'text-slate-400 hover:text-cyan-300'
            }`}
            aria-pressed={mode === 'TRACKPAD'}
          >
            🎛️ SLIDER
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('DPAD');
              onLeftChange?.(false);
              onRightChange?.(false);
            }}
            className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
              mode === 'DPAD'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_#06b6d4]'
                : 'text-slate-400 hover:text-cyan-300'
            }`}
            aria-pressed={mode === 'DPAD'}
          >
            🕹️ D-PAD
          </button>
        </div>

        {/* Quick Pause / Resume Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            onPauseToggle();
          }}
          className={`py-1 px-3 rounded-lg border text-[11px] font-extrabold tracking-wider transition-all cursor-pointer ${
            isPaused
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse'
              : 'bg-slate-800/80 border-cyan-500/30 text-cyan-300 active:bg-slate-700'
          }`}
          aria-label={isPaused ? 'Resume Game' : 'Pause Game'}
        >
          {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
        </button>
      </div>

      {/* Steering Controls Area: Trackpad vs D-Pad */}
      {mode === 'TRACKPAD' ? (
        <div
          ref={trackpadRef}
          role="slider"
          aria-label="Paddle Position Slider"
          aria-valuemin={0}
          aria-valuemax={800}
          aria-valuenow={Math.round(sliderRatio * 800)}
          onTouchStart={handleTrackpadTouchStart}
          onTouchMove={handleTrackpadTouchMove}
          onTouchEnd={handleTrackpadTouchEnd}
          onTouchCancel={handleTrackpadTouchEnd}
          className="relative w-full h-14 bg-gradient-to-b from-slate-900 to-slate-950 rounded-xl border border-cyan-500/30 shadow-[inset_0_0_15px_rgba(6,182,212,0.15)] flex items-center px-3 cursor-ew-resize overflow-hidden"
        >
          {/* Track Grid Marks */}
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-1 bg-slate-800 rounded-full">
            <div
              className="h-full bg-cyan-500/40 transition-all"
              style={{ width: `${sliderRatio * 100}%` }}
            />
          </div>
          <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-0.5 h-3 bg-cyan-500/20" />
          <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-cyan-500/40" />
          <div className="absolute left-3/4 top-1/2 -translate-y-1/2 w-0.5 h-3 bg-cyan-500/20" />

          {/* Interactive Neon Glow Thumb */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-12 h-10 rounded-lg flex items-center justify-center font-black text-[10px] tracking-tighter text-slate-950 transition-transform ${
              isDragging
                ? 'scale-110 bg-cyan-300 shadow-[0_0_18px_#22d3ee]'
                : 'bg-cyan-400 shadow-[0_0_10px_#06b6d4]'
            }`}
            style={{ left: `${Math.max(6, Math.min(94, sliderRatio * 100))}%` }}
          >
            ◀ ❚❚ ▶
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 w-full">
          {/* Left Directional Button */}
          <button
            type="button"
            onPointerDown={handleLeftDown}
            onPointerUp={handleLeftUp}
            onPointerCancel={handleLeftUp}
            onPointerLeave={handleLeftUp}
            onTouchStart={handleLeftDown}
            onTouchEnd={handleLeftUp}
            className={`py-3.5 px-4 rounded-xl border font-black text-sm tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              leftActive
                ? 'bg-cyan-400 text-slate-950 border-cyan-300 scale-95 shadow-[0_0_15px_#22d3ee]'
                : 'bg-slate-900 border-cyan-500/30 text-cyan-300 active:bg-slate-800'
            }`}
            aria-label="Move Paddle Left"
          >
            ◀ LEFT
          </button>

          {/* Right Directional Button */}
          <button
            type="button"
            onPointerDown={handleRightDown}
            onPointerUp={handleRightUp}
            onPointerCancel={handleRightUp}
            onPointerLeave={handleRightUp}
            onTouchStart={handleRightDown}
            onTouchEnd={handleRightUp}
            className={`py-3.5 px-4 rounded-xl border font-black text-sm tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              rightActive
                ? 'bg-cyan-400 text-slate-950 border-cyan-300 scale-95 shadow-[0_0_15px_#22d3ee]'
                : 'bg-slate-900 border-cyan-500/30 text-cyan-300 active:bg-slate-800'
            }`}
            aria-label="Move Paddle Right"
          >
            RIGHT ▶
          </button>
        </div>
      )}

      {/* Primary Action Button (Launch Ball / Fire Lasers) */}
      <button
        type="button"
        onClick={handleActionClick}
        className={`w-full py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm tracking-widest uppercase transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
          hasLasers
            ? 'bg-gradient-to-r from-red-600 via-rose-500 to-pink-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse'
            : hasStuckBall
            ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.6)]'
            : 'bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.5)]'
        }`}
        aria-label={
          hasLasers ? 'Fire Twin Lasers' : hasStuckBall ? 'Launch Ball' : 'Launch Ball or Fire Laser'
        }
      >
        {hasLasers ? (
          <>
            <span>🔫</span> FIRE LASERS <span>🔫</span>
          </>
        ) : hasStuckBall ? (
          <>
            <span>⚡</span> LAUNCH BALL <span>⚡</span>
          </>
        ) : (
          <>
            <span>⚡</span> LAUNCH / FIRE <span>⚡</span>
          </>
        )}
      </button>
    </div>
  );
};
