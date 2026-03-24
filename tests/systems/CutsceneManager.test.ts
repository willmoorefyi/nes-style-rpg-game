import { describe, it, expect, vi } from 'vitest';
import { CutsceneManager, type CutsceneScript, type CutsceneDeps } from '../../src/systems/CutsceneManager.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { Character } from '../../src/entities/Character.js';
import type { CharacterClassData } from '../../src/types/index.js';

const mockClass: CharacterClassData = {
  id: 'warrior', name: 'Warrior',
  baseStats: { hp: 50, strength: 10, agility: 5, intelligence: 1, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 0, vitality: 1, luck: 1 },
  usableEquipment: [], spellLevels: { white: 0, black: 0 },
};

function makeDeps(overrides: Partial<CutsceneDeps> = {}): CutsceneDeps {
  return {
    showDialog: vi.fn().mockResolvedValue(undefined),
    fadeOut: vi.fn().mockResolvedValue(undefined),
    fadeIn: vi.fn().mockResolvedValue(undefined),
    flags: new GameFlags(),
    party: [new Character({ name: 'Hero', classData: mockClass, currentHp: 10 })],
    ...overrides,
  };
}

describe('CutsceneManager', () => {
  it('should execute dialog steps via showDialog', async () => {
    const deps = makeDeps();
    const mgr = new CutsceneManager(deps);
    const script: CutsceneScript = [
      { type: 'dialog', text: 'Hello!' },
      { type: 'dialog', text: 'Goodbye!' },
    ];
    await mgr.play(script);
    expect(deps.showDialog).toHaveBeenCalledTimes(2);
    expect(deps.showDialog).toHaveBeenCalledWith('Hello!');
    expect(deps.showDialog).toHaveBeenCalledWith('Goodbye!');
  });

  it('should execute fade steps', async () => {
    const deps = makeDeps();
    const mgr = new CutsceneManager(deps);
    const script: CutsceneScript = [
      { type: 'fade_out', duration: 300 },
      { type: 'fade_in', duration: 200 },
    ];
    await mgr.play(script);
    expect(deps.fadeOut).toHaveBeenCalledWith(300);
    expect(deps.fadeIn).toHaveBeenCalledWith(200);
  });

  it('should set flags via set_flag step', async () => {
    const deps = makeDeps();
    const mgr = new CutsceneManager(deps);
    const script: CutsceneScript = [
      { type: 'set_flag', flag: 'BOSS_DEFEATED' },
    ];
    await mgr.play(script);
    expect(deps.flags.has('BOSS_DEFEATED')).toBe(true);
  });

  it('should heal party via heal_party step', async () => {
    const deps = makeDeps();
    const hero = deps.party[0];
    expect(hero.currentHp).toBe(10);
    const mgr = new CutsceneManager(deps);
    await mgr.play([{ type: 'heal_party' }]);
    expect(hero.currentHp).toBe(hero.maxHp);
  });

  it('should execute steps in order', async () => {
    const order: string[] = [];
    const deps = makeDeps({
      showDialog: vi.fn().mockImplementation(async () => { order.push('dialog'); }),
      fadeOut: vi.fn().mockImplementation(async () => { order.push('fadeOut'); }),
      fadeIn: vi.fn().mockImplementation(async () => { order.push('fadeIn'); }),
    });
    const mgr = new CutsceneManager(deps);
    await mgr.play([
      { type: 'dialog', text: 'Start' },
      { type: 'fade_out', duration: 100 },
      { type: 'fade_in', duration: 100 },
    ]);
    expect(order).toEqual(['dialog', 'fadeOut', 'fadeIn']);
  });
});
