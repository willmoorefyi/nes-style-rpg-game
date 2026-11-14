import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoadScene } from '../../src/scenes/LoadScene.js';
import { SaveScene } from '../../src/scenes/SaveScene.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import type { Game } from '../../src/core/Game.js';
import type { BitmapText, Container } from 'pixi.js';

const store: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  },
});

function game() {
  const pressed = new Set<string>();
  return {
    pressed,
    scenes: { pop: vi.fn(), switchTo: vi.fn(), get: vi.fn((): { getMapName: () => string } | undefined => undefined) },
    input: { isPressed: () => false, isJustPressed: (a: string) => pressed.has(a) },
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    party: new PartyManager(), inventory: new Inventory(), gameFlags: new GameFlags(),
    currentMapId: 'cornelia', playerPosition: { x: 1, y: 2 }, playTime: 0,
  };
}

/** All text drawn by a scene (menu labels, messages). */
function texts(c: Container): string[] {
  const out: string[] = [];
  const walk = (n: Container) => {
    if ('text' in n && typeof (n as BitmapText).text === 'string') out.push((n as BitmapText).text);
    for (const ch of n.children) walk(ch as Container);
  };
  walk(c);
  return out;
}

describe('Save and Load slot lists (MS-4)', () => {
  beforeEach(() => localStorage.clear());

  it('Load lists a slot saved after the Load scene was first created', () => {
    const g = game();
    const load = new LoadScene(g as unknown as Game);
    load.enter();
    expect(texts(load.container)).toContain('Slot 1  Empty');
    const save = new SaveScene(g as unknown as Game);
    save.enter();
    g.pressed.add('confirm');
    save.update(1);                              // save to slot 1
    g.pressed.clear();
    load.enter();
    expect(texts(load.container)).toContain('Slot 1  Cornelia  0:00');
  });

  it('Save says "Saved." and closes on the next key press', () => {
    const g = game();
    const save = new SaveScene(g as unknown as Game);
    save.enter();
    g.pressed.add('confirm');
    save.update(1);
    expect(texts(save.container)).toContain('Saved.');
    expect(g.scenes.pop).not.toHaveBeenCalled();
    save.update(1);                              // confirm again
    expect(g.scenes.pop).toHaveBeenCalledTimes(1);
  });
});

