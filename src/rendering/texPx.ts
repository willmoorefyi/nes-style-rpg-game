/**
 * Art px -> texture px of a hi-res monster sheet (docs/ENEMY_FEEDBACK_PLAN.md EF-A4; int-ef2: texScale may be any
 * multiple of 0.05 in [2, 3.5]). A float product can miss a whole number (10 x 2.7 is 27.000000000000004), so:
 * positions are whole by construction (the atlas places every frame on a multiple of its sheet's unit) and are rounded;
 * lengths are ceil(v x ts) as the atlas builder computes them exactly (monster_hires.ceil_mul); texture px back to art
 * px floor exactly.
 */
const EPS = 1e-6;
/** monster_hires.SAMPLE_OFFSET: texture px t samples native px floor((t + 0.4) / ts) (Scale2x + nearest). */
const SAMPLE_OFFSET = 0.4;

/** A frame's texture position: x * ts, a whole number by construction. */
export const texPos = (v: number, ts: number): number => Math.round(v * ts);
/** A cell's texture length: ceil(v * ts), exact. */
export const texLen = (v: number, ts: number): number => Math.ceil(v * ts - EPS);
/** The art px a texture px was sampled from: floor((px + 0.4) / ts) (= floor(px / ts) at ts 1, 2, 2.5 and 3; at
 *  2.7, 2.8 or 3.3 the first texture row of an art row can start just under its art row's top, 50 / 2.8 = 17.86). */
export const artFloor = (px: number, ts: number): number => (ts === 1 ? px : Math.floor((px + SAMPLE_OFFSET) / ts + EPS));
/** The art px of a run's last texture px (a box's right or bottom edge): the art px its start lies in, floor(px / ts).
 *  The same as artFloor for every texture px but the feet guard's row (monster_hires.upscale: the last texture row
 *  ceil((footRow + 1) ts) - 1, re-sampled from the foot row: 332 / 2.7 = 122.96, the sea troll's foot row 122). */
export const artFloorEnd = (px: number, ts: number): number => Math.floor(px / ts + EPS);
