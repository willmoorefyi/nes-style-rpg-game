import { Assets, Rectangle, Texture } from 'pixi.js';
import type { AnimationConfig } from './SpriteAnimation.js';
import type { NPCFrames } from '../entities/NPC.js';

const META_PATH = 'assets/sprites/characters.json';
const FIELD_PATH = 'assets/sprites/characters.png';
const AI_BATTLE_META_PATH = 'assets/sprites/battle-characters-ai.json';
const AI_BATTLE_PATH = 'assets/sprites/battle-characters-ai.png';
const AI_FIELD_META_PATH = 'assets/sprites/characters-ai.json';
const AI_FIELD_PATH = 'assets/sprites/characters-ai.png';

/** Layout of assets/sprites/characters.json, produced by assets-src/build_assets.py. */
export interface CharacterAtlasMeta {
  cell: [number, number];
  cols: number;
  rows: number;
  fieldScale: number;
  rowNames: string[];
  sheets: Record<string, { x: number; y: number }>;
  /** Walk columns played while moving, e.g. [1, 0, 2, 0] (legacy, the default) or [1..6] (2x art). */
  walkSequence?: number[];
  /** Walk frames shown per tile moved (2 for the 3-column legacy sheets, 3 for the 7-column 2x sheets). */
  walkPhases?: number;
}

/** Layout of assets/sprites/battle-characters-ai.json (build stage battle_ai; docs/ART_2X_PLAN.md): one row per
 *  class, one column per pose, and the native row the feet stand on. */
export interface BattleAtlasMeta {
  cell: [number, number];
  scale: number;
  poses: string[];
  footRow: number;
  sheets: Record<string, { row: number }>;
}

/** Battle frames for one character plus how to place them. */
export interface BattleFrames {
  frames: Texture[];
  scale: number;
  cell: [number, number];
  footRow: number;
}

import { isPreviewAi } from '../core/artPreview.js';
import { TILE_SIZE } from '../core/LayoutConstants.js';
export { isPreviewAi };

