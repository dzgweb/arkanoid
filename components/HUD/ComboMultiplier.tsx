'use client';

import React from 'react';

interface ComboMultiplierProps {
  multiplier: number;
}

export const ComboMultiplier: React.FC<ComboMultiplierProps> = ({ multiplier }) => {
  const isElevated = multiplier > 1;

  return (
    <div className="flex flex-col justify-center items-end">
      <div className="text-[10px] sm:text-xs text-purple-400 font-semibold tracking-wider">
        COMBO
      </div>
      <div
        className={`text-sm sm:text-base font-black tracking-wider transition-all duration-200 ${
          isElevated
            ? 'text-yellow-300 scale-110 drop-shadow-[0_0_10px_rgba(234,179,8,0.9)] animate-pulse'
            : 'text-slate-500'
        }`}
      >
        x{multiplier}
      </div>
    </div>
  );
};
