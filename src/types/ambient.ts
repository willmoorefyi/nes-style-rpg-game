/**
 * Looping field effects of a map (LM-INT): `ambient: [{kind: smoke, x, y, ox, oy}]` in a map source, checked and
 * copied by the map compiler (assets-src/tools/build_hooks.py `ambient`), drawn by
 * src/scenes/exploration/FieldAmbient.ts. The volcano's crater smoke is the first; chimneys may follow.
 */
export const AMBIENT_KINDS = ['smoke'] as const;
export type AmbientKind = (typeof AMBIENT_KINDS)[number];

/** Art px per map cell of the baked 2x art (`ox` / `oy` are in these px). */
export const AMBIENT_CELL_PX = 48;

export interface AmbientEffect {
  kind: AmbientKind;
  /** The map cell the effect rises from. */
  x: number;
  y: number;
  /** Art px inside the cell, 0-47 (default 24: its centre). */
  ox?: number;
  oy?: number;
}
