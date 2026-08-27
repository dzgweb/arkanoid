import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StartScreenModal } from '@/components/Modals/StartScreenModal';
import { PauseModal } from '@/components/Modals/PauseModal';
import { StageClearModal } from '@/components/Modals/StageClearModal';
import { GameOverModal } from '@/components/Modals/GameOverModal';
import { HighScoresModal } from '@/components/Modals/HighScoresModal';
import { AudioControls } from '@/components/AudioControls';
import { TouchControls } from '@/components/Controls/TouchControls';

describe('Modal Overlays and Control Components', () => {
  describe('StartScreenModal', () => {
    it('renders title, high score preview, and triggers start callback', () => {
      const onStart = vi.fn();
      const onOpenHighScores = vi.fn();
      render(
        <StartScreenModal
          onStart={onStart}
          onOpenHighScores={onOpenHighScores}
          highScore={50000}
        />
      );

      expect(screen.getByText('ARKANOID')).toBeInTheDocument();
      expect(screen.getByText('0050000')).toBeInTheDocument();

      const startButton = screen.getByRole('button', { name: /START GAME/i });
      fireEvent.click(startButton);
      expect(onStart).toHaveBeenCalledTimes(1);

      const highScoresButton = screen.getByRole('button', { name: /HIGH SCORES/i });
      fireEvent.click(highScoresButton);
      expect(onOpenHighScores).toHaveBeenCalledTimes(1);
    });
  });

  describe('PauseModal', () => {
    it('renders pause text and triggers resume and restart callbacks', () => {
      const onResume = vi.fn();
      const onRestart = vi.fn();
      const onToggleMute = vi.fn();
      const onVolumeChange = vi.fn();

      render(
        <PauseModal
          onResume={onResume}
          onRestart={onRestart}
          isMuted={false}
          volume={0.8}
          onToggleMute={onToggleMute}
          onVolumeChange={onVolumeChange}
        />
      );

      expect(screen.getByText('SYSTEM PAUSED')).toBeInTheDocument();

      const resumeButton = screen.getByRole('button', { name: /RESUME MISSION/i });
      fireEvent.click(resumeButton);
      expect(onResume).toHaveBeenCalledTimes(1);

      const restartButton = screen.getByRole('button', { name: /RESTART LEVEL/i });
      fireEvent.click(restartButton);
      expect(onRestart).toHaveBeenCalledTimes(1);
    });
  });

  describe('StageClearModal', () => {
    it('renders stage clear information and handles next level button', () => {
      const onNextLevel = vi.fn();
      render(
        <StageClearModal
          level={3}
          score={42000}
          onNextLevel={onNextLevel}
        />
      );

      expect(screen.getByText('STAGE 3 CLEARED!')).toBeInTheDocument();
      expect(screen.getByText('0042000')).toBeInTheDocument();

      const nextButton = screen.getByRole('button', { name: /NEXT STAGE/i });
      fireEvent.click(nextButton);
      expect(onNextLevel).toHaveBeenCalledTimes(1);
    });

    it('renders campaign victory screen', () => {
      const onNextLevel = vi.fn();
      render(
        <StageClearModal
          level={6}
          score={100000}
          isVictory={true}
          onNextLevel={onNextLevel}
        />
      );

      expect(screen.getByText('CAMPAIGN CLEARED!')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /PLAY AGAIN/i })).toBeInTheDocument();
    });
  });

  describe('GameOverModal', () => {
    it('renders game over screen with score and handles initials form submit', () => {
      const onSaveScore = vi.fn();
      const onRestart = vi.fn();
      const onOpenHighScores = vi.fn();

      render(
        <GameOverModal
          score={85000}
          level={4}
          isHighScore={true}
          onSaveScore={onSaveScore}
          onRestart={onRestart}
          onOpenHighScores={onOpenHighScores}
        />
      );

      expect(screen.getByText('GAME OVER')).toBeInTheDocument();
      expect(screen.getByText('0085000')).toBeInTheDocument();
      expect(screen.getByText(/NEW HIGH SCORE ENTRY/i)).toBeInTheDocument();

      const input = screen.getByPlaceholderText('AAA');
      fireEvent.change(input, { target: { value: 'XYZ' } });

      const saveButton = screen.getByRole('button', { name: /SAVE/i });
      fireEvent.click(saveButton);
      expect(onSaveScore).toHaveBeenCalledWith('XYZ');
    });
  });

  describe('HighScoresModal', () => {
    it('renders leaderboard and allows closing', () => {
      const onClose = vi.fn();
      render(<HighScoresModal onClose={onClose} />);

      expect(screen.getByText(/HALL OF FAME/i)).toBeInTheDocument();
      const closeButton = screen.getByRole('button', { name: /CLOSE/i });
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('AudioControls', () => {
    it('handles mute toggle and volume slider change', () => {
      const onToggleMute = vi.fn();
      const onVolumeChange = vi.fn();

      render(
        <AudioControls
          isMuted={false}
          volume={0.8}
          onToggleMute={onToggleMute}
          onVolumeChange={onVolumeChange}
        />
      );

      const muteBtn = screen.getByRole('button', { name: /Mute Audio/i });
      fireEvent.click(muteBtn);
      expect(onToggleMute).toHaveBeenCalledTimes(1);

      const slider = screen.getByLabelText('Volume Slider');
      fireEvent.change(slider, { target: { value: '0.5' } });
      expect(onVolumeChange).toHaveBeenCalledWith(0.5);
    });
  });

  describe('TouchControls', () => {
    it('handles launch and pause clicks', () => {
      const onLaunch = vi.fn();
      const onPauseToggle = vi.fn();

      render(
        <TouchControls
          status="PLAYING"
          onLaunch={onLaunch}
          onPauseToggle={onPauseToggle}
        />
      );

      const launchBtn = screen.getByRole('button', { name: /Launch Ball or Fire Laser/i });
      fireEvent.click(launchBtn);
      expect(onLaunch).toHaveBeenCalledTimes(1);

      const pauseBtn = screen.getByRole('button', { name: /Pause Game/i });
      fireEvent.click(pauseBtn);
      expect(onPauseToggle).toHaveBeenCalledTimes(1);
    });
  });
});
