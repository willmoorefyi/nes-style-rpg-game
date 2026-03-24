import { describe, it, expect } from 'vitest';
import { TerrainType } from '../../src/types/index.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import { CanoeMode } from '../../src/entities/CanoeMode.js';
import { ShipMode } from '../../src/entities/ShipMode.js';
import { AirshipMode } from '../../src/entities/AirshipMode.js';

describe('WalkingMode', () => {
  const mode = new WalkingMode();

  it('has id "walking"', () => {
    expect(mode.id).toBe('walking');
  });

  it('can move on land terrain', () => {
    expect(mode.canMove(TerrainType.Grass)).toBe(true);
    expect(mode.canMove(TerrainType.Forest)).toBe(true);
    expect(mode.canMove(TerrainType.Desert)).toBe(true);
    expect(mode.canMove(TerrainType.Swamp)).toBe(true);
    expect(mode.canMove(TerrainType.Road)).toBe(true);
    expect(mode.canMove(TerrainType.Bridge)).toBe(true);
  });

  it('cannot move on impassable terrain', () => {
    expect(mode.canMove(TerrainType.Wall)).toBe(false);
    expect(mode.canMove(TerrainType.Water)).toBe(false);
    expect(mode.canMove(TerrainType.Mountain)).toBe(false);
    expect(mode.canMove(TerrainType.River)).toBe(false);
  });

  it('forest slows movement to 0.7x', () => {
    expect(mode.getSpeedMultiplier(TerrainType.Forest)).toBe(0.7);
  });

  it('road speeds movement to 1.3x', () => {
    expect(mode.getSpeedMultiplier(TerrainType.Road)).toBe(1.3);
  });

  it('normal speed on other terrain', () => {
    expect(mode.getSpeedMultiplier(TerrainType.Grass)).toBe(1.0);
    expect(mode.getSpeedMultiplier(TerrainType.Desert)).toBe(1.0);
    expect(mode.getSpeedMultiplier(TerrainType.Swamp)).toBe(1.0);
  });

  it('has normal encounter rate', () => {
    expect(mode.getEncounterRateMultiplier()).toBe(1.0);
  });
});

describe('CanoeMode', () => {
  const mode = new CanoeMode();

  it('has id "canoe"', () => {
    expect(mode.id).toBe('canoe');
  });

  it('can move on river and water', () => {
    expect(mode.canMove(TerrainType.River)).toBe(true);
    expect(mode.canMove(TerrainType.Water)).toBe(true);
  });

  it('cannot move on land or walls', () => {
    expect(mode.canMove(TerrainType.Grass)).toBe(false);
    expect(mode.canMove(TerrainType.Wall)).toBe(false);
    expect(mode.canMove(TerrainType.Mountain)).toBe(false);
    expect(mode.canMove(TerrainType.Forest)).toBe(false);
    expect(mode.canMove(TerrainType.Desert)).toBe(false);
    expect(mode.canMove(TerrainType.Road)).toBe(false);
    expect(mode.canMove(TerrainType.Bridge)).toBe(false);
    expect(mode.canMove(TerrainType.Swamp)).toBe(false);
  });

  it('has 1.2x speed', () => {
    expect(mode.getSpeedMultiplier(TerrainType.Water)).toBe(1.2);
  });

  it('has 0.5x encounter rate', () => {
    expect(mode.getEncounterRateMultiplier()).toBe(0.5);
  });
});

describe('ShipMode', () => {
  const mode = new ShipMode();

  it('has id "ship"', () => {
    expect(mode.id).toBe('ship');
  });

  it('can move on water only', () => {
    expect(mode.canMove(TerrainType.Water)).toBe(true);
  });

  it('cannot move on non-water terrain', () => {
    expect(mode.canMove(TerrainType.Grass)).toBe(false);
    expect(mode.canMove(TerrainType.Wall)).toBe(false);
    expect(mode.canMove(TerrainType.River)).toBe(false);
    expect(mode.canMove(TerrainType.Mountain)).toBe(false);
    expect(mode.canMove(TerrainType.Forest)).toBe(false);
  });

  it('has 1.5x speed', () => {
    expect(mode.getSpeedMultiplier(TerrainType.Water)).toBe(1.5);
  });

  it('has 0 encounter rate', () => {
    expect(mode.getEncounterRateMultiplier()).toBe(0);
  });
});

describe('AirshipMode', () => {
  const mode = new AirshipMode();

  it('has id "airship"', () => {
    expect(mode.id).toBe('airship');
  });

  it('can move on all terrain types', () => {
    const allTerrains = [
      TerrainType.Grass, TerrainType.Wall, TerrainType.Water,
      TerrainType.Mountain, TerrainType.Forest, TerrainType.Desert,
      TerrainType.Swamp, TerrainType.River, TerrainType.Road, TerrainType.Bridge,
    ];
    for (const terrain of allTerrains) {
      expect(mode.canMove(terrain)).toBe(true);
    }
  });

  it('can only land on grass', () => {
    expect(mode.canLand(TerrainType.Grass)).toBe(true);
    expect(mode.canLand(TerrainType.Water)).toBe(false);
    expect(mode.canLand(TerrainType.Mountain)).toBe(false);
    expect(mode.canLand(TerrainType.Forest)).toBe(false);
    expect(mode.canLand(TerrainType.Wall)).toBe(false);
    expect(mode.canLand(TerrainType.Desert)).toBe(false);
  });

  it('has 2.0x speed', () => {
    expect(mode.getSpeedMultiplier(TerrainType.Grass)).toBe(2.0);
  });

  it('has 0 encounter rate', () => {
    expect(mode.getEncounterRateMultiplier()).toBe(0);
  });
});
