import { Assets, Texture } from 'pixi.js';
import { characterAtlas } from './CharacterAtlas.js';

const MONSTER_DIR = 'assets/sprites/monsters';

/** Preloads enemy sprites (and the character atlas) so battles can use art synchronously. */
export class BattleArt {
  private monsters = new Map<string, Texture>();
  private loading: Promise<void> | null = null;
  private done = false;

  get isLoaded(): boolean {
    return this.done;
  }

  getMonster(id: string): Texture | null {
    return this.monsters.get(id) ?? null;
  }

  load(): Promise<void> {
    if (this.done) return Promise.resolve();
    if (!this.loading) {
      this.loading = this.fetchAll().finally(() => { this.loading = null; });
    }
    return this.loading;
  }

  private async fetchAll(): Promise<void> {
    await characterAtlas.load();
    try {
      const response = await fetch(`${MONSTER_DIR}/index.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const ids = (await response.json()) as string[];
      await Promise.all(ids.map(async (id) => {
        const tex = await Assets.load<Texture>(`${MONSTER_DIR}/${id}.png`);
        tex.source.scaleMode = 'nearest';
        this.monsters.set(id, tex);
      }));
      this.done = true;
    } catch (err) {
      console.warn('Monster art unavailable; using placeholder enemy sprites', err);
    }
  }
}

export const battleArt = new BattleArt();
