import { BATTLE_POSES } from '../../src/rendering/CharacterAtlas.js';
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assets = resolve(__dirname, '../../assets');
const readYaml = <T>(rel: string): T => parse(readFileSync(join(assets, rel), 'utf-8')) as T;

interface AtlasMeta {
  cell: [number, number];
  cols: number;
  rows: number;
  sheets: Record<string, { x: number; y: number }>;
}
const atlas = JSON.parse(readFileSync(join(assets, 'sprites/characters.json'), 'utf-8')) as AtlasMeta;
const battleAtlas = JSON.parse(readFileSync(join(assets, 'sprites/battle-characters-ai.json'), 'utf-8')) as {
  cell: [number, number];
  scale: number;
  footRow: number;
  poses: string[];
  sheets: Record<string, { row: number }>;
};
const monsterAtlas = JSON.parse(readFileSync(join(assets, 'sprites/monsters-ai.json'), 'utf-8')) as {
  scale: number;
  sheets: Record<string, { cell: [number, number]; footRow: number; frames: Record<string, [number, number]> }>;
};
const classes = readYaml<Array<{ id: string }>>('data/classes.yaml');
const enemies = readYaml<Array<{ id: string; sprite?: string }>>('data/enemies.yaml');
/** Battle art is looked up by `sprite` (palette-swap variants), like BattleArt.monsterSpriteKey. */
const spriteOf = (e: { id: string; sprite?: string }) => (e.sprite || e.id).replace(/\.png$/i, '');
const manifest = JSON.parse(readFileSync(join(assets, 'data/audio-manifest.json'), 'utf-8')) as {
  music: Record<string, string>;
  sfx: Record<string, string>;
};
const mapNpcSprites = readdirSync(join(assets, 'maps'))
  .filter((f) => f.endsWith('.yaml'))
  .flatMap((f) => readYaml<{ npcs?: Array<{ sprite: string }> }>(`maps/${f}`).npcs ?? [])
  .map((n) => n.sprite);

