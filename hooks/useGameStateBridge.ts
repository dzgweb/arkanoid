/**
 * @file hooks/useGameStateBridge.ts
 * Decoupled 2-tier state bridge connecting the 60 FPS Canvas GameEngine
 * to React HUD and Modal overlays using React useSyncExternalStore.
 */

'use client';

import { useSyncExternalStore, useCallback, useMemo, useRef } from 'react';
import { GameHUDState, GameEngineEvent, GameStatus, PowerupType, GameEngine } from '@/game/types';
import { INITIAL_HUD_STATE } from '@/game/constants';

type Listener = () => void;

export type GameBridgeAction =
  | { type: 'START_GAME' }
  | { type: 'PAUSE_GAME' }
  | { type: 'RESUME_GAME' }
  | { type: 'RESTART_GAME' }
  | { type: 'NEXT_LEVEL' }
  | { type: 'LAUNCH_BALL' }
  | { type: 'FIRE_LASER' }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'SET_MUTED'; muted: boolean }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'SET_TOUCH_CONTROLS'; enabled: boolean }
  | { type: 'SET_STATUS'; status: GameStatus };

/**
 * State store managing cached snapshots and notifying React subscribers
 * only on discrete game events (zero reconciliation overhead on physics frames).
 */
export class GameStateStore {
  private state: GameHUDState;
  private listeners: Set<Listener> = new Set();
  private dispatchActionHandler: ((action: GameBridgeAction) => void) | null = null;

