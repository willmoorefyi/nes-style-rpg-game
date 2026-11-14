import { describe, it, expect, beforeEach } from 'vitest';
import { InnScene, INN_FADE_FRAMES, INN_HOLD_FRAMES, INN_NOTICE_FRAMES } from '../../src/scenes/InnScene.js';
import type { Game } from '../../src/core/Game.js';
import type { InputAction } from '../../src/core/InputManager.js';
import type { ShopData } from '../../src/types/index.js';
import { createMockGame } from '../helpers/testUtils.js';
import { tapInput, visibleLabels } from '../helpers/realData.js';
import { Character } from '../../src/entities/Character.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import type { CharacterClassData } from '../../src/types/index.js';

const mockClass: CharacterClassData = {
  id: 'fighter',
  name: 'Fighter',
  baseStats: { hp: 30, strength: 10, agility: 5, intelligence: 3, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 1, vitality: 2, luck: 1 },
  usableEquipment: ['sword'],
  spellLevels: { white: 0, black: 0 },
};

describe('InnScene business logic', () => {
  let party: PartyManager;
  const innPrice = 100;

  beforeEach(() => {
    party = new PartyManager();
    party.addGold(500);
  });

  describe('rest flow', () => {
    it('restores all party HP to max', () => {
      const char1 = new Character({ name: 'Hero', classData: mockClass });
      const char2 = new Character({ name: 'Ally', classData: mockClass });
      party.add(char1);
      party.add(char2);
      
      // Damage both characters
      char1.currentHp = 10;
      char2.currentHp = 5;
      
      // Rest at inn
      expect(party.spendGold(innPrice)).toBe(true);
      for (const member of party.all) {
        member.currentHp = member.maxHp;
      }
      
      expect(char1.currentHp).toBe(char1.maxHp);
      expect(char2.currentHp).toBe(char2.maxHp);
    });

    it('restores all spell charges', () => {
      const char = new Character({ name: 'Mage', classData: mockClass });
      party.add(char);
      
      // Use some spell charges
      char.setSpellCharges(1, 2);
      char.useCharge(1);
      expect(char.getSpellCharges(1)).toBe(1);
      
      // Rest at inn
      party.spendGold(innPrice);
      char.restoreAllCharges();
      
      expect(char.getSpellCharges(1)).toBe(char.getMaxCharges(1));
    });

    it('deducts gold for inn stay', () => {
      const char = new Character({ name: 'Hero', classData: mockClass });
      party.add(char);
      
      expect(party.spendGold(innPrice)).toBe(true);
      expect(party.gold).toBe(400);
    });

    it('prevents rest with insufficient gold', () => {
      const char = new Character({ name: 'Hero', classData: mockClass });
      party.add(char);
      char.currentHp = 10;
      
      party.spendGold(450); // Leave only 50 gold
      expect(party.spendGold(innPrice)).toBe(false);
      expect(party.gold).toBe(50);
      expect(char.currentHp).toBe(10); // HP unchanged
    });
  });
});

describe('IN-6: the inn scene', () => {
  const shop = { id: 'inn', type: 'inn', name: 'Inn', inventory: [], innPrice: 30 } as unknown as ShopData;

  function innWith(gold: number, members: Character[]) {
    const base = createMockGame();
    const input = tapInput();
    const party = new PartyManager();
    for (const m of members) party.add(m);
    party.addGold(gold);
    const game = { ...base, input, party };
    const inn = new InnScene(game as unknown as Game, shop);
    inn.enter();
    const tap = (a: InputAction): void => input.tap(a, () => inn.update(1));
    return { inn, tap, party, game };
  }
  const frames = (inn: InnScene, n: number): void => { for (let i = 0; i < n; i++) inn.update(1); };

  it('is a transparent overlay that shows the party gold', () => {
    const { inn } = innWith(120, [new Character({ name: 'Hero', classData: mockClass })]);
    expect(inn.transparent).toBe(true);
    expect(inn.goldLabel).toBe('Gold: 120 G');
    expect(visibleLabels(inn.container)).toContain('Gold: 120 G');
  });

  it('with too little gold it says so, stays open, and keeps the gold', () => {
    const { inn, tap, party, game } = innWith(10, [new Character({ name: 'Hero', classData: mockClass })]);
    tap('confirm'); // Yes
    expect(inn.message).toBe("You don't have enough gold.");
    expect(game.scenes.pop).not.toHaveBeenCalled();
    expect(party.gold).toBe(10);
    frames(inn, INN_NOTICE_FRAMES + 1);
    expect(game.scenes.pop).toHaveBeenCalledTimes(1);
  });

  it('resting cures status (poison) and revives a member with death, then fades and closes', () => {
    const poisoned = new Character({ name: 'Hero', classData: mockClass });
    poisoned.currentHp = 3;
    poisoned.statusTracker.apply('poison');
    const fallen = new Character({ name: 'Ally', classData: mockClass });
    fallen.currentHp = 0;
    fallen.statusTracker.apply('death');
    const { inn, tap, party, game } = innWith(100, [poisoned, fallen]);
    tap('confirm'); // Yes
    expect(party.gold).toBe(70);
    expect(poisoned.statusTracker.has('poison')).toBe(false);
    expect(poisoned.currentHp).toBe(poisoned.maxHp);
    expect(fallen.statusTracker.has('death')).toBe(false);
    expect(fallen.currentHp).toBe(fallen.maxHp);
    expect(inn.phase).toBe('fade_in');
    frames(inn, INN_FADE_FRAMES);
    expect(inn.phase).toBe('hold');
    expect(visibleLabels(inn.container)).toContain('Your party rests...');
    frames(inn, INN_HOLD_FRAMES);
    expect(inn.phase).toBe('fade_out');
    expect(game.scenes.pop).not.toHaveBeenCalled();
    frames(inn, INN_FADE_FRAMES + 5);
    expect(game.scenes.pop).toHaveBeenCalledTimes(1);
  });
});
