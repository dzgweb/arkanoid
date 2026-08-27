/**
 * @file components/AudioControls.tsx
 * Accessible, cyber-retro arcade audio controls toolbar component.
 * Features dynamic volume icons (Volume2, Volume1, VolumeX),
 * styled slider with neon glow, and ARIA accessibility attributes.
 */

'use client';

import React from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

interface AudioControlsProps {
  isMuted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  isMuted,
  volume,
  onToggleMute,
  onVolumeChange,
}) => {
  const effectiveVolume = isMuted ? 0 : volume;

  const renderVolumeIcon = () => {
    if (isMuted || volume === 0) {
      return <VolumeX size={16} className="text-red-400" />;
    }
    if (volume < 0.5) {
      return <Volume1 size={16} className="text-cyan-400" />;
    }
    return <Volume2 size={16} className="text-cyan-300" />;
  };

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Audio Controls">
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        title={isMuted ? 'Unmute (Press M)' : 'Mute (Press M)'}
        className={`p-1.5 rounded transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
          isMuted
            ? 'bg-red-950/60 border border-red-500/40 text-red-400 hover:bg-red-900/60 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
            : 'bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
        }`}
      >
        {renderVolumeIcon()}
      </button>

      <label htmlFor="volume-slider" className="sr-only">
        Volume Slider
      </label>
      <input
        id="volume-slider"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={effectiveVolume}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        aria-label="Volume Slider"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={effectiveVolume}
        aria-valuetext={`${Math.round(effectiveVolume * 100)}%`}
        className="w-16 sm:w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.2)]"
      />
    </div>
  );
};
