/**
 * @file tests/unit/touch-input-adversarial-m5.test.tsx
 * Comprehensive Adversarial Stress & Empirical Verification Suite for Milestone 5:
 * Mobile Touch Controls, Trackpad Drag Mapping, Virtual D-Pad Steering & Input Integration.
 *
 * Focus Areas:
 * 1. Trackpad / Slider Drag Mapping:
 *    - Strict canonical bounding across x in [0, 800] over 10,000 continuous/random coordinates.
 *    - Clamping behavior under extreme negative (-10,000) and excessive positive (+10,000) coordinates.
 *    - Zero/negative DOM rect bounding dimensions and detached element safety.
 *    - Touch event lifecycle (TouchStart, TouchMove, TouchEnd, TouchCancel) & multi-touch handling.
 *    - ARIA accessibility attribute synchronization (aria-valuemin, aria-valuemax, aria-valuenow).
 * 2. Virtual D-Pad Steering Buttons:
 *    - Mode switching between Trackpad/Slider and D-Pad with clean state clearing.
 *    - Touch & pointer event bindings (PointerDown/Up/Cancel/Leave, TouchStart/End).
 *    - InputManager.setLeft / setRight state mutations and pointerActive preemption.
 *    - Simultaneous dual-direction conflict resolution in physics integration (net moveDir = 0).
 *    - Component unmount lifecycle cleanup preventing stuck active directional states.
 * 3. Context-Aware Action Button Transitions:
 *    - Dynamic UI transition matrix across (hasLasers, hasStuckBall, GameStatus).
 *    - Accurate action routing: Fire Lasers (onFireLaser) vs. Launch Ball (onLaunch).
 *    - Rapid trigger spamming stress (1,000 sequential clicks).
 * 4. InputManager Dispatch, Action Listeners & Keyboard Engine Integration:
 *    - Re-entrant subscriber lifecycle & multi-listener fan-out (100 concurrent listeners).
 *    - Global keyboard shortcuts & text input focus suppression (ignore when typing in INPUT).
 *    - Deterministic paddle physics integration across trackpad coordinates and D-pad velocity.
 * 5. Touch Haptic Feedback & Pause Toggle:
 *    - Navigator.vibrate invocations across touch interactions with graceful fallback.
 *    - Pause / Resume toggle button state representation and event routing.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TouchControls } from '@/components/Controls/TouchControls';
import { InputManager } from '@/game/engine/InputManager';
import { Paddle } from '@/game/entities/Paddle';
import { GameEngine } from '@/game/engine/GameEngine';
import { GameStateStore } from '@/hooks/useGameStateBridge';
import {
  CANVAS_WIDTH,
  PADDLE_BASE_WIDTH,
  PADDLE_KEYBOARD_SPEED,
} from '@/game/constants';

describe('Adversarial Stress Suite M5-1: Mobile Touch Controls & Input Integration', () => {
  // Setup / Teardown for Mocking getBoundingClientRect & Navigator.vibrate
  let vibrateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vibrateMock = vi.fn().mockReturnValue(true);
    if (typeof window !== 'undefined') {
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrateMock,
        writable: true,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Dimension 1: Trackpad Drag Mapping & Continuous Bounding (x in [0, 800])
  // =========================================================================
  describe('Dimension 1: Trackpad Drag Mapping & Continuous Bounding (x in [0, 800])', () => {
    it('1.1. Linearly and accurately maps clientX within trackpad bounds to [0, 800]', () => {
      const onTrackpadMove = vi.fn();
      render(
        <TouchControls
          status="PLAYING"
          onTrackpadMove={onTrackpadMove}
          onPauseToggle={vi.fn()}
        />
      );

      const slider = screen.getByRole('slider', { name: /Paddle Position Slider/i });

      // Mock trackpad bounding rect: left = 100, width = 400 (x in [100, 500])
      vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        right: 500,
        top: 200,
        bottom: 250,
        width: 400,
        height: 50,
        x: 100,
        y: 200,
        toJSON: () => {},
      });

      // Test Left Edge: clientX = 100 -> ratio = 0.0 -> canonicalX = 0
      fireEvent.touchStart(slider, {
        touches: [{ clientX: 100, clientY: 225 }],
      });
      expect(onTrackpadMove).toHaveBeenLastCalledWith(0);
      expect(slider).toHaveAttribute('aria-valuenow', '0');

      // Test Midpoint: clientX = 300 -> ratio = 0.5 -> canonicalX = 400
      fireEvent.touchMove(slider, {
        touches: [{ clientX: 300, clientY: 225 }],
      });
      expect(onTrackpadMove).toHaveBeenLastCalledWith(400);
      expect(slider).toHaveAttribute('aria-valuenow', '400');

      // Test Quarter: clientX = 200 -> ratio = 0.25 -> canonicalX = 200
      fireEvent.touchMove(slider, {
        touches: [{ clientX: 200, clientY: 225 }],
      });
      expect(onTrackpadMove).toHaveBeenLastCalledWith(200);
      expect(slider).toHaveAttribute('aria-valuenow', '200');

      // Test Three-Quarters: clientX = 400 -> ratio = 0.75 -> canonicalX = 600
      fireEvent.touchMove(slider, {
        touches: [{ clientX: 400, clientY: 225 }],
      });
      expect(onTrackpadMove).toHaveBeenLastCalledWith(600);
      expect(slider).toHaveAttribute('aria-valuenow', '600');

      // Test Right Edge: clientX = 500 -> ratio = 1.0 -> canonicalX = 800
      fireEvent.touchMove(slider, {
        touches: [{ clientX: 500, clientY: 225 }],
      });
      expect(onTrackpadMove).toHaveBeenLastCalledWith(800);
      expect(slider).toHaveAttribute('aria-valuenow', '800');
    });

    it('1.2. Empirically verifies strict clamping across 10,000 random adversarial coordinates', () => {
      const onTrackpadMove = vi.fn();
      render(
        <TouchControls
          status="PLAYING"
          onTrackpadMove={onTrackpadMove}
          onPauseToggle={vi.fn()}
        />
      );

      const slider = screen.getByRole('slider', { name: /Paddle Position Slider/i });
      const trackpadLeft = 50;
      const trackpadWidth = 300;

      vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
        left: trackpadLeft,
        right: trackpadLeft + trackpadWidth,
        top: 100,
        bottom: 150,
        width: trackpadWidth,
        height: 50,
        x: trackpadLeft,
        y: 100,
        toJSON: () => {},
      });

      // Stress test with 10,000 coordinates ranging from extreme negative to excessive positive
      for (let i = 0; i < 10000; i++) {
        // Range: [-5000, 5000]
        const randomClientX = (Math.random() - 0.5) * 10000;

        fireEvent.touchMove(slider, {
          touches: [{ clientX: randomClientX, clientY: 125 }],
        });

        const emittedX = onTrackpadMove.mock.calls[onTrackpadMove.mock.calls.length - 1][0];

        // 1. Strict canonical range invariant
        expect(emittedX).toBeGreaterThanOrEqual(0);
        expect(emittedX).toBeLessThanOrEqual(800);
        expect(Number.isFinite(emittedX)).toBe(true);
        expect(Number.isNaN(emittedX)).toBe(false);

        // 2. Exact clamping verification
        if (randomClientX <= trackpadLeft) {
          expect(emittedX).toBe(0);
        } else if (randomClientX >= trackpadLeft + trackpadWidth) {
          expect(emittedX).toBe(800);
        } else {
          const expectedRatio = (randomClientX - trackpadLeft) / trackpadWidth;
          const expectedCanonical = expectedRatio * 800;
          expect(emittedX).toBeCloseTo(expectedCanonical, 5);
        }
      }
    });

    it('1.3. Gracefully handles zero/negative DOM rect width without crashing or emitting NaN', () => {
      const onTrackpadMove = vi.fn();
      render(
        <TouchControls
          status="PLAYING"
          onTrackpadMove={onTrackpadMove}
          onPauseToggle={vi.fn()}
        />
      );

      const slider = screen.getByRole('slider', { name: /Paddle Position Slider/i });

      // Simulate unrendered or collapsed container with width = 0
      vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      fireEvent.touchStart(slider, {
        touches: [{ clientX: 150, clientY: 20 }],
      });
      fireEvent.touchMove(slider, {
        touches: [{ clientX: 250, clientY: 20 }],
      });

      // Should safely return early without calling onTrackpadMove
      expect(onTrackpadMove).not.toHaveBeenCalled();
    });

    it('1.4. Validates touch lifecycle state transitions (touchStart, touchMove, touchEnd, touchCancel)', () => {
      render(
        <TouchControls
          status="PLAYING"
          onTrackpadMove={vi.fn()}
          onPauseToggle={vi.fn()}
        />
      );

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

      // TouchStart triggers dragging style
      fireEvent.touchStart(slider, {
        touches: [{ clientX: 200, clientY: 25 }],
      });
      expect(slider.querySelector('.scale-110')).not.toBeNull();

      // TouchEnd removes dragging style
      fireEvent.touchEnd(slider);
      expect(slider.querySelector('.scale-110')).toBeNull();

      // TouchStart again then TouchCancel
      fireEvent.touchStart(slider, {
        touches: [{ clientX: 200, clientY: 25 }],
      });
      expect(slider.querySelector('.scale-110')).not.toBeNull();

      fireEvent.touchCancel(slider);
      expect(slider.querySelector('.scale-110')).toBeNull();
    });

    it('1.5. Handles multi-touch events by tracking only the primary touch point', () => {
      const onTrackpadMove = vi.fn();
      render(
        <TouchControls
          status="PLAYING"
          onTrackpadMove={onTrackpadMove}
          onPauseToggle={vi.fn()}
        />
      );

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

      // Multi-touch with 3 fingers: primary finger at clientX = 100 (25% = 200)
      fireEvent.touchStart(slider, {
        touches: [
          { clientX: 100, clientY: 25 },
          { clientX: 300, clientY: 25 },
          { clientX: 400, clientY: 25 },
        ],
      });
      expect(onTrackpadMove).toHaveBeenLastCalledWith(200);

      // Multi-touch move with primary finger moving to clientX = 300 (75% = 600)
      fireEvent.touchMove(slider, {
        touches: [
          { clientX: 300, clientY: 25 },
          { clientX: 100, clientY: 25 },
        ],
      });
      expect(onTrackpadMove).toHaveBeenLastCalledWith(600);
    });
  });

  // =========================================================================
  // Dimension 2: Virtual D-Pad Steering & Input Integration (setLeft, setRight)
  // =========================================================================
  describe('Dimension 2: Virtual D-Pad Steering & Input Integration', () => {
    it('2.1. Switches seamlessly between SLIDER and D-PAD modes and clears steering state', () => {
      const onLeftChange = vi.fn();
      const onRightChange = vi.fn();

      render(
        <TouchControls
          status="PLAYING"
          onLeftChange={onLeftChange}
          onRightChange={onRightChange}
          onPauseToggle={vi.fn()}
        />
      );

      // Initial mode is SLIDER
      expect(screen.getByRole('button', { name: /SLIDER/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('slider', { name: /Paddle Position Slider/i })).toBeInTheDocument();

      // Switch to D-PAD mode
      const dpadModeBtn = screen.getByRole('button', { name: /D-PAD/i });
      fireEvent.click(dpadModeBtn);

      expect(dpadModeBtn).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /Move Paddle Left/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Move Paddle Right/i })).toBeInTheDocument();
      expect(screen.queryByRole('slider', { name: /Paddle Position Slider/i })).toBeNull();

      // Mode switch to DPAD should explicitly cancel any ongoing active direction
      expect(onLeftChange).toHaveBeenCalledWith(false);
      expect(onRightChange).toHaveBeenCalledWith(false);
    });

    it('2.2. Dispatches active left and right steering states via Pointer and Touch events', () => {
      const onLeftChange = vi.fn();
      const onRightChange = vi.fn();

      render(
        <TouchControls
          status="PLAYING"
          onLeftChange={onLeftChange}
          onRightChange={onRightChange}
          onPauseToggle={vi.fn()}
        />
      );

      // Switch to D-PAD mode
      fireEvent.click(screen.getByRole('button', { name: /D-PAD/i }));

      const leftBtn = screen.getByRole('button', { name: /Move Paddle Left/i });
      const rightBtn = screen.getByRole('button', { name: /Move Paddle Right/i });

      // Press Left Button (PointerDown)
      fireEvent.pointerDown(leftBtn);
      expect(onLeftChange).toHaveBeenLastCalledWith(true);

      // Release Left Button (PointerUp)
      fireEvent.pointerUp(leftBtn);
      expect(onLeftChange).toHaveBeenLastCalledWith(false);

      // Press Right Button (TouchStart)
      fireEvent.touchStart(rightBtn);
      expect(onRightChange).toHaveBeenLastCalledWith(true);

      // Release Right Button (TouchEnd)
      fireEvent.touchEnd(rightBtn);
      expect(onRightChange).toHaveBeenLastCalledWith(false);

      // Cancel and Leave event handling
      fireEvent.pointerDown(leftBtn);
      expect(onLeftChange).toHaveBeenLastCalledWith(true);
      fireEvent.pointerCancel(leftBtn);
      expect(onLeftChange).toHaveBeenLastCalledWith(false);

      fireEvent.pointerDown(rightBtn);
      expect(onRightChange).toHaveBeenLastCalledWith(true);
      fireEvent.pointerLeave(rightBtn);
      expect(onRightChange).toHaveBeenLastCalledWith(false);
    });

    it('2.3. Verifies InputManager.setLeft and setRight state mutations and pointerActive preemption', () => {
      const inputManager = new InputManager();

      // Set pointer position first
      inputManager.setPointerX(450);
      expect(inputManager.getState().pointerX).toBe(450);
      expect(inputManager.getState().pointerActive).toBe(true);

      // Activating setLeft(true) MUST preempt pointerActive to false
      inputManager.setLeft(true);
      expect(inputManager.getState().left).toBe(true);
      expect(inputManager.getState().pointerActive).toBe(false);

      // Deactivating setLeft(false)
      inputManager.setLeft(false);
      expect(inputManager.getState().left).toBe(false);

      // Reactivating pointer
      inputManager.setPointerX(200);
      expect(inputManager.getState().pointerActive).toBe(true);

      // Activating setRight(true) MUST preempt pointerActive to false
      inputManager.setRight(true);
      expect(inputManager.getState().right).toBe(true);
      expect(inputManager.getState().pointerActive).toBe(false);

      // Deactivating setRight(false)
      inputManager.setRight(false);
      expect(inputManager.getState().right).toBe(false);
    });

    it('2.4. Enforces conflict resolution when both Left and Right are simultaneously pressed', () => {
      const inputManager = new InputManager();
      const paddle = new Paddle();
      const initialPaddleX = paddle.x;

      inputManager.setLeft(true);
      inputManager.setRight(true);
      expect(inputManager.getState().left).toBe(true);
      expect(inputManager.getState().right).toBe(true);

      // Step physics loop with both buttons pressed
      paddle.update(1 / 60, inputManager.getState(), CANVAS_WIDTH);

      // Net velocity must be 0 and position must remain completely static
      expect(paddle.vx).toBe(0);
      expect(paddle.x).toBe(initialPaddleX);
    });

    it('2.5. Resets directional steering states upon TouchControls component unmount', () => {
      const onLeftChange = vi.fn();
      const onRightChange = vi.fn();

      const { unmount } = render(
        <TouchControls
          status="PLAYING"
          onLeftChange={onLeftChange}
          onRightChange={onRightChange}
          onPauseToggle={vi.fn()}
        />
      );

      // Unmount the component
      unmount();

      expect(onLeftChange).toHaveBeenCalledWith(false);
      expect(onRightChange).toHaveBeenCalledWith(false);
    });
  });

  // =========================================================================
  // Dimension 3: Context-Aware Action Button Transitions & Trigger Mechanics
  // =========================================================================
  describe('Dimension 3: Context-Aware Action Button Transitions & Trigger Mechanics', () => {
    it('3.1. Renders FIRE LASERS button when hasLasers is true and routes click to onFireLaser', () => {
      const onFireLaser = vi.fn();
      const onLaunch = vi.fn();

      render(
        <TouchControls
          status="PLAYING"
          hasLasers={true}
          hasStuckBall={true}
          onFireLaser={onFireLaser}
          onLaunch={onLaunch}
          onPauseToggle={vi.fn()}
        />
      );

      const actionBtn = screen.getByRole('button', { name: /Fire Twin Lasers/i });
      expect(actionBtn).toBeInTheDocument();
      expect(actionBtn).toHaveTextContent(/FIRE LASERS/i);
      expect(actionBtn.className).toContain('from-red-600');

      fireEvent.click(actionBtn);
      expect(onFireLaser).toHaveBeenCalledTimes(1);
      expect(onLaunch).not.toHaveBeenCalled();
    });

    it('3.2. Renders LAUNCH BALL button when hasStuckBall is true and routes click to onLaunch', () => {
      const onFireLaser = vi.fn();
      const onLaunch = vi.fn();

      render(
        <TouchControls
          status="PLAYING"
          hasLasers={false}
          hasStuckBall={true}
          onFireLaser={onFireLaser}
          onLaunch={onLaunch}
          onPauseToggle={vi.fn()}
        />
      );

      const actionBtn = screen.getByRole('button', { name: /Launch Ball/i });
      expect(actionBtn).toBeInTheDocument();
      expect(actionBtn).toHaveTextContent(/LAUNCH BALL/i);
      expect(actionBtn.className).toContain('from-amber-500');

      fireEvent.click(actionBtn);
      expect(onLaunch).toHaveBeenCalledTimes(1);
      expect(onFireLaser).not.toHaveBeenCalled();
    });

    it('3.3. Renders generic LAUNCH / FIRE button during ongoing play and routes to onLaunch', () => {
      const onFireLaser = vi.fn();
      const onLaunch = vi.fn();

      render(
        <TouchControls
          status="PLAYING"
          hasLasers={false}
          hasStuckBall={false}
          onFireLaser={onFireLaser}
          onLaunch={onLaunch}
          onPauseToggle={vi.fn()}
        />
      );

      const actionBtn = screen.getByRole('button', { name: /Launch Ball or Fire Laser/i });
      expect(actionBtn).toBeInTheDocument();
      expect(actionBtn).toHaveTextContent(/LAUNCH \/ FIRE/i);

      fireEvent.click(actionBtn);
      expect(onLaunch).toHaveBeenCalledTimes(1);
      expect(onFireLaser).not.toHaveBeenCalled();
    });

    it('3.4. Handles rapid action button trigger spam (1,000 clicks) without memory leak or exception', () => {
      const onFireLaser = vi.fn();
      render(
        <TouchControls
          status="PLAYING"
          hasLasers={true}
          onFireLaser={onFireLaser}
          onPauseToggle={vi.fn()}
        />
      );

      const actionBtn = screen.getByRole('button', { name: /Fire Twin Lasers/i });

      for (let i = 0; i < 1000; i++) {
        fireEvent.click(actionBtn);
      }

      expect(onFireLaser).toHaveBeenCalledTimes(1000);
      expect(vibrateMock).toHaveBeenCalledTimes(1000);
    });
  });

  // =========================================================================
  // Dimension 4: InputManager Dispatch, Action Listeners & Keyboard Engine Integration
  // =========================================================================
  describe('Dimension 4: InputManager Dispatch, Action Listeners & Keyboard Engine Integration', () => {
    it('4.1. Correctly fans out actions to 100 concurrent dynamic listeners and supports clean unsubscription', () => {
      const inputManager = new InputManager();
      const listenerMocks: Array<ReturnType<typeof vi.fn>> = [];
      const unsubs: Array<() => void> = [];

      for (let i = 0; i < 100; i++) {
        const mock = vi.fn();
        listenerMocks.push(mock);
        unsubs.push(inputManager.onAction(mock));
      }

      // Trigger primary action (fires LAUNCH and FIRE_LASER)
      inputManager.handlePrimaryAction();

      listenerMocks.forEach((mock) => {
        expect(mock).toHaveBeenCalledTimes(2);
        expect(mock).toHaveBeenNthCalledWith(1, 'LAUNCH');
        expect(mock).toHaveBeenNthCalledWith(2, 'FIRE_LASER');
      });

      // Unsubscribe even indexed listeners
      for (let i = 0; i < 100; i += 2) {
        unsubs[i]();
      }

      // Trigger pause toggle
      inputManager.handlePauseToggle();

      for (let i = 0; i < 100; i++) {
        if (i % 2 === 0) {
          // Even listeners were unsubscribed, still have 2 calls
          expect(listenerMocks[i]).toHaveBeenCalledTimes(2);
        } else {
          // Odd listeners were kept, received 3rd call
          expect(listenerMocks[i]).toHaveBeenCalledTimes(3);
          expect(listenerMocks[i]).toHaveBeenLastCalledWith('PAUSE_TOGGLE');
        }
      }
    });

    it('4.2. Attaches keyboard listeners and suppresses input when typing in an INPUT element', () => {
      const inputManager = new InputManager();
      const actionListener = vi.fn();
      inputManager.onAction(actionListener);
      inputManager.attach(window);

      // Create dummy input element
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      // Dispatch Space and Left keys while typing
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));

      // Should be completely ignored because activeElement is INPUT
      expect(inputManager.getState().left).toBe(false);
      expect(inputManager.getState().launch).toBe(false);
      expect(actionListener).not.toHaveBeenCalled();

      // Blur input
      input.blur();

      // Dispatch Space and Left keys now
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));

      expect(inputManager.getState().left).toBe(true);
      expect(inputManager.getState().launch).toBe(true);
      expect(actionListener).toHaveBeenCalledWith('LAUNCH');
      expect(actionListener).toHaveBeenCalledWith('FIRE_LASER');

      // KeyUp
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' }));
      expect(inputManager.getState().left).toBe(false);

      inputManager.detach();
      document.body.removeChild(input);
    });

    it('4.3. Full physics simulation: paddle responds deterministically to trackpad and D-pad inputs', () => {
      const inputManager = new InputManager();
      const paddle = new Paddle({ width: 100, x: 350 });
      const dt = 1 / 60;

      // 1. Pointer positioning (e.g. Touch Trackpad dragged to x = 200)
      // Paddle width = 100, target center = 200 -> paddle.x = 200 - 50 = 150
      inputManager.setPointerX(200);
      paddle.update(dt, inputManager.getState(), CANVAS_WIDTH);
      expect(paddle.x).toBe(150);

      // 2. Trackpad dragged past right boundary (x = 800)
      // Clamped paddle.x = 800 - 100 = 700
      inputManager.setPointerX(800);
      paddle.update(dt, inputManager.getState(), CANVAS_WIDTH);
      expect(paddle.x).toBe(700);

      // 3. D-Pad Left steering takes over and moves paddle left
      inputManager.setLeft(true);
      expect(inputManager.getState().pointerActive).toBe(false);

      const expectedSpeed = PADDLE_KEYBOARD_SPEED; // 600 px/s
      paddle.update(dt, inputManager.getState(), CANVAS_WIDTH);
      expect(paddle.vx).toBe(-expectedSpeed);
      expect(paddle.x).toBeCloseTo(700 - expectedSpeed * dt, 5);

      // Move left for 2 full seconds -> hits left wall (x = 0) and strictly clamps
      for (let f = 0; f < 120; f++) {
        paddle.update(dt, inputManager.getState(), CANVAS_WIDTH);
      }
      expect(paddle.x).toBe(0);
      expect(paddle.vx).toBe(0);

      // 4. D-Pad Right steering moves paddle back to the right wall (x = 700)
      inputManager.setLeft(false);
      inputManager.setRight(true);

      for (let f = 0; f < 120; f++) {
        paddle.update(dt, inputManager.getState(), CANVAS_WIDTH);
      }
      expect(paddle.x).toBe(700);
      expect(paddle.vx).toBe(0);
    });
  });

  // =========================================================================
  // Dimension 5: Touch Haptics & Pause/Resume Toggle Button
  // =========================================================================
  describe('Dimension 5: Touch Haptics & Pause/Resume Toggle Button', () => {
    it('5.1. Renders Quick Pause/Resume button and toggles game status', () => {
      const onPauseToggle = vi.fn();

      // When status is PLAYING
      const { rerender } = render(
        <TouchControls
          status="PLAYING"
          onPauseToggle={onPauseToggle}
        />
      );

      const pauseBtn = screen.getByRole('button', { name: /Pause Game/i });
      expect(pauseBtn).toHaveTextContent(/PAUSE/i);
      expect(pauseBtn).not.toHaveClass('animate-pulse');

      fireEvent.click(pauseBtn);
      expect(onPauseToggle).toHaveBeenCalledTimes(1);

      // When status is PAUSED
      rerender(
        <TouchControls
          status="PAUSED"
          onPauseToggle={onPauseToggle}
        />
      );

      const resumeBtn = screen.getByRole('button', { name: /Resume Game/i });
      expect(resumeBtn).toHaveTextContent(/RESUME/i);
      expect(resumeBtn).toHaveClass('animate-pulse');

      fireEvent.click(resumeBtn);
      expect(onPauseToggle).toHaveBeenCalledTimes(2);
    });

    it('5.2. Invokes navigator.vibrate haptic feedback across slider, buttons and actions', () => {
      const onPauseToggle = vi.fn();
      render(
        <TouchControls
          status="PLAYING"
          hasLasers={true}
          onFireLaser={vi.fn()}
          onPauseToggle={onPauseToggle}
        />
      );

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

      // 1. Slider TouchStart triggers haptic (8ms)
      fireEvent.touchStart(slider, {
        touches: [{ clientX: 200, clientY: 25 }],
      });
      expect(vibrateMock).toHaveBeenCalledWith(8);

      // 2. Pause toggle triggers haptic (10ms)
      const pauseBtn = screen.getByRole('button', { name: /Pause Game/i });
      fireEvent.click(pauseBtn);
      expect(vibrateMock).toHaveBeenCalledWith(10);

      // 3. Action button triggers haptic (15ms)
      const actionBtn = screen.getByRole('button', { name: /Fire Twin Lasers/i });
      fireEvent.click(actionBtn);
      expect(vibrateMock).toHaveBeenCalledWith(15);

      // 4. D-Pad button press triggers haptic (12ms)
      fireEvent.click(screen.getByRole('button', { name: /D-PAD/i }));
      const leftBtn = screen.getByRole('button', { name: /Move Paddle Left/i });
      fireEvent.pointerDown(leftBtn);
      expect(vibrateMock).toHaveBeenCalledWith(12);
    });

    it('5.3. Gracefully survives environments where navigator.vibrate throws or is unsupported', () => {
      // Make vibrate throw
      Object.defineProperty(navigator, 'vibrate', {
        value: () => {
          throw new Error('SecurityError: Vibrations blocked by user agent');
        },
        writable: true,
        configurable: true,
      });

      const onPauseToggle = vi.fn();
      render(
        <TouchControls
          status="PLAYING"
          onPauseToggle={onPauseToggle}
        />
      );

      const pauseBtn = screen.getByRole('button', { name: /Pause Game/i });

      // Should not throw
      expect(() => {
        fireEvent.click(pauseBtn);
      }).not.toThrow();

      expect(onPauseToggle).toHaveBeenCalledTimes(1);
    });
  });
});