  constructor(initialState: GameHUDState = INITIAL_HUD_STATE) {
    this.state = { ...initialState };
  }

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): GameHUDState => {
    return this.state;
  };

  public getServerSnapshot = (): GameHUDState => {
    return INITIAL_HUD_STATE;
  };

  /**
   * Called by the GameEngine whenever a discrete event occurs
   */
  public emitEvent = (event: GameEngineEvent): void => {
    let stateChanged = false;
    const nextState = { ...this.state };

    switch (event.type) {
      case 'STATE_CHANGED':
        Object.assign(nextState, event.state);
        stateChanged = true;
        break;

      case 'SCORE_CHANGED':
        nextState.score = event.score;
        nextState.multiplier = event.multiplier;
        if (event.score > nextState.highScore) {
          nextState.highScore = event.score;
        }
        stateChanged = true;
        break;

      case 'LIVES_CHANGED':
        nextState.lives = event.lives;
        stateChanged = true;
        break;

      case 'BALL_LOST':
        nextState.lives = event.remainingLives;
        stateChanged = true;
        break;

      case 'BRICK_HIT':
        nextState.score += event.points;
        nextState.combo = event.combo;
        if (nextState.score > nextState.highScore) {
          nextState.highScore = nextState.score;
        }
        stateChanged = true;
        break;

      case 'POWERUP_COLLECTED':
        // Badges update handled in engine state tick or STATE_CHANGED
        stateChanged = true;
        break;

      case 'POWERUP_EXPIRED':
        nextState.activePowerups = nextState.activePowerups.filter(
          (p) => p.type !== event.powerup
        );
        if (event.powerup === 'SHIELD') {
          nextState.hasShield = false;
        }
        stateChanged = true;
        break;

      case 'LEVEL_COMPLETED':
        nextState.status = 'STAGE_CLEAR';
        stateChanged = true;
        break;

      case 'GAME_OVER':
        nextState.status = 'GAME_OVER';
        stateChanged = true;
        break;

      case 'VICTORY':
        nextState.status = 'VICTORY';
        stateChanged = true;
        break;

      default:
        break;
    }

    if (stateChanged) {
      this.state = nextState;
      this.notify();
    }
  };

  /**
   * Directly update a portion of the state and notify subscribers
   */
  public setState = (partial: Partial<GameHUDState>): void => {
    let changed = false;
    for (const key of Object.keys(partial) as Array<keyof GameHUDState>) {
      if (this.state[key] !== partial[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) {
      return;
    }
    this.state = { ...this.state, ...partial };
    this.notify();
  };

  /**
   * Connect an engine dispatch action handler
   */
  public bindActionHandler = (handler: (action: GameBridgeAction) => void): void => {
    this.dispatchActionHandler = handler;
  };

  /**
   * Dispatch action from React UI to GameEngine
   */
  public dispatch = (action: GameBridgeAction): void => {
    if (this.dispatchActionHandler) {
      this.dispatchActionHandler(action);
    }
  };

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

// Global default store instance for singleton use
export const defaultGameStateStore = new GameStateStore();

/**
 * Custom React hook for connecting React UI components to the GameStateStore.
 */
export function useGameStateBridge(store: GameStateStore = defaultGameStateStore) {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );

  const engineRef = useRef<GameEngine | null>(null);

  const startGame = useCallback(() => {
    store.setState({ status: 'PLAYING' });
    store.dispatch({ type: 'START_GAME' });
    engineRef.current?.startGame?.();
  }, [store]);

  const pauseGame = useCallback(() => {
    store.setState({ status: 'PAUSED' });
    store.dispatch({ type: 'PAUSE_GAME' });
    engineRef.current?.pauseGame?.();
  }, [store]);

  const resumeGame = useCallback(() => {
    store.setState({ status: 'PLAYING' });
    store.dispatch({ type: 'RESUME_GAME' });
    engineRef.current?.resumeGame?.();
  }, [store]);

  const restartGame = useCallback(() => {
    store.setState({ status: 'PLAYING', score: 0, lives: 3, level: 1, multiplier: 1, combo: 0 });
    store.dispatch({ type: 'RESTART_GAME' });
    engineRef.current?.restartGame?.();
  }, [store]);

  const nextLevel = useCallback(() => {
    store.setState({ status: 'PLAYING' });
    store.dispatch({ type: 'NEXT_LEVEL' });
    engineRef.current?.nextLevel?.();
  }, [store]);

  const launchBall = useCallback(() => {
    store.dispatch({ type: 'LAUNCH_BALL' });
    engineRef.current?.launchBall?.();
  }, [store]);

  const fireLaser = useCallback(() => {
    store.dispatch({ type: 'FIRE_LASER' });
    engineRef.current?.fireLaser?.();
  }, [store]);

  const toggleMute = useCallback(() => {
    store.dispatch({ type: 'TOGGLE_MUTE' });
  }, [store]);

  const setMuted = useCallback(
    (muted: boolean) => {
      store.setState({ isMuted: muted });
      store.dispatch({ type: 'SET_MUTED', muted });
    },
    [store]
  );

  const setVolume = useCallback(
    (volume: number) => {
      store.setState({ soundVolume: volume, volume });
      store.dispatch({ type: 'SET_VOLUME', volume });
    },
    [store]
  );

  const setTouchControls = useCallback(
    (enabled: boolean) => {
      store.setState({ isTouchControls: enabled });
      store.dispatch({ type: 'SET_TOUCH_CONTROLS', enabled });
    },
    [store]
  );

  const actions = useMemo(
    () => ({
      startGame,
      pauseGame,
      resumeGame,
      restartGame,
      nextLevel,
      launchBall,
      fireLaser,
      toggleMute,
      setMuted,
      setVolume,
      setTouchControls,
      dispatch: store.dispatch,
    }),
    [
      startGame,
      pauseGame,
      resumeGame,
      restartGame,
      nextLevel,
      launchBall,
      fireLaser,
      toggleMute,
      setMuted,
      setVolume,
      setTouchControls,
      store,
    ]
  );

  return {
    ...state,
    hudState: state,
    engineRef,
    startGame,
    pauseGame,
    resumeGame,
    restartGame,
    nextLevel,
    launchBall,
    fireLaser,
    toggleMute,
    setMuted,
    setVolume,
    setTouchControls,
    actions,
  };
}
