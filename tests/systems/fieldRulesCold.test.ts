/**
 * Snow and taiga on the runtime side (docs/NATURAL_WORLD_PLAN.md 2.6, D-NW9; docs/NW2_EDITS_PLAN.md 3, D-NW2-4 and
 * D-NW2-7): TerrainType 12 / 13 read back from a map's collision, both walkable on foot (taiga at forest's speed,
 * snow at grass speed), neither ship nor canoe terrain, the airship lands on grass only (never taiga or snow); no
 * mode's encounter rate reads terrain; the flat chunk placeholder, the battle backdrop by terrain name (with the
 * taiga edge rule) and the map schema (a `tundra` key refused).
 */
import { describe, it, expect } from 'vitest';
import { TerrainType, type FieldMode } from '../../src/types/index.js';
import { baseTerrain, canLand, terrainAllows, type FieldState } from '../../src/systems/fieldRules.js';
import { airshipTerrainLands } from '../../src/systems/fieldRulesVehicles.js';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { dominantColour } from '../../src/rendering/chunkStreaming.js';
import { backdropTerrain, battleBackdropId } from '../../src/scenes/exploration/BattleBackdrop.js';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import { AirshipMode } from '../../src/entities/AirshipMode.js';
import { CanoeMode } from '../../src/entities/CanoeMode.js';
import { ShipMode } from '../../src/entities/ShipMode.js';
import { createMapData } from '../helpers/testUtils.js';

const state = (mode: FieldMode): FieldState => ({ flags: new Set(), items: new Set(), mode, vehicles: [] });
// row 0: grass, taiga, snow, 14 (unknown)
const map = createMapData({ id: 'overworld', width: 4, height: 1, collision: [0, 12, 13, 14] });

describe('snow and taiga (D-NW9, D-NW2-4)', () => {
  it('12 and 13 read back; 14 is Wall', () => {
    expect(TerrainType.Taiga).toBe(12);
    expect(TerrainType.Snow).toBe(13);
    expect((TerrainType as unknown as Record<string, unknown>).Tundra).toBeUndefined();
    expect(baseTerrain(map, 1, 0)).toBe(TerrainType.Taiga);
    expect(baseTerrain(map, 2, 0)).toBe(TerrainType.Snow);
    expect(baseTerrain(map, 3, 0)).toBe(TerrainType.Wall);
  });

  it('walking allows both; the ship and the canoe neither', () => {
    for (const t of [TerrainType.Taiga, TerrainType.Snow]) {
      expect(terrainAllows('walking', t)).toBe(true);
      expect(terrainAllows('ship', t)).toBe(false);
      expect(terrainAllows('canoe', t)).toBe(false);
    }
  });

  it('taiga walks at forest\'s speed (0.7), snow at grass speed (D-NW2-7)', () => {
    const w = new WalkingMode();
    expect(w.getSpeedMultiplier(TerrainType.Taiga)).toBe(w.getSpeedMultiplier(TerrainType.Forest));
    expect(w.getSpeedMultiplier(TerrainType.Taiga)).toBe(0.7);
    expect(w.getSpeedMultiplier(TerrainType.Snow)).toBe(1);
  });

  it('no mode\'s encounter rate reads terrain (forest and taiga have no rate modifier)', () => {
    for (const m of [new WalkingMode(), new CanoeMode(), new ShipMode(), new AirshipMode()]) {
      expect(m.getEncounterRateMultiplier.length).toBe(0);
    }
  });

  it('the airship lands on grass only, not on taiga or snow', () => {
    expect(airshipTerrainLands(TerrainType.Grass)).toBe(true);
    expect(airshipTerrainLands(TerrainType.Taiga)).toBe(false);
    expect(airshipTerrainLands(TerrainType.Snow)).toBe(false);
    expect(new AirshipMode().canLand(TerrainType.Taiga)).toBe(false);
    expect(canLand(map, { x: 1, y: 0 }, state('airship'))).toBe(false);
    expect(canLand(map, { x: 2, y: 0 }, state('airship'))).toBe(false);
    expect(canLand(map, { x: 0, y: 0 }, state('airship'))).toBe(true);
  });

  it('CollisionMap: a 12 / 13 cell is not Wall and is walkable', () => {
    const cm = new CollisionMap(map);
    expect(cm.getTerrainType(1, 0)).toBe(TerrainType.Taiga);
    expect(cm.getTerrainType(2, 0)).toBe(TerrainType.Snow);
    expect(cm.getTerrainType(3, 0)).toBe(TerrainType.Wall);
  });

  it('dominantColour: a snow chunk and a taiga chunk have their placeholder colours', () => {
    const snow = { width: 2, height: 2, collision: [13, 13, 13, 0] };
    const taiga = { width: 2, height: 2, collision: [12, 12, 0, 13] };
    expect(dominantColour(snow, 0, 0, 2)).toBe(0xe8ecf0);
    expect(dominantColour(taiga, 0, 0, 2)).toBe(0x2f4a3a);
  });

  it('the backdrop by terrain name: snow and taiga resolve through battleBackgrounds.terrain', () => {
    const cfg = { default: 'grassland', terrain: { snow: 'ice_cave', taiga: 'dark_forest' } };
    const at = (x: number): string | undefined => TerrainType[map.collision[x]];
    expect(battleBackdropId(cfg, { x: 2, y: 0 }, (x) => at(x), null)).toBe('ice_cave');
    expect(battleBackdropId(cfg, { x: 1, y: 0 }, (x) => at(x), null)).toBe('dark_forest');
  });

  it('the taiga edge rule: grass with >= 2 taiga 4-neighbours reads taiga; ties with forest go to forest', () => {
    const grid = (n: string, e: string, s: string, w: string) => (x: number, y: number): string | undefined =>
      ({ '1,0': n, '2,1': e, '1,2': s, '0,1': w } as Record<string, string>)[`${x},${y}`] ?? (x === 1 && y === 1 ? 'GRASS' : undefined);
    const p = { x: 1, y: 1 };
    expect(backdropTerrain(p, grid('TAIGA', 'TAIGA', 'GRASS', 'GRASS'))).toBe('taiga');
    expect(backdropTerrain(p, grid('TAIGA', 'GRASS', 'GRASS', 'GRASS'))).toBe('grass');
    expect(backdropTerrain(p, grid('TAIGA', 'TAIGA', 'FOREST', 'FOREST'))).toBe('forest');
    expect(backdropTerrain(p, grid('TAIGA', 'TAIGA', 'TAIGA', 'FOREST'))).toBe('taiga');
    expect(backdropTerrain(p, grid('FOREST', 'FOREST', 'TAIGA', 'GRASS'))).toBe('forest');
  });

  it('the map schema accepts taiga and snow in battleBackgrounds and refuses tundra', () => {
    const m = { ...map, battleBackgrounds: { default: 'grassland', terrain: { taiga: 'dark_forest', snow: 'ice_cave' },
      zones: { cold: { terrain: { snow: 'ice_cave' } } } } };
    expect(() => validateMapData(m)).not.toThrow();
    const bad = { ...map, battleBackgrounds: { default: 'grassland', zones: { cold: { terrain: { tundra: 'grassland' } } } } };
    expect(() => validateMapData(bad)).toThrow(/tundra: no such terrain/);
    expect(() => validateMapData({ ...map, battleBackgrounds: { terrain: { tundra: 'x' } } })).toThrow(/use taiga/);
  });
});
