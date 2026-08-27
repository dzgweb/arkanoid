/**
 * @file game/systems/BrickGridManager.ts
 * Spatial grid manager managing the 12x14 brick matrix, O(1) neighborhood collision queries,
 * 3x3 cascading TNT explosions with 40ms stagger delays, laser collision, and level clear detection.
 */

import { Brick } from '../entities/Brick';
import { Ball } from '../entities/Ball';
import {
  ILevelLayout,
  PowerupType,
  BoundingBox,
  LaserProjectile,
} from '../types';
import {
  GRID_ROWS,
  GRID_COLS,
  BRICK_WIDTH,
  BRICK_HEIGHT,
  GRID_GAP,
  GRID_OFFSET_LEFT,
  GRID_OFFSET_TOP,
  DROP_RATES,
  POWERUP_CONFIGS,
  TRAUMA_EXPLOSION,
  POINTS_EXPLOSIVE,
  POINTS_ARMORED_DESTROY,
} from '../constants';
import { CollisionSystem } from '../physics/CollisionSystem';
import { aabbOverlap } from '../physics/MathUtils';

export interface StaggeredExplosion {
  row: number;
  col: number;
  delayTimer: number; // seconds remaining until detonation
  chainDepth: number;
}

export interface BrickGridCallbacks {
  onBrickHit?: (brick: Brick, pointsAwarded: number, destroyed: boolean) => void;
  onExplosionDetonated?: (x: number, y: number, radiusPx: number, chainDepth: number) => void;
  onScreenShake?: (trauma: number) => void;
  onPowerupSpawn?: (type: PowerupType, x: number, y: number) => void;
}

export class BrickGridManager {
  private grid: Array<Array<Brick | null>>;
  private remainingBreakable: number = 0;
  private totalBricks: number = 0;
  private explosionQueue: StaggeredExplosion[] = [];
  public callbacks: BrickGridCallbacks = {};

