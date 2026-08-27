'use client';

import React from 'react';

interface StartScreenModalProps {
  onStart: () => void;
  onOpenHighScores: () => void;
  highScore: number;
}

export const StartScreenModal: React.FC<StartScreenModalProps> = ({
  onStart,
  onOpenHighScores,
  highScore,
}) => {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm p-6 text-center animate-fadeIn">
      {/* Retro Title with Neon Glow */}
      <h1 className="text-4xl sm:text-6xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 via-fuchsia-400 to-pink-500 drop-shadow-[0_0_20px_rgba(236,72,153,0.7)] animate-pulse">
        ARKANOID
      </h1>
      <p className="mt-2 text-xs sm:text-sm tracking-[0.3em] text-cyan-300 font-semibold uppercase">
        {`// CYBER BRICK BREAKER //`}
      </p>

      {/* High Score Preview */}
      <div className="mt-6 px-4 py-2 rounded-lg bg-slate-900/80 border border-amber-500/40 text-amber-300 text-xs sm:text-sm">
        ALL-TIME HIGH SCORE:{' '}
        <span className="font-bold text-amber-400">{Math.max(0, Math.floor(highScore)).toString().padStart(7, '0')}</span>
      </div>

      {/* Primary Action Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full max-w-xs">
        <button
          type="button"
          onClick={onStart}
          className="w-full py-3 px-6 rounded-lg font-black text-sm tracking-widest uppercase bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.6)] active:scale-95 transition-all cursor-pointer"
        >
          START GAME
        </button>
        <button
          type="button"
          onClick={onOpenHighScores}
          className="w-full py-3 px-6 rounded-lg font-bold text-sm tracking-wider uppercase bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 active:scale-95 transition-all cursor-pointer"
        >
          HIGH SCORES
        </button>
      </div>

      {/* Controls Overview Card */}
      <div className="mt-8 p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 max-w-md text-left">
        <div className="text-cyan-400 font-bold mb-1">🎮 PILOT CONTROLS:</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div><strong className="text-white">Mouse / Touch</strong>: Move Paddle</div>
          <div><strong className="text-white">Arrows / A-D</strong>: Steer Paddle</div>
          <div><strong className="text-white">Space / Click</strong>: Launch / Laser</div>
          <div><strong className="text-white">P / Esc</strong>: Pause / Resume</div>
        </div>
      </div>
    </div>
  );
};
