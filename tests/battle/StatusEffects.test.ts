import { describe, it, expect } from 'vitest';
import { StatusTracker } from '../../src/battle/StatusEffects.js';
import { rollWake, startTurn } from '../../src/battle/StatusTick.js';

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

  describe('fear status', () => {
    it('can be applied and detected', () => {
      const tracker = new StatusTracker();
      tracker.apply('fear');
      expect(tracker.has('fear')).toBe(true);
    });

    it('appears in getAll()', () => {
      const tracker = new StatusTracker();
      tracker.apply('fear');
      const all = tracker.getAll();
      expect(all.some(e => e.effect === 'fear')).toBe(true);
    });

    it('tick() does NOT set skipTurn for fear alone', () => {
      const tracker = new StatusTracker();
      tracker.apply('fear');
      const result = tracker.tick(100);
      expect(result.skipTurn).toBe(false);
    });

    it('tick() does NOT cause poison damage for fear', () => {
      const tracker = new StatusTracker();
      tracker.apply('fear');
      const result = tracker.tick(100);
      expect(result.damage).toBe(0);
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

describe('helpless and the wake rule (FF1, EB-5)', () => {
  function subject(hp: number, tracker = new StatusTracker()) {
    let cur = hp;
    return { name: 'X', maxHp: 100, tracker, fallText: 'fell!', getHp: () => cur, setHp: (v: number) => { cur = v; } };
  }

  it('isHelpless is true for sleep or stun only', () => {
    const t = new StatusTracker();
    expect(t.isHelpless()).toBe(false);
    t.apply('blind');
    expect(t.isHelpless()).toBe(false);
    t.apply('sleep');
    expect(t.isHelpless()).toBe(true);
    t.remove('sleep');
    t.apply('stun');
    expect(t.isHelpless()).toBe(true);
  });

  it('rollWake: rand(0..80) < current HP', () => {
    expect(rollWake(41, () => 0.5)).toBe(true);  // 40 < 41
    expect(rollWake(40, () => 0.5)).toBe(false); // 40 < 40 fails
    expect(rollWake(240, () => 0.999)).toBe(true);
  });

  it('a sleeper loses its turn, then wakes on a good roll', () => {
    const s = subject(50);
    s.tracker.apply('sleep');
    const said: string[] = [];
    expect(startTurn(s, () => 0.1, (t: string) => said.push(t)).canAct).toBe(false);
    expect(said).toEqual(['X is asleep!', 'X wakes up!']);
    expect(s.tracker.has('sleep')).toBe(false);
  });

  it('a paralysed actor (stun) wakes by the same rule; stone never does', () => {
    const stunned = subject(50);
    stunned.tracker.apply('stun');
    startTurn(stunned, () => 0.1, () => undefined);
    expect(stunned.tracker.has('stun')).toBe(false);
    const stone = subject(50);
    stone.tracker.apply('stone');
    expect(startTurn(stone, () => 0.1, () => undefined).canAct).toBe(false);
    expect(stone.tracker.has('stone')).toBe(true);
  });

  it('a low-HP sleeper stays asleep', () => {
    const s = subject(5);
    s.tracker.apply('sleep');
    const said: string[] = [];
    startTurn(s, () => 0.5, (t: string) => said.push(t));
    expect(said).toEqual(['X is asleep!']);
    expect(s.tracker.has('sleep')).toBe(true);
  });
});

