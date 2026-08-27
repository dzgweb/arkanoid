/**
 * @file tests/components/TouchControlsComponent.test.tsx
 * Component & Full Cabinet Integration Tests for Mobile Touch Controls & Input Integration.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GameContainer } from '@/components/GameContainer';
import { TouchControls } from '@/components/Controls/TouchControls';
import { defaultGameStateStore } from '@/hooks/useGameStateBridge';
import { INITIAL_HUD_STATE } from '@/game/constants';

describe('GameContainer Mobile Touch Controls Integration', () => {
  beforeEach(() => {
    defaultGameStateStore.setState(INITIAL_HUD_STATE);
    // Mock requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return setTimeout(() => cb(performance.now()), 16) as unknown as number;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      clearTimeout(id as unknown as NodeJS.Timeout);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Touch Controls when explicitly toggled via the TOUCH header button', () => {
    render(<GameContainer />);

    // Initially on desktop jsdom (matchMedia matches false, ontouchstart undefined), touch controls might be hidden
    const touchToggleBtn = screen.getByRole('button', { name: /Toggle Touch Controls/i });
    expect(touchToggleBtn).toBeInTheDocument();

    // Toggle on-screen touch controls
    fireEvent.click(touchToggleBtn);

    // Mobile game controls toolbar should now be visible
    expect(screen.getByRole('toolbar', { name: /Mobile Game Controls/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /Paddle Position Slider/i })).toBeInTheDocument();
  });

  it('updates paddle position in GameEngine when trackpad slider is dragged', () => {
    render(<GameContainer />);

    // Enable touch controls
    fireEvent.click(screen.getByRole('button', { name: /Toggle Touch Controls/i }));

    const slider = screen.getByRole('slider', { name: /Paddle Position Slider/i });
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 400,
      top: 0,
      bottom: 50,
      width: 400,
      height: 50,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Start game first
    const startBtn = screen.getByRole('button', { name: /START GAME/i });
    fireEvent.click(startBtn);

    // Drag trackpad to 75% (canonical x = 600)
    fireEvent.touchMove(slider, {
      touches: [{ clientX: 300, clientY: 25 }],
    });

    expect(slider).toHaveAttribute('aria-valuenow', '600');
  });

  it('launches the ball and triggers actions via on-screen TouchControls action button', () => {
    render(<GameContainer />);

    // Enable touch controls
    fireEvent.click(screen.getByRole('button', { name: /Toggle Touch Controls/i }));

    // Start game
    const startBtn = screen.getByRole('button', { name: /START GAME/i });
    fireEvent.click(startBtn);

    // Primary action button should be active and clickable
    const actionBtn = screen.getByRole('button', { name: /Launch Ball/i });
    expect(actionBtn).toBeInTheDocument();

    fireEvent.click(actionBtn);
    // Ball launch triggered cleanly without runtime exception
  });

  it('toggles pause and resume cleanly using on-screen touch controls pause button', () => {
    render(<GameContainer />);

    // Enable touch controls
    fireEvent.click(screen.getByRole('button', { name: /Toggle Touch Controls/i }));

    // Start game
    const startBtn = screen.getByRole('button', { name: /START GAME/i });
    fireEvent.click(startBtn);

    // Click pause button in touch controls
    const pauseBtn = screen.getByRole('button', { name: /Pause Game/i });
    fireEvent.click(pauseBtn);

    // Modal should display SYSTEM PAUSED
    expect(screen.getByText('SYSTEM PAUSED')).toBeInTheDocument();

    // Touch controls button should now show RESUME
    const resumeBtn = screen.getByRole('button', { name: /Resume Game/i });
    expect(resumeBtn).toBeInTheDocument();

    // Click resume button in touch controls
    fireEvent.click(resumeBtn);

    // SYSTEM PAUSED modal should be gone
    expect(screen.queryByText('SYSTEM PAUSED')).toBeNull();
  });
});
