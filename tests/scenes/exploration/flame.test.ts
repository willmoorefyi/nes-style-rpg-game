/**
 * AR-P2: the flame ambient of the dungeon props (src/scenes/exploration/flame/): the pure flicker and glow
 * (flameMotion.ts), the 15-bit styles (flameStyles.ts), the light in the field (FlameLight.ts via FieldAmbient.ts) and
 * the validator of a compiled `flame` entry (schemaValidationAmbient.ts).
 */
import { describe, it, expect } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { FieldAmbient } from '../../../src/scenes/exploration/FieldAmbient.js';
import {
  FLAME_FRAME_MS, FLAME_FRAMES, FLAME_LOOP_MS, flameFrame, frameAt, glowRadius, glowShape, lightPhaseMs, shapeSeed,
  tongueRows,
} from '../../../src/scenes/exploration/flame/flameMotion.js';
import { FLAME_STYLE, liftColour } from '../../../src/scenes/exploration/flame/flameStyles.js';
import { validateAmbient } from '../../../src/core/schemaValidationAmbient.js';
import { FLAME_STYLES, type FlameEffect } from '../../../src/types/ambient.js';
import { createMapData } from '../../helpers/testUtils.js';

// a torch-like flame: 8 rows, narrow tongue on top, brightest in the core
const TORCH = ['..1..', '..2..', '.122.', '.233.', '12341', '23442', '.344.', '..3..'];
const lit = (rows: string[]): number => rows.join('').replace(/[.0]/g, '').length;
const torch = (x: number, y: number, extra: Partial<FlameEffect> = {}): FlameEffect => ({
  kind: 'flame', x, y, ox: 24, oy: 12, style: 'fire', glow: 40, foot: y,
  mask: { dx: -2, dy: -4, rows: TORCH, tongue: true }, ...extra,
});

describe('flameMotion: the flicker', () => {
  it('loops over 8 frames of 110 ms, each light on its own phase', () => {
    expect([FLAME_FRAMES, FLAME_FRAME_MS, FLAME_LOOP_MS]).toEqual([8, 110, 880]);
    for (const t of [0, 109, 110, 879]) expect(frameAt(t + FLAME_LOOP_MS, 0)).toBe(frameAt(t, 0));
    expect(frameAt(0, 0)).toBe(0);
    expect(frameAt(110, 0)).toBe(1);
    expect(frameAt(879, 0)).toBe(7);
    const phases = new Set([[3, 4], [4, 4], [10, 2], [11, 2], [5, 17]].map(([x, y]) => lightPhaseMs(x, y)));
    expect(phases.size).toBe(5);
  });

  it('keeps the lit pixels inside the mask and steps each one at most one ramp level', () => {
    const seed = shapeSeed(TORCH);
    for (let f = 0; f < FLAME_FRAMES; f++) {
      const out = flameFrame(TORCH, false, f, seed);
      expect(out).toHaveLength(TORCH.length);
      out.forEach((row, y) => [...row].forEach((ch, x) => {
        if (TORCH[y][x] === '.') expect(ch).toBe('0');
        else expect(Math.abs(Number(ch) - Number(TORCH[y][x]))).toBeLessThanOrEqual(1);
      }));
      expect(lit(out)).toBe(lit(TORCH));                     // no tongue: a pure palette cycle (lava, embers)
    }
  });

  it('the noise is per 2-px row: both rows of a pair step the same way', () => {
    const seed = shapeSeed(TORCH);
    for (let f = 0; f < FLAME_FRAMES; f++) {
      const out = flameFrame(TORCH, false, f, seed);
      // a step that is not clamped at the ramp's ends is the row pair's shift
      const free = (y: number) => [...TORCH[y]].flatMap((c, x) => {
        const v = Number(c);
        return c !== '.' && v > 1 && v < 4 ? [Number(out[y][x]) - v] : [];
      });
      for (const y of [0, 2, 4, 6]) {
        const s = new Set([...free(y), ...free(y + 1)]);
        expect(s.size).toBeLessThanOrEqual(1);
      }
    }
  });

  it('a tongue drops 1-3 px off the top of some columns, only in the flame\'s top quarter', () => {
    const tall = ['.11.', '.22.', '1221', '2332', '2342', '3443', '3443', '3443', '2442', '.33.', '.22.', '..1.'];
    const deep = tongueRows(tall.length);
    expect(deep).toBe(2);
    expect(tongueRows(4)).toBe(1);
    const seed = shapeSeed(tall);
    let dropped = 0;
    for (let f = 0; f < FLAME_FRAMES; f++) {
      const out = flameFrame(tall, true, f, seed);
      out.forEach((row, y) => [...row].forEach((ch, x) => {
        if (tall[y][x] !== '.' && ch === '0') {
          dropped++;
          expect(y).toBeLessThan(deep);
        }
      }));
    }
    expect(dropped).toBeGreaterThan(0);                       // the height jitters
  });

  it('the frames are deterministic: the same shape gives the same frames', () => {
    const seed = shapeSeed(TORCH);
    expect(flameFrame(TORCH, true, 3, seed)).toEqual(flameFrame(TORCH, true, 3, seed));
    expect(shapeSeed(TORCH)).not.toBe(shapeSeed([...TORCH].reverse()));
  });
});