/** Fetch JSON, rejecting HTTP errors and non-JSON bodies (e.g. a dev server's HTML fallback for a missing file). */
export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${path} is not JSON (starts with ${JSON.stringify(text.slice(0, 20))})`);
  }
}

/** What PlayerController needs to animate a character from the shared atlas. */
export interface FieldArt {
  texture: Texture;
  animation: Pick<AnimationConfig, 'frameWidth' | 'frameHeight' | 'frameCount' | 'originX' | 'originY' | 'walkSequence'
    | 'walkPhases'>;
  /** Extra sprite scale so a frame is one tile wide on screen (2 for legacy art in the 96 px preview tiles). */
  displayScale: number;
  ai: boolean;
}

/** Keyframe poses, then the in-betweens (assets-src/gen/puppet.py) that smooth idle, melee and casting, then the pass K
 *  kneel columns (docs/KNEEL_PLAN.md 3: an unopted class repeats `ready` there). */
export const BATTLE_POSES = ['ready', 'attack', 'cast', 'hurt', 'down', 'victory',
  'idle_b', 'atk_wind1', 'atk_wind2', 'atk_mid', 'atk_follow', 'cast_gather', 'cast_rise', 'cast_release',
  'kneel_in1', 'kneel_in2', 'kneel', 'kneel_b'] as const;
export type BattlePose = typeof BATTLE_POSES[number];

/** The keyframe an in-between falls back to when an atlas does not carry it (older builds; no kneel columns: `ready`). */
export const POSE_FALLBACK: Partial<Record<BattlePose, BattlePose>> = {
  idle_b: 'ready', atk_wind1: 'ready', atk_wind2: 'ready', atk_mid: 'attack', atk_follow: 'attack',
  cast_gather: 'ready', cast_rise: 'cast', cast_release: 'cast',
  kneel_in1: 'ready', kneel_in2: 'ready', kneel: 'ready', kneel_b: 'ready',
};

const LEGACY_WALK = [1, 0, 2, 0];

/** Two-tile (head over feet) character sheets: field walk frames and battle poses; scale and cell size come from the atlas JSON. */
export class CharacterAtlas {
  private meta: CharacterAtlasMeta | null = null;
  private field: Texture | null = null;
  private aiBattleMeta: BattleAtlasMeta | null = null;
  private aiBattle: Texture | null = null;
  private aiFieldMeta: CharacterAtlasMeta | null = null;
  private aiField: Texture | null = null;
  private aiAttempted = false;

  private loading: Promise<void> | null = null;

  get isLoaded(): boolean {
    return !!this.meta && !!this.field;
  }

  get hasBattleArt(): boolean {
    return !!this.aiBattleMeta && !!this.aiBattle;
  }

  /** Safe to call repeatedly; the atlas is fetched once. A failed load can be retried.
   *  Resolves only after the field atlas and the 2x (AI) atlas attempts have finished. */
  load(): Promise<void> {
    if (this.isLoaded && this.aiAttempted) return Promise.resolve();
    if (!this.loading) {
      this.loading = (async () => {
        if (!this.isLoaded) await this.fetchAtlas();
        if (!this.aiAttempted) await this.fetchAiAtlas();
      })().finally(() => { this.loading = null; });
    }
    return this.loading;
  }

  get hasAiFieldArt(): boolean {
    return !!this.aiFieldMeta && !!this.aiField;
  }

  /** 2x art: the field atlas (preview only) and the battle atlas. A failure leaves that atlas null (placeholders). */
  private async fetchAiAtlas(): Promise<void> {
    this.aiAttempted = true;
    try {
      const meta = await fetchJson<CharacterAtlasMeta>(AI_FIELD_META_PATH);
      const tex = await Assets.load<Texture>(AI_FIELD_PATH);
      tex.source.scaleMode = 'nearest';
      this.aiFieldMeta = meta;
      this.aiField = tex;
    } catch (err) {
      this.aiFieldMeta = null;
      this.aiField = null;
      console.warn('AI field art unavailable; legacy art only', err);
    }
    try {
      const meta = await fetchJson<BattleAtlasMeta>(AI_BATTLE_META_PATH);
      const tex = await Assets.load<Texture>(AI_BATTLE_PATH);
      tex.source.scaleMode = 'nearest';
      this.aiBattleMeta = meta;
      this.aiBattle = tex;
    } catch (err) {
      this.aiBattleMeta = null;
      this.aiBattle = null;
      console.warn('Battle character art unavailable; using placeholder sprites', err);
    }
  }

  private async fetchAtlas(): Promise<void> {
    try {
      this.meta = await fetchJson<CharacterAtlasMeta>(META_PATH);
      this.field = await Assets.load<Texture>(FIELD_PATH);
      this.field.source.scaleMode = 'nearest';
    } catch (err) {
      this.meta = this.field = null;
      console.warn('Character art unavailable; using placeholder sprites', err);
    }
  }

  has(id: string): boolean {
    return !!this.meta && !!this.field && id in this.meta.sheets;
  }

  /** Pick the field atlas for an id: AI art when previewing and available, else legacy. */
  private fieldSource(id: string, preferAi: boolean): { meta: CharacterAtlasMeta; tex: Texture; ai: boolean } | null {
    if (preferAi && this.aiFieldMeta && this.aiField && this.aiFieldMeta.sheets[id]) {
      return { meta: this.aiFieldMeta, tex: this.aiField, ai: true };
    }
    if (!this.meta || !this.field || !this.meta.sheets[id]) return null;
    return { meta: this.meta, tex: this.field, ai: false };
  }

  /** Field (overworld/town) animation source for a class or NPC sprite id. */
  getFieldArt(id: string, preferAi: boolean = isPreviewAi()): FieldArt | null {
    const src = this.fieldSource(id, preferAi);
    if (!src) return null;
    const { cell, fieldScale } = src.meta;
    const origin = src.meta.sheets[id];
    return {
      texture: src.tex,
      animation: {
        frameWidth: cell[0] * fieldScale,
        frameHeight: cell[1] * fieldScale,
        frameCount: src.meta.cols,
        originX: origin.x * fieldScale,
        originY: origin.y * fieldScale,
        walkSequence: src.meta.walkSequence ?? LEGACY_WALK,
        walkPhases: src.meta.walkPhases ?? 2,
      },
      displayScale: TILE_SIZE / (cell[0] * fieldScale),
      ai: src.ai,
    };
  }

  /** Frames for a static-or-wandering NPC: frames[direction][column]. */
  getNpcFrames(id: string, preferAi: boolean = isPreviewAi()): NPCFrames | null {
    const src = this.fieldSource(id, preferAi);
    if (!src) return null;
    const { cell, fieldScale } = src.meta;
    const o = src.meta.sheets[id];
    const fw = cell[0] * fieldScale;
    const fh = cell[1] * fieldScale;
    const frames: Texture[][] = [];
    for (let row = 0; row < 4; row++) {
      const cols: Texture[] = [];
      for (let col = 0; col < src.meta.cols; col++) {
        cols.push(new Texture({
          source: src.tex.source,
          frame: new Rectangle(o.x * fieldScale + col * fw, o.y * fieldScale + row * fh, fw, fh),
        }));
      }
      frames.push(cols);
    }
    const scale = TILE_SIZE / fw;
    return { frames, frameHeight: fh * scale, scale, walkSequence: src.meta.walkSequence ?? LEGACY_WALK,
      walkPhases: src.meta.walkPhases ?? 2 };
  }

  /** Battle poses (left-facing) in BATTLE_POSES order, or null when this class has no battle art (placeholder). */
  getBattleFrames(id: string): BattleFrames | null {
    const meta = this.aiBattleMeta;
    if (!meta || !this.aiBattle || !meta.sheets[id]) return null;
    return { frames: sliceRow(meta, this.aiBattle, meta.sheets[id].row), scale: meta.scale, cell: meta.cell,
      footRow: meta.footRow };
  }
}

function sliceRow(meta: BattleAtlasMeta, tex: Texture, row: number): Texture[] {
  const fw = meta.cell[0] * meta.scale;
  const fh = meta.cell[1] * meta.scale;
  return BATTLE_POSES.map((pose) => {
    let col = meta.poses.indexOf(pose);
    if (col < 0) col = meta.poses.indexOf(POSE_FALLBACK[pose] ?? 'ready');
    return new Texture({ source: tex.source, frame: new Rectangle(Math.max(0, col) * fw, row * fh, fw, fh) });
  });
}

/** Shared by exploration and battle so art is loaded once. */
export const characterAtlas = new CharacterAtlas();