describe('R3: Save and Load screens (S4, S5)', () => {
  beforeEach(() => localStorage.clear());

  /** A party of two, saved from a map whose display name is `location`. */
  async function saved(location = 'Cornelia') {
    const { loadRealRegistries } = await import('../helpers/realData.js');
    await loadRealRegistries();
    const { Character } = await import('../../src/entities/Character.js');
    const { ClassRegistry } = await import('../../src/data/ClassRegistry.js');
    const g = game();
    g.scenes.get.mockImplementation(() => ({ getMapName: () => location }));
    const rolf = new Character({ name: 'ROLF', classData: ClassRegistry.getClass('warrior')!, level: 3 });
    rolf.currentHp = 20;
    g.party.add(rolf);
    g.party.add(new Character({ name: 'MAYA', classData: ClassRegistry.getClass('white_mage')! }));
    g.party.addGold(400);
    const save = new SaveScene(g as unknown as Game);
    save.enter();
    return { g, save, rolf };
  }

  it('S4: behind "Saved." the list already shows the new save', async () => {
    const { g, save } = await saved();
    g.pressed.add('confirm');
    save.update(1);
    g.pressed.clear();
    const shown = texts(save.container);
    expect(shown).toContain('Saved.');
    expect(shown).not.toContain('Slot 1  Empty');
    expect(shown).toContain('Slot 1  Cornelia  0:00');
  });

  it('S5: the two screens have different titles', () => {
    const g = game();
    const save = texts(new SaveScene(g as unknown as Game).container);
    const load = texts(new LoadScene(g as unknown as Game).container);
    expect(save).toContain('Save: choose a slot');
    expect(load).toContain('Load: choose a slot');
  });

  it('S5: a slot shows its location, and its detail lists every member, the gold and the date', async () => {
    const { g, save, rolf } = await saved('Cornelia Castle 2F');
    g.pressed.add('confirm');
    save.update(1);
    g.pressed.clear();
    const load = new LoadScene(g as unknown as Game);
    load.enter();
    expect(texts(load.container)).toContain('Slot 1  Cornelia Castle 2F  0:00');
    expect(load.detailText).toMatch(new RegExp(`^ROLF  WAR  Lv3  HP 20/${rolf.maxHp}$`, 'm'));
    expect(load.detailText).toMatch(/^MAYA  WHM  Lv1  HP \d+\/\d+$/m);
    expect(load.detailText).toContain('400 G');
    expect(load.detailText).toMatch(/Saved \d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });

  it('S5: Load asks first; No stays, Yes loads', async () => {
    const { g, save } = await saved();
    g.pressed.add('confirm');
    save.update(1);
    g.pressed.clear();
    const restore = vi.fn();
    const lg = { ...g, restoreState: restore, pendingEntrance: null, battleRetry: null, pendingBattle: null };
    const load = new LoadScene(lg as unknown as Game);
    load.enter();
    const press = (a: string): void => { g.pressed.add(a); load.update(1); g.pressed.clear(); };
    press('confirm');
    expect(load.confirmPrompt).toContain('Load Slot 1?');
    expect(load.confirmPrompt).toContain('Progress since your last save is lost.');
    expect(g.scenes.switchTo).not.toHaveBeenCalled();
    press('confirm'); // No (the default during a game, U6)
    expect(load.confirmPrompt).toBe('');
    expect(g.scenes.switchTo).not.toHaveBeenCalled();
    press('confirm'); // the slot again
    press('up');
    press('confirm'); // Yes
    expect(restore).toHaveBeenCalledTimes(1);
    expect(g.scenes.switchTo).toHaveBeenCalledWith('exploration');
  });
});

describe('U6: the Load prompt defaults to No only during a game', () => {
  beforeEach(() => localStorage.clear());

  async function withSave() {
    const { loadRealRegistries } = await import('../helpers/realData.js');
    await loadRealRegistries();
    const { Character } = await import('../../src/entities/Character.js');
    const { ClassRegistry } = await import('../../src/data/ClassRegistry.js');
    const g = game();
    g.party.add(new Character({ name: 'ROLF', classData: ClassRegistry.getClass('warrior')! }));
    const save = new SaveScene(g as unknown as Game);
    save.enter();
    g.pressed.add('confirm');
    save.update(1);
    g.pressed.clear();
    const restore = vi.fn();
    const lg = { ...g, restoreState: restore, pendingEntrance: null, battleRetry: null, pendingBattle: null };
    const load = new LoadScene(lg as unknown as Game);
    const press = (a: string): void => { g.pressed.add(a); load.update(1); g.pressed.clear(); };
    return { g, load, press, restore };
  }

  it('from the field (a party is in play) the prompt warns and starts on No', async () => {
    const { load, press, restore } = await withSave();
    load.enter();
    press('confirm');               // slot 1
    expect(load.confirmPrompt).toContain('lost');
    press('confirm');               // the default answer
    expect(restore).not.toHaveBeenCalled();
    expect(load.confirmPrompt).toBe('');
  });

  it('from the title (Continue, even after Game Over left a party) it is "Load Slot 1?" on Yes', async () => {
    const { g, load, press, restore } = await withSave();
    expect(g.party.size).toBe(1);   // Game Over -> Title keeps the wiped party in memory
    load.enter({ fromTitle: true });
    press('confirm');
    expect(load.confirmPrompt).toBe('Load Slot 1?');
    press('confirm');               // the default answer
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('re-opening from the field after the title forgets fromTitle', async () => {
    const { load, press } = await withSave();
    load.enter({ fromTitle: true });
    load.enter();
    press('confirm');
    expect(load.confirmPrompt).toContain('lost');
  });
});
