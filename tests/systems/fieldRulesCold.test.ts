/**
 * Snow and tundra on the runtime side (docs/NATURAL_WORLD_PLAN.md 2.6, D-NW9; NW-5): TerrainType 12 / 13 read back
 * from a map's collision, both walkable on foot at grass speed, neither ship nor canoe terrain, the airship lands on
 * tundra and never on snow; the flat chunk placeholder, the battle backdrop by terrain name and the map schema.
 */
import { describe, it, expect } from 'vitest';
import { TerrainType, type FieldMode } from '../../src/types/index.js';
import { baseTerrain, canLand, terrainAllows, type FieldState } from '../../src/systems/fieldRules.js';
import { airshipTerrainLands } from '../../src/systems/fieldRulesVehicles.js';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { dominantColour } from '../../src/rendering/chunkStreaming.js';
import { battleBackdropId } from '../../src/scenes/exploration/BattleBackdrop.js';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import { AirshipMode } from '../../src/entities/AirshipMode.js';
import { createMapData } from '../helpers/testUtils.js';

const state = (mode: FieldMode): FieldState => ({ flags: new Set(), items: new Set(), mode, vehicles: [] });
// row 0: grass, tundra, snow, 14 (unknown)
const map = createMapData({ id: 'overworld', width: 4, height: 1, collision: [0, 12, 13, 14] });

describe('snow and tundra (D-NW9)', () => {
  it('12 and 13 read back; 14 is Wall', () => {
    expect(TerrainType.Tundra).toBe(12);
    expect(TerrainType.Snow).toBe(13);
    expect(baseTerrain(map, 1, 0)).toBe(TerrainType.Tundra);
    expect(baseTerrain(map, 2, 0)).toBe(TerrainType.Snow);
    expect(baseTerrain(map, 3, 0)).toBe(TerrainType.Wall);
  });

  it('walking allows both; the ship and the canoe neither', () => {
    for (const t of [TerrainType.Tundra, TerrainType.Snow]) {
      expect(terrainAllows('walking', t)).toBe(true);
      expect(terrainAllows('ship', t)).toBe(false);
      expect(terrainAllows('canoe', t)).toBe(false);
      expect(new WalkingMode().getSpeedMultiplier(t)).toBe(1);
    }
  });

  it('the airship lands on tundra, not on snow', () => {
    expect(airshipTerrainLands(TerrainType.Tundra)).toBe(true);
    expect(airshipTerrainLands(TerrainType.Snow)).toBe(false);
    expect(new AirshipMode().canLand(TerrainType.Tundra)).toBe(true);
    expect(canLand(map, { x: 1, y: 0 }, state('airship'))).toBe(true);
    expect(canLand(map, { x: 2, y: 0 }, state('airship'))).toBe(false);
    expect(canLand(map, { x: 0, y: 0 }, state('airship'))).toBe(true);
  });

  it('CollisionMap: a 12 / 13 cell is not Wall and is walkable', () => {
    const cm = new CollisionMap(map);
    expect(cm.getTerrainType(1, 0)).toBe(TerrainType.Tundra);
    expect(cm.getTerrainType(2, 0)).toBe(TerrainType.Snow);
    expect(cm.getTerrainType(3, 0)).toBe(TerrainType.Wall);
  });

  it('dominantColour: a snow chunk and a tundra chunk have their placeholder colours', () => {
    const snow = { width: 2, height: 2, collision: [13, 13, 13, 0] };
    const tundra = { width: 2, height: 2, collision: [12, 12, 0, 13] };
    expect(dominantColour(snow, 0, 0, 2)).toBe(0xe8ecf0);
    expect(dominantColour(tundra, 0, 0, 2)).toBe(0x8a9a7a);
  });

  it('the backdrop by terrain name: snow and tundra resolve through battleBackgrounds.terrain', () => {
    const cfg = { default: 'grassland', terrain: { snow: 'ice_cave', tundra: 'grassland_cold' } };
    const at = (x: number): string | undefined => TerrainType[map.collision[x]];
    expect(battleBackdropId(cfg, { x: 2, y: 0 }, (x) => at(x), null)).toBe('ice_cave');
    expect(battleBackdropId(cfg, { x: 1, y: 0 }, (x) => at(x), null)).toBe('grassland_cold');
  });

  it('the map schema accepts tundra and snow in battleBackgrounds', () => {
    const m = { ...map, battleBackgrounds: { default: 'grassland', terrain: { tundra: 'grassland', snow: 'ice_cave' },
      zones: { cold: { terrain: { snow: 'ice_cave' } } } } };
    expect(() => validateMapData(m)).not.toThrow();
  });
});
