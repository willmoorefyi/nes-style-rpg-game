/**
 * Pass HF (docs/HERO_FACING_PLAN.md): the hero battle cells turned by `facing_fix` in
 * assets-src/gen/approved/<class>/battle.json, measured on the committed atlas against the approved sheets.
 * - a `figure` mirror is the approved cell reflected about its own visual centre (mean x; same rows: no jump);
 * - a `head` mirror leaves every row outside [y0 - 1, y1 + 1) byte-equal (the body and the feet row stay);
 * - every other key pose (and every pose of a class without an entry) is the approved cell itself.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { readRgbaPng, type RgbaImage } from '../helpers/pngAlpha.js';
import { cellRect, pageFile, sheetPage, type PagedBattleMeta } from '../../src/rendering/battleAtlasPages.js';

interface FacingFix { pose: string; mirror: 'figure' | 'head'; box?: number[]; sum?: number }
interface BattleMeta { grid: [number, number]; layout: [number, number]; poses: string[]; face_fix?: { pose: string } | { pose: string }[]; facing_fix?: FacingFix[] }
type HeroAtlas = PagedBattleMeta;

const APPROVED = 'assets-src/gen/approved';
const atlasMeta = JSON.parse(readFileSync('assets/sprites/battle-characters-ai.json', 'utf8')) as HeroAtlas;
const atlas = readRgbaPng('assets/sprites/battle-characters-ai.png');
const [GW, GH] = atlasMeta.cell;
/** Pass CB (docs/CLASS_BARBARIAN_PLAN.md): a user-rendered class (hero_user.py) faces left as drawn and has no
 * facing_fix; the HF rules below are the 12 Gemini classes'. */
const isUser = (cid: string) => (JSON.parse(readFileSync(`${APPROVED}/${cid}/battle.json`, 'utf8')) as { backend?: string }).backend === 'user';
const allClasses = Object.keys(atlasMeta.sheets).sort();
const classes = allClasses.filter(cid => !isUser(cid));
const userClasses = allClasses.filter(isUser);

/** One native cell as rows of packed RGBA (0 = transparent). */
type Cell = number[][];

function px(img: RgbaImage, x: number, y: number): number {
  const i = (y * img.width + x) * 4;
  const a = img.data[i + 3];
  return a === 0 ? 0 : ((img.data[i] << 24) | (img.data[i + 1] << 16) | (img.data[i + 2] << 8) | a) >>> 0;
}

function approvedCell(img: RgbaImage, meta: BattleMeta, pose: string): Cell {
  const i = meta.poses.indexOf(pose);
  const cols = meta.layout[0];
  const [gw, gh] = meta.grid;                        // pass CL: an oversize sheet's own cell
  const ox = (i % cols) * gw, oy = Math.floor(i / cols) * gh;
  return Array.from({ length: gh }, (_, y) => Array.from({ length: gw }, (_, x) => px(img, ox + x, oy + y)));
}

/** Pass CL (docs/CLASS_LANCE_PLAN.md 3.1): each class's cell on its own page (battleAtlasPages.cellRect). */
const pages = new Map<number, RgbaImage>([[0, atlas]]);
function atlasCell(cid: string, pose: string): Cell {
  const s = atlasMeta.scale, col = atlasMeta.poses.indexOf(pose);
  const page = sheetPage(atlasMeta, cid);
  if (!pages.has(page)) pages.set(page, readRgbaPng(`assets/sprites/${pageFile(atlasMeta, page, 'battle-characters-ai.png')}`));
  const img = pages.get(page)!;
  const r = cellRect(atlasMeta, cid, col);
  return Array.from({ length: r.h / s }, (_, y) => Array.from({ length: r.w / s },
    (_, x) => px(img, r.x + x * s, r.y + y * s)));
}

function bbox(c: Cell): [number, number, number, number] {
  let x0 = GW, y0 = GH, x1 = -1, y1 = -1;
  c.forEach((r, y) => r.forEach((v, x) => {
    if (v) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }));
  return [x0, y0, x1, y1];
}

/** puppet_facing.figure_sum: S = 2 x the opaque pixels' mean x, rounded half up, clamped so the bbox stays in 1..W-2. */
function figureSum(c: Cell): number {
  let n = 0, sx = 0;
  c.forEach(r => r.forEach((v, x) => { if (v) { n++; sx += x; } }));
  const [x0, , x1] = bbox(c);
  return Math.min(Math.max(Math.floor((4 * sx + n) / (2 * n)), x1 + 1), x0 + GW - 2);
}

function meanX(c: Cell): number {
  let n = 0, sx = 0;
  c.forEach(r => r.forEach((v, x) => { if (v) { n++; sx += x; } }));
  return sx / n;
}

function reflectFigure(c: Cell): Cell {
  const s = figureSum(c);
  return c.map(r => r.map((_, x) => (s - x >= 0 && s - x < GW ? r[s - x] : 0)));
}

function faceFixPoses(meta: BattleMeta): Set<string> {
  const f = meta.face_fix;
  return new Set(f ? (Array.isArray(f) ? f : [f]).map(e => e.pose) : []);
}

