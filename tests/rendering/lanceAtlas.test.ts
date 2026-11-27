/**
 * Pass CL (docs/CLASS_LANCE_PLAN.md 3, 4, 5.2.5, 6, 10): the oversize lance classes in the committed battle atlas.
 * The main file keeps the 14 80 x 80 classes as they were; the landsknecht / dragoon sit on page 1 (160 x 144 cells,
 * 6 x 3 blocks); every key cell is the approved cell as imported; in every key the body (the approved lance mask left
 * out, the importer's rule re-implemented here) stands on row 140 inside the body box; no generated frame puts a lance
 * pixel below the feet row except the KNEEL key's own, carried.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readRgbaPng, type RgbaImage } from '../helpers/pngAlpha.js';
import { cellRect, type PagedBattleMeta } from '../../src/rendering/battleAtlasPages.js';

const meta = JSON.parse(readFileSync('assets/sprites/battle-characters-ai.json', 'utf8')) as PagedBattleMeta;
const page1 = readRgbaPng('assets/sprites/battle-characters-ai-1.png');
const LANCE = ['dragoon', 'landsknecht'];
const KEYS = ['ready', 'attack', 'cast', 'hurt', 'down', 'victory'];
const FOOT = 140;
const BODY = { x0: 72, y0: 64, x1: 151, y1: 143 };

interface Approved {
  grid: [number, number]; layout: [number, number]; poses: string[]; bottom_row: number; body: number[];
  cut: { palette: [number[], number[]][] };
  prop: { radius: { shaft: number; head: number }; head_len: number; colours: number[][]; shaft_colours?: number[][];
    lines: Record<string, [[number, number], [number, number]]> };
}
const approved = (cid: string, sheet = 'battle') =>
  JSON.parse(readFileSync(`assets-src/gen/approved/${cid}/${sheet}.json`, 'utf8')) as Approved;

type Cell = { w: number; h: number; px: (x: number, y: number) => [number, number, number, number] };

function atlasCell(cid: string, pose: string): Cell {
  const r = cellRect(meta, cid, meta.poses.indexOf(pose));
  const s = meta.scale;
  return { w: r.w / s, h: r.h / s, px: (x, y) => rgba(page1, r.x + x * s, r.y + y * s) };
}

function approvedCell(img: RgbaImage, m: Approved, i: number): Cell {
  const [gw, gh] = m.grid;
  const ox = (i % m.layout[0]) * gw, oy = Math.floor(i / m.layout[0]) * gh;
  return { w: gw, h: gh, px: (x, y) => rgba(img, ox + x, oy + y) };
}

function rgba(img: RgbaImage, x: number, y: number): [number, number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

/** hero_user_lance.mask in the approved (house) colours: near the line, the lance colours (shaft colours beyond the
 *  head), the ink colour only within the shaft reach on the shaft. */
function lanceMask(c: Cell, m: Approved, line: [[number, number], [number, number]]): boolean[][] {
  const map = new Map(m.cut.palette.map(([s, d]) => [s.join(','), d.join(',')]));
  const cols = new Set(m.prop.colours.map((c2) => map.get(c2.join(','))));
  const shaft = new Set((m.prop.shaft_colours ?? m.prop.colours).map((c2) => map.get(c2.join(','))));
  const ink = map.get([...m.prop.colours].sort((a, b) => a[0] + a[1] + a[2] - b[0] - b[1] - b[2])[0].join(','));
  const [[tx, ty], [bx, by]] = line;
  const n = Math.hypot(bx - tx, by - ty), ux = (bx - tx) / n, uy = (by - ty) / n;
  const ang = Math.atan2(ty - by, tx - bx);                  // as hero_user_lance.angle: atan2(-dy, -dx) of tip - butt
  const rs = 1.5 + (m.prop.radius.shaft - 1.5) * Math.abs(Math.sin(2 * Math.atan2(-(ty - by), -(tx - bx))));
  void ang;
  return Array.from({ length: c.h }, (_, y) => Array.from({ length: c.w }, (_, x) => {
    const p = c.px(x, y);
    if (!p[3]) return false;
    const t = (x - tx) * ux + (y - ty) * uy;
    const tc = Math.min(Math.max(t, 0), n);
    const d = Math.hypot(x - (tx + tc * ux), y - (ty + tc * uy));
    const head = t <= m.prop.head_len;
    if (t < -1 || t > n + 1 || d > (head ? m.prop.radius.head : rs)) return false;
    const key = `${p[0]},${p[1]},${p[2]}`;
    if (!(head ? cols : shaft).has(key)) return false;
    return key !== ink || head || d <= rs;
  }));
}

