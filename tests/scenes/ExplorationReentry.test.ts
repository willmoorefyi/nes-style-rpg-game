import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import { BattleTrigger } from '../../src/systems/BattleTrigger.js';
import { EventBus } from '../../src/core/EventBus.js';
import { CutsceneRegistry } from '../../src/systems/CutsceneRegistry.js';
import type { Game } from '../../src/core/Game.js';
import { createMockGame, createMapData } from '../helpers/testUtils.js';
import { EncounterSystem } from '../../src/systems/EncounterSystem.js';
import { PlayerController } from '../../src/entities/PlayerController.js';
import type { MapData } from '../../src/types/index.js';

/** A mock game with a real EventBus, so subscribe / unsubscribe is observable. */
function gameWith(map = createMapData()) {
  const game = createMockGame(map);
  return { ...game, events: new EventBus() };
}

describe('ExplorationScene re-entry (ST-2 / ST-3)', () => {
  const onBattleEnd = vi.fn();
  beforeEach(() => {
    onBattleEnd.mockClear();
    vi.spyOn(BattleTrigger.prototype, 'onBattleEnd').mockImplementation(onBattleEnd);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('still hears battleEnd after leaving and coming back (Game Over > Continue, Field > Load)', async () => {
    const game = gameWith();
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    scene.exit();
    await scene.enter();
    game.events.emit('battleEnd', { victory: true, xpReward: 0, goldReward: 0 });
    expect(onBattleEnd).toHaveBeenCalledTimes(1);
  });

  it('entering twice without exit does not subscribe twice', async () => {
    const game = gameWith();
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    await scene.enter();
    game.events.emit('battleEnd', { victory: true, xpReward: 0, goldReward: 0 });
    expect(onBattleEnd).toHaveBeenCalledTimes(1);
  });

  it('comes back visible after being hidden under a battle and switched away', async () => {
    const game = gameWith();
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    scene.onPause();                        // SceneManager.push(battle) pauses and hides it
    scene.container.visible = false;
    scene.exit();                           // switchTo(gameover)
    await scene.enter();                    // Load / Retry: switchTo(exploration)
    expect(scene.container.visible).toBe(true);
  });

  it('a loaded save puts the player on the saved map and tile, even after an earlier battle', async () => {
    const map = createMapData({ id: 'saved-map', width: 10, height: 10 });
    const game = gameWith(map);
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    game.currentMapId = 'saved-map';
    game.playerPosition = { x: 4, y: 3 };
    scene.exit();
    await scene.enter();
    expect(game.data.loadMap).toHaveBeenLastCalledWith('assets/maps/saved-map.yaml');
    expect(game.playerPosition).toEqual({ x: 4, y: 3 });
  });
});

describe('ExplorationScene new game (NG-1) and retry (NG-2)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('a new game starts in Cornelia at the south gate', async () => {
    const game = gameWith(createMapData({ id: 'cornelia', width: 10, height: 10, entrances: { south_gate: [5, 8] } }));
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    expect(game.data.loadMap).toHaveBeenCalledWith('assets/maps/cornelia.yaml');
    expect(game.playerPosition).toEqual({ x: 5, y: 8 });
  });

  it('a pending retry starts the same battle once the map is loaded, then clears', async () => {
    const trigger = vi.spyOn(BattleTrigger.prototype, 'triggerBattle').mockResolvedValue();
    const game = gameWith(createMapData({ id: 'temple', width: 10, height: 10 }));
    game.currentMapId = 'temple';
    const boss = { canRun: false, isBoss: true, flag: 'GARLAND_DEFEATED' };
    (game as unknown as { pendingBattle: unknown }).pendingBattle = { enemyIds: ['garland'], bossConfig: boss };
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    expect(trigger).toHaveBeenCalledWith(['garland'], boss, undefined, undefined);
    expect(game.pendingBattle).toBeNull();
  });
});

describe('ExplorationScene cutscenes (ST-1 / ST-5)', () => {
  beforeEach(() => CutsceneRegistry.clear());
  afterEach(() => CutsceneRegistry.clear());

  it('after the post-Garland cutscene sets its flags, Garland and the captive princess leave the map', async () => {
    CutsceneRegistry.register('garland_defeated', [{ type: 'set_flag', flag: 'PRINCESS_RESCUED' }]);
    const map = createMapData({
      id: 'temple', width: 10, height: 10,
      npcs: [
        { id: 'garland', x: 3, y: 3, sprite: 'garland_npc', dialog: ['...'], hideIf: 'GARLAND_DEFEATED' },
        { id: 'captive_princess', x: 5, y: 3, sprite: 'princess', dialog: ['Help!'], hideIf: 'PRINCESS_RESCUED' },
        { id: 'priest', x: 7, y: 3, sprite: 'mage', dialog: ['...'] },
      ],
    });
    const game = gameWith(map);
    game.currentMapId = 'temple';
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    const sprites = () => scene.container.children[0].children.length;
    const before = sprites();
    game.gameFlags.set('GARLAND_DEFEATED');      // set by the battle before the cutscene
    await scene.playCutscene('garland_defeated');
    expect(game.gameFlags.has('PRINCESS_RESCUED')).toBe(true);
    expect(sprites()).toBe(before - 2);
  });

  it('an unknown cutscene is reported, not silently skipped', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const game = gameWith();
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    await scene.playCutscene('nope');
    expect(err).toHaveBeenCalledWith('Unknown cutscene: nope');
  });
});

