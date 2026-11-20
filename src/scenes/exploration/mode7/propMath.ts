/**
 * The flight view's upright billboards (docs/MODE7_PLAN.md 5, M7-5): the parked vehicles and the world-map NPCs, read
 * from the sprites the top-down field already draws, then stood up at `cellToScreen` of their ground point, scaled by
 * that row's px per cell, depth-sorted and culled beyond `PROP_RANGE` cells. Pure: no PixiJS at runtime (the sprites
 * are only read through their types), so the placement is unit-tested on plain objects.
 *
 * A billboard keeps the field sprite's texture, anchor, flip and tint. Its anchor point keeps its offset from the
 * ground point, scaled by the same factor `m = px per cell / TILE_SIZE`: at a tilt's start (looking straight down,
 * `m` 1) every billboard lands exactly where the top-down field drew its sprite.
 */
import type { Container, Sprite } from 'pixi.js';
import { TILE_SIZE } from '../../../core/LayoutConstants.js';
import { SCREEN_H, SCREEN_W, cellToScreen, type ViewParams } from './mode7Math.js';

/** Billboards farther than this from the ship's position P (cells, on the ground) are culled (5). */
export const PROP_RANGE = 40;
/** The last cells before the cull fade out, so a billboard never pops at the range. */
export const PROP_FADE = 4;

/** What a billboard reads of a field sprite (a Pixi `Sprite` in the game; plain objects in the tests). */
export type PropSprite = Pick<Sprite, 'texture' | 'anchor' | 'scale' | 'x' | 'y' | 'tint' | 'visible'>;

/** An NPC of the field (only its sprite is read). */
export interface PropNpc { readonly sprite: PropSprite }

/** One billboard to draw: the field sprite and its ground point (cells). */
export interface PropSource {
  sprite: PropSprite;
  gx: number;
  gy: number;
}

/** The labels of the field's vehicle sprites that stand up as billboards: every parked vehicle part but the airship's
 *  (the flying airship is the view's own screen-fixed hull; a parked one shows only after a landing's tilt). */
const isParkedPart = (label: string): boolean => label.startsWith('vehicle:') && !label.startsWith('vehicle:airship')
  && label !== 'vehicle:canoe_mask';

const isSprite = (c: object): c is PropSprite => 'texture' in c && 'anchor' in c;

/** The field sprite's drawn size (world px) and its box's left / top edges around its anchor. */
function box(s: PropSprite): { w: number; h: number; left: number; top: number } {
  const w = s.texture.frame.width * Math.abs(s.scale.x);
  const h = s.texture.frame.height * Math.abs(s.scale.y);
  const ax = s.scale.x < 0 ? 1 - s.anchor.x : s.anchor.x;
  return { w, h, left: s.x - ax * w, top: s.y - s.anchor.y * h };
}

/**
 * The billboards of this frame, from the top-down world: the parked vehicles (sprites labelled `vehicle:*`, their
 * anchor on the cell's bottom edge, lifted by at most their bob: the ground row is the nearest cell edge) and the
 * NPCs (anchor top-left; the ground point is the bottom centre of the sprite, so a wanderer slides between cells).
 */
export function propSources(world: Pick<Container, 'children'>, npcs: readonly PropNpc[] = []): PropSource[] {
  const out: PropSource[] = [];
  for (const c of world.children) {
    if (!isParkedPart(c.label ?? '') || !c.visible || !isSprite(c)) continue;
    const s = c;
    out.push({ sprite: s, gx: s.x / TILE_SIZE, gy: Math.round(s.y / TILE_SIZE) });
  }
  for (const n of npcs) {
    const s = n.sprite;
    if (!s.visible) continue;
    const b = box(s);
    out.push({ sprite: s, gx: (b.left + b.w / 2) / TILE_SIZE, gy: (b.top + b.h) / TILE_SIZE });
  }
  return out;
}

/** How one billboard is drawn: its anchor point on screen, its scale factor, its alpha and its depth key. */
export interface PropPlacement {
  x: number;
  y: number;
  /** The factor on the field sprite's scale (`px per cell / TILE_SIZE`). */
  m: number;
  alpha: number;
  /** Px per cell at the ground point: larger is nearer, so it sorts in front (the zIndex). */
  depth: number;
  /** Ground distance from P, cells. */
  dist: number;
}

export interface Fog { rows: number; alpha: number }

/** The fog's alpha at screen row `y` (2.5): `fog.alpha` at the horizon, 0 from `fog.rows` below it. */
export function fogAt(y: number, horizon: number, fog: Fog): number {
  if (!Number.isFinite(horizon)) return 0;
  return fog.alpha * Math.min(1, Math.max(0, 1 - (y - horizon) / fog.rows));
}

/**
 * Place one billboard, or null when it is culled: behind the camera, beyond `PROP_RANGE` cells of P, or with its whole
 * box off the screen. Its alpha fades over the last `PROP_FADE` cells and through the fog under the horizon, so it
 * hazes like the ground it stands on.
 */
export function placeProp(view: ViewParams, src: PropSource, horizon = -Infinity,
  fog: Fog = { rows: 1, alpha: 0 }): PropPlacement | null {
  const dist = Math.hypot(src.gx - view.px, src.gy - view.py);
  if (dist > PROP_RANGE) return null;
  const p = cellToScreen(view, src.gx, src.gy);
  if (!p) return null;
  const m = p.scale / TILE_SIZE;
  const s = src.sprite;
  const x = p.x + (s.x - src.gx * TILE_SIZE) * m;
  const y = p.y + (s.y - src.gy * TILE_SIZE) * m;
  const b = box(s);
  const left = x + (b.left - s.x) * m;
  const top = y + (b.top - s.y) * m;
  if (left > SCREEN_W || left + b.w * m < 0 || top > SCREEN_H || top + b.h * m < 0) return null;
  const fade = Math.min(1, (PROP_RANGE - dist) / PROP_FADE);
  return { x, y, m, alpha: fade * (1 - fogAt(p.y, horizon, fog)), depth: p.scale, dist };
}

/** Every billboard placed this frame, far to near (the draw order; the container also sorts by `depth`). */
export function placeProps(view: ViewParams, sources: readonly PropSource[], horizon = -Infinity,
  fog?: Fog): Array<{ src: PropSource; at: PropPlacement }> {
  const out: Array<{ src: PropSource; at: PropPlacement }> = [];
  for (const src of sources) {
    const at = placeProp(view, src, horizon, fog);
    if (at) out.push({ src, at });
  }
  return out.sort((a, b) => a.at.depth - b.at.depth);
}
