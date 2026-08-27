/**
 * @file game/systems/LevelManager.ts
 * Level lifecycle manager responsible for loading levels, tracking current level progression,
 * advancing through levels 1..6, handling victory criteria, and resetting states.
 */

import { ILevelLayout } from '../types';
import { TOTAL_LEVELS } from '../constants';
import { getLevelLayout } from '../levels';
import { BrickGridManager } from './BrickGridManager';

export interface AdvanceLevelResult {
  nextLevel: number;
  levelNumber: number;
  hasWon: boolean;
  isVictory: boolean;
  layout: ILevelLayout | null;
}

export class LevelManager {
  private currentLevelNumber: number = 1;
  private currentLayout: ILevelLayout;
  public gridManager: BrickGridManager;

  constructor(gridManager?: BrickGridManager) {
    this.gridManager = gridManager || new BrickGridManager();
    this.currentLayout = getLevelLayout(this.currentLevelNumber);
    this.gridManager.loadLevel(this.currentLayout);
  }

  /**
   * Loads a specific level by 1-indexed level number (1..6).
   */
  public loadLevel(levelNumber: number): ILevelLayout {
    this.currentLevelNumber = Math.max(1, Math.min(TOTAL_LEVELS, levelNumber));
    this.currentLayout = getLevelLayout(this.currentLevelNumber);
    this.gridManager.loadLevel(this.currentLayout);
    return this.currentLayout;
  }

  /**
   * Returns the current active level number (1-indexed: 1..6).
   */
  public getCurrentLevelNumber(): number {
    return this.currentLevelNumber;
  }

  /**
   * Returns the current level layout configuration.
   */
  public getCurrentLayout(): ILevelLayout {
    return this.currentLayout;
  }

  /**
   * Advances to the next level.
   * If current level is the final level (Level 6), returns { hasWon: true, isVictory: true }.
   */
  public advanceLevel(): AdvanceLevelResult {
    if (this.currentLevelNumber >= TOTAL_LEVELS) {
      return {
        nextLevel: this.currentLevelNumber,
        levelNumber: this.currentLevelNumber,
        hasWon: true,
        isVictory: true,
        layout: null,
      };
    }

    this.currentLevelNumber += 1;
    this.currentLayout = getLevelLayout(this.currentLevelNumber);
    this.gridManager.loadLevel(this.currentLayout);

    return {
      nextLevel: this.currentLevelNumber,
      levelNumber: this.currentLevelNumber,
      hasWon: false,
      isVictory: false,
      layout: this.currentLayout,
    };
  }

  /**
   * Restarts the current level from initial layout.
   */
  public restartLevel(): ILevelLayout {
    return this.loadLevel(this.currentLevelNumber);
  }

  /**
   * Alias for restartLevel().
   */
  public restartCurrentLevel(): ILevelLayout {
    return this.restartLevel();
  }

  /**
   * Resets progression back to Level 1.
   */
  public resetToFirstLevel(): ILevelLayout {
    return this.loadLevel(1);
  }

  /**
   * Returns total number of progressive levels (6).
   */
  public getTotalLevels(): number {
    return TOTAL_LEVELS;
  }

  /**
   * Returns true if the active level is the final stage.
   */
  public isLastLevel(): boolean {
    return this.currentLevelNumber === TOTAL_LEVELS;
  }

  /**
   * Alias for isLastLevel().
   */
  public isFinalLevel(): boolean {
    return this.isLastLevel();
  }
}
