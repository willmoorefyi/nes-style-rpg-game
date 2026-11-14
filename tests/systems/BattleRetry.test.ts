import { describe, it, expect } from 'vitest';
import { captureBattleSnapshot, restoreBattleSnapshot, retryAdvice, type RetryState } from '../../src/systems/BattleRetry.js';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { beforeAll } from 'vitest';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { Character } from '../../src/entities/Character.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import type { CharacterClassData } from '../../src/types/index.js';

beforeAll(async () => {
  ClassRegistry.reset();
  const classes = parse(readFileSync(new URL('../../assets/data/classes.yaml', import.meta.url), 'utf-8')) as CharacterClassData[];
  await ClassRegistry.init({ loadClasses: async () => classes } as unknown as DataLoader);
});
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { GameFlags } from '../../src/core/GameFlags.js';

function state(mapId = 'overworld'): RetryState {
  const s: RetryState = {
    party: new PartyManager(),
    inventory: new Inventory(),
    gameFlags: new GameFlags(),
    currentMapId: mapId,
    playerPosition: { x: 5, y: 6 },
    playTime: 10,
    pendingEntrance: 'south_gate',
    restoreState(d) {
      s.party = d.party; s.inventory = d.inventory; s.gameFlags = d.flags;
      s.currentMapId = d.currentMap; s.playerPosition = d.playerPosition; s.playTime = d.playTime;
    },
  };
  return s;
}

describe('BattleRetry', () => {
  it('is not retryable without a field map to return to (debug battles)', () => {
    expect(captureBattleSnapshot(state(''), { enemyIds: ['goblin'] })).toBeNull();
  });

  it('the snapshot is a copy: later changes to the game or the battle arguments do not leak in', () => {
    const s = state();
    s.party.addGold(40);
    const battle = { enemyIds: ['goblin'], enemyAi: { goblin: [{ type: 'fight' as const, weight: 1 }] } };
    const snap = captureBattleSnapshot(s, battle)!;
    s.party.addGold(500);
    s.playerPosition.x = 99;
    battle.enemyIds.push('wolf');
    battle.enemyAi.goblin[0].weight = 7;
    expect(snap.party.gold).toBe(40);
    expect(snap.position).toEqual({ x: 5, y: 6 });
    expect(snap.battle.enemyIds).toEqual(['goblin']);
    expect(snap.battle.enemyAi?.goblin[0].weight).toBe(1);
  });

  it('restoring installs fresh objects, clears the pending entrance and can be done twice', () => {
    const s = state();
    s.inventory.add('potion', 2);
    const snap = captureBattleSnapshot(s, { enemyIds: ['wolf', 'wolf'] })!;
    s.inventory.remove('potion', 2);
    const battle = restoreBattleSnapshot(s, snap);
    expect(battle.enemyIds).toEqual(['wolf', 'wolf']);
    expect(s.inventory.getQuantity('potion')).toBe(2);
    expect(s.pendingEntrance).toBeNull();
    s.inventory.remove('potion', 2);
    restoreBattleSnapshot(s, snap);           // a second retry starts from the same state
    expect(s.inventory.getQuantity('potion')).toBe(2);
  });

  describe('retryAdvice (U4)', () => {
    /** A snapshot of a warrior and a thief, the thief at `hp` (null: full). */
    function snapWith(hp: number | null) {
      const s = state();
      s.party.add(new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! }));
      s.party.add(new Character({ name: 'THIEF', classData: ClassRegistry.getClass('thief')! }));
      const thief = s.party.all[1];
      if (hp !== null) thief.currentHp = hp;
      return { snap: captureBattleSnapshot(s, { enemyIds: ['garland'] })!, max: thief.maxHp };
    }

    it('a full party is ok', () => {
      expect(retryAdvice(snapWith(null).snap)).toBe('ok');
    });

    it('a fallen member is weak', () => {
      expect(retryAdvice(snapWith(0).snap)).toBe('weak');
    });

    it('a member under 25 % of max HP is weak; at 25 % it is ok', () => {
      const { max } = snapWith(null);
      expect(retryAdvice(snapWith(Math.ceil(max * 0.25) - 1).snap)).toBe('weak');
      expect(retryAdvice(snapWith(Math.ceil(max * 0.25)).snap)).toBe('ok');
    });
  });
});
