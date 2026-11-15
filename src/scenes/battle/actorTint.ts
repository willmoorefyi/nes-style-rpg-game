import type { Container } from 'pixi.js';

/**
 * One multiplying tint per actor sprite (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 9). Each named source holds one
 * colour; `sprite.tint` is the channel-wise product of all of them (white with none), so clearing one source never
 * wipes another (the active-hero pulse, the placeholder dead grey, a heavy-attack pulse, status tints).
 */
export type TintSource = 'hero' | 'pulse' | 'status' | 'dead';

const WHITE = 0xffffff;
const sources = new WeakMap<Container, Map<TintSource, number>>();

/** Channel-wise product of two 0xRRGGBB colours. */
export function multiplyTint(a: number, b: number): number {
  const ch = (shift: number) => Math.round((((a >> shift) & 0xff) * ((b >> shift) & 0xff)) / 0xff);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Set (rgb) or clear (null) `source`'s colour on `sprite` and apply the product. */
export function setTint(sprite: Container, source: TintSource, rgb: number | null): void {
  let map = sources.get(sprite);
  if (!map) {
    map = new Map();
    sources.set(sprite, map);
  }
  if (rgb === null) map.delete(source); else map.set(source, rgb);
  sprite.tint = combinedTint(sprite);
}

/** The product of every source on `sprite` (white with none). */
export function combinedTint(sprite: Container): number {
  let tint = WHITE;
  for (const rgb of sources.get(sprite)?.values() ?? []) tint = multiplyTint(tint, rgb);
  return tint;
}

/** The colour `source` holds on `sprite`, or null. */
export function tintOf(sprite: Container, source: TintSource): number | null {
  return sources.get(sprite)?.get(source) ?? null;
}
