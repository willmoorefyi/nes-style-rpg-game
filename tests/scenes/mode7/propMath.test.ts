/**
 * M7-5's billboards, pure (docs/MODE7_PLAN.md 5, 9 "unit projection"): the parked vehicles and the world-map NPCs are
 * read from the field's sprites, stood up at `cellToScreen` of their ground point, scaled by that row's px per cell,
 * depth-sorted against P and culled beyond 40 cells; at a tilt's start they land exactly where the top-down field drew
 * them.
 */
import { describe, expect, it } from 'vitest';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { TILE_SIZE } from '../../../src/core/LayoutConstants.js';
import { Camera } from '../../../src/rendering/Camera.js';
import { HUD_BOTTOM_BAND } from '../../../src/ui/FieldHUD.js';
import { FLIGHT_VIEW, tiltParams } from '../../../src/scenes/exploration/mode7/mode7Tilt.js';
import { cellToScreen, horizonY, type ViewParams } from '../../../src/scenes/exploration/mode7/mode7Math.js';
import {
  PROP_FADE, PROP_RANGE, fogAt, placeProp, placeProps, propSources, type PropSource, type PropSprite,
} from '../../../src/scenes/exploration/mode7/propMath.js';

const TS = TILE_SIZE;
const flight = (px: number, py: number): ViewParams => ({ ...FLIGHT_VIEW, px, py });

/** A field-like sprite drawn w x h px at (x, y) with an anchor (the 1x1 white texture, scaled). */
function sprite(x: number, y: number, w: number, h: number, anchor = [0, 0]): PropSprite {
  const s = new Sprite(Texture.WHITE);
  s.anchor.set(anchor[0], anchor[1]);
  s.scale.set(w / Texture.WHITE.frame.width, h / Texture.WHITE.frame.height);
  s.position.set(x, y);
  return s;
}

/** A parked ship's hull: anchor on its cell's bottom edge, centred. */
const ship = (cx: number, cy: number): PropSource =>
  ({ sprite: sprite((cx + 0.5) * TS, (cy + 1) * TS, 2 * TS, 1.5 * TS, [0.5, 0.9]), gx: cx + 0.5, gy: cy + 1 });

describe('M7-5: propSources reads the field', () => {
  it('stands up the parked vehicles (not the airship, not the canoe mask) and the visible NPCs', () => {
    const world = new Container();
    const hull = new Sprite(Texture.WHITE);
    hull.label = 'vehicle:ship';
    hull.position.set(10.5 * TS, 7 * TS - 2);   // lifted 2 px by its bob
    const flying = new Sprite(Texture.WHITE);
    flying.label = 'vehicle:airship';
    const mask = new Graphics();
    mask.label = 'vehicle:canoe_mask';
    const hidden = new Sprite(Texture.WHITE);
    hidden.label = 'vehicle:canoe';
    hidden.visible = false;
    const tiles = new Container();
    world.addChild(tiles, hull, flying, mask, hidden);
    const npc = new Sprite(Texture.WHITE);   // 1x1: scale it to a cell wide, two tall
    npc.scale.set(TS / Texture.WHITE.frame.width, (2 * TS) / Texture.WHITE.frame.height);
    npc.position.set(4 * TS, 9 * TS - TS);   // lifted a tile: its feet on cell (4, 9)'s bottom edge
    const gone = new Sprite(Texture.WHITE);
    gone.visible = false;
    const out = propSources(world, [{ sprite: npc }, { sprite: gone }]);
    expect(out.map((s) => s.sprite)).toEqual([hull, npc]);
    expect(out[0]).toMatchObject({ gx: 10.5, gy: 7 });
    expect(out[1].gx).toBeCloseTo(4.5, 9);
    expect(out[1].gy).toBeCloseTo(10, 9);
  });

  it('a mirrored sprite keeps its ground point', () => {
    const world = new Container();
    const npc = new Sprite(Texture.WHITE);
    npc.scale.set(-TS / Texture.WHITE.frame.width, TS / Texture.WHITE.frame.height);
    npc.anchor.set(0, 0);
    npc.position.set(5 * TS, 3 * TS);   // mirrored about its left edge: it spans x 4..5 cells
    expect(propSources(world, [{ sprite: npc }])[0]).toMatchObject({ gx: 4.5, gy: 4 });
  });
});

