import { Assets, Rectangle, Texture } from 'pixi.js';
import { characterAtlas, fetchJson } from './CharacterAtlas.js';
import { useAiBattleArt } from '../core/artPreview.js';
import type { MonsterPose } from '../scenes/battle/EnemyPoseController.js';

const MONSTER_DIR = 'assets/sprites/monsters';
const MONSTER_AI = 'assets/sprites/monsters-ai';

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
  ai: boolean;
}

/** Art id for an enemy: its `sprite` (palette-swap variants share code but not art), without a file extension. */
export function monsterSpriteKey(data: { id: string; sprite?: string }): string {
  return (data.sprite || data.id).replace(/\.png$/i, '');
}

/** Preloads enemy sprites (and the character atlas) so battles can use art synchronously. */
export class BattleArt {
  private monsters = new Map<string, Texture>();
  private aiMeta: MonsterAtlasMeta | null = null;
  private aiTex: Texture | null = null;
  private loading: Promise<void> | null = null;
  private done = false;

  get isLoaded(): boolean {
    return this.done;
  }

  getMonster(id: string): Texture | null {
    return this.monsters.get(id) ?? null;
  }

  /**
   * Pose frames for a monster. 2x AI art (default; off with ?art=legacy) when approved, otherwise the legacy still used for
   * every pose at its own size (already x3), so callers have one code path. Null when no art is loaded.
   */
  getMonsterFrames(sprite: string, preferAi: boolean = useAiBattleArt()): MonsterFrames | null {
    const entry = preferAi ? this.aiMeta?.sheets[sprite] : undefined;
    if (entry && this.aiTex && this.aiMeta) {
      const s = this.aiMeta.scale;
      const [w, h] = entry.cell;
      const slice = (pose: MonsterPose): Texture => {
        const [x, y] = entry.frames[pose] ?? entry.frames.attack;
        return new Texture({ source: this.aiTex!.source, frame: new Rectangle(x * s, y * s, w * s, h * s) });
      };
      return { idle: slice('idle'), attack: slice('attack'), cast: slice('cast'), hurt: slice('hurt'), scale: s, cell: [w, h],
        footRow: entry.footRow, floating: entry.floating, ai: true };
    }
    const tex = this.monsters.get(sprite);
    if (!tex) return null;
    return { idle: tex, attack: tex, cast: tex, hurt: tex, scale: 1, cell: [tex.width, tex.height], footRow: tex.height - 1,
      floating: false, ai: false };
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
    // Preview art is isolated: a missing or broken AI atlas only means legacy art is used.
    const ai = useAiBattleArt() ? this.fetchAi() : Promise.resolve();
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
    await ai;
  }

  private async fetchAi(): Promise<void> {
    try {
      const meta = await fetchJson<MonsterAtlasMeta>(`${MONSTER_AI}.json`);
      const tex = await Assets.load<Texture>(`${MONSTER_AI}.png`);
      tex.source.scaleMode = 'nearest';
      this.aiMeta = meta;
      this.aiTex = tex;
    } catch (err) {
      console.warn('AI monster art unavailable; using legacy monster art', err);
    }
  }
}

export const battleArt = new BattleArt();
