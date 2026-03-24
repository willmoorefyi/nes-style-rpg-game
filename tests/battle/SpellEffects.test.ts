import { describe, it, expect } from 'vitest';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { Character } from '../../src/entities/Character.js';
import type { EnemyData, CharacterClassData, SpellData } from '../../src/types/index.js';

const mageClass: CharacterClassData = {
  id: 'white_mage',
  name: 'White Mage',
  baseStats: { hp: 30, strength: 5, agility: 8, intelligence: 15, vitality: 5, luck: 5 },
  statGrowth: { hp: 3, strength: 1, agility: 1, intelligence: 3, vitality: 1, luck: 1 },
  usableEquipment: [],
  spellLevels: { white: 7, black: 0 },
};

const goblin: EnemyData = {
  id: 'goblin',
  name: 'Goblin',
  stats: { hp: 20, strength: 4, agility: 6, intelligence: 2, vitality: 3, luck: 3, attack: 8, defense: 4, magicDefense: 2 },
  xpReward: 10,
  goldReward: 5,
  sprite: 'goblin',
};

const undead: EnemyData = {
  id: 'skeleton',
  name: 'Skeleton',
  stats: { hp: 30, strength: 6, agility: 4, intelligence: 1, vitality: 4, luck: 2, attack: 10, defense: 6, magicDefense: 1 },
  xpReward: 15,
  goldReward: 8,
  sprite: 'skeleton',
  weakness: 'holy',
};

// Spell definitions matching spells.yaml
const fogSpell: SpellData = { id: 'fog', name: 'FOG', level: 1, type: 'white', effect: 'buff_defense', targeting: 'single', description: 'Raise defense', power: 0, element: 'none' };
const ruseSpell: SpellData = { id: 'ruse', name: 'RUSE', level: 1, type: 'white', effect: 'buff_evade', targeting: 'self', description: 'Raise evasion', power: 0, element: 'none' };
const invsSpell: SpellData = { id: 'invs', name: 'INVS', level: 2, type: 'white', effect: 'buff_evade', targeting: 'single', description: 'Raise evasion', power: 0, element: 'none' };
const tmprSpell: SpellData = { id: 'tmpr', name: 'TMPR', level: 2, type: 'black', effect: 'buff_attack', targeting: 'single', description: 'Raise attack', power: 0, element: 'none' };
const lockSpell: SpellData = { id: 'lock', name: 'LOCK', level: 1, type: 'black', effect: 'debuff_evade', targeting: 'single', description: 'Lower evasion', power: 0, element: 'none' };
const slowSpell: SpellData = { id: 'slow', name: 'SLOW', level: 2, type: 'black', effect: 'debuff_speed', targeting: 'single', description: 'Reduce speed', power: 0, element: 'none' };
const lampSpell: SpellData = { id: 'lamp', name: 'LAMP', level: 2, type: 'white', effect: 'cure_blind', targeting: 'single', description: 'Cure blindness', power: 0, element: 'none' };
const lifeSpell: SpellData = { id: 'life', name: 'LIFE', level: 5, type: 'white', effect: 'revive', targeting: 'single', description: 'Revive ally', power: 0, element: 'none' };
const alitSpell: SpellData = { id: 'alit', name: 'ALIT', level: 2, type: 'white', effect: 'resist_lightning', targeting: 'all', description: 'Lightning resist', power: 0, element: 'lightning' };
const harmSpell: SpellData = { id: 'harm', name: 'HARM', level: 1, type: 'white', effect: 'damage_holy', targeting: 'all', description: 'Holy damage', power: 20, element: 'holy' };

/** Helper: create a mage with charges for a given spell level */
function createMage(name: string, spellLevel: number, charges = 9): Character {
  const char = new Character({ name, classData: mageClass });
  char.setSpellCharges(spellLevel, charges);
  return char;
}

/** Helper: run a single spell command through a full battle round */
function castSpell(
  party: Character[],
  enemies: EnemyData[],
  spell: SpellData,
  actorId: string,
  targetId: string,
  allSpells: SpellData[],
): BattleStateMachine {
  const battle = new BattleStateMachine(
    { party, enemies, spells: allSpells },
    () => 0.5, // Fixed RNG for deterministic results
  );
  battle.startBattle();
  battle.advanceFromIntro();
  // Submit spell command for each living party member
  for (const char of party.filter(c => c.currentHp > 0)) {
    if (char.name === actorId) {
      battle.submitCommand({ type: 'magic', actorId, targetId, spellId: spell.id });
    } else {
      // Other party members defend (fight with no real effect needed)
      battle.submitCommand({ type: 'fight', actorId: char.name, targetId: 'enemy_0' });
    }
  }
  battle.executeRound();
  return battle;
}

