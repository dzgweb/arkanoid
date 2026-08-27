'use client';

import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';

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
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        className={`p-1.5 rounded transition-all cursor-pointer ${
          isMuted
            ? 'bg-red-950/60 border border-red-500/40 text-red-400'
            : 'bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
        }`}
      >
        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>

      <label htmlFor="volume-slider" className="sr-only">
        Volume
      </label>
      <input
        id="volume-slider"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={isMuted ? 0 : volume}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        className="w-16 sm:w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
        aria-label="Volume Slider"
      />
    </div>
  );
};
