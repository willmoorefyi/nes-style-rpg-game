import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Container } from 'pixi.js';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import { EventBus } from '../../src/core/EventBus.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { npcPresenceChanges } from '../../src/scenes/exploration/NpcPresence.js';
import type { Game } from '../../src/core/Game.js';
import type { MapNPC } from '../../src/types/index.js';
import { createMockGame, createMapData } from '../helpers/testUtils.js';

// P3-03: NPCs that a flag brings (the sleeping giant after TITAN_FED, bahamut_after) used to be drawn only on re-entry.
const def = (id: string, extra: Partial<MapNPC> = {}): MapNPC =>
  ({ id, x: 3, y: 3, sprite: 'mage', dialog: ['...'], ...extra });

describe('npcPresenceChanges', () => {
  it('lists the NPCs a flag removes and the defs a flag brings', () => {
    const defs = [def('a', { hideIf: 'F' }), def('b', { showIf: 'F' }), def('c')];
    const live = [{ id: 'a' }, { id: 'c' }] as never;
    const none = npcPresenceChanges(live, defs, () => false);
    expect(none.gone).toEqual([]);
    expect(none.appear).toEqual([]);
    const set = npcPresenceChanges(live, defs, (f) => f === 'F');
    expect(set.gone.map((n) => n.id)).toEqual(['a']);
    expect(set.appear.map((d) => d.id)).toEqual(['b']);
  });
});

/** Controls hint already seen (it would swallow the updates). */
const store: Record<string, string> = { ff1_controlsSeen: 'true' };
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; }, clear: () => {},
});

describe('ExplorationScene NPC visibility follows flags (P3-03)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  function setup() {
    const map = createMapData({
      id: 'lair', width: 12, height: 12,
      npcs: [def('before', { x: 3, y: 3, hideIf: 'DONE' }), def('after', { x: 6, y: 3, showIf: 'DONE' }), def('stays', { x: 8, y: 3 })],
    });
    const base = createMockGame(map);
    const game = { ...base, events: new EventBus(), gameFlags: new GameFlags() };
    return { game, map };
  }
  const sprites = (scene: ExplorationScene) => (scene.container.children[0] as Container).children.length;

  it('swaps the NPCs of a flag set while the player stays in the room (update, no re-entry)', async () => {
    const { game } = setup();
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    expect(scene.npcIds.sort()).toEqual(['before', 'stays']);
    const start = sprites(scene);
    scene.update(16);
    expect(scene.npcIds.sort()).toEqual(['before', 'stays']);
    game.gameFlags.set('DONE');
    scene.update(16);
    expect(scene.npcIds.sort()).toEqual(['after', 'stays']);
    expect(sprites(scene)).toBe(start);          // one sprite left the world container, one joined
    scene.update(16);
    expect(scene.npcIds.sort()).toEqual(['after', 'stays']);
  });

  it('brings a showIf NPC on resume and never twice', async () => {
    const { game } = setup();
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    game.gameFlags.set('DONE');
    scene.onResume();
    scene.onResume();
    scene.update(16);
    expect(scene.npcIds.filter((id) => id === 'after')).toHaveLength(1);
  });

  it('waits a frame when the hero stands on the cell it would appear on', async () => {
    const { game } = setup();
    game.playerPosition = { x: 6, y: 3 };
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    game.gameFlags.set('DONE');
    scene.onResume();
    expect(scene.npcIds).not.toContain('after');
  });
});
