import { describe, it, expect } from 'vitest';
import { validateItemData, validateMapData } from '../../src/core/schemaValidation.js';

/** T6-0 shared contract: the optional fields the T6 sub-tranches fill in. */
describe('schemaValidation: T6 shared fields', () => {
  const item = { id: 'potion', name: 'Potion', type: 'consumable', stats: {}, price: 60, usableBy: [] };
  const map = {
    id: 'm', width: 2, height: 2, layers: [], tilesets: [], collision: [0, 0, 0, 0], npcs: [],
    transitions: [{ x: 0, y: 0, targetMap: 'other', targetX: 1, targetY: 1 }],
  };
  const withEffect = (effect: unknown) => ({ ...map, transitions: [{ ...map.transitions[0], effect }] });
  const withBackdrops = (battleBackgrounds: unknown) => ({ ...map, battleBackgrounds });

  describe('ItemData.description', () => {
    it('is optional and accepts a string', () => {
      expect(validateItemData(item)).toEqual(item);
      const described = { ...item, description: 'Restores 30 HP to one ally.' };
      expect(validateItemData(described)).toEqual(described);
    });

    it('rejects a non-string', () => {
      expect(() => validateItemData({ ...item, description: 30 })).toThrow('ItemData.description: expected string, got number');
    });
  });

  describe('MapTransition.effect', () => {
    it('is optional and accepts door or fade', () => {
      expect(() => validateMapData(map)).not.toThrow();
      expect(validateMapData(withEffect('door')).transitions[0].effect).toBe('door');
      expect(validateMapData(withEffect('fade')).transitions[0].effect).toBe('fade');
    });

    it('rejects anything else', () => {
      expect(() => validateMapData(withEffect('zoom'))).toThrow('MapData.transitions[0].effect: expected one of door, fade, got zoom');
      expect(() => validateMapData(withEffect(true))).toThrow('MapData.transitions[0].effect');
    });
  });

  describe('MapData.battleBackgrounds.zones', () => {
    it('accepts today\'s table and zones of { default?, terrain? }', () => {
      const cfg = {
        default: 'grassland',
        terrain: { sand: 'shoreline', forest: 'forest' },
        zones: { temple_approach: { terrain: { forest: 'dark_forest' } }, east_pocket: { default: 'ruined_forest' }, empty: {} },
      };
      expect(validateMapData(withBackdrops(cfg)).battleBackgrounds).toEqual(cfg);
      expect(() => validateMapData(withBackdrops({ default: 'grassland' }))).not.toThrow();
    });

    it('rejects zones that are not records of records of strings', () => {
      expect(() => validateMapData(withBackdrops({ zones: ['a'] }))).toThrow('MapData.battleBackgrounds.zones: expected object, got array');
      expect(() => validateMapData(withBackdrops({ zones: { z: 'forest' } })))
        .toThrow('MapData.battleBackgrounds.zones.z: expected object, got string');
      expect(() => validateMapData(withBackdrops({ zones: { z: { default: 3 } } })))
        .toThrow('MapData.battleBackgrounds.zones.z.default: expected string, got number');
      expect(() => validateMapData(withBackdrops({ zones: { z: { terrain: { forest: null } } } })))
        .toThrow('MapData.battleBackgrounds.zones.z.terrain.forest: expected string, got null');
    });

    it('checks the map-level table with the same rules', () => {
      expect(() => validateMapData(withBackdrops('grassland'))).toThrow('MapData.battleBackgrounds: expected object, got string');
      expect(() => validateMapData(withBackdrops({ terrain: { sand: 1 } })))
        .toThrow('MapData.battleBackgrounds.terrain.sand: expected string, got number');
    });
  });
});
