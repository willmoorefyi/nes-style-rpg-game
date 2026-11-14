import { describe, it, expect } from 'vitest';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { Character } from '../../src/entities/Character.js';
import type { EnemyData, CharacterClassData, SpellData } from '../../src/types/index.js';
import { SpellExecutor } from '../../src/battle/SpellExecutor.js';
import { mulberry32, testClass, testEnemy, testMageClass } from '../helpers/testUtils.js';

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

  describe('debuff_morale (FEAR)', () => {
    it('applies fear status to all living enemies', () => {
      const mage = createMage('Mage', 4);
      const battle = castSpell([mage], [goblin], fearSpell, 'party_0', 'enemy_0', [fearSpell]);
      const enemy = battle.allEnemies[0];
      expect(enemy.status.has('fear')).toBe(true);
      expect(battle.currentMessages.some(m => m.text.includes('is frightened!'))).toBe(true);
    });
  });
});

describe('FEAR rolls statusHits (revision 13)', () => {
  it('a high roll leaves the target unaffected', () => {
    // FEAR accuracy 40 vs magic defence 2: 186/200 → 0.95 (190) misses
    const mage = createMage('Mage', 4);
    const battle = new BattleStateMachine({ party: [mage], enemies: [goblin], spells: [{ ...fearSpell, accuracy: 40 }] }, () => 0.95);
    battle.startBattle();
    battle.advanceFromIntro();
    battle.submitCommand({ type: 'magic', actorId: 'party_0', targetId: 'enemy_0', spellId: 'fear' });
    battle.executeRound();
    expect(battle.allEnemies[0].status.has('fear')).toBe(false);
    expect(battle.currentMessages.map(m => m.text)).toContain('Goblin is unaffected.');
  });
});

describe('SLEP: hit roll and the wake rule (FF1, EB-5)', () => {
  const slep: SpellData = { id: 'slep', name: 'SLEP', level: 1, type: 'black', effect: 'status_sleep', targeting: 'all', description: 'Sleep', power: 0, accuracy: 24 };
  // a sturdy, fast caster so 15 rounds of Garland never end the test early
  const sleeper = testClass('black_mage', { baseStats: { hp: 999, strength: 1, agility: 30, intelligence: 10, vitality: 1, luck: 5 } });
  const garland = testEnemy({ id: 'garland', name: 'Garland', stats: { hp: 240, agility: 1, attack: 15, accuracy: 15, defense: 10, evade: 12, magicDefense: 15 } });
  const imp = testEnemy({ stats: { hp: 8, agility: 1, magicDefense: 16 } });

  function caster(): Character {
    const c = new Character({ name: 'BM', classData: sleeper });
    c.setSpellCharges(1, 99);
    return c;
  }

  function slepRound(battle: BattleStateMachine): string[] {
    battle.submitCommand({ type: 'magic', actorId: 'party_0', spellId: 'slep' });
    battle.executeRound();
    const texts = battle.currentMessages.map(m => m.text);
    battle.resolveRound();
    return texts;
  }

  function start(enemies: EnemyData[], rng: () => number): BattleStateMachine {
    const battle = new BattleStateMachine({ party: [caster()], enemies, spells: [slep] }, rng);
    battle.startBattle();
    battle.advanceFromIntro();
    return battle;
  }

  it('misses ("unaffected") when the roll is ≥ (148 + 24 − MDef) / 200', () => {
    // MDef 16 → 156/200: 0.8 (160) misses, 0.7 (140) lands
    const miss = slepRound(start([imp], () => 0.8));
    expect(miss).toContain('Goblin is unaffected.');
    const battle = start([imp], () => 0.7);
    const hit = slepRound(battle);
    expect(hit).toContain('Goblin is affected by sleep!');
  });

  it('a sleeping Garland (HP 240) loses one turn, wakes, and acts on the next round', () => {
    const battle = start([garland], () => 0.5);
    const first = slepRound(battle);
    expect(first).toContain('Garland is affected by sleep!');
    expect(first).toContain('Garland is asleep!');
    expect(first).toContain('Garland wakes up!');
    expect(battle.allEnemies[0].status.has('sleep')).toBe(false);
    // next round the caster fights instead; Garland now acts
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.executeRound();
    const second = battle.currentMessages.map(m => m.text);
    expect(second.some(t => t.startsWith('Garland hits') || t === 'Garland missed!')).toBe(true);
  });

  it('a goblin at 8 HP stays asleep with roll 0.5 (rand(0..80) = 40 ≥ 8)', () => {
    const battle = start([imp], () => 0.5);
    const texts = slepRound(battle);
    expect(texts).toContain('Goblin is affected by sleep!');
    expect(texts).toContain('Goblin is asleep!');
    expect(texts).not.toContain('Goblin wakes up!');
    expect(battle.allEnemies[0].status.has('sleep')).toBe(true);
  });

  it('damage does not wake a sleeper (FF1)', () => {
    const tough = testEnemy({ stats: { hp: 500, agility: 1, defense: 0, evade: 0, magicDefense: 0 } });
    const battle = start([tough], () => 0.99);
    battle.allEnemies[0].status.apply('sleep');
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.prepareRound();
    battle.executeNextAction(); // the caster hits first (agility 30)
    expect(battle.allEnemies[0].currentHp).toBeLessThan(500);
    expect(battle.allEnemies[0].status.has('sleep')).toBe(true);
  });

  it('over 15 rounds of SLEP every round, Garland acts at least once', () => {
    const acted = (seed: number) => {
      const battle = start([garland], mulberry32(seed));
      let turns = 0;
      for (let r = 0; r < 15 && !battle.isOver; r++) {
        const texts = slepRound(battle);
        if (texts.some(t => t.startsWith('Garland hits') || t === 'Garland missed!')) turns++;
      }
      return turns;
    };
    expect(acted(1)).toBeGreaterThanOrEqual(1);
    // each round SLEP misses ~21 % of the time; nearly every battle sees Garland act
    const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
    const withTurn = seeds.filter(s => acted(s) >= 1).length;
    expect(withTurn / seeds.length).toBeGreaterThanOrEqual(0.95);
  });
});

