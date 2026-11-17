/**
 * The battle's transformation interludes (assets/data/battle-interludes.yaml, docs/CHAOS_FORMS_PLAN.md 2.3), like
 * CutsceneRegistry: a script with an unknown step type or a bad value is dropped with console.error and the rest load.
 * The battle reads the shared registry, which loads the file once in a browser (the first form change waits for it;
 * a missing script swaps the form at once).
 *
 *   interludes:
 *     - id: chaos_i1
 *       steps:
 *         - { type: message, text: "The Sovereign's robe flares and burns away!" }
 *         - { type: flash, color: "#ffffff", frames: 6, alpha: 1 }
 */
import { AssetLoader } from '../core/AssetLoader.js';
import { interludeProblems, type InterludeStep } from '../scenes/battle/formInterlude.js';

export const INTERLUDES_PATH = 'assets/data/battle-interludes.yaml';

export interface InterludeSource {
  get(id: string): InterludeStep[] | null;
}

export class InterludeRegistry implements InterludeSource {
  private readonly scripts = new Map<string, InterludeStep[]>();
  private loading: Promise<void> | null = null;

  /** A registry of the scripts in a parsed battle-interludes.yaml (invalid ones dropped and logged). */
  static from(raw: unknown): InterludeRegistry {
    const r = new InterludeRegistry();
    r.add(raw);
    return r;
  }

  private add(raw: unknown): void {
    const list = (raw as { interludes?: unknown } | null)?.interludes;
    if (!Array.isArray(list)) {
      console.error(`${INTERLUDES_PATH}: no \`interludes\` list; no interludes`);
      return;
    }
    for (const entry of list as { id?: unknown; steps?: unknown }[]) {
      const id = typeof entry?.id === 'string' ? entry.id : '';
      const steps = Array.isArray(entry?.steps) ? (entry.steps as InterludeStep[]) : null;
      const problems = !id ? ['an interlude without an id'] : !steps ? [`interlude ${id}: no steps list`] : interludeProblems(id, steps);
      if (problems.length > 0) { console.error(`${INTERLUDES_PATH}: dropped. ${problems.join('; ')}`); continue; }
      this.scripts.set(id, steps!);
    }
  }

  get(id: string): InterludeStep[] | null { return this.scripts.get(id) ?? null; }

  get ids(): string[] { return [...this.scripts.keys()]; }

  /** Load the shared file once (browser); never rejects. */
  load(loader: Pick<AssetLoader, 'loadYaml'> = new AssetLoader()): Promise<void> {
    this.loading ??= loader.loadYaml<unknown>(INTERLUDES_PATH).then((raw) => this.add(raw)).catch((err: unknown) => {
      console.error(`${INTERLUDES_PATH} failed to load; form changes swap without an interlude`, err);
    });
    return this.loading;
  }
}

/** The shared registry (BattleScene's form change view reads it). */
export const interludes = new InterludeRegistry();
