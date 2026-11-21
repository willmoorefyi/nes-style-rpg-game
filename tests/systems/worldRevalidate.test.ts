/**
 * NW2-S (docs/NW2_EDITS_PLAN.md 12, 13; D-NW2-11): the targeted fix of a v4 save on the NW2 world, on the committed
 * world map and interiors. The v4 cells below are the first NW world's (NW-5's compile, 5495a793): a v4 save holds
 * them, so they are the save's data, not places of today's world; each test first pins what the cell is now.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { patchedTerrain, canLand } from '../../src/systems/fieldRules.js';
import { revalidateNw2, wayOutSync, WAY_OUT_MAX_MAPS, type SavePlace } from '../../src/systems/worldRevalidate.js';
import { RESET_ENTRANCE } from '../../src/systems/worldReset.js';
import { TerrainType, type MapData, type VehicleState } from '../../src/types/index.js';
import { dock, entrance, spot } from '../helpers/worldSpots.js';

const maps = new Map<string, MapData>();
function map(id: string): MapData | null {
  if (!maps.has(id)) {
    const f = `assets/maps/ai/${id}.yaml`;
    if (!existsSync(f)) return null;
    maps.set(id, validateMapData(parse(readFileSync(f, 'utf-8'))));
  }
  return maps.get(id)!;
}
const world = map('overworld')!;

/** v4 cells (NW-5's world): the ert_dwarf dock's cove, an R-ice canoe cell now dry, an R-ice cell now rock, the
 *  meadow north of the old range now rock. */
const V4_DWARF_COVE = { x: 104, y: 152 };
const V4_RICE_DRY = { x: 216, y: 182 };
const V4_RICE_ROCK = { x: 222, y: 118 };
const V4_MEADOW_ROCK = { x: 108, y: 96 };

const SHIP = ['BIKKE_DEFEATED'];
const CANAL = ['BIKKE_DEFEATED', 'CANAL_OPEN'];
const CANOE = ['BIKKE_DEFEATED', 'CANAL_OPEN', 'CANOE_GIVEN'];

const ship = (c: { x: number; y: number }): VehicleState => ({ type: 'ship', map: 'overworld', x: c.x, y: c.y });
const airship = (c: { x: number; y: number }): VehicleState => ({ type: 'airship', map: 'overworld', x: c.x, y: c.y });

function save(p: Partial<Omit<SavePlace, 'flags' | 'items'>> & { at: { x: number; y: number }; flags: string[]; items?: string[] }): SavePlace {
  return { map: p.map ?? 'overworld', x: p.at.x, y: p.at.y, mode: p.mode ?? 'walking', flags: new Set(p.flags),
    items: new Set(p.items ?? []), vehicles: p.vehicles ?? [] };
}
function run(s: SavePlace) {
  const wayOut = s.map === 'overworld' ? null : wayOutSync(s.map, s.flags, map);
  return { wayOut, r: revalidateNw2(s, { overworld: world, wayOut }) };
}
const terrain = (c: { x: number; y: number }, flags: string[] = []): TerrainType => patchedTerrain(world, c.x, c.y, new Set(flags));
const cell = (v: { x: number; y: number }) => ({ x: v.x, y: v.y });

describe('worldRevalidate: the v4 cells are what the rules see on the NW2 world', () => {
  it('the old dwarf cove is land, the R-ice cells are dry land and rock, the old meadow is rock', () => {
    expect(terrain(V4_DWARF_COVE, CANAL)).not.toBe(TerrainType.Water);
    expect([TerrainType.River, TerrainType.Lake]).not.toContain(terrain(V4_RICE_DRY));
    expect(terrain(V4_RICE_DRY)).not.toBe(TerrainType.Mountain);
    expect(terrain(V4_RICE_ROCK)).toBe(TerrainType.Mountain);
    expect(terrain(V4_MEADOW_ROCK)).toBe(TerrainType.Mountain);
  });
});

