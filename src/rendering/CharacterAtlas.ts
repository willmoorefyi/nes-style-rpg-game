import { Assets, Rectangle, Texture } from 'pixi.js';
import type { AnimationConfig } from './SpriteAnimation.js';
import type { NPCFrames } from '../entities/NPC.js';

const META_PATH = 'assets/sprites/characters.json';
const FIELD_PATH = 'assets/sprites/characters.png';
const BATTLE_PATH = 'assets/sprites/characters-battle.png';

/** Layout of assets/sprites/characters.json, produced by assets-src/build_assets.py. */
export interface CharacterAtlasMeta {
  cell: [number, number];
  cols: number;
  rows: number;
  fieldScale: number;
  battleScale: number;
  rowNames: string[];
  battleFrames: string[];
  sheets: Record<string, { x: number; y: number }>;
}

/** What PlayerController needs to animate a character from the shared atlas. */
export interface FieldArt {
  texture: Texture;
  animation: Pick<AnimationConfig, 'frameWidth' | 'frameHeight' | 'frameCount' | 'originX' | 'originY' | 'walkSequence'>;
}

export const BATTLE_POSES = ['ready', 'attack', 'cast', 'hurt', 'down', 'victory'] as const;
export type BattlePose = typeof BATTLE_POSES[number];

/** Two-tile (head over feet) character sheets: field walk frames at 3x and battle poses at 4x. */
export class CharacterAtlas {
  private meta: CharacterAtlasMeta | null = null;
  private field: Texture | null = null;
  private battle: Texture | null = null;

  private loading: Promise<void> | null = null;

  get isLoaded(): boolean {
    return !!this.meta && !!this.field && !!this.battle;
  }

  /** Safe to call repeatedly; the atlas is fetched once. A failed load can be retried. */
  load(): Promise<void> {
    if (this.isLoaded) return Promise.resolve();
    if (!this.loading) {
      this.loading = this.fetchAtlas().finally(() => { this.loading = null; });
    }
    return this.loading;
  }

  private async fetchAtlas(): Promise<void> {
    try {
      const response = await fetch(META_PATH);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.meta = (await response.json()) as CharacterAtlasMeta;
      this.field = await Assets.load<Texture>(FIELD_PATH);
      this.battle = await Assets.load<Texture>(BATTLE_PATH);
      this.field.source.scaleMode = 'nearest';
      this.battle.source.scaleMode = 'nearest';
    } catch (err) {
      this.meta = this.field = this.battle = null;
      console.warn('Character art unavailable; using placeholder sprites', err);
    }
  }

  has(id: string): boolean {
    return !!this.meta && !!this.field && id in this.meta.sheets;
  }

  /** Field (overworld/town) animation source for a class or NPC sprite id. */
  getFieldArt(id: string): FieldArt | null {
    if (!this.meta || !this.field || !this.meta.sheets[id]) return null;
    const { cell, fieldScale } = this.meta;
    const origin = this.meta.sheets[id];
    return {
      texture: this.field,
      animation: {
        frameWidth: cell[0] * fieldScale,
        frameHeight: cell[1] * fieldScale,
        frameCount: 3,
        originX: origin.x * fieldScale,
        originY: origin.y * fieldScale,
        walkSequence: [1, 0, 2, 0],
      },
    };
  }

  /** Frames for a static-or-wandering NPC: frames[direction][column]. */
  getNpcFrames(id: string): NPCFrames | null {
    if (!this.meta || !this.field || !this.meta.sheets[id]) return null;
    const { cell, fieldScale } = this.meta;
    const o = this.meta.sheets[id];
    const fw = cell[0] * fieldScale;
    const fh = cell[1] * fieldScale;
    const frames: Texture[][] = [];
    for (let row = 0; row < 4; row++) {
      const cols: Texture[] = [];
      for (let col = 0; col < 3; col++) {
        cols.push(new Texture({
          source: this.field.source,
          frame: new Rectangle(o.x * fieldScale + col * fw, o.y * fieldScale + row * fh, fw, fh),
        }));
      }
      frames.push(cols);
    }
    return { frames, frameHeight: fh };
  }

  /** Battle poses (left-facing) at 4x, in BATTLE_POSES order. */
  getBattleFrames(id: string): Texture[] | null {
    if (!this.meta || !this.battle || !this.meta.sheets[id]) return null;
    const { cell, battleScale } = this.meta;
    const o = this.meta.sheets[id];
    const fw = cell[0] * battleScale;
    const fh = cell[1] * battleScale;
    const battleRow = this.meta.rowNames.indexOf('battle');
    return BATTLE_POSES.map((_, col) => new Texture({
      source: this.battle!.source,
      frame: new Rectangle(o.x * battleScale + col * fw, o.y * battleScale + (battleRow) * fh, fw, fh),
    }));
  }
}

/** Shared by exploration and battle so art is loaded once. */
export const characterAtlas = new CharacterAtlas();
