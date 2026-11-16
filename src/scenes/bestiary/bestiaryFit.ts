/**
 * Where the bestiary preview puts its lone enemy (docs/REDESIGN_PLAN.md 1, TS-1). The enemy is built as a lone battle
 * enemy (AiEnemyView, unchanged); the preview then moves its actors container so that the idle figure's opaque box
 * (`idleBox`, FW-A2) is centred on the panel's inner rect, in whole px. Every reach rule is computed in the actors'
 * local space before the shift, so the shift is bounded on two sides:
 * - reach (12d): the in-place attack's art edge (local `inPlaceRight`) may not end past the inner right - ART_MARGIN
 *   on screen, so the shift right is at most `limitRight - inPlaceRight` (the old `min(0, ...)` clamp);
 * - plain: the feet line stays on the background's battle plain (BESTIARY_PLAIN, docs/ART_BATTLE_PLAN.md).
 * Without an idle box (hand-built frames, no atlas field and no browser to measure it) the old placement holds:
 * no centring, only the reach clamp.
 */
import type { MonsterFrames } from '../../rendering/BattleArt.js';

/** The background's battle plain (screen y): the feet line stays inside it. */
export const BESTIARY_PLAIN = { min: 360, max: 770 } as const;

export interface PanelRect { left: number; top: number; right: number; bottom: number }

export interface FitInput {
  /** The sprite's local position (its home in the actors container) and its screen px per art px. */
  x: number;
  y: number;
  scale: number;
  /** The local right edge of the in-place attack's art and the screen x it may not pass. */
  inPlaceRight: number;
  limitRight: number;
}

export interface Fit {
  dx: number;
  dy: number;
  /** Which clamp bound the shift (empty: the figure is centred). */
  bound: ('reach' | 'plain')[];
}

/** The panel's centre (screen px). */
export const panelCentre = (r: PanelRect): [number, number] => [(r.left + r.right) / 2, (r.top + r.bottom) / 2];

/** The idle figure's screen box [l, t, r, b) at a sprite position and scale (idleBox is inclusive art px). */
export function figureBox(f: Pick<MonsterFrames, 'idleBox'>, x: number, y: number, scale: number):
  [number, number, number, number] | null {
  const b = f.idleBox;
  return b ? [x + b[0] * scale, y + b[1] * scale, x + (b[2] + 1) * scale, y + (b[3] + 1) * scale] : null;
}

/** The actors container's shift that centres the idle figure in `panel`, within the reach and plain clamps. */
export function fitShift(f: Pick<MonsterFrames, 'idleBox' | 'footRow'>, panel: PanelRect, p: FitInput): Fit {
  const maxDx = Math.floor(p.limitRight - p.inPlaceRight);
  const box = figureBox(f, p.x, p.y, p.scale);
  if (!box) return { dx: Math.min(0, maxDx), dy: 0, bound: maxDx < 0 ? ['reach'] : [] };
  const [cx, cy] = panelCentre(panel);
  const bound: Fit['bound'] = [];
  let dx = Math.round(cx - (box[0] + box[2]) / 2);
  if (dx > maxDx) { dx = maxDx; bound.push('reach'); }
  let dy = Math.round(cy - (box[1] + box[3]) / 2);
  const feet = p.y + (f.footRow + 1) * p.scale;
  if (feet + dy > BESTIARY_PLAIN.max) { dy = BESTIARY_PLAIN.max - feet; bound.push('plain'); }
  if (feet + dy < BESTIARY_PLAIN.min) { dy = BESTIARY_PLAIN.min - feet; bound.push('plain'); }
  return { dx, dy, bound };
}

/** The backdrop's position: scaled to cover the screen, its horizontal centre on the panel's (D-V8), vertical
 *  placement as before (centred on the screen, so the battle plain stays at y 360-770). */
export function backdropPosition(texW: number, texH: number, scale: number, panel: PanelRect, screenH: number):
  [number, number] {
  return [panelCentre(panel)[0] - (texW * scale) / 2, (screenH - texH * scale) / 2];
}