describe('flameMotion: the glow', () => {
  it('breathes about 12 % over the loop', () => {
    const rs = Array.from({ length: FLAME_FRAMES }, (_, f) => glowRadius(40, f));
    expect(Math.max(...rs)).toBe(45);
    expect(Math.min(...rs)).toBe(35);
    expect(rs[0]).toBe(40);
  });

  it('is a 1.4:1 floor ellipse of two Bayer rings: 8/16 inside 0.55 r, 4/16 out to r', () => {
    const r = 20, rows = glowShape(r, 0, 0);
    const rx = Math.round(1.4 * r);
    expect(rows).toHaveLength(2 * r + 1);
    expect(rows[0]).toHaveLength(2 * rx + 1);
    const share = (lo: number, hi: number) => {
      let on = 0, n = 0;
      rows.forEach((row, j) => [...row].forEach((ch, i) => {
        const d = Math.sqrt(((i - rx) / 1.4) ** 2 + (j - r) ** 2) / r;
        if (d >= lo && d < hi) { n++; on += ch === '1' ? 1 : 0; }
      }));
      return on / n;
    };
    expect(share(0, 0.5)).toBeCloseTo(0.5, 1);
    expect(share(0.6, 0.95)).toBeCloseTo(0.25, 1);
    expect(share(1.02, 9)).toBe(0);
  });

  it('keeps its dither fixed to the floor\'s art px grid', () => {
    expect(glowShape(10, 0, 0)).not.toEqual(glowShape(10, 1, 0));
    expect(glowShape(10, 1, 2)).toEqual(glowShape(10, 5, 6));
  });
});

describe('flameStyles', () => {
  it('every style has a 4-colour 15-bit ramp, darkest to lightest, and a 15-bit lift', () => {
    const exact = (c: number) => [16, 8, 0].every((s) => {
      const v = (c >> s) & 0xff;
      return v === (((v >> 3) << 3) | ((v >> 3) >> 2));
    });
    const lum = (c: number) => ((c >> 16) & 0xff) + ((c >> 8) & 0xff) + (c & 0xff);
    for (const id of FLAME_STYLES) {
      const { ramp, lift } = FLAME_STYLE[id];
      expect(ramp.every(exact)).toBe(true);
      for (let k = 1; k < 4; k++) expect(lum(ramp[k])).toBeGreaterThan(lum(ramp[k - 1]));
      expect(lift.every((v) => Number.isInteger(v) && v >= 0 && v <= 8)).toBe(true);
      const c = liftColour(FLAME_STYLE[id]);
      expect([16, 8, 0].every((s) => ((c >> s) & 0xff) % 8 === 0)).toBe(true);
    }
    expect(FLAME_STYLE.fire.lift).toEqual([5, 3, 0]);
  });
});

