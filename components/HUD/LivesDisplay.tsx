'use client';

import React from 'react';

interface LivesDisplayProps {
  lives: number;
  maxDisplayLives?: number;
}

export const LivesDisplay: React.FC<LivesDisplayProps> = ({ lives, maxDisplayLives = 5 }) => {
  return (
    <div className="flex flex-col justify-center items-start sm:items-center">
      <div className="text-[10px] sm:text-xs text-pink-400 font-semibold tracking-wider">
        SHIPS
      </div>
      <div className="flex items-center gap-1.5 mt-0.5" aria-label={`${lives} lives remaining`}>
        {Array.from({ length: Math.max(0, Math.min(lives, maxDisplayLives)) }).map((_, idx) => (
          <span
            key={idx}
            className="w-4 h-1.5 sm:w-5 sm:h-2 rounded-sm bg-gradient-to-r from-pink-500 to-fuchsia-400 shadow-[0_0_8px_rgba(236,72,153,0.8)] animate-pulse"
          />
        ))}
        {lives > maxDisplayLives && (
          <span className="text-xs font-bold text-pink-400">+{lives - maxDisplayLives}</span>
        )}
        {lives <= 0 && (
          <span className="text-xs font-bold text-red-500 animate-bounce">CRITICAL</span>
        )}
      </div>
    </div>
  );
};