describe('worldRevalidate: rule 1, the ship', () => {
  it('the ship at the old dwarf cove with the party in elfheim moves to elf_port', () => {
    const { wayOut, r } = run(save({ map: 'elfheim', at: entrance(map('elfheim')!, 'gate'), flags: SHIP,
      vehicles: [ship(V4_DWARF_COVE)] }));
    expect(wayOut).toBe('elf_elfheim');
    expect(r.reset).toBe(false);
    expect(r.map).toBe('elfheim');
    expect(r.vehicles).toEqual([ship(dock(world, 'elf_port'))]);
  });

  it('on the world map at the dwarves with the canal open, the ship at the old cove moves to ert_dwarf', () => {
    const { r } = run(save({ at: entrance(world, 'ert_dwarf'), flags: CANAL, vehicles: [ship(V4_DWARF_COVE)] }));
    expect(r.reset).toBe(false);
    expect(r.vehicles).toEqual([ship(dock(world, 'ert_dwarf'))]);
  });

  it('a ship at anchor with no shore (wnd_s_ship) is valid and stays', () => {
    const at = spot(world, 'wnd_s_ship');
    const { r } = run(save({ at: entrance(world, RESET_ENTRANCE), flags: [...CANAL, 'AIRSHIP_RAISED'],
      vehicles: [ship(at), airship(spot(world, 'a1_s_airship'))] }));
    expect(r.changes).toEqual([]);
    expect(r.vehicles).toContainEqual(ship(at));
  });

  it('the ridden ship on the old cove, now ELF land: the party walks there, the ship goes to elf_port, which it reaches', () => {
    const { r } = run(save({ at: V4_DWARF_COVE, mode: 'ship', flags: CANAL }));
    expect(r.reset).toBe(false);
    expect(r.mode).toBe('walking');
    expect(cell(r)).toEqual(V4_DWARF_COVE);
    expect(r.vehicles).toEqual([ship(dock(world, 'elf_port'))]);
  });
});

describe('worldRevalidate: rule 2, a party inside a map', () => {
  it('inside ice-cavern-b2 with the ship at Crescent: b2 -> b1 -> fir_ice, the ship moved to the fir_ice dock', () => {
    const { wayOut, r } = run(save({ map: 'ice-cavern-b2', at: entrance(map('ice-cavern-b2')!, 'arrival'),
      flags: CANOE, items: ['canoe'], vehicles: [ship(spot(world, 'fir_s_crescent_ship'))] }));
    expect(wayOut).toBe('fir_ice');
    expect(r.reset).toBe(false);
    expect(r.map).toBe('ice-cavern-b2');
    expect(r.vehicles).toEqual([ship(dock(world, 'fir_ice'))]);
  });

  it('inside dwarf-hall with the ship at Pravoka: the ship moves to ert_dwarf only if the way out does not reach it', () => {
    const { wayOut, r } = run(save({ map: 'dwarf-hall', at: entrance(map('dwarf-hall')!, 'arrival'), flags: CANAL,
      vehicles: [ship(dock(world, 'a1_pravoka'))] }));
    expect(wayOut).toBe('ert_dwarf');
    expect(r.reset).toBe(false);
    expect(r.vehicles).toEqual([ship(dock(world, 'ert_dwarf'))]);
  });

  it('a save with no way out keeps its place and still runs rules 1 and 3 (the nearest open dock, the reset spot)', () => {
    const s = save({ map: 'nowhere', at: { x: 3, y: 4 }, flags: [...CANAL, 'AIRSHIP_RAISED'],
      vehicles: [ship(V4_DWARF_COVE), airship(V4_MEADOW_ROCK)] });
    const { wayOut, r } = run(s);
    expect(wayOut).toBeNull();
    expect(r.reset).toBe(false);
    expect({ map: r.map, ...cell(r) }).toEqual({ map: 'nowhere', x: 3, y: 4 });
    expect(r.vehicles).toEqual([ship(dock(world, 'ert_melmond')), airship(spot(world, 'a1_s_airship'))]);
  });

  it(`every compiled map has a way out within ${WAY_OUT_MAX_MAPS} maps`, () => {
    const ids = parse(readFileSync('assets/maps/ai/index.yaml', 'utf-8')) as string[];
    const none = ids.filter((id) => id !== 'overworld' && !wayOutSync(id, new Set(), map));
    expect(none).toEqual([]);
  });
});

