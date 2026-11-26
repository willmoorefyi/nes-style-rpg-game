/**
 * The field vehicle art (VEH-INT): the `vehicles` sheet contract written by assets-src/vehicles.py, each vehicle at
 * its own size anchored on its tile's bottom edge and mirrored by facing, the canoe's layers around the seated hero,
 * the airship's lift and shadow, the bobs, and the placeholder fallback when the sheet fails to load.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Container, Texture, TextureSource } from 'pixi.js';
import { TILE_SIZE } from '../../src/core/LayoutConstants.js';
import { FieldVehicleSprites, vehicleArt } from '../../src/scenes/exploration/FieldVehicleSprites.js';
import { FALLBACK_TINT } from '../../src/scenes/exploration/FieldVehicleView.js';
import {
  AIRSHIP_LIFT, FLYING_Z, OPTIONAL_VEHICLE_FRAMES, TAKEOFF_MS, VEHICLE_FRAMES, bobPx, nativeScale, parseVehicleMeta,
  type VehicleSheetMeta,
} from '../../src/scenes/exploration/vehicleLayout.js';
import { TURN_MS } from '../../src/scenes/exploration/airshipHeading.js';
import { PlayerController } from '../../src/entities/PlayerController.js';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import type { Game } from '../../src/core/Game.js';
import type { Direction } from '../../src/rendering/SpriteAnimation.js';
import { createMapData } from '../helpers/testUtils.js';

const RAW = JSON.parse(readFileSync('assets/sprites/vehicles.json', 'utf-8')) as unknown;
const META = parseVehicleMeta(RAW);
const K = nativeScale(TILE_SIZE);

/** The width and height in a PNG's IHDR. */
function pngSize(path: string): [number, number] {
  const b = readFileSync(path);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

function sheet(): Texture {
  const [w, h] = pngSize('assets/sprites/vehicles.png');
  return new Texture({ source: new TextureSource({ width: w, height: h }) });
}

/** A field with a world, a fake clock, the real sheet json (or a failing load), and a hero on an open map. */
async function rig(opts: { fail?: boolean; late?: boolean; raw?: unknown } = {}) {
  let t = 1000;
  const world = new Container();
  world.sortableChildren = true;
  let release: () => void = () => {};
  const gate = new Promise<void>((res) => { release = res; });
  const load = opts.fail
    ? () => Promise.reject(new Error('404'))
    : () => (opts.late ? gate : Promise.resolve()).then((): [unknown, Texture] => [opts.raw ?? RAW, sheet()]);
  const sprites = new FieldVehicleSprites(world, () => t, load);
  const loaded = sprites.ensure();
  if (!opts.late) await loaded;
  let held: Direction | null = null;
  const input = { isPressed: (a: string) => a === held, isJustPressed: () => false };
  const player = new PlayerController({ startX: 5, startY: 5, texture: Texture.WHITE,
    collisionMap: new CollisionMap(createMapData({ width: 12, height: 12 })),
    input: input as unknown as Game['input'], events: { emit: vi.fn() } as unknown as Game['events'] });
  world.addChild(player.animation.sprite);
  const face = (d: Direction): void => { held = d; player.update(0); held = null; player.setPosition(5, 5); };
  /** Start a step in `d` (the hero is moving after it). */
  const step = (d: Direction): void => { held = d; player.update(0); held = null; };
  const finish = async (): Promise<void> => { release(); await loaded; };
  return { world, sprites, player, face, step, finish, tick: (ms: number) => { t += ms; },
    follow: () => sprites.views.ridden?.main.onRender?.(null as never) };
}

describe('vehicle art: the sheet contract (assets-src/vehicles.py)', () => {
  it('has version 2, every frame inside the png, the approved art for all three vehicles', () => {
    const [w, h] = pngSize('assets/sprites/vehicles.png');
    for (const name of VEHICLE_FRAMES) {
      const f = META.frames[name];
      expect(f.x + f.w, name).toBeLessThanOrEqual(w);
      expect(f.y + f.h, name).toBeLessThanOrEqual(h);
      expect(f.footRow, name).toBe(f.h - 1);
      expect(f.anchor[1], name).toBe(1);
    }
    expect(META.sources).toEqual({
      ship: 'approved', airship: 'approved', canoe: 'approved', airship_back: 'approved', airship_front: 'approved',
      airship_back_turn: 'approved', airship_front_turn: 'approved', ship_back: 'approved', ship_front: 'approved',
    });
    expect([META.frames.canoe_front.w, META.frames.canoe_front.h]).toEqual([META.frames.canoe.w, META.frames.canoe.h]);
  });

  it('rejects a malformed sheet json (the old 24 px cell format included)', () => {
    expect(() => parseVehicleMeta({ cell: [24, 24], frames: { ship: [0, 0] } })).toThrow(/version 2/);
    const bad = structuredClone(RAW) as VehicleSheetMeta;
    delete (bad.frames as Record<string, unknown>).canoe_front;
    expect(() => parseVehicleMeta(bad)).toThrow(/canoe_front/);
  });

  it('draws the ship and the airship at least as tall as the hero (92 native px), the canoe 1.5 tiles long', () => {
    for (const v of ['ship', 'airship'] as const) expect(META.frames[v].h).toBeGreaterThanOrEqual(92);
    expect(META.frames.canoe.w).toBeGreaterThanOrEqual(70);
    expect(META.frames.canoe.w).toBeLessThanOrEqual(72);
    expect(META.frames.canoe.h).toBeLessThanOrEqual(24);
  });

  it('the approved art faces right: the sources that faced left were mirrored, the keel sits left of the bow', () => {
    for (const v of ['ship', 'airship', 'canoe'] as const) {
      const j = JSON.parse(readFileSync(`assets-src/gen/approved/vehicles/${v}.json`, 'utf-8'));
      expect(j.faces).toBe('right');
      expect(j.mirrored).toBe(v !== 'canoe');
      expect(j.pass).toBe('LM2');
      expect(j.approved).toBe('2026-11-19');
    }
    expect(META.frames.ship.anchor[0]).toBeLessThan(0.5);     // the bowsprit reaches out to the right
  });
});

describe('vehicle art: placement on the field', () => {
  it('a parked vehicle stands at its own size on its cell\'s bottom centre, sorted by its foot row', async () => {
    const { sprites } = await rig();
    sprites.showParked([{ type: 'airship', map: 'm', x: 3, y: 2 }, { type: 'ship', map: 'm', x: 8, y: 4 }]);
    const [air, ship] = sprites.views.parked;
    expect(air.main.x).toBe(3.5 * TILE_SIZE);
    expect(air.main.y).toBe(3 * TILE_SIZE);                   // parked: no lift, no bob
    expect(air.main.width).toBeCloseTo(META.frames.airship.w * K);
    expect(air.main.height).toBeCloseTo(META.frames.airship.h * K);
    expect(air.main.anchor.x).toBeCloseTo(META.frames.airship.anchor[0]);
    expect(air.main.zIndex).toBe(3 * TILE_SIZE - 1);
    expect(ship.main.zIndex).toBe(5 * TILE_SIZE - 1);
    expect(air.shadowSize).toEqual({ w: Math.round(META.frames.airship.w * 0.5), h: 4, alpha: 0.35 });
  });

  it('the ridden vehicle mirrors by facing and keeps its facing on up and down; the ship and airship hide the hero', async () => {
    const r = await rig();
    r.sprites.ride('ship', r.player);
    const main = r.sprites.views.ridden!.main;
    expect(main.scale.x).toBeGreaterThan(0);
    r.face('left'); r.follow();
    expect(main.scale.x).toBeLessThan(0);
    r.face('up'); r.follow();
    expect(main.scale.x).toBeLessThan(0);
    r.face('right'); r.follow();
    expect(main.scale.x).toBeGreaterThan(0);
    expect(r.player.animation.sprite.visible).toBe(false);
    r.sprites.ride(null, r.player);
    expect(r.player.animation.sprite.visible).toBe(true);
  });

  it('the flying airship is lifted 10 native px after take-off with a 0-2 px bob over a wide soft shadow', async () => {
    const r = await rig();
    r.sprites.ride('airship', r.player);
    const v = r.sprites.views.ridden!;
    const footY = 6 * TILE_SIZE;
    expect((footY - v.main.y) / K).toBeLessThanOrEqual(2);     // on the ground at take-off (the bob only)
    r.tick(TAKEOFF_MS);
    for (let i = 0; i < 12; i++) {
      r.tick(137);
      r.follow();
      const up = (footY - v.main.y) / K;
      expect(up).toBeGreaterThanOrEqual(AIRSHIP_LIFT);
      expect(up).toBeLessThanOrEqual(AIRSHIP_LIFT + 2);
    }
    expect(v.main.zIndex).toBe(FLYING_Z);
    expect(v.shadow!.zIndex).toBe(FLYING_Z - 1);
    expect(v.shadow!.y).toBe(footY);
    expect(v.shadowSize).toEqual({ w: Math.round(META.frames.airship.w * 0.6), h: 8, alpha: 0.3 });
  });

  it('the bobs: the ship 1 px, the canoe up to 2 px, a parked airship none', () => {
    const seen = (f: (t: number) => number) => new Set(Array.from({ length: 400 }, (_, i) => f(i * 17)));
    expect(seen((t) => bobPx('ship', 'ridden', t))).toEqual(new Set([0, 1]));
    expect(seen((t) => bobPx('ship', 'parked', t))).toEqual(new Set([0, 1]));
    expect(seen((t) => bobPx('canoe', 'ridden', t))).toEqual(new Set([0, 1, 2]));
    expect(seen((t) => bobPx('airship', 'parked', t))).toEqual(new Set([0]));
  });
});

describe('vehicle art: the canoe seat', () => {
  it('layers ripple < back hull < hero < near side, drops the hero into the hull and masks it below the gunwale', async () => {
    const r = await rig();
    r.sprites.ride('canoe', r.player);
    const v = r.sprites.views.ridden!;
    const hero = r.player.animation.sprite;
    expect(hero.visible).toBe(true);
    expect(v.ripple!.zIndex).toBeLessThan(v.main.zIndex);
    expect(v.main.zIndex).toBeLessThan(hero.zIndex);
    expect(hero.zIndex).toBeLessThan(v.front!.zIndex);
    expect(hero.mask).toBe(r.sprites.views.heroMask);
    const footY = 6 * TILE_SIZE;
    const b = r.sprites.views.heroMask!.getLocalBounds();
    const rise = footY - v.main.y;
    expect(b.maxY).toBeCloseTo(footY - (META.frames.canoe.h - META.canoe.cutRow - 1) * K - rise);
    expect(-hero.pivot.y * hero.scale.y).toBeCloseTo(META.canoe.heroDrop * K - rise);
    expect(v.front!.y).toBe(v.main.y);                        // the hull's two layers bob together
    r.sprites.ride(null, r.player);
    expect(hero.mask).toBeFalsy();
    expect(hero.pivot.y).toBe(0);
    expect(r.world.children.some((c) => c.label?.startsWith('vehicle:'))).toBe(false);
  });
});

describe('vehicle art: the fallback', () => {
  it('a sheet that fails to load leaves tinted placeholders, and the canoe hero whole and unmasked', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await rig({ fail: true });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('placeholders'), expect.any(Error));
    r.sprites.showParked([{ type: 'ship', map: 'm', x: 2, y: 2 }]);
    expect(r.sprites.views.parked[0].main.tint).toBe(FALLBACK_TINT.ship);
    expect(r.sprites.views.parked[0].main.y).toBeLessThanOrEqual(3 * TILE_SIZE);
    r.sprites.ride('canoe', r.player);
    expect(r.sprites.views.ridden!.front).toBeNull();
    expect(r.player.animation.sprite.mask).toBeFalsy();
    expect(r.player.animation.sprite.visible).toBe(true);
    warn.mockRestore();
  });

  it('vehicleArt cuts one texture per frame at its sheet box', () => {
    const art = vehicleArt(RAW, sheet());
    for (const name of VEHICLE_FRAMES) {
      const f = META.frames[name];
      expect([art.frames[name].tex.frame.x, art.frames[name].tex.frame.width]).toEqual([f.x, f.w]);
    }
  });
});

