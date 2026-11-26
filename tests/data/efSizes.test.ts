/**
 * EF-A / EF-B (docs/ENEMY_FEEDBACK_PLAN.md) on the committed atlas and table: the hi-res sheets match
 * gen/monster_scale.yaml (a stale atlas fails here), their rects sit on whole texture px inside `filter: linear`
 * pages with a transparent 1-px gutter (A4), the page / GPU budget (A4), the B1 sibling pins (NEW_MONSTER_GUIDE.md
 * 1.4) with their screen heights, and the per-sheet pass report of every real formation holding a B1 sheet (A5).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { formationFits, layoutPass } from '../../src/scenes/battle/EnemyLayoutAi.js';
import { atlas, enemyById, idleBoxOf, layoutInput } from '../helpers/atlasFrames.js';
import { monsterSheetPng } from '../helpers/monsterAtlas.js';
import { monsterSpriteKey } from '../../src/rendering/BattleArt.js';
import { texLen, texPos } from '../../src/rendering/texPx.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
type Entry = number | { scale: number; tex?: number; smooth?: string[] };
const table = parse(readFileSync(join(root, 'assets-src/gen/monster_scale.yaml'), 'utf-8')) as Record<string, Entry>;
const scaleOf = (e: Entry): number => (typeof e === 'number' ? e : e.scale);
const texOf = (e: Entry): number => (typeof e === 'number' ? 1 : e.tex ?? 1);

const B1 = ['gr_imp', 'werewolf', 'ghast', 'shadow', 'gargoyle', 'bloodbones', 'piscodemon', 'mummy', 'horned_devil',
  'mindflayer', 'weretiger', 'sahagin_prince', 'gr_wolf',
  'ogre_chief', 'troll', 'sphinx', 'manticore', 'clay_golem', 'tyrannosaur', 'rhyos', 'iron_golem',
  'stone_golem', 'sea_troll', 'winter_wolf', 'ogre_mage'];   // EF-H batch 3: medusa, earth_medusa, king_mummy, rakshasa, death_knight, chimera left (at 2)
/** (lesser, greater) sibling pairs the B1 sizes must keep in order (NEW_MONSTER_GUIDE.md 1.4; EF-B1). */
/** EF-H batch 2: black_knight (the user's render, large at 2, idle 188 px) left B1; EF-H batch 3: death_knight (the
 *  user's render, large at 2, idle 196 px) ends the batch-2 inversion; chimera and medusa at 2 keep their pairs. */
const SIBLINGS: [string, string][] = [['black_knight', 'death_knight'], ['clay_golem', 'stone_golem'], ['stone_golem', 'iron_golem'],
  ['manticore', 'chimera'], ['troll', 'sea_troll'], ['gr_wolf', 'winter_wolf'], ['ogre_chief', 'ogre_mage'],
  ['mummy', 'king_mummy'], ['medusa', 'earth_medusa'], ['ogre', 'ogre_chief'], ['wolf', 'gr_wolf'], ['goblin', 'gr_imp']];

/** int-ef2 (user ruling 2026-11-24): the tougher siblings grown to at least their lesser sibling's height, each the
 *  smallest multiple of 0.05 that does it (iron also >= stone: toughness order clay <= stone <= iron). */
const EF_GROW: Record<string, number> = { stone_golem: 2.8, iron_golem: 3.3, sea_troll: 2.7 };
const GROWN: [string, string][] = [['clay_golem', 'stone_golem'], ['stone_golem', 'iron_golem'], ['clay_golem', 'iron_golem'],
  ['troll', 'sea_troll']];
/** The extra atlas pages over the 12 before EF (monster_hires_pages.MAX_EXTRA_PAGES). */
const MAX_EXTRA_PAGES = Number(/^MAX_EXTRA_PAGES = (\d+)/m.exec(
  readFileSync(join(root, 'assets-src/gen/monster_hires_pages.py'), 'utf-8'))![1]);

const hires = Object.entries(table).filter(([, e]) => texOf(e) !== 1).map(([s]) => s).sort();
const screenH = (s: string): number => { const b = idleBoxOf(s); return (b[3] - b[1] + 1) * (atlas.sheets[s].scale ?? atlas.scale); };

