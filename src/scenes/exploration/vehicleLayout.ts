import type { VehicleType } from '../../types/index.js';

/**
 * The field vehicles' layout rules (VEH-INT), pure so the tests can pin them: the `vehicles` sheet contract
 * (assets-src/vehicles.py), the draw scale, the bobs, the airship's lift and shadow, and the canoe seat. Lengths are
 * map-native px (48 per tile) unless a name says otherwise; the field draws each one at `TILE_SIZE / 48`.
 */

/** Map-native px per tile: the field art scale is `TILE_SIZE / NATIVE_TILE` (2 for the 2x art, 1 for legacy). */
export const NATIVE_TILE = 48;

/** One packed frame: its box on the sheet, the anchor set on the tile's bottom edge, and its depth-sort row. */
export interface VehicleFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  anchor: [number, number];
  footRow: number;
}

/** How the hero sits in the canoe: the hull rows from `cutRow` down are the near side drawn over the hero, whose
 *  waist row `heroWaist` sits there once the hero is dropped `heroDrop` px. */
export interface CanoeSeat {
  cutRow: number;
  heroWaist: number;
  heroDrop: number;
}

/** assets/sprites/vehicles.json, version 2. */
export interface VehicleSheetMeta {
  version: 2;
  native: number;
  frames: Record<string, VehicleFrame>;
  canoe: CanoeSeat;
  sources?: Partial<Record<VehicleType, 'approved' | 'code'>>;
}

/** Every frame the field draws: the three vehicles, the canoe's near-side layer and its ripple strip. */
export const VEHICLE_FRAMES = ['ship', 'airship', 'canoe', 'canoe_front', 'canoe_ripple'] as const;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Check the sheet json against the contract; throws with the first problem (the field then keeps placeholders). */
export function parseVehicleMeta(raw: unknown): VehicleSheetMeta {
  const m = raw as Partial<VehicleSheetMeta> | null;
  if (!m || m.version !== 2) throw new Error('vehicles.json: expected version 2');
  if (m.native !== NATIVE_TILE) throw new Error(`vehicles.json: native ${String(m.native)}, expected ${NATIVE_TILE}`);
  for (const name of VEHICLE_FRAMES) {
    const f = m.frames?.[name];
    if (!f || ![f.x, f.y, f.w, f.h, f.footRow].every(isNum) || f.w <= 0 || f.h <= 0
      || !Array.isArray(f.anchor) || f.anchor.length !== 2 || !f.anchor.every(isNum)
      || f.footRow < 0 || f.footRow >= f.h) {
      throw new Error(`vehicles.json: frame ${name} is missing or malformed`);
    }
  }
  const c = m.canoe;
  if (!c || ![c.cutRow, c.heroWaist, c.heroDrop].every(isNum)) throw new Error('vehicles.json: no canoe seat');
  return m as VehicleSheetMeta;
}

/** Screen px per map-native px at a tile size. */
export function nativeScale(tileSize: number): number {
  return tileSize / NATIVE_TILE;
}

/** How a vehicle is shown: parked on its cell, or ridden (the airship ridden is flying). */
export type VehiclePose = 'parked' | 'ridden';

/** The slow bobs: `range` native px up from rest over `period` ms (0 = no bob). */
export const BOB: Record<VehicleType, Record<VehiclePose, { range: number; period: number }>> = {
  ship: { parked: { range: 1, period: 1800 }, ridden: { range: 1, period: 1600 } },
  airship: { parked: { range: 0, period: 1 }, ridden: { range: 2, period: 2600 } },
  canoe: { parked: { range: 0, period: 1 }, ridden: { range: 2, period: 2000 } },
};

/** The bob at `tMs`: whole native px lifted, 0 .. range (a sine, rounded so the pixels never blur). */
export function bobPx(type: VehicleType, pose: VehiclePose, tMs: number): number {
  const { range, period } = BOB[type][pose];
  if (range <= 0) return 0;
  return Math.round(((Math.sin((tMs / period) * Math.PI * 2) + 1) / 2) * range);
}

/** The flying airship's height over its cell (native px) and the ease from the ground on take-off (ms). */
export const AIRSHIP_LIFT = 10;
export const TAKEOFF_MS = 400;

/** The airship's lift `msSinceTakeoff` after it was boarded (0 parked). */
export function airshipLift(pose: VehiclePose, msSinceTakeoff: number): number {
  if (pose === 'parked') return 0;
  return Math.round(AIRSHIP_LIFT * Math.min(1, Math.max(0, msSinceTakeoff) / TAKEOFF_MS));
}

/** The airship's shadow ellipse on the ground (native px): wide and soft in flight, tight under the keel parked. */
export function airshipShadow(hullW: number, pose: VehiclePose): { w: number; h: number; alpha: number } {
  return pose === 'ridden'
    ? { w: Math.round(hullW * 0.6), h: 8, alpha: 0.3 }
    : { w: Math.round(hullW * 0.5), h: 4, alpha: 0.35 };
}

/** The canoe seat in screen px for a hull whose bottom edge is at `footY`: the hero's drop and the mask line (the
 *  hero shows above it; the near side covers the row below). */
export function canoeSeat(seat: CanoeSeat, hullH: number, footY: number, k: number): { drop: number; maskY: number } {
  return { drop: seat.heroDrop * k, maskY: footY - (hullH - seat.cutRow - 1) * k };
}

/** A sprite flies above every map layer (the above chunks sit at (map height + 2) tiles). */
export const FLYING_Z = 10_000_000;
