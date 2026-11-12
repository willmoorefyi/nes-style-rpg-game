import { Assets, Rectangle, Texture } from 'pixi.js';
import type { AnimationConfig } from './SpriteAnimation.js';
import type { NPCFrames } from '../entities/NPC.js';

const META_PATH = 'assets/sprites/characters.json';
const FIELD_PATH = 'assets/sprites/characters.png';
const BATTLE_META_PATH = 'assets/sprites/battle-characters.json';
const BATTLE_PATH = 'assets/sprites/battle-characters.png';
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
}

/** Layout of assets/sprites/battle-characters.json: one row per class, one column per pose. */
export interface BattleAtlasMeta {
  cell: [number, number];
  scale: number;
  poses: string[];
  sheets: Record<string, { row: number }>;
}

/** AI-generated battle atlas (docs/ART_2X_PLAN.md): like BattleAtlasMeta plus the native row the feet stand on. */
export interface AiBattleAtlasMeta extends BattleAtlasMeta {
  footRow: number;
}

/** Battle frames for one character plus how to place them. `footRow` is only known for AI art. */
export interface BattleFrames {
  frames: Texture[];
  scale: number;
  cell: [number, number];
  footRow: number | null;
  ai: boolean;
}

import { isPreviewAi } from '../core/artPreview.js';
import { TILE_SIZE } from '../core/LayoutConstants.js';
export { isPreviewAi };

/** Fetch JSON, rejecting HTTP errors and non-JSON bodies (e.g. a dev server's HTML fallback for a missing file). */
async function fetchJson<T>(path: string): Promise<T> {
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
  animation: Pick<AnimationConfig, 'frameWidth' | 'frameHeight' | 'frameCount' | 'originX' | 'originY' | 'walkSequence'>;
  /** Extra sprite scale so a frame is one tile wide on screen (2 for legacy art in the 96 px preview tiles). */
  displayScale: number;
  ai: boolean;
}

export const BATTLE_POSES = ['ready', 'attack', 'cast', 'hurt', 'down', 'victory'] as const;
export type BattlePose = typeof BATTLE_POSES[number];

/** Two-tile (head over feet) character sheets: field walk frames and battle poses; scale and cell size come from the atlas JSON. */
export class CharacterAtlas {
  private meta: CharacterAtlasMeta | null = null;
  private battleMeta: BattleAtlasMeta | null = null;
  private field: Texture | null = null;
  private battle: Texture | null = null;
  private aiBattleMeta: AiBattleAtlasMeta | null = null;
  private aiBattle: Texture | null = null;
  private aiFieldMeta: CharacterAtlasMeta | null = null;
  private aiField: Texture | null = null;
  private aiAttempted = false;

  private loading: Promise<void> | null = null;

  get isLoaded(): boolean {
    return !!this.meta && !!this.field && !!this.battle && !!this.battleMeta;
  }

  get hasAiBattleArt(): boolean {
    return !!this.aiBattleMeta && !!this.aiBattle;
  }

  /** Safe to call repeatedly; the atlas is fetched once. A failed load can be retried.
   *  Resolves only after both the legacy atlas and the optional AI atlas attempts have finished. */
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

  /** Optional AI art. Any failure leaves that AI atlas null; it never touches the legacy atlas. */
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
      const meta = await fetchJson<AiBattleAtlasMeta>(AI_BATTLE_META_PATH);
      const tex = await Assets.load<Texture>(AI_BATTLE_PATH);
      tex.source.scaleMode = 'nearest';
      this.aiBattleMeta = meta;
      this.aiBattle = tex;
    } catch (err) {
      this.aiBattleMeta = null;
      this.aiBattle = null;
      console.warn('AI battle art unavailable; legacy art only', err);
    }
  }

  private async fetchAtlas(): Promise<void> {
    try {
      this.meta = await fetchJson<CharacterAtlasMeta>(META_PATH);
      this.battleMeta = await fetchJson<BattleAtlasMeta>(BATTLE_META_PATH);
      this.field = await Assets.load<Texture>(FIELD_PATH);
      this.battle = await Assets.load<Texture>(BATTLE_PATH);
      this.field.source.scaleMode = 'nearest';
      this.battle.source.scaleMode = 'nearest';
    } catch (err) {
      this.meta = this.field = this.battle = this.battleMeta = null;
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
        frameCount: 3,
        originX: origin.x * fieldScale,
        originY: origin.y * fieldScale,
        walkSequence: [1, 0, 2, 0],
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
      for (let col = 0; col < 3; col++) {
        cols.push(new Texture({
          source: src.tex.source,
          frame: new Rectangle(o.x * fieldScale + col * fw, o.y * fieldScale + row * fh, fw, fh),
        }));
      }
      frames.push(cols);
    }
    const scale = TILE_SIZE / fw;
    return { frames, frameHeight: fh * scale, scale };
  }

  /** Battle poses (left-facing) in BATTLE_POSES order, or null when this class has no battle art.
   *  AI art is used only when `preferAi` (preview mode) is set and the class has an approved AI sheet. */
  getBattleFrames(id: string, preferAi: boolean = isPreviewAi()): BattleFrames | null {
    if (preferAi && this.aiBattleMeta && this.aiBattle && this.aiBattleMeta.sheets[id]) {
      const meta = this.aiBattleMeta;
      return { frames: sliceRow(meta, this.aiBattle, meta.sheets[id].row), scale: meta.scale, cell: meta.cell,
        footRow: meta.footRow, ai: true };
    }
    const meta = this.battleMeta;
    if (!meta || !this.battle || !meta.sheets[id]) return null;
    return { frames: sliceRow(meta, this.battle, meta.sheets[id].row), scale: meta.scale, cell: meta.cell,
      footRow: null, ai: false };
  }
}

function sliceRow(meta: BattleAtlasMeta, tex: Texture, row: number): Texture[] {
  const fw = meta.cell[0] * meta.scale;
  const fh = meta.cell[1] * meta.scale;
  return BATTLE_POSES.map((pose) => new Texture({
    source: tex.source,
    frame: new Rectangle(meta.poses.indexOf(pose) * fw, row * fh, fw, fh),
  }));
}

/** Shared by exploration and battle so art is loaded once. */
export const characterAtlas = new CharacterAtlas();
