/**
 * CHAOS_FORMS_PLAN 2.2 item 2 (A8): every enemy HP write in a battle goes through `setEnemyHp`, so the form floor
 * holds for spell damage, physical damage, the status tick and revive (HP 1). A static check allows no other
 * `currentHp =` write on an enemy in src/battle.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { setEnemyHp } from '../../src/battle/enemyHp.js';
import { Character } from '../../src/entities/Character.js';
import type { EnemyData, SpellData } from '../../src/types/index.js';
import { testClass, testEnemy } from '../helpers/testUtils.js';

const SPELLS = [
  { id: 'fire', name: 'FIRE', level: 1, type: 'black', effect: 'damage', targeting: 'single', power: 10, element: 'fire' },
  { id: 'life', name: 'LIFE', level: 1, type: 'white', effect: 'revive', targeting: 'single_ally', power: 0, element: 'none' },
] as SpellData[];
/** A form root whose floor is 50 of 100 (no form record: the change logs an error, the floor still holds). */
const FLOORED: EnemyData = testEnemy({ id: 'root', stats: { hp: 100, agility: 1, defense: 0, magicDefense: 0, evade: 0 },
  bossPhases: [{ hpThreshold: 0.5, patternId: 'p', form: 'next' }] });

const strong = (): Character => new Character({ name: 'Hero', classData: testClass('warrior', {
  baseStats: { hp: 999, strength: 999, agility: 99, intelligence: 99, vitality: 99, luck: 5 }, spellLevels: { white: 8, black: 8 },
  spellCharges: [[1, [9]]] }) });

function hitOnce(cmd: { type: 'fight' | 'magic'; spellId?: string }, enemy: EnemyData = FLOORED): BattleStateMachine {
  const bsm = new BattleStateMachine({ party: [strong()], enemies: [enemy], spells: SPELLS, forms: [] }, () => 0.5);
  bsm.startBattle(); bsm.advanceFromIntro();
  bsm.submitCommand({ ...cmd, actorId: 'party_0', targetId: 'enemy_0' });
  bsm.prepareRound();
  bsm.executeNextAction();
  return bsm;
}

describe('setEnemyHp: the floors hold at every write site', () => {
  it('physical damage', () => {
    expect(hitOnce({ type: 'fight' }).allEnemies[0].currentHp).toBe(50);
  });

  it('spell damage', () => {
    const e = { ...FLOORED, stats: { ...FLOORED.stats, hp: 12 } };   // floor 6; FIRE (power 10) hits for 10 or more
    expect(hitOnce({ type: 'magic', spellId: 'fire' }, e).allEnemies[0].currentHp).toBe(6);
  });

  it('the status tick (poison)', () => {
    const bsm = new BattleStateMachine({ party: [strong()], enemies: [{ ...FLOORED, stats: { ...FLOORED.stats, agility: 999 } }], forms: [] }, () => 0.5);
    bsm.startBattle(); bsm.advanceFromIntro();
    const e = bsm.allEnemies[0];
    e.status.apply('poison', 9);
    setEnemyHp(e, 51);   // poison takes 5
    bsm.submitCommand({ type: 'item', actorId: 'party_0' });
    bsm.prepareRound();
    bsm.executeNextAction();
    expect(e.currentHp).toBe(50);
  });

  it('revive (HP 1), and a plain enemy has no floor', () => {
    const plain = testEnemy({ stats: { hp: 100 } });
    const bsm = new BattleStateMachine({ party: [strong()], enemies: [plain, plain], spells: SPELLS }, () => 0.5);
    const [a, caster] = bsm.allEnemies;
    setEnemyHp(a, 0);
    expect(a.currentHp).toBe(0);
    // an enemy casting LIFE on its fallen ally
    caster.aiBehavior = { selectAction: (self) => ({ type: 'magic', actorId: self.id, targetId: a.id, spellId: 'life' }) };
    bsm.startBattle(); bsm.advanceFromIntro();
    bsm.submitCommand({ type: 'item', actorId: 'party_0' });
    bsm.executeRound();
    expect(a.currentHp).toBe(1);
  });
});

describe('the single write path (static)', () => {
  it('no `currentHp =` write on an enemy in src/battle outside enemyHp.ts', () => {
    const dir = join(process.cwd(), 'src/battle');
    const offenders: string[] = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts') && n !== 'enemyHp.ts')) {
      readFileSync(join(dir, f), 'utf-8').split('\n').forEach((line, i) => {
        const m = /(\w+)\.currentHp\s*(=(?!=)|\+=|-=)/.exec(line);
        // party members are `char` / `hero` (the Character setter clamps); anything else is an enemy write
        if (m && !['char', 'hero'].includes(m[1])) offenders.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
