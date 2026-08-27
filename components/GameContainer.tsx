/**
 * @file components/GameContainer.tsx
 * Master Arkanoid cabinet component with responsive viewport scaling,
 * decoupled HUD bridge, modal overlays, audio controls, and mobile touch overlay.
 */

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CanvasStage } from './CanvasStage';
import { ScoreBoard } from './HUD/ScoreBoard';
import { LivesDisplay } from './HUD/LivesDisplay';
import { LevelIndicator } from './HUD/LevelIndicator';
import { ComboMultiplier } from './HUD/ComboMultiplier';
import { PowerupBadges } from './HUD/PowerupBadges';
import { AudioControls } from './AudioControls';
import { TouchControls } from './Controls/TouchControls';
import { StartScreenModal } from './Modals/StartScreenModal';
import { PauseModal } from './Modals/PauseModal';
import { StageClearModal } from './Modals/StageClearModal';
import { GameOverModal } from './Modals/GameOverModal';
import { HighScoresModal } from './Modals/HighScoresModal';
import { useGameStateBridge } from '@/hooks/useGameStateBridge';
import { useAudio } from '@/hooks/useAudio';
import { saveHighScore, isHighScoreEligible } from '@/utils/highScores';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 700;

export const GameContainer: React.FC = () => {
  const [showHighScores, setShowHighScores] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [forceTouchControls, setForceTouchControls] = useState<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Decoupled Game Engine Bridge Hook
  const {
    hudState,
    engineRef,
    startGame,
    pauseGame,
    resumeGame,
    restartGame,
    nextLevel,
    launchBall,
    fireLaser,
    setMuted,
    setVolume,
  } = useGameStateBridge();

  const audioOptions = useMemo(
    () => ({
      onMuteChange: setMuted,
      onVolumeChange: setVolume,
    }),
    [setMuted, setVolume]
  );

  const { isMuted, volume, toggleMute, changeVolume } = useAudio(audioOptions);

  // Detect Touch screen capability
  useEffect(() => {
    const checkTouch = () => {
      if (typeof window !== 'undefined') {
        const hasTouch =
          (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
          (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)')?.matches);
        setIsTouchDevice(Boolean(hasTouch));
      }
    };
    checkTouch();
  }, []);

  // Global Keyboard Shortcuts (Pause, Mute, Restart)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (document.activeElement?.tagName === 'INPUT') return;

      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        e.preventDefault();
        if (hudState.status === 'PLAYING') {
          pauseGame();
        } else if (hudState.status === 'PAUSED') {
          resumeGame();
        }
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [hudState.status, pauseGame, resumeGame, toggleMute]);

  // Handle High Score Submission
  const handleSaveScore = useCallback(
    (name: string) => {
      saveHighScore(name, hudState.score, hudState.level);
      setShowHighScores(true);
    },
    [hudState.score, hudState.level]
  );

  // Determine active powerup statuses for contextual buttons
  const hasLasers = hudState.activePowerups.some(
    (p) => p.type === 'LASER' || p.type === 'LASER_PADDLE'
  );
  const showControls = forceTouchControls ?? isTouchDevice;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center w-full min-h-screen bg-slate-950 text-white font-mono select-none overflow-x-hidden p-1 sm:p-4"
    >
      {/* Outer Retro Cabinet Glow Frame */}
      <div className="relative w-full max-w-[800px] flex flex-col rounded-xl border border-cyan-500/30 bg-slate-900/90 shadow-[0_0_50px_rgba(6,182,212,0.15)] backdrop-blur-md overflow-hidden">
        {/* CRT Scanline Overlay Effect */}
        <div className="pointer-events-none absolute inset-0 z-40 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-60" />

        {/* Top Header & Global Utility Bar */}
        <header className="relative z-30 flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-950/80 border-b border-cyan-500/20 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
            <h1 className="font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-400 text-shadow-neon text-xs sm:base">
              ARKANOID // 2026
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Toggle On-Screen Controls button */}
            <button
              type="button"
              onClick={() => setForceTouchControls((prev) => (prev === null ? !isTouchDevice : !prev))}
              className={`px-2 py-1 rounded text-[11px] sm:text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                showControls
                  ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400'
              }`}
              title="Toggle Touch Controls"
              aria-label="Toggle Touch Controls"
            >
              📱 <span className="hidden sm:inline">TOUCH</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHighScores(true)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 transition-all text-[11px] sm:text-xs flex items-center gap-1 shadow-[0_0_8px_rgba(245,158,11,0.2)] cursor-pointer"
              aria-label="View Leaderboard"
            >
              🏆 <span className="hidden sm:inline">HIGH SCORES</span>
            </button>

            <AudioControls
              isMuted={isMuted}
              volume={volume}
              onToggleMute={toggleMute}
              onVolumeChange={changeVolume}
            />
          </div>
        </header>

        {/* Primary Arcade HUD Bar */}
        <section className="relative z-30 grid grid-cols-2 sm:grid-cols-4 gap-2 px-3 sm:px-4 py-2 bg-slate-900/90 border-b border-cyan-500/20 text-xs sm:text-sm">
          <ScoreBoard score={hudState.score} highScore={hudState.highScore} />
          <LivesDisplay lives={hudState.lives} />
          <LevelIndicator level={hudState.level} totalLevels={hudState.totalLevels} />
          <ComboMultiplier multiplier={hudState.multiplier} />
        </section>

        {/* Active Powerups Tray */}
        <section className="relative z-30 px-3 sm:px-4 py-1 bg-slate-950/50 min-h-[30px] flex items-center justify-center">
          <PowerupBadges activePowerups={hudState.activePowerups} />
        </section>

        {/* Canvas Game Stage Box (Fixed 800x700 Aspect Ratio) */}
        <main className="relative z-10 w-full aspect-[800/700] bg-black flex items-center justify-center overflow-hidden">
          <CanvasStage engineRef={engineRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />

          {/* Modal Overlays Layer */}
          {hudState.status === 'IDLE' && (
            <StartScreenModal
              onStart={startGame}
              onOpenHighScores={() => setShowHighScores(true)}
              highScore={hudState.highScore}
            />
          )}

          {hudState.status === 'PAUSED' && (
            <PauseModal
              onResume={resumeGame}
              onRestart={restartGame}
              isMuted={isMuted}
              volume={volume}
              onToggleMute={toggleMute}
              onVolumeChange={changeVolume}
            />
          )}

          {hudState.status === 'STAGE_CLEAR' && (
            <StageClearModal
              level={hudState.level}
              score={hudState.score}
              onNextLevel={nextLevel}
            />
          )}

          {hudState.status === 'GAME_OVER' && (
            <GameOverModal
              score={hudState.score}
              level={hudState.level}
              isHighScore={isHighScoreEligible(hudState.score)}
              onSaveScore={handleSaveScore}
              onRestart={restartGame}
              onOpenHighScores={() => setShowHighScores(true)}
            />
          )}

          {hudState.status === 'VICTORY' && (
            <StageClearModal
              level={hudState.level}
              score={hudState.score}
              isVictory={true}
              onNextLevel={restartGame}
            />
          )}

          {showHighScores && (
            <HighScoresModal
              currentScore={hudState.score}
              onClose={() => setShowHighScores(false)}
            />
          )}
        </main>

        {/* Mobile / Touchscreen Virtual Controls */}
        {showControls && (
          <footer className="relative z-30 p-2 sm:p-3 bg-slate-950 border-t border-cyan-500/20">
            <TouchControls
              status={hudState.status}
              hasLasers={hasLasers}
              hasStuckBall={hudState.status === 'IDLE' || hudState.status === 'PLAYING'}
              onLeftChange={(active) => (engineRef.current?.inputManager as unknown as { setLeft?: (a: boolean) => void })?.setLeft?.(active)}
              onRightChange={(active) => (engineRef.current?.inputManager as unknown as { setRight?: (a: boolean) => void })?.setRight?.(active)}
              onTrackpadMove={(x) => engineRef.current?.inputManager?.setPointerX(x)}
              onLaunch={launchBall}
              onFireLaser={fireLaser}
              onPauseToggle={() => {
                if (hudState.status === 'PLAYING') pauseGame();
                else if (hudState.status === 'PAUSED') resumeGame();
              }}
            />
          </footer>
        )}
      </div>
    </div>
  );
};
