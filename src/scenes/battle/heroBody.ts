/**
 * Pass CL (docs/CLASS_LANCE_PLAN.md 7.2): where a party sprite's body is. An oversize hero (the lance pair: a 160 x 144
 * cell whose body is drawn in an 80 x 80 box, the lance overhanging up and to the left) registers its body box here;
 * everything placed on a hero (target outline and arrows, numbers, status icons, effects, an enemy's run) reads it
 * through these helpers, so it lines up with the body, not the cell. An unregistered sprite (an enemy, a placeholder, an
 * 80 x 80 hero) answers exactly what the call sites read before (its x / y / width / height, its bounds).
 * Names chosen apart from fx/emitterCore.bodyBox (the fx box inside a rect), which still applies on top.
 */
import type { Container } from 'pixi.js';
import type { CellRect } from '../../rendering/battleAtlasPages.js';
import { BATTLE_MESSAGE_HEIGHT } from './BattleSceneTypes.js';

interface HeroBody { body: CellRect; scale: number; reach: number; top: number }

const bodies = new WeakMap<Container, HeroBody>();

export interface HeroBox { x: number; y: number; width: number; height: number }

/** Register `sprite`'s body box (native cell px) and the art scale (texture px per native px). */
export function setHeroBody(sprite: Container, art: { body?: CellRect; scale: number; reach?: number; top?: number }): void {
  if (art.body) bodies.set(sprite, { body: art.body, scale: art.scale, reach: art.reach ?? 0, top: art.top ?? 0 });
}

export function hasHeroBody(sprite: Container): boolean {
  return bodies.has(sprite);
}

/** The body box in the sprite's local (texture) px, or null for an unregistered sprite. */
export function heroLocalBox(sprite: Container): HeroBox | null {
  const h = bodies.get(sprite);
  if (!h) return null;
  return { x: h.body.x * h.scale, y: h.body.y * h.scale, width: h.body.w * h.scale, height: h.body.h * h.scale };
}

/** The body box in the sprite's parent space, read as the call sites read `sprite.x / y / width / height` (the
 *  position and the scale; the shake / tremble pivot is left out, as those reads leave it out); an unregistered
 *  sprite: exactly those values. */
export function heroRect(sprite: Container): HeroBox {
  const b = heroLocalBox(sprite);
  if (!b) return { x: sprite.x, y: sprite.y, width: sprite.width, height: sprite.height };
  const sx = sprite.scale.x || 1;
  const sy = sprite.scale.y || 1;
  return { x: sprite.x + b.x * sx, y: sprite.y + b.y * sy, width: b.width * sx, height: b.height * sy };
}

/** The figure's top-left as the call sites used `sprite.x` / `sprite.y` (the arrows, a number's start row). */
export function heroAnchor(sprite: Container): { x: number; y: number } {
  const r = heroRect(sprite);
  return { x: r.x, y: r.y };
}

/** The body box in global space, the `getBounds()` replacement (an unregistered sprite: its bounds). */
export function heroBounds(sprite: Container): HeroBox {
  const b = heroLocalBox(sprite);
  if (!b) {
    const g = sprite.getBounds();
    return { x: g.x, y: g.y, width: g.width, height: g.height };
  }
  const tl = sprite.toGlobal({ x: b.x, y: b.y });
  const br = sprite.toGlobal({ x: b.x + b.width, y: b.y + b.height });
  return { x: Math.min(tl.x, br.x), y: Math.min(tl.y, br.y), width: Math.abs(br.x - tl.x), height: Math.abs(br.y - tl.y) };
}

/** The body box in the sprite's local space, the `getLocalBounds()` replacement. */
export function heroLocalBounds(sprite: Container): HeroBox {
  const b = heroLocalBox(sprite);
  if (b) return b;
  const l = sprite.getLocalBounds();
  return { x: l.x, y: l.y, width: l.width, height: l.height };
}

/** D-CL12: the lunge's lead, in the parent space: the attack frame's leftmost opaque column of an oversize hero (its
 *  spear point), else the sprite's left edge. */
export function heroLead(sprite: Container): number {
  const h = bodies.get(sprite);
  return h ? sprite.x + h.reach * h.scale * (sprite.scale.x || 1) : sprite.x;
}

/** 7.6: the highest y (parent space) the sprite's top-left may take so its topmost opaque row stays at or below
 *  `limit` (the message window's bottom); -Infinity for an unregistered sprite (no clamp: today's motion). */
export function heroMinY(sprite: Container, limit: number): number {
  const h = bodies.get(sprite);
  return h ? limit - h.top * h.scale * (sprite.scale.y || 1) : -Infinity;
}

/** 7.6: a lunge / cast placement y, clamped so an oversize hero's lance stays under the message window. */
export function clampHeroY(sprite: Container, y: number): number {
  return Math.max(y, heroMinY(sprite, BATTLE_MESSAGE_HEIGHT));
}