/** Every encounter entry's maximum roll over the legacy and compiled maps (crossFileValidation's tables). */
function formations(): string[][] {
  type Enc = { enemies?: string[]; groups?: { id: string; min: number; max?: number }[] };
  const dirs = [join(root, 'assets/maps'), join(root, 'assets/maps/ai')];
  const out: string[][] = [];
  for (const d of dirs) {
    for (const f of readdirSync(d).filter((x) => x.endsWith('.yaml') && x !== 'index.yaml')) {
      const m = parse(readFileSync(join(d, f), 'utf-8')) as { encounters?: Enc[]; encounterZones?: { encounters: Enc[] }[] };
      for (const e of [...(m.encounters ?? []), ...(m.encounterZones ?? []).flatMap((z) => z.encounters)]) {
        out.push(e.groups ? e.groups.flatMap((g) => Array<string>(g.max ?? g.min).fill(g.id)) : e.enemies ?? []);
      }
    }
  }
  return out;
}

describe('EF-A hi-res sheets in the atlas', () => {
  it('the atlas matches gen/monster_scale.yaml: scale and texScale per sheet (52 hi-res sheets; EF-H: dark_wizard, pirate, vampire, vampire_lord; batch 2: fire_hydra, fire_lizard, black_knight; batch 3: + buccaneer, dark_fighter, dragon_zombie, evil_eye, white_dragon)', () => {
    // the scale-3 B2 sheets (shark, hydra) are at tex 1 with despur only (A4's budget
    // fallback); int-ef2 (user ruling 2026-11-24): blue_dragon and green_dragon at tex 3; ef-horse: crazy_horse at
    // tex 2 (the EF smoothing rule)
    expect(hires.length).toBe(53);   // EF-H batch 2: fire_hydra tex 1 -> 2; batch 3: buccaneer, dark_fighter new, dragon_zombie, evil_eye and white_dragon tex 1 -> 2
    expect(['blue_dragon', 'green_dragon'].map((s) => texOf(table[s]))).toEqual([2, 2]);   // EF-H batch 3: the user's renders at tex 2
    for (const [s, e] of Object.entries(table)) {
      expect([atlas.sheets[s].scale, atlas.sheets[s].texScale ?? 1], s).toEqual([scaleOf(e), texOf(e)]);
    }
  });

  it('every hi-res rect is on whole texture px inside its linear page, with a transparent ring round it', () => {
    for (const s of hires) {
      const v = atlas.sheets[s];
      const t = v.texScale!;
      const page = atlas.pages[v.page ?? 0] as { w: number; h: number; filter?: string };
      expect(page.filter, s).toBe('linear');
      const img = monsterSheetPng(s);
      const [w, h] = [texLen(v.cell[0], t), texLen(v.cell[1], t)];
      for (const [name, [x, y]] of Object.entries(v.frames)) {
        const [px, py] = [texPos(x, t), texPos(y, t)];
        expect(Math.abs(px - x * t) < 1e-6 && Math.abs(py - y * t) < 1e-6 && px + w <= page.w && py + h <= page.h, `${s} ${name}`).toBe(true);
        let ring = 0;
        for (let yy = Math.max(py - 1, 0); yy < Math.min(py + h + 1, img.height); yy++) {
          for (let xx = Math.max(px - 1, 0); xx < Math.min(px + w + 1, img.width); xx++) {
            const inner = xx > px && xx < px + w - 1 && yy > py && yy < py + h - 1;
            if (!inner && img.data[(yy * img.width + xx) * 4 + 3] !== 0) ring++;
          }
        }
        expect(ring, `${s} ${name}: opaque px on the gutter`).toBe(0);
      }
    }
  });

  it('budget: <= MAX_EXTRA_PAGES pages over the 12 before EF, preload + the largest real formation <= 8 x 16 MB of GPU memory', () => {
    const pages = atlas.pages as { w: number; h: number; filter?: string }[];
    const bytes = (p: number): number => pages[p].w * pages[p].h * 4 * (pages[p].filter === 'linear' ? 4 / 3 : 1);
    const preload = (atlas as unknown as { preload: number[] }).preload;
    let worst = 0;
    for (const ids of formations()) {
      const used = new Set([...preload, ...ids.map((id) => atlas.sheets[monsterSpriteKey(enemyById(id))]?.page ?? 0)]);
      worst = Math.max(worst, [...used].reduce((sum, p) => sum + bytes(p), 0));
    }
    const hires = pages.filter((p) => p.filter === 'linear').length;
    const extra = pages.length - 12;                               // the 12 pages before EF (3ba8aa91)
    console.log(`EF-A4 budget: ${pages.length} pages (${extra} extra, ${hires} hi-res), preload ${preload.join(',')}, `
      + `worst preload + formation ${(worst / 2 ** 20).toFixed(1)} MB`);
    expect(extra).toBeLessThanOrEqual(MAX_EXTRA_PAGES);            // EF-A/B's 14 + EF-D's chaos page + int-ef2's dragons + crazy_horse's hi-res page (ef-horse)
    expect(worst).toBeLessThanOrEqual(8 * 2048 * 2048 * 4);
    const act1 = ['goblin', 'gr_imp', 'gr_wolf', 'mummy', 'troll', 'ogre', 'dragon'].map((s) => atlas.sheets[s].page ?? 0);
    expect(act1.every((p) => preload.includes(p))).toBe(true);     // D-K13: every act-1 sheet stays preloaded
  });
});