describe('pass HF: hero battle facing fixes in the committed atlas', () => {
  it('every hero class has an approved battle sheet and json', () => {
    expect(classes.length).toBe(12);
    expect(userClasses).toEqual(['abyssal_knight', 'apothecary', 'arquebusier', 'barbarian', 'bard', 'beastmaster', 'berserker', 'centurion', 'chronomancer', 'cleric', 'clockmaker', 'dark_fighter_hero', 'death_knight_hero', 'diver', 'dragoon', 'druid', 'duelist', 'fencer', 'hunter', 'inquisitor', 'landsknecht', 'legionnaire', 'machinist', 'mystic_warrior', 'necromancer', 'paladin', 'plague_doctor', 'ranger', 'rifleman', 'ronin', 'rune_knight', 'sage_hero', 'samurai', 'scholar_hero', 'shaman', 'shieldmaiden', 'summoner', 'tinker', 'valkyrie', 'virtuoso', 'warlock', 'witch_hunter']);
    for (const cid of allClasses) expect(existsSync(`${APPROVED}/${cid}/battle.json`)).toBe(true);
    expect(readdirSync(APPROVED).filter(d => existsSync(`${APPROVED}/${d}/battle.json`)).sort()).toEqual(allClasses);
  });

  for (const cid of userClasses) {
    it(`${cid}: user-rendered, faces left as drawn: no facing_fix / face_fix, every key cell is the approved cell`, () => {
      const meta = JSON.parse(readFileSync(`${APPROVED}/${cid}/battle.json`, 'utf8')) as BattleMeta & { faces?: string };
      expect(meta.faces).toBe('left');
      expect(meta.facing_fix).toBeUndefined();
      expect(meta.face_fix).toBeUndefined();
      const img = readRgbaPng(`${APPROVED}/${cid}/battle.png`);
      for (const pose of meta.poses) expect(atlasCell(cid, pose), pose).toEqual(approvedCell(img, meta, pose));
    });
  }

  for (const cid of classes) {
    const meta = JSON.parse(readFileSync(`${APPROVED}/${cid}/battle.json`, 'utf8')) as BattleMeta;
    const img = readRgbaPng(`${APPROVED}/${cid}/battle.png`);
    const fixes = new Map((meta.facing_fix ?? []).map(f => [f.pose, f]));
    const faced = faceFixPoses(meta);

    it(`${cid}: hurt is a whole-figure mirror (user ruling R2)`, () => {
      expect(fixes.get('hurt')?.mirror).toBe('figure');
    });

    for (const pose of meta.poses) {
      const f = fixes.get(pose);
      if (faced.has(pose) && !f) continue;           // a face_fix recolour only: covered by puppet.py's own review
      it(`${cid} ${pose}: ${f ? `${f.mirror} mirror` : 'unchanged'}`, () => {
        const src = approvedCell(img, meta, pose), got = atlasCell(cid, pose);
        if (!f) {
          expect(got).toEqual(src);
        } else if (f.mirror === 'figure') {
          expect(got).toEqual(reflectFigure(src));
          const [, y0, , y1] = bbox(got), [, sy0, , sy1] = bbox(src);
          expect([y0, y1]).toEqual([sy0, sy1]);                      // the rows (feet row included) stay
          const [gx0, , gx1] = bbox(got);
          expect(gx0).toBeGreaterThanOrEqual(1);
          expect(gx1).toBeLessThanOrEqual(GW - 2);
          // the visual centre stays within half a pixel (no jump), unless the reflection had to be clamped to stay in
          // the cell; then the figure touches column 1 or W - 2 and moves by the least possible
          const shift = Math.abs(meanX(got) - meanX(src));
          if (shift > 0.5) expect(gx0 === 1 || gx1 === GW - 2).toBe(true);
          expect(shift).toBeLessThanOrEqual(6);
        } else {
          const [, y0, , y1] = f.box!;
          for (let y = 0; y < GH; y++) {
            if (y >= y0 - 1 && y < y1 + 1) continue;
            expect(got[y], `row ${y}`).toEqual(src[y]);
          }
          expect(bbox(got)[3]).toBe(bbox(src)[3]);
          expect(got).not.toEqual(src);
        }
      });
    }
  }

  it('the ruled scope: down for 9 classes, cast for 3 (+ master head), heads for ninja / master', () => {
    const of = (pose: string, mirror: 'figure' | 'head') => classes.filter(cid => {
      const meta = JSON.parse(readFileSync(`${APPROVED}/${cid}/battle.json`, 'utf8')) as BattleMeta;
      return (meta.facing_fix ?? []).some(f => f.pose === pose && f.mirror === mirror);
    });
    expect(of('down', 'figure')).toEqual(['black_mage', 'knight', 'master', 'ninja', 'red_mage', 'red_wizard', 'thief',
      'warrior', 'white_mage']);
    expect(of('cast', 'figure')).toEqual(['black_mage', 'ninja', 'white_mage']);
    expect(of('ready', 'head')).toEqual(['master', 'ninja']);
    // master's attack and cast heads already face left (two blind image reviews, docs/HERO_FACING_PLAN.md 11)
    expect(of('attack', 'head')).toEqual([]);
    expect(of('cast', 'head')).toEqual([]);
    expect(of('victory', 'head')).toEqual([]);
    expect(of('victory', 'figure')).toEqual([]);
  });
});
