import { Assets, Rectangle, Texture } from 'pixi.js';
import { characterAtlas, fetchJson } from './CharacterAtlas.js';
import { BOSS_FRAMES, FRAME_SOURCE, lungePx, type MonsterFrame, type MonsterKeyframe } from '../scenes/battle/enemyChoreography.js';

const MONSTER_ATLAS = 'assets/sprites/monsters-ai';

/** assets/sprites/monsters-ai.json (build stage monsters_ai, docs/ENEMY_ANIM_PLAN.md 6.1). Rects are art px; the PNG
 *  holds `texScale` PNG px per art px (1 = native atlas; an old pre-scaled atlas has none, i.e. `scale`). */
export interface MonsterAtlasMeta {
  /** Screen px per art px. */
  scale: number;
  texScale?: number;
  sheets: Record<string, {
    cell: [number, number];
    footRow: number;
    floating: boolean;
    /** idle, attack and hurt always; bosses add cast; generated in-betweens (aliased when not animated). */
    frames: Partial<Record<MonsterFrame, [number, number]>> & Record<'idle' | 'attack' | 'hurt', [number, number]>;
    anim?: boolean;
    holds?: string[];
    lungePx?: number;
  }>;
}

/** Everything the battle scene needs to draw and animate one monster. */
export interface MonsterFrames {
  /** One texture per frame name; a missing frame shows its source keyframe (a boss-less cast shows attack). */
  textures: Record<MonsterFrame, Texture>;
  idle: Texture;
  attack: Texture;
  /** Spell stance; the attack frame when the monster has none. */
  cast: Texture;
  hurt: Texture;
  /** Screen px per art px. */
  scale: number;
  /** Screen px per PNG px (the sprite's scale before the layout factor). */
  artScale: number;
  /** Art cell size (art px) and last row of the feet inside it. */
  cell: [number, number];
  footRow: number;
  floating: boolean;
  /** The approved sheet has its own cast keyframe (boss). */
  hasCast: boolean;
  lungePx: number;
  anim: boolean;
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
    const source = this.tex.source;
    const s = this.meta.scale;
    const ts = this.meta.texScale ?? s;
    const [w, h] = entry.cell;
    const cache = new Map<string, Texture>();
    const slice = (name: MonsterFrame): Texture => {
      const [x, y] = entry.frames[name] ?? entry.frames[FRAME_SOURCE[name]] ?? entry.frames.attack;
      const key = `${x},${y}`;
      let t = cache.get(key);
      if (!t) {
        t = new Texture({ source, frame: new Rectangle(x * ts, y * ts, w * ts, h * ts) });
        cache.set(key, t);
      }
      return t;
    };
    const textures = Object.fromEntries(BOSS_FRAMES.map((n) => [n, slice(n)])) as Record<MonsterFrame, Texture>;
    const key = (k: MonsterKeyframe): Texture => textures[k];
    return { textures, idle: key('idle'), attack: key('attack'), cast: key('cast'), hurt: key('hurt'), scale: s,
      artScale: s / ts, cell: [w, h], footRow: entry.footRow, floating: entry.floating, hasCast: !!entry.frames.cast,
      lungePx: lungePx(entry), anim: !!entry.anim };
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
