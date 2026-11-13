import { Assets, Rectangle, Texture } from 'pixi.js';
import { characterAtlas, fetchJson } from './CharacterAtlas.js';
import type { MonsterPose } from '../scenes/battle/EnemyPoseController.js';

const MONSTER_ATLAS = 'assets/sprites/monsters-ai';

/** assets/sprites/monsters-ai.json (build stage monsters_ai). Rects are native px; the PNG is scaled by `scale`. */
export interface MonsterAtlasMeta {
  scale: number;
  sheets: Record<string, {
    cell: [number, number];
    footRow: number;
    floating: boolean;
    /** idle, attack and hurt always; bosses may add cast. */
    frames: Partial<Record<MonsterPose, [number, number]>> & Record<'idle' | 'attack' | 'hurt', [number, number]>;
  }>;
}

/** Everything the battle scene needs to draw and animate one monster. */
export interface MonsterFrames {
  idle: Texture;
  attack: Texture;
  /** Spell stance; the attack frame when the monster has none. */
  cast: Texture;
  hurt: Texture;
  /** Screen px per art px. */
  scale: number;
  /** Art cell size (art px) and last row of the feet inside it. */
  cell: [number, number];
  footRow: number;
  floating: boolean;
}

/** Art id for an enemy: its `sprite` (palette-swap variants share code but not art), without a file extension. */
export function monsterSpriteKey(data: { id: string; sprite?: string }): string {
  return (data.sprite || data.id).replace(/\.png$/i, '');
}

/** Preloads the monster atlas (and the character atlas) so battles can draw art synchronously. */
export class BattleArt {
  private meta: MonsterAtlasMeta | null = null;
  private tex: Texture | null = null;
  private loading: Promise<void> | null = null;
  private done = false;

  /** True once loading has been attempted (art may still be missing: battles then use placeholder boxes). */
  get isLoaded(): boolean {
    return this.done;
  }

  /** Pose frames for a monster sprite, or null when it has no approved art (placeholder box). */
  getMonsterFrames(sprite: string): MonsterFrames | null {
    const entry = this.meta?.sheets[sprite];
    if (!entry || !this.tex || !this.meta) return null;
    const s = this.meta.scale;
    const [w, h] = entry.cell;
    const slice = (pose: MonsterPose): Texture => {
      const [x, y] = entry.frames[pose] ?? entry.frames.attack;
      return new Texture({ source: this.tex!.source, frame: new Rectangle(x * s, y * s, w * s, h * s) });
    };
    return { idle: slice('idle'), attack: slice('attack'), cast: slice('cast'), hurt: slice('hurt'), scale: s,
      cell: [w, h], footRow: entry.footRow, floating: entry.floating };
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
      const meta = await fetchJson<MonsterAtlasMeta>(`${MONSTER_ATLAS}.json`);
      const tex = await Assets.load<Texture>(`${MONSTER_ATLAS}.png`);
      tex.source.scaleMode = 'nearest';
      this.meta = meta;
      this.tex = tex;
    } catch (err) {
      console.warn('Monster art unavailable; using placeholder enemy sprites', err);
    }
    this.done = true;
  }
}

export const battleArt = new BattleArt();
