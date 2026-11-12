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
const battleAtlas = JSON.parse(readFileSync(join(assets, 'sprites/battle-characters.json'), 'utf-8')) as {
  cell: [number, number];
  scale: number;
  poses: string[];
  sheets: Record<string, { row: number }>;
};
const classes = readYaml<Array<{ id: string }>>('data/classes.yaml');
const enemies = readYaml<Array<{ id: string }>>('data/enemies.yaml');
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

  describe('battle sprites', () => {
    it.each(classes.map((c) => c.id))('class "%s" has battle poses', (id) => {
      expect(battleAtlas.sheets[id]).toBeDefined();
    });

    it('provides every pose the battle scene uses', () => {
      expect(battleAtlas.poses).toEqual(['ready', 'attack', 'cast', 'hurt', 'down', 'victory']);
    });

    it('has an atlas image large enough for every class row', () => {
      const png = readFileSync(join(assets, 'sprites/battle-characters.png'));
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      const rows = Object.keys(battleAtlas.sheets).length;
      expect(width).toBe(battleAtlas.cell[0] * battleAtlas.scale * battleAtlas.poses.length);
      expect(height).toBe(battleAtlas.cell[1] * battleAtlas.scale * rows);
    });
  });

  describe('AI battle atlas (preview art, optional)', () => {
    const metaPath = join(assets, 'sprites/battle-characters-ai.json');
    const present = existsSync(metaPath);
    const meta = present
      ? (JSON.parse(readFileSync(metaPath, 'utf-8')) as { cell: [number, number]; scale: number; footRow: number; poses: string[]; sheets: Record<string, { row: number }> })
      : null;

    it.runIf(present)('uses the 2x art scale with 160 px on-screen cells', () => {
      expect(meta!.scale).toBe(2);
      expect(meta!.cell[1] * meta!.scale).toBe(160);
      expect(meta!.footRow).toBeLessThan(meta!.cell[1]);
    });

    it.runIf(present)('provides every pose the battle scene uses', () => {
      expect(meta!.poses).toEqual(['ready', 'attack', 'cast', 'hurt', 'down', 'victory']);
    });

    it.runIf(present)('only lists known classes, and the image matches cell x scale x poses by rows', () => {
      const classIds = new Set(classes.map((c) => c.id));
      for (const id of Object.keys(meta!.sheets)) expect(classIds.has(id), id).toBe(true);
      const png = readFileSync(join(assets, 'sprites/battle-characters-ai.png'));
      expect(png.readUInt32BE(16)).toBe(meta!.cell[0] * meta!.scale * meta!.poses.length);
      expect(png.readUInt32BE(20)).toBe(meta!.cell[1] * meta!.scale * Object.keys(meta!.sheets).length);
    });
  });

  describe('enemy art', () => {
    it.each(enemies.map((e) => e.id))('enemy "%s" has a monster sprite', (id) => {
      expect(existsSync(join(assets, `sprites/monsters/${id}.png`))).toBe(true);
    });

    it('monster index lists every sprite', () => {
      const index = JSON.parse(readFileSync(join(assets, 'sprites/monsters/index.json'), 'utf-8')) as string[];
      for (const e of enemies) expect(index).toContain(e.id);
    });
  });

  describe('audio', () => {
    const files = [...Object.entries(manifest.music), ...Object.entries(manifest.sfx)];
    it.each(files)('"%s" → %s exists', (_id, path) => {
      expect(existsSync(resolve(assets, '..', path))).toBe(true);
    });
  });
});
