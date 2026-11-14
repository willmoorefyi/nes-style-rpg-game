import type { GameFlags } from '../core/GameFlags.js';
import type { Character } from '../entities/Character.js';

/** Where a `warp` step sends the party: `map` and either a named `entrance` or both `x` and `y` (T2). */
export interface CutsceneWarp {
  map: string;
  entrance?: string;
  x?: number;
  y?: number;
  facing?: 'up' | 'down' | 'left' | 'right';
}

/** A single step in a cutscene script */
export interface CutsceneStep {
  type: 'dialog' | 'fade_out' | 'fade_in' | 'wait' | 'set_flag' | 'heal_party' | 'warp' | 'backdrop';
  text?: string;       // for dialog
  duration?: number;   // for fade/wait (ms)
  flag?: string;       // for set_flag
  /** For warp (see CutsceneWarp). */
  map?: string;
  entrance?: string;
  x?: number;
  y?: number;
  facing?: CutsceneWarp['facing'];
  /** For backdrop: a staged background id (assets/backgrounds/<id>.webp), or null to clear it (N2). */
  image?: string | null;
}

export type CutsceneScript = CutsceneStep[];

/** The warp a `warp` step describes, or null when it lacks `map` or both an `entrance` and an `x`/`y` pair. */
export function cutsceneWarp(step: CutsceneStep): CutsceneWarp | null {
  if (step.type !== 'warp' || typeof step.map !== 'string' || !step.map) return null;
  const hasEntrance = typeof step.entrance === 'string' && step.entrance.length > 0;
  const hasCell = typeof step.x === 'number' && typeof step.y === 'number';
  if (!hasEntrance && !hasCell) return null;
  const warp: CutsceneWarp = { map: step.map };
  if (hasEntrance) warp.entrance = step.entrance;
  if (hasCell) { warp.x = step.x; warp.y = step.y; }
  if (step.facing) warp.facing = step.facing;
  return warp;
}

/** Dependencies injected into CutsceneManager to avoid PixiJS coupling */
export interface CutsceneDeps {
  showDialog: (text: string) => Promise<void>;
  fadeOut?: (durationMs: number) => Promise<void>;
  fadeIn?: (durationMs: number) => Promise<void>;
  flags: GameFlags;
  party: Character[];
  /** Called after each set_flag step (the field drops NPCs the new flag removes, e.g. while the screen is black). */
  onFlagSet?: (flag: string) => void;
}

/**
 * Lightweight cutscene system: executes a sequence of steps.
 * Dialog uses existing DialogManager pattern via injected showDialog.
 * Fade uses injected callbacks (rendering layer provides implementation).
 */
export class CutsceneManager {
  private deps: CutsceneDeps;

  constructor(deps: CutsceneDeps) {
    this.deps = deps;
  }

  /** Execute a cutscene script sequentially */
  async play(script: CutsceneScript): Promise<void> {
    for (const step of script) {
      await this.executeStep(step);
    }
  }

  private async executeStep(step: CutsceneStep): Promise<void> {
    switch (step.type) {
      case 'dialog':
        if (step.text) {
          await this.deps.showDialog(step.text);
        }
        break;

      case 'fade_out':
        if (this.deps.fadeOut) {
          await this.deps.fadeOut(step.duration ?? 500);
        }
        break;

      case 'fade_in':
        if (this.deps.fadeIn) {
          await this.deps.fadeIn(step.duration ?? 500);
        }
        break;

      case 'wait':
        await this.wait(step.duration ?? 1000);
        break;

      case 'set_flag':
        if (step.flag) {
          this.deps.flags.set(step.flag);
          this.deps.onFlagSet?.(step.flag);
        }
        break;

      case 'heal_party':
        for (const char of this.deps.party) {
          char.currentHp = char.maxHp;
          char.restoreAllCharges();
        }
        break;
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
