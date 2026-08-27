/**
 * @file game/engine/InputManager.ts
 * Unified keyboard, mouse, and touch input state manager with coordinate mapping and event listeners.
 */

import { InputState, GameEngineInputHandler } from '../types';
import { CANVAS_WIDTH } from '../constants';

export type InputActionListener = (action: 'LAUNCH' | 'FIRE_LASER' | 'PAUSE_TOGGLE' | 'MUTE_TOGGLE') => void;

export class InputManager implements GameEngineInputHandler {
  private state: InputState = {
    left: false,
    right: false,
    launch: false,
    fireLaser: false,
    pointerX: null,
    pointerActive: false,
  };

  private actionListeners: Set<InputActionListener> = new Set();
  private boundTarget: HTMLElement | Window | null = null;

  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.reset();
  }

  /**
   * Binds global keyboard event listeners to the window or a designated element.
   */
  public attach(target?: HTMLElement | Window): void {
    if (typeof window === 'undefined') return;
    this.detach();

    const element = target || window;
    this.boundTarget = element;

    this.keydownHandler = (e: KeyboardEvent) => {
      // Ignore shortcut if user is typing high score initials in an input
      if (typeof document !== 'undefined' && document.activeElement?.tagName === 'INPUT') {
        return;
      }

      if (e.repeat) return;

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.state.left = true;
          this.state.pointerActive = false;
          e.preventDefault();
          break;

        case 'ArrowRight':
        case 'KeyD':
          this.state.right = true;
          this.state.pointerActive = false;
          e.preventDefault();
          break;

        case 'Space':
          this.state.launch = true;
          this.state.fireLaser = true;
          this.notifyAction('LAUNCH');
          this.notifyAction('FIRE_LASER');
          e.preventDefault();
          break;

        case 'Escape':
        case 'KeyP':
          this.notifyAction('PAUSE_TOGGLE');
          e.preventDefault();
          break;

        case 'KeyM':
          this.notifyAction('MUTE_TOGGLE');
          e.preventDefault();
          break;

        default:
          break;
      }
    };

    this.keyupHandler = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.state.left = false;
          break;

        case 'ArrowRight':
        case 'KeyD':
          this.state.right = false;
          break;

        case 'Space':
          this.state.launch = false;
          this.state.fireLaser = false;
          break;

        default:
          break;
      }
    };

    element.addEventListener('keydown', this.keydownHandler as EventListener);
    element.addEventListener('keyup', this.keyupHandler as EventListener);
  }

  /**
   * Detaches and cleans up all bound event listeners to prevent memory leaks.
   */
  public detach(): void {
    if (this.boundTarget) {
      if (this.keydownHandler) {
        this.boundTarget.removeEventListener('keydown', this.keydownHandler as EventListener);
      }
      if (this.keyupHandler) {
        this.boundTarget.removeEventListener('keyup', this.keyupHandler as EventListener);
      }
    }
    this.boundTarget = null;
    this.keydownHandler = null;
    this.keyupHandler = null;
  }

  /**
   * Returns a snapshot of current input state.
   */
  public getState(): Readonly<InputState> {
    return this.state;
  }

  /**
   * Sets the pointer position in canonical canvas coordinates [0, 800].
   */
  public setPointerX(x: number | null): void {
    if (x === null) {
      this.state.pointerX = null;
      this.state.pointerActive = false;
      return;
    }
    this.state.pointerX = Math.max(0, Math.min(CANVAS_WIDTH, x));
    this.state.pointerActive = true;
  }

  /**
   * Primary action triggered by mouse click or touch tap.
   */
  public handlePrimaryAction(): void {
    this.notifyAction('LAUNCH');
    this.notifyAction('FIRE_LASER');
  }

  public handleActionPress(): void {
    this.handlePrimaryAction();
  }

  public handlePauseToggle(): void {
    this.notifyAction('PAUSE_TOGGLE');
  }

  /**
   * Subscribes a listener to discrete action events (launch, laser fire, pause, mute).
   */
  public onAction(listener: InputActionListener): () => void {
    this.actionListeners.add(listener);
    return () => {
      this.actionListeners.delete(listener);
    };
  }

  private notifyAction(action: 'LAUNCH' | 'FIRE_LASER' | 'PAUSE_TOGGLE' | 'MUTE_TOGGLE'): void {
    this.actionListeners.forEach((listener) => listener(action));
  }

  /**
   * Resets all input state flags.
   */
  public reset(): void {
    this.state = {
      left: false,
      right: false,
      launch: false,
      fireLaser: false,
      pointerX: null,
      pointerActive: false,
    };
  }
}
