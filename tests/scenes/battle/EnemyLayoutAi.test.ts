import { describe, it, expect } from 'vitest';
import { computeEnemyLayoutAi, ENEMY_AREA, type EnemyBoxInput, type EnemyBox, type EnemySizeClass } from '../../../src/scenes/battle/EnemyLayoutAi.js';

const BOX: Record<EnemySizeClass, number> = { small: 160, large: 256, boss: 400 };
const box = (size: EnemySizeClass): EnemyBoxInput => ({ size, w: BOX[size], h: BOX[size] });

function rect(b: EnemyBox) {
  return { l: b.x - b.w / 2, r: b.x + b.w / 2, t: b.feetY - b.h, btm: b.feetY };
}

function check(input: EnemyBoxInput[]): EnemyBox[] {
  const out = computeEnemyLayoutAi(input);
  expect(out).toHaveLength(input.length);
  const rs = out.map(rect);
  for (const r of rs) {
    expect(r.l).toBeGreaterThanOrEqual(ENEMY_AREA.x0);
    expect(r.r).toBeLessThanOrEqual(ENEMY_AREA.x1);
    expect(r.t).toBeGreaterThanOrEqual(ENEMY_AREA.y0);
    expect(r.btm).toBeLessThanOrEqual(ENEMY_AREA.y1);
  }
  for (let i = 0; i < rs.length; i++) {
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      const overlap = a.l < b.r && b.l < a.r && a.t < b.btm && b.t < a.btm;
      expect(overlap, `boxes ${i} and ${j} overlap for ${input.map((x) => x.size).join(',')}`).toBe(false);
    }
  }
  return out;
}

describe('computeEnemyLayoutAi', () => {
  it('fits every size mix up to 9 enemies with at most one boss, without overlaps', () => {
    let cases = 0;
    for (let bosses = 0; bosses <= 1; bosses++) {
      for (let large = 0; large <= 9 - bosses; large++) {
        for (let small = 0; small <= 9 - bosses - large; small++) {
          if (bosses + large + small === 0) continue;
          const input = [
            ...Array.from({ length: bosses }, () => box('boss')),
            ...Array.from({ length: large }, () => box('large')),
            ...Array.from({ length: small }, () => box('small')),
          ];
          check(input);
          cases++;
        }
      }
    }
    expect(cases).toBe(99); // 54 without a boss + 45 with one
  });

  it('keeps 2x art at full size for the debug scenario mixes', () => {
    for (const mix of [['small', 'small', 'small'], ['large', 'large'], ['boss', 'small', 'small'],
      Array(9).fill('small')] as EnemySizeClass[][]) {
      expect(check(mix.map(box)).every((b) => b.scaleFactor === 1)).toBe(true);
    }
  });

  it('shrinks to half size only when the group is wider than the area', () => {
    const wide = check(Array.from({ length: 9 }, () => box('large')));
    expect(wide.every((b) => b.scaleFactor === 0.5)).toBe(true);
  });

  it('keeps enemy order stable: output index matches input index', () => {
    const out = check([box('small'), box('boss'), box('large')]);
    expect(out[1].w).toBe(BOX.boss);
    expect(out[2].w).toBe(BOX.large);
    expect(out[0].w).toBe(BOX.small);
  });
});
