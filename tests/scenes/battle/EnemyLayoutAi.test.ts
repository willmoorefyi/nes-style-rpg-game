import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeEnemyLayoutAi, formationFits, layoutSizeOf, ENEMY_AREA, TITAN_AREA, type EnemyBoxInput, type EnemyBox, type EnemySizeClass } from '../../../src/scenes/battle/EnemyLayoutAi.js';
import { seededRng } from '../../../src/scenes/battle/fx/emitterCore.js';
import { TRAVEL_CLEAR_Y } from '../../../src/scenes/battle/enemyReach.js';
import { monsterSpriteKey } from '../../../src/rendering/BattleArt.js';
import { atlas, enemyById, enemyData, formRecords, frameBox, layoutInput, sheetScale } from '../../helpers/atlasFrames.js';

const BOX: Record<EnemySizeClass, number> = { small: 160, large: 256, huge: 384, boss: 400, titan: 600 };
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

// CHAOS_FORMS_PLAN R11: the atlas helper's enemy list (walked by the sprite-iterating tests) leaves out exactly the 3
// boss form records; they are colossus forms (ColossusView), never laid out by computeEnemyLayoutAi
describe('the atlas enemy list and the boss form records', () => {
  it('the formOf filter excludes exactly chaos_orrery, chaos_horizon and chaos_horizon_core', () => {
    expect(formRecords.map((e) => e.id)).toEqual(['chaos_orrery', 'chaos_horizon', 'chaos_horizon_core']);
    expect(formRecords.every((e) => e.formOf === 'chaos' && e.colossus !== undefined)).toBe(true);
    expect(enemyData.some((e) => e.formOf)).toBe(false);
    expect(enemyById('chaos_horizon').id).toBe('chaos_horizon');
  });
});

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
/** V4: the play-test crowd's shown screen scales (sheet scale x factor), measured: the 3 tier-H sheets at pass 3
 *  (factor 2/3 of scale 3), the 6 tier-L at factor 1, every one at 2 screen px per art px. */
