import { SpriteAnimation, type AnimationConfig, type Direction, walkCycleIndex } from '../rendering/SpriteAnimation.js';
import { CollisionMap } from '../rendering/CollisionMap.js';
import type { InputManager } from '../core/InputManager.js';
import type { EventBus } from '../core/EventBus.js';
import { TILE_SIZE } from '../core/LayoutConstants.js';
import { Texture } from 'pixi.js';
import type { MovementMode } from './MovementMode.js';
import { WalkingMode } from './WalkingMode.js';

export interface PlayerControllerConfig {
  startX: number;
  startY: number;
  texture: Texture;
  collisionMap: CollisionMap;
  input: InputManager;
  events: EventBus;
  moveSpeed?: number; // ms per tile
  movementMode?: MovementMode;
  /** Overrides for tall character sheets (frame size, atlas origin, walk cycle). */
  animation?: Partial<AnimationConfig>;
  /** Sprite scale applied on screen (frames are this many times larger than their source pixels). */
  displayScale?: number;
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
  /** Walk frames per tile moved (from the atlas). */
  private readonly walkPhases: number;
  private tileX: number;
  private tileY: number;
  private targetX: number;
  private targetY: number;
  private moveProgress = 0;
  /** The part of a frame's step left over when the last tile ended (0 when the hero stopped). */
  private carry = 0;
  private moveSpeed: number;
  /** Tiles walked so far; alternates the stepping foot from tile to tile. */
  private stepsTaken = 0;
  private state: PlayerState = 'idle';
  private collisionMap: CollisionMap;
  private input: InputManager;
  private events: EventBus;
  private npcPositions: Set<string> = new Set();
  private _currentMode: MovementMode;
  /** Pixels the sprite is lifted so a taller-than-tile frame keeps its feet on the tile. */
  private spriteOffsetY = 0;
  private frameHeight = TILE_SIZE;
  /** The Walk speed boost (src/core/Boosts.ts): multiplies the step speed on foot, by ship and by canoe; never the
   *  airship's, which has its own fixed speed (AirshipMode.AIRSHIP_SPEED; user ruling 2026-11-22). */
  speedBoost = 1;