  constructor(callbacks?: BrickGridCallbacks) {
    this.grid = Array.from({ length: GRID_ROWS }, () =>
      Array.from({ length: GRID_COLS }, () => null)
    );
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  /**
   * Initializes the grid from an ILevelLayout definition.
   */
  public loadLevel(layout: ILevelLayout): void {
    this.reset();

    for (let r = 0; r < GRID_ROWS; r++) {
      const rowData = layout.matrix[r] || [];
      for (let c = 0; c < GRID_COLS; c++) {
        const code = rowData[c] ?? 0;
        if (code === 0 || code === null) continue;

        const x = GRID_OFFSET_LEFT + c * (BRICK_WIDTH + GRID_GAP);
        const y = GRID_OFFSET_TOP + r * (BRICK_HEIGHT + GRID_GAP);

        const dropKey = `${r}_${c}`;
        const specialDrop = layout.specialDrops ? layout.specialDrops[dropKey] : undefined;

        const brick = this.createBrickFromCode(r, c, x, y, code, specialDrop);
        if (brick) {
          this.grid[r][c] = brick;
          this.totalBricks++;
          if (brick.type !== 'INDESTRUCTIBLE') {
            this.remainingBreakable++;
          }
        }
      }
    }
  }

  /**
   * Factory mapping numeric matrix code to a configured Brick instance.
   */
  private createBrickFromCode(
    row: number,
    col: number,
    x: number,
    y: number,
    code: number,
    specialDrop?: PowerupType
  ): Brick | null {
    switch (code) {
      case 1: // Red Standard
        return Brick.createStandard(row, col, x, y, 'RED', specialDrop);
      case 2: // Orange Standard
        return Brick.createStandard(row, col, x, y, 'ORANGE', specialDrop);
      case 3: // Amber Standard
        return Brick.createStandard(row, col, x, y, 'AMBER', specialDrop);
      case 4: // Green Standard
        return Brick.createStandard(row, col, x, y, 'GREEN', specialDrop);
      case 5: // Cyan Standard
        return Brick.createStandard(row, col, x, y, 'CYAN', specialDrop);
      case 6: // Blue Standard
        return Brick.createStandard(row, col, x, y, 'BLUE', specialDrop);
      case 7: // Purple Standard
        return Brick.createStandard(row, col, x, y, 'PURPLE', specialDrop);
      case 8: // Armored Tier 1 (2 hits)
        return Brick.createArmored(row, col, x, y, 2, specialDrop);
      case 9: // Armored Tier 2 (3 hits)
        return Brick.createArmored(row, col, x, y, 3, specialDrop);
      case 10: // Indestructible Metallic
        return Brick.createIndestructible(row, col, x, y);
      case 11: // Explosive TNT
        return Brick.createExplosive(row, col, x, y, specialDrop);
      default:
        return null;
    }
  }

  /**
   * Resets the entire grid and clears explosion queues.
   */
  public reset(): void {
    this.grid = Array.from({ length: GRID_ROWS }, () =>
      Array.from({ length: GRID_COLS }, () => null)
    );
    this.remainingBreakable = 0;
    this.totalBricks = 0;
    this.explosionQueue = [];
  }

  /**
   * O(1) Neighborhood Spatial Query:
   * Returns all active bricks overlapping or bordering the specified Axis-Aligned Bounding Box.
   */
  public getBricksInAABB(box: BoundingBox): Brick[] {
    const colMin = Math.max(
      0,
      Math.floor((box.x - GRID_OFFSET_LEFT) / (BRICK_WIDTH + GRID_GAP))
    );
    const colMax = Math.min(
      GRID_COLS - 1,
      Math.floor((box.x + box.width - GRID_OFFSET_LEFT) / (BRICK_WIDTH + GRID_GAP))
    );
    const rowMin = Math.max(
      0,
      Math.floor((box.y - GRID_OFFSET_TOP) / (BRICK_HEIGHT + GRID_GAP))
    );
    const rowMax = Math.min(
      GRID_ROWS - 1,
      Math.floor((box.y + box.height - GRID_OFFSET_TOP) / (BRICK_HEIGHT + GRID_GAP))
    );

    const candidates: Brick[] = [];
    for (let r = rowMin; r <= rowMax; r++) {
      for (let c = colMin; c <= colMax; c++) {
        const brick = this.grid[r][c];
        if (brick && brick.isAlive) {
          candidates.push(brick);
        }
      }
    }

    return candidates;
  }

  /**
   * O(1) Neighborhood Circle Query for Ball Collision Detection.
   */
  public getBricksNearCircle(cx: number, cy: number, radius: number): Brick[] {
    return this.getBricksInAABB({
      x: cx - radius,
      y: cy - radius,
      width: radius * 2,
      height: radius * 2,
    });
  }

  /**
   * Retrieves brick at exact grid coordinate (if alive).
   */
  public getBrickAt(row: number, col: number): Brick | null {
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) {
      return null;
    }
    return this.grid[row][col];
  }

  /**
   * Resolves brick at pixel coordinates.
   */
  public getBrickAtPixel(x: number, y: number): Brick | null {
    if (x < GRID_OFFSET_LEFT || y < GRID_OFFSET_TOP) return null;

    const col = Math.floor((x - GRID_OFFSET_LEFT) / (BRICK_WIDTH + GRID_GAP));
    const row = Math.floor((y - GRID_OFFSET_TOP) / (BRICK_HEIGHT + GRID_GAP));

    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return null;

    const brick = this.grid[row][col];
    if (!brick || !brick.isAlive) return null;

    // Verify within brick bounds (not in gap)
    if (
      x >= brick.x &&
      x <= brick.x + brick.width &&
      y >= brick.y &&
      y <= brick.y + brick.height
    ) {
      return brick;
    }

    return null;
  }