describe('worldRevalidate: rule 3, the airship', () => {
  it('an airship on new rock moves to the nearest landing the party reaches', () => {
    const { r } = run(save({ at: entrance(world, RESET_ENTRANCE), flags: [...CANAL, 'AIRSHIP_RAISED'],
      vehicles: [airship(V4_MEADOW_ROCK)] }));
    expect(r.reset).toBe(false);
    const a = r.vehicles.find((v) => v.type === 'airship') as VehicleState;
    expect(canLand(world, a, { flags: new Set(CANAL), items: new Set(), mode: 'airship', vehicles: [] })).toBe(true);
    // in the party's component: a party standing there keeps it (no further change)
    const again = run(save({ at: entrance(world, RESET_ENTRANCE), flags: [...CANAL, 'AIRSHIP_RAISED'], vehicles: [a] })).r;
    expect(again.changes).toEqual([]);
  });

  it('with the party beside the rock, the airship lands next to it', () => {
    const near = { x: V4_MEADOW_ROCK.x, y: V4_MEADOW_ROCK.y };
    while (terrain(near) === TerrainType.Mountain || terrain(near) === TerrainType.Water) near.y++;
    const { r } = run(save({ at: near, flags: [...CANAL, 'AIRSHIP_RAISED'], vehicles: [airship(V4_MEADOW_ROCK), ship(dock(world, 'ert_dwarf'))] }));
    expect(r.reset).toBe(false);
    const a = r.vehicles.find((v) => v.type === 'airship') as VehicleState;
    expect(Math.abs(a.x - V4_MEADOW_ROCK.x) + Math.abs(a.y - V4_MEADOW_ROCK.y)).toBeLessThan(12);
  });

  it('an airship on taiga or snow is valid (boarding needs no landing)', () => {
    const cold = world.collision.findIndex((v) => v === TerrainType.Taiga);
    const at = { x: cold % world.width, y: Math.floor(cold / world.width) };
    const { r } = run(save({ at, flags: ['AIRSHIP_RAISED'], vehicles: [airship(at)] }));
    expect(r.changes).toEqual([]);
  });
});

describe('worldRevalidate: rules 4 and 5, the party', () => {
  it('canoe mode on an old R-ice cell now dry: walking on the same cell', () => {
    const { r } = run(save({ at: V4_RICE_DRY, mode: 'canoe', flags: CANOE, items: ['canoe'],
      vehicles: [ship(dock(world, 'fir_crescent'))] }));
    expect(r.reset).toBe(false);
    expect(r.mode).toBe('walking');
    expect(cell(r)).toEqual(V4_RICE_DRY);
  });

  it('canoe mode on an old R-ice cell now rock: reset to Cornelia', () => {
    const { r } = run(save({ at: V4_RICE_ROCK, mode: 'canoe', flags: CANOE, items: ['canoe'],
      vehicles: [ship(dock(world, 'fir_crescent'))] }));
    expect(r.reset).toBe(true);
    expect(cell(r)).toEqual(entrance(world, RESET_ENTRANCE));
    expect(r.vehicles).toEqual([{ type: 'ship', map: 'overworld', at: 'a1_s_pravoka_ship' }]);
  });

  it('a canoe-holding party on foot in the Rime Hollow with the ship at fir_ice is kept', () => {
    const { r } = run(save({ at: entrance(world, 'fir_ice'), flags: CANOE, items: ['canoe'],
      vehicles: [ship(dock(world, 'fir_ice'))] }));
    expect(r.reset).toBe(false);
    expect(r.changes).toEqual([]);
  });

  it('a party at Gurgu\'s mouth with the canoe and the ship at Crescent is kept', () => {
    const { r } = run(save({ at: entrance(world, 'fir_volcano'), flags: CANOE, items: ['canoe'],
      vehicles: [ship(dock(world, 'fir_crescent'))] }));
    expect(r.reset).toBe(false);
    expect(r.changes).toEqual([]);
  });

  it('stranded in the Rime Hollow without a vehicle that reaches it: reset to Cornelia', () => {
    const { r } = run(save({ at: entrance(world, 'fir_ice'), flags: CANAL, vehicles: [ship(dock(world, 'fir_crescent'))] }));
    expect(r.reset).toBe(true);
    expect({ map: r.map, ...cell(r), mode: r.mode }).toEqual({ map: 'overworld', ...entrance(world, RESET_ENTRANCE), mode: 'walking' });
  });

  it('a valid v4 save on the world map is kept as it is', () => {
    const v = [ship(dock(world, 'a1_pravoka')), airship(spot(world, 'a1_s_airship'))];
    const s = save({ at: entrance(world, RESET_ENTRANCE), flags: [...CANAL, 'AIRSHIP_RAISED'], vehicles: v });
    const { r } = run(s);
    expect(r).toEqual({ map: 'overworld', ...cell(s), mode: 'walking', vehicles: v, reset: false, changes: [] });
  });

  it('is pure: the input is not changed', () => {
    const s = save({ at: V4_RICE_DRY, mode: 'canoe', flags: CANOE, items: ['canoe'], vehicles: [ship(V4_DWARF_COVE)] });
    const copy = { ...s, vehicles: s.vehicles.map((v) => ({ ...v })) };
    run(s);
    expect(s).toEqual(copy);
  });
});
