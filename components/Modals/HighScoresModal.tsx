'use client';

import React, { useState, useEffect } from 'react';
import { getHighScores, resetHighScores, clearHighScores } from '@/utils/highScores';
import type { HighScoreEntry } from '@/game/types';

interface HighScoresModalProps {
  currentScore?: number;
  onClose: () => void;
}

export const HighScoresModal: React.FC<HighScoresModalProps> = ({ currentScore, onClose }) => {
  const [scores, setScores] = useState<HighScoreEntry[]>([]);

  useEffect(() => {
    setScores(getHighScores());
  }, []);

  const handleClear = () => {
    if (typeof window !== 'undefined' && window.confirm('Are you sure you want to reset all high scores to default?')) {
      clearHighScores();
      setScores(getHighScores());
    } else {
      resetHighScores();
      setScores(getHighScores());
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-6 text-center animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900/90 border border-amber-500/40 rounded-xl p-4 sm:p-6 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-widest text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]">
          🏆 HALL OF FAME 🏆
        </h2>
        <p className="text-[10px] text-slate-400 tracking-widest mt-1 mb-4">
          TOP PILOT LEADERBOARD
        </p>

        {/* Scores Table */}
        <div className="w-full max-h-60 overflow-y-auto border border-slate-800 rounded bg-slate-950/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[10px]">
              <tr>
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">PILOT</th>
                <th className="py-2 px-3 text-right">SCORE</th>
                <th className="py-2 px-3 text-right">STAGE</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((entry, index) => {
                const isTop3 = index < 3;
                return (
                  <tr
                    key={entry.id || index}
                    className={`border-b border-slate-900/60 hover:bg-slate-800/40 transition-colors ${
                      isTop3 ? 'font-bold text-amber-300' : 'text-slate-300'
                    }`}
                  >
                    <td className="py-2 px-3">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                    </td>
                    <td className="py-2 px-3 tracking-widest">{entry.name}</td>
                    <td className="py-2 px-3 text-right font-mono text-cyan-300">
                      {entry.score.toString().padStart(7, '0')}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-400">
                      L{entry.level}
                    </td>
                  </tr>
                );
              })}
              {scores.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-500 text-xs">
                    NO RECORDED HIGH SCORES
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex justify-between items-center gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] text-red-400/80 hover:text-red-300 underline cursor-pointer"
          >
            Reset Scores
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-6 rounded-lg font-bold text-xs tracking-wider uppercase bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)] transition-all cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