  /**
   * Returns a flat array of all currently active/alive bricks.
   */
  public getActiveBricks(): Brick[] {
    const active: Brick[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const brick = this.grid[r][c];
        if (brick && brick.isAlive) {
          active.push(brick);
        }
      }
    }
    return active;
  }

  /**
   * Alias for getActiveBricks() to support test and engine APIs.
   */
  public getBricks(): Brick[] {
    return this.getActiveBricks();
  }

  /**
   * Applies damage to a specific brick and handles destruction, scoring, power-ups,
   * and explosive triggers.
   */
  public damageBrick(brick: Brick, damage: number = 1): void {
    if (!brick.isAlive) return;

    const result = brick.hit(damage);

    if (this.callbacks.onBrickHit) {
      this.callbacks.onBrickHit(brick, result.pointsAwarded, result.destroyed);
    }

    if (result.destroyed) {
      this.remainingBreakable = Math.max(0, this.remainingBreakable - 1);

      // Resolve Power-up Drop
      this.resolvePowerupDrop(brick);

      // If explosive, trigger cascading explosion
      if (brick.type === 'EXPLOSIVE') {
        this.triggerExplosion(brick.row, brick.col, 0);
      }
    }
  }

  /**
   * Checks ball collisions against candidate bricks in the spatial grid.
   * Resolves ball position and velocity upon collision.
   */
  public checkBallCollisions(
    ball: Ball,
    onHit?: (brick: Brick, points: number, destroyed: boolean) => void
  ): { hit: boolean; brick?: Brick } {
    const candidates = this.getBricksNearCircle(ball.x, ball.y, ball.radius);
    if (candidates.length === 0) return { hit: false };

    for (const brick of candidates) {
      if (!brick.isAlive) continue;

      const collision = CollisionSystem.testCircleAABB(
        { x: ball.x, y: ball.y, radius: ball.radius },
        brick.getBounds()
      );

      if (collision.hasCollision) {
        CollisionSystem.resolveCircleCollision(ball, collision);

        const hitResult = brick.hit(1);

        if (this.callbacks.onBrickHit) {
          this.callbacks.onBrickHit(brick, hitResult.pointsAwarded, hitResult.destroyed);
        }
        if (onHit) {
          onHit(brick, hitResult.pointsAwarded, hitResult.destroyed);
        }

        if (hitResult.destroyed) {
          this.remainingBreakable = Math.max(0, this.remainingBreakable - 1);
          this.resolvePowerupDrop(brick);

          if (brick.type === 'EXPLOSIVE') {
            this.triggerExplosion(brick.row, brick.col, 0);
          }
        }

        return { hit: true, brick };
      }
    }

    return { hit: false };
  }

  /**
   * Checks laser projectile collision against candidate bricks.
   */
  public checkLaserCollision(laser: LaserProjectile): { hit: boolean; brick?: Brick } {
    const candidates = this.getBricksInAABB({
      x: laser.x,
      y: laser.y,
      width: laser.width,
      height: laser.height,
    });

    for (const brick of candidates) {
      if (!brick.isAlive) continue;

      if (
        aabbOverlap(
          { x: laser.x, y: laser.y, width: laser.width, height: laser.height },
          brick.getBounds()
        )
      ) {
        return { hit: true, brick };
      }
    }

    return { hit: false };
  }

  /**
   * Executes a 3x3 cascading explosion centered at (row, col).
   * Adjacent breakable bricks are destroyed; adjacent TNTs are enqueued for staggered delay.
   */
  public triggerExplosion(row: number, col: number, chainDepth: number = 0): void {
    const centerBrick = this.grid[row]?.[col];
    const centerX = centerBrick
      ? centerBrick.x + centerBrick.width / 2
      : GRID_OFFSET_LEFT + col * (BRICK_WIDTH + GRID_GAP) + BRICK_WIDTH / 2;
    const centerY = centerBrick
      ? centerBrick.y + centerBrick.height / 2
      : GRID_OFFSET_TOP + row * (BRICK_HEIGHT + GRID_GAP) + BRICK_HEIGHT / 2;

    // If center brick is still alive and breakable, destroy it
    if (centerBrick && centerBrick.isAlive && centerBrick.type !== 'INDESTRUCTIBLE') {
      centerBrick.isAlive = false;
      this.remainingBreakable = Math.max(0, this.remainingBreakable - 1);
      this.resolvePowerupDrop(centerBrick);
      if (this.callbacks.onBrickHit) {
        this.callbacks.onBrickHit(centerBrick, POINTS_EXPLOSIVE, true);
      }
    }

    const blastRadiusPx = (BRICK_WIDTH + GRID_GAP) * 1.5;

    // Trigger visual/audio callbacks
    if (this.callbacks.onExplosionDetonated) {
      this.callbacks.onExplosionDetonated(centerX, centerY, blastRadiusPx, chainDepth);
    }

    if (this.callbacks.onScreenShake) {
      const traumaAmount = TRAUMA_EXPLOSION * Math.min(1.5, 1 + chainDepth * 0.15);
      this.callbacks.onScreenShake(traumaAmount);
    }

    // 3x3 Neighborhood evaluation
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row + dr;
        const nc = col + dc;

        if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
        if (dr === 0 && dc === 0) continue; // Skip detonator center

        const neighbor = this.grid[nr][nc];
        if (!neighbor || !neighbor.isAlive) continue;

        if (neighbor.type === 'INDESTRUCTIBLE') {
          // Indestructible blocks resist explosions
          continue;
        }

        if (neighbor.type === 'EXPLOSIVE') {
          // Mark immediately inactive so it doesn't double-trigger
          neighbor.isAlive = false;
          this.remainingBreakable = Math.max(0, this.remainingBreakable - 1);
          this.resolvePowerupDrop(neighbor);

          if (this.callbacks.onBrickHit) {
            this.callbacks.onBrickHit(neighbor, POINTS_EXPLOSIVE, true);
          }

          // Enqueue cascading explosion with 40ms stagger delay
          this.explosionQueue.push({
            row: nr,
            col: nc,
            delayTimer: 0.04, // 40ms stagger
            chainDepth: chainDepth + 1,
          });
        } else {
          // Standard or Armored: Instant shatter from direct high-yield blast wave
          neighbor.isAlive = false;
          this.remainingBreakable = Math.max(0, this.remainingBreakable - 1);
          this.resolvePowerupDrop(neighbor);

          const points = neighbor.type === 'ARMORED' ? POINTS_ARMORED_DESTROY : neighbor.points;
          if (this.callbacks.onBrickHit) {
            this.callbacks.onBrickHit(neighbor, points, true);
          }
        }
      }
    }
  }

  /**
   * Evaluates and spawns power-up drops from destroyed bricks.
   */
  private resolvePowerupDrop(brick: Brick): void {
    let chosenPowerup: PowerupType | undefined = brick.powerupDrop;

    if (!chosenPowerup) {
      const dropRate = DROP_RATES[brick.type] ?? 0;
      if (Math.random() < dropRate) {
        chosenPowerup = this.rollRandomPowerup();
      }
    }

    if (chosenPowerup && this.callbacks.onPowerupSpawn) {
      const center = brick.getCenter();
      this.callbacks.onPowerupSpawn(chosenPowerup, center.x, center.y);
    }
  }

  /**
   * Weighted power-up random generator.
   */
  private rollRandomPowerup(): PowerupType {
    const powerups = Object.values(POWERUP_CONFIGS);
    const totalWeight = powerups.reduce((sum, p) => sum + p.weight, 0);
    let rand = Math.random() * totalWeight;

    for (const p of powerups) {
      if (rand < p.weight) {
        return p.type;
      }
      rand -= p.weight;
    }

    return 'MULTI_BALL';
  }

  /**
   * Fixed-timestep update loop for staggered cascading TNT explosions.
   */
  public update(dt: number): void {
    if (this.explosionQueue.length === 0) return;

    const remainingQueue: StaggeredExplosion[] = [];

    for (const item of this.explosionQueue) {
      item.delayTimer -= dt;
      if (item.delayTimer <= 0) {
        this.triggerExplosion(item.row, item.col, item.chainDepth);
      } else {
        remainingQueue.push(item);
      }
    }

    this.explosionQueue = remainingQueue;
  }

  /**
   * Renders all active bricks.
   */
  public render(ctx: CanvasRenderingContext2D, timeMs: number = 0): void {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const brick = this.grid[r][c];
        if (brick && brick.isAlive) {
          brick.render(ctx, timeMs);
        }
      }
    }
  }

  /**
   * Level clear check: returns true when all breakable bricks have been destroyed.
   */
  public isLevelClear(): boolean {
    return this.remainingBreakable === 0;
  }

  public getRemainingBreakables(): number {
    return this.remainingBreakable;
  }

  public getRemainingBreakableCount(): number {
    return this.remainingBreakable;
  }

  public getTotalBricksCount(): number {
    return this.totalBricks;
  }
}
