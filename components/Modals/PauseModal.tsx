'use client';

import React from 'react';
import { AudioControls } from '../AudioControls';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  isMuted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolumeChange: (vol: number) => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  isMuted,
  volume,
  onToggleMute,
  onVolumeChange,
}) => {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-6 text-center animate-fadeIn">
      <h2 className="text-3xl sm:text-4xl font-extrabold tracking-widest text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]">
        SYSTEM PAUSED
      </h2>
      <p className="mt-1 text-xs text-slate-400 tracking-wider">
        PRESS [P] OR [ESC] TO RESUME
      </p>

      {/* In-Modal Audio Controls */}
      <div className="mt-6 p-4 rounded-lg bg-slate-900/80 border border-cyan-500/30 flex flex-col items-center gap-2">
        <span className="text-xs text-cyan-300 font-bold">AUDIO SETTINGS</span>
        <AudioControls
          isMuted={isMuted}
          volume={volume}
          onToggleMute={onToggleMute}
          onVolumeChange={onVolumeChange}
        />
      </div>

      {/* Buttons */}
      <div className="mt-6 flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={onResume}
          className="w-full py-2.5 px-5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(6,182,212,0.5)] cursor-pointer"
        >
          RESUME MISSION
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="w-full py-2.5 px-5 rounded bg-slate-800 hover:bg-slate-700 border border-red-500/40 text-red-300 font-bold text-sm tracking-wider uppercase transition-all cursor-pointer"
        >
          RESTART LEVEL
        </button>
      </div>
    </div>
  );
};
