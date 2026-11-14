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
    scenes: { pop: vi.fn(), switchTo: vi.fn() },
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
    expect(texts(load.container)).toContain('Slot 1: Empty');
    const save = new SaveScene(g as unknown as Game);
    save.enter();
    g.pressed.add('confirm');
    save.update(1);                              // save to slot 1
    g.pressed.clear();
    load.enter();
    expect(texts(load.container).some((t) => t.startsWith('Slot 1: Lv'))).toBe(true);
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
