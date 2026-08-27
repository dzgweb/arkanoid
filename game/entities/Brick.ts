/**
 * @file game/entities/Brick.ts
 * Brick entity representing Standard, Armored (multi-hit with procedural cracks),
 * Indestructible (metallic sheen), and Explosive (TNT hazard stripes) bricks.
 */

import { Brick as IBrick, BrickType, PowerupType, BoundingBox, Vector2D } from '../types';
import {
  BRICK_WIDTH,
  BRICK_HEIGHT,
  BRICK_COLORS,
  POINTS_STANDARD,
  POINTS_ARMORED_PER_HIT,
  POINTS_ARMORED_DESTROY,
  POINTS_EXPLOSIVE,
  POINTS_INDESTRUCTIBLE,
} from '../constants';

export interface BrickHitResult {
  destroyed: boolean;
  pointsAwarded: number;
  isIndestructible: boolean;
  damageDealt: number;
  currentHits: number;
  maxHits: number;
  powerupDrop?: PowerupType;
  spawnedPowerup?: PowerupType;
}

export class Brick implements IBrick {
  public id: string;
  public row: number;
  public col: number;
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public type: BrickType;
  public maxHits: number;
  public currentHits: number;
  public color: string;
  public glowColor?: string;
  public borderColor: string;
  public points: number;
  public powerupDrop?: PowerupType;
  public isAlive: boolean;

  // Cached crack vector paths for deterministic rendering
  private crackPathsStage1: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  private crackPathsStage2: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  constructor(
    row: number,
    col: number,
    x: number,
    y: number,
    type: BrickType = 'STANDARD',
    color: string = BRICK_COLORS.CYAN.fill,
    glowColor: string = BRICK_COLORS.CYAN.glow,
    borderColor: string = BRICK_COLORS.CYAN.border,
    maxHits: number = 1,
    points: number = POINTS_STANDARD,
    powerupDrop?: PowerupType
  ) {
    this.id = `brick_${row}_${col}`;
    this.row = row;
    this.col = col;
    this.x = x;
    this.y = y;
    this.width = BRICK_WIDTH;
    this.height = BRICK_HEIGHT;
    this.type = type;
    this.maxHits = type === 'INDESTRUCTIBLE' ? Infinity : maxHits;
    this.currentHits = this.maxHits;
    this.color = color;
    this.glowColor = glowColor;
    this.borderColor = borderColor;
    this.points = points;
    this.powerupDrop = powerupDrop;
    this.isAlive = true;

    if (this.type === 'ARMORED') {
      this.generateDeterministicCracks();
    }
  }

  /**
   * Precomputes deterministic crack fracture vectors for Armored bricks.
   */
  private generateDeterministicCracks(): void {
    const seed = (this.row * 13 + this.col * 37) % 1000;
    const w = this.width;
    const h = this.height;

    // Stage 1 Cracks (Minor damage - single branching fissure)
    const startX1 = ((seed * 7) % (w - 16)) + 8;
    const startY1 = 0;
    const midX1 = startX1 + (((seed * 3) % 12) - 6);
    const midY1 = h * 0.55;
    const endX1 = midX1 + (((seed * 5) % 16) - 8);
    const endY1 = h;

    this.crackPathsStage1 = [
      { x1: startX1, y1: startY1, x2: midX1, y2: midY1 },
      { x1: midX1, y1: midY1, x2: endX1, y2: endY1 },
      { x1: midX1, y1: midY1, x2: midX1 + 10, y2: midY1 - 4 },
    ];

    // Stage 2 Cracks (Heavy damage - complex spiderweb fracture)
    const startX2 = 0;
    const startY2 = ((seed * 11) % (h - 8)) + 4;
    const midX2 = w * 0.45;
    const midY2 = startY2 + (((seed * 9) % 8) - 4);
    const endX2 = w;
    const endY2 = ((seed * 17) % (h - 8)) + 4;

    this.crackPathsStage2 = [
      ...this.crackPathsStage1,
      { x1: startX2, y1: startY2, x2: midX2, y2: midY2 },
      { x1: midX2, y1: midY2, x2: endX2, y2: endY2 },
      { x1: midX2, y1: midY2, x2: midX2 - 8, y2: h - 2 },
      { x1: midX2, y1: midY2, x2: midX2 + 12, y2: 3 },
      { x1: w * 0.75, y1: 0, x2: midX2 + 8, y2: midY2 + 2 },
    ];
  }

