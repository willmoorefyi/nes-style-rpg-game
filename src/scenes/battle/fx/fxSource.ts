/**
 * What the effects read: the effect table (spell-effects.yaml), the enemies' attack fields (enemies.yaml, for ranged
 * attacks) and the glyph atlas. The battle scene's factory (fx/index.ts) starts the load once in a browser; tests build
 * a source from the files on disk.
 */
import { AssetLoader } from '../../../core/AssetLoader.js';
import { DataLoader } from '../../../core/DataLoader.js';
import type { EnemyData } from '../../../types/index.js';
import { FxAtlas } from './fxAtlas.js';
import { toFxData, type FxData } from './fxDefs.js';

export const SPELL_EFFECTS_PATH = 'assets/data/spell-effects.yaml';
const ENEMIES_PATH = 'assets/data/enemies.yaml';

export type EnemyAttack = Pick<EnemyData, 'attack' | 'attackEffect'>;

export class FxSource {
  data: FxData | null = null;
  readonly atlas = new FxAtlas();
  private readonly attacks = new Map<string, EnemyAttack>();
  private loading: Promise<void> | null = null;
  private done = false;

  /** Use loaded data (tests, or after `load`). */
  setData(data: FxData | null, enemies: readonly EnemyData[] = []): void {
    this.data = data;
    this.attacks.clear();
    for (const e of enemies) this.attacks.set(e.name, { attack: e.attack, attackEffect: e.attackEffect });
  }

  /** An enemy's attack fields by its battle display name (`Goblin B` is a Goblin). */
  attackOf(displayName: string): EnemyAttack | undefined {
    return this.attacks.get(displayName) ?? this.attacks.get(displayName.replace(/ [A-Z]$/, ''));
  }

  get isLoaded(): boolean { return this.done; }

  load(): Promise<void> {
    if (this.done) return Promise.resolve();
    this.loading ??= this.fetchAll().finally(() => { this.loading = null; this.done = true; });
    return this.loading;
  }

  private async fetchAll(): Promise<void> {
    const loader = new DataLoader(new AssetLoader());
    const [effects, enemies] = await Promise.all([
      loader.loadSpellEffects(SPELL_EFFECTS_PATH).catch((err: unknown) => {
        console.error('Battle effects: spell-effects.yaml failed to load; no effects', err);
        return null;
      }),
      loader.loadEnemies(ENEMIES_PATH).catch((err: unknown) => {
        console.error('Battle effects: enemies.yaml failed to load; no ranged attack effects', err);
        return [] as EnemyData[];
      }),
      this.atlas.load(),
    ]);
    this.setData(effects ? toFxData(effects, SPELL_EFFECTS_PATH) : null, enemies);
  }
}

/** The shared source (loaded once per session). */
export const fxSource = new FxSource();
