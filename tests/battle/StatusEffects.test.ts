import { describe, it, expect } from 'vitest';
import { StatusTracker } from '../../src/battle/StatusEffects.js';

describe('StatusTracker', () => {
  it('applies and checks status effects', () => {
    const tracker = new StatusTracker();
    expect(tracker.has('poison')).toBe(false);
    tracker.apply('poison');
    expect(tracker.has('poison')).toBe(true);
  });

  it('removes status effects', () => {
    const tracker = new StatusTracker();
    tracker.apply('stun');
    expect(tracker.has('stun')).toBe(true);
    tracker.remove('stun');
    expect(tracker.has('stun')).toBe(false);
  });

  it('clears all effects', () => {
    const tracker = new StatusTracker();
    tracker.apply('poison');
    tracker.apply('sleep');
    tracker.clear();
    expect(tracker.has('poison')).toBe(false);
    expect(tracker.has('sleep')).toBe(false);
  });

  describe('tick', () => {
    it('deals 5% max HP damage for poison', () => {
      const tracker = new StatusTracker();
      tracker.apply('poison');
      const result = tracker.tick(100);
      expect(result.damage).toBe(5);
    });

    it('returns skipTurn for stun', () => {
      const tracker = new StatusTracker();
      tracker.apply('stun');
      const result = tracker.tick(100);
      expect(result.skipTurn).toBe(true);
    });

    it('returns skipTurn for sleep', () => {
      const tracker = new StatusTracker();
      tracker.apply('sleep');
      const result = tracker.tick(100);
      expect(result.skipTurn).toBe(true);
    });

    it('returns no damage or skip for other effects', () => {
      const tracker = new StatusTracker();
      tracker.apply('blind');
      const result = tracker.tick(100);
      expect(result.damage).toBe(0);
      expect(result.skipTurn).toBe(false);
    });
  });

  describe('onHit', () => {
    it('removes sleep when hit', () => {
      const tracker = new StatusTracker();
      tracker.apply('sleep');
      expect(tracker.has('sleep')).toBe(true);
      tracker.onHit();
      expect(tracker.has('sleep')).toBe(false);
    });

    it('does not remove other effects on hit', () => {
      const tracker = new StatusTracker();
      tracker.apply('poison');
      tracker.onHit();
      expect(tracker.has('poison')).toBe(true);
    });
  });
});