  /**
   * Applies damage to the brick and returns the hit evaluation result.
   */
  public hit(damage: number = 1): BrickHitResult {
    if (!this.isAlive) {
      return {
        destroyed: false,
        pointsAwarded: 0,
        isIndestructible: false,
        damageDealt: 0,
        currentHits: 0,
        maxHits: this.maxHits,
      };
    }

    if (this.type === 'INDESTRUCTIBLE') {
      return {
        destroyed: false,
        pointsAwarded: POINTS_INDESTRUCTIBLE,
        isIndestructible: true,
        damageDealt: 0,
        currentHits: Infinity,
        maxHits: Infinity,
      };
    }

    const actualDamage = Math.min(this.currentHits, damage);
    this.currentHits -= actualDamage;

    if (this.currentHits <= 0) {
      this.isAlive = false;
      this.currentHits = 0;

      let awardedPoints = this.points;
      if (this.type === 'ARMORED') {
        awardedPoints = this.maxHits >= 3 ? 350 : POINTS_ARMORED_DESTROY;
      } else if (this.type === 'EXPLOSIVE') {
        awardedPoints = POINTS_EXPLOSIVE;
      }

      return {
        destroyed: true,
        pointsAwarded: awardedPoints,
        isIndestructible: false,
        damageDealt: actualDamage,
        currentHits: 0,
        maxHits: this.maxHits,
        powerupDrop: this.powerupDrop,
        spawnedPowerup: this.powerupDrop,
      };
    }

    // Brick survived the hit (e.g. Armored brick taking non-fatal hit)
    const pointsAwarded = this.type === 'ARMORED' ? POINTS_ARMORED_PER_HIT : 0;
    return {
      destroyed: false,
      pointsAwarded,
      isIndestructible: false,
      damageDealt: actualDamage,
      currentHits: this.currentHits,
      maxHits: this.maxHits,
    };
  }

  /**
   * Returns the Axis-Aligned Bounding Box.
   */
  public getBounds(): BoundingBox {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Returns center coordinates.
   */
  public getCenter(): Vector2D {
    return {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2,
    };
  }

  /**
   * Renders the brick on the 2D canvas according to its type and state.
   */
  public render(ctx: CanvasRenderingContext2D, timeMs: number = 0): void {
    if (!this.isAlive) return;

    ctx.save();

    switch (this.type) {
      case 'STANDARD':
        this.renderStandard(ctx);
        break;
      case 'ARMORED':
        this.renderArmored(ctx);
        break;
      case 'INDESTRUCTIBLE':
        this.renderIndestructible(ctx, timeMs);
        break;
      case 'EXPLOSIVE':
        this.renderExplosive(ctx, timeMs);
        break;
    }

    ctx.restore();
  }

  /**
   * Renders a standard vibrant arcade brick with 3D bevels.
   */
  private renderStandard(ctx: CanvasRenderingContext2D): void {
    const { x, y, width, height, color, borderColor, glowColor } = this;

    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 6;
    }

    // Main Fill
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);

    // Bevel highlights & shadows
    ctx.shadowBlur = 0;

