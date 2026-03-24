import { Sprite, Texture } from 'pixi.js';
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
}

export class NPC {
  readonly id: string;
  readonly tileX: number;
  readonly tileY: number;
  readonly sprite: Sprite;
  readonly dialog: string[] | ConditionalDialog[];
  readonly shopId?: string;
  readonly action?: string;
  readonly chestItem?: string;
  readonly chestFlag?: string;

  constructor(data: NPCData, texture: Texture) {
    this.id = data.id;
    this.tileX = data.x;
    this.tileY = data.y;
    this.dialog = data.dialog;
    this.shopId = data.shopId;
    this.action = data.action;
    this.chestItem = data.chestItem;
    this.chestFlag = data.chestFlag;
    this.sprite = new Sprite(texture);
    this.sprite.x = data.x * 16;
    this.sprite.y = data.y * 16;
  }
}
