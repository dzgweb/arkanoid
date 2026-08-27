'use client';

import React from 'react';

interface ScoreBoardProps {
  score: number;
  highScore: number;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({ score, highScore }) => {
  const formattedScore = Math.max(0, Math.floor(score)).toString().padStart(7, '0');
  const formattedHighScore = Math.max(0, Math.floor(highScore)).toString().padStart(7, '0');

  return (
    <div className="flex flex-col justify-center">
      <div className="text-[10px] sm:text-xs text-cyan-400 font-semibold tracking-wider">
        SCORE
      </div>
      <div className="text-sm sm:text-base font-bold text-white tracking-widest text-shadow-neon">
        {formattedScore}
      </div>
      <div className="text-[9px] text-amber-400/80 tracking-wider">
        HIGH: <span className="text-amber-300 font-medium">{formattedHighScore}</span>
      </div>
    </div>
  );
};
