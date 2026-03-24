import type { GameFlags } from '../core/GameFlags.js';
import type { Character } from '../entities/Character.js';

/** A single step in a cutscene script */
export interface CutsceneStep {
  type: 'dialog' | 'fade_out' | 'fade_in' | 'wait' | 'set_flag' | 'heal_party';
  text?: string;       // for dialog
  duration?: number;   // for fade/wait (ms)
  flag?: string;       // for set_flag
}

export type CutsceneScript = CutsceneStep[];

/** Dependencies injected into CutsceneManager to avoid PixiJS coupling */
export interface CutsceneDeps {
  showDialog: (text: string) => Promise<void>;
  fadeOut?: (durationMs: number) => Promise<void>;
  fadeIn?: (durationMs: number) => Promise<void>;
  flags: GameFlags;
  party: Character[];
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
