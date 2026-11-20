/**
 * Debug spawns on the overworld (GAP-18; docs/WORLD_PLAN.md 1.5, W1-B; NW-1, docs/NATURAL_WORLD_PLAN.md 5.2): every
 * `map: overworld` field scenario uses an entrance or a spot (`spot:`, a name of the map's `spots`; the three act-1
 * spawns that had `frame: a1` before NW-1), and its spawn is a walkable cell inside the act-1 frame, on the compiled
 * overworld and on the act-1 block in the world frame (the same map once the compiled world is committed).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { MapData } from '../../src/types/index.js';
import { scenarioSpawn, type DebugScenario } from '../../src/systems/DebugScenarioLoader.js';
import { canEnter } from '../../src/systems/fieldRules.js';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { a1OriginOf, translateA1 } from '../helpers/worldFrame.js';

const scenarios = parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as DebugScenario[];
const onOverworld = scenarios.filter((s) => s.mode === 'field' && s.map === 'overworld');
const compiled = validateMapData(parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')));
const world = translateA1(compiled);
const maps: [string, MapData][] = world === compiled ? [['the compiled world', compiled]]
  : [['the act-1 overworld', compiled], ['the act-1 block in the world frame', world]];

describe('scenarioSpawns: overworld field scenarios', () => {
  it('exist, and each uses an entrance or a spot (no raw cell, no frame: a1 since NW-1)', () => {
    expect(onOverworld.length).toBeGreaterThan(0);
    for (const s of onOverworld) {
      expect(s.entrance !== undefined || s.spot !== undefined, `${s.id}: an entrance or a spot`).toBe(true);
      expect(s.spawn ?? s.frame, `${s.id}: no raw spawn`).toBeUndefined();
    }
  });

  it('the three spot spawns are the temple road, the bridge and the east, at their old act-1 cells + (64, 64)', () => {
    const spots = onOverworld.filter((s) => s.entrance === undefined).map((s) => [s.id, s.spot]).sort();
    expect(spots).toEqual([['r_ow_bridge', 'a1_s_bridge'], ['r_ow_east', 'a1_s_east'], ['r_ow_temple', 'a1_s_temple_road']]);
    expect(compiled.spots?.a1_s_temple_road?.at).toEqual([15 + 64, 42 + 64]);
    expect(compiled.spots?.a1_s_bridge?.at).toEqual([29 + 64, 34 + 64]);
    expect(compiled.spots?.a1_s_east?.at).toEqual([48 + 64, 46 + 64]);
  });

  const OUTSIDE_A1 = new Set(['smoke_volcano']);
  it.each(maps)('every spawn is walkable and inside the act-1 frame (%s)', (_name, map) => {
    const [ox, oy] = a1OriginOf(map);
    const [w, h] = map.world?.frames?.a1?.size ?? [map.width, map.height];
    for (const s of onOverworld) {
      const [x, y] = s.entrance ? map.entrances![s.entrance] : s.spot ? compiled.spots![s.spot].at : scenarioSpawn(s, map);
      // pass W's w_* stage starts stand at their region's entrance (WORLD 6.5), outside the act-1 frame, and so does
      // the SMOKE check at the volcano door
      if (!s.id.startsWith('w_') && !OUTSIDE_A1.has(s.id)) {
        expect(x >= ox && x < ox + w && y >= oy && y < oy + h, `${s.id} at (${x}, ${y}) inside the a1 frame`).toBe(true);
      }
      const state = { flags: new Set(s.flags ?? []), items: new Set<string>(), mode: 'walking' as const, vehicles: [] };
      expect(canEnter(map, { x, y }, 'walking', state), `${s.id} at (${x}, ${y})`).toBe(true);
    }
  });
});
