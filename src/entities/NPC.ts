import { Sprite, Texture } from 'pixi.js';

export interface NPCData {
  id: string;
  x: number;
  y: number;
  sprite: string;
  dialog: string[];
}

export class NPC {
  readonly id: string;
  readonly tileX: number;
  readonly tileY: number;
  readonly sprite: Sprite;
  readonly dialog: string[];

  constructor(data: NPCData, texture: Texture) {
    this.id = data.id;
    this.tileX = data.x;
    this.tileY = data.y;
    this.dialog = data.dialog;
    this.sprite = new Sprite(texture);
    this.sprite.x = data.x * 16;
    this.sprite.y = data.y * 16;
  }
}
