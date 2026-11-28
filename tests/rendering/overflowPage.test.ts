/**
 * Pass CB A5 (docs/CLASS_BARBARIAN_PLAN.md 15): the 80 x 80 hero classes of assets-src/gen/battle_pages.yaml sit on
 * overflow pages of the party battle atlas, laid out like the main file (one 160 px row per class, the 18 pose
 * columns, the top-level cell / feet row), numbered after the oversize pages, each page at most 4096 px.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { readRgbaPng, type RgbaImage } from '../helpers/pngAlpha.js';

const meta = JSON.parse(readFileSync('assets/sprites/battle-characters-ai.json', 'utf8')) as {
  cell: [number, number]; scale: number; poses: string[]; pages: { file: string; w: number; h: number }[];
  sheets: Record<string, Record<string, unknown> & { row: number; page?: number }>;
};
const overflow = (parse(readFileSync('assets-src/gen/battle_pages.yaml', 'utf8')) as { overflow?: string[][] }).overflow ?? [];
const KEYS = ['ready', 'attack', 'cast', 'hurt', 'down', 'victory'];
/** A class has generated in-betweens unless its rig aliases all eight to their keys (the fencer's 1 px blades). */
const generated = (cid: string) => ((parse(readFileSync(`assets-src/gen/anim/${cid}.yaml`, 'utf8')) as
  { alias_frames?: string[] }).alias_frames ?? []).length < 8;
const px = (img: RgbaImage, x: number, y: number) => {
  const i = (y * img.width + x) * 4;
  return img.data[i + 3] ? `${img.data[i]},${img.data[i + 1]},${img.data[i + 2]}` : '0';
};

describe('pass CB A5: overflow pages of 80 x 80 hero classes', () => {
  it('every listed class is on one page, in the listed order, as {row, page, inbetweens} only; page sizes', () => {
    expect(overflow.length).toBeGreaterThan(0);
    for (const list of overflow) {
      const pages = new Set(list.map((c) => meta.sheets[c]?.page));
      expect(pages.size, list.join(' ')).toBe(1);
      const page = [...pages][0]!;
      expect(page).toBeGreaterThan(0);
      list.forEach((cid, row) => expect(meta.sheets[cid]).toEqual({ row, page, inbetweens: generated(cid) }));
      const on = Object.keys(meta.sheets).filter((c) => meta.sheets[c].page === page);
      expect(on.sort()).toEqual([...list].sort());
      const p = meta.pages[page];
      expect([p.w, p.h]).toEqual([meta.cell[0] * meta.scale * meta.poses.length, meta.cell[1] * meta.scale * list.length]);
      const img = readRgbaPng(`assets/sprites/${p.file}`);
      expect([img.width, img.height]).toEqual([p.w, p.h]);
      expect(Math.max(p.w, p.h)).toBeLessThanOrEqual(4096);
    }
  });

  for (const cid of overflow.flat()) {
    it(`${cid}: its key cells on its page are the approved cells`, () => {
      const s = meta.sheets[cid];
      const img = readRgbaPng(`assets/sprites/${meta.pages[s.page!].file}`);
      const sheet = readRgbaPng(`assets-src/gen/approved/${cid}/battle.png`);
      const [gw, gh] = meta.cell;
      KEYS.forEach((pose, i) => {
        const col = meta.poses.indexOf(pose);
        for (let y = 0; y < gh; y += 3) for (let x = 0; x < gw; x += 3) {
          expect(px(img, (col * gw + x) * meta.scale, (s.row * gh + y) * meta.scale), `${pose} ${x},${y}`)
            .toBe(px(sheet, (i % 3) * gw + x, Math.floor(i / 3) * gh + y));
        }
      });
    });
  }
});