describe('BA-3: a single-target spell at an enemy that already died retargets', () => {
  const fire: SpellData = { id: 'fire', name: 'FIRE', level: 1, type: 'black', effect: 'damage', targeting: 'single', description: 'Fire', power: 10, accuracy: 24, element: 'fire' };
  const fast = testClass('warrior', { baseStats: { hp: 50, strength: 60, agility: 50, intelligence: 1, vitality: 8, luck: 5 } });
  const goblins = [
    testEnemy({ name: 'Goblin', stats: { hp: 1, agility: 1, evade: 0, defense: 0 } }),
    testEnemy({ name: 'Goblin', stats: { hp: 500, agility: 1, magicDefense: 0 } }),
  ];

  it('Goblin A dies before the Black Mage acts: FIRE aimed at A damages B, and one charge is spent', () => {
    const warrior = new Character({ name: 'WAR', classData: fast });
    const mage = new Character({ name: 'BMAG', classData: testMageClass() });
    const charges = mage.getSpellCharges(1);
    expect(charges).toBeGreaterThan(0);
    const battle = new BattleStateMachine({ party: [warrior, mage], enemies: goblins.map(g => structuredClone(g)), spells: [fire] }, mulberry32(3));
    battle.startBattle();
    battle.advanceFromIntro();
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.submitCommand({ type: 'magic', actorId: 'party_1', targetId: 'enemy_0', spellId: 'fire' });
    battle.prepareRound();
    expect(battle.peekNextAction()?.actorId).toBe('party_0');
    battle.executeNextAction();
    expect(battle.allEnemies[0].currentHp).toBe(0); // the Warrior killed Goblin A
    expect(battle.peekNextAction()?.actorId).toBe('party_1');
    const { messages, damageEvents } = battle.executeNextAction();
    expect(damageEvents.some(e => e.targetId === 'enemy_1' && e.damage > 0)).toBe(true);
    expect(battle.allEnemies[1].currentHp).toBeLessThan(500);
    expect(messages.map(m => m.text)).toContain('Goblin B takes ' + damageEvents[0].damage + ' damage!');
    expect(mage.getSpellCharges(1)).toBe(charges - 1);
  });

  it('with no enemy alive the spell is not cast and no charge is spent', () => {
    const mage = new Character({ name: 'BMAG', classData: testMageClass() });
    const charges = mage.getSpellCharges(1);
    const said: string[] = [];
    const executor = new SpellExecutor({
      party: [mage], enemies: [], rng: () => 0.5, addMessage: (t) => said.push(t),
      livingParty: () => [mage], livingEnemies: () => [], partyById: new Map([['party_0', mage]]), addDamageEvent: () => {},
    }, [fire]);
    executor.execute({ type: 'magic', actorId: 'party_0', targetId: 'enemy_0', spellId: 'fire' }, false);
    expect(said).toEqual([]);
    expect(mage.getSpellCharges(1)).toBe(charges);
  });
});

