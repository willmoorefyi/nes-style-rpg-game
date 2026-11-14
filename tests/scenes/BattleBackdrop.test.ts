import { describe, it, expect } from 'vitest';
import { battleBackdropId, type TerrainAt } from '../../src/scenes/exploration/BattleBackdrop.js';

/** Pins the backdrop choice as it was in ExplorationScene.battleBackground() before the T6-0 extraction. */
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

  it('ignores zones for now (T6g adds them)', () => {
    const zoned = { ...cfg, zones: { temple_approach: { default: 'dark_forest', terrain: { forest: 'dark_forest' } } } };
    expect(battleBackdropId(zoned, { x: 2, y: 1 }, terrain, 'temple_approach')).toBe('forest');
    expect(battleBackdropId(zoned, { x: 3, y: 1 }, terrain, 'temple_approach')).toBe('grassland');
  });
});