describe('asset coverage (run `npm run assets` after adding content)', () => {
  describe('character sheets', () => {
    it.each(classes.map((c) => c.id))('class "%s" has a character sheet', (id) => {
      expect(atlas.sheets[id]).toBeDefined();
    });

    it.each([...new Set(mapNpcSprites)])('NPC sprite "%s" has a character sheet', (sprite) => {
      expect(atlas.sheets[sprite]).toBeDefined();
    });

    it('is a two-tile (16x32) layout with 6 columns and 5 rows per sheet', () => {
      expect(atlas.cell).toEqual([16, 32]);
      expect(atlas.cols).toBe(6);
      expect(atlas.rows).toBe(5);
    });

    it('has every sheet inside the atlas image bounds', () => {
      const png = readFileSync(join(assets, 'sprites/characters.png'));
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      const blockW = atlas.cell[0] * atlas.cols * 3;
      const blockH = atlas.cell[1] * atlas.rows * 3;
      for (const [id, o] of Object.entries(atlas.sheets)) {
        expect(o.x * 3 + blockW, id).toBeLessThanOrEqual(width);
        expect(o.y * 3 + blockH, id).toBeLessThanOrEqual(height);
      }
    });
  });

  describe('battle sprites (2x art)', () => {
    it.each(classes.map((c) => c.id))('class "%s" has battle poses', (id) => {
      expect(battleAtlas.sheets[id]).toBeDefined();
    });

    it('uses the 2x art scale with 160 px on-screen cells and every pose the battle scene uses', () => {
      expect(battleAtlas.scale).toBe(2);
      expect(battleAtlas.cell[1] * battleAtlas.scale).toBe(160);
      expect(battleAtlas.footRow).toBeLessThan(battleAtlas.cell[1]);
      expect(battleAtlas.poses).toEqual([...BATTLE_POSES]);
    });

    it('only lists known classes, and the image matches cell x scale x poses by rows', () => {
      const classIds = new Set(classes.map((c) => c.id));
      for (const id of Object.keys(battleAtlas.sheets)) expect(classIds.has(id), id).toBe(true);
      const png = readFileSync(join(assets, 'sprites/battle-characters-ai.png'));
      expect(png.readUInt32BE(16)).toBe(battleAtlas.cell[0] * battleAtlas.scale * battleAtlas.poses.length);
      expect(png.readUInt32BE(20)).toBe(battleAtlas.cell[1] * battleAtlas.scale * Object.keys(battleAtlas.sheets).length);
    });
  });

  describe('AI field atlas (preview art, optional)', () => {
    const metaPath = join(assets, 'sprites/characters-ai.json');
    const present = existsSync(metaPath);
    const meta = present
      ? (JSON.parse(readFileSync(metaPath, 'utf-8')) as { cell: [number, number]; cols: number; rows: number; fieldScale: number; rowNames: string[]; sheets: Record<string, { x: number; y: number }>;
        walkSequence?: number[]; walkPhases?: number })
      : null;

    it.runIf(present)('frames are one 96 px preview tile wide and two tiles tall at 2x', () => {
      expect(meta!.fieldScale).toBe(2);
      expect(meta!.cell[0] * meta!.fieldScale).toBe(96);
      expect(meta!.cell[1] * meta!.fieldScale).toBe(192);
      expect(meta!.rowNames).toEqual(['down', 'up', 'left', 'right']);
      expect([meta!.cols, meta!.rows]).toEqual([7, 4]);
      // stand + contact/down/pass for each foot, three frames per tile
      expect(meta!.walkSequence).toEqual([1, 2, 3, 4, 5, 6]);
      expect(meta!.walkPhases).toBe(3);
    });

    it.runIf(present)('every NPC sprite on a compiled map has 2x field art (or legacy art)', () => {
      const sprites = readdirSync(join(assets, 'maps/ai'))
        .filter((f) => f.endsWith('.yaml') && f !== 'index.yaml')
        .flatMap((f) => readYaml<{ npcs?: Array<{ sprite: string }> }>(`maps/ai/${f}`).npcs ?? [])
        .map((n) => n.sprite);
      for (const sp of new Set(sprites)) {
        expect(sp in meta!.sheets || sp in atlas.sheets, sp).toBe(true);
      }
    });

    it.runIf(present)('only lists known classes or NPC sprites, every block inside the image', () => {
      // NPC sprite names are the keys of the legacy character atlas that are not classes
      const compiledNpcSprites = readdirSync(join(assets, 'maps/ai'))
        .filter((f) => f.endsWith('.yaml') && f !== 'index.yaml')
        .flatMap((f) => readYaml<{ npcs?: Array<{ sprite: string }> }>(`maps/ai/${f}`).npcs ?? [])
        .map((n) => n.sprite);
      const classIds = new Set([...classes.map((c) => c.id), ...Object.keys(atlas.sheets), ...compiledNpcSprites]);
      const png = readFileSync(join(assets, 'sprites/characters-ai.png'));
      const w = png.readUInt32BE(16);
      const h = png.readUInt32BE(20);
      const s = meta!.fieldScale;
      for (const [id, o] of Object.entries(meta!.sheets)) {
        expect(classIds.has(id), id).toBe(true);
        expect((o.x + meta!.cell[0] * 3) * s).toBeLessThanOrEqual(w);
        expect((o.y + meta!.cell[1] * 4) * s).toBeLessThanOrEqual(h);
      }
    });
  });

  describe('monster art (2x, with poses)', () => {
    it.each(enemies.map((e) => [e.id, spriteOf(e)]))('enemy "%s" has monster art (%s)', (_id, sprite) => {
      expect(monsterAtlas.sheets[sprite]).toBeDefined();
    });

    it('every entry has idle, attack and hurt frames inside the image, feet inside the cell', () => {
      const png = readFileSync(join(assets, 'sprites/monsters-ai.png'));
      const w = png.readUInt32BE(16);
      const h = png.readUInt32BE(20);
      const s = monsterAtlas.scale;
      for (const [id, e] of Object.entries(monsterAtlas.sheets)) {
        // idle, attack and hurt are required; bosses may add a `cast` stance
        expect(Object.keys(e.frames).filter((k) => k !== 'cast').sort(), id).toEqual(['attack', 'hurt', 'idle']);
        for (const [x, y] of Object.values(e.frames)) {
          expect((x + e.cell[0]) * s, id).toBeLessThanOrEqual(w);
          expect((y + e.cell[1]) * s, id).toBeLessThanOrEqual(h);
        }
        expect(e.footRow, id).toBeLessThan(e.cell[1]);
      }
    });

    it('only lists sprites some enemy uses', () => {
      const used = new Set(enemies.map(spriteOf));
      for (const id of Object.keys(monsterAtlas.sheets)) expect(used.has(id), id).toBe(true);
    });
  });

  describe('battle stage backgrounds', () => {
    const scenarioBackgrounds = readYaml<Array<{ background?: string }>>('data/debug-scenarios.yaml')
      .map((s) => s.background).filter((x): x is string => !!x);

    it.each([...new Set(scenarioBackgrounds)])('debug scenario background %s exists', (path) => {
      expect(existsSync(resolve(assets, '..', path))).toBe(true);
    });

    // Only the referenced (act-1) ids are committed; the other STAGES ids stay staged locally (FIX_PLAN T6 revision 1).
    type Table = { default?: string; terrain?: Record<string, string> };
    const tableIds = (t: Table | undefined): string[] => (t ? [t.default, ...Object.values(t.terrain ?? {})] : [])
      .filter((x): x is string => !!x);
    const mapIds = ['maps', 'maps/ai', '../assets-src/maps'].flatMap((dir) => readdirSync(join(assets, dir))
      .filter((f) => f.endsWith('.yaml') && f !== 'index.yaml')
      .flatMap((f) => {
        const cfg = readYaml<{ battleBackgrounds?: Table & { zones?: Record<string, Table> } }>(`${dir}/${f}`).battleBackgrounds;
        return [...tableIds(cfg), ...Object.values(cfg?.zones ?? {}).flatMap(tableIds)];
      }));
    // The overworld's encounter-zone backdrops (T6a contract: temple_approach forest, east_pocket) and the beach.
    const act1ZoneIds = ['dark_forest', 'ruined_forest', 'shoreline'];
    const scenarioIds = scenarioBackgrounds.map((p) => p.match(/^assets\/backgrounds\/(\w+)\.webp$/)?.[1] ?? p);
    const referenced = [...new Set([...mapIds, ...act1ZoneIds, ...scenarioIds])].sort();
    const stageScript = readFileSync(join(assets, '../assets-src/tools/stage_backgrounds.py'), 'utf-8');
    const stagesBody = stageScript.slice(stageScript.indexOf('STAGES = {'), stageScript.indexOf('\n}\n'));
    const stageIds = new Set([...stagesBody.matchAll(/^\s+"(\w+)": \(/gm)].map((m) => m[1]));

    /** Width and height of a WebP file (lossy VP8, lossless VP8L or extended VP8X). */
    const webpSize = (buf: Buffer): [number, number] => {
      expect(buf.toString('ascii', 0, 4) + buf.toString('ascii', 8, 12)).toBe('RIFFWEBP');
      const chunk = buf.toString('ascii', 12, 16);
      if (chunk === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
      if (chunk === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
      }
      expect(chunk).toBe('VP8X');
      return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
    };

    it('the act-1 temple and zone ids are referenced', () => {
      expect(referenced).toEqual(expect.arrayContaining(['temple', 'dark_forest', 'ruined_forest', 'shoreline']));
    });

    it.each(referenced)('background "%s" is a staged id with a 1920x1080 webp', (id) => {
      expect(stageIds.has(id), `${id} in STAGES`).toBe(true);
      const path = join(assets, 'backgrounds', `${id}.webp`);
      expect(existsSync(path), path).toBe(true);
      expect(webpSize(readFileSync(path))).toEqual([1920, 1080]);
    });

    it('STAGES lists the 21 TF-3 sources under their snake_case stems, temple = evil-temple, fiend_hall kept', () => {
      const tf3 = ['abandoned_castle', 'chaos', 'cracked_earth', 'dark_forest', 'evil_temple', 'fire_temple', 'ice_cave',
        'magic_forest', 'magma_temple', 'palace', 'red_forest', 'ruined_forest', 'sky_palace', 'swamp_cave', 'throne_kary',
        'throne_kraken', 'throne_lich', 'throne_tiamat', 'tower_of_babel', 'town', 'water_temple'];
      for (const id of tf3) expect(stagesBody, id).toContain(`"${id}": ("${id.replace(/_/g, '-')}-hd.png"`);
      expect(stagesBody).toContain('"temple": ("evil-temple-hd.png"');
      expect(stagesBody).toContain('"fiend_hall": ("temple-of-fiends-hd.png"');
    });
  });

  describe('audio', () => {
    const files = [...Object.entries(manifest.music), ...Object.entries(manifest.sfx)];
    it.each(files)('"%s" → %s exists', (_id, path) => {
      expect(existsSync(resolve(assets, '..', path))).toBe(true);
    });
  });
});
