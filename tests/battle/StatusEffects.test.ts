import { describe, it, expect } from 'vitest';
import { StatusTracker } from '../../src/battle/StatusEffects.js';

describe('StatusTracker', () => {
  it('applies and checks status effects', () => {
    const tracker = new StatusTracker();
    expect(tracker.has('poison')).toBe(false);
    tracker.apply('poison', 3);
    expect(tracker.has('poison')).toBe(true);
  });

  it('removes status effects', () => {
    const tracker = new StatusTracker();
    tracker.apply('stun', 2);
    expect(tracker.has('stun')).toBe(true);
    tracker.remove('stun');
    expect(tracker.has('stun')).toBe(false);
  });

  it('clears all effects', () => {
    const tracker = new StatusTracker();
    tracker.apply('poison', 3);
    tracker.apply('sleep', 2);
    tracker.clear();
    expect(tracker.has('poison')).toBe(false);
    expect(tracker.has('sleep')).toBe(false);
  });

  describe('getAll', () => {
    it('returns all effects with remaining turns', () => {
      const tracker = new StatusTracker();
      tracker.apply('poison', 3);
      tracker.apply('blind', Infinity);
      const all = tracker.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual({ effect: 'poison', remainingTurns: 3 });
      expect(all).toContainEqual({ effect: 'blind', remainingTurns: Infinity });
    });
  });

  describe('tick', () => {
    it('deals 5% max HP damage for poison', () => {
      const tracker = new StatusTracker();
      tracker.apply('poison', 3);
      const result = tracker.tick(100);
      expect(result.damage).toBe(5);
    });

    it('returns skipTurn for stun', () => {
      const tracker = new StatusTracker();
      tracker.apply('stun', 2);
      const result = tracker.tick(100);
      expect(result.skipTurn).toBe(true);
    });

    it('returns skipTurn for sleep', () => {
      const tracker = new StatusTracker();
      tracker.apply('sleep', 2);
      const result = tracker.tick(100);
      expect(result.skipTurn).toBe(true);
    });

    it('returns no damage or skip for other effects', () => {
      const tracker = new StatusTracker();
      tracker.apply('blind', 2);
      const result = tracker.tick(100);
      expect(result.damage).toBe(0);
      expect(result.skipTurn).toBe(false);
    });

    it('decrements duration and expires effects at 0', () => {
      const tracker = new StatusTracker();
      tracker.apply('stun', 2);
      
      let result = tracker.tick(100);
      expect(result.expired).toEqual([]);
      expect(tracker.has('stun')).toBe(true);
      
      result = tracker.tick(100);
      expect(result.expired).toEqual(['stun']);
      expect(tracker.has('stun')).toBe(false);
    });

    it('does not expire Infinity duration effects', () => {
      const tracker = new StatusTracker();
      tracker.apply('death', Infinity);
      
      tracker.tick(100);
      tracker.tick(100);
      tracker.tick(100);
      
      expect(tracker.has('death')).toBe(true);
    });

    it('returns multiple expired effects', () => {
      const tracker = new StatusTracker();
      tracker.apply('stun', 1);
      tracker.apply('blind', 1);
      
      const result = tracker.tick(100);
      expect(result.expired).toHaveLength(2);
      expect(result.expired).toContain('stun');
      expect(result.expired).toContain('blind');
    });
  });

  describe('onHit', () => {
    it('removes sleep when hit', () => {
      const tracker = new StatusTracker();
      tracker.apply('sleep', 3);
      expect(tracker.has('sleep')).toBe(true);
      tracker.onHit();
      expect(tracker.has('sleep')).toBe(false);
    });

    it('does not remove other effects on hit', () => {
      const tracker = new StatusTracker();
      tracker.apply('poison', 3);
      tracker.onHit();
      expect(tracker.has('poison')).toBe(true);
    });
  });
});
