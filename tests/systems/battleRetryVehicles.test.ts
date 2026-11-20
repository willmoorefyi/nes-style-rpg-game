/**
 * GAP-12 (docs/QUEST_PLAN.md 1.8 and 4.2; W1-A): the battle-retry snapshot keeps the party's field mode and the
 * parked vehicles, so Retry Battle or Return to Field after a sea battle puts the party back on its ship at sea
 * (not stranded on the water on foot), with the vehicles where they were when the battle began.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { captureBattleSnapshot, restoreBattleSnapshot, type RetryState } from '../../src/systems/BattleRetry.js';
import { restoredSpawn } from '../../src/systems/MapTransition.js';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import type { FieldMode, MapData, ParkedVehicle, VehicleState } from '../../src/types/index.js';

type Retry = RetryState & { fieldMode: FieldMode; vehicles: ParkedVehicle[] };

/** The parts of Game the snapshot uses, restoring the way Game.restoreState does (missing mode: on foot). */
function game(mode: FieldMode, x: number, y: number, vehicles: VehicleState[]): Retry {
  const g: Retry = {
    party: new PartyManager(), inventory: new Inventory(), gameFlags: new GameFlags(),
    currentMapId: 'test-dock', playerPosition: { x, y }, playTime: 3, pendingEntrance: null,
    fieldMode: mode, vehicles,
    restoreState(d) {
      g.party = d.party; g.inventory = d.inventory; g.gameFlags = d.flags; g.currentMapId = d.currentMap;
      g.playerPosition = d.playerPosition; g.playTime = d.playTime;
      g.fieldMode = d.fieldMode ?? 'walking'; g.vehicles = d.vehicles ?? [];
    },
  };
  return g;
}

const dock = (): MapData => validateMapData(parse(readFileSync('assets/maps/test-dock.yaml', 'utf-8')));
const AIRSHIP: VehicleState = { type: 'airship', map: 'test-dock', x: 5, y: 2 };

describe('battle retry keeps the mode and the vehicles (GAP-12)', () => {
  it('records the mode and the parked vehicles, as a copy', () => {
    const g = game('ship', 12, 4, [{ ...AIRSHIP }]);
    const snap = captureBattleSnapshot(g, { enemyIds: ['sahagin'] })!;
    (g.vehicles[0] as VehicleState).x = 99;
    g.vehicles.push({ type: 'canoe', map: 'x', x: 0, y: 0 });
    g.fieldMode = 'walking';
    expect(snap.mode).toBe('ship');
    expect(snap.vehicles).toEqual([AIRSHIP]);
  });

  it('a retry after a sea battle is back on the ship at sea, with the airship where it was parked', () => {
    const g = game('ship', 12, 4, [{ ...AIRSHIP }]);
    const snap = captureBattleSnapshot(g, { enemyIds: ['sahagin'] })!;
    // the party lost on foot somewhere else, with the airship moved
    g.fieldMode = 'walking';
    g.playerPosition = { x: 6, y: 6 };
    g.vehicles = [{ type: 'airship', map: 'test-dock', x: 16, y: 9 }];
    const battle = restoreBattleSnapshot(g, snap);
    expect(battle.enemyIds).toEqual(['sahagin']);
    expect(g.fieldMode).toBe('ship');
    expect(g.vehicles).toEqual([AIRSHIP]);
    expect(restoredSpawn(dock(), g)).toEqual({ x: 12, y: 4 });
    expect(g.fieldMode).toBe('ship');
  });

  it('restoring twice gives fresh copies (a later change does not reach the snapshot)', () => {
    const g = game('canoe', 3, 7, [{ ...AIRSHIP }]);
    const snap = captureBattleSnapshot(g, { enemyIds: ['crocodile'] })!;
    restoreBattleSnapshot(g, snap);
    (g.vehicles[0] as VehicleState).x = 42;
    restoreBattleSnapshot(g, snap);
    expect(g.vehicles).toEqual([AIRSHIP]);
    expect(g.fieldMode).toBe('canoe');
  });

  it('an older snapshot without mode or vehicles restores on foot with none', () => {
    const g = game('ship', 12, 4, [AIRSHIP]);
    const snap = captureBattleSnapshot(g, { enemyIds: ['goblin'] })!;
    delete snap.mode;
    delete snap.vehicles;
    restoreBattleSnapshot(g, snap);
    expect(g.fieldMode).toBe('walking');
    expect(g.vehicles).toEqual([]);
  });
});