function lowest(c: Cell, skip?: boolean[][]): number {
  for (let y = c.h - 1; y >= 0; y--) for (let x = 0; x < c.w; x++) if (c.px(x, y)[3] && !skip?.[y][x]) return y;
  return -1;
}

describe('pass CL: the oversize lance classes in the battle atlas', () => {
  it('the main file and its 80 x 80 sheets are as before (no page, the top-level cell and feet row); pages by height', () => {
    expect(meta.cell).toEqual([80, 80]);
    expect(meta.footRow).toBe(76);
    const main = Object.entries(meta.sheets).filter(([, s]) => !s.page);
    expect(main).toHaveLength(23);                       // int-classes: the 26 classes less the 3 oversize sheets
    for (const [cid, s] of main) expect(Object.keys(s).sort(), cid).toEqual(['inbetweens', 'row']);
    expect(meta.pages).toEqual([{ file: 'battle-characters-ai.png', w: 2880, h: 3680 },
      { file: 'battle-characters-ai-1.png', w: 1920, h: 1728 }, { file: 'battle-characters-ai-2.png', w: 1920, h: 480 }]);
    expect([page1.width, page1.height]).toEqual([1920, 1728]);
  });

  for (const cid of LANCE) {
    it(`${cid}: page 1, 160 x 144 cells, feet row 140, the 80 x 80 body box, a 6 x 3 block, 18 heads, the reach`, () => {
      const s = meta.sheets[cid];
      expect(s).toMatchObject({ page: 1, cell: [160, 144], footRow: 140, body: [72, 64, 80, 80], grid: [6, 3] });
      expect(s.heads).toHaveLength(meta.poses.length);
      expect(s.reach).toBe(cid === 'landsknecht' ? 4 : 12);
      for (const [i, h] of (s.heads ?? []).entries()) {
        expect(h, meta.poses[i]).not.toBeNull();
        expect(h![0], meta.poses[i]).toBeGreaterThanOrEqual(BODY.x0);
        expect(h![1], meta.poses[i]).toBeGreaterThanOrEqual(BODY.y0);   // a body head, never the lance tip
      }
    });

    it(`${cid}: every key cell is the approved cell; its body stands on row ${FOOT} inside the body box`, () => {
      const m = approved(cid);
      const img = readRgbaPng(`assets-src/gen/approved/${cid}/battle.png`);
      KEYS.forEach((pose, i) => {
        const got = atlasCell(cid, pose), want = approvedCell(img, m, i);
        for (let y = 0; y < got.h; y++) for (let x = 0; x < got.w; x++) {
          if (got.px(x, y).join() !== want.px(x, y).join()) throw new Error(`${cid} ${pose}: (${x}, ${y}) differs`);
        }
        const lance = lanceMask(got, m, m.prop.lines[pose]);
        expect(lowest(got, lance), pose).toBe(FOOT);
        for (let y = 0; y < got.h; y++) for (let x = 0; x < got.w; x++) {
          const outside = x < BODY.x0 || x > BODY.x1 || y < BODY.y0 || y > BODY.y1;
          if (outside && got.px(x, y)[3] && !lance[y][x]) throw new Error(`${cid} ${pose}: body px (${x}, ${y}) outside the box`);
        }
      });
    });

    it(`${cid}: the kneel key is the user's KNEEL cell; no generated frame has a px below row ${FOOT} but the key's`, () => {
      const km = approved(cid, 'battle_kneel');
      const kimg = readRgbaPng(`assets-src/gen/approved/${cid}/battle_kneel.png`);
      const key = atlasCell(cid, 'kneel');
      const want = approvedCell(kimg, { ...km, layout: [1, 1], grid: [160, 144] } as Approved, 0);
      for (let y = 0; y < key.h; y++) for (let x = 0; x < key.w; x++) {
        if (key.px(x, y).join() !== want.px(x, y).join()) throw new Error(`${cid} kneel key (${x}, ${y}) differs`);
      }
      const keyBelow = [] as string[];
      for (let y = FOOT + 1; y < key.h; y++) for (let x = 0; x < key.w; x++) if (key.px(x, y)[3]) keyBelow.push(key.px(x, y).join());
      for (const pose of meta.poses) {
        if (KEYS.includes(pose) || pose === 'kneel') continue;
        const f = atlasCell(cid, pose);
        expect(lowest(f), pose).toBe(pose === 'kneel_in2' || pose === 'kneel_b' ? Math.max(FOOT, lowest(key)) : FOOT);
        const below: string[] = [];
        for (let y = FOOT + 1; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.px(x, y)[3]) below.push(f.px(x, y).join());
        if (pose === 'kneel_in2' || pose === 'kneel_b') expect(below.sort(), pose).toEqual([...keyBelow].sort());
        else expect(below, pose).toEqual([]);
      }
    });
  }
});
