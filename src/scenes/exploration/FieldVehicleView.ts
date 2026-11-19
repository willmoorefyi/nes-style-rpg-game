import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { VehicleType } from '../../types/index.js';
import { TILE_SIZE } from '../../core/LayoutConstants.js';
import {
  FLYING_Z, airshipLift, airshipShadow, bobPx, nativeScale, type CanoeSeat, type VehicleFrame, type VehiclePose,
} from './vehicleLayout.js';

/** The loaded sheet: a texture and its frame record per frame name, and the canoe seat. */
export interface VehicleArt {
  frames: Record<string, { tex: Texture; frame: VehicleFrame }>;
  seat: CanoeSeat;
}

/** Placeholder colours while the sheet loads, or when it is missing (the console says so once). */
export const FALLBACK_TINT: Record<VehicleType, number> = { ship: 0x8a5a2b, airship: 0xc03028, canoe: 0xa87a40 };

/** Where and how a vehicle is drawn this frame. */
export interface VehiclePlacement {
  /** The bottom centre of the vehicle's cell (screen px in the world). */
  footX: number;
  footY: number;
  facing: 'left' | 'right';
  pose: VehiclePose;
  tMs: number;
  /** ms since the airship was boarded (its take-off ease). */
  sinceBoard: number;
  /** The z of the hull (the canoe's near side goes 2 above it, the ripple 1 below). */
  z: number;
}

/**
 * One vehicle on the field (VEH-INT): its hull sprite at its own size, anchored on its tile's bottom edge and mirrored
 * by facing; the canoe adds its near-side layer and a ripple strip; the airship a shadow ellipse on the ground.
 * Without art (loading, or the sheet failed) it is a tinted placeholder square anchored the same way.
 */
export class VehicleView {
  readonly main = new Sprite(Texture.WHITE);
  readonly front: Sprite | null = null;
  readonly ripple: Sprite | null = null;
  readonly shadow: Graphics | null = null;
  /** The hull's lift on screen this frame (bob plus flight), px; the canoe's hero follows it. */
  rise = 0;
  private readonly k = nativeScale(TILE_SIZE);

  constructor(readonly type: VehicleType, private readonly art: VehicleArt | null) {
    this.main.label = `vehicle:${type}`;
    const f = art?.frames[type];
    if (f) {
      this.dress(this.main, f.tex, f.frame);
      if (type === 'canoe') {
        this.front = this.part('canoe_front');
        this.ripple = this.part('canoe_ripple');
      }
      if (type === 'airship') this.shadow = new Graphics();
    } else {
      this.main.tint = FALLBACK_TINT[type];
      this.main.anchor.set(0.5, 1);
      const s = (TILE_SIZE * 0.8) / Math.max(1, Texture.WHITE.frame.width);
      this.main.scale.set(s, s);
    }
  }

  private part(name: string): Sprite | null {
    const f = this.art?.frames[name];
    if (!f) return null;
    const s = new Sprite(f.tex);
    s.label = `vehicle:${name}`;
    this.dress(s, f.tex, f.frame);
    return s;
  }

  private dress(s: Sprite, tex: Texture, frame: VehicleFrame): void {
    s.texture = tex;
    s.tint = 0xffffff;
    s.anchor.set(frame.anchor[0], frame.anchor[1]);
    s.scale.set(this.k, this.k);
  }

  /** The hull frame (null for a placeholder). */
  get frame(): VehicleFrame | null {
    return this.art?.frames[this.type]?.frame ?? null;
  }

  /** Every display object, bottom first. */
  get parts(): Array<Sprite | Graphics> {
    return [this.shadow, this.ripple, this.main, this.front].filter((p): p is Sprite | Graphics => !!p);
  }

  attach(world: Container): void {
    for (const p of this.parts) world.addChild(p);
  }

  detach(): void {
    for (const p of this.parts) p.parent?.removeChild(p);
  }

  /** Put every part for this frame. */
  place(p: VehiclePlacement): void {
    const k = this.k;
    const lift = this.type === 'airship' ? airshipLift(p.pose, p.sinceBoard) : 0;
    this.rise = (bobPx(this.type, p.pose, p.tMs) + lift) * k;
    const flip = p.facing === 'left' ? -1 : 1;
    this.main.x = p.footX;
    this.main.y = p.footY - this.rise;
    this.main.scale.x = flip * Math.abs(this.main.scale.x);
    const flying = this.type === 'airship' && p.pose === 'ridden';
    this.main.zIndex = flying ? FLYING_Z : p.z;
    if (this.front) {
      this.front.x = p.footX;
      this.front.y = this.main.y;
      this.front.scale.x = flip * k;
      this.front.zIndex = p.z + 2;
    }
    if (this.ripple) {
      this.ripple.x = p.footX;
      this.ripple.y = p.footY + k;
      this.ripple.scale.x = flip * k;
      this.ripple.zIndex = p.z - 1;
    }
    if (this.shadow && this.frame) this.drawShadow(p, this.frame);
  }

  /** The shadow ellipse, centred under the keel on the cell's bottom edge, under the hull. */
  private drawShadow(p: VehiclePlacement, frame: VehicleFrame): void {
    const g = this.shadow!;
    if (this.shadowPose !== p.pose) {
      const s = airshipShadow(frame.w, p.pose);
      g.clear();
      g.ellipse(0, 0, (s.w * this.k) / 2, (s.h * this.k) / 2).fill({ color: 0x000000, alpha: s.alpha });
      this.shadowPose = p.pose;
      this.shadowSize = s;
    }
    g.x = p.footX;
    g.y = p.footY;
    g.zIndex = p.pose === 'ridden' ? FLYING_Z - 1 : p.z - 1;   // in flight it falls on the treetops too
  }

  private shadowPose: VehiclePose | null = null;
  /** The shadow drawn now (native px), for tests. */
  shadowSize: { w: number; h: number; alpha: number } | null = null;
}
