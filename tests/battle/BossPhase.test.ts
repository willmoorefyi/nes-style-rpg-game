/**
 * ST-6 (docs/FIX_PLAN_PENINSULA.md T5a): Garland's `bossPhases` entry fires with no AI attached. Following the T4
 * decision the phase is its message only: no pattern, no extra RNG draws, so the seeded damage is unchanged.
 */
import { describe, it, expect, vi } from 'vitest';
import { BattleStateMachine, type DamageEvent } from '../../src/battle/BattleStateMachine.js';
import { BossAI } from '../../src/battle/BossAI.js';
import { mulberry32 } from '../helpers/battlePolicies.js';
import { makeParty, enemyCopy, SPELLS } from '../helpers/balanceData.js';
import type { EnemyData } from '../../src/types/index.js';

const LINE = "Garland's attacks grow fiercer!";

function newBattle(garland: EnemyData, seed: number): BattleStateMachine {
  const bsm = new BattleStateMachine({ party: makeParty(2, 'start', false), enemies: [garland], spells: SPELLS, canRun: false }, mulberry32(seed));
  bsm.startBattle();
  bsm.advanceFromIntro();
  return bsm;
}

/** Every living member uses an empty item command: no HP change and no RNG draw, so only Garland acts. */
function idleRound(bsm: BattleStateMachine): void {
  while (bsm.state === 'command_select') bsm.submitCommand({ type: 'item', actorId: bsm.currentCommandActorId! });
  bsm.executeRound();
  bsm.resolveRound();
}

function fightRound(bsm: BattleStateMachine): void {
  while (bsm.state === 'command_select') bsm.submitCommand({ type: 'fight', actorId: bsm.currentCommandActorId!, targetId: 'enemy_0' });
  bsm.executeRound();
  bsm.resolveRound();
}

const count = (bsm: BattleStateMachine) => bsm.currentMessages.filter(m => m.text === LINE).length;

describe('boss phase with no AI (ST-6)', () => {
  it('Garland at 53/106 HP: the next round says the phase line exactly once, and later rounds never repeat it', () => {
    const garland = enemyCopy('garland');
    expect(garland.stats.hp).toBe(106);
    expect(garland.bossPhases?.[0].message).toBe(LINE);
    const bsm = newBattle(garland, 7);
    bsm.allEnemies[0].currentHp = 53;
    idleRound(bsm);
    expect(count(bsm)).toBe(1);
    expect(bsm.currentMessages[0].text).toBe(LINE); // before any action's lines
    for (let r = 0; r < 3 && !bsm.isOver; r++) {
      idleRound(bsm);
      expect(count(bsm)).toBe(0);
    }
  });

  it('above half HP there is no line', () => {
    const bsm = newBattle(enemyCopy('garland'), 7);
    bsm.allEnemies[0].currentHp = 54;
    idleRound(bsm);
    expect(count(bsm)).toBe(0);
  });

  it('under the same seed, 10 rounds with and without bossPhases give identical damage events (no added damage)', () => {
    for (const seed of [1, 2, 3, 42, 99]) {
      const run = (withPhases: boolean): { events: DamageEvent[]; lines: number } => {
        const garland = enemyCopy('garland');
        if (!withPhases) delete garland.bossPhases;
        const bsm = newBattle(garland, seed);
        const events: DamageEvent[] = [];
        let lines = 0;
        for (let r = 0; r < 10 && !bsm.isOver; r++) {
          fightRound(bsm);
          events.push(...bsm.damageEvents);
          lines += count(bsm);
        }
        return { events, lines };
      };
      const withPhases = run(true);
      const without = run(false);
      expect(withPhases.events).toEqual(without.events);
      expect(without.lines).toBe(0);
    }
  });

  it('an enemy with an AI but an unknown pattern id warns once and still shows the line', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bsm = newBattle(enemyCopy('garland'), 7);
    bsm.setEnemyAI(0, new BossAI({ actions: [{ type: 'fight', weight: 1 }] }));
    bsm.allEnemies[0].currentHp = 40;
    idleRound(bsm);
    expect(count(bsm)).toBe(1);
    if (!bsm.isOver) idleRound(bsm);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
