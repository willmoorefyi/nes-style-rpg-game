/**
 * Fh test 2 (docs/BESTIARY_PLAN.md 3.2, 3.7): habitats from the real compiled maps (through resolveMapPath) and the
 * background each entry shows.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { MapData } from '../../../src/types/index.js';
import { validateBestiary } from '../../../src/core/bestiaryValidation.js';
import { resolveMapPath } from '../../../src/systems/MapLoader.js';
import { backgroundFor, habitatMapIds, habitatText, habitatsOf } from '../../../src/scenes/bestiary/bestiaryHabitats.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = <T>(f: string): T => parse(readFileSync(join(root, f), 'utf-8')) as T;
const data = validateBestiary(read<unknown>('assets/data/bestiary.yaml'));
const loader = { loadMapManifest: async (p: string) => read<string[]>(p) };

async function realHabitats() {
  const maps: MapData[] = [];
  for (const id of await habitatMapIds(data, () => loader.loadMapManifest('assets/maps/ai/index.yaml'))) maps.push(read<MapData>(await resolveMapPath(loader, id, true)));
  return habitatsOf(maps);
}

const map = (over: Partial<MapData>): MapData => ({ id: 'm', name: 'Map', width: 1, height: 1, layers: [], tilesets: [],
  collision: [], npcs: [], transitions: [], ...over });

describe('bestiary habitats (compiled maps)', () => {
  it('resolveMapPath picks the compiled maps', async () => {
    expect(await resolveMapPath(loader, 'overworld', true)).toBe('assets/maps/ai/overworld.yaml');
    expect(await resolveMapPath(loader, 'overworld', false)).toBe('assets/maps/overworld.yaml');
  });

  it('pins the habitat strings', async () => {
    const h = await realHabitats();
    const text = (id: string) => habitatText(h.get(id), data);
    expect(text('goblin')).toBe('World Map');
    expect(text('wolf')).toBe('World Map');
    expect(text('gr_imp')).toBe('World Map, Temple of Fiends');
    expect(text('skeleton')).toBe('World Map (Temple approach), Temple of Fiends');
    expect(text('gr_wolf')).toBe('World Map (East pocket, Northern Mainland)');   // A1-O: the mainland zone
    expect(text('garland')).toBe('Temple of Fiends (boss)');
    expect(text('dragon')).toBe('Gurgu Volcano B3, Gurgu Volcano B4, Gurgu Volcano B5');   // FIR-D1: the lower floors
    for (const id of ['vampire', 'lich']) expect(text(id)).toBe('Not placed yet');
  });

  it('backgrounds: overrides, the first habitat, else the default', async () => {
    const h = await realHabitats();
    const bg = (id: string) => backgroundFor(id, h.get(id), data);
    expect(bg('garland')).toBe('temple');
    expect(bg('lich')).toBe('shoreline');
    expect(bg('skeleton')).toBe('grassland');
    expect(bg('gr_imp')).toBe('grassland');
    expect(bg('wolf')).toBe('grassland');
    expect(bg('troll')).toBe('grassland');
    expect(bg('gr_wolf')).toBe('ruined_forest');
  });
});

describe('bestiary habitats (synthetic maps)', () => {
  it('old-style enemies[] and min: 0 groups count; three scripted entries give one boss habitat', () => {
    const h = habitatsOf([map({
      encounters: [{ weight: 1, enemies: ['ogre'] }, { weight: 1, groups: [{ id: 'troll', min: 0, max: 1 }] }],
      scriptedEncounters: [1, 2, 3].map((x) => ({ x, y: 0, enemyIds: ['lich'], flag: 'F', isBoss: true })),
    })]);
    expect(habitatText(h.get('ogre'), data)).toBe('Map');
    expect(habitatText(h.get('troll'), data)).toBe('Map');
    expect(habitatText(h.get('lich'), data)).toBe('Map (boss)');
    expect(h.get('lich')).toHaveLength(1);
  });

  it('QUEST 4.4: a zone\'s own name is its label (else bestiary.yaml\'s, else the id); `manifest` scans the manifest', async () => {
    const zone = (id: string, name?: string) => ({ id, name, rects: [], encounters: [{ weight: 1, groups: [{ id: 'ogre', min: 1, max: 1 }] }] });
    const h = habitatsOf([map({ encounterZones: [zone('elf_bog', 'Elf bog'), zone('east_pocket'), zone('x_raw')] })]);
    expect(habitatText(h.get('ogre'), data)).toBe('Map (Elf bog, East pocket, x_raw)');
    expect(await habitatMapIds({ ...data, habitats: { maps: 'manifest', zones: {} } }, async () => ['a', 'b'])).toEqual(['a', 'b']);
    expect(await habitatMapIds({ ...data, habitats: { maps: ['c'], zones: {} } }, async () => ['a'])).toEqual(['c']);
  });
});