  constructor(config: PlayerControllerConfig) {
    this.tileX = config.startX;
    this.tileY = config.startY;
    this.targetX = config.startX;
    this.targetY = config.startY;
    this.moveSpeed = config.moveSpeed ?? 200;
    this.collisionMap = config.collisionMap;
    this.input = config.input;
    this.events = config.events;
    this._currentMode = config.movementMode ?? new WalkingMode();

    this.animation = new SpriteAnimation(config.texture, {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
      frameCount: 2,
      frameDuration: 150,   // only used by timer-driven callers; walking is driven by movement (walkCycleIndex)
      directions: { down: 0, up: 1, left: 2, right: 3 },
      ...config.animation,
    });
    this.walkPhases = config.animation?.walkPhases ?? 2;
    const displayScale = config.displayScale ?? 1;
    this.animation.sprite.scale.set(displayScale);
    this.frameHeight = (config.animation?.frameHeight ?? TILE_SIZE) * displayScale;
    this.spriteOffsetY = TILE_SIZE - this.frameHeight;
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
      this.moveProgress += this.stepRate(dt);
      if (this.moveProgress >= 1) {
        // the time past the tile's end is carried into the next step, so a held direction loses no frame per tile
        this.carry = Math.min(0.5, this.moveProgress - 1);
        // WR: the drawn target may be unwrapped (-1 or W); the tile normalises here, the sprite jumps by the period
        const end = this.collisionMap.wrapCell(this.targetX, this.targetY) ?? { x: this.targetX, y: this.targetY };
        this.tileX = this.targetX = end.x;
        this.tileY = this.targetY = end.y;
        this.moveProgress = 0;
        this.state = 'idle';
        this.stepsTaken++;                       // the next tile steps with the other foot
        this.animation.setState('idle');
        this.events.emit('playerMove', { x: this.tileX, y: this.tileY });
      } else {
        this.animation.setWalkFrame(walkCycleIndex(this.stepsTaken, this.moveProgress, this.walkPhases));
      }
      this.updateSpritePosition();
    } else {
      this.handleInput(dt);
    }
  }

  /** The share of a tile walked in `dt` toward the target (the mode's terrain speed times the Walk speed boost, which
   *  the airship ignores). */
  private stepRate(dt: number): number {
    const speedMultiplier = this._currentMode.getSpeedMultiplier(this.collisionMap.getTerrainType(this.targetX, this.targetY));
    const boost = this._currentMode.id === 'airship' ? 1 : this.speedBoost;
    return (dt * 16.67) / (this.moveSpeed / Math.max(0.1, speedMultiplier * boost));
  }

  private handleInput(dt: number): void {
    let dir: Direction | null = null;
    if (this.input.isPressed('up')) dir = 'up';
    else if (this.input.isPressed('down')) dir = 'down';
    else if (this.input.isPressed('left')) dir = 'left';
    else if (this.input.isPressed('right')) dir = 'right';

    const carry = this.carry;
    this.carry = 0;                              // a carry only joins a step taken on the very next frame
    if (dir) {
      this.animation.setDirection(dir);
      const { dx, dy } = DIRECTION_VECTORS[dir];
      const next = this.collisionMap.wrapCell(this.tileX + dx, this.tileY + dy); // WR: canonical (null off a flat map)
      if (next && this.canMoveTo(next.x, next.y)) {
        this.targetX = this.tileX + dx;
        this.targetY = this.tileY + dy;
        this.state = 'moving';
        // the step starts moving on this frame (plus the last tile's carry), never finishing here: the scene sees
        // every arrival on its own frame (fieldStep, encounters)
        this.moveProgress = Math.min(0.99, carry + this.stepRate(dt));
        this.animation.setWalkFrame(walkCycleIndex(this.stepsTaken, this.moveProgress, this.walkPhases));
        this.updateSpritePosition();
      }
    }
  }

  private canMoveTo(x: number, y: number): boolean {
    if (!this.collisionMap.isWalkable(x, y, this._currentMode)) return false;
    if (this.npcPositions.has(`${x},${y}`)) return false;
    return true;
  }

  private updateSpritePosition(): void {
    const srcX = this.tileX * TILE_SIZE;
    const srcY = this.tileY * TILE_SIZE;
    const dstX = this.targetX * TILE_SIZE;
    const dstY = this.targetY * TILE_SIZE;
    this.animation.sprite.x = srcX + (dstX - srcX) * this.moveProgress;
    this.animation.sprite.y = srcY + (dstY - srcY) * this.moveProgress + this.spriteOffsetY;
    // Sort by the feet so characters lower on screen draw over those behind them.
    this.animation.sprite.zIndex = this.animation.sprite.y + this.frameHeight;
  }

  setPosition(x: number, y: number): void {
    this.tileX = x;
    this.tileY = y;
    this.targetX = x;
    this.targetY = y;
    this.moveProgress = 0;
    this.carry = 0;
    this.state = 'idle';
    this.updateSpritePosition();
  }

  get x(): number { return this.animation.sprite.x + TILE_SIZE / 2; }
  get y(): number { return this.animation.sprite.y - this.spriteOffsetY + TILE_SIZE / 2; }
  get gridX(): number { return this.tileX; }
  get gridY(): number { return this.tileY; }
  get direction(): Direction { return this.animation.direction; }
  /** Turn to `dir` without moving (a cutscene warp's arrival facing, T2). */
  face(dir: Direction): void { this.animation.setDirection(dir); }
  get isMoving(): boolean { return this.state === 'moving'; }
  /** The tile being stepped onto (the current tile when idle). */
  get targetTile(): { x: number; y: number } {
    return this.collisionMap.wrapCell(this.targetX, this.targetY) ?? { x: this.targetX, y: this.targetY };
  }
  get facingTile(): { x: number; y: number } {
    const { dx, dy } = DIRECTION_VECTORS[this.animation.direction];
    return this.collisionMap.wrapCell(this.tileX + dx, this.tileY + dy) ?? { x: this.tileX + dx, y: this.tileY + dy };
  }

  get currentMode(): MovementMode { return this._currentMode; }
  set currentMode(mode: MovementMode) { this._currentMode = mode; }

  /** Encounter rate multiplier from the current movement mode */
  get encounterRateMultiplier(): number {
    return this._currentMode.getEncounterRateMultiplier();
  }
}
