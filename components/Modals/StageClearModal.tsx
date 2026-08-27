'use client';

import React from 'react';

interface StageClearModalProps {
  level: number;
  score: number;
  isVictory?: boolean;
  onNextLevel: () => void;
}

export const StageClearModal: React.FC<StageClearModalProps> = ({
  level,
  score,
  isVictory = false,
  onNextLevel,
}) => {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center animate-fadeIn">
      <div className="text-4xl sm:text-5xl mb-2">🎉</div>
      <h2 className="text-3xl sm:text-4xl font-extrabold tracking-widest text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.8)]">
        {isVictory ? 'CAMPAIGN CLEARED!' : `STAGE ${level} CLEARED!`}
      </h2>
      <p className="mt-1 text-xs text-emerald-200 tracking-wider">
        {isVictory
          ? 'EXCELLENT PILOTING! YOU HAVE DEFEATED THE GRID.'
          : 'ALL BRICK TARGETS NEUTRALIZED'}
      </p>

      <div className="mt-6 p-4 rounded-lg bg-slate-900/90 border border-emerald-500/40 w-full max-w-xs">
        <div className="text-xs text-slate-400">TOTAL SCORE ACCUMULATED</div>
        <div className="text-2xl font-bold text-white tracking-widest mt-1">
          {Math.max(0, Math.floor(score)).toString().padStart(7, '0')}
        </div>
      </div>

      <button
        type="button"
        onClick={onNextLevel}
        className="mt-8 py-3 px-8 rounded-lg font-black text-sm tracking-widest uppercase bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.6)] active:scale-95 transition-all cursor-pointer"
      >
        {isVictory ? 'PLAY AGAIN' : 'NEXT STAGE >>'}
      </button>
    </div>
  );
};
