import { SpriteAnimation, type Direction } from '../rendering/SpriteAnimation.js';
import { CollisionMap } from '../rendering/CollisionMap.js';
import type { InputManager } from '../core/InputManager.js';
import type { EventBus } from '../core/EventBus.js';
import { TILE_SIZE } from '../rendering/Camera.js';
import { Texture } from 'pixi.js';

export interface PlayerControllerConfig {
  startX: number;
  startY: number;
  texture: Texture;
  collisionMap: CollisionMap;
  input: InputManager;
  events: EventBus;
  moveSpeed?: number; // ms per tile
}

type PlayerState = 'idle' | 'moving';

const DIRECTION_VECTORS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export class PlayerController {
  readonly animation: SpriteAnimation;
  private tileX: number;
  private tileY: number;
  private targetX: number;
  private targetY: number;
  private moveProgress = 0;
  private moveSpeed: number;
  private state: PlayerState = 'idle';
  private collisionMap: CollisionMap;
  private input: InputManager;
  private events: EventBus;
  private npcPositions: Set<string> = new Set();

  constructor(config: PlayerControllerConfig) {
    this.tileX = config.startX;
    this.tileY = config.startY;
    this.targetX = config.startX;
    this.targetY = config.startY;
    this.moveSpeed = config.moveSpeed ?? 200;
    this.collisionMap = config.collisionMap;
    this.input = config.input;
    this.events = config.events;

    this.animation = new SpriteAnimation(config.texture, {
      frameWidth: 16,
      frameHeight: 16,
      frameCount: 2,
      frameDuration: 150,
      directions: { down: 0, up: 1, left: 2, right: 3 },
    });
    this.updateSpritePosition();
  }

  setNPCPositions(positions: Array<{ x: number; y: number }>): void {
    this.npcPositions.clear();
    for (const p of positions) {
      this.npcPositions.add(`${p.x},${p.y}`);
    }
  }

  update(dt: number): void {
    if (this.state === 'moving') {
      this.moveProgress += (dt * 16.67) / this.moveSpeed;
      if (this.moveProgress >= 1) {
        this.tileX = this.targetX;
        this.tileY = this.targetY;
        this.moveProgress = 0;
        this.state = 'idle';
        this.animation.setState('idle');
        this.events.emit('playerMove', { x: this.tileX, y: this.tileY });
      }
      this.updateSpritePosition();
    } else {
      this.handleInput();
    }
    this.animation.update(dt * 16.67);
  }

  private handleInput(): void {
    let dir: Direction | null = null;
    if (this.input.isPressed('up')) dir = 'up';
    else if (this.input.isPressed('down')) dir = 'down';
    else if (this.input.isPressed('left')) dir = 'left';
    else if (this.input.isPressed('right')) dir = 'right';

    if (dir) {
      this.animation.setDirection(dir);
      const { dx, dy } = DIRECTION_VECTORS[dir];
      const newX = this.tileX + dx;
      const newY = this.tileY + dy;
      if (this.canMoveTo(newX, newY)) {
        this.targetX = newX;
        this.targetY = newY;
        this.state = 'moving';
        this.animation.setState('walking');
      }
    }
  }

  private canMoveTo(x: number, y: number): boolean {
    if (!this.collisionMap.isWalkable(x, y)) return false;
    if (this.npcPositions.has(`${x},${y}`)) return false;
    return true;
  }

  private updateSpritePosition(): void {
    const srcX = this.tileX * TILE_SIZE;
    const srcY = this.tileY * TILE_SIZE;
    const dstX = this.targetX * TILE_SIZE;
    const dstY = this.targetY * TILE_SIZE;
    this.animation.sprite.x = srcX + (dstX - srcX) * this.moveProgress;
    this.animation.sprite.y = srcY + (dstY - srcY) * this.moveProgress;
  }

  setPosition(x: number, y: number): void {
    this.tileX = x;
    this.tileY = y;
    this.targetX = x;
    this.targetY = y;
    this.moveProgress = 0;
    this.state = 'idle';
    this.updateSpritePosition();
  }

  get x(): number { return this.animation.sprite.x + TILE_SIZE / 2; }
  get y(): number { return this.animation.sprite.y + TILE_SIZE / 2; }
  get gridX(): number { return this.tileX; }
  get gridY(): number { return this.tileY; }
  get direction(): Direction { return this.animation.direction; }
  get isMoving(): boolean { return this.state === 'moving'; }
  get facingTile(): { x: number; y: number } {
    const { dx, dy } = DIRECTION_VECTORS[this.animation.direction];
    return { x: this.tileX + dx, y: this.tileY + dy };
  }
}
