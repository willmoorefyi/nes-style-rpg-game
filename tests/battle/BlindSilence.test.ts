/**
 * B8 (docs/FIX_PLAN_PENINSULA.md R2): blind and silence do something. FF1 blind: −40 on the hit roll for a blind
 * attacker, +40 against a blind defender. A silenced caster (either side) spends no charge and loses the turn.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { physicalAttack } from '../../src/battle/DamageFormula.js';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { BossAI } from '../../src/battle/BossAI.js';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { loadRealRegistries } from '../helpers/realData.js';
import { mulberry32 } from '../helpers/battlePolicies.js';
import { enemyCopy, makeParty, SPELLS } from '../helpers/balanceData.js';

beforeAll(async () => { await loadRealRegistries(); });

/** Every roll at 0.05: a hit roll of 10 out of 200. */
const low = () => 0.05;

describe('B8: blind on the hit roll', () => {
  it('on the border, a blind attacker misses where a sighted one hits', () => {
    // chance = 168 + 0 − 148 = 20 (> 10: a hit); blind: 20 − 40 = −20 (a miss)
    const atk = { attack: 10, hitPercent: 0, hits: 1, crit: 0 };
    const def = { evade: 148, absorb: 0 };
    expect(physicalAttack(atk, def, low).hit).toBe(true);
    expect(physicalAttack({ ...atk, blind: true }, def, low).hit).toBe(false);
  });

  it('a blind target is hit where a sighted one is missed', () => {
    // chance = 168 − 188 = −20 (a miss); against a blind target: −20 + 40 = 20 (a hit)
    const atk = { attack: 10, hitPercent: 0, hits: 1, crit: 0 };
    const def = { evade: 188, absorb: 0 };
    expect(physicalAttack(atk, def, low).hit).toBe(false);
    expect(physicalAttack(atk, { ...def, blind: true }, low).hit).toBe(true);
  });

  it('in battle, a wolf under DARK lands fewer of 20 seeded swings than without (the browser check of revision 22)', () => {
    const landed = (blind: boolean) => {
      let hits = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const party = makeParty(5, 'start', false);
        const bsm = new BattleStateMachine({ party, enemies: [enemyCopy('wolf')], spells: SPELLS, canRun: false }, mulberry32(seed));
        bsm.startBattle();
        bsm.advanceFromIntro();
        if (blind) bsm.allEnemies[0].status.apply('blind');
        while (bsm.state === 'command_select') bsm.submitCommand({ type: 'item', actorId: bsm.currentCommandActorId! });
        bsm.executeRound();
        if (bsm.currentMessages.some(m => m.text.startsWith('Wolf hits '))) hits++;
      }
      return hits;
    };
    expect(landed(true)).toBeLessThan(landed(false));
  });
});

describe('B8: silence', () => {
  it('a silenced Black Mage\'s FIRE leaves the charges and the enemy HP unchanged and says so', () => {
    const mage = new Character({ name: 'B.MAG', classData: ClassRegistry.getClass('black_mage')! });
    mage.learnSpell('fire', 1);
    mage.setSpellCharges(1, 2);
    mage.statusTracker.apply('silence');
    const goblin = enemyCopy('goblin');
    goblin.stats.agility = 0; // the mage acts first
    const bsm = new BattleStateMachine({ party: [mage], enemies: [goblin], spells: SPELLS }, () => 0.5);
    bsm.startBattle();
    bsm.advanceFromIntro();
    bsm.submitCommand({ type: 'magic', actorId: 'party_0', targetId: 'enemy_0', spellId: 'fire' });
    bsm.prepareRound();
    const result = bsm.executeNextAction();
    expect(result.messages.map(m => m.text)).toEqual(['B.MAG is silenced!']);
    expect(mage.getSpellCharges(1)).toBe(2);
    expect(bsm.allEnemies[0].currentHp).toBe(goblin.stats.hp);
  });

  it('a silenced enemy caster (enemyAi: ICE) does not cast', () => {
    const party = makeParty(5, 'start', false);
    const bsm = new BattleStateMachine({ party, enemies: [enemyCopy('lich')], spells: SPELLS, canRun: false }, mulberry32(3));
    bsm.setEnemyAI(0, new BossAI({ actions: [{ type: 'magic', spellId: 'ice', weight: 1 }] }));
    bsm.startBattle();
    bsm.advanceFromIntro();
    bsm.allEnemies[0].status.apply('silence');
    const hp = party.map(c => c.currentHp);
    while (bsm.state === 'command_select') bsm.submitCommand({ type: 'item', actorId: bsm.currentCommandActorId! });
    bsm.executeRound();
    const lines = bsm.currentMessages.map(m => m.text);
    expect(lines).toContain('Lich is silenced!');
    expect(lines.some(t => t.includes('casts ICE'))).toBe(false);
    expect(party.map(c => c.currentHp)).toEqual(hp);
  });
});
