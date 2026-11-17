import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { VehicleState, VehicleType } from '../../types/index.js';
import type { PlayerController } from '../../entities/PlayerController.js';
import { TILE_SIZE } from '../../core/LayoutConstants.js';
import { fetchJson } from '../../rendering/CharacterAtlas.js';

const SHEET = 'assets/sprites/vehicles.png';
const META = 'assets/sprites/vehicles.json';

/** Layout of assets/sprites/vehicles.json (build stage `vehicles`, assets-src/vehicles.py). */
export interface VehicleSheetMeta {
  cell: [number, number];
  frames: Partial<Record<VehicleType, [number, number]>>;
}

/** Placeholder colours while the sheet loads, or when it is missing (the console says so once). */
const FALLBACK_TINT: Record<VehicleType, number> = { ship: 0x8a5a2b, airship: 0xc03028, canoe: 0xa87a40 };

/**
 * The field's vehicle sprites (W1-A): one per vehicle parked on the map, and the vehicle the party rides, which
 * follows the hero at render time. The ship and the airship replace the hero's sprite; the canoe is drawn under it.
 * Textures come from the code-drawn `vehicles` sheet (24 px native cells, scaled to a tile with nearest-neighbour).
 */
export class FieldVehicleSprites {
  private textures: Partial<Record<VehicleType, Texture>> | null = null;
  private loading: Promise<void> | null = null;
  private parked: Array<{ sprite: Sprite; type: VehicleType }> = [];
  private ridden: { sprite: Sprite; type: VehicleType; player: PlayerController } | null = null;

  constructor(private readonly world: Container | null) {}

  /** Load the sheet once; a failure is logged and the coloured placeholders stay. */
  private ensure(): void {
    if (this.loading) return;
    this.loading = (async () => {
      const [meta, sheet] = await Promise.all([fetchJson<VehicleSheetMeta>(META), Assets.load<Texture>(SHEET)]);
      sheet.source.scaleMode = 'nearest';
      const [w, h] = meta.cell;
      const out: Partial<Record<VehicleType, Texture>> = {};
      for (const [type, at] of Object.entries(meta.frames) as Array<[VehicleType, [number, number]]>) {
        out[type] = new Texture({ source: sheet.source, frame: new Rectangle(at[0], at[1], w, h) });
      }
      this.textures = out;
      for (const p of this.parked) this.dress(p.sprite, p.type);
      if (this.ridden) this.dress(this.ridden.sprite, this.ridden.type);
    })().catch((e) => console.warn('Vehicle sprites failed to load; using placeholders:', e));
  }

  /** Give a sprite its vehicle's texture (or a tinted placeholder) at one tile, anchored on the tile's centre. */
  private dress(sprite: Sprite, type: VehicleType): void {
    const tex = this.textures?.[type];
    sprite.texture = tex ?? Texture.WHITE;
    sprite.tint = tex ? 0xffffff : FALLBACK_TINT[type];
    sprite.anchor.set(0.5);
    const k = tex ? TILE_SIZE / tex.frame.width : TILE_SIZE * 0.8 / Math.max(1, Texture.WHITE.frame.width);
    sprite.scale.set(Math.sign(sprite.scale.x || 1) * k, k);
  }

  private make(type: VehicleType): Sprite {
    this.ensure();
    const sprite = new Sprite(Texture.WHITE);
    sprite.label = `vehicle:${type}`;
    this.dress(sprite, type);
    return sprite;
  }

  /** Draw `vehicles` (this map's parked vehicles) in the world; the last set is removed first. */
  showParked(vehicles: readonly VehicleState[]): void {
    for (const p of this.parked) p.sprite.parent?.removeChild(p.sprite);
    this.parked = [];
    if (!this.world) return;
    for (const v of vehicles) {
      const sprite = this.make(v.type);
      sprite.x = v.x * TILE_SIZE + TILE_SIZE / 2;
      sprite.y = v.y * TILE_SIZE + TILE_SIZE / 2;
      sprite.zIndex = (v.y + 1) * TILE_SIZE - 1;   // just behind a hero standing on the same row
      this.world.addChild(sprite);
      this.parked.push({ sprite, type: v.type });
    }
  }

  /** The vehicle the party rides (null on foot); it follows `player` each frame it is drawn. */
  ride(type: VehicleType | null, player: PlayerController | null): void {
    const cur = this.ridden;
    if (cur && (cur.type !== type || cur.player !== player || cur.sprite.parent !== this.world)) {
      cur.sprite.parent?.removeChild(cur.sprite);
      cur.player.animation.sprite.visible = true;
      this.ridden = null;
    }
    if (!type || !player || !this.world || this.ridden) return;
    const sprite = this.make(type);
    this.world.addChild(sprite);
    this.ridden = { sprite, type, player };
    sprite.onRender = () => this.follow();
    this.follow();
  }

  /** Put the ridden vehicle under the hero (facing as the hero does); hide the hero in the ship and the airship. */
  private follow(): void {
    const r = this.ridden;
    if (!r) return;
    const hero = r.player.animation.sprite;
    hero.visible = r.type === 'canoe';
    r.sprite.x = r.player.x;
    r.sprite.y = r.player.y;
    r.sprite.zIndex = r.type === 'airship' ? hero.zIndex + 1 : hero.zIndex - 1;
    const k = Math.abs(r.sprite.scale.x);
    r.sprite.scale.x = r.player.direction === 'left' ? -k : k;
  }

  /** The parked sprites' types and cells, for tests and debugging. */
  get parkedTypes(): VehicleType[] {
    return this.parked.map((p) => p.type);
  }

  get riddenType(): VehicleType | null {
    return this.ridden?.type ?? null;
  }
}
