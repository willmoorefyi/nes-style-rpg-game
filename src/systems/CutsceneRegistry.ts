import type { CutsceneScript, CutsceneStep } from './CutsceneManager.js';
import type { AssetLoader } from '../core/AssetLoader.js';

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
      if (!Array.isArray(data)) return;
      for (const entry of data) {
        if (entry.id && Array.isArray(entry.steps)) {
          this.scripts.set(entry.id, entry.steps);
        }
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
