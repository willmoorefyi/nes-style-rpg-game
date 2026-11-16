/**
 * The target cursor on a colossus (docs/CHAOS_FORMS_PLAN.md 4.4): the arrow points at the `target` anchor, a pulsing
 * corner bracket frames the target rect (an outline of the whole form would be off-screen), the icon row sits at the
 * `head` anchor and the label stays below the message window (y >= 124). BattleFieldTargeting branches here. The
 * bracket is clamped into the field (x 0..1900, y 140..760): the rev-4 F3 target rect starts at y 135, under the
 * message window's edge (18.4).
 */
import type { Container, Graphics } from 'pixi.js';
import { enemyIconRowTop } from '../fx/statusIcons.js';
import { colossusAt } from './colossusProxy.js';

/** The label's top row on a colossus: 4 px under the message window. */
export const LABEL_MIN_Y = 124;
const ARM = 28;
/** The bracket (its 4 px stroke and corner miters included) stays inside the field rows the numbers and icons use. */
const BRACKET_FIELD = { x0: 4, x1: 1896, y0: 144, y1: 756 } as const;
const ARROW_TIP: [number, number] = [8, 12];

/** The arrow's position so its tip touches the target anchor, or null for an ordinary sprite. */
export function colossusArrowAt(sprite: Container): [number, number] | null {
  const t = colossusAt(sprite)?.anchors().target;
  return t ? [t.x - ARROW_TIP[0], t.y - ARROW_TIP[1] - 4] : null;
}

/** The highest the target label may go: below the message window on a colossus, the screen top otherwise. */
export const labelFloor = (sprite: Container): number => (colossusAt(sprite) ? LABEL_MIN_Y : 0);

/** The icon row's top at the head anchor, or null for an ordinary sprite. */
export function colossusIconRowTop(sprite: Container): number | null {
  const c = colossusAt(sprite);
  return c ? enemyIconRowTop(c.anchors().head.y) : null;
}

/** Draw the corner bracket around a colossus's target rect into `g` (true), or leave `g` alone (false). */
export function drawColossusBracket(g: Graphics, sprite: Container): boolean {
  const c = colossusAt(sprite);
  if (!c) return false;
  const r = c.targetBox();
  const [x0, y0, x1, y1] = [Math.max(BRACKET_FIELD.x0, r.x - 6), Math.max(BRACKET_FIELD.y0, r.y - 6),
    Math.min(BRACKET_FIELD.x1, r.x + r.width + 6), Math.min(BRACKET_FIELD.y1, r.y + r.height + 6)];
  for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    g.moveTo(x + dx * ARM, y).lineTo(x, y).lineTo(x, y + dy * ARM);
  }
  g.stroke({ width: 4, color: 0xffffff });
  g.position.set(0, 0);
  return true;
}
