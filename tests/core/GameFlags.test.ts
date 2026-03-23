import { describe, it, expect, beforeEach } from 'vitest';
import { GameFlags } from '../../src/core/GameFlags.js';

describe('GameFlags', () => {
  let flags: GameFlags;

  beforeEach(() => {
    flags = new GameFlags();
  });

  it('sets and gets boolean flags', () => {
    flags.set('bossDefeated', true);
    expect(flags.get<boolean>('bossDefeated')).toBe(true);
  });

  it('sets and gets number flags', () => {
    flags.set('chestsOpened', 5);
    expect(flags.get<number>('chestsOpened')).toBe(5);
  });

  it('sets and gets string flags', () => {
    flags.set('currentQuest', 'rescue_princess');
    expect(flags.get<string>('currentQuest')).toBe('rescue_princess');
  });

  it('defaults to true when no value provided', () => {
    flags.set('visited_town');
    expect(flags.get<boolean>('visited_town')).toBe(true);
  });

  it('returns undefined for missing flags', () => {
    expect(flags.get('nonexistent')).toBeUndefined();
  });

  it('has() returns true for existing flags', () => {
    flags.set('exists', true);
    expect(flags.has('exists')).toBe(true);
    expect(flags.has('missing')).toBe(false);
  });

  it('getAll() returns all flags as object', () => {
    flags.set('a', true);
    flags.set('b', 42);
    flags.set('c', 'test');
    expect(flags.getAll()).toEqual({ a: true, b: 42, c: 'test' });
  });

  it('round-trips through toJSON/fromJSON', () => {
    flags.set('bool', true);
    flags.set('num', 123);
    flags.set('str', 'hello');
    
    const json = flags.toJSON();
    const restored = GameFlags.fromJSON(json);
    
    expect(restored.get<boolean>('bool')).toBe(true);
    expect(restored.get<number>('num')).toBe(123);
    expect(restored.get<string>('str')).toBe('hello');
  });
});
