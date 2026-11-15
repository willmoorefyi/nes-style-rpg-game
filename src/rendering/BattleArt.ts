import { Assets, Rectangle, Texture } from 'pixi.js';
import { characterAtlas, fetchJson } from './CharacterAtlas.js';
import { BOSS_FRAMES, lungePx, resolveFrame, type MonsterFrame, type MonsterKeyframe } from '../scenes/battle/enemyChoreography.js';

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
  /** The approved sheet has its own `attack_raise` keyframe (the heavy attack's raised hold; else it coils in
   *  `atk_wind2`). Always set by `getMonsterFrames`; optional so hand-built frames (tests) may leave it out (= false). */
  hasRaise?: boolean;
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
  /** Sprites already reported missing from a loaded atlas (one warning each). */
  private readonly warned = new Set<string>();

  /** True once loading has been attempted (art may still be missing: battles then use placeholder boxes). */
  get isLoaded(): boolean {
    return this.done;
  }

  /** Pose frames for a monster sprite, or null when it has no approved art (placeholder box). */
  getMonsterFrames(sprite: string): MonsterFrames | null {
    const entry = this.meta?.sheets[sprite];
    // E16: the atlas is loaded but lacks this sheet: say so once (before the load this is the late-load path, A15)
    if (this.meta && !entry && !this.warned.has(sprite)) {
      this.warned.add(sprite);
      console.warn(`Monster art: no sheet for "${sprite}" in ${MONSTER_ATLAS}.json; using a placeholder box`);
    }
    if (!entry || !this.tex || !this.meta) return null;
    const source = this.tex.source;
    const s = this.meta.scale;
    const ts = this.meta.texScale ?? s;
    const [w, h] = entry.cell;
    const cache = new Map<string, Texture>();
    const slice = (name: MonsterFrame): Texture => {
      // the FRAME_FALLBACK chain (e.g. daze → hurt_in1 → idle), then attack
      const found = resolveFrame(name, (f) => !!entry.frames[f]);
      const [x, y] = (found && entry.frames[found]) || entry.frames.attack;
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
      hasRaise: !!entry.frames.attack_raise, lungePx: lungePx(entry), anim: !!entry.anim };
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
