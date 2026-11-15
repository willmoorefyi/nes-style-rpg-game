/** F0 (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 4): the next action and its result carry the spell / item id. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { SPELLS, enemyCopy, makeMember } from '../helpers/balanceData.js';

afterEach(() => { vi.restoreAllMocks(); });

function battleWith(cmd: 'magic' | 'item' | 'fight') {
  const blm = makeMember('black_mage', 5, { gear: [], spells: ['fire'] });
  blm.currentHp = 5;
  const enemy = enemyCopy('goblin');
  enemy.stats.agility = 0;
  const inventory = new Inventory();
  inventory.add('potion', 1);
  const bsm = new BattleStateMachine({ party: [blm], enemies: [enemy], spells: SPELLS, inventory }, () => 0.5);
  bsm.startBattle();
  bsm.advanceFromIntro();
  if (cmd === 'magic') bsm.submitCommand({ type: 'magic', actorId: 'party_0', spellId: 'fire', targetId: 'enemy_0' });
  else if (cmd === 'item') bsm.submitCommand({ type: 'item', actorId: 'party_0', itemId: 'potion', targetId: 'party_0' });
  else bsm.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
  bsm.prepareRound();
  // the party member acts first (the goblin has no agility); skip to its action if needed
  while (bsm.peekNextAction()?.actorId !== 'party_0') bsm.executeNextAction();
  return bsm;
}

describe('spellId / itemId on NextActionInfo and ActionResult', () => {
  it('a spell: the id next to its display name, on the peek and on the result', () => {
    const bsm = battleWith('magic');
    expect(bsm.peekNextAction()).toMatchObject({ spellId: 'fire', spellName: 'FIRE' });
    expect(bsm.executeNextAction().spellId).toBe('fire');
  });

  it('an item: the id on the peek and on the result', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bsm = battleWith('item');
    expect(bsm.peekNextAction()?.itemId).toBe('potion');
    expect(bsm.executeNextAction().itemId).toBe('potion');
  });

  it('a fight has neither', () => {
    const bsm = battleWith('fight');
    const info = bsm.peekNextAction()!;
    expect('spellId' in info || 'itemId' in info).toBe(false);
    const result = bsm.executeNextAction();
    expect('spellId' in result || 'itemId' in result).toBe(false);
  });
});
