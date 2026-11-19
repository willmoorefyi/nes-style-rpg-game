/**
 * SMOKE experiment: the volcano smoke options behind the dev switch `?smoke=a..f` (src/scenes/exploration/smoke/).
 */
import { describe, it, expect, vi } from 'vitest';
import { Container } from 'pixi.js';
import { SMOKE_STYLES, smokeStyleFromSearch } from '../../../src/scenes/exploration/smoke/smokeStyles.js';
import { createSmokeFrame, DITHER_LEVELS, fadeLevel, smokeState } from '../../../src/scenes/exploration/smoke/smokeMotion.js';
import { CLUSTER, cloudShape, rgb15 } from '../../../src/scenes/exploration/smoke/smokeShapes.js';
import { SmokeColumn } from '../../../src/scenes/exploration/smoke/SmokeColumn.js';
import { FieldAmbient } from '../../../src/scenes/exploration/FieldAmbient.js';
import { createMapData } from '../../helpers/testUtils.js';

describe('smoke options', () => {
  it('has 6 options a..f, picked by ?smoke=', () => {
    expect(SMOKE_STYLES.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(smokeStyleFromSearch('?mute=1&smoke=e')?.id).toBe('e');
    expect(smokeStyleFromSearch('?mute=1')).toBeNull();
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(smokeStyleFromSearch('?smoke=z')).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('rgb15 expands 5-bit channels like snes_palette.c15', () => {
    expect(rgb15(31, 0, 16)).toBe(0xff0084);
  });

  it.each(SMOKE_STYLES.map((s) => [s.id, s] as const))('%s loops on whole art px, in its radius range', (_, style) => {
    const f = createSmokeFrame(style);
    const at = (ms: number) => JSON.parse(JSON.stringify(smokeState(style, ms, f).puffs.map((p) => [p.dx, p.dy, p.r])));
    for (const t of [0, 700, 1900]) expect(at(t + style.periodMs)).toEqual(at(t));
    for (let k = 0; k < 30; k++) {
      for (const p of smokeState(style, (k * style.periodMs) / 30, f).puffs) {
        expect(Number.isInteger(p.dx) && Number.isInteger(p.dy)).toBe(true);
        expect(p.r).toBeGreaterThanOrEqual(style.r0);
        expect(p.r).toBeLessThanOrEqual(style.r1);
        expect(p.level).toBeGreaterThanOrEqual(0);
        expect(p.level).toBeLessThanOrEqual(DITHER_LEVELS);
      }
    }
  });

  it('fades by dither levels: solid in mid-life, hidden at the end', () => {
    expect(fadeLevel(0.3, 0.6)).toBe(0);
    expect(fadeLevel(0.7, 0.6)).toBeGreaterThan(0);
    expect(fadeLevel(0.999, 0.6)).toBe(DITHER_LEVELS);
  });

  it('a cluster is outlined, and a dither level drops pixels', () => {
    const solid = cloudShape(10, CLUSTER).join('');
    const sparse = cloudShape(10, CLUSTER, { level: 2 }).join('');
    expect(solid).toContain('1');
    expect(solid).toContain('4');
    const count = (s: string) => [...s].filter((c) => c !== '0').length;
    expect(count(sparse)).toBeLessThan(count(solid) * 0.7);
  });

  it('a column draws every option without throwing, and FieldAmbient uses it when given a style', () => {
    for (const style of SMOKE_STYLES) {
      const col = new SmokeColumn(style, 2);
      for (let ms = 0; ms < 6000; ms += 97) col.draw(ms);
      expect(col.root.children.length).toBeGreaterThanOrEqual(style.puffs);
      col.destroy();
    }
    const world = new Container();
    const fx = new FieldAmbient(SMOKE_STYLES[4]);
    fx.setMap(createMapData({ width: 6, height: 6, ambient: [{ kind: 'smoke', x: 2, y: 2 }] }), world, 96);
    fx.update(10);
    expect((world.children[0] as Container).children.length).toBe(SMOKE_STYLES[4].puffs);
    fx.clear();
  });
});
