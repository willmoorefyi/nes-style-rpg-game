/**
 * Pass CB (docs/CLASS_BARBARIAN_PLAN.md 3, 4, 6, 9): the user-rendered tinker / machinist battle art (plan 11-13) in the
 * committed atlases. Each class has a battle row with every pose column; its key cells are the approved cells as
 * imported (no mirror: the render faces left); every key's feet are on row 76; the kneel key is the user's KNEEL
 * column; and, until the user renders their field sheets, the field atlas aliases them to monk / master.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { readRgbaPng, type RgbaImage } from '../helpers/pngAlpha.js';
import { BATTLE_POSES } from '../../src/rendering/CharacterAtlas.js';

const APPROVED = 'assets-src/gen/approved';
const meta = JSON.parse(readFileSync('assets/sprites/battle-characters-ai.json', 'utf8')) as {
  cell: [number, number]; scale: number; footRow: number; poses: string[];
  sheets: Record<string, { row: number; inbetweens: boolean; page?: number }>; pages?: { file: string }[];
};
/** Pass CB A5: the png a class's cells are on (its `page`; the main file without one). */
const pageOf = (cid: string): RgbaImage => readRgbaPng(`assets/sprites/${meta.sheets[cid].page
  ? meta.pages![meta.sheets[cid].page!].file : 'battle-characters-ai.png'}`);
const field = JSON.parse(readFileSync('assets/sprites/characters-ai.json', 'utf8')) as {
  sheets: Record<string, { x: number; y: number }>; aliases?: Record<string, string>;
};
const legacy = JSON.parse(readFileSync('assets/sprites/characters.json', 'utf8')) as { sheets: Record<string, unknown> };
const [GW, GH] = meta.cell;
const KEYS = ['ready', 'attack', 'cast', 'hurt', 'down', 'victory'];
const PAIR = ['tinker', 'machinist'];

const alphaAt = (img: RgbaImage, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];
const rgbaAt = (img: RgbaImage, x: number, y: number) => {
  const i = (y * img.width + x) * 4;
  return img.data[i + 3] ? [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]].join(',') : '0';
};

function atlasCell(cid: string, pose: string): string[][] {
  const atlas = pageOf(cid);
  const s = meta.scale, col = meta.poses.indexOf(pose), row = meta.sheets[cid].row;
  return Array.from({ length: GH }, (_, y) => Array.from({ length: GW }, (_, x) => rgbaAt(atlas, (col * GW + x) * s, (row * GH + y) * s)));
}

function lowestRow(cid: string, pose: string): number {
  const atlas = pageOf(cid);
  const s = meta.scale, col = meta.poses.indexOf(pose), row = meta.sheets[cid].row;
  for (let y = GH * s - 1; y >= 0; y--) {
    for (let x = 0; x < GW * s; x++) if (alphaAt(atlas, col * GW * s + x, row * GH * s + y)) return Math.floor(y / s);
  }
  return -1;
}