const CROWD_SHOWN = [2, 2, 2, 2, 2, 2, 2, 2, 2];
/** V4: nine bigeyes, measured: pass 3 (factor 2/3), 2 screen px per art px. */
const BIGEYES_NINE = 2;
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

  // V4 (REDESIGN_PLAN 2.6): dragon, shark and minotaur are tier H (scale 3) now, so the nine no longer fit at factor 1;
  // re-stated: whole screen scales, no overlap, and the dragon's rect still holds its breath at its shown scale (the
  // 6 tier-L members alone at factor 1 and 3 tier-H side by side are pinned in the TS-2 block below)
  it('the play-test crowd (3 tier-H since V4) lays out with whole screen scales and no overlap; the dragon\'s rect holds its breath', () => {
    // V8: the regenerated crazy_horse (home art 126 art px) no longer fits this crowd at a whole scale (the sandbox refuses
    // it, F8); the crowd keeps its shape with nightmare in that slot
    const crowd = ['ogre', 'troll', 'dragon', 'nightmare', 'gigas_worm', 'ogre_chief', 'shark', 'anaconda', 'minotaur'];
    const out = packed(crowd);
    const shown = out.map((b, i) => sheetScale(crowd[i]) * b.scaleFactor);
    expect(shown, 'measured at V4').toEqual(CROWD_SHOWN);
    const d = crowd.indexOf('dragon');
    const rect = opaqueRect(out[d], layoutInput('dragon'));
    const left = out[d].x - out[d].w / 2;
    for (const fr of ['idle', 'atk_wind1', 'atk_wind2', 'atk_mid', 'attack', 'atk_follow', 'atk_recover'] as const) {
      const [l, , r] = frameBox('dragon', fr);
      expect(left + l * shown[d], fr).toBeGreaterThanOrEqual(rect.l);
      expect(left + r * shown[d], fr).toBeLessThanOrEqual(rect.r);
    }
  });

  it('nine of every tier-L sheet whose home art is <= 236 screen px wide lay out at scale factor 1 (26 sheets, re-measured at V8 W4)', () => {
    const large = [...new Set(enemyData.filter((e) => e.size === 'large').map((e) => monsterSpriteKey(e)))];
    const s = large.filter((k) => atlas.sheets[k] && homeWidth(k) * sheetScale(k) <= 236);
    // 46 at fix pass 2 G4 (45 at F5 + white_shark; 118 art px at scale 2); V4 (REDESIGN_PLAN 2.6): the 20 of them now
    // `huge` (tier H) leave the large class: 26. bigeyes joins the large class at scale 3 but its home art is 87 x 3 =
    // 261 screen px, so it is not in this set (nine bigeyes: the next case). V6: the pass-V guardian (128 cell, home art
    // 118 art px = 236 screen px; the retired hound was 274) joins the set: 27. V8 W4 (REDESIGN_FIX_PLAN F1): the R321
    // crazy_horse (132 cell, home art 2-127 = 126 art px = 252 screen px, its hurt recoils to x 2; R290 was 98) leaves: 26
    expect(s.length).toBe(26);
    for (const sheet of s) {
      const id = enemyData.find((e) => e.size === 'large' && monsterSpriteKey(e) === sheet)!.id;
      expect(packed(Array(9).fill(id)).every((b) => b.scaleFactor === 1), sheet).toBe(true);
    }
  });

  it('nine bigeyes (large at scale 3 since V4) lay out with whole screen scales, inside the area, no overlap', () => {
    const out = packed(Array(9).fill('bigeyes'));
    expect(out.map((b) => 3 * b.scaleFactor), 'measured at V4').toEqual(Array(9).fill(BIGEYES_NINE));
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

/**
 * TS-2 (docs/REDESIGN_PLAN.md 2.5, 2.6, 4.2), on the real data since V4: the 23 rescaled sheets as the layout sees them
 * (tier H `huge` in enemies.yaml at the FW-S sheet scale 3, bigeyes `large` at scale 3), the titan alone in TITAN_AREA
 * (a fixture until the chaos titan sheet is integrated).
 */
describe('integer screen scales, tier H and the titan (TS-2)', () => {
  const TIER_H = ['shark', 'minotaur', 'ochu', 'neochu', 'hydra', 'earth_elemental', 'fire_elemental', 'water_elemental',
    'air_elemental', 'hill_gigas', 'fire_gigas', 'ice_gigas', 'dragon', 'white_dragon', 'blue_dragon', 'green_dragon',
    'dragon_zombie', 'white_shark', 'minotaur_zombie', 'fire_hydra', 'deepeyes', 'evil_eye'];
  /** An enemy's layout input from the real data (V4: the sheet scale and size are in the atlas and enemies.yaml). */
  const rescaled = layoutInput;

  it('the 23 rescaled sheets, chaos and hollow_seraph have scale 3 in the atlas and their size in enemies.yaml; no other sheet has a scale', () => {
    for (const id of [...TIER_H, 'bigeyes']) {
      expect([layoutInput(id).size, layoutInput(id).scale], id).toEqual([id === 'bigeyes' ? 'large' : 'huge', 3]);
    }
    // V6 (REDESIGN_PLAN 4.2, D-V6 = C2): chaos keeps `size: boss`, is shown at scale 3 and laid out as the titan class
    expect(enemyData.find((e) => e.id === 'chaos')!.size).toBe('boss');
    expect([layoutInput('chaos').size, layoutInput('chaos').scale]).toEqual(['titan', 3]);
    expect([layoutSizeOf('boss', 3), layoutSizeOf('boss', 2), layoutSizeOf('huge', 3), layoutSizeOf(undefined, 3)])
      .toEqual(['titan', 'boss', 'huge', 'small']);
    // V8 N-1: hollow_seraph (and hollow_seraph_2) keep `size: boss` at scale 3; their art (471 px) fits ENEMY_AREA (545),
    // so they stay the boss class; chaos's art (582 px) does not, so it stays the titan class
    expect([layoutSizeOf('boss', 3, 545), layoutSizeOf('boss', 3, 546), layoutSizeOf('boss', 3, undefined)])
      .toEqual(['boss', 'titan', 'titan']);
    for (const id of ['hollow_seraph', 'hollow_seraph_2']) {
      expect(enemyData.find((e) => e.id === id)!.size, id).toBe('boss');
      expect([layoutInput(id).size, layoutInput(id).scale, layoutInput(id).oy0], id).toEqual(['boss', 3, 129]);
    }
    const scaled = Object.keys(atlas.sheets).filter((s) => atlas.sheets[s].scale !== undefined).sort();
    expect(scaled).toEqual([...TIER_H, 'bigeyes', 'chaos', 'hollow_seraph'].sort());
  });
  const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-9;
  const screenScales = (inputs: EnemyBoxInput[]) =>
    computeEnemyLayoutAi(inputs).map((b, i) => (inputs[i].scale ?? 2) * b.scaleFactor);
  const H = (): EnemyBoxInput => ({ size: 'huge', w: 384, h: 384, scale: 3 });
  const TITAN: EnemyBoxInput = { size: 'titan', w: 600, h: 600, scale: 2 };

  it('the 22 tier-H fixtures exist in the atlas at 128-144 px cells (384-432 px boxes at scale 3)', () => {
    for (const id of TIER_H) {
      const b = rescaled(id);
      expect(b.h, id).toBe(384);
      expect(b.w, id).toBeGreaterThanOrEqual(384);
      expect(b.w, id).toBeLessThanOrEqual(432);
    }
  });

  it('every box of every real formation (golden and rescaled) and of 1,000 seeded random formations has a whole screen scale', () => {
    const golden = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '__golden__/layout_f1.json'), 'utf-8')) as
      { cases: { enemies: string[]; inputs: EnemyBoxInput[] }[] };
    const formations: EnemyBoxInput[][] = golden.cases.flatMap((c) => [c.inputs, c.enemies.map(rescaled)]);
    const pool = [...new Set(enemyData.map((e) => e.id))].filter((id) => atlas.sheets[monsterSpriteKey(enemyData.find((e) => e.id === id)!)]);
    const rng = seededRng(20261116);
    for (let k = 0; k < 1000; k++) {
      if (k % 50 === 0) { formations.push([TITAN]); continue; }
      const n = 1 + Math.floor(rng() * 9);
      formations.push(Array.from({ length: n }, () => rescaled(pool[Math.floor(rng() * pool.length)])));
    }
    let boxes = 0;
    for (const f of formations) {
      for (const s of screenScales(f)) { expect(whole(s), `${s} in ${f.map((b) => b.size).join(',')}`).toBe(true); boxes++; }
    }
    expect(boxes).toBeGreaterThan(4000);
  });

  it('3 tier-H sheets lay out side by side at factor 1 (3 x 384 + 2 x 24 = 1200 <= 1260)', () => {
    const out = check([rescaled('shark'), rescaled('minotaur'), rescaled('hydra')]);
    expect(out.map((b) => b.scaleFactor)).toEqual([1, 1, 1]);
    expect(formationFits([rescaled('shark'), rescaled('minotaur'), rescaled('hydra')])).toBe(true);
  });

  it('3 green_dragons (432 px cells) fit at factor 1 only by opaque packing', () => {
    const g = Array.from({ length: 3 }, () => rescaled('green_dragon'));
    expect(computeEnemyLayoutAi(g).map((b) => b.scaleFactor)).toEqual([1, 1, 1]);
    expect(formationFits(g)).toBe(true);
  });

  it('the play-test crowd with dragon, shark and minotaur rescaled: whole scales, no overlap; the 6 tier-L at factor 1 alone', () => {
    // V8: the regenerated crazy_horse (home art 126 art px) no longer fits this crowd at a whole scale (the sandbox refuses
    // it, F8); the crowd keeps its shape with nightmare in that slot
    const crowd = ['ogre', 'troll', 'dragon', 'nightmare', 'gigas_worm', 'ogre_chief', 'shark', 'anaconda', 'minotaur'];
    const inputs = crowd.map(rescaled);
    expect(screenScales(inputs).every(whole)).toBe(true);
    expect(formationFits(inputs)).toBe(true);
    const large = crowd.filter((id) => !TIER_H.includes(id));
    expect(large).toHaveLength(6);
    expect(check(large.map(rescaled)).every((b) => b.scaleFactor === 1)).toBe(true);
  });

  it('pass 3: a tier-H mix that overflows full size shows the scale-3 boxes at screen scale 2, the rest at full size', () => {
    const mix = [H(), H(), H(), box('small'), box('small'), box('small')];
    expect(screenScales(mix)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(computeEnemyLayoutAi(mix).slice(0, 3).map((b) => b.w)).toEqual([256, 256, 256]);
    expect(formationFits(mix)).toBe(true);
  });

  it('pass 4 with a scale-3 sheet is refused: 5 full-width tier-H boxes (4 still fit at screen scale 2)', () => {
    expect(formationFits(Array.from({ length: 4 }, H))).toBe(true);
    const five = Array.from({ length: 5 }, H);
    expect(screenScales(five)).toEqual([1, 1, 1, 1, 1]);
    expect(formationFits(five)).toBe(false);
  });

  it('formations without a scale-3 sheet keep the old passes: 9 large still at half size', () => {
    expect(computeEnemyLayoutAi(Array.from({ length: 9 }, () => ({ ...box('large'), scale: 2 }))).every((b) => b.scaleFactor === 0.5)).toBe(true);
  });

  it('the titan stands alone in TITAN_AREA, its top under the message window; never with another enemy', () => {
    const [b] = computeEnemyLayoutAi([TITAN]);
    expect(b.scaleFactor).toBe(1);
    expect(b.feetY).toBeLessThanOrEqual(TITAN_AREA.y1);
    expect(b.feetY - b.h).toBeGreaterThanOrEqual(TITAN_AREA.y0);
    expect(TITAN_AREA.y0).toBeGreaterThanOrEqual(TRAVEL_CLEAR_Y);
    expect(formationFits([TITAN])).toBe(true);
    expect(formationFits([TITAN, box('small')])).toBe(false);
  });

  it('layout_f1.json is byte-identical when recomputed (none of its formations has a scale-3 sheet)', () => {
    const file = join(dirname(fileURLToPath(import.meta.url)), '__golden__/layout_f1.json');
    const text = readFileSync(file, 'utf-8');
    const golden = JSON.parse(text) as { note: string; cases: { inputs: EnemyBoxInput[]; out: EnemyBox[] }[] };
    expect(golden.cases.every((c) => c.inputs.every((i) => (i.scale ?? 2) !== 3))).toBe(true);
    const again = { ...golden, cases: golden.cases.map((c) => ({ ...c, out: computeEnemyLayoutAi(c.inputs) })) };
    expect(`${JSON.stringify(again, null, 1)}\n`).toBe(text);
  });
});
