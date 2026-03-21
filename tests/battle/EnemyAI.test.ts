import { describe, it, expect } from 'vitest';
import { selectTarget } from '../../src/battle/EnemyAI.js';

describe('EnemyAI', () => {
  it('should select only living targets', () => {
    const targets = [
      { id: 'a', isAlive: false },
      { id: 'b', isAlive: true },
      { id: 'c', isAlive: false },
    ];
    const result = selectTarget(targets, () => 0);
    expect(result?.id).toBe('b');
  });

  it('should return null if no living targets', () => {
    const targets = [
      { id: 'a', isAlive: false },
      { id: 'b', isAlive: false },
    ];
    const result = selectTarget(targets);
    expect(result).toBeNull();
  });

  it('should randomly select among living targets', () => {
    const targets = [
      { id: 'a', isAlive: true },
      { id: 'b', isAlive: true },
      { id: 'c', isAlive: true },
    ];
    const result = selectTarget(targets, () => 0.5);
    expect(result?.id).toBe('b');
  });
});
