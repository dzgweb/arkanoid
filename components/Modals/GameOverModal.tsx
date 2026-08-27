'use client';

import React, { useState } from 'react';

interface GameOverModalProps {
  score: number;
  level: number;
  isHighScore: boolean;
  onSaveScore: (initials: string) => void;
  onRestart: () => void;
  onOpenHighScores: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  score,
  level,
  isHighScore,
  onSaveScore,
  onRestart,
  onOpenHighScores,
}) => {
  const [initials, setInitials] = useState('');
  const [hasSaved, setHasSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = initials.trim().toUpperCase() || 'AAA';
    onSaveScore(cleanName.slice(0, 3));
    setHasSaved(true);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 text-center animate-fadeIn">
      <h2 className="text-4xl sm:text-5xl font-black tracking-widest text-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.9)] animate-pulse">
        GAME OVER
      </h2>
      <p className="mt-1 text-xs text-slate-400 tracking-wider">
        VESSEL DESTROYED ON STAGE {level}
      </p>

      {/* Score Summary */}
      <div className="mt-4 p-3 rounded-lg bg-slate-900 border border-red-500/30 w-full max-w-xs">
        <div className="text-xs text-slate-400">FINAL SCORE</div>
        <div className="text-2xl font-bold text-white tracking-widest">
          {Math.max(0, Math.floor(score)).toString().padStart(7, '0')}
        </div>
      </div>

      {/* High Score Submission Form */}
      {isHighScore && !hasSaved && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 p-4 rounded-lg bg-amber-950/40 border border-amber-500/50 w-full max-w-xs flex flex-col items-center"
        >
          <div className="text-xs font-bold text-amber-300 mb-2">
            ⭐ NEW HIGH SCORE ENTRY! ⭐
          </div>
          <label htmlFor="initials-input" className="text-[10px] text-amber-200/80 mb-1">
            ENTER 3-LETTER PILOT INITIALS:
          </label>
          <div className="flex gap-2">
            <input
              id="initials-input"
              type="text"
              maxLength={3}
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase())}
              placeholder="AAA"
              autoFocus
              className="w-24 text-center text-lg font-black tracking-widest bg-slate-900 border border-amber-400 rounded px-2 py-1 text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 uppercase"
            />
            <button
              type="submit"
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded transition-all cursor-pointer"
            >
              SAVE
            </button>
          </div>
        </form>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={onRestart}
          className="w-full py-3 px-6 rounded-lg font-black text-sm tracking-widest uppercase bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] active:scale-95 transition-all cursor-pointer"
        >
          TRY AGAIN
        </button>
        <button
          type="button"
          onClick={onOpenHighScores}
          className="w-full py-2.5 px-4 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs tracking-wider uppercase transition-all cursor-pointer"
        >
          VIEW LEADERBOARD
        </button>
      </div>
    </div>
  );
};
