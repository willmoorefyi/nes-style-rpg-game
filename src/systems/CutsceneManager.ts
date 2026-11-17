import type { GameFlags } from '../core/GameFlags.js';
import type { Character } from '../entities/Character.js';
import type { VehicleType } from '../types/index.js';

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
  type: 'dialog' | 'fade_out' | 'fade_in' | 'wait' | 'set_flag' | 'heal_party' | 'warp' | 'backdrop'
    | QuestStepType;
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
  /** For backdrop: a brightness multiplier in (0, 1]; missing means 1 (U16). */
  dim?: number;
  /** For give_item / take_item (QUEST 4.1). */
  item?: string;
  /** For set_vehicle: the vehicle placed at `map`, `x`, `y`. */
  vehicle?: VehicleType;
}

/** Pass W steps (QUEST 4.1; declared by W1-0a, played from W1-A / W1-B on): give_item {item}, take_item {item},
 *  set_vehicle {vehicle, map, x, y}, end_game {text?} (GAP-13). */
export type QuestStepType = 'give_item' | 'take_item' | 'set_vehicle' | 'end_game';
const QUEST_STEP_TYPES: readonly QuestStepType[] = ['give_item', 'take_item', 'set_vehicle', 'end_game'];

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
  /** Move the party to another map (T2); a host without it logs and the cutscene goes on. */
  warp?: (warp: CutsceneWarp) => Promise<void>;
  /** Called after heal_party (the field emits partyHealed for its sound). */
  onHeal?: () => void;
  /**
   * Show a staged background, or clear it with null (N2); a host without it logs once and skips.
   * `opts.dim` is the step's brightness multiplier in (0, 1] (U16; undefined means 1).
   */
  backdrop?: (image: string | null, opts?: { dim?: number }) => void | Promise<void>;
}

/** The step types CutsceneManager plays. */
export const CUTSCENE_STEP_TYPES: readonly CutsceneStep['type'][] =
  ['dialog', 'fade_out', 'fade_in', 'wait', 'set_flag', 'heal_party', 'warp', 'backdrop', ...QUEST_STEP_TYPES];

/**
 * Lightweight cutscene system: executes a sequence of steps.
 * Dialog uses existing DialogManager pattern via injected showDialog.
 * Fade uses injected callbacks (rendering layer provides implementation).
 */
export class CutsceneManager {
  private deps: CutsceneDeps;
  private backdropWarned = false;

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
        this.deps.onHeal?.();
        break;

      case 'warp':
        await this.warp(step);
        break;

      case 'backdrop':
        if (this.deps.backdrop) {
          await this.deps.backdrop(step.image ?? null, { dim: step.dim });
        } else if (!this.backdropWarned) {
          this.backdropWarned = true;
          console.error('Cutscene backdrop step skipped: this host shows no backdrops');
        }
        break;

      case 'give_item': case 'take_item': case 'set_vehicle': case 'end_game':
        console.error(`Cutscene step ${step.type} is declared but not played yet (W1-A / W1-B)`);
        break;

      default:
        console.error(`Unknown cutscene step: ${String((step as { type?: unknown }).type)}`);
    }
  }

  private async warp(step: CutsceneStep): Promise<void> {
    const warp = cutsceneWarp(step);
    if (!warp) {
      console.error('Cutscene warp step needs map and an entrance or x and y:', step);
      return;
    }
    if (!this.deps.warp) {
      console.error(`Cutscene warp to ${warp.map} skipped: this host cannot change maps`);
      return;
    }
    await this.deps.warp(warp);
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
