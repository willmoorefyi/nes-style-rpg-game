import { describe, it, expect } from 'vitest';
import { battleBackdropId, type TerrainAt } from '../../src/scenes/exploration/BattleBackdrop.js';

/** The backdrop choice: the T6-0 behaviour (map terrain, then default), plus T6g zones and the forest edge. */
describe('battleBackdropId', () => {
  const at = (cells: Record<string, string>): TerrainAt => (x, y) => cells[`${x},${y}`];
  const terrain = at({ '1,1': 'SAND', '2,1': 'FOREST', '3,1': 'GRASS' });
  const cfg = { default: 'grassland', terrain: { sand: 'shoreline', forest: 'forest' } };

  it('is undefined without a config', () => {
    expect(battleBackdropId(undefined, { x: 1, y: 1 }, terrain, null)).toBeUndefined();
  });

  it('uses the per-terrain override (lowercased TerrainType name) at the player cell', () => {
    expect(battleBackdropId(cfg, { x: 1, y: 1 }, terrain, null)).toBe('shoreline');
    expect(battleBackdropId(cfg, { x: 2, y: 1 }, terrain, null)).toBe('forest');
  });

  it('falls back to the default for unlisted or unknown terrain', () => {
    expect(battleBackdropId(cfg, { x: 3, y: 1 }, terrain, null)).toBe('grassland');
    expect(battleBackdropId(cfg, { x: 9, y: 9 }, terrain, null)).toBe('grassland');
  });

  it('uses the default without a position or a terrain table', () => {
    expect(battleBackdropId(cfg, null, terrain, null)).toBe('grassland');
    expect(battleBackdropId({ default: 'cave' }, { x: 1, y: 1 }, terrain, null)).toBe('cave');
  });

  it('is undefined when nothing matches and there is no default', () => {
    expect(battleBackdropId({ terrain: { sand: 'shoreline' } }, { x: 3, y: 1 }, terrain, null)).toBeUndefined();
    expect(battleBackdropId({ terrain: { sand: 'shoreline' } }, { x: 1, y: 1 }, terrain, null)).toBe('shoreline');
  });

  // T6g (BA-12 runtime, TF-3): the overworld table as T6a writes it.
  describe('zones and the forest edge (T6g)', () => {
    const overworld = {
      default: 'grassland',
      terrain: { forest: 'forest', desert: 'shoreline', swamp: 'swamp', water: 'ocean', river: 'river' },
      zones: { temple_approach: { terrain: { forest: 'dark_forest' } }, east_pocket: { default: 'ruined_forest' } },
    };
    // row 1: sand, forest, grass with forest N and S (2 forest neighbours), grass with one forest neighbour (W)
    const field = at({
      '1,1': 'DESERT', '2,1': 'FOREST', '3,1': 'GRASS', '3,0': 'FOREST', '3,2': 'FOREST',
      '5,1': 'GRASS', '4,1': 'FOREST', '6,1': 'GRASS', '5,0': 'GRASS', '5,2': 'GRASS',
    });

    it('sand (TerrainType Desert) gives the shoreline', () => {
      expect(battleBackdropId(overworld, { x: 1, y: 1 }, field, null)).toBe('shoreline');
    });

    it('grass beside 2 forest cells counts as forest; beside 1 it stays grass', () => {
      expect(battleBackdropId(overworld, { x: 3, y: 1 }, field, null)).toBe('forest');
      expect(battleBackdropId(overworld, { x: 5, y: 1 }, field, null)).toBe('grassland');
    });

    it('forest in temple_approach gives dark_forest, including the forest edge; other terrain falls through', () => {
      expect(battleBackdropId(overworld, { x: 2, y: 1 }, field, 'temple_approach')).toBe('dark_forest');
      expect(battleBackdropId(overworld, { x: 3, y: 1 }, field, 'temple_approach')).toBe('dark_forest');
      expect(battleBackdropId(overworld, { x: 1, y: 1 }, field, 'temple_approach')).toBe('shoreline');
      expect(battleBackdropId(overworld, { x: 5, y: 1 }, field, 'temple_approach')).toBe('grassland');
    });

    it('east_pocket gives ruined_forest on any terrain', () => {
      expect(battleBackdropId(overworld, { x: 5, y: 1 }, field, 'east_pocket')).toBe('ruined_forest');
      expect(battleBackdropId(overworld, { x: 2, y: 1 }, field, 'east_pocket')).toBe('ruined_forest');
    });

    it('a zone without its own table uses the map table; no config is undefined', () => {
      expect(battleBackdropId(overworld, { x: 2, y: 1 }, field, 'north_shore')).toBe('forest');
      expect(battleBackdropId(undefined, { x: 2, y: 1 }, field, 'temple_approach')).toBeUndefined();
    });

    it('a zone default beats the map terrain, and the zone terrain beats the zone default', () => {
      const cfg = { default: 'grassland', terrain: { forest: 'forest' },
        zones: { z: { default: 'cave', terrain: { forest: 'dark_forest' } } } };
      expect(battleBackdropId(cfg, { x: 2, y: 1 }, field, 'z')).toBe('dark_forest');
      expect(battleBackdropId(cfg, { x: 5, y: 1 }, field, 'z')).toBe('cave');
      expect(battleBackdropId(cfg, null, field, 'z')).toBe('cave');
    });
  });
});
