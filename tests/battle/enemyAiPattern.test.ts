/**
 * ROSTER_PLAN 7.2 (FW-D): an enemy's data `ai` (spec spell-use rate over its spells that exist in spells.yaml)
 * becomes its actions when no debug `enemyAi` is given; it targets by the spell's side and keeps its actions across a
 * boss phase (no pattern lookup, no warning).
 */
import { describe, it, expect, vi } from 'vitest';
import { dataAiPattern, dataDrivenAI } from '../../src/battle/enemyAiPattern.js';
import { BattleStateMachine, type EnemyInstance } from '../../src/battle/BattleStateMachine.js';
import { StatusTracker } from '../../src/battle/StatusEffects.js';
import { SPELLS, enemyCopy, makeParty } from '../helpers/balanceData.js';
import { mulberry32 } from '../helpers/battlePolicies.js';

describe('data-driven enemy ai', () => {
  it('splits the turns: Fight 1 - rate, each spell rate x its weight share; unknown spells are dropped', () => {
    const p = dataAiPattern({ rate: 0.75, actions: [{ type: 'magic', spellId: 'fir2', weight: 2 }, { type: 'magic', spellId: 'ice2', weight: 1 },
      { type: 'magic', spellId: 'no_such_spell', weight: 5 }] }, SPELLS)!;
    expect(p.actions.map((a) => [a.type, a.spellId, a.weight])).toEqual([['fight', undefined, 0.25], ['magic', 'fir2', 0.5], ['magic', 'ice2', 0.25]]);
    expect(dataAiPattern({ rate: 1, actions: [{ type: 'magic', spellId: 'fire', weight: 1 }] }, SPELLS)!.actions).toHaveLength(1);
  });

  it('no known spell (or rate 0): no ai, the enemy keeps the default Fight', () => {
    expect(dataAiPattern({ rate: 0.5, actions: [{ type: 'magic', spellId: 'no_such_spell', weight: 1 }] }, SPELLS)).toBeNull();
    expect(dataAiPattern({ rate: 0, actions: [{ type: 'magic', spellId: 'fire', weight: 1 }] }, SPELLS)).toBeNull();
    expect(dataDrivenAI({ rate: 0.5, actions: [{ type: 'magic', spellId: 'no_such_spell', weight: 1 }] }, SPELLS)).toBeNull();
  });

  it('the lich (Rime Sovereign) casts about 75 % of its turns over its 8 spells, FAST on its own side', () => {
    const lich = enemyCopy('lich');
    const ai = dataDrivenAI(lich.ai!, SPELLS)!;
    const rng = mulberry32(5);
    const party = makeParty(10, 'start', false);
    const self: EnemyInstance = { id: 'enemy_0', data: lich, currentHp: 800, status: new StatusTracker(), buffs: new Map(), displayName: 'Rime Sovereign' };
    const counts = new Map<string, number>();
    for (let n = 0; n < 4000; n++) {
      const cmd = ai.selectAction(self, party, [self], n, rng);
      const key = cmd.type === 'magic' ? cmd.spellId! : 'fight';
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (cmd.spellId === 'fast') expect(cmd.targetId).toBe('enemy_0');
      else expect(cmd.targetId).toMatch(/^party_/);
    }
    expect((counts.get('fight') ?? 0) / 4000).toBeGreaterThan(0.22);
    expect((counts.get('fight') ?? 0) / 4000).toBeLessThan(0.28);
    expect([...counts.keys()].sort()).toEqual(['fight', 'fir2', 'fast', 'hold', 'ice2', 'lit2', 'slep', 'slow', 'slp2'].sort());
  });

  it('Dark Fighter casts CUR3 (rate 0.5) at the most hurt living ally, herself when she is the most hurt', () => {
    const df = enemyCopy('dark_fighter');
    expect(df.ai?.rate).toBe(0.5);
    const ai = dataDrivenAI(df.ai!, SPELLS)!;
    const party = makeParty(10, 'start', false);
    const mk = (id: string, hp: number): EnemyInstance =>
      ({ id, data: df, currentHp: hp, status: new StatusTracker(), buffs: new Map(), displayName: 'Dark Fighter' });
    const spell = () => 0.9; // past the Fight share (0.5): the spell
    const self = mk('enemy_0', 200);
    const allies = [self, mk('enemy_1', 120), mk('enemy_2', 0), mk('enemy_3', 180)];
    expect(ai.selectAction(self, party, allies, 1, spell)).toMatchObject({ type: 'magic', spellId: 'cure3', targetId: 'enemy_1' });
    self.currentHp = 50;
    expect(ai.selectAction(self, party, allies, 1, spell)).toMatchObject({ type: 'magic', spellId: 'cure3', targetId: 'enemy_0' });
    expect(ai.selectAction(self, party, allies, 1, () => 0.2).type).toBe('fight');
  });

  it('a boss phase keeps the data ai without a pattern warning, and still says its line', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const lich = enemyCopy('lich');
    const bsm = new BattleStateMachine({ party: makeParty(10, 'start', false), enemies: [lich], spells: SPELLS, canRun: false }, mulberry32(9));
    bsm.setEnemyAI(0, dataDrivenAI(lich.ai!, SPELLS)!);
    bsm.startBattle();
    bsm.advanceFromIntro();
    bsm.allEnemies[0].currentHp = 300;
    while (bsm.state === 'command_select') bsm.submitCommand({ type: 'item', actorId: bsm.currentCommandActorId! });
    bsm.executeRound();
    expect(bsm.currentMessages.map((m) => m.text)).toContain("The Rime Sovereign's skull fractures!");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