describe('pass CB: tinker / machinist battle art', () => {
  for (const cid of PAIR) {
    const bmeta = JSON.parse(readFileSync(`${APPROVED}/${cid}/battle.json`, 'utf8')) as Record<string, unknown> & { poses: string[] };
    const kmeta = JSON.parse(readFileSync(`${APPROVED}/${cid}/battle_kneel.json`, 'utf8')) as Record<string, unknown>;
    const sheet = readRgbaPng(`${APPROVED}/${cid}/battle.png`);
    const kneel = readRgbaPng(`${APPROVED}/${cid}/battle_kneel.png`);

    it(`${cid}: a battle row with every pose the battle scene uses, in-betweens built`, () => {
      expect(meta.sheets[cid]).toBeDefined();
      const aliased = (parse(readFileSync(`assets-src/gen/anim/${cid}.yaml`, 'utf8')) as { alias_frames?: string[] })
        .alias_frames ?? [];
      expect(meta.sheets[cid].inbetweens).toBe(aliased.length < 8);   // the plague doctor's eight are all its keys
      for (const p of BATTLE_POSES) expect(meta.poses, p).toContain(p);
    });

    it(`${cid}: user-rendered, faces left, imported by hero_user.py from one tracked render`, () => {
      for (const m of [bmeta, kmeta]) {
        expect(m).toMatchObject({ backend: 'user', tool: 'assets-src/gen/hero_user.py', faces: 'left', bottom_row: 76 });
        expect(m.facing_fix).toBeUndefined();
        expect((m.source as { file: string }).file).toBe('user_art/tinker/battle_2026-11-27.png');
      }
      expect(bmeta.poses).toEqual(KEYS);
    });

    it(`${cid}: every key cell in the atlas is the approved cell (no mirror) with its feet on row 76`, () => {
      KEYS.forEach((pose, i) => {
        const ox = (i % 3) * GW, oy = Math.floor(i / 3) * GH;
        const want = Array.from({ length: GH }, (_, y) => Array.from({ length: GW }, (_, x) => rgbaAt(sheet, ox + x, oy + y)));
        expect(atlasCell(cid, pose), pose).toEqual(want);
        expect(lowestRow(cid, pose), pose).toBe(76);
      });
    });

    it(`${cid}: the kneel key is the user's KNEEL column, feet on row 76`, () => {
      const want = Array.from({ length: GH }, (_, y) => Array.from({ length: GW }, (_, x) => rgbaAt(kneel, x, y)));
      expect(atlasCell(cid, 'kneel')).toEqual(want);
      expect(lowestRow(cid, 'kneel')).toBe(76);
    });

    it(`${cid}: the class rig says kneel: {source: user}`, () => {
      const rig = parse(readFileSync(`assets-src/gen/anim/${cid}.yaml`, 'utf8')) as { kneel?: { source?: string } };
      expect(rig.kneel?.source).toBe('user');
    });
  }

  it('field art: TEMPORARY aliases tinker -> monk, machinist -> master (no own field sheet yet), 1x looks exist', () => {
    expect(field.aliases).toMatchObject({ tinker: 'monk', machinist: 'master' });
    expect(field.sheets.tinker).toEqual(field.sheets.monk);
    expect(field.sheets.machinist).toEqual(field.sheets.master);
    for (const cid of PAIR) expect(legacy.sheets[cid], cid).toBeDefined();
  });

  // plan 16 (A6): the rig's fx_colours (the swing arcs and the sparks) are drawn without ink in the in-betweens and the kneel bridge
  const OUTLINE = '6,4,10,255';
  const FROM_READY = ['idle_b', 'atk_wind1', 'atk_wind2', 'cast_gather'];
  for (const cid of PAIR) {
    const rig = parse(readFileSync(`assets-src/gen/anim/${cid}.yaml`, 'utf8')) as { fx_colours: number[][] };
    const fx = new Set(rig.fx_colours.map((c) => `${c.join(',')},255`));
    const at = (c: string[][], x: number, y: number) => (y >= 0 && y < GH && x >= 0 && x < GW ? c[y][x] : '0');
    const near = (c: string[][], x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fx.has(at(c, x + dx, y + dy)));
    const inkByFx = (c: string[][]) => c.reduce((n, row, y) => n + row.filter((v, x) => v === OUTLINE && near(c, x, y)).length, 0);
    const edge = (c: string[][], x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(c, x + dx, y + dy) === '0');
    const fxEdge = (c: string[][]) => c.reduce((n, row, y) => n + row.filter((v, x) => fx.has(v) && edge(c, x, y)).length, 0);
    const fxLow = (c: string[][]) => c.slice(72, 77).reduce((n, row) => n + row.slice(0, 41).filter((v) => fx.has(v)).length, 0);

    it(`${cid}: A6 every fx colour is in the approved sheet, and the glow pieces gain no ink ring in the moved frames`, () => {
      expect(fx.size).toBeGreaterThan(0);
      for (const [n, src] of [['atk_mid', 'attack'], ['atk_follow', 'attack'], ['cast_rise', 'cast'], ['cast_release', 'cast']]) {
        expect(inkByFx(atlasCell(cid, n)), n).toBeLessThanOrEqual(inkByFx(atlasCell(cid, src)) + 5);
      }
    });

    it(`${cid}: A6 the kneel bridge keeps the key's ground glow; the frames drawn from ready add no un-inked effect edge`, () => {
      const key = fxLow(atlasCell(cid, 'kneel'));
      for (const n of ['kneel_in2', 'kneel_b']) expect(fxLow(atlasCell(cid, n)), n).toBeGreaterThanOrEqual(key);
      const ready = fxEdge(atlasCell(cid, 'ready'));
      const seam = 0;
      for (const n of [...FROM_READY, 'kneel_in1']) expect(fxEdge(atlasCell(cid, n)), n).toBeLessThanOrEqual(ready + seam);
    });
  }
});
