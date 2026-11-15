/**
 * ROSTER_PLAN 7.2 (FW-D): BossAI targets by the chosen spell's `targeting` on the caster's own side. An enemy casting
 * CURE (single_ally) never targets, nor heals, a hero; RUSE (self) targets the caster; FIR2 (all) and a Fight still
 * aim at the party.
 */
import { describe, it, expect } from 'vitest';
import { BossAI, type BossPattern } from '../../src/battle/BossAI.js';
import { BattleStateMachine, type EnemyInstance } from '../../src/battle/BattleStateMachine.js';
import { StatusTracker } from '../../src/battle/StatusEffects.js';
import type { EnemyData } from '../../src/types/index.js';
import { SPELLS, enemyCopy, makeParty } from '../helpers/balanceData.js';
import { mulberry32 } from '../helpers/battlePolicies.js';

const base: EnemyData = {
  id: 'healer', name: 'Healer',
  stats: { hp: 100, strength: 5, agility: 5, intelligence: 10, vitality: 5, luck: 5, attack: 5, defense: 0, magicDefense: 0 },
  xpReward: 1, goldReward: 1, sprite: 'goblin',
};

function enemyAt(i: number, hp: number, maxHp = 100): EnemyInstance {
  const data = { ...base, stats: { ...base.stats, hp: maxHp } };
  return { id: `enemy_${i}`, data, currentHp: hp, status: new StatusTracker(), buffs: new Map(), displayName: `Healer ${i}` };
}

const only = (spellId: string): BossPattern => ({ actions: [{ type: 'magic', spellId, weight: 1 }] });
const party = makeParty(5, 'start', false);

describe('BossAI targets by spell.targeting (FW-D)', () => {
  it('an enemy casting CURE (single_ally) never targets a hero over 1,000 seeded draws', () => {
    const ai = new BossAI(only('cure'), SPELLS);
    const rng = mulberry32(11);
    for (let n = 0; n < 1000; n++) {
      const allies = [enemyAt(0, 1 + Math.floor(rng() * 100)), enemyAt(1, 1 + Math.floor(rng() * 100)), enemyAt(2, 1 + Math.floor(rng() * 100))];
      const self = allies[n % 3];
      const cmd = ai.selectAction(self, party, allies, n, rng);
      expect(cmd.type).toBe('magic');
      expect(cmd.targetId?.startsWith('enemy_'), `draw ${n}: ${cmd.targetId}`).toBe(true);
    }
  });

  it('single_ally picks the living ally with the lowest HP fraction (itself included); the first on a tie', () => {
    const ai = new BossAI(only('cure'), SPELLS);
    const allies = [enemyAt(0, 90), enemyAt(1, 30, 200), enemyAt(2, 20)];
    expect(ai.selectAction(allies[0], party, allies, 1, () => 0.5).targetId).toBe('enemy_1');   // 15 % < 20 %
    allies[1].currentHp = 0;
    expect(ai.selectAction(allies[0], party, allies.filter((a) => a.currentHp > 0), 1, () => 0.5).targetId).toBe('enemy_2');
    const tie = [enemyAt(0, 50), enemyAt(1, 50)];
    expect(ai.selectAction(tie[1], party, tie, 1, () => 0.5).targetId).toBe('enemy_0');
    const alone = enemyAt(4, 10);
    expect(ai.selectAction(alone, party, [], 1, () => 0.5).targetId).toBe('enemy_4');
  });

  it('RUSE (self) targets the caster; HEAL (all_allies) names no hero', () => {
    const allies = [enemyAt(0, 10), enemyAt(1, 90)];
    expect(new BossAI(only('ruse'), SPELLS).selectAction(allies[1], party, allies, 1, () => 0.5).targetId).toBe('enemy_1');
    expect(new BossAI(only('heal'), SPELLS).selectAction(allies[1], party, allies, 1, () => 0.5).targetId).toBeUndefined();
  });

  it('FIR2 (all), HOLD (single) and a Fight still aim at a living hero', () => {
    const allies = [enemyAt(0, 10)];
    for (const pattern of [only('fir2'), only('hold'), { actions: [{ type: 'fight' as const, weight: 1 }] }]) {
      const ai = new BossAI(pattern, SPELLS);
      for (let r = 0; r < 20; r++) {
        const cmd = ai.selectAction(allies[0], party, allies, 1, () => r / 20);
        expect(cmd.targetId).toMatch(/^party_[0-3]$/);
      }
    }
  });

  it('a spell it has no data for aims at the party, as before (no spells given)', () => {
    const cmd = new BossAI(only('cure')).selectAction(enemyAt(0, 10), party, [enemyAt(0, 10)], 1, () => 0);
    expect(cmd.targetId).toBe('party_0');
  });

  it('in battle: an enemy RUSE (self) and FAST (single_ally) raise the caster, never a hero', () => {
    for (const [spellId, stat, line] of [['ruse', 'evade', 'evasion'], ['fast', 'agility', 'speed']] as const) {
      const heroes = makeParty(10, 'start', false);
      const bsm = new BattleStateMachine({ party: heroes, enemies: [enemyCopy('goblin')], spells: SPELLS, canRun: false }, mulberry32(4));
      bsm.setEnemyAI(0, new BossAI(only(spellId), SPELLS));
      bsm.startBattle();
      bsm.advanceFromIntro();
      while (bsm.state === 'command_select') bsm.submitCommand({ type: 'item', actorId: bsm.currentCommandActorId! });
      bsm.executeRound();
      expect(bsm.currentMessages.map((m) => m.text)).toContain(`Goblin's ${line} increased!`);
      expect(bsm.allEnemies[0].buffs.get(stat), spellId).toBeGreaterThan(0);
    }
  });

  it('in battle: a goblin casting CURE every turn heals its hurt ally and never a hero (200 rounds, 10 seeds)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const heroes = makeParty(10, 'start', false);
      for (const h of heroes) h.currentHp = Math.max(1, Math.floor(h.maxHp / 2));
      const goblins = [enemyCopy('goblin'), enemyCopy('goblin')].map((g) => ({ ...g, stats: { ...g.stats, hp: 5000 } }));
      const bsm = new BattleStateMachine({ party: heroes, enemies: goblins, spells: SPELLS, canRun: false }, mulberry32(seed));
      bsm.allEnemies.forEach((_, i) => bsm.setEnemyAI(i, new BossAI(only('cure'), SPELLS)));
      bsm.startBattle();
      bsm.advanceFromIntro();
      bsm.allEnemies[1].currentHp = 1000;
      const before = heroes.map((h) => h.currentHp);
      let heals = 0;
      for (let round = 0; round < 20 && !bsm.isOver; round++) {
        while (bsm.state === 'command_select') bsm.submitCommand({ type: 'item', actorId: bsm.currentCommandActorId! });
        bsm.executeRound();
        const lines = bsm.currentMessages.map((m) => m.text);
        for (const h of heroes) expect(lines.some((t) => t.startsWith(`${h.name} recovers`)), lines.join(' / ')).toBe(false);
        heals += lines.filter((t) => /^Goblin [AB] recovers \d+ HP!$/.test(t)).length;
        bsm.resolveRound();
      }
      expect(heroes.map((h) => h.currentHp)).toEqual(before);
      expect(heals).toBeGreaterThan(0);
    }
  });
});
