import { describe, it, expect } from 'vitest';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { BossAI, type BossPattern } from '../../src/battle/BossAI.js';
import { Character } from '../../src/entities/Character.js';
import type { CharacterClassData, EnemyData } from '../../src/types/index.js';

const mockClass: CharacterClassData = {
  id: 'warrior', name: 'Warrior',
  baseStats: { hp: 100, strength: 20, agility: 10, intelligence: 1, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 0, vitality: 1, luck: 1 },
  usableEquipment: [], spellLevels: { white: 0, black: 0 },
};

const bossEnemy: EnemyData = {
  id: 'lich', name: 'Lich',
  stats: { hp: 10, strength: 1, agility: 1, intelligence: 1, vitality: 1, luck: 1, attack: 1, defense: 0, magicDefense: 0 },
  xpReward: 500, goldReward: 200, sprite: 'lich',
  bossPhases: [
    { hpThreshold: 0.5, patternId: 'phase2', message: "Lich's form shifts!" },
  ],
};

describe('Boss Battle Integration', () => {
  it('should prevent running in boss battles', () => {
    const hero = new Character({ name: 'Hero', classData: mockClass });
    const battle = new BattleStateMachine(
      { party: [hero], enemies: [bossEnemy], canRun: false },
      () => 0.5
    );
    battle.startBattle();
    battle.advanceFromIntro();
    battle.submitCommand({ type: 'run', actorId: 'party_0' });
    battle.executeRound();
    const msgs = battle.currentMessages.map(m => m.text);
    expect(msgs).toContain('Cannot escape!');
    // Battle should continue (not end in defeat from escape)
    expect(battle.state).toBe('resolution');
  });

  it('should use BossAI for enemy actions', () => {
    const hero = new Character({ name: 'Hero', classData: mockClass });
    const pattern: BossPattern = { actions: [{ type: 'fight', weight: 1 }] };
    const battle = new BattleStateMachine(
      { party: [hero], enemies: [bossEnemy], canRun: false },
      () => 0.5
    );
    battle.setEnemyAI(0, new BossAI(pattern));
    battle.startBattle();
    battle.advanceFromIntro();
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.executeRound();
    // Boss should have attacked (messages should include boss attack)
    const msgs = battle.currentMessages.map(m => m.text);
    const bossAttacked = msgs.some(m => m.includes('Lich'));
    expect(bossAttacked).toBe(true);
  });

  it('should trigger boss phase transition when HP drops below threshold', () => {
    // Boss with 10 HP, phase at 50% (5 HP)
    const hero = new Character({ name: 'Hero', classData: mockClass });
    const phase1: BossPattern = { actions: [{ type: 'fight', weight: 1 }] };
    const phase2: BossPattern = { actions: [{ type: 'magic', spellId: 'nuke', weight: 1 }] };

    const battle = new BattleStateMachine(
      {
        party: [hero],
        enemies: [bossEnemy],
        canRun: false,
        bossPatterns: new Map([['phase2', phase2]]),
      },
      () => 0.5
    );
    battle.setEnemyAI(0, new BossAI(phase1));

    battle.startBattle();
    battle.advanceFromIntro();

    // Manually reduce boss HP to trigger phase transition
    battle.livingEnemies[0].currentHp = 4; // below 50% of 10

    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.executeRound();

    const msgs = battle.currentMessages.map(m => m.text);
    expect(msgs).toContain("Lich's form shifts!");
  });

  it('should not revert phase transition if boss is healed', () => {
    const hero = new Character({ name: 'Hero', classData: mockClass });
    const phase1: BossPattern = { actions: [{ type: 'fight', weight: 1 }] };
    const phase2: BossPattern = { actions: [{ type: 'fight', weight: 1 }] };

    // Boss with enough HP to survive a round
    const toughBoss: EnemyData = {
      ...bossEnemy,
      stats: { ...bossEnemy.stats, hp: 200, defense: 50 },
      bossPhases: [{ hpThreshold: 0.5, patternId: 'phase2', message: "Lich's form shifts!" }],
    };

    const battle = new BattleStateMachine(
      {
        party: [hero],
        enemies: [toughBoss],
        canRun: false,
        bossPatterns: new Map([['phase2', phase2]]),
      },
      () => 0.5
    );
    battle.setEnemyAI(0, new BossAI(phase1));
    battle.startBattle();
    battle.advanceFromIntro();

    // Drop HP to trigger phase
    battle.livingEnemies[0].currentHp = 80; // below 50% of 200
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.executeRound();
    const msgs1 = battle.currentMessages.map(m => m.text);
    expect(msgs1).toContain("Lich's form shifts!");

    // Heal boss back above threshold
    battle.resolveRound();
    battle.livingEnemies[0].currentHp = 200;
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.executeRound();

    // Phase message should NOT appear again (one-way transition)
    const msgs2 = battle.currentMessages.map(m => m.text);
    expect(msgs2).not.toContain("Lich's form shifts!");
  });

  it('should reach victory when boss is defeated', () => {
    const hero = new Character({ name: 'Hero', classData: mockClass });
    // Boss with 1 HP, 0 defense — will die in one hit
    const weakBoss: EnemyData = { ...bossEnemy, stats: { ...bossEnemy.stats, hp: 1, defense: 0 } };
    const battle = new BattleStateMachine(
      { party: [hero], enemies: [weakBoss], canRun: false },
      () => 0.5
    );
    battle.startBattle();
    battle.advanceFromIntro();
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.executeRound();
    battle.resolveRound();
    expect(battle.state).toBe('victory');
    expect(battle.battleResult?.victory).toBe(true);
    expect(battle.battleResult?.xpReward).toBe(500);
    expect(battle.battleResult?.goldReward).toBe(200);
  });
});