describe('FieldAmbient: flame lights', () => {
  it('adds a glow under the characters and the flame at the prop\'s foot', () => {
    const world = new Container();
    const fx = new FieldAmbient();
    fx.setMap(createMapData({ width: 10, height: 8, ambient: [torch(3, 2, { foot: 3 })] }), world, 96);
    expect(fx.count).toBe(1);
    const [light] = fx.flames;
    expect(world.children).toEqual([light.glow, light.flame]);
    expect(light.glow.blendMode).toBe('add');
    expect(light.glow.zIndex).toBe(0);
    expect(light.flame!.zIndex).toBe(4 * 96 + 1);           // a hero on row 4 (feet 5 x 96) is drawn over it
    expect(light.glow.position.x).toBe(3 * 96 + 24 * 2);
    expect(light.glow.position.y).toBe(2 * 96 + 12 * 2);
  });

  it('animates by swapping shared contexts (no per-frame bitmaps) and loops', () => {
    const world = new Container();
    const fx = new FieldAmbient();
    fx.setMap(createMapData({ width: 12, height: 8, ambient: [torch(3, 2), torch(8, 2)] }), world, 96);
    const [a, b] = fx.flames;
    const seen = new Set<unknown>();
    for (let i = 0; i < 120; i++) {
      fx.update(1);
      seen.add(a.flame!.context);
    }
    expect(seen.size).toBe(FLAME_FRAMES);
    for (let i = 0; i < 200; i++) {
      fx.update(1);
      expect(seen.has(a.flame!.context)).toBe(true);        // only the 8 cached frames ever show
    }
    // the same prop shares its frames: at the same frame index both lights show the same context
    const ctxOf = (l: typeof a) => l.flame!.context;
    if (a.frame === b.frame) expect(ctxOf(a)).toBe(ctxOf(b));
  });

  it('a light with no prop draws only the glow; clear() removes everything', () => {
    const world = new Container();
    const fx = new FieldAmbient();
    fx.setMap(createMapData({ width: 6, height: 6, ambient: [{ kind: 'flame', x: 2, y: 2, style: 'cyan', glow: 26, foot: 2 }] }),
      world, 96);
    expect(fx.flames[0].flame).toBeNull();
    expect(world.children).toHaveLength(1);
    expect(world.children[0]).toBeInstanceOf(Graphics);
    fx.clear();
    expect(world.children).toHaveLength(0);
    expect(fx.count).toBe(0);
  });
});

describe('validateAmbient: flame', () => {
  it('accepts a compiled flame and a glow-only light', () => {
    expect(() => validateAmbient([torch(3, 2), { kind: 'flame', x: 0, y: 0, style: 'lamp', glow: 26, foot: 0 }], 10, 8))
      .not.toThrow();
  });

  it.each([
    ['an unknown style', [torch(1, 1, { style: 'blue' as never })]],
    ['a glow out of range', [torch(1, 1, { glow: 70 })]],
    ['a foot off the map', [torch(1, 1, { foot: 8 })]],
    ['a missing foot', [{ kind: 'flame', x: 1, y: 1, style: 'fire', glow: 30 }]],
    ['ragged mask rows', [torch(1, 1, { mask: { dx: 0, dy: 0, rows: ['12', '1'], tongue: true } })]],
    ['a bad mask character', [torch(1, 1, { mask: { dx: 0, dy: 0, rows: ['15'], tongue: true } })]],
    ['an empty mask', [torch(1, 1, { mask: { dx: 0, dy: 0, rows: ['..'], tongue: false } })]],
    ['a smoke key on a flame', [torch(1, 1, { speed: 2 } as never)]],
    ['a flame key on smoke', [{ kind: 'smoke', x: 1, y: 1, style: 'fire' }]],
  ])('rejects %s', (_, value) => {
    expect(() => validateAmbient(value, 10, 8)).toThrow(/ambient/);
  });
});
