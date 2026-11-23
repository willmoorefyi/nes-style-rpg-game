/**
 * WR (docs/WORLD_WRAP_PLAN.md 5, 10, D-WR-10): WrapImages moves each world child to its image nearest the camera
 * from its bounds; restore puts every child back; the layer sentinels keep the sort order of a shifted image.
 */
import { describe, it, expect } from 'vitest';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { WrapImages } from '../../src/rendering/wrapImages.js';
import { WRAP_ABOVE_Z, WRAP_BELOW_Z, aboveZIndex } from '../../src/rendering/BakedMapRenderer.js';

const P = { x: 1000, y: 800 };
const view = (x: number, y: number) => ({ x, y, width: 200, height: 100 });

function sprite(x: number, y: number, z = y): Sprite {
  const s = new Sprite(Texture.WHITE);
  s.width = 10;
  s.height = 10;
  s.position.set(x, y);
  s.zIndex = z;
  return s;
}

describe('WrapImages', () => {
  it('takes k from the bounds and restore returns every child', () => {
    const world = new Container();
    const near = sprite(950, 400);
    const far = sprite(20, 400);     // the camera's centre is x 1000: its image at 1020 is nearer
    world.addChild(near, far);
    const w = new WrapImages();
    w.apply(world, view(900, 350), P, () => false);
    expect([near.x, far.x]).toEqual([950, 1020]);
    expect(w.count).toBe(1);
    w.restore();
    expect([near.x, far.x]).toEqual([950, 20]);
  });

  it('a Graphics drawn at absolute coordinates with x 0 is moved by its bounds, not its x', () => {
    const world = new Container();
    const g = new Graphics().rect(960, 400, 20, 20).fill(0xffffff);
    world.addChild(g);
    const w = new WrapImages();
    w.apply(world, view(-100, 350), P, () => false);   // centre x 0: the drawn rect's image is at -40
    expect(g.x).toBe(-1000);
    w.apply(world, view(900, 350), P, () => false);    // apply restores first: the rect is in view as drawn
    expect(g.x).toBe(0);
  });

  it('skips the skipped children; a flat map (period 0) is a no-op', () => {
    const world = new Container();
    const s = sprite(20, 400);
    world.addChild(s);
    const w = new WrapImages();
    w.apply(world, view(900, 350), P, (c) => c === s);
    expect(s.x).toBe(20);
    w.apply(world, view(900, 350), { x: 0, y: 0 }, () => false);
    expect(s.x).toBe(20);
    expect(w.count).toBe(0);
  });

  it('D-WR-10: an NPC shifted by -H still sorts between the sentinel layers; the smoke and a flying part keep their z', () => {
    const world = new Container();
    world.sortableChildren = true;
    const below = new Container();
    below.zIndex = WRAP_BELOW_Z;
    const above = new Container();
    above.zIndex = aboveZIndex({ height: 256, wrap: true });
    expect(above.zIndex).toBe(WRAP_ABOVE_Z);
    const npc = sprite(500, 790);                       // near the bottom; the camera sits at the top (y 0)
    const smoke = sprite(500, 780, WRAP_ABOVE_Z + 1);
    const flying = sprite(500, 770, 10_000_000);
    world.addChild(below, above, npc, smoke, flying);
    const w = new WrapImages();
    w.apply(world, view(450, -50), P, (c) => c === below || c === above);
    expect(npc.y).toBe(790 - 800);
    expect(npc.zIndex).toBe(790 - 800);
    expect(npc.zIndex).toBeGreaterThan(below.zIndex);
    expect(npc.zIndex).toBeLessThan(above.zIndex);
    expect([smoke.zIndex, flying.zIndex]).toEqual([WRAP_ABOVE_Z + 1, 10_000_000]);
    w.restore();
    expect(npc.zIndex).toBe(790);
  });

  it('a flat map keeps today\'s layer z: -1 and (H + 2) x TILE_SIZE', () => {
    expect(aboveZIndex({ height: 30 })).toBe(aboveZIndex({ height: 30, wrap: false }));
    expect(aboveZIndex({ height: 30 })).toBeLessThan(WRAP_ABOVE_Z);
  });
});