    // Top & Left Highlight Bevel
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width - 3, y + 3);
    ctx.lineTo(x + 3, y + 3);
    ctx.lineTo(x + 3, y + height - 3);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();

    // Bottom & Right Shadow Bevel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.moveTo(x + width, y);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x + 3, y + height - 3);
    ctx.lineTo(x + width - 3, y + height - 3);
    ctx.lineTo(x + width - 3, y + 3);
    ctx.closePath();
    ctx.fill();

    // Outer Border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  }

  /**
   * Renders a multi-hit armored brick with dynamic shading and crack overlays.
   */
  private renderArmored(ctx: CanvasRenderingContext2D): void {
    const { x, y, width, height, currentHits, maxHits } = this;

    // Select color palette by remaining hits
    let fill: string = BRICK_COLORS.ARMORED.STAGE3.fill;
    let border: string = BRICK_COLORS.ARMORED.STAGE3.border;

    if (currentHits === 2 && maxHits >= 3) {
      fill = BRICK_COLORS.ARMORED.STAGE2.fill;
      border = BRICK_COLORS.ARMORED.STAGE2.border;
    } else if (currentHits === 1) {
      fill = BRICK_COLORS.ARMORED.STAGE1.fill;
      border = BRICK_COLORS.ARMORED.STAGE1.border;
    }

    // Metallic body
    const grad = ctx.createLinearGradient(x, y, x, y + height);
    grad.addColorStop(0, '#f1f5f9');
    grad.addColorStop(0.2, fill);
    grad.addColorStop(0.8, fill);
    grad.addColorStop(1, '#334155');

    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);

    // Bevel edges
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(x, y, width, 2);
    ctx.fillRect(x, y, 2, height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y + height - 2, width, 2);
    ctx.fillRect(x + width - 2, y, 2, height);

    // Outer Border
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    // Procedural Crack Overlays
    const damageTaken = maxHits - currentHits;
    if (damageTaken > 0) {
      const crackLines =
        damageTaken >= 2 || (maxHits === 2 && damageTaken === 1)
          ? this.crackPathsStage2
          : this.crackPathsStage1;

      // Dark crack fissure core
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const line of crackLines) {
        ctx.moveTo(x + line.x1, y + line.y1);
        ctx.lineTo(x + line.x2, y + line.y2);
      }
      ctx.stroke();

      // Specular crack highlight offset
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (const line of crackLines) {
        ctx.moveTo(x + line.x1 + 0.6, y + line.y1 + 0.6);
        ctx.lineTo(x + line.x2 + 0.6, y + line.y2 + 0.6);
      }
      ctx.stroke();
    }
  }

  /**
   * Renders an indestructible titanium/gold metallic brick with sheen animation and corner rivets.
   */
  private renderIndestructible(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const { x, y, width, height } = this;

    // Dual-tone metallic gradient
    const grad = ctx.createLinearGradient(x, y, x + width, y + height);
    grad.addColorStop(0, '#94a3b8');
    grad.addColorStop(0.3, '#e2e8f0');
    grad.addColorStop(0.5, '#64748b');
    grad.addColorStop(0.7, '#cbd5e1');
    grad.addColorStop(1, '#475569');

    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);

    // Metallic sheen specular sweep animation
    const sheenSpeed = 0.12; // px/ms
    const sheenPhase = (this.row * 32 + this.col * 48);
    const sheenWidth = 24;
    const cycle = width * 3.5;
    const sheenPos = ((timeMs * sheenSpeed + sheenPhase) % cycle) - sheenWidth;

    if (sheenPos >= -sheenWidth && sheenPos <= width + sheenWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.clip();

      const sheenGrad = ctx.createLinearGradient(x + sheenPos, y, x + sheenPos + sheenWidth, y + height);
      sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
      sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = sheenGrad;
      ctx.fillRect(x, y, width, height);
      ctx.restore();
    }

    // Heavy Double Bevel
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, width - 3, height - 3);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    // 4 Corner Rivets
    const rivetOffset = 4;
    const rivetRadius = 1.4;
    const rivets = [
      { rx: x + rivetOffset, ry: y + rivetOffset },
      { rx: x + width - rivetOffset, ry: y + rivetOffset },
      { rx: x + rivetOffset, ry: y + height - rivetOffset },
      { rx: x + width - rivetOffset, ry: y + height - rivetOffset },
    ];

    ctx.fillStyle = '#0f172a';
    for (const r of rivets) {
      ctx.beginPath();
      ctx.arc(r.rx, r.ry, rivetRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Renders an explosive TNT brick with hazard stripes and pulsing danger glow.
   */
  private renderExplosive(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const { x, y, width, height } = this;

    // Pulsing danger glow
    const pulse = 0.5 + 0.4 * Math.sin(timeMs * 0.008 + this.row + this.col);
    ctx.shadowColor = `rgba(244, 63, 94, ${pulse.toFixed(2)})`;
    ctx.shadowBlur = 10;

    // Base danger red fill
    ctx.fillStyle = '#e11d48';
    ctx.fillRect(x, y, width, height);
    ctx.shadowBlur = 0;

    // Warning Diagonal Hazard Stripes (Yellow / Dark Crimson)
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    ctx.strokeStyle = '#facc15'; // Bright hazard yellow
    ctx.lineWidth = 4;
    const stripeSpacing = 10;

    for (let sx = -height; sx < width + height; sx += stripeSpacing) {
      ctx.beginPath();
      ctx.moveTo(x + sx, y);
      ctx.lineTo(x + sx + height, y + height);
      ctx.stroke();
    }

    // Center Badge for "TNT"
    const badgeW = 28;
    const badgeH = 12;
    const badgeX = x + (width - badgeW) / 2;
    const badgeY = y + (height - badgeH) / 2;

    ctx.fillStyle = '#1e1b4b'; // Dark navy badge
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1;
    ctx.strokeRect(badgeX + 0.5, badgeY + 0.5, badgeW - 1, badgeH - 1);

    // Stencil Text "TNT"
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TNT', x + width / 2, y + height / 2 + 0.5);

    ctx.restore();

    // Outer Border
    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  }

  // ==========================================
  // Factory Helpers
  // ==========================================

  public static createStandard(
    row: number,
    col: number,
    x: number,
    y: number,
    colorKey: keyof typeof BRICK_COLORS = 'CYAN',
    powerupDrop?: PowerupType
  ): Brick {
    const palette = BRICK_COLORS[colorKey] as { fill: string; glow: string; border: string };
    return new Brick(
      row,
      col,
      x,
      y,
      'STANDARD',
      palette.fill,
      palette.glow,
      palette.border,
      1,
      POINTS_STANDARD,
      powerupDrop
    );
  }

  public static createArmored(
    row: number,
    col: number,
    x: number,
    y: number,
    maxHits: 2 | 3 = 2,
    powerupDrop?: PowerupType
  ): Brick {
    const points = maxHits === 3 ? 350 : POINTS_ARMORED_DESTROY;
    return new Brick(
      row,
      col,
      x,
      y,
      'ARMORED',
      BRICK_COLORS.ARMORED.STAGE2.fill,
      BRICK_COLORS.ARMORED.STAGE2.glow,
      BRICK_COLORS.ARMORED.STAGE2.border,
      maxHits,
      points,
      powerupDrop
    );
  }

  public static createIndestructible(row: number, col: number, x: number, y: number): Brick {
    return new Brick(
      row,
      col,
      x,
      y,
      'INDESTRUCTIBLE',
      BRICK_COLORS.INDESTRUCTIBLE.fill,
      BRICK_COLORS.INDESTRUCTIBLE.glow,
      BRICK_COLORS.INDESTRUCTIBLE.border,
      Infinity,
      POINTS_INDESTRUCTIBLE
    );
  }

  public static createExplosive(
    row: number,
    col: number,
    x: number,
    y: number,
    powerupDrop?: PowerupType
  ): Brick {
    return new Brick(
      row,
      col,
      x,
      y,
      'EXPLOSIVE',
      BRICK_COLORS.EXPLOSIVE.fill,
      BRICK_COLORS.EXPLOSIVE.glow,
      BRICK_COLORS.EXPLOSIVE.border,
      1,
      POINTS_EXPLOSIVE,
      powerupDrop
    );
  }
}
