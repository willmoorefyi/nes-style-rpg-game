import { describe, it, expect, vi, beforeAll } from 'vitest';
import { HelpWindow, HELP_RECT } from '../../src/ui/HelpWindow.js';
import { FieldMenuScene, formatPlayTime, LEFT_PANE, PARTY_PANE } from '../../src/scenes/FieldMenuScene.js';
import type { Game } from '../../src/core/Game.js';
import { Character } from '../../src/entities/Character.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { xpToReach } from '../../src/entities/ExperienceTable.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

function createMockGameForMenu(canSave = true, party = new PartyManager()) {
  const explorationScene = { canSave: vi.fn().mockReturnValue(canSave), getMapName: vi.fn().mockReturnValue('Cornelia') };
  return {
    party,
    playTime: 0,
    scenes: {
      get: vi.fn().mockReturnValue(explorationScene),
      push: vi.fn(),
      pop: vi.fn(),
    },
    input: tapInput(),
  };
}

function fullParty(): PartyManager {
  const party = new PartyManager();
  const war = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! });
  const war2 = new Character({ name: 'FGHTR2', classData: ClassRegistry.getClass('warrior')!, level: 2, xp: xpToReach(2) });
  const wm = new Character({ name: 'WHITE', classData: ClassRegistry.getClass('white_mage')! });
  const bm = new Character({ name: 'BLACK', classData: ClassRegistry.getClass('black_mage')! });
  war2.currentHp = 5;
  for (const c of [war, war2, wm, bm]) party.add(c);
  party.addGold(1234);
  return party;
}

describe('FieldMenuScene', () => {
  describe('C3: Load option', () => {
    it('has Load option in menu, which opens the load menu', () => {
      const game = createMockGameForMenu();
      const scene = new FieldMenuScene(game as unknown as Game);
      scene.enter();
      expect(game.scenes.get).toHaveBeenCalledWith('exploration');
      expect(visibleLabels(scene.container)).toContain('Load');
      game.input.tap('up', () => scene.update(1));          // wraps to the last item
      game.input.tap('confirm', () => scene.update(1));
      expect(game.scenes.push).toHaveBeenCalledWith('loadMenu');
    });
  });

  describe('C7: canSave evaluated in enter()', () => {
    it('evaluates canSave on enter, not constructor', () => {
      const game = createMockGameForMenu(false);
      const scene = new FieldMenuScene(game as unknown as Game);
      expect(game.scenes.get).not.toHaveBeenCalled();
      scene.enter();
      expect(game.scenes.get).toHaveBeenCalledWith('exploration');
    });

    it('updates save enabled state on each enter call', () => {
      const game = createMockGameForMenu(false);
      const exploration = game.scenes.get();
      game.scenes.get.mockClear();
      const scene = new FieldMenuScene(game as unknown as Game);
      scene.enter();
      exploration.canSave.mockReturnValue(true);
      scene.enter();
      expect(exploration.canSave).toHaveBeenCalledTimes(2);
    });
  });

  describe('MS-7: the menu redesign', () => {
    it('lists Items, Magic, Equip, Status, Order, Save, Load and no Config', () => {
      const scene = new FieldMenuScene(createMockGameForMenu() as unknown as Game);
      scene.enter();
      const labels = visibleLabels(scene.container);
      for (const l of ['Items', 'Magic', 'Equip', 'Status', 'Order', 'Save', 'Load']) expect(labels).toContain(l);
      expect(labels).not.toContain('Config');
    });

    it('the party panel shows every member\'s name, Lv, HP and Next, and charges only for casters', () => {
      const party = fullParty();
      const scene = new FieldMenuScene(createMockGameForMenu(true, party) as unknown as Game);
      scene.enter();
      const labels = visibleLabels(scene.container);
      for (const m of party.all) {
        expect(labels).toContain(m.name);
        expect(labels).toContain(`HP ${m.currentHp}/${m.maxHp}`);
      }
      expect(labels).toContain('FGHTR2');
      expect(labels.filter((l) => l.startsWith('Lv '))).toHaveLength(4);
      expect(labels).toContain('Lv 2');
      expect(labels).toContain(`Next: ${xpToReach(3) - xpToReach(2)}`);
      const charges = labels.filter((l) => /^L1 \d+\/\d+/.test(l));
      expect(charges).toHaveLength(2);               // the white and black mage, not the fighters
    });

    it('shows the gold, the play time as H:MM:SS and the location', () => {
      const game = createMockGameForMenu(true, fullParty());
      game.playTime = 3723.9;
      const scene = new FieldMenuScene(game as unknown as Game);
      scene.enter();
      const labels = visibleLabels(scene.container);
      expect(labels).toContain('1234 G');
      expect(labels).toContain('1:02:03');
      expect(labels).toContain('Cornelia');
      game.playTime = 3724.2;
      scene.update(1);
      expect(visibleLabels(scene.container)).toContain('1:02:04');
    });

    it('a help bar describes the highlighted command', () => {
      const game = createMockGameForMenu();
      const scene = new FieldMenuScene(game as unknown as Game);
      scene.enter();
      const bars = scene.container.children.filter((c): c is HelpWindow => c instanceof HelpWindow);
      expect(bars).toHaveLength(1);                  // the shared HelpWindow, not a bar of its own
      expect(bars[0].y).toBe(HELP_RECT.y);
      const help = () => bars[0].text;
      expect(help()).toMatch(/item/i);
      game.input.tap('down', () => scene.update(1));
      expect(help()).toMatch(/spell/i);
    });

    it('E7: no command promises sorting (the item menu cannot sort)', () => {
      const game = createMockGameForMenu();
      const scene = new FieldMenuScene(game as unknown as Game);
      scene.enter();
      const bar = scene.container.children.find((c): c is HelpWindow => c instanceof HelpWindow)!;
      for (let i = 0; i < 7; i++) {
        expect(bar.text).not.toMatch(/sort/i);
        game.input.tap('down', () => scene.update(1));
      }
    });

    it('refreshes the party when it comes back from a sub-menu', () => {
      const party = fullParty();
      const scene = new FieldMenuScene(createMockGameForMenu(true, party) as unknown as Game);
      scene.enter();
      party.get(1)!.currentHp = 20;
      scene.onPause();
      scene.onResume();
      expect(visibleLabels(scene.container)).toContain(`HP 20/${party.get(1)!.maxHp}`);
    });

    it('layout: left pane x 24 w 360, party pane x 408 w 1488', () => {
      expect(LEFT_PANE).toEqual({ x: 24, width: 360 });
      expect(PARTY_PANE).toMatchObject({ x: 408, width: 1488, rowHeight: 168, rows: 4 });
      expect(LEFT_PANE.x + LEFT_PANE.width).toBeLessThan(PARTY_PANE.x);
    });
  });

  it('formatPlayTime', () => {
    expect(formatPlayTime(0)).toBe('0:00:00');
    expect(formatPlayTime(59.9)).toBe('0:00:59');
    expect(formatPlayTime(36000 + 61)).toBe('10:01:01');
  });
});
