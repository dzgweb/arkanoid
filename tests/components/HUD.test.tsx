import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreBoard } from '@/components/HUD/ScoreBoard';
import { LivesDisplay } from '@/components/HUD/LivesDisplay';
import { LevelIndicator } from '@/components/HUD/LevelIndicator';
import { ComboMultiplier } from '@/components/HUD/ComboMultiplier';
import { PowerupBadges } from '@/components/HUD/PowerupBadges';
import type { ActivePowerup } from '@/game/types';

describe('Arcade HUD Components', () => {
  describe('ScoreBoard', () => {
    it('renders current score and high score with 7-digit zero-padding', () => {
      render(<ScoreBoard score={4500} highScore={25000} />);
      expect(screen.getByText('0004500')).toBeInTheDocument();
      expect(screen.getByText('0025000')).toBeInTheDocument();
      expect(screen.getByText('SCORE')).toBeInTheDocument();
      expect(screen.getByText(/HIGH:/i)).toBeInTheDocument();
    });

    it('renders zero score with full padding', () => {
      render(<ScoreBoard score={0} highScore={0} />);
      expect(screen.getAllByText('0000000').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('LivesDisplay', () => {
    it('renders correct number of remaining lives', () => {
      render(<LivesDisplay lives={3} />);
      const container = screen.getByLabelText('3 lives remaining');
      expect(container).toBeInTheDocument();
    });

    it('shows critical warning when lives reach zero', () => {
      render(<LivesDisplay lives={0} />);
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    });

    it('shows plus counter when lives exceed maximum display limit', () => {
      render(<LivesDisplay lives={7} maxDisplayLives={5} />);
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  describe('LevelIndicator', () => {
    it('renders current stage number and total stages', () => {
      render(<LevelIndicator level={2} totalLevels={6} />);
      expect(screen.getByText('02')).toBeInTheDocument();
      expect(screen.getByText('/ 06')).toBeInTheDocument();
      expect(screen.getByText('STAGE')).toBeInTheDocument();
    });
  });

  describe('ComboMultiplier', () => {
    it('renders x1 multiplier in standard style when combo is normal', () => {
      render(<ComboMultiplier multiplier={1} />);
      expect(screen.getByText('x1')).toBeInTheDocument();
    });

    it('renders elevated styling when multiplier exceeds 1', () => {
      render(<ComboMultiplier multiplier={4} />);
      const element = screen.getByText('x4');
      expect(element).toBeInTheDocument();
      expect(element.className).toContain('text-yellow-300');
    });
  });

  describe('PowerupBadges', () => {
    it('displays fallback text when no powerups are active', () => {
      render(<PowerupBadges activePowerups={[]} />);
      expect(screen.getByText('NO POWER-UPS ACTIVE')).toBeInTheDocument();
    });

    it('renders active powerup badges with correct labels and remaining seconds', () => {
      const mockPowerups: ActivePowerup[] = [
        { type: 'LASER_PADDLE', remainingTimeMs: 4500, maxTimeMs: 10000 },
        { type: 'MULTI_BALL', remainingTimeMs: 8200, maxTimeMs: 10000 },
      ];

      render(<PowerupBadges activePowerups={mockPowerups} />);
      expect(screen.getByText('LASER')).toBeInTheDocument();
      expect(screen.getByText('4.5s')).toBeInTheDocument();
      expect(screen.getByText('M-BALL')).toBeInTheDocument();
      expect(screen.getByText('8.2s')).toBeInTheDocument();
    });
  });
});
