/**
 * @file hooks/useAudio.ts
 * Declarative React hook for controlling sound volume, mute state,
 * and triggering UI-layer sound effects with LocalStorage persistence.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SoundType, PowerupType } from '@/game/types';
import { STORAGE_KEY_SETTINGS } from '@/game/constants';
import { storageGet, storageSet } from '@/utils/storage';
import { getSoundManager } from '@/game/audio/SoundManager';

interface SoundManagerRef {
  playSound(type: SoundType, params?: { combo?: number; offsetRatio?: number; type?: PowerupType }): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
}

// Global reference holder for the Web Audio SoundManager singleton
let globalSoundManager: SoundManagerRef | null = null;

export function registerSoundManager(manager: SoundManagerRef | null): void {
  globalSoundManager = manager;
}

export interface UseAudioOptions {
  onMuteChange?: (muted: boolean) => void;
  onVolumeChange?: (volume: number) => void;
}

export function useAudio(options?: UseAudioOptions) {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    const settings = storageGet<{ isMuted: boolean }>(STORAGE_KEY_SETTINGS, {
      isMuted: false,
    });
    return settings.isMuted ?? false;
  });

  const [volume, setVolumeState] = useState<number>(() => {
    const settings = storageGet<{ sfxVolume: number }>(STORAGE_KEY_SETTINGS, {
      sfxVolume: 0.8,
    });
    return settings.sfxVolume ?? 0.8;
  });

  // Stabilize external callback reference using useRef to prevent re-triggering effects
  const optionsRef = useRef<UseAudioOptions | undefined>(options);
  optionsRef.current = options;

  // Track previous values to only invoke callbacks on actual state transitions
  const prevIsMutedRef = useRef<boolean>(isMuted);
  const prevVolumeRef = useRef<number>(volume);
  const isInitialMountRef = useRef<boolean>(true);

  // Automatically register and initialize SoundManager singleton on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const manager = getSoundManager();
      registerSoundManager(manager);
      manager.init().catch(() => {});
    }
  }, []);

  // Sync with global sound manager and callbacks whenever state changes
  useEffect(() => {
    if (globalSoundManager) {
      globalSoundManager.setMuted(isMuted);
      globalSoundManager.setVolume(volume);
    }

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      optionsRef.current?.onMuteChange?.(isMuted);
      optionsRef.current?.onVolumeChange?.(volume);
      prevIsMutedRef.current = isMuted;
      prevVolumeRef.current = volume;
      return;
    }

    if (prevIsMutedRef.current !== isMuted) {
      prevIsMutedRef.current = isMuted;
      optionsRef.current?.onMuteChange?.(isMuted);
    }

    if (prevVolumeRef.current !== volume) {
      prevVolumeRef.current = volume;
      optionsRef.current?.onVolumeChange?.(volume);
    }
  }, [isMuted, volume]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      const settings = storageGet(STORAGE_KEY_SETTINGS, {
        sfxVolume: 0.8,
        isMuted: false,
        crtFilter: true,
        touchControls: false,
        mouseSensitivity: 1.0,
      });
      storageSet(STORAGE_KEY_SETTINGS, { ...settings, isMuted: next });
      return next;
    });
  }, []);

  const setVolume = useCallback(
    (newVolume: number) => {
      const clamped = Math.max(0, Math.min(1, newVolume));
      setVolumeState(clamped);
      const settings = storageGet(STORAGE_KEY_SETTINGS, {
        sfxVolume: 0.8,
        isMuted: false,
        crtFilter: true,
        touchControls: false,
        mouseSensitivity: 1.0,
      });
      storageSet(STORAGE_KEY_SETTINGS, { ...settings, sfxVolume: clamped });
    },
    []
  );

  const playSound = useCallback(
    (type: SoundType, params?: { combo?: number; offsetRatio?: number; type?: PowerupType }) => {
      if (!isMuted && globalSoundManager) {
        globalSoundManager.playSound(type, params);
      }
    },
    [isMuted]
  );

  return {
    isMuted,
    volume,
    toggleMute,
    setVolume,
    changeVolume: setVolume,
    playSound,
  };
}
