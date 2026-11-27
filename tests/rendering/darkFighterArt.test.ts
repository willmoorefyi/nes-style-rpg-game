/**
 * Pass CD-K (docs/CLASS_DARKFIGHTER_PLAN.md D-DK1, D-DK3, 2, 4): the dark fighter / death knight battle art. The dark
 * fighter is a main-page 80 x 80 class; the death knight sits on its own page (160 x 80 cells, the body box at x 52)
 * with its ATTACK the user's leftward-thrust render converted to native px (the sword tip at x 3, the cape past the
 * box); every key cell is the approved cell; every frame stands on row 76; the hero ids never share a folder or an id
 * with the monster sheets of the same names.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { readRgbaPng, type RgbaImage } from '../helpers/pngAlpha.js';
import { cellRect, type PagedBattleMeta } from '../../src/rendering/battleAtlasPages.js';

const meta = JSON.parse(readFileSync('assets/sprites/battle-characters-ai.json', 'utf8')) as PagedBattleMeta;
const pages = [readRgbaPng('assets/sprites/battle-characters-ai.png'), null,
  readRgbaPng('assets/sprites/battle-characters-ai-2.png')];
const KEYS = ['ready', 'attack', 'cast', 'hurt', 'down', 'victory'];
const APPROVED = 'assets-src/gen/approved';

const rgba = (img: RgbaImage, x: number, y: number) => {
  const i = (y * img.width + x) * 4;
  return img.data[i + 3] ? `${img.data[i]},${img.data[i + 1]},${img.data[i + 2]}` : '';
};

function cell(cid: string, pose: string): { w: number; h: number; px: (x: number, y: number) => string } {
  const s = meta.sheets[cid];
  const img = pages[s.page ?? 0]!;
  const r = cellRect(meta, cid, meta.poses.indexOf(pose));
  return { w: r.w / meta.scale, h: r.h / meta.scale, px: (x, y) => rgba(img, r.x + x * meta.scale, r.y + y * meta.scale) };
}

function lowest(c: ReturnType<typeof cell>): number {
  for (let y = c.h - 1; y >= 0; y--) for (let x = 0; x < c.w; x++) if (c.px(x, y)) return y;
  return -1;
}

describe('pass CD-K: dark fighter / death knight battle art', () => {
  it('the hero ids are distinct from the monster ids and folders of the same names (D-DK1)', () => {
    const enemies = new Set((parse(readFileSync('assets/data/enemies.yaml', 'utf8')) as { id: string }[]).map((e) => e.id));
    for (const cid of ['dark_fighter_hero', 'death_knight_hero']) {
      expect(enemies.has(cid), cid).toBe(false);
      expect(readdirSync(`${APPROVED}/${cid}`).some((f) => f.startsWith('monster_') || f === 'kneel.png'), cid).toBe(false);
    }
    for (const mid of ['dark_fighter', 'death_knight']) expect(existsSync(`${APPROVED}/${mid}/battle.json`), mid).toBe(false);
  });

  it('the dark fighter is a main-page class; the death knight is on page 2 with its body box and the thrust reach', () => {
    expect(meta.sheets.dark_fighter_hero.page).toBeUndefined();
    expect(meta.sheets.death_knight_hero).toMatchObject({ page: 2, cell: [160, 80], footRow: 76, body: [52, 0, 80, 80], reach: 3 });
  });

  for (const cid of ['dark_fighter_hero', 'death_knight_hero']) {
    it(`${cid}: every key cell is the approved cell, and every frame stands on row 76`, () => {
      const m = JSON.parse(readFileSync(`${APPROVED}/${cid}/battle.json`, 'utf8')) as { grid: [number, number]; layout: [number, number] };
      const img = readRgbaPng(`${APPROVED}/${cid}/battle.png`);
      const [gw, gh] = m.grid;
      KEYS.forEach((pose, i) => {
        const got = cell(cid, pose);
        const ox = (i % m.layout[0]) * gw, oy = Math.floor(i / m.layout[0]) * gh;
        for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
          if (got.px(x, y) !== rgba(img, ox + x, oy + y)) throw new Error(`${cid} ${pose} (${x}, ${y}) differs`);
        }
      });
      for (const pose of meta.poses) expect(lowest(cell(cid, pose)), pose).toBe(76);
    });
  }

  it('the death knight ATTACK is the converted thrust: 154 x 77 at x 3, the sword left of the box, the cape right of it', () => {
    const a = cell('death_knight_hero', 'attack');
    let x0 = Infinity, x1 = -1, y0 = Infinity;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.px(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
    expect([x0, x1, y0]).toEqual([3, 156, 0]);
    const j = JSON.parse(readFileSync(`${APPROVED}/death_knight_hero/battle.json`, 'utf8')) as { replace: { attack: { native_size: number[] } } };
    expect(j.replace.attack.native_size).toEqual([154, 77]);
    const ready = cell('death_knight_hero', 'ready');
    let rx0 = Infinity;
    for (let y = 0; y < ready.h; y++) for (let x = 0; x < ready.w; x++) if (ready.px(x, y)) rx0 = Math.min(rx0, x);
    expect(rx0).toBeGreaterThanOrEqual(52);                   // every other pose inside the body box
  });
});
