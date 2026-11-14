/**
 * B2 (docs/FIX_PLAN_PENINSULA.md R2): a Fight whose target died is retargeted once, before it is announced, and the
 * queued command keeps the new target, so the peek (announcement, animation) and the hit name the same enemy.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { loadRealRegistries } from '../helpers/realData.js';
import { mulberry32 } from '../helpers/battlePolicies.js';
import { enemyCopy, SPELLS } from '../helpers/balanceData.js';

beforeAll(async () => { await loadRealRegistries(); });

const warrior = (name: string) => new Character({ name, classData: ClassRegistry.getClass('warrior')! });

describe('B2: retargeted attacks announce a living target', () => {
  it('4 Warriors Fight enemy_0 of 3 Goblins: every peeked target is alive and is the one the "hits" line names', () => {
    let checked = 0, retargeted = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const party = ['A', 'B', 'C', 'D'].map(warrior);
      const bsm = new BattleStateMachine({ party, enemies: [enemyCopy('goblin'), enemyCopy('goblin'), enemyCopy('goblin')], spells: SPELLS }, mulberry32(seed));
      bsm.startBattle();
      bsm.advanceFromIntro();
      for (let i = 0; i < 4; i++) bsm.submitCommand({ type: 'fight', actorId: `party_${i}`, targetId: 'enemy_0' });
      bsm.prepareRound();
      while (bsm.actionQueueLength > 0 && !bsm.isOver && bsm.livingEnemies.length > 0) {
        const info = bsm.peekNextAction()!;
        const actorAlive = bsm.isNextActorAlive();
        const target = bsm.allEnemies.find(e => e.id === info.targetId);
        const targetAlive = (target?.currentHp ?? 0) > 0;
        const result = bsm.executeNextAction();
        if (!info.actorId.startsWith('party_') || !actorAlive) continue;
        expect(targetAlive, `seed ${seed}: ${info.actorName} announced ${info.targetName}`).toBe(true);
        expect(target!.displayName, `seed ${seed}`).toBe(info.targetName);
        if (info.targetId !== 'enemy_0') retargeted++;
        const hit = result.messages.find(m => m.text.startsWith(`${info.actorName} hits `));
        if (hit) {
          expect(hit.text.startsWith(`${info.actorName} hits ${info.targetName} for `), `seed ${seed}: ${hit.text}`).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
    expect(retargeted).toBeGreaterThan(0); // Goblin A (8 HP) dies early, so later attackers move on
  });

  it('a retarget is written into the queued command: a second peek names the same target and draws nothing', () => {
    const party = ['A', 'B'].map(warrior);
    let draws = 0;
    const base = mulberry32(5);
    const rng = () => { draws++; return base(); };
    const bsm = new BattleStateMachine({ party, enemies: [enemyCopy('goblin'), enemyCopy('goblin'), enemyCopy('goblin')], spells: SPELLS }, rng);
    bsm.startBattle();
    bsm.advanceFromIntro();
    bsm.allEnemies[0].currentHp = 0; // Goblin A falls before the round
    bsm.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    bsm.submitCommand({ type: 'fight', actorId: 'party_1', targetId: 'enemy_0' });
    bsm.prepareRound();
    const first = bsm.peekNextAction()!;
    const afterFirst = draws;
    const second = bsm.peekNextAction()!;
    expect(draws).toBe(afterFirst);
    expect(second.targetId).toBe(first.targetId);
    if (first.actorId.startsWith('party_')) {
      expect(first.targetId).not.toBe('enemy_0');
      expect(first.targetName).not.toBe('Goblin A');
    }
  });
});
