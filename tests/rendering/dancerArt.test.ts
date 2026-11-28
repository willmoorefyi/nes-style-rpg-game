/**
 * Pass CB (docs/CLASS_BARBARIAN_PLAN.md 3, 4, 6, 9): the user-rendered dancer_hero / blade_dancer battle art (plan 11-13) in the
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
const PAIR = ['dancer_hero', 'blade_dancer'];

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

describe('pass CB: dancer_hero / blade_dancer battle art', () => {
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
        expect((m.source as { file: string }).file).toBe('user_art/dancer_hero/battle_2026-11-27.png');
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

  it('field art: TEMPORARY aliases dancer_hero -> monk, blade_dancer -> master (no own field sheet yet), 1x looks exist', () => {
    expect(field.aliases).toMatchObject({ dancer_hero: 'monk', blade_dancer: 'master' });
    expect(field.sheets.dancer_hero).toEqual(field.sheets.monk);
    expect(field.sheets.blade_dancer).toEqual(field.sheets.master);
    for (const cid of PAIR) expect(legacy.sheets[cid], cid).toBeDefined();
  });

  it('hero ids: Arylon the NPC dancer keeps her own field sheet (no class id collides with it)', () => {
    const ids = (parse(readFileSync('assets/data/classes.yaml', 'utf8')) as { id: string }[]).map((c) => c.id);
    expect(ids).not.toContain('dancer');
    expect(field.sheets.dancer).toBeDefined();
    expect(field.sheets.dancer).not.toEqual(field.sheets.dancer_hero);
  });
});
