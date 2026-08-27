/**
 * @file game/systems/FloatingTextSystem.ts
 * Zero-GC floating popup text system for displaying score awards,
 * combo multiplier badges, cascade alerts, and powerup notifications.
 */

import { lerp } from '../physics/MathUtils';

export interface FloatingTextItem {
  active: boolean;
  text: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  scale: number;
  targetScale: number;
  color: string;
  glowColor: string;
  fontSize: number;
}

export class FloatingTextSystem {
  private pool: FloatingTextItem[] = [];
  private readonly poolSize: number = 30;

  constructor(poolSize: number = 30) {
    this.poolSize = poolSize;
    this.initPool();
  }

  private initPool(): void {
    this.pool = [];
    for (let i = 0; i < this.poolSize; i++) {
      this.pool.push({
        active: false,
        text: '',
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0,
        vx: 0,
        vy: -60,
        life: 0,
        maxLife: 1.0,
        scale: 1.0,
        targetScale: 1.0,
        color: '#ffffff',
        glowColor: 'rgba(255, 255, 255, 0.8)',
        fontSize: 12,
      });
    }
  }

  /**
   * Spawns a floating score / combo multiplier popup text at given coordinates.
   */
  public spawnScorePopup(x: number, y: number, points: number, multiplier: number): void {
    const item = this.getAvailableSlot();
    if (!item) return;

    item.active = true;
    item.x = x;
    item.y = y;
    item.prevX = x;
    item.prevY = y;
    item.vx = (Math.random() - 0.5) * 20;
    item.vy = -65;
    item.life = 0.9;
    item.maxLife = 0.9;

    if (multiplier > 1) {
      item.text = `+${points} x${multiplier}`;
      if (multiplier === 2) {
        item.color = '#38bdf8';
        item.glowColor = 'rgba(56, 189, 248, 0.9)';
        item.fontSize = 13;
        item.scale = 1.35;
      } else if (multiplier === 3) {
        item.color = '#34d399';
        item.glowColor = 'rgba(52, 211, 153, 0.9)';
        item.fontSize = 14;
        item.scale = 1.45;
      } else if (multiplier === 4) {
        item.color = '#fbbf24';
        item.glowColor = 'rgba(251, 191, 36, 0.9)';
        item.fontSize = 15;
        item.scale = 1.55;
      } else if (multiplier < 8) {
        item.text = `COMBO x${multiplier}! +${points}`;
        item.color = '#e879f9';
        item.glowColor = 'rgba(232, 121, 249, 0.9)';
        item.fontSize = 15;
        item.scale = 1.65;
      } else {
        item.text = `MAX x8! +${points}`;
        item.color = '#facc15';
        item.glowColor = 'rgba(250, 204, 21, 1.0)';
        item.fontSize = 16;
        item.scale = 1.8;
      }
    } else {
      item.text = `+${points}`;
      item.color = '#f8fafc';
      item.glowColor = 'rgba(255, 255, 255, 0.7)';
      item.fontSize = 12;
      item.scale = 1.15;
    }
  }

  /**
   * Spawns a custom alert text (e.g. TNT cascade, powerup notification).
   */
  public spawnSpecialText(
    x: number,
    y: number,
    text: string,
    color: string = '#facc15',
    glowColor: string = 'rgba(250, 204, 21, 0.9)',
    fontSize: number = 14
  ): void {
    const item = this.getAvailableSlot();
    if (!item) return;

    item.active = true;
    item.text = text;
    item.x = x;
    item.y = y;
    item.prevX = x;
    item.prevY = y;
    item.vx = 0;
    item.vy = -50;
    item.life = 1.2;
    item.maxLife = 1.2;
    item.scale = 1.5;
    item.color = color;
    item.glowColor = glowColor;
    item.fontSize = fontSize;
  }

  private getAvailableSlot(): FloatingTextItem | null {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        return this.pool[i];
      }
    }
    // Fallback: overwrite oldest item
    let minLifeIndex = 0;
    let minLife = Number.MAX_VALUE;
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].life < minLife) {
        minLife = this.pool[i].life;
        minLifeIndex = i;
      }
    }
    return this.pool[minLifeIndex];
  }

  public update(dt: number): void {
    for (let i = 0; i < this.pool.length; i++) {
      const item = this.pool[i];
      if (!item.active) continue;

      item.prevX = item.x;
      item.prevY = item.y;

      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        continue;
      }

      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vy *= 0.97; // Mild upward drag

      // Elastic scale settling to 1.0
      if (item.scale > 1.0) {
        item.scale = Math.max(1.0, item.scale - dt * 3.5);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number = 1.0): void {
    for (let i = 0; i < this.pool.length; i++) {
      const item = this.pool[i];
      if (!item.active) continue;

      const renderX = lerp(item.prevX, item.x, alpha);
      const renderY = lerp(item.prevY, item.y, alpha);
      const itemAlpha = item.life < 0.3 ? item.life / 0.3 : 1.0;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, itemAlpha));
      ctx.translate(renderX, renderY);
      ctx.scale(item.scale, item.scale);

      ctx.font = `bold ${item.fontSize}px 'Press Start 2P', monospace, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 1. Dual-Pass Black Outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.strokeText(item.text, 0, 0);

      // 2. Glowing Neon Fill
      ctx.shadowBlur = 8;
      ctx.shadowColor = item.glowColor;
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, 0, 0);

      ctx.restore();
    }
  }

  public reset(): void {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
    }
  }

  public getActiveCount(): number {
    let count = 0;
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) count++;
    }
    return count;
  }
}
