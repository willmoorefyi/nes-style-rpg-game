/**
 * Debug spawns on the overworld (GAP-18; docs/WORLD_PLAN.md 1.5, W1-B; NW-1 and NW-5, docs/NATURAL_WORLD_PLAN.md
 * 5.2, 3.6.5): every `map: overworld` field scenario uses an entrance or a spot (`spot:`, a name of the map's
 * `spots`; the three act-1 spawns that used pass W's act-1 frame before NW-1), and its spawn is a walkable
 * cell of the compiled world.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { DebugScenario } from '../../src/systems/DebugScenarioLoader.js';
import { canEnter } from '../../src/systems/fieldRules.js';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { entrance, spot } from '../helpers/worldSpots.js';

const scenarios = parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as DebugScenario[];
const onOverworld = scenarios.filter((s) => s.mode === 'field' && s.map === 'overworld');
const map = validateMapData(parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')));

describe('scenarioSpawns: overworld field scenarios', () => {
  it('exist, and each uses an entrance or a spot (no raw cell, no act-1 frame)', () => {
    expect(onOverworld.length).toBeGreaterThan(0);
    for (const s of onOverworld) {
      expect(s.entrance !== undefined || s.spot !== undefined, `${s.id}: an entrance or a spot`).toBe(true);
      expect(s.spawn, `${s.id}: no raw spawn`).toBeUndefined();
      expect((s as { frame?: unknown }).frame, `${s.id}: no frame`).toBeUndefined();
    }
  });

  it('the three spot spawns are act 1\'s temple road, bridge and east, land spots of the world', () => {
    const spots = onOverworld.filter((s) => s.entrance === undefined).map((s) => [s.id, s.spot ?? '']).sort();
    expect(spots).toEqual([['r_ow_bridge', 'a1_s_bridge'], ['r_ow_east', 'a1_s_east'], ['r_ow_temple', 'a1_s_temple_road']]);
    for (const [, name] of spots) expect(map.spots?.[name]?.kind, name).toBe('land');
  });

  it('every spawn is walkable on the compiled world', () => {
    for (const s of onOverworld) {
      const { x, y } = s.entrance ? entrance(map, s.entrance) : spot(map, s.spot ?? '');
      const state = { flags: new Set(s.flags ?? []), items: new Set<string>(), mode: 'walking' as const, vehicles: [] };
      expect(canEnter(map, { x, y }, 'walking', state), `${s.id} at (${x}, ${y})`).toBe(true);
    }
  });
});
