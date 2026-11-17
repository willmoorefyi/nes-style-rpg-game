/**
 * The proxy registry (docs/CHAOS_FORMS_PLAN.md 4.4, R15). After the swap a colossus enemy's slot in `enemySprites`
 * holds an invisible proxy Container at the form's target rect, so code that reads "the enemy sprite" (bounds, x / y)
 * lands inside the field. The consumers that need more than the box (numbers at `core`, the bracket cursor, the icon
 * row at `head`, the effect box, the slash and the melee point at `melee`, the element flash routed to the per-layer
 * white flash) ask `colossusAt(sprite)`. Every point is in the battle layers' local space (the colossus, actors and
 * fx layers shake together, so their local spaces agree).
 */
import type { Container } from 'pixi.js';
import { bodyBox } from '../fx/emitterCore.js';
import type { StatusAnchor } from '../fx/statusEmitters.js';
import { COLOSSUS_ROW_PX, colossusRowTop } from '../fx/statusIcons.js';
import type { Offset } from './colossusIndex.js';

export interface Rect { x: number; y: number; width: number; height: number }

export interface ColossusAnchorSource {
  anchors(): Record<'target' | 'core' | 'head' | 'melee' | 'feet', Offset> & { hands: [Offset, Offset] };
  /** The target rect in screen px (the proxy's box and the cursor bracket). */
  targetBox(): Rect;
  /** A synthetic 420x360 body box centred on `core`: what spell effects take as the target's bounds. */
  effectBox(): Rect;
  /** The 360 px box at `melee` the hero's slash is drawn in (0.45 x 360 strokes, as a big box gets today). */
  slashBox(): Rect;
  /** The per-layer white flash for 4 frames (the element flash of a spell hit). */
  flashWhite(): void;
  readonly flashing: boolean;
}

const registry = new WeakMap<Container, ColossusAnchorSource>();

export function registerProxy(proxy: Container, source: ColossusAnchorSource): void { registry.set(proxy, source); }
export function unregisterProxy(proxy: Container): void { registry.delete(proxy); }

/** The colossus behind `sprite` (a proxy), or null for an ordinary sprite. */
export function colossusAt(sprite: Container | null | undefined): ColossusAnchorSource | null {
  return sprite ? registry.get(sprite) ?? null : null;
}

/** EFFECT_BOX: the synthetic body box (screen px). */
export const EFFECT_BOX = { w: 420, h: 360 } as const;
export const SLASH_BOX = 360;

/** The status overlays' anchor on a colossus: the head anchor and the effect box's body (statusFx's anchorOf); the
 *  blind cloud goes beside the plated icon row, outside the core (effect) box (C6-6). */
export function colossusStatusAnchor(c: ColossusAnchorSource): StatusAnchor {
  const head = c.anchors().head;
  const e = c.effectBox();
  return { head, box: bodyBox(e), facing: 1, beside: { y: colossusRowTop(head.y) + COLOSSUS_ROW_PX / 2, left: e.x, right: e.x + e.width } };
}
