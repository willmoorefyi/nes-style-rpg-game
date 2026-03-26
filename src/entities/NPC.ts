import { Sprite, Texture } from 'pixi.js';
import { TILE_SIZE } from '../core/LayoutConstants.js';
import type { ConditionalDialog } from '../types/index.js';

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
}

// Direction offsets: up, down, left, right
const DIRECTION_OFFSETS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

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
  readonly wander: boolean;
  private wanderTimer: number = 0;
  private wanderInterval: number = 120;
  private isMoving: boolean = false;
  private moveProgress: number = 0;
  private moveFromX: number = 0;
  private moveFromY: number = 0;

  constructor(data: NPCData, texture: Texture) {
    this.id = data.id;
    this.tileX = data.x;
    this.tileY = data.y;
    this.dialog = data.dialog;
    this.shopId = data.shopId;
    this.action = data.action;
    this.chestItem = data.chestItem;
    this.chestFlag = data.chestFlag;
    this.wander = data.wander ?? false;
    this.sprite = new Sprite(texture);
    this.sprite.x = data.x * TILE_SIZE;
    this.sprite.y = data.y * TILE_SIZE;
  }

  update(dt: number, isWalkable: (x: number, y: number) => boolean): void {
    if (!this.wander) return;

    if (this.isMoving) {
      // Animate sprite from old position to new position (~300ms = ~18 frames at 60fps)
      this.moveProgress += dt;
      const t = Math.min(this.moveProgress / 18, 1);
      this.sprite.x = (this.moveFromX + (this.tileX - this.moveFromX) * t) * TILE_SIZE;
      this.sprite.y = (this.moveFromY + (this.tileY - this.moveFromY) * t) * TILE_SIZE;
      if (t >= 1) {
        this.isMoving = false;
      }
      return;
    }

    this.wanderTimer += dt;
    if (this.wanderTimer < this.wanderInterval) return;

    // Reset timer to random 120-180 frames (~2-3 seconds)
    this.wanderTimer = 0;
    this.wanderInterval = 120 + Math.floor(Math.random() * 61);

    // Pick random direction
    const dir = DIRECTION_OFFSETS[Math.floor(Math.random() * 4)];
    const targetX = this.tileX + dir.dx;
    const targetY = this.tileY + dir.dy;

    if (isWalkable(targetX, targetY)) {
      this.moveFromX = this.tileX;
      this.moveFromY = this.tileY;
      this.tileX = targetX;
      this.tileY = targetY;
      this.isMoving = true;
      this.moveProgress = 0;
    }
  }
}
