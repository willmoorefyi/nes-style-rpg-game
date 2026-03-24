import { describe, it, expect } from 'vitest';
import { VehicleManager } from '../../src/systems/VehicleManager.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import type { MovementMode } from '../../src/entities/MovementMode.js';
import type { VehicleSpawn, VehicleType } from '../../src/types/index.js';

const mockMode = (id: string): MovementMode => ({
  id,
  canMove: () => true,
  getSpeedMultiplier: () => 1,
  getEncounterRateMultiplier: () => 0,
});

function createManager(flags: GameFlags): VehicleManager {
  const modes = new Map<VehicleType, MovementMode>([
    ['canoe', mockMode('canoe')],
    ['ship', mockMode('ship')],
    ['airship', mockMode('airship')],
  ]);
  return new VehicleManager(flags, modes);
}

describe('VehicleManager', () => {
  it('filters spawns by required flag', () => {
    const flags = new GameFlags();
    const mgr = createManager(flags);
    const spawns: VehicleSpawn[] = [
      { type: 'canoe', x: 5, y: 5, requiredFlag: 'HAS_CANOE' },
      { type: 'ship', x: 10, y: 10 },
    ];
    mgr.setSpawns(spawns);
    expect(mgr.activeVehicles).toHaveLength(1);
    expect(mgr.activeVehicles[0].type).toBe('ship');
  });

  it('includes spawns when flag is set', () => {
    const flags = new GameFlags();
    flags.set('HAS_CANOE');
    const mgr = createManager(flags);
    mgr.setSpawns([{ type: 'canoe', x: 5, y: 5, requiredFlag: 'HAS_CANOE' }]);
    expect(mgr.activeVehicles).toHaveLength(1);
  });

  it('returns movement mode when boarding at vehicle position', () => {
    const flags = new GameFlags();
    const mgr = createManager(flags);
    mgr.setSpawns([{ type: 'ship', x: 3, y: 4 }]);
    const mode = mgr.checkBoarding(3, 4);
    expect(mode).not.toBeNull();
    expect(mode!.id).toBe('ship');
  });

  it('returns null when no vehicle at position', () => {
    const flags = new GameFlags();
    const mgr = createManager(flags);
    mgr.setSpawns([{ type: 'ship', x: 3, y: 4 }]);
    expect(mgr.checkBoarding(0, 0)).toBeNull();
  });

  it('handles empty spawns', () => {
    const flags = new GameFlags();
    const mgr = createManager(flags);
    mgr.setSpawns([]);
    expect(mgr.activeVehicles).toHaveLength(0);
    expect(mgr.checkBoarding(0, 0)).toBeNull();
  });
});
