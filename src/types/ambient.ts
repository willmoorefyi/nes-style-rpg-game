/**
 * Looping field effects of a map (LM-INT): `ambient: [{kind: smoke, x, y, ox, oy}]` in a map source, checked and
 * copied by the map compiler (assets-src/tools/build_hooks.py `ambient`), drawn by
 * src/scenes/exploration/FieldAmbient.ts. The volcano's crater smoke is the first.
 * AR-P2: `flame`, the light of a lit dungeon prop (src/scenes/exploration/flame/): its flame pixels flicker along a
 * 15-bit ramp and a dithered glow lifts the floor round it. The compiler resolves a source's `prop` into the
 * compiled fields below (assets-src/tools/ambient_flame.py).
 */
export const AMBIENT_KINDS = ['smoke', 'flame'] as const;
export type AmbientKind = (typeof AMBIENT_KINDS)[number];

export const FLAME_STYLES = ['fire', 'purple', 'green', 'cyan', 'lamp'] as const;
export type FlameStyleId = (typeof FLAME_STYLES)[number];

/** Art px per map cell of the baked 2x art (`ox` / `oy` are in these px). */
export const AMBIENT_CELL_PX = 48;

export interface SmokeEffect {
  kind: 'smoke';
  /** The map cell the effect rises from. */
  x: number;
  y: number;
  /** Art px inside the cell, 0-47 (default 24: its centre). */
  ox?: number;
  oy?: number;
}

/** The flame pixels of a lit prop: rows of ramp levels '1'-'4' ('.' none), drawn from (dx, dy) art px off the centre. */
export interface FlameMask {
  dx: number;
  dy: number;
  rows: string[];
  /** The top quarter of the flame drops out column by column (a torch's tongue); false for embers and lava. */
  tongue: boolean;
}

export interface FlameEffect {
  kind: 'flame';
  /** The light's centre: its cell and art px inside it. */
  x: number;
  y: number;
  ox?: number;
  oy?: number;
  style: FlameStyleId;
  /** The glow's radius (art px; the ellipse is 1.4 times as wide). */
  glow: number;
  /** The map row characters sort with (the prop's foot): a hero south of it is drawn over the flame. */
  foot: number;
  mask?: FlameMask;
}

export type AmbientEffect = SmokeEffect | FlameEffect;
