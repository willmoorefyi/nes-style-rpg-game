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
