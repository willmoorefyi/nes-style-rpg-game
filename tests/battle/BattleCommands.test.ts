import { describe, it, expect } from 'vitest';
import { retargetIfDead, calculateRunChance, type BattleCommand } from '../../src/battle/BattleCommands.js';

describe('retargetIfDead', () => {
  const aliveTargets = new Set(['enemy1', 'enemy2']);
  const isTargetAlive = (id: string) => aliveTargets.has(id);
  const getLivingEnemies = () => ['enemy1', 'enemy2'];

  it('returns command unchanged if target is alive', () => {
    const cmd: BattleCommand = { type: 'fight', actorId: 'hero', targetId: 'enemy1' };
    const result = retargetIfDead(cmd, isTargetAlive, getLivingEnemies);
    expect(result).toEqual(cmd);
  });

  it('retargets to living enemy if target is dead', () => {
    const cmd: BattleCommand = { type: 'fight', actorId: 'hero', targetId: 'deadEnemy' };
    const result = retargetIfDead(cmd, isTargetAlive, getLivingEnemies, () => 0);
    expect(result.targetId).toBe('enemy1');
  });

  it('returns command unchanged for non-fight commands', () => {
    const cmd: BattleCommand = { type: 'run', actorId: 'hero' };
    const result = retargetIfDead(cmd, isTargetAlive, getLivingEnemies);
    expect(result).toEqual(cmd);
  });

  it('returns command unchanged if no living enemies', () => {
    const cmd: BattleCommand = { type: 'fight', actorId: 'hero', targetId: 'deadEnemy' };
    const result = retargetIfDead(cmd, () => false, () => []);
    expect(result).toEqual(cmd);
  });

  it('BA-3: retargets a magic command whose target died, uniformly over the living', () => {
    const cmd: BattleCommand = { type: 'magic', actorId: 'party_3', targetId: 'deadEnemy', spellId: 'fire' };
    expect(retargetIfDead(cmd, isTargetAlive, getLivingEnemies, () => 0)).toEqual({ ...cmd, targetId: 'enemy1' });
    expect(retargetIfDead(cmd, isTargetAlive, getLivingEnemies, () => 0.6).targetId).toBe('enemy2');
  });

  it('BA-3: a magic command at a living target is unchanged and draws no RNG', () => {
    const cmd: BattleCommand = { type: 'magic', actorId: 'party_3', targetId: 'enemy2', spellId: 'fire' };
    let draws = 0;
    expect(retargetIfDead(cmd, isTargetAlive, getLivingEnemies, () => { draws++; return 0; })).toEqual(cmd);
    expect(draws).toBe(0);
  });

  it('uses rng to select random target', () => {
    const cmd: BattleCommand = { type: 'fight', actorId: 'hero', targetId: 'deadEnemy' };
    const result = retargetIfDead(cmd, isTargetAlive, getLivingEnemies, () => 0.99);
    expect(result.targetId).toBe('enemy2');
  });
});

describe('calculateRunChance (FF1 base, B9 cap and pack penalty)', () => {
  it('is min(0.75, luck / (level + 16)) − 0.05 per living enemy past the first', () => {
    expect(calculateRunChance(15, 1, 1)).toBeCloseTo(0.75); // 15/17 capped
    expect(calculateRunChance(18, 2, 3)).toBeCloseTo(0.65); // 18/18 capped, two extra enemies
    expect(calculateRunChance(6, 2, 3)).toBeCloseTo(6 / 18 - 0.1); // 0.233
    expect(calculateRunChance(99, 1, 1)).toBeCloseTo(0.75);
    expect(calculateRunChance(0, 1, 1)).toBe(0);
  });

  it('defaults to one enemy, never goes below 0, and higher levels make running harder', () => {
    expect(calculateRunChance(15, 1)).toBeCloseTo(0.75);
    expect(calculateRunChance(1, 1, 9)).toBe(0);
    expect(calculateRunChance(5, 10)).toBeLessThan(calculateRunChance(5, 1));
  });
});
