/**
 * Debug spawns on the overworld (GAP-18; docs/WORLD_PLAN.md 1.5, W1-B): every `map: overworld` field scenario uses an
 * entrance or has `frame: a1`, and its translated spawn is a walkable cell inside the act-1 frame, on the compiled
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
  it('exist, and each uses an entrance or has frame: a1', () => {
    expect(onOverworld.length).toBeGreaterThan(0);
    for (const s of onOverworld) {
      expect(s.entrance !== undefined || s.frame === 'a1', `${s.id}: a raw spawn needs frame: a1`).toBe(true);
    }
  });

  it('the three raw spawns are the temple, the bridge and the east (W1-0a)', () => {
    const raw = onOverworld.filter((s) => s.entrance === undefined).map((s) => s.id).sort();
    expect(raw).toEqual(['r_ow_bridge', 'r_ow_east', 'r_ow_temple']);
  });

  it.each(maps)('every spawn is walkable and inside the act-1 frame (%s)', (_name, map) => {
    const [ox, oy] = a1OriginOf(map);
    const [w, h] = map.world?.frames.a1?.size ?? [map.width, map.height];
    for (const s of onOverworld) {
      const [x, y] = s.entrance ? map.entrances![s.entrance] : scenarioSpawn(s, map);
      expect(x >= ox && x < ox + w && y >= oy && y < oy + h, `${s.id} at (${x}, ${y}) inside the a1 frame`).toBe(true);
      const state = { flags: new Set(s.flags ?? []), items: new Set<string>(), mode: 'walking' as const, vehicles: [] };
      expect(canEnter(map, { x, y }, 'walking', state), `${s.id} at (${x}, ${y})`).toBe(true);
    }
  });
});
