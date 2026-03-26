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

// New spell definitions for WP2
const pureSpell: SpellData = { id: 'pure', name: 'PURE', level: 4, type: 'white', effect: 'cure_poison', targeting: 'single_ally', description: 'Cure poison', power: 0, element: 'none' };
const amutSpell: SpellData = { id: 'amut', name: 'AMUT', level: 4, type: 'white', effect: 'cure_silence', targeting: 'single_ally', description: 'Cure silence', power: 0, element: 'none' };
const fastSpell: SpellData = { id: 'fast', name: 'FAST', level: 4, type: 'black', effect: 'buff_speed', targeting: 'single_ally', description: 'Raise speed', power: 0, element: 'none' };
const afirSpell: SpellData = { id: 'afir', name: 'AFIR', level: 3, type: 'white', effect: 'resist_fire', targeting: 'all_allies', description: 'Fire resist', power: 0, element: 'fire' };
const aiceSpell: SpellData = { id: 'aice', name: 'AICE', level: 4, type: 'white', effect: 'resist_ice', targeting: 'all_allies', description: 'Ice resist', power: 0, element: 'ice' };
const fearSpell: SpellData = { id: 'fear', name: 'FEAR', level: 4, type: 'white', effect: 'debuff_morale', targeting: 'all', description: 'Lower morale', power: 0, element: 'none' };

function createMage(name: string, spellLevel: number, charges = 9): Character {
  const char = new Character({ name, classData: mageClass });
  char.setSpellCharges(spellLevel, charges);
  return char;
}

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
    () => 0.5,
  );
  battle.startBattle();
  battle.advanceFromIntro();
  const living = party.filter(c => c.currentHp > 0);
  for (let i = 0; i < living.length; i++) {
    const partyIndex = party.indexOf(living[i]);
    const id = `party_${partyIndex}`;
    if (id === actorId) {
      battle.submitCommand({ type: 'magic', actorId, targetId, spellId: spell.id });
    } else {
      battle.submitCommand({ type: 'fight', actorId: id, targetId: 'enemy_0' });
    }
  }
  battle.executeRound();
  return battle;
}

describe('SpellExecutor — WP2 new spell effects', () => {
  describe('cure_poison (PURE)', () => {
    it('removes poison status from target', () => {
      const mage = createMage('Mage', 4);
      mage.statusTracker.apply('poison');
      expect(mage.statusTracker.has('poison')).toBe(true);
      const battle = castSpell([mage], [goblin], pureSpell, 'party_0', 'party_0', [pureSpell]);
      expect(mage.statusTracker.has('poison')).toBe(false);
      expect(battle.currentMessages.some(m => m.text.includes('cured of poison'))).toBe(true);
    });

    it('shows "No effect." when target is not poisoned', () => {
      const mage = createMage('Mage', 4);
      const battle = castSpell([mage], [goblin], pureSpell, 'party_0', 'party_0', [pureSpell]);
      expect(battle.currentMessages.some(m => m.text === 'No effect.')).toBe(true);
    });
  });

  describe('cure_silence (AMUT)', () => {
    it('removes silence status from target', () => {
      const mage = createMage('Mage', 4);
      mage.statusTracker.apply('silence');
      expect(mage.statusTracker.has('silence')).toBe(true);
      const battle = castSpell([mage], [goblin], amutSpell, 'party_0', 'party_0', [amutSpell]);
      expect(mage.statusTracker.has('silence')).toBe(false);
      expect(battle.currentMessages.some(m => m.text.includes('can speak again'))).toBe(true);
    });

    it('shows "No effect." when target is not silenced', () => {
      const mage = createMage('Mage', 4);
      const battle = castSpell([mage], [goblin], amutSpell, 'party_0', 'party_0', [amutSpell]);
      expect(battle.currentMessages.some(m => m.text === 'No effect.')).toBe(true);
    });
  });

  describe('buff_speed (FAST)', () => {
    it('increases target agility by 10', () => {
      const mage = createMage('Mage', 4);
      const battle = castSpell([mage], [goblin], fastSpell, 'party_0', 'party_0', [fastSpell]);
      expect(mage.getBuffAmount('agility')).toBe(10);
      expect(battle.currentMessages.some(m => m.text.includes("Mage's speed increased!"))).toBe(true);
    });
  });

  describe('resist_fire (AFIR)', () => {
    it('grants fire resistance to all living party members', () => {
      const mage = createMage('Mage', 3);
      const warrior = new Character({ name: 'Warrior', classData: { ...mageClass, id: 'warrior', name: 'Warrior' } });
      const battle = castSpell([mage, warrior], [goblin], afirSpell, 'party_0', '', [afirSpell]);
      expect(mage.hasTempResist('fire')).toBe(true);
      expect(warrior.hasTempResist('fire')).toBe(true);
      expect(battle.currentMessages.some(m => m.text.includes('fire resistance'))).toBe(true);
    });
  });

  describe('resist_ice (AICE)', () => {
    it('grants ice resistance to all living party members', () => {
      const mage = createMage('Mage', 4);
      const warrior = new Character({ name: 'Warrior', classData: { ...mageClass, id: 'warrior', name: 'Warrior' } });
      const battle = castSpell([mage, warrior], [goblin], aiceSpell, 'party_0', '', [aiceSpell]);
      expect(mage.hasTempResist('ice')).toBe(true);
      expect(warrior.hasTempResist('ice')).toBe(true);
      expect(battle.currentMessages.some(m => m.text.includes('ice resistance'))).toBe(true);
    });
  });

  describe('debuff_morale (FEAR) — documented no-op', () => {
    it('shows "nothing happens" message', () => {
      const mage = createMage('Mage', 4);
      const battle = castSpell([mage], [goblin], fearSpell, 'party_0', 'enemy_0', [fearSpell]);
      expect(battle.currentMessages.some(m => m.text.includes('nothing happens'))).toBe(true);
    });
  });
});