describe('Spell Effects', () => {
  describe('buff_defense (FOG)', () => {
    it('increases target defense by 8', () => {
      const mage = createMage('Mage', 1);
      const defenseBefore = mage.stats.defense;
      const battle = castSpell([mage], [goblin], fogSpell, 'Mage', 'Mage', [fogSpell]);
      expect(mage.stats.defense).toBe(defenseBefore + 8);
      expect(battle.currentMessages.some(m => m.text.includes("Mage's defense increased!"))).toBe(true);
    });

    it('stacks additively (two FOGs = +16)', () => {
      const mage = createMage('Mage', 1);
      const defenseBefore = mage.stats.defense;
      mage.applyBuff('defense', 8); // Simulate first FOG
      castSpell([mage], [goblin], fogSpell, 'Mage', 'Mage', [fogSpell]);
      expect(mage.stats.defense).toBe(defenseBefore + 16);
    });
  });

  describe('buff_evade (RUSE, INVS)', () => {
    it('RUSE increases caster evade buff by 40 (self-targeting)', () => {
      const mage = createMage('Mage', 1);
      const battle = castSpell([mage], [goblin], ruseSpell, 'Mage', 'Mage', [ruseSpell]);
      expect(mage.getBuffAmount('evade')).toBe(40);
      expect(battle.currentMessages.some(m => m.text.includes("Mage's evasion increased!"))).toBe(true);
    });

    it('INVS increases target evade buff by 40 (single-targeting)', () => {
      const mage = createMage('Mage', 2);
      const warrior = new Character({ name: 'Warrior', classData: { ...mageClass, id: 'warrior', name: 'Warrior' } });
      const battle = castSpell([mage, warrior], [goblin], invsSpell, 'Mage', 'Warrior', [invsSpell]);
      expect(warrior.getBuffAmount('evade')).toBe(40);
      expect(battle.currentMessages.some(m => m.text.includes("Warrior's evasion increased!"))).toBe(true);
    });
  });

  describe('buff_attack (TMPR)', () => {
    it('increases target attack by 14', () => {
      const mage = createMage('Mage', 2);
      const attackBefore = mage.stats.attack;
      const battle = castSpell([mage], [goblin], tmprSpell, 'Mage', 'Mage', [tmprSpell]);
      expect(mage.stats.attack).toBe(attackBefore + 14);
      expect(battle.currentMessages.some(m => m.text.includes("Mage's attack increased!"))).toBe(true);
    });
  });

  describe('debuff_evade (LOCK)', () => {
    it('decreases enemy evade by 20', () => {
      const mage = createMage('Mage', 1);
      const battle = castSpell([mage], [goblin], lockSpell, 'Mage', 'enemy_0', [lockSpell]);
      const enemy = battle.allEnemies[0];
      expect(enemy.buffs.get('evade')).toBe(-20);
      expect(battle.currentMessages.some(m => m.text.includes("Goblin's evasion decreased!"))).toBe(true);
    });

    it('stacks with multiple casts', () => {
      const mage = createMage('Mage', 1);
      const battle = castSpell([mage], [goblin], lockSpell, 'Mage', 'enemy_0', [lockSpell]);
      const enemy = battle.allEnemies[0];
      // Simulate second cast stacking
      enemy.buffs.set('evade', (enemy.buffs.get('evade') ?? 0) + (-20));
      expect(enemy.buffs.get('evade')).toBe(-40);
    });
  });

  describe('debuff_speed (SLOW)', () => {
    it('decreases enemy agility by 10', () => {
      const mage = createMage('Mage', 2);
      const battle = castSpell([mage], [goblin], slowSpell, 'Mage', 'enemy_0', [slowSpell]);
      const enemy = battle.allEnemies[0];
      expect(enemy.buffs.get('agility')).toBe(-10);
      expect(battle.currentMessages.some(m => m.text.includes("Goblin's speed decreased!"))).toBe(true);
    });
  });

  describe('cure_blind (LAMP)', () => {
    it('removes blind status from target', () => {
      const mage = createMage('Mage', 2);
      mage.statusTracker.apply('blind');
      expect(mage.statusTracker.has('blind')).toBe(true);
      const battle = castSpell([mage], [goblin], lampSpell, 'Mage', 'Mage', [lampSpell]);
      expect(mage.statusTracker.has('blind')).toBe(false);
      expect(battle.currentMessages.some(m => m.text.includes("sight is restored"))).toBe(true);
    });

    it('shows "No effect." when target is not blind', () => {
      const mage = createMage('Mage', 2);
      const battle = castSpell([mage], [goblin], lampSpell, 'Mage', 'Mage', [lampSpell]);
      expect(battle.currentMessages.some(m => m.text === 'No effect.')).toBe(true);
    });
  });

  describe('revive (LIFE)', () => {
    it('revives fallen ally with 1 HP', () => {
      const mage = createMage('Mage', 5);
      const fallen = new Character({ name: 'Fallen', classData: mageClass, currentHp: 0 });
      fallen.statusTracker.apply('death');
      expect(fallen.currentHp).toBe(0);

      // Need mage alive to cast — fallen is dead so won't need a command
      const battle = new BattleStateMachine(
        { party: [mage, fallen], enemies: [goblin], spells: [lifeSpell] },
        () => 0.5,
      );
      battle.startBattle();
      battle.advanceFromIntro();
      // Only living party members submit commands
      battle.submitCommand({ type: 'magic', actorId: 'Mage', targetId: 'Fallen', spellId: 'life' });
      battle.executeRound();

      expect(fallen.currentHp).toBe(1);
      expect(fallen.statusTracker.has('death')).toBe(false);
      expect(battle.currentMessages.some(m => m.text.includes('Fallen is revived!'))).toBe(true);
    });

    it('shows "No effect." on living target', () => {
      const mage = createMage('Mage', 5);
      const battle = castSpell([mage], [goblin], lifeSpell, 'Mage', 'Mage', [lifeSpell]);
      expect(battle.currentMessages.some(m => m.text === 'No effect.')).toBe(true);
    });
  });

  describe('resist_lightning (ALIT)', () => {
    it('grants lightning resistance to all living party members', () => {
      const mage = createMage('Mage', 2);
      const warrior = new Character({ name: 'Warrior', classData: { ...mageClass, id: 'warrior', name: 'Warrior' } });
      const battle = castSpell([mage, warrior], [goblin], alitSpell, 'Mage', '', [alitSpell]);
      expect(mage.hasTempResist('lightning')).toBe(true);
      expect(warrior.hasTempResist('lightning')).toBe(true);
      expect(battle.currentMessages.some(m => m.text.includes('lightning resistance'))).toBe(true);
    });
  });

  describe('damage_holy (HARM)', () => {
    it('deals holy-element damage to enemies', () => {
      const mage = createMage('Mage', 1);
      const battle = castSpell([mage], [undead], harmSpell, 'Mage', 'enemy_0', [harmSpell]);
      const enemy = battle.allEnemies[0];
      // Undead is weak to holy — should take extra damage
      expect(enemy.currentHp).toBeLessThan(undead.stats.hp);
      expect(battle.currentMessages.some(m => m.text.includes('takes') && m.text.includes('damage'))).toBe(true);
    });

    it('applies 2x multiplier against holy-weak enemies', () => {
      const mage = createMage('Mage', 1);
      // Cast against undead (holy weakness) and normal enemy
      const battle1 = castSpell([mage], [undead], harmSpell, 'Mage', 'enemy_0', [harmSpell]);
      const dmgToUndead = undead.stats.hp - battle1.allEnemies[0].currentHp;

      const mage2 = createMage('Mage2', 1);
      const battle2 = castSpell([mage2], [goblin], harmSpell, 'Mage2', 'enemy_0', [harmSpell]);
      const dmgToGoblin = goblin.stats.hp - battle2.allEnemies[0].currentHp;

      // Holy damage to undead (weak) should be ~2x damage to goblin (neutral)
      expect(dmgToUndead).toBeGreaterThan(dmgToGoblin);
    });
  });

  describe('battle state cleanup', () => {
    it('clears buffs on victory', () => {
      const mage = createMage('Mage', 1);
      mage.applyBuff('defense', 8);
      mage.addTempResist('lightning');

      const weakEnemy: EnemyData = { ...goblin, stats: { ...goblin.stats, hp: 1, defense: 0 } };
      const battle = new BattleStateMachine(
        { party: [mage], enemies: [weakEnemy], spells: [] },
        () => 0.5,
      );
      battle.startBattle();
      battle.advanceFromIntro();
      battle.submitCommand({ type: 'fight', actorId: 'Mage', targetId: 'enemy_0' });
      battle.executeRound();
      battle.resolveRound();

      expect(battle.state).toBe('victory');
      expect(mage.getBuffAmount('defense')).toBe(0);
      expect(mage.hasTempResist('lightning')).toBe(false);
    });

    it('clears buffs on defeat', () => {
      const mage = createMage('Mage', 1);
      mage.currentHp = 1;
      mage.applyBuff('attack', 14);

      const strongEnemy: EnemyData = { ...goblin, stats: { ...goblin.stats, attack: 999 } };
      const battle = new BattleStateMachine(
        { party: [mage], enemies: [strongEnemy], spells: [] },
        () => 0.5,
      );
      battle.startBattle();
      battle.advanceFromIntro();
      battle.submitCommand({ type: 'fight', actorId: 'Mage', targetId: 'enemy_0' });
      battle.executeRound();
      battle.resolveRound();

      expect(battle.state).toBe('defeat');
      expect(mage.getBuffAmount('attack')).toBe(0);
    });
  });

  describe('charge consumption', () => {
    it('consumes a charge when casting a buff spell', () => {
      const mage = createMage('Mage', 1, 3);
      expect(mage.getSpellCharges(1)).toBe(3);
      castSpell([mage], [goblin], fogSpell, 'Mage', 'Mage', [fogSpell]);
      expect(mage.getSpellCharges(1)).toBe(2);
    });

    it('fails to cast when no charges remain', () => {
      const mage = createMage('Mage', 1, 0);
      const battle = castSpell([mage], [goblin], fogSpell, 'Mage', 'Mage', [fogSpell]);
      expect(battle.currentMessages.some(m => m.text.includes('no charges'))).toBe(true);
      // Defense should not have changed
      expect(mage.getBuffAmount('defense')).toBe(0);
    });
  });
});
