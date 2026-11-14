import { CUTSCENE_STEP_TYPES, cutsceneWarp, type CutsceneScript, type CutsceneStep } from './CutsceneManager.js';
import type { AssetLoader } from '../core/AssetLoader.js';

/** A backdrop brightness multiplier in (0, 1] (U16). */
function validDim(dim: unknown): boolean {
  return typeof dim === 'number' && Number.isFinite(dim) && dim > 0 && dim <= 1;
}

/** Why a script can't be played (an unknown step type, a warp without a map and place, or a `dim` outside (0, 1]), or null (T2). */
export function scriptProblem(steps: readonly CutsceneStep[]): string | null {
  for (const [i, step] of steps.entries()) {
    if (!CUTSCENE_STEP_TYPES.includes(step?.type)) return `step ${i} has unknown type '${String(step?.type)}'`;
    if (step.type === 'warp' && !cutsceneWarp(step)) return `step ${i} is a warp without map and an entrance or x and y`;
    if (step.dim !== undefined && !validDim(step.dim)) return `step ${i} has dim ${String(step.dim)}, not a number in (0, 1]`;
  }
  return null;
}

interface CutsceneEntry {
  id: string;
  steps: CutsceneStep[];
}

/** Registry for cutscene scripts loaded from YAML data */
export class CutsceneRegistry {
  private static scripts = new Map<string, CutsceneScript>();

  static async init(assets: AssetLoader): Promise<void> {
    try {
      const data = await assets.loadYaml<CutsceneEntry[]>('assets/data/cutscenes.yaml');
      if (!Array.isArray(data)) {
        console.error('cutscenes.yaml is not a list of cutscenes');
        return;
      }
      for (const entry of data) {
        if (!entry.id || !Array.isArray(entry.steps)) {
          console.error('cutscenes.yaml: an entry without an id or steps was dropped:', entry);
          continue;
        }
        const problem = scriptProblem(entry.steps);
        if (problem) {
          console.error(`cutscenes.yaml: cutscene ${entry.id} dropped: ${problem}`);
          continue;
        }
        this.scripts.set(entry.id, entry.steps);
      }
    } catch (e) {
      console.warn('Failed to load cutscenes.yaml:', e);
    }
  }

  static get(id: string): CutsceneScript | undefined {
    return this.scripts.get(id);
  }

  /** For testing: register a script directly */
  static register(id: string, script: CutsceneScript): void {
    this.scripts.set(id, script);
  }

  static clear(): void {
    this.scripts.clear();
  }
}
