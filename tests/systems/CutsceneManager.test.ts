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

describe('T2 / N2: warp, heal signal, backdrop and unknown steps', () => {
  it('a warp step calls deps.warp in order, between the fades', async () => {
    const order: string[] = [];
    const deps = makeDeps({
      fadeOut: vi.fn().mockImplementation(async () => { order.push('fadeOut'); }),
      fadeIn: vi.fn().mockImplementation(async () => { order.push('fadeIn'); }),
      warp: vi.fn().mockImplementation(async (w) => { order.push(`warp ${w.map} ${w.entrance}`); }),
    });
    await new CutsceneManager(deps).play([
      { type: 'fade_out', duration: 10 },
      { type: 'warp', map: 'cornelia-castle-2f', entrance: 'throne_return', facing: 'up' },
      { type: 'fade_in', duration: 10 },
    ]);
    expect(order).toEqual(['fadeOut', 'warp cornelia-castle-2f throne_return', 'fadeIn']);
    expect(deps.warp).toHaveBeenCalledWith({ map: 'cornelia-castle-2f', entrance: 'throne_return', facing: 'up' });
  });

  it('a warp on a host without warp logs an error and the cutscene goes on', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = makeDeps();
    await new CutsceneManager(deps).play([{ type: 'warp', map: 'x', x: 1, y: 2 }, { type: 'dialog', text: 'after' }]);
    expect(err).toHaveBeenCalled();
    expect(deps.showDialog).toHaveBeenCalledWith('after');
    err.mockRestore();
  });

  it('a malformed warp is logged and skipped', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = makeDeps({ warp: vi.fn().mockResolvedValue(undefined) });
    await new CutsceneManager(deps).play([{ type: 'warp', map: 'x' }]);
    expect(deps.warp).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('heal_party calls onHeal after healing', async () => {
    const onHeal = vi.fn();
    const deps = makeDeps({ onHeal });
    await new CutsceneManager(deps).play([{ type: 'heal_party' }]);
    expect(onHeal).toHaveBeenCalledTimes(1);
    expect(deps.party[0].currentHp).toBe(deps.party[0].maxHp);
  });

  it('a backdrop step goes to deps.backdrop; a host without it logs once and skips', async () => {
    const backdrop = vi.fn();
    await new CutsceneManager(makeDeps({ backdrop })).play([{ type: 'backdrop', image: 'dark_forest' }, { type: 'backdrop', image: null }]);
    expect(backdrop.mock.calls).toEqual([['dark_forest'], [null]]);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = makeDeps();
    await new CutsceneManager(deps).play([{ type: 'backdrop', image: 'a' }, { type: 'backdrop', image: 'b' }, { type: 'dialog', text: 'on' }]);
    expect(err).toHaveBeenCalledTimes(1);
    expect(deps.showDialog).toHaveBeenCalledWith('on');
    err.mockRestore();
  });

  it('an unknown step type is reported, not skipped silently', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const script = [{ type: 'dialgo', text: 'typo' }] as unknown as CutsceneScript;
    await new CutsceneManager(makeDeps()).play(script);
    expect(err).toHaveBeenCalledWith(expect.stringContaining('Unknown cutscene step'));
    err.mockRestore();
  });
});
