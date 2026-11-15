import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeEnemyLayoutAi, formationFits, ENEMY_AREA, type EnemyBoxInput, type EnemyBox, type EnemySizeClass } from '../../../src/scenes/battle/EnemyLayoutAi.js';
import { monsterSpriteKey } from '../../../src/rendering/BattleArt.js';
import { atlas, enemyData, frameBox, layoutInput } from '../../helpers/atlasFrames.js';

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

describe('formationFits (T4c)', () => {
  const many = (size: EnemySizeClass, n: number) => Array.from({ length: n }, () => box(size));

  it('is true for 9 small enemies, 9 large ones (half size) and a boss with 8 small', () => {
    expect(formationFits(many('small', 9))).toBe(true);
    expect(formationFits(many('large', 9))).toBe(true);
    expect(formationFits([box('boss'), ...many('small', 8)])).toBe(true);
  });

  it('is false for 5 large + 6 small (more than 9) and for an empty formation', () => {
    expect(formationFits([...many('large', 5), ...many('small', 6)])).toBe(false);
    expect(formationFits([])).toBe(false);
  });

  it('is false when the boxes overflow the area even at half size', () => {
    expect(formationFits(many('boss', 9))).toBe(false);
  });
});

/** Opaque packing (docs/ROSTER_FIX_PLAN.md defect 2): boxes from the real atlas (cell and FW-A `homeX`). */
describe('large crowds pack by their home art (defect 2)', () => {
  const opaqueRect = (b: EnemyBox, input: EnemyBoxInput) => {
    const left = b.x - b.w / 2;
    return { l: left + (input.ox0 ?? 0) * b.scaleFactor, r: left + (input.ox1 ?? input.w) * b.scaleFactor, t: b.feetY - b.h, btm: b.feetY };
  };
  /** Lays out `ids`; every opaque rect inside ENEMY_AREA and no two overlapping. */
  function packed(ids: string[]): EnemyBox[] {
    const inputs = ids.map(layoutInput);
    const out = computeEnemyLayoutAi(inputs);
    const rs = out.map((b, i) => opaqueRect(b, inputs[i]));
    for (const r of rs) {
      expect(r.l >= ENEMY_AREA.x0 && r.r <= ENEMY_AREA.x1 && r.t >= ENEMY_AREA.y0 && r.btm <= ENEMY_AREA.y1, ids.join()).toBe(true);
    }
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i], b = rs[j];
        expect(a.l < b.r && b.l < a.r && a.t < b.btm && b.t < a.btm, `${ids[i]} ${i} overlaps ${ids[j]} ${j}`).toBe(false);
      }
    }
    expect(formationFits(inputs)).toBe(true);
    return out;
  }
  const homeWidth = (sheet: string) => { const [l, r] = atlas.sheets[sheet].homeX!; return r - l + 1; };

  it('the play-test crowd lays out at scale factor 1; the dragon\'s rect holds its breath', () => {
    const crowd = ['ogre', 'troll', 'dragon', 'crazy_horse', 'gigas_worm', 'ogre_chief', 'shark', 'anaconda', 'minotaur'];
    const out = packed(crowd);
    expect(out.map((b) => b.scaleFactor)).toEqual(Array(9).fill(1));
    const d = crowd.indexOf('dragon');
    const rect = opaqueRect(out[d], layoutInput('dragon'));
    const left = out[d].x - out[d].w / 2;
    for (const fr of ['idle', 'atk_wind1', 'atk_wind2', 'atk_mid', 'attack', 'atk_follow', 'atk_recover'] as const) {
      const [l, , r] = frameBox('dragon', fr);
      expect(left + l * atlas.scale, fr).toBeGreaterThanOrEqual(rect.l);
      expect(left + r * atlas.scale, fr).toBeLessThanOrEqual(rect.r);
    }
  });

  it('nine of every large sheet whose home art is <= 118 px wide lay out at scale factor 1 (27 sheets)', () => {
    const large = [...new Set(enemyData.filter((e) => e.size === 'large').map((e) => monsterSpriteKey(e)))];
    const s = large.filter((k) => atlas.sheets[k] && homeWidth(k) <= 118);
    expect(s.length).toBe(27);
    for (const sheet of s) {
      const id = enemyData.find((e) => e.size === 'large' && monsterSpriteKey(e) === sheet)!.id;
      expect(packed(Array(9).fill(id)).every((b) => b.scaleFactor === 1), sheet).toBe(true);
    }
  });

  it('nine fire_lizards (207 px) and nine white_crocodiles (169 px) still fall to half size', () => {
    for (const id of ['fire_lizard', 'white_crocodile']) {
      expect(packed(Array(9).fill(id)).every((b) => b.scaleFactor === 0.5), id).toBe(true);
    }
  });

  it('reproduces every golden f = 1 layout (stored inputs and outputs, 95b31e2)', () => {
    const golden = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '__golden__/layout_f1.json'), 'utf-8')) as
      { cases: { source: string; inputs: EnemyBoxInput[]; out: EnemyBox[] }[] };
    expect(golden.cases.length).toBe(33);
    for (const c of golden.cases) expect(computeEnemyLayoutAi(c.inputs), c.source).toEqual(c.out);
  });
});
