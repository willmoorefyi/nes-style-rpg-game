import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EncounterSystem } from '../../src/systems/EncounterSystem.js';
import { EventBus } from '../../src/core/EventBus.js';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import { DialogManager } from '../../src/systems/DialogManager.js';
import { encounterFreeTiles, encounterStepFilter } from '../../src/scenes/exploration/FieldTiles.js';
import type { Game } from '../../src/core/Game.js';
import type { MapData } from '../../src/types/index.js';
import { createMockGame, createMapData } from '../helpers/testUtils.js';

const goblins = [{ enemies: ['goblin'], weight: 1 }];

describe('EncounterSystem step filter (EB-2)', () => {
  it('fires on the step where stepsRemaining is 1, but never on a filtered (warp) tile', () => {
    const events = new EventBus();
    const sys = new EncounterSystem(events, () => 0);
    sys.setRate({ min: 2, max: 2 });
    sys.setEncounters(goblins);
    sys.setStepFilter((x, y) => !(x === 5 && y === 5));
    const battle = vi.fn();
    sys.setOnEncounter(battle);
    sys.start();
    events.emit('playerMove', { x: 1, y: 1 });
    expect(sys.stepsRemaining).toBe(1);
    events.emit('playerMove', { x: 5, y: 5 });   // the warp: neither counts down nor triggers
    expect(sys.stepsRemaining).toBe(1);
    expect(battle).not.toHaveBeenCalled();
    events.emit('playerMove', { x: 2, y: 1 });
    expect(battle).toHaveBeenCalledTimes(1);
    sys.stop();
  });

  it('a null filter counts every step', () => {
    const events = new EventBus();
    const sys = new EncounterSystem(events, () => 0);
    sys.setRate({ min: 3, max: 3 });
    sys.setEncounters(goblins);
    sys.setStepFilter(null);
    sys.start();
    events.emit('playerMove', { x: 5, y: 5 });
    expect(sys.stepsRemaining).toBe(2);
    sys.stop();
  });
});

describe('encounter-free tiles', () => {
  const map = createMapData({
    width: 10, height: 10,
    transitions: [{ x: 0, y: 4, targetMap: 'overworld', targetX: 1, targetY: 1 }],
    keyItemGates: [{ x: 3, y: 3, requiredFlag: 'BRIDGE_BUILT', message: 'The bridge is out.', permanent: false }],
    scriptedEncounters: [{ x: 7, y: 7, enemyIds: ['garland'], flag: 'GARLAND_DEFEATED', isBoss: true }],
  });

  it('are the transition, key-item gate and scripted-encounter tiles', () => {
    expect([...encounterFreeTiles(map)].sort()).toEqual(['0,4', '3,3', '7,7']);
  });

  it('leave every other tile (roads, bridges, grass) counting', () => {
    const counts = encounterStepFilter(map);
    expect(counts(0, 4)).toBe(false);
    expect(counts(3, 3)).toBe(false);
    expect(counts(7, 7)).toBe(false);
    expect(counts(1, 4)).toBe(true);
  });
});

describe('ExplorationScene: no battle on warps or blocked gates (EB-2)', () => {
  const store: Record<string, string> = { ff1_controlsSeen: 'true' };
  let gateMessages: string[][] = [];
  beforeEach(() => {
    gateMessages = [];
    // field messages close at once, so the walk can go on
    vi.spyOn(DialogManager.prototype, 'start').mockImplementation((lines, done) => { gateMessages.push([...lines]); done?.(); });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 1));
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; }, clear: () => {},
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  /** A 6x4 field where every counting step is a battle (rate 1); the player starts at (1, 1). */
  async function fieldWith(overrides: Partial<MapData>) {
    const map = createMapData({ id: 'field', width: 6, height: 4, encounters: goblins, encounterRate: { min: 1, max: 1 },
      ...overrides });
    const base = createMockGame(map);
    let held: string | null = null;
    const game = {
      ...base,
      events: new EventBus(),
      currentMapId: 'field',
      playerPosition: { x: 1, y: 1 },
      input: { ...base.input, isPressed: vi.fn((a: string) => a === held) },
    };
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    const walk = (dir: string) => {
      held = dir;
      scene.update(1);                        // the step starts
      held = null;
      for (let i = 0; i < 60; i++) scene.update(1);
    };
    return { game, walk };
  }

  it('stepping onto a warp tile at step count 0 never starts a battle', async () => {
    const { game, walk } = await fieldWith({
      transitions: [{ x: 2, y: 1, targetMap: 'field', targetX: 4, targetY: 2 }],
    });
    walk('right');
    await new Promise((r) => setTimeout(r, 800));   // the warp's fade out, reload and fade in
    expect(game.data.loadMap).toHaveBeenCalledTimes(2);
    expect(game.data.loadEnemies).not.toHaveBeenCalled();
  });

  it('bumping into a blocked gate is not a step; the next real step is', async () => {
    const { game, walk } = await fieldWith({
      keyItemGates: [{ x: 2, y: 1, requiredFlag: 'BRIDGE_BUILT', message: 'The bridge is out.', permanent: false }],
    });
    walk('right');
    expect(game.playerPosition).toEqual({ x: 1, y: 1 });
    expect(game.data.loadEnemies).not.toHaveBeenCalled();
    expect(gateMessages).toEqual([['The bridge is out.']]);
    walk('down');                             // plain ground: this step counts, and at rate 1 it is a battle
    expect(game.playerPosition).toEqual({ x: 1, y: 2 });
    expect(game.data.loadEnemies).toHaveBeenCalledTimes(1);
  });
});