describe('M7-5: placeProp', () => {
  it('at a tilt\'s start (t 0) every billboard is where the top-down camera draws its sprite, at scale 1', () => {
    const world = new Container();
    const cam = new Camera(world);
    cam.setMapBounds(192 * TS, 192 * TS);
    cam.setViewInsets({ bottom: HUD_BOTTOM_BAND });
    for (const [hx, hy] of [[96, 96], [1, 1], [190, 189]]) {
      const hero = { x: (hx + 0.5) * TS, y: (hy + 0.5) * TS };
      cam.follow(hero);
      cam.update();
      const anchor = cam.worldToScreen(hero.x, hero.y);
      const view = { ...tiltParams(0, { anchor, ship: anchor }, TS).view, px: hero.x / TS, py: hero.y / TS };
      for (const src of [ship(hx + 2, hy - 3), ship(hx - 4, hy + 1)]) {
        const at = placeProp(view, src);
        const top = cam.worldToScreen(src.sprite.x, src.sprite.y);
        if (!at) continue;   // off screen by a corner
        expect(at.m).toBeCloseTo(1, 9);
        expect(Math.abs(at.x - top.x)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(at.y - top.y)).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('in flight it stands on its ground point, scaled by that row\'s px per cell', () => {
    const v = flight(100.5, 100.5);
    const src = ship(102, 90);
    const g = cellToScreen(v, src.gx, src.gy)!;
    const at = placeProp(v, src)!;
    expect(at.m).toBeCloseTo(g.scale / TS, 9);
    // the anchor sits on the ground point (its offset from it is 0 here): the foot is the projected point
    expect(at.x).toBeCloseTo(g.x, 9);
    expect(at.y).toBeCloseTo(g.y, 9);
    // an offset from the ground point scales with it: an NPC lifted a tile is drawn m tiles up
    const npc: PropSource = { sprite: sprite(102 * TS, 90 * TS, TS, 2 * TS), gx: 102.5, gy: 92 };
    const n = placeProp(v, npc)!;
    const ng = cellToScreen(v, 102.5, 92)!;
    expect(n.y).toBeCloseTo(ng.y - 2 * TS * n.m, 6);
    expect(n.x).toBeCloseTo(ng.x - 0.5 * TS * n.m, 6);
  });

  it('nearer than P sorts in front of the airship, farther behind it', () => {
    const v = flight(50.5, 50.5);
    const pDepth = cellToScreen(v, v.px, v.py)!.scale;
    const ahead = placeProp(v, ship(50, 45))!;     // 4.5 cells north: farther
    const under = placeProp(v, ship(50, 50))!;     // on P's cell: its bottom edge lies half a cell south
    const behind = placeProp(v, ship(50, 52))!;    // south: nearer the camera
    expect(ahead.depth).toBeLessThan(pDepth);
    expect(under.depth).toBeGreaterThan(pDepth);
    expect(behind.depth).toBeGreaterThan(under.depth);
    const order = placeProps(v, [ship(50, 52), ship(50, 45), ship(50, 50)]).map((p) => p.src.gy);
    expect(order).toEqual([46, 51, 53]);   // far to near
  });

  it(`culls beyond ${PROP_RANGE} cells, fading over the last ${PROP_FADE}`, () => {
    const v = flight(100.5, 120.5);
    const at = (dy: number) => {
      const gy = 120.5 - dy;
      return placeProp(v, { sprite: sprite(100.5 * TS, gy * TS, TS, TS, [0.5, 1]), gx: 100.5, gy });
    };
    expect(at(PROP_RANGE + 0.01)).toBeNull();
    expect(at(PROP_RANGE - PROP_FADE / 2)?.alpha).toBeCloseTo(0.5, 9);
    expect(at(PROP_RANGE - PROP_FADE)?.alpha).toBe(1);
    expect(at(10)?.alpha).toBe(1);
    // every billboard in range is under the horizon: the range ends before the ground curves away
    expect(cellToScreen(v, 100.5, 120.5 - PROP_RANGE)!.y).toBeGreaterThan(horizonY(v));
  });

  it('culls a billboard wholly off the screen or behind the camera, keeps one partly on', () => {
    const v = flight(100.5, 100.5);
    expect(placeProp(v, ship(70, 100))).toBeNull();                 // 30 cells west on P's row: off the left edge
    expect(placeProp(v, ship(100, 115))).toBeNull();                // behind the camera (back 11.3)
    const edge = placeProps(v, [ship(90, 100), ship(91, 100)]);   // straddling the left edge, inside it
    expect(edge.length).toBe(2);
  });

  it('hazes through the fog under the horizon', () => {
    const fog = { rows: 120, alpha: 0.6 };
    expect(fogAt(390, 390, fog)).toBeCloseTo(0.6, 9);
    expect(fogAt(450, 390, fog)).toBeCloseTo(0.3, 9);
    expect(fogAt(600, 390, fog)).toBe(0);
    expect(fogAt(100, -Infinity, fog)).toBe(0);   // looking straight down: no horizon, no fog
    const v = flight(100.5, 120.5);
    const far = placeProp(v, ship(100, 85), horizonY(v), fog)!;
    const near = placeProp(v, ship(100, 118), horizonY(v), fog)!;
    expect(far.alpha).toBeLessThan(1);
    expect(near.alpha).toBe(1);
  });
});
