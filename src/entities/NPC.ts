import { walkCycleIndex } from '../rendering/SpriteAnimation.js';
import { Sprite, Texture } from 'pixi.js';
import { TILE_SIZE } from '../core/LayoutConstants.js';
import type { ConditionalDialog, NPCCutscene } from '../types/index.js';

export interface NPCData {
  id: string;
  x: number;
  y: number;
  sprite: string;
  dialog: string[] | ConditionalDialog[];
  shopId?: string;
  action?: string;
  chestItem?: string;
  chestFlag?: string;
  wander?: boolean;
  giftItem?: string;
  giftFlag?: string;
  cutscene?: NPCCutscene;
  /** A colour multiplied into the field sprite, "#rrggbb" (QUEST 4.2: new NPC kinds reuse a sheet with a tint). */
  tint?: string;
}

/** A valid `tint` ("#rrggbb"), else null (an invalid one is logged by the caller). */
export function npcTint(tint: string | undefined): string | null {
  return tint !== undefined && /^#[0-9a-fA-F]{6}$/.test(tint) ? tint : null;
}

// Direction offsets: up, down, left, right
const DIRECTION_OFFSETS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

/** Optional animated art for an NPC: frames[row][col] with rows down/up/left/right. */
export interface NPCFrames {
  frames: Texture[][];
  /** On-screen frame height (after `scale`). */
  frameHeight: number;
  /** Sprite scale so one frame is one tile wide on screen (default 1). */
  scale?: number;
  /** Walk columns and frames per tile (default: the legacy [1, 0, 2, 0], 2 per tile). */
  walkSequence?: number[];
  walkPhases?: number;
}

const FACE_ROW = { down: 0, up: 1, left: 2, right: 3 } as const;
const WALK_CYCLE = [1, 0, 2, 0];
/** Chest art: the closed lid is column 0 of the first row, the opened chest column 1 (characters.py chest_cell). */
const CHEST_OPEN_COL = 1;
/** An opened chest with no opened frame is drawn dimmed instead. */
export const OPENED_CHEST_TINT = 0x707070;

export class NPC {
  readonly id: string;
  tileX: number;
  tileY: number;
  readonly sprite: Sprite;
  readonly dialog: string[] | ConditionalDialog[];
  readonly shopId?: string;
  readonly action?: string;
  readonly chestItem?: string;
  readonly chestFlag?: string;
  readonly giftItem?: string;
  readonly giftFlag?: string;
  readonly cutscene?: NPCCutscene;
  readonly wander: boolean;
  /** Where the NPC was placed; wandering stays near it. */
  readonly spawn: { readonly x: number; readonly y: number };
  private readonly rng: () => number;
  private stepsTaken = 0;
  private wanderTimer: number = 0;
  private wanderInterval: number = 120;
  private isMoving: boolean = false;
  private moveProgress: number = 0;
  private moveFromX: number = 0;
  private moveFromY: number = 0;
  private readonly art: NPCFrames | null;
  private readonly offsetY: number;
  private facing: keyof typeof FACE_ROW = 'down';
  private facingBeforeTalk: keyof typeof FACE_ROW | null = null;
  private openedChest = false;

  constructor(data: NPCData, texture: Texture, art?: NPCFrames, rng: () => number = Math.random) {
    this.id = data.id;
    this.spawn = { x: data.x, y: data.y };
    this.rng = rng;
    this.tileX = data.x;
    this.tileY = data.y;
    this.dialog = data.dialog;
    this.shopId = data.shopId;
    this.action = data.action;
    this.chestItem = data.chestItem;
    this.chestFlag = data.chestFlag;
    this.giftItem = data.giftItem;
    this.giftFlag = data.giftFlag;
    this.cutscene = data.cutscene;
    this.wander = data.wander ?? false;
    this.art = art ?? null;
    this.offsetY = art ? TILE_SIZE - art.frameHeight : 0;
    this.sprite = new Sprite(art ? art.frames[FACE_ROW.down][0] : texture);
    if (art?.scale) this.sprite.scale.set(art.scale);
    const tint = npcTint(data.tint);
    if (tint) this.sprite.tint = tint;
    else if (data.tint !== undefined) console.error(`NPC ${data.id}: tint '${data.tint}' is not #rrggbb`);
    this.sprite.x = data.x * TILE_SIZE;
    this.sprite.y = data.y * TILE_SIZE + this.offsetY;
    this.updateDepth();
  }

