/**
 * LM-INT / SMOKE: the field's looping ambient effects (src/scenes/exploration/FieldAmbient.ts), the volcano smoke's
 * shapes, style and motion (src/scenes/exploration/smoke/), and the `ambient` map key's validator
 * (src/core/schemaValidationAmbient.ts).
 */
import { describe, it, expect, vi } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { FieldAmbient } from '../../../src/scenes/exploration/FieldAmbient.js';
import { VOLCANO_SMOKE, STEAM_PALETTE } from '../../../src/scenes/exploration/smoke/smokeStyles.js';
import { createPuffs, DITHER_LEVELS, fadeLevel, smokeState } from '../../../src/scenes/exploration/smoke/smokeMotion.js';
import { CLUSTER, cloudShape, rgb15, shapeRuns } from '../../../src/scenes/exploration/smoke/smokeShapes.js';
import { validateAmbient } from '../../../src/core/schemaValidationAmbient.js';
import { aboveZIndex } from '../../../src/rendering/BakedMapRenderer.js';
import { createMapData } from '../../helpers/testUtils.js';

const S = VOLCANO_SMOKE;
const count = (rows: string[]): number => rows.join('').replace(/0/g, '').length;

describe('the volcano smoke style (SMOKE option e)', () => {
  it('is 7 steam billows on a 5.2 s loop, growing from r 10 to 26 art px', () => {
    expect(S).toMatchObject({ periodMs: 5200, puffs: 7, r0: 10, r1: 26, lobes: CLUSTER, palette: STEAM_PALETTE });
  });

  it('uses 15-bit colours (rgb15 expands like snes_palette.c15): a dark outline under a white body', () => {
    expect(rgb15(31, 0, 16)).toBe(0xff0084);
    const exact = (c: number) => [16, 8, 0].every((s) => {
      const v = (c >> s) & 0xff;
      return v === (((v >> 3) << 3) | ((v >> 3) >> 2));
    });
    expect(STEAM_PALETTE.every(exact)).toBe(true);
    const lum = (c: number) => ((c >> 16) & 0xff) + ((c >> 8) & 0xff) + (c & 0xff);
    expect(lum(STEAM_PALETTE[0])).toBeLessThan(160);
    expect(lum(STEAM_PALETTE[3])).toBe(765);
  });
});

describe('smokeState', () => {
  const at = (ms: number) => smokeState(S, ms, createPuffs(S)).map((p) => ({ ...p }));

  it('loops: the puffs at t and t + one period are the same', () => {
    for (const t of [0, 400, 1234, 5100]) {
      expect(at(t + S.periodMs).map(({ dx, dy, r, level }) => [dx, dy, r, level]))
        .toEqual(at(t).map(({ dx, dy, r, level }) => [dx, dy, r, level]));
    }
  });

  it('staggers the puffs evenly over the loop', () => {
    const us = at(0).map((p) => p.u).sort((a, b) => a - b);
    us.forEach((u, i) => expect(u).toBeCloseTo(i / S.puffs, 6));
  });

  it('a puff rises, grows and fades by dither levels over its life, on whole art pixels', () => {
    const track = Array.from({ length: 60 }, (_, k) => at((k * S.periodMs) / 60)[0]);
    for (const q of track) {
      expect(Number.isInteger(q.dx) && Number.isInteger(q.dy)).toBe(true);
      expect(q.dy).toBeLessThanOrEqual(2);
      expect(q.r).toBeGreaterThanOrEqual(S.r0);
      expect(q.r).toBeLessThanOrEqual(S.r1);
    }
    const centre = track.map((q) => q.dy + q.r);   // the puff's bottom: it only climbs
    for (let k = 1; k < track.length; k++) {
      expect(centre[k]).toBeLessThanOrEqual(centre[k - 1]);
      expect(track[k].r).toBeGreaterThanOrEqual(track[k - 1].r);
      expect(track[k].level).toBeGreaterThanOrEqual(k > 2 ? track[k - 1].level : 0);
    }
    expect(track[track.length - 1].level).toBe(DITHER_LEVELS);           // gone at the top
    expect(track.filter((q) => q.level === 0).length).toBeGreaterThan(30); // solid for most of its life
    expect(-track[track.length - 1].dy).toBeGreaterThan(100);              // a tall column
  });

  it('fadeLevel: one dithered step at birth, solid, then sparser to hidden', () => {
    expect(fadeLevel(0.01, 0.62)).toBe(1);
    expect(fadeLevel(0.3, 0.62)).toBe(0);
    expect(fadeLevel(0.7, 0.62)).toBeGreaterThan(0);
    expect(fadeLevel(0.999, 0.62)).toBe(DITHER_LEVELS);
  });

  it('writes into the given state (no new puffs per frame)', () => {
    const out = createPuffs(S);
    const first = out[0];
    expect(smokeState(S, 777, out)).toBe(out);
    expect(out[0]).toBe(first);
  });
});

