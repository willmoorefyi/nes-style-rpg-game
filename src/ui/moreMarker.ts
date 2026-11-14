import { Graphics } from 'pixi.js';

/** Height of the drawn ▼ relative to its width (28 x 20 at the default size). */
const HEIGHT_RATIO = 20 / 28;
const OUTLINE = 2;

/**
 * The dialog's "more follows" marker (U22): a drawn down-triangle, `size` px wide and 20/28 of that tall, white
 * with a 2 px dark outline. Its origin is the top-left of the triangle's box, so it is placed like a glyph.
 */
export function createMoreMarker(size = 28): Graphics {
  const h = Math.round(size * HEIGHT_RATIO);
  const g = new Graphics();
  g.poly([0, 0, size, 0, size / 2, h]);
  g.fill(0xffffff);
  g.stroke({ width: OUTLINE, color: 0x101018, alignment: 1 });
  return g;
}
