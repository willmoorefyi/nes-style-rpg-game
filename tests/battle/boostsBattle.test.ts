/**
 * Pass CHT: the boosts in battle. Gold and XP multiply the victory's rewards (the line and the result agree), the
 * Escape boost makes Run certain unless the battle forbids it (bosses, `canRun` false), and the Battle speed boost
 * scales every timer of the battle scene.
 */
import { describe, it, expect } from 'vitest';
import { BattleStateMachine, type BattleConfig } from '../../src/battle/BattleStateMachine.js';
import { BattleScene } from '../../src/scenes/BattleScene.js';
import { Character } from '../../src/entities/Character.js';
import { createMockBattleSceneDeps } from '../helpers/testUtils.js';
import type { EnemyData, CharacterClassData } from '../../src/types/index.js';

const fighter: CharacterClassData = {
  id: 'warrior', name: 'Warrior',
  baseStats: { hp: 50, strength: 10, agility: 5, intelligence: 1, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 0, vitality: 1, luck: 1 },
  usableEquipment: [], spellLevels: { white: 0, black: 0 },
};

const goblin: EnemyData = {
  id: 'goblin', name: 'Goblin',
  stats: { hp: 20, strength: 4, agility: 1, intelligence: 2, vitality: 3, luck: 3, attack: 8, defense: 4, magicDefense: 2 },
  xpReward: 13, goldReward: 7, sprite: 'goblin',
};

const party = (): Character[] => [new Character({ name: 'A', classData: fighter }), new Character({ name: 'B', classData: fighter })];

/** A battle won at once: the goblins fall before the round runs. */
function win(boosts?: BattleConfig['boosts'], enemies = [goblin, goblin]) {
  const battle = new BattleStateMachine({ party: party(), enemies, boosts }, () => 0.5);
  battle.startBattle();
  battle.advanceFromIntro();
  battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
  battle.submitCommand({ type: 'fight', actorId: 'party_1', targetId: 'enemy_1' });
  battle.prepareRound();
  for (const e of battle.allEnemies) e.currentHp = 0;
  battle.executeRound();
  battle.resolveRound();
  expect(battle.outcome).toBe('victory');
  return battle;
}

/** One round in which party_0 runs; the rng 0.99 fails every normal escape. */
function run(boosts: BattleConfig['boosts'], canRun = true) {
  const battle = new BattleStateMachine({ party: party(), enemies: [goblin], canRun, boosts }, () => 0.99);
  battle.startBattle();
  battle.advanceFromIntro();
  battle.submitCommand({ type: 'run', actorId: 'party_0' });
  battle.submitCommand({ type: 'fight', actorId: 'party_1', targetId: 'enemy_0' });
  battle.prepareRound();
  battle.executeRound();
  return battle;
}

describe('gold and XP boosts at the victory', () => {
  it('no boosts: the base rewards (26 XP, 14 G)', () => {
    expect(win().battleResult).toEqual({ victory: true, xpReward: 26, xpPerMember: 13, goldReward: 14 });
  });

  it('x4 / x4: four times the gold and the XP, and the victory line says so', () => {
    const battle = win({ gold: 4, xp: 4, alwaysEscape: false });
    expect(battle.battleResult).toEqual({ victory: true, xpReward: 104, xpPerMember: 52, goldReward: 56 });
    expect(battle.currentMessages.map((m) => m.text)).toEqual(['Victory! 52 XP each, 56 Gold.']);
  });

  it('x0 / x0: nothing', () => {
    const battle = win({ gold: 0, xp: 0, alwaysEscape: false });
    expect(battle.battleResult).toEqual({ victory: true, xpReward: 0, xpPerMember: 0, goldReward: 0 });
    expect(battle.currentMessages.map((m) => m.text)).toEqual(['Victory! 0 XP each, 0 Gold.']);
  });

  it('x0.5 rounds an odd total down (one goblin: 7 G -> 3 G, 13 XP -> 6, 3 each)', () => {
    const battle = win({ gold: 0.5, xp: 0.5, alwaysEscape: false }, [goblin]);
    expect(battle.battleResult).toEqual({ victory: true, xpReward: 6, xpPerMember: 3, goldReward: 3 });
  });
});

describe('the Escape boost', () => {
  it('off: an unlucky Run fails as before', () => {
    const battle = run({ gold: 1, xp: 1, alwaysEscape: false });
    expect(battle.outcome).toBeNull();
    expect(battle.currentMessages.map((m) => m.text)).toContain('Cannot escape!');
  });

  it('on: Run always succeeds in a normal battle, whatever the roll', () => {
    const battle = run({ gold: 1, xp: 1, alwaysEscape: true });
    expect(battle.outcome).toBe('escaped');
    expect(battle.currentMessages.map((m) => m.text)).toContain('Escaped!');
  });

  it('on: a battle that cannot be fled (a boss, the Chaos form chain: canRun false) still cannot be fled', () => {
    const battle = run({ gold: 1, xp: 1, alwaysEscape: true }, false);
    expect(battle.outcome).toBeNull();
    expect(battle.currentMessages.map((m) => m.text)).toContain('Cannot escape!');
  });
});

describe('the Battle speed boost scales the scene timing', () => {
  /** Frames until the opening lines ("X appeared!") hand over to the command menu. */
  function introFrames(speed?: number): number {
    const scene = new BattleScene(createMockBattleSceneDeps(), {
      party: party(), enemies: [goblin], ...(speed ? { boosts: { gold: 1, xp: 1, alwaysEscape: false, speed } } : {}),
    });
    scene.enter();
    let frames = 0;
    while (scene.uiPhase !== 'command' && frames < 2000) { scene.update(1); frames++; }
    scene.exit();
    return frames;
  }

  it('x2 and x4 cut the opening hold to a half and a quarter (to the frame)', () => {
    const base = introFrames();
    expect(introFrames(1)).toBe(base);
    expect(Math.abs(introFrames(2) - base / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(introFrames(4) - base / 4)).toBeLessThanOrEqual(1);
    expect(base).toBeGreaterThan(40);
  });
});
