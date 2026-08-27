'use client';

import React from 'react';

interface LevelIndicatorProps {
  level: number;
  totalLevels: number;
}

export const LevelIndicator: React.FC<LevelIndicatorProps> = ({ level, totalLevels }) => {
  const formattedLevel = level.toString().padStart(2, '0');
  const formattedTotal = totalLevels.toString().padStart(2, '0');

  return (
    <div className="flex flex-col justify-center items-start sm:items-center">
      <div className="text-[10px] sm:text-xs text-emerald-400 font-semibold tracking-wider">
        STAGE
      </div>
      <div className="text-sm sm:text-base font-bold text-emerald-300 tracking-wider">
        {formattedLevel} <span className="text-xs text-emerald-500/70">/ {formattedTotal}</span>
      </div>
    </div>
  );
};
