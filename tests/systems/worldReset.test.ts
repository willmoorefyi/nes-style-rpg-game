/**
 * NW-5 (docs/NATURAL_WORLD_PLAN.md 5.3): the reset's vehicle spots against the data. The flags of `RESET_SPOTS` are
 * exactly the flags of the stages that grant a vehicle in quest.yaml (a renamed flag fails); the ship's reset spot is
 * the `a1_pravoka` dock, where the map spawns the ship `BIKKE_DEFEATED` gives; the airship's is a landing cell.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { QuestData } from '../../src/types/index.js';
import { RESET_SPOTS, resetVehicles } from '../../src/systems/worldReset.js';
import { canLand, dockFor } from '../../src/systems/fieldRules.js';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { dock, spot } from '../helpers/worldSpots.js';

const quest = parse(readFileSync('assets/data/quest.yaml', 'utf-8')) as QuestData;
const world = validateMapData(parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')));

describe('worldReset: the reset spots', () => {
  it('RESET_SPOTS covers exactly the vehicle-granting stages, by their flags', () => {
    const granting = quest.stages.filter((s) => s.grants.vehicles.length);
    const want = granting.flatMap((s) => s.grants.vehicles.map((type) => ({ type, flags: s.grants.flags }))).sort((a, b) => a.type.localeCompare(b.type));
    const got = [...RESET_SPOTS].sort((a, b) => a.type.localeCompare(b.type));
    expect(got.map((r) => r.type)).toEqual(want.map((w) => w.type));
    for (const [i, r] of got.entries()) expect(want[i].flags, r.type).toContain(r.flag);
  });

  it('the ship resets to the a1_pravoka dock, the cell where the map spawns the ship BIKKE_DEFEATED gives', () => {
    const r = RESET_SPOTS.find((x) => x.type === 'ship')!;
    expect(r.flag).toBe('BIKKE_DEFEATED');
    const cell = spot(world, r.at);
    expect(world.spots?.[r.at]?.kind).toBe('dock');
    expect(cell).toEqual(dock(world, 'a1_pravoka'));
    expect(dockFor(world, cell)?.id).toBe('a1_pravoka');
    const spawn = (world.vehicles ?? []).filter((v) => v.type === 'ship' && v.requiredFlag === 'BIKKE_DEFEATED');
    expect(spawn.map((v) => ({ x: v.x, y: v.y }))).toEqual([cell]);
  });

  it('the airship resets to a landing spot the airship may land on', () => {
    const r = RESET_SPOTS.find((x) => x.type === 'airship')!;
    expect(r.flag).toBe('AIRSHIP_RAISED');
    expect(world.spots?.[r.at]?.kind).toBe('landing');
    expect(canLand(world, spot(world, r.at), { flags: new Set([r.flag]), items: new Set(), mode: 'airship', vehicles: [] })).toBe(true);
  });

  it('resetVehicles gives the vehicles of the flags held, as spots of the world map', () => {
    expect(resetVehicles(new Set())).toEqual([]);
    expect(resetVehicles(new Set(['BIKKE_DEFEATED']))).toEqual([{ type: 'ship', map: 'overworld', at: 'a1_s_pravoka_ship' }]);
    expect(resetVehicles((f) => f === 'AIRSHIP_RAISED' || f === 'BIKKE_DEFEATED').map((v) => v.type)).toEqual(['ship', 'airship']);
  });
});