  /** Sort by the feet so characters lower on screen draw over those behind them. */
  private updateDepth(): void {
    this.sprite.zIndex = this.sprite.y + (this.art?.frameHeight ?? TILE_SIZE);
  }

  /** A treasure chest (it has a chest item): it never turns and shows as opened once looted. */
  get isChest(): boolean { return this.chestItem !== undefined; }

  get opened(): boolean { return this.openedChest; }

  /** Show the chest as opened (its opened frame, or dimmed when the art has none); set at map load and on looting. */
  setOpened(): void {
    if (!this.isChest || this.openedChest) return;
    this.openedChest = true;
    const open = this.art?.frames[FACE_ROW.down]?.[CHEST_OPEN_COL];
    if (open) this.sprite.texture = open;
    else this.sprite.tint = OPENED_CHEST_TINT;
  }

  /** Turn to face a tile (the hero talking to this NPC); the previous facing is kept for endTalk(). Chests don't. */
  faceToward(x: number, y: number): void {
    if (this.isChest) return;
    const dx = x - this.tileX;
    const dy = y - this.tileY;
    if (dx === 0 && dy === 0) return;
    this.facingBeforeTalk ??= this.facing;
    this.facing = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    this.showFrame(0);
  }

  /** The conversation is over: turn back to the direction faced before it. */
  endTalk(): void {
    if (this.facingBeforeTalk === null) return;
    this.facing = this.facingBeforeTalk;
    this.facingBeforeTalk = null;
    this.showFrame(0);
  }

  get facingDirection(): 'down' | 'up' | 'left' | 'right' { return this.facing; }

  private showFrame(col: number): void {
    const row = this.art?.frames[FACE_ROW[this.facing]];
    if (row) this.sprite.texture = row[col] ?? row[0];
  }

  /**
   * Wander one frame. `canStepTo` decides whether a chosen neighbour tile may be entered (see NpcWander); while
   * `hold` is set (the player is right beside the NPC) no new step starts, though a step under way finishes.
   */
  update(dt: number, canStepTo: (x: number, y: number) => boolean, hold = false): void {
    if (!this.wander) return;

    if (this.isMoving) {
      // Animate sprite from old position to new position (~300ms = ~18 frames at 60fps)
      this.moveProgress += dt;
      const t = Math.min(this.moveProgress / 18, 1);
      this.sprite.x = (this.moveFromX + (this.tileX - this.moveFromX) * t) * TILE_SIZE;
      this.sprite.y = (this.moveFromY + (this.tileY - this.moveFromY) * t) * TILE_SIZE + this.offsetY;
      this.updateDepth();
      const seq = this.art?.walkSequence ?? WALK_CYCLE;
      this.showFrame(t >= 1 ? 0 : seq[walkCycleIndex(this.stepsTaken, t, this.art?.walkPhases ?? 2) % seq.length]);
      if (t >= 1) {
        this.isMoving = false;
        this.stepsTaken++;
      }
      return;
    }
    if (hold) return;

    this.wanderTimer += dt;
    if (this.wanderTimer < this.wanderInterval) return;

    // Reset timer to random 120-180 frames (~2-3 seconds)
    this.wanderTimer = 0;
    this.wanderInterval = 120 + Math.floor(this.rng() * 61);

    // Pick random direction
    const dir = DIRECTION_OFFSETS[Math.min(3, Math.floor(this.rng() * 4))];
    const targetX = this.tileX + dir.dx;
    const targetY = this.tileY + dir.dy;

    if (this.art) {
      this.facing = dir.dx < 0 ? 'left' : dir.dx > 0 ? 'right' : dir.dy < 0 ? 'up' : 'down';
      this.showFrame(0);
    }
    if (canStepTo(targetX, targetY)) {
      this.moveFromX = this.tileX;
      this.moveFromY = this.tileY;
      this.tileX = targetX;
      this.tileY = targetY;
      this.isMoving = true;
      this.moveProgress = 0;
    }
  }
}
