import { describe, it, expect } from 'vitest';
import { leaderClassId } from '../../../src/scenes/exploration/FieldPlayer.js';
import type { Game } from '../../../src/core/Game.js';

/** A party stand-in: `all` and `get` over the given members. */
function partyOf(members: Array<{ id: string; hp: number }>): Pick<Game, 'party'> {
  const all = members.map((m) => ({ classData: { id: m.id }, currentHp: m.hp }));
  return { party: { all, get: (i: number) => all[i] ?? null } } as unknown as Pick<Game, 'party'>;
}

describe('leaderClassId (U5)', () => {
  it('skips a fallen leader: the first living member leads', () => {
    expect(leaderClassId(partyOf([{ id: 'warrior', hp: 0 }, { id: 'thief', hp: 12 }]))).toBe('thief');
  });

  it('a living leader leads', () => {
    expect(leaderClassId(partyOf([{ id: 'warrior', hp: 5 }, { id: 'thief', hp: 12 }]))).toBe('warrior');
  });

  it('all fallen: member 0 leads', () => {
    expect(leaderClassId(partyOf([{ id: 'warrior', hp: 0 }, { id: 'thief', hp: 0 }]))).toBe('warrior');
  });

  it('an empty party: a warrior', () => {
    expect(leaderClassId(partyOf([]))).toBe('warrior');
  });
});
