import { describe, it, expect } from 'vitest';
import { formatConciseResult } from '../../../src/scenes/battle/battleMessageUtils.js';

const msgs = (...texts: string[]) => texts.map(text => ({ text }));

describe('formatConciseResult with names containing spaces and dots', () => {
  it('a party hit with a dotted name', () => {
    expect(formatConciseResult(msgs('J.R. Bob hits Goblin A for 7!', 'Goblin A defeated!'), 'J.R. Bob')).toBe('→ 7 to Goblin A *');
  });

  it('a critical hit keeps the target name with a space', () => {
    expect(formatConciseResult(msgs('Sir Kay hits Goblin B for 12! Critical!'), 'Sir Kay')).toBe('→ 12 to Goblin B!');
  });

  it('a miss with a dotted name', () => {
    expect(formatConciseResult(msgs('J.R. Bob missed!'), 'J.R. Bob')).toBe('→ Miss!');
  });

  it('a dot in the name is literal, not a wildcard', () => {
    expect(formatConciseResult(msgs('JxR missed!'), 'J.R')).not.toBe('→ Miss!');
  });

  it('poison and sleep on a name with a space', () => {
    expect(formatConciseResult(msgs('Sir Kay takes 3 poison damage!'), 'Sir Kay')).toBe('Poison → 3 dmg');
    expect(formatConciseResult(msgs('Sir Kay is asleep!'), 'Sir Kay')).toBe('Asleep');
  });

  it('an enemy hit on a party member with a space in the name', () => {
    expect(formatConciseResult(msgs('Goblin A hits Sir Kay for 4!', 'Sir Kay fell!'), 'Goblin A')).toBe('→ 4 to Sir Kay *');
  });

  it('a spell cast by a dotted name', () => {
    expect(formatConciseResult(msgs('J.R. Bob casts FIRE!', 'Goblin A takes 12 damage!'), 'J.R. Bob')).toBe('→ 12 to Goblin A');
  });
});