describe('cloudShape', () => {
  it.each([[S.r0], [16], [S.r1]])('radius %i: an outlined cauliflower lit from the top left', (r) => {
    const rows = cloudShape(r);
    expect(rows).toHaveLength(2 * r);
    expect(rows.every((row) => row.length === 2 * r)).toBe(true);
    expect(rows[0][0]).toBe('0');
    const flat = rows.join('');
    for (const ch of '1234') expect(flat).toContain(ch);
    // every drawn pixel next to empty space is outline: the cloud reads against any ground
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const empty = (xx: number, yy: number) => (rows[yy]?.[xx] ?? '0') === '0';
      if (ch !== '0' && (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1))) {
        expect(ch).toBe('1');
      }
    }));
  });

  it('a dither level drops about a quarter of the pixels per step (binary alpha)', () => {
    const solid = count(cloudShape(20, CLUSTER, 0));
    for (const l of [1, 2, 3]) {
      expect(count(cloudShape(20, CLUSTER, l)) / solid).toBeCloseTo(1 - l / 4, 1);
    }
  });

  it('shapeRuns covers every drawn pixel once', () => {
    const rows = cloudShape(12);
    const runs = shapeRuns(rows);
    expect(runs.reduce((n, [, , len]) => n + len, 0)).toBe(count(rows));
  });
});

describe('FieldAmbient', () => {
  const map = () => createMapData({ width: 10, height: 8, ambient: [{ kind: 'smoke', x: 3, y: 2, ox: 26, oy: 12 }] });

  it('adds one source per entry, over the above layer, at the crater px', () => {
    const world = new Container();
    const fx = new FieldAmbient();
    fx.setMap(map(), world, 96);
    expect(fx.count).toBe(1);
    const root = world.children[0];
    expect(root.zIndex).toBeGreaterThan(aboveZIndex({ height: 8 }));
    expect(root.position.x).toBe(3 * 96 + 26 * 2);
    expect(root.position.y).toBe(2 * 96 + 12 * 2);
    expect((root as Container).children).toHaveLength(S.puffs);
  });

  it('animates with the ticker on whole screen px, the newest puff in front', () => {
    const world = new Container();
    const fx = new FieldAmbient();
    fx.setMap(map(), world, 96);
    const root = world.children[0] as Container;
    const pose = () => root.children.map((c) => `${c.visible}:${c.position.x},${c.position.y}`);
    const before = pose();
    for (let i = 0; i < 30; i++) fx.update(1);
    expect(pose()).not.toEqual(before);
    for (const c of root.children) {
      expect(Number.isInteger(c.position.x / 2) && Number.isInteger(c.position.y / 2)).toBe(true);
      expect(c.alpha).toBe(1);                                             // never a smooth alpha fade
    }
    const states = fx.sources[0].puffStates;
    const newest = states.indexOf(states.reduce((a, b) => (b.u < a.u ? b : a)));
    const oldest = states.indexOf(states.reduce((a, b) => (b.u > a.u ? b : a)));
    expect(root.children[newest].zIndex).toBeGreaterThan(root.children[oldest].zIndex);
  });

  it('shares the puff bitmaps between sources (built once per art scale)', () => {
    const world = new Container();
    const fx = new FieldAmbient();
    fx.setMap(createMapData({ width: 10, height: 8, ambient: [{ kind: 'smoke', x: 1, y: 1 }, { kind: 'smoke', x: 5, y: 5 }] }),
      world, 96);
    fx.update(1);
    const [a, b] = world.children.map((c) => (c as Container).children[0] as Graphics);
    expect(a.context).toBe(b.context);
  });

  it('a map without ambient adds nothing, and clear() removes the sources', () => {
    const world = new Container();
    const fx = new FieldAmbient();
    fx.setMap(createMapData({ width: 4, height: 4 }), world, 96);
    expect(world.children).toHaveLength(0);
    fx.setMap(map(), world, 96);
    fx.clear();
    expect(fx.count).toBe(0);
    expect(world.children).toHaveLength(0);
  });

  it('skips an unknown kind with console.error', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const world = new Container();
    const bad = createMapData({ width: 4, height: 4 });
    (bad as { ambient?: unknown }).ambient = [{ kind: 'steam', x: 1, y: 1 }];
    new FieldAmbient().setMap(bad, world, 96);
    expect(world.children).toHaveLength(0);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('validateAmbient', () => {
  it('accepts smoke entries in the map, with or without offsets', () => {
    expect(() => validateAmbient([{ kind: 'smoke', x: 0, y: 0 }, { kind: 'smoke', x: 9, y: 7, ox: 47, oy: 0 }], 10, 8))
      .not.toThrow();
  });

  it.each([
    ['not a list', { kind: 'smoke', x: 0, y: 0 }],
    ['an unknown kind', [{ kind: 'steam', x: 0, y: 0 }]],
    ['a cell off the map', [{ kind: 'smoke', x: 10, y: 0 }]],
    ['a fractional cell', [{ kind: 'smoke', x: 1.5, y: 0 }]],
    ['an offset outside the cell', [{ kind: 'smoke', x: 0, y: 0, ox: 48 }]],
    ['an unknown key', [{ kind: 'smoke', x: 0, y: 0, speed: 2 }]],
  ])('rejects %s', (_, value) => {
    expect(() => validateAmbient(value, 10, 8)).toThrow(/ambient/);
  });
});