/** A promise held open until `resolve` (a slow map fetch). */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

/** The controls hint was seen already, so the field takes input from the first frame. */
function hintSeen(): void {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k === 'ff1_controlsSeen' ? 'true' : null), setItem: () => {}, removeItem: () => {},
  });
}

describe('S1 / S2: the field while enter() is loading', () => {
  beforeEach(hintSeen);
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('a ticker frame while a loaded save is still loading does not put the hero back on the old tile', async () => {
    const map = createMapData({ id: 'saved-map', width: 10, height: 10 });
    const game = gameWith(map);
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    scene.setPlayerPosition(7, 7);
    scene.update(1);
    expect(game.playerPosition).toEqual({ x: 7, y: 7 });
    // Load: restoreState puts the saved tile in, then switchTo runs exit + enter
    game.playerPosition = { x: 2, y: 3 };
    game.currentMapId = 'saved-map';
    scene.exit();
    const held = deferred<MapData>();
    game.data.loadMap.mockReturnValue(held.promise);
    const entering = scene.enter();
    await vi.waitFor(() => expect(game.data.loadMap).toHaveBeenCalledTimes(2));
    scene.update(1);                                   // one ticker frame while the map is fetched
    held.resolve(map);
    await entering;
    expect(game.playerPosition).toEqual({ x: 2, y: 3 });
  });

  it('cancel during the first enter() does not open the field menu', async () => {
    const map = createMapData({ id: 'cornelia', width: 10, height: 10 });
    const game = gameWith(map);
    const held = deferred<MapData>();
    game.data.loadMap.mockReturnValue(held.promise);
    const scene = new ExplorationScene(game as unknown as Game);
    const entering = scene.enter();
    await vi.waitFor(() => expect(game.data.loadMap).toHaveBeenCalled());
    game.input.isJustPressed.mockImplementation((a: string) => a === 'cancel');
    scene.update(1);
    game.input.isJustPressed.mockReturnValue(false);
    held.resolve(map);
    await entering;
    expect(game.scenes.push).not.toHaveBeenCalledWith('fieldMenu');
  });

  it('W4: entering the field rolls a fresh encounter countdown after the map is loaded', async () => {
    const restart = vi.spyOn(EncounterSystem.prototype, 'restart');
    const setRate = vi.spyOn(EncounterSystem.prototype, 'setRate');
    const game = gameWith(createMapData({ id: 'overworld', encounterRate: { min: 10, max: 22 } }));
    game.currentMapId = 'overworld';
    await new ExplorationScene(game as unknown as Game).enter();
    expect(restart).toHaveBeenCalledTimes(1);
    expect(setRate.mock.invocationCallOrder[0]).toBeLessThan(restart.mock.invocationCallOrder[0]);
  });
});

describe('T2: a cutscene warp step moves the party to another map', () => {
  beforeEach(() => { hintSeen(); CutsceneRegistry.clear(); });
  afterEach(() => { CutsceneRegistry.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('after the rescue the party stands in the throne room on the named entrance, facing up', async () => {
    CutsceneRegistry.register('garland_defeated', [
      { type: 'set_flag', flag: 'PRINCESS_RESCUED' },
      { type: 'warp', map: 'cornelia-castle-2f', entrance: 'throne_return', facing: 'up' },
    ]);
    const temple = createMapData({ id: 'temple-of-fiends', width: 10, height: 10 });
    const castle = createMapData({
      id: 'cornelia-castle-2f', width: 30, height: 20, name: 'Cornelia Castle 2F', entrances: { throne_return: [21, 9] },
    });
    const game = gameWith(temple);
    game.data.loadMap.mockImplementation((path: string) =>
      Promise.resolve(path.includes('cornelia-castle-2f') ? castle : temple));
    game.currentMapId = 'temple-of-fiends';
    game.playerPosition = { x: 5, y: 5 };
    const face = vi.spyOn(PlayerController.prototype, 'face');
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    await scene.playCutscene('garland_defeated');
    expect(scene.getMapId()).toBe('cornelia-castle-2f');
    expect(game.currentMapId).toBe('cornelia-castle-2f');
    expect(scene.getMapName()).toBe('Cornelia Castle 2F');
    expect(game.playerPosition).toEqual({ x: 21, y: 9 });
    expect(face).toHaveBeenLastCalledWith('up');
  });

  it('heal_party emits partyHealed (its sound)', async () => {
    CutsceneRegistry.register('heal', [{ type: 'heal_party' }]);
    const game = gameWith();
    const healed = vi.fn();
    game.events.on('partyHealed', healed);
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    await scene.playCutscene('heal');
    expect(healed).toHaveBeenCalledTimes(1);
  });
});
