/**
 * Pass PT (docs/PLAYTEST_ART_PLAN.md 6.3): the user-rendered NPC field sheets (ChatGPT renders imported by
 * assets-src/gen/field_user.py from assets-src/gen/user_art/): provenance, format, size bands, the walk, the broom's
 * hop, and the 2x field atlas. Where the maps place them is checked at the reassignment (PT-5).
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { readRgbaPng } from '../helpers/pngAlpha.js';

type Recipe = { file: string; sha256: string; band: 'adult' | 'old' | 'child' | 'broom'; walk?: string };
const recipes = parse(readFileSync('assets-src/gen/field_user.yaml', 'utf-8')) as Record<string, Recipe>;
const IDS = Object.keys(recipes);
const meta = (id: string) => JSON.parse(readFileSync(`assets-src/gen/approved/${id}/field.json`, 'utf-8')) as {
  backend: string; source: { file: string; sha256: string }; grid: number[]; bottom_row: number; rows: string[];
  frames: string[]; flip_rows: string[]; walk?: string; cut: { lift?: number[] } };
const atlas = JSON.parse(readFileSync('assets/sprites/characters-ai.json', 'utf-8')) as {
  sheets: Record<string, { x: number; y: number }>; cell: number[]; cols: number; fieldScale: number };
const legacy = JSON.parse(readFileSync('assets/sprites/characters.json', 'utf-8')) as { sheets: Record<string, unknown> };
const BANDS = { adult: [84, 92], old: [80, 88], child: [50, 58], broom: [56, 72] } as const;
/** PX.OUTLINE, the house outline colour (assets-src/gen/pixelize.py): the one colour off the 15-bit grid */
const OUTLINE = [6, 4, 10];

/** the opaque px of the 48x96 cell (row r, column c): [x, y, r, g, b] */
const pngs = new Map<string, ReturnType<typeof readRgbaPng>>();
function cell(id: string, r: number, c: number): number[][] {
  if (!pngs.has(id)) pngs.set(id, readRgbaPng(`assets-src/gen/approved/${id}/field.png`));
  const png = pngs.get(id)!;
  const out: number[][] = [];
  for (let y = 0; y < 96; y++) for (let x = 0; x < 48; x++) {
    const i = ((r * 96 + y) * png.width + c * 48 + x) * 4;
    if (png.data[i + 3] > 0) out.push([x, y, png.data[i], png.data[i + 1], png.data[i + 2]]);
  }
  return out;
}

describe('PT: the user-rendered field sheets', () => {
  it('there are 21 recipes (12 townsfolk, 7 elves, the broom, the dancer)', () => {
    expect(IDS.sort()).toEqual(['boy', 'broom', 'dancer', 'elf_child', 'elf_elder', 'elf_guard', 'elf_mage', 'elf_man',
      'elf_prince', 'elf_woman', 'girl', 'healer', 'labourer', 'old_woman', 'pilgrim', 'pirate_crew', 'sailor', 'scholar',
      'sea_captain', 'townsman', 'young_woman']);
  });

  it.each(IDS)('%s: backend user, its tracked render matches the recorded sha256', (id) => {
    const m = meta(id);
    const sha = createHash('sha256').update(readFileSync(`assets-src/gen/${recipes[id].file}`)).digest('hex');
    expect([m.backend, m.source]).toEqual(['user', { file: recipes[id].file, sha256: recipes[id].sha256 }]);
    expect(sha).toBe(recipes[id].sha256);
  });

  it.each(IDS)('%s: 144 x 288, 48 x 96 cells, rows down / up / left unflipped, binary alpha, <= 16 colours', (id) => {
    const m = meta(id);
    expect([m.grid, m.bottom_row, m.rows, m.frames, m.flip_rows]).toEqual([[48, 96], 93, ['down', 'up', 'left'],
      ['stand', 'step_left', 'step_right'], []]);
    const png = readRgbaPng(`assets-src/gen/approved/${id}/field.png`);
    expect([png.width, png.height]).toEqual([144, 288]);
    const colours = new Set<string>();
    for (let i = 0; i < png.data.length; i += 4) {
      expect([0, 255]).toContain(png.data[i + 3]);
      if (png.data[i + 3] === 0) continue;
      const rgb = [png.data[i], png.data[i + 1], png.data[i + 2]];
      colours.add(rgb.join());
      if (rgb.join() !== OUTLINE.join()) for (const v of rgb) expect(v, `${id} ${rgb}`).toBe(((v >> 3) << 3) | (v >> 5));
    }
    expect(colours.size).toBeLessThanOrEqual(16);
    expect(colours.has(OUTLINE.join())).toBe(true);
  });

  it.each(IDS)('%s: every cell drawn, inside its cell with a 1 px side margin, stands on row 93, height in band', (id) => {
    const [lo, hi] = BANDS[recipes[id].band];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const px = cell(id, r, c);
      expect(px.length, `${id} ${r},${c}`).toBeGreaterThan(0);
      const xs = px.map((p) => p[0]);
      const ys = px.map((p) => p[1]);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...xs)).toBeLessThanOrEqual(46);
      if (c === 0) expect(Math.max(...ys), `${id} row ${r} stand feet`).toBe(93);
      const h = Math.max(...ys) - Math.min(...ys) + 1;
      expect(h, `${id} ${r},${c} height`).toBeGreaterThanOrEqual(lo);
      expect(h, `${id} ${r},${c} height`).toBeLessThanOrEqual(hi);
    }
  });

  it.each(IDS)('%s: walks: in each row the three frames differ', (id) => {
    for (let r = 0; r < 3; r++) {
      const [a, b, c] = [0, 1, 2].map((k) => JSON.stringify(cell(id, r, k)));
      expect(new Set([a, b, c]).size, `${id} row ${r}`).toBe(3);
    }
  });

  it('the broom hops: walk hop, its hop frames lifted >= 3 px off row 93', () => {
    const m = meta('broom');
    expect(m.walk).toBe('hop');
    for (let r = 0; r < 3; r++) {
      const low = Math.max(...cell('broom', r, 1).map((p) => p[1]));
      expect(low, `row ${r}`).toBeLessThanOrEqual(90);
    }
    expect(IDS.filter((id) => recipes[id].walk === 'hop')).toEqual(['broom']);
  });

  it.each(IDS)('%s: in the 2x field atlas and the 1x legacy atlas (its Look)', (id) => {
    expect(atlas.sheets[id]).toBeDefined();
    expect(legacy.sheets[id]).toBeDefined();
  });
});
