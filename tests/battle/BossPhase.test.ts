/**
 * ST-6 (docs/FIX_PLAN_PENINSULA.md T5a) and B1 (R2): Garland's `bossPhases` entry fires with no AI attached. At
 * or below his phase threshold (`floor(hpThreshold × hp)`, read from the data: 200 of 400 since pass F item 2, FB-2;
 * U1 had 85 of 340) the phase line shows once and his attacks go from 2 hits to 3 (a battle-only `hits` buff, no extra
 * RNG draw for the phase itself).
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

const count = (bsm: BattleStateMachine) => bsm.currentMessages.filter(m => m.text === LINE).length;
/** Garland's HP and the phase threshold from the data (U1, FB-2: not literals). */
const HP = enemyCopy('garland').stats.hp;
const THRESHOLD = enemyCopy('garland').bossPhases?.[0].hpThreshold ?? NaN;
const PHASE_HP = Math.floor(THRESHOLD * HP);

describe('boss phase with no AI (ST-6)', () => {
  it(`Garland at ${PHASE_HP}/${HP} HP: the next round says the phase line exactly once, and later rounds never repeat it`, () => {
    const garland = enemyCopy('garland');
    expect(THRESHOLD).toBeGreaterThan(0);
    expect(THRESHOLD).toBeLessThan(1);
    expect(garland.bossPhases?.[0].message).toBe(LINE);
    const bsm = newBattle(garland, 7);
    bsm.allEnemies[0].currentHp = PHASE_HP;
    idleRound(bsm);
    expect(count(bsm)).toBe(1);
    expect(bsm.currentMessages[0].text).toBe(LINE); // before any action's lines
    for (let r = 0; r < 3 && !bsm.isOver; r++) {
      idleRound(bsm);
      expect(count(bsm)).toBe(0);
    }
  });

  it(`above the phase threshold (${PHASE_HP + 1}/${HP}) there is no line and he keeps 2 hits`, () => {
    const bsm = newBattle(enemyCopy('garland'), 7);
    bsm.allEnemies[0].currentHp = PHASE_HP + 1;
    idleRound(bsm);
    expect(count(bsm)).toBe(0);
    expect(bsm.allEnemies[0].buffs.get('hits') ?? 0).toBe(0);
  });

  it('events are identical with and without bossPhases until the phase round; after it some lines read "(3 hits)", never before', () => {
    let threeHitLines = 0;
    for (const seed of [1, 2, 3, 42, 99]) {
      const run = (withPhases: boolean) => {
        const garland = enemyCopy('garland');
        if (!withPhases) delete garland.bossPhases;
        const bsm = newBattle(garland, seed);
        bsm.allEnemies[0].currentHp = PHASE_HP + Math.floor(HP / 4); // reach the phase within a few rounds
        const rounds: { events: DamageEvent[]; lines: string[] }[] = [];
        for (let r = 0; r < 12 && !bsm.isOver; r++) {
          while (bsm.state === 'command_select') bsm.submitCommand({ type: 'fight', actorId: bsm.currentCommandActorId!, targetId: 'enemy_0' });
          bsm.executeRound(); // the round's lines, read before a victory replaces them
          rounds.push({ events: [...bsm.damageEvents], lines: bsm.currentMessages.map(m => m.text) });
          bsm.resolveRound();
        }
        return rounds;
      };
      const withPhases = run(true);
      const without = run(false);
      const phaseRound = withPhases.findIndex(r => r.lines.includes(LINE));
      const before = phaseRound < 0 ? withPhases.length : phaseRound;
      for (let r = 0; r < before; r++) {
        expect(withPhases[r].events, `seed ${seed} round ${r}`).toEqual(without[r].events);
        expect(withPhases[r].lines.some(t => t.includes('(3 hits)')), `seed ${seed} round ${r}`).toBe(false);
      }
      expect(without.some(r => r.lines.some(t => t.includes('(3 hits)')))).toBe(false);
      for (const r of withPhases.slice(before)) threeHitLines += r.lines.filter(t => /^Garland hits .*\(3 hits\)/.test(t)).length;
    }
    expect(threeHitLines).toBeGreaterThan(0);
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
