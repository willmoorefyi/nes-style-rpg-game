/**
 * LM-INT: the field's looping ambient effects (src/scenes/exploration/FieldAmbient.ts) and the `ambient` map key's
 * validator (src/core/schemaValidationAmbient.ts).
 */
import { describe, it, expect, vi } from 'vitest';
import { Container } from 'pixi.js';
import { FieldAmbient, SMOKE_PERIOD_MS, SMOKE_PUFFS, SMOKE_RADII, SMOKE_RISE, puffShape, smokePuffs } from '../../../src/scenes/exploration/FieldAmbient.js';
import { validateAmbient } from '../../../src/core/schemaValidationAmbient.js';
import { aboveZIndex } from '../../../src/rendering/BakedMapRenderer.js';
import { createMapData } from '../../helpers/testUtils.js';

describe('smokePuffs', () => {
  it('loops: the state at t and t + one period is the same', () => {
    for (const t of [0, 400, 1234, 3100]) expect(smokePuffs(t + SMOKE_PERIOD_MS)).toEqual(smokePuffs(t));
  });

  it('has the period in the 2-4 s band and staggered puffs', () => {
    expect(SMOKE_PERIOD_MS).toBeGreaterThanOrEqual(2000);
    expect(SMOKE_PERIOD_MS).toBeLessThanOrEqual(4000);
    const p = smokePuffs(0);
    expect(p).toHaveLength(SMOKE_PUFFS);
    expect(new Set(p.map((q) => q.dy)).size).toBe(SMOKE_PUFFS);
  });

  it('a puff rises, grows and fades over its loop, on whole art pixels', () => {
    const track = Array.from({ length: 40 }, (_, k) => smokePuffs((k * SMOKE_PERIOD_MS) / 40)[0]);
    for (const q of track) {
      expect(Number.isInteger(q.dx) && Number.isInteger(q.dy)).toBe(true);
      expect(q.dy).toBeLessThanOrEqual(0);
      expect(q.dy).toBeGreaterThanOrEqual(-SMOKE_RISE);
      expect(q.alpha).toBeGreaterThanOrEqual(0);
      expect(q.alpha).toBeLessThanOrEqual(0.95);
    }
    for (let k = 1; k < track.length; k++) {
      expect(track[k].dy).toBeLessThanOrEqual(track[k - 1].dy);
      expect(track[k].size).toBeGreaterThanOrEqual(track[k - 1].size);
    }
    expect(track[track.length - 1].alpha).toBeLessThan(0.1);           // faded out at the top
    expect(Math.max(...track.map((q) => q.alpha))).toBeGreaterThan(0.8);
  });
});

describe('puffShape', () => {
  it.each(SMOKE_RADII.map((r) => [r]))('radius %i: a round, outlined blob lit from the top left', (r) => {
    const rows = puffShape(r);
    expect(rows).toHaveLength(2 * r);
    expect(rows.every((row) => row.length === 2 * r)).toBe(true);
    expect(rows[0][0]).toBe('0');                                         // round: the corners are empty
    expect(rows[r][0]).toBe('1');                                         // outlined at the rim
    const at = (x: number, y: number): string => rows[y][x];
    expect(at(r - 2, r - 2) >= at(r + 1, r + 1)).toBe(true);              // lighter towards the top left
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
  });

  it('animates with the ticker and shows one shape per puff', () => {
    const world = new Container();
    const fx = new FieldAmbient();
    fx.setMap(map(), world, 96);
    const root = world.children[0] as Container;
    const visible = () => root.children.filter((c) => c.visible).map((c) => `${c.position.x},${c.position.y}`);
    const before = visible();
    expect(before.length).toBeLessThanOrEqual(SMOKE_PUFFS);
    for (let i = 0; i < 30; i++) fx.update(1);
    expect(visible()).not.toEqual(before);
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
