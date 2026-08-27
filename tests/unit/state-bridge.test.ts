import { describe, it, expect, vi } from 'vitest';
import { GameStateStore } from '@/hooks/useGameStateBridge';

describe('GameStateStore Event & Subscription Bridge', () => {
  it('should initialize with default state', () => {
    const store = new GameStateStore();
    const snapshot = store.getSnapshot();
    expect(snapshot.score).toBe(0);
    expect(snapshot.lives).toBe(3);
    expect(snapshot.status).toBe('IDLE');
    expect(snapshot.level).toBe(1);
    expect(snapshot.totalLevels).toBe(6);
  });

  it('should notify subscribers when STATE_CHANGED event is emitted', () => {
    const store = new GameStateStore();
    let notified = false;
    const unsubscribe = store.subscribe(() => {
      notified = true;
    });

    store.emitEvent({
      type: 'STATE_CHANGED',
      state: { score: 1200, status: 'PLAYING' },
    });

    expect(notified).toBe(true);
    expect(store.getSnapshot().score).toBe(1200);
    expect(store.getSnapshot().status).toBe('PLAYING');

    unsubscribe();
  });

  it('should update score and combo on BRICK_HIT event', () => {
    const store = new GameStateStore();
    store.emitEvent({
      type: 'BRICK_HIT',
      brick: {
        id: 'b1',
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        width: 58,
        height: 20,
        type: 'STANDARD',
        maxHits: 1,
        currentHits: 0,
        color: '#ef4444',
        glowColor: 'rgba(239,68,68,0.6)',
        points: 100,
        isAlive: false,
      },
      combo: 3,
      points: 300,
    });

    expect(store.getSnapshot().score).toBe(300);
    expect(store.getSnapshot().combo).toBe(3);
  });

  it('should update lives on LIVES_CHANGED and BALL_LOST events', () => {
    const store = new GameStateStore();
    store.emitEvent({
      type: 'LIVES_CHANGED',
      lives: 2,
    });
    expect(store.getSnapshot().lives).toBe(2);

    store.emitEvent({
      type: 'BALL_LOST',
      remainingLives: 1,
    });
    expect(store.getSnapshot().lives).toBe(1);
  });

  it('should handle SCORE_CHANGED and update highScore if exceeded', () => {
    const store = new GameStateStore();
    store.emitEvent({
      type: 'SCORE_CHANGED',
      score: 150000,
      multiplier: 2,
    });
    expect(store.getSnapshot().score).toBe(150000);
    expect(store.getSnapshot().multiplier).toBe(2);
    expect(store.getSnapshot().highScore).toBe(150000);
  });

  it('should handle LEVEL_COMPLETED, GAME_OVER, and VICTORY events', () => {
    const store = new GameStateStore();
    store.emitEvent({
      type: 'LEVEL_COMPLETED',
      level: 1,
      totalScore: 5000,
    });
    expect(store.getSnapshot().status).toBe('STAGE_CLEAR');

    store.emitEvent({
      type: 'GAME_OVER',
      finalScore: 5000,
      isHighScore: false,
    });
    expect(store.getSnapshot().status).toBe('GAME_OVER');

    store.emitEvent({
      type: 'VICTORY',
      finalScore: 50000,
    });
    expect(store.getSnapshot().status).toBe('VICTORY');
  });

  it('should handle POWERUP_EXPIRED event', () => {
    const store = new GameStateStore();
    store.setState({
      activePowerups: [
        { type: 'LASER', remainingTimeMs: 5000, maxTimeMs: 10000 },
        { type: 'SHIELD', remainingTimeMs: 8000, maxTimeMs: 20000 },
      ],
      hasShield: true,
    });

    store.emitEvent({
      type: 'POWERUP_EXPIRED',
      powerup: 'SHIELD',
    });

    expect(store.getSnapshot().activePowerups).toHaveLength(1);
    expect(store.getSnapshot().activePowerups[0].type).toBe('LASER');
    expect(store.getSnapshot().hasShield).toBe(false);
  });

  it('should forward dispatched actions to bound handler', () => {
    const store = new GameStateStore();
    const handler = vi.fn();
    store.bindActionHandler(handler);

    store.dispatch({ type: 'START_GAME' });
    expect(handler).toHaveBeenCalledWith({ type: 'START_GAME' });

    store.dispatch({ type: 'FIRE_LASER' });
    expect(handler).toHaveBeenCalledWith({ type: 'FIRE_LASER' });
  });
});
