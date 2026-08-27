'use client';

import React from 'react';
import type { GameStatus } from '@/game/types';

interface TouchControlsProps {
  status: GameStatus;
  onLaunch: () => void;
  onPauseToggle: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  status,
  onLaunch,
  onPauseToggle,
}) => {
  return (
    <div className="flex items-center justify-between gap-4 w-full select-none">
      {/* Pause Button */}
      <button
        type="button"
        onClick={onPauseToggle}
        className="flex-1 py-3 px-4 rounded-xl bg-slate-800 active:bg-slate-700 border border-cyan-500/30 text-cyan-300 font-bold text-xs tracking-wider active:scale-95 transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)] cursor-pointer"
        aria-label={status === 'PAUSED' ? 'Resume Game' : 'Pause Game'}
      >
        {status === 'PAUSED' ? '▶ RESUME' : '⏸ PAUSE'}
      </button>

      {/* Action / Launch / Laser Fire Button */}
      <button
        type="button"
        onClick={onLaunch}
        className="flex-[2] py-3.5 px-6 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 active:from-pink-400 active:to-fuchsia-500 text-white font-black text-sm tracking-widest active:scale-95 transition-all shadow-[0_0_20px_rgba(236,72,153,0.6)] cursor-pointer"
        aria-label="Launch Ball or Fire Laser"
      >
        ⚡ LAUNCH / FIRE
      </button>
    </div>
  );
};
