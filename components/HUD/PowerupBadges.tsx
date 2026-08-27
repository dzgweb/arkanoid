'use client';

import React from 'react';
import type { ActivePowerup, PowerupType } from '@/game/types';

interface PowerupBadgesProps {
  activePowerups: ActivePowerup[];
}

interface PowerupVisualConfig {
  label: string;
  shortCode: string;
  colorClass: string;
  barColor: string;
}

const POWERUP_CONFIGS: Record<PowerupType, PowerupVisualConfig> = {
  MULTI_BALL: {
    label: 'MULTI-BALL',
    shortCode: 'M-BALL',
    colorClass: 'border-cyan-400 text-cyan-300 bg-cyan-950/60 shadow-[0_0_10px_rgba(34,211,238,0.4)]',
    barColor: 'bg-cyan-400',
  },
  LASER: {
    label: 'LASER CANNON',
    shortCode: 'LASER',
    colorClass: 'border-red-500 text-red-300 bg-red-950/60 shadow-[0_0_10px_rgba(239,68,68,0.4)]',
    barColor: 'bg-red-500',
  },
  LASER_PADDLE: {
    label: 'LASER CANNON',
    shortCode: 'LASER',
    colorClass: 'border-red-500 text-red-300 bg-red-950/60 shadow-[0_0_10px_rgba(239,68,68,0.4)]',
    barColor: 'bg-red-500',
  },
  EXTEND: {
    label: 'EXTENDED PADDLE',
    shortCode: 'EXTEND',
    colorClass: 'border-green-400 text-green-300 bg-green-950/60 shadow-[0_0_10px_rgba(74,222,128,0.4)]',
    barColor: 'bg-green-400',
  },
  EXTEND_PADDLE: {
    label: 'EXTENDED PADDLE',
    shortCode: 'EXTEND',
    colorClass: 'border-green-400 text-green-300 bg-green-950/60 shadow-[0_0_10px_rgba(74,222,128,0.4)]',
    barColor: 'bg-green-400',
  },
  SHRINK: {
    label: 'SHRUNK PADDLE',
    shortCode: 'SHRINK',
    colorClass: 'border-orange-500 text-orange-300 bg-orange-950/60 shadow-[0_0_10px_rgba(249,115,22,0.4)]',
    barColor: 'bg-orange-500',
  },
  SHRINK_PADDLE: {
    label: 'SHRUNK PADDLE',
    shortCode: 'SHRINK',
    colorClass: 'border-orange-500 text-orange-300 bg-orange-950/60 shadow-[0_0_10px_rgba(249,115,22,0.4)]',
    barColor: 'bg-orange-500',
  },
  SLOW: {
    label: 'SLOW BALL',
    shortCode: 'SLOW',
    colorClass: 'border-blue-400 text-blue-300 bg-blue-950/60 shadow-[0_0_10px_rgba(96,165,250,0.4)]',
    barColor: 'bg-blue-400',
  },
  SLOW_BALL: {
    label: 'SLOW BALL',
    shortCode: 'SLOW',
    colorClass: 'border-blue-400 text-blue-300 bg-blue-950/60 shadow-[0_0_10px_rgba(96,165,250,0.4)]',
    barColor: 'bg-blue-400',
  },
  FAST: {
    label: 'TURBO BALL',
    shortCode: 'FAST',
    colorClass: 'border-yellow-400 text-yellow-300 bg-yellow-950/60 shadow-[0_0_10px_rgba(250,204,21,0.4)]',
    barColor: 'bg-yellow-400',
  },
  FAST_BALL: {
    label: 'TURBO BALL',
    shortCode: 'FAST',
    colorClass: 'border-yellow-400 text-yellow-300 bg-yellow-950/60 shadow-[0_0_10px_rgba(250,204,21,0.4)]',
    barColor: 'bg-yellow-400',
  },
  STICKY: {
    label: 'STICKY PADDLE',
    shortCode: 'STICKY',
    colorClass: 'border-purple-400 text-purple-300 bg-purple-950/60 shadow-[0_0_10px_rgba(192,132,252,0.4)]',
    barColor: 'bg-purple-400',
  },
  STICKY_PADDLE: {
    label: 'STICKY PADDLE',
    shortCode: 'STICKY',
    colorClass: 'border-purple-400 text-purple-300 bg-purple-950/60 shadow-[0_0_10px_rgba(192,132,252,0.4)]',
    barColor: 'bg-purple-400',
  },
  SHIELD: {
    label: 'ENERGY SHIELD',
    shortCode: 'SHIELD',
    colorClass: 'border-amber-400 text-amber-300 bg-amber-950/60 shadow-[0_0_10px_rgba(251,191,36,0.4)]',
    barColor: 'bg-amber-400',
  },
};

export const PowerupBadges: React.FC<PowerupBadgesProps> = ({ activePowerups }) => {
  if (!activePowerups || activePowerups.length === 0) {
    return (
      <span className="text-[10px] text-slate-600 tracking-wider">
        NO POWER-UPS ACTIVE
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {activePowerups.map((powerup) => {
        const config = POWERUP_CONFIGS[powerup.type];
        if (!config) return null;

        const maxMs = powerup.maxTimeMs > 0 ? powerup.maxTimeMs : 10000;
        const progressPercent = Math.max(
          0,
          Math.min(100, (powerup.remainingTimeMs / maxMs) * 100)
        );

        return (
          <div
            key={powerup.type}
            className={`relative flex flex-col justify-between px-2 py-0.5 rounded border text-[10px] font-bold overflow-hidden min-w-[70px] ${config.colorClass}`}
          >
            <div className="flex justify-between items-center z-10 gap-1">
              <span>{config.shortCode}</span>
              <span className="text-[9px] opacity-80">
                {(powerup.remainingTimeMs / 1000).toFixed(1)}s
              </span>
            </div>

            {/* Countdown Decay Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
              <div
                className={`h-full transition-all duration-100 ${config.barColor}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
