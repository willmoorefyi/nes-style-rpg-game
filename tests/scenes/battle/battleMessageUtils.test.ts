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

describe('formatConciseResult: FF1 multi-hit, status rolls and waking (T4a)', () => {
  it('a multi-hit line shows the hit count', () => {
    expect(formatConciseResult(msgs('Monk hits Goblin for 18! (2 hits)'), 'Monk')).toBe('→ 18 to Goblin x2');
    expect(formatConciseResult(msgs('Monk hits Goblin for 30! (2 hits) Critical!', 'Goblin defeated!'), 'Monk'))
      .toBe('→ 30 to Goblin x2! *');
    expect(formatConciseResult(msgs('Garland hits Sir Kay for 31! (2 hits)'), 'Garland')).toBe('→ 31 to Sir Kay x2');
  });

  it('one hit has no count', () => {
    expect(formatConciseResult(msgs('Monk hits Goblin for 9!'), 'Monk')).toBe('→ 9 to Goblin');
  });

  it('a status spell that lands on some and misses others counts the ones it caught', () => {
    const texts = msgs('BM casts SLEP!', 'Goblin A is affected by sleep!', 'Goblin B is unaffected.', 'Goblin C is affected by sleep!');
    expect(formatConciseResult(texts, 'BM')).toBe('→ Sleep 2 foes');
    expect(formatConciseResult(msgs('BM casts SLEP!', 'Goblin A is affected by sleep!', 'Goblin B is unaffected.'), 'BM'))
      .toBe('→ Sleep Goblin A');
  });

  it('a status or debuff spell that lands on nobody says "Unaffected"', () => {
    expect(formatConciseResult(msgs('BM casts SLEP!', 'Goblin A is unaffected.', 'Goblin B is unaffected.'), 'BM')).toBe('→ Unaffected');
    expect(formatConciseResult(msgs('BM casts LOCK!', 'Wolf is unaffected.'), 'BM')).toBe('→ Unaffected');
  });

  it('a sleeper that loses its turn and wakes says so', () => {
    expect(formatConciseResult(msgs('Garland is asleep!', 'Garland wakes up!'), 'Garland')).toBe('Asleep → Wakes up');
    expect(formatConciseResult(msgs('Garland is stunned!', 'Garland wakes up!'), 'Garland')).toBe('Stunned → Wakes up');
    expect(formatConciseResult(msgs('Goblin is asleep!'), 'Goblin')).toBe('Asleep');
  });
});