describe('EF-B1 sizes', () => {
  it('the 25 B1 sheets are at 2.5 (int-ef2: EF_GROW\'s 3 above it); no lesser sibling outgrows its greater one', () => {
    expect(new Set(B1).size).toBe(25);
    for (const s of B1) expect(scaleOf(table[s]), s).toBe(EF_GROW[s] ?? 2.5);
    for (const [a, b] of GROWN) expect(screenH(b), `${b} at least as tall as ${a}`).toBeGreaterThanOrEqual(screenH(a));
    // the smallest 0.05 step: one step less would leave it shorter than its target
    const want: Record<string, number> = { stone_golem: screenH('clay_golem'), iron_golem: screenH('stone_golem'), sea_troll: screenH('troll') };
    for (const [s, target] of Object.entries(want)) {
      const b = idleBoxOf(s);
      expect((b[3] - b[1] + 1) * (EF_GROW[s] - 0.05), `${s} one step down`).toBeLessThan(target);
    }
    const rows = SIBLINGS.map(([a, b]) => `${a} ${screenH(a)} / ${b} ${screenH(b)}`);
    console.log(`EF-B1 sibling screen heights (idle px): ${rows.join('; ')}`);
    // EF-H batch 3: a greater sibling that is the user's render at its native size (chimera, king_mummy, death_knight,
    // earth_medusa at scale 2) keeps the order by its screen height instead of its scale; king_mummy / mummy are
    // "equal" (182 vs 182.5 px, within 1 px: the orchestrator's ruling, equal is acceptable)
    const USER = new Set(['chimera', 'king_mummy', 'death_knight', 'earth_medusa']);
    const EQUAL: Record<string, number> = { king_mummy: 1 };
    for (const [a, b] of SIBLINGS) {
      const sa = atlas.sheets[a].scale ?? atlas.scale;
      const sb = atlas.sheets[b].scale ?? atlas.scale;
      if (USER.has(b)) expect(screenH(b), `${b} at least as tall as ${a}`).toBeGreaterThanOrEqual(screenH(a) - (EQUAL[b] ?? 0));
      else expect(sb, `${b} scale >= ${a}`).toBeGreaterThanOrEqual(sa);
    }
  });

  it('pass report: every real formation with a B1 sheet still fits; the count reaching pass 4', () => {
    const report = new Map<string, number[]>();
    let pass4 = 0;
    for (const ids of formations()) {
      const sheets = new Set(ids.map((id) => monsterSpriteKey(enemyById(id))).filter((s) => B1.includes(s)));
      if (!sheets.size) continue;
      const boxes = ids.map(layoutInput);
      const pass = layoutPass(boxes);
      expect(formationFits(boxes), ids.join(',')).toBe(true);
      if (pass === 4) pass4++;
      for (const s of sheets) report.set(s, [...(report.get(s) ?? []), pass]);
    }
    const line = [...report].sort().map(([s, p]) => `${s} ${p.join('')}`).join('; ');
    console.log(`EF-A5 pass report (sheet: the pass of each formation): ${line}; formations at pass 4: ${pass4}`);
    expect(report.size).toBeGreaterThan(0);
  });
});

describe('EF-H batch 3 sibling heights (the user renders at scale 2)', () => {
  it('medusa and earth_medusa stand equally tall; death_knight at least as tall as black_knight (the batch-2 inversion gone)', () => {
    expect(screenH('earth_medusa')).toBe(screenH('medusa'));
    expect(screenH('death_knight')).toBeGreaterThanOrEqual(screenH('black_knight'));
  });
});