/** The texture frame's x on the sheet of the ridden or parked view's hull (which frame is drawn). */
const AIRSHIP_VIEWS = ['airship_back', 'airship_front', 'airship_back_turn', 'airship_front_turn'] as const;
const frameX = (v: { main: { texture: Texture } }): number => v.main.texture.frame.x;

describe('vehicle art: the airship views (docs/AIRSHIP_VIEWS_PLAN.md)', () => {
  it('the real vehicles.json gives the four optional airship frames through vehicleArt, sized as the plan says', () => {
    const art = vehicleArt(RAW, sheet());
    const sizes = { airship_back: [87, 112], airship_front: [87, 110], airship_back_turn: [126, 102],
      airship_front_turn: [126, 103] } as const;
    for (const name of AIRSHIP_VIEWS) {
      const f = META.frames[name];
      expect(art.frames[name].frame, name).toEqual(f);
      expect(Math.abs(f.w - sizes[name][0]), name).toBeLessThanOrEqual(3);
      expect(Math.abs(f.h - sizes[name][1]), name).toBeLessThanOrEqual(3);
      const j = JSON.parse(readFileSync(`assets-src/gen/approved/vehicles/${name}.json`, 'utf-8'));
      expect(f.anchor, name).toEqual([j.anchor[0], 1]);
      expect(j.review, name).toMatch(/R6/);
    }
  });

  it('a sheet without the new frames still parses, and the airship shows b_7 for every heading', async () => {
    const old = structuredClone(RAW) as VehicleSheetMeta;
    for (const name of OPTIONAL_VEHICLE_FRAMES) delete (old.frames as Record<string, unknown>)[name];
    expect(() => parseVehicleMeta(old)).not.toThrow();
    expect(vehicleArt(old, sheet()).frames.airship_back).toBeUndefined();
    const r = await rig({ raw: old });
    r.sprites.ride('airship', r.player);
    const v = r.sprites.views.ridden!;
    for (const d of ['up', 'down', 'left', 'right'] as const) {
      r.face(d); r.follow(); r.tick(TURN_MS); r.follow();
      expect(frameX(v), d).toBe(META.frames.airship.x);
      expect(v.main.scale.x > 0, d).toBe(d !== 'left' && !(d !== 'right' && r.sprites.heading.side === 'left'));
    }
  });

  it('up shows the back view, down the front view, left b_7 mirrored; the end views lean the last side', async () => {
    const r = await rig();
    r.sprites.ride('airship', r.player);
    const v = r.sprites.views.ridden!;
    r.face('up'); r.follow();
    expect(frameX(v)).toBe(META.frames.airship_back_turn.x);     // the turn frame first
    r.tick(TURN_MS); r.follow();
    expect(frameX(v)).toBe(META.frames.airship_back.x);
    expect(v.main.anchor.x).toBeCloseTo(META.frames.airship_back.anchor[0]);
    expect(v.main.scale.x).toBeGreaterThan(0);
    expect(v.shadowSize).toEqual({ w: Math.round(META.frames.airship_back.w * 0.6), h: 10, alpha: 0.3 });
    r.face('down'); r.follow();
    expect(frameX(v)).toBe(META.frames.airship_front.x);          // back to front: instant
    r.face('left'); r.follow();
    expect(frameX(v)).toBe(META.frames.airship.x);                // front (leaning right) to left: a flip, instant
    expect(v.main.scale.x).toBeLessThan(0);
    expect(v.shadowSize).toEqual({ w: Math.round(META.frames.airship.w * 0.6), h: 8, alpha: 0.3 });
    r.face('up'); r.follow(); r.tick(TURN_MS); r.follow();
    expect(frameX(v)).toBe(META.frames.airship_back.x);
    expect(v.main.scale.x).toBeLessThan(0);                       // leaning left: mirrored
  });

  it('pass PT: the ship sails up in its back view, down in its front view, and parks with its last heading', async () => {
    const r = await rig();
    r.sprites.ride('ship', r.player);
    const v = r.sprites.views.ridden!;
    expect(frameX(v)).toBe(META.frames.ship.x);
    r.face('up'); r.follow();
    expect(frameX(v)).toBe(META.frames.ship_back.x);              // no turn frame: instant
    expect(v.main.anchor.x).toBeCloseTo(META.frames.ship_back.anchor[0]);
    expect(v.main.scale.x).toBeGreaterThan(0);
    r.face('down'); r.follow();
    expect(frameX(v)).toBe(META.frames.ship_front.x);
    r.face('left'); r.follow();
    expect(frameX(v)).toBe(META.frames.ship.x);
    expect(v.main.scale.x).toBeLessThan(0);
    r.face('down'); r.follow();
    expect(frameX(v)).toBe(META.frames.ship_front.x);
    expect(v.main.scale.x).toBeLessThan(0);                       // leaning left: mirrored
    r.sprites.ride(null, r.player);
    r.sprites.showParked([{ type: 'ship', map: 'm', x: 5, y: 5 }]);
    expect(frameX(r.sprites.views.parked[0])).toBe(META.frames.ship_front.x);
    for (const name of ['ship_back', 'ship_front'] as const) {
      const j = JSON.parse(readFileSync(`assets-src/gen/approved/vehicles/${name}.json`, 'utf-8'));
      expect([j.backend, j.anchor[0]], name).toEqual(['user', META.frames[name].anchor[0]]);
    }
  });

  it('boarding keeps the parked heading until the hero\'s direction changes or a step starts (D-AV10)', async () => {
    const r = await rig();
    r.face('right');                                              // the hero starts facing down
    r.sprites.ride('airship', r.player);
    r.face('down'); r.follow(); r.tick(TURN_MS); r.follow();
    expect(r.sprites.heading.end).toBe('front');
    r.sprites.ride(null, r.player);                               // landed
    r.sprites.showParked([{ type: 'airship', map: 'm', x: 5, y: 5 }]);
    expect(frameX(r.sprites.views.parked[0])).toBe(META.frames.airship_front.x);   // parked keeps it (D-AV6)
    r.face('up');                                                 // walk back and face the ship
    r.sprites.showParked([]);
    r.sprites.ride('airship', r.player);
    const v = r.sprites.views.ridden!;
    r.follow(); r.tick(TURN_MS); r.follow();
    expect(r.sprites.heading.end).toBe('front');
    expect(frameX(v)).toBe(META.frames.airship_front.x);
    r.step('up'); r.follow();                                     // a step starts in the same direction: taken
    expect(r.sprites.heading.end).toBe('back');
  });

  it('a late sheet load keeps the heading (rebuild rides again from the stored heading)', async () => {
    const r = await rig({ late: true });
    r.sprites.ride('airship', r.player);
    r.face('up'); r.follow();
    expect(r.sprites.heading.end).toBe('back');
    await r.finish();
    expect(r.sprites.heading.end).toBe('back');
    r.tick(TURN_MS); r.follow();
    expect(frameX(r.sprites.views.ridden!)).toBe(META.frames.airship_back.x);
  });
});
