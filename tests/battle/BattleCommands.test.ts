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

  it('uses rng to select random target', () => {
    const cmd: BattleCommand = { type: 'fight', actorId: 'hero', targetId: 'deadEnemy' };
    const result = retargetIfDead(cmd, isTargetAlive, getLivingEnemies, () => 0.99);
    expect(result.targetId).toBe('enemy2');
  });
});

describe('calculateRunChance', () => {
  it('returns 50% when agilities are equal', () => {
    expect(calculateRunChance(10, 10)).toBe(50);
  });

  it('increases chance when party is faster', () => {
    expect(calculateRunChance(20, 10)).toBe(55);
  });

  it('decreases chance when enemies are faster', () => {
    expect(calculateRunChance(10, 20)).toBe(45);
  });

  it('clamps to minimum 10%', () => {
    expect(calculateRunChance(10, 200)).toBe(10);
  });

  it('clamps to maximum 90%', () => {
    expect(calculateRunChance(200, 10)).toBe(90);
  });
});
