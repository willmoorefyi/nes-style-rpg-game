import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Container } from 'pixi.js';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import type { Game } from '../../src/core/Game.js';
import { createMockGame, createMapData, type MockGame } from '../helpers/testUtils.js';
import { visibleLabels } from '../helpers/realData.js';
import { EventBus } from '../../src/core/EventBus.js';
import { BattleTrigger } from '../../src/systems/BattleTrigger.js';
import { PlaceholderTextures } from '../../src/rendering/PlaceholderTextures.js';
import { NPC } from '../../src/entities/NPC.js';
import type { MapData } from '../../src/types/index.js';

describe('ExplorationScene', () => {
  let game: MockGame;
  let scene: ExplorationScene;

  beforeEach(() => {
    game = createMockGame();
    scene = new ExplorationScene(game as unknown as Game);
  });

  it('has a container', () => {
    expect(scene.container).toBeInstanceOf(Container);
  });

  it('loads map on enter', async () => {
    await scene.enter();
    expect(game.data.loadMap).toHaveBeenCalled();
  });

  it('updates without error', async () => {
    await scene.enter();
    expect(() => scene.update(1)).not.toThrow();
  });

  it('cleans up on exit', async () => {
    await scene.enter();
    scene.exit();
  });

  it('can set player position', async () => {
    await scene.enter();
    expect(() => scene.setPlayerPosition(2, 2)).not.toThrow();
  });
});

describe('ExplorationScene - loadMap regression tests', () => {
  it('sets up tilemap, player, camera, and NPCs from map data', async () => {
    const mapWithNPCs = createMapData({
      id: 'test-with-npcs',
      npcs: [
        { id: 'npc1', x: 3, y: 3, sprite: 'npc.png', dialog: ['Hello!'] },
        { id: 'npc2', x: 5, y: 5, sprite: 'npc.png', dialog: ['Goodbye!'] },
      ],
    });

    const game = createMockGame(mapWithNPCs);
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();

    expect(game.data.loadMap).toHaveBeenCalledWith('assets/maps/cornelia.yaml');
    expect(() => scene.update(16)).not.toThrow();
  });

  it('handles map with transitions', async () => {
    const mapWithTransitions = createMapData({
      id: 'test-transitions',
      transitions: [{ x: 7, y: 7, targetMap: 'other-map', targetX: 0, targetY: 0 }],
    });

    const game = createMockGame(mapWithTransitions);
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();

    expect(() => scene.update(16)).not.toThrow();
  });

  it('handles map load failure gracefully', async () => {
    const game = createMockGame();
    game.data.loadMap.mockRejectedValue(new Error('Map not found'));

    const scene = new ExplorationScene(game as unknown as Game);
    await expect(scene.enter()).resolves.not.toThrow();
  });
});

describe('ExplorationScene - tile redraw while scrolling', () => {
  it('draws the tiles around the player after the camera moves away from the map origin', async () => {
    const big = createMapData({ id: 'big', width: 120, height: 80 });
    const game = createMockGame(big);
    (game as unknown as { currentMapId: string }).currentMapId = 'big';
    (game as unknown as { playerPosition: { x: number; y: number } }).playerPosition = { x: 100, y: 70 };
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    const input = game.input as unknown as { isJustPressed: { mockImplementation(f: (a: string) => boolean): void } };
    input.isJustPressed.mockImplementation((a: string) => a === 'confirm');   // dismiss the controls hint
    scene.update(16);
    input.isJustPressed.mockImplementation(() => false);
    scene.update(16);

    const xs: number[] = [];
    const walk = (c: Container) => {
      for (const child of c.children) {
        if (child.visible && child.constructor.name === 'Sprite') xs.push(child.x);
        if ('children' in child) walk(child as Container);
      }
    };
    walk(scene.container);
    // a screenful of tiles near the player (x ~ 100 tiles in) must be drawn, not only the first screen at the origin
    expect(xs.filter((x) => x > 90 * 48).length).toBeGreaterThan(20);
  });
});

describe('IN-3: the HUD has no raw map id', () => {
  const labels = (scene: ExplorationScene) => visibleLabels(scene.container);

  it('a map without a name shows no map label', async () => {
    const game = createMockGame(createMapData({ id: 'test-map' }));
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    expect(labels(scene)).not.toContain('TEST-MAP');
  });

  it('a named map shows its name', async () => {
    const game = createMockGame(createMapData({ id: 'test-map', name: 'Cornelia' }));
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    expect(labels(scene)).toContain('CORNELIA');
  });
});

describe('MS-8: canCamp', () => {
  it('is false unless the map sets camp: true', async () => {
    const town = new ExplorationScene(createMockGame(createMapData()) as unknown as Game);
    await town.enter();
    expect(town.canCamp()).toBe(false);
    const world = new ExplorationScene(createMockGame(createMapData({ camp: true })) as unknown as Game);
    await world.enter();
    expect(world.canCamp()).toBe(true);
  });
});

/** A field on `map` at (x, y) with real events; the controls hint was seen, so input counts from the first frame. */
async function fieldAt(map: MapData, x: number, y: number) {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k === 'ff1_controlsSeen' ? 'true' : null), setItem: () => {}, removeItem: () => {},
  });
  const game = { ...createMockGame(map), events: new EventBus() };
  game.currentMapId = map.id;
  game.playerPosition = { x, y };
  const scene = new ExplorationScene(game as unknown as Game);
  await scene.enter();
  return { game, scene };
}

/** Run frames with confirm pressed on each until `done()` or `max` frames. */
function confirmFrames(game: Pick<MockGame, 'input'>, scene: ExplorationScene, max: number, done: () => boolean = () => false): void {
  game.input.isJustPressed.mockImplementation((a: string) => a === 'confirm');
  for (let i = 0; i < max && !done(); i++) scene.update(1);
  game.input.isJustPressed.mockReturnValue(false);
}

describe('R1 field control (S2, E10, B1, E1)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('S2: while a warp fades, holding a direction does not walk the hero and cancel does not open the menu', async () => {
    const map = createMapData({ id: 'town', width: 10, height: 10,
      transitions: [{ x: 5, y: 5, targetMap: 'other', targetX: 1, targetY: 1 }] });
    const { game, scene } = await fieldAt(map, 5, 6);
    vi.stubGlobal('requestAnimationFrame', () => 0);          // the fade never finishes: look at what happens meanwhile
    game.input.isPressed.mockImplementation((a: string) => a === 'up');
    for (let i = 0; i < 40; i++) scene.update(1);
    expect(game.playerPosition).toEqual({ x: 5, y: 5 });
    game.input.isPressed.mockReturnValue(false);
    game.input.isJustPressed.mockImplementation((a: string) => a === 'cancel');
    scene.update(1);
    expect(game.scenes.push).not.toHaveBeenCalledWith('fieldMenu');
  });

  it('S2: no random battle starts while the map changes', async () => {
    const map = createMapData({ id: 'field', width: 10, height: 10, encounterRate: { min: 1, max: 1 },
      encounters: [{ enemies: ['goblin'], weight: 1 }],
      transitions: [{ x: 5, y: 5, targetMap: 'other', targetX: 1, targetY: 1 }] });
    const { game, scene } = await fieldAt(map, 5, 6);
    const battle = vi.spyOn(BattleTrigger.prototype, 'triggerBattle').mockResolvedValue(undefined);
    vi.stubGlobal('requestAnimationFrame', () => 0);
    game.input.isPressed.mockImplementation((a: string) => a === 'up');
    for (let i = 0; i < 40; i++) scene.update(1);
    game.events.emit('playerMove', { x: 4, y: 4 });            // a step event mid-fade
    expect(battle).not.toHaveBeenCalled();
  });

  it('E10: after a reorder the field sprite takes the new leader’s art on the same tile', async () => {
    const getArt = vi.spyOn(PlaceholderTextures.prototype, 'getPlayerArt');
    const map = createMapData({ id: 'town', width: 10, height: 10 });
    const game0 = createMockGame(map);
    game0.party.get.mockReturnValue({ classData: { id: 'warrior' } });
    const game = { ...game0, events: new EventBus(), currentMapId: 'town', playerPosition: { x: 3, y: 4 } };
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    expect(getArt).toHaveBeenLastCalledWith('warrior');
    game.party.get.mockReturnValue({ classData: { id: 'white_mage' } });
    scene.onPause();
    scene.onResume();
    expect(getArt).toHaveBeenLastCalledWith('white_mage');
    expect(game.playerPosition).toEqual({ x: 3, y: 4 });
    getArt.mockClear();
    scene.onPause();
    scene.onResume();                                          // same leader: no rebuild
    expect(getArt).not.toHaveBeenCalled();
  });

  const garlandRoom = () => createMapData({
    id: 'temple', width: 10, height: 10,
    npcs: [{ id: 'garland', x: 3, y: 3, sprite: 'garland_npc', dialog: ['I, Garland, will knock you all down!'] }],
    scriptedEncounters: [{ x: 2, y: 3, enemyIds: ['garland'], flag: 'GARLAND_DEFEATED', isBoss: true, npc: 'garland',
      message: 'Garland attacks!', postVictoryCutscene: 'garland_defeated' }],
  });

  it('B1: talking to the NPC a due encounter names starts that battle after the dialog closes', async () => {
    const { game, scene } = await fieldAt(garlandRoom(), 3, 2);   // facing down, at Garland
    const battle = vi.spyOn(BattleTrigger.prototype, 'triggerBattle').mockResolvedValue(undefined);
    confirmFrames(game, scene, 20, () => battle.mock.calls.length > 0);
    expect(battle).toHaveBeenCalledTimes(1);
    expect(battle.mock.calls[0][0]).toEqual(['garland']);
    expect(battle.mock.calls[0][1]).toMatchObject({ flag: 'GARLAND_DEFEATED', isBoss: true, canRun: false });
  });

  it('B1: once the encounter flag is set, talking starts no battle', async () => {
    const { game, scene } = await fieldAt(garlandRoom(), 3, 2);
    game.gameFlags.set('GARLAND_DEFEATED');
    const battle = vi.spyOn(BattleTrigger.prototype, 'triggerBattle').mockResolvedValue(undefined);
    confirmFrames(game, scene, 20);
    expect(battle).not.toHaveBeenCalled();
  });

  const chestRoom = () => createMapData({
    id: 'house', width: 10, height: 10,
    npcs: [{ id: 'chest', x: 3, y: 3, sprite: 'chest', dialog: [], chestItem: 'potion', chestFlag: 'CHEST_POTION' }],
  });

  it('E1: a chest with no room in the bag stays closed and keeps its item', async () => {
    const { game, scene } = await fieldAt(chestRoom(), 3, 2);
    game.inventory.add('potion', 99);
    const opened = vi.spyOn(NPC.prototype, 'setOpened');
    confirmFrames(game, scene, 1);
    expect(game.gameFlags.has('CHEST_POTION')).toBe(false);
    expect(game.inventory.getQuantity('potion')).toBe(99);
    expect(opened).not.toHaveBeenCalled();
  });

  it('E1: with room the chest opens, sets its flag and gives the item', async () => {
    const { game, scene } = await fieldAt(chestRoom(), 3, 2);
    game.inventory.add('potion', 98);
    confirmFrames(game, scene, 1);
    expect(game.gameFlags.has('CHEST_POTION')).toBe(true);
    expect(game.inventory.getQuantity('potion')).toBe(99);
  });

  it('E1: a gift with no room is not given and stays due', async () => {
    const map = createMapData({ id: 'house', width: 10, height: 10,
      npcs: [{ id: 'elder', x: 3, y: 3, sprite: 'old_man', dialog: ['Take this.'], giftItem: 'potion', giftFlag: 'GIFT' }] });
    const { game, scene } = await fieldAt(map, 3, 2);
    game.inventory.add('potion', 99);
    confirmFrames(game, scene, 1);
    expect(game.gameFlags.has('GIFT')).toBe(false);
    expect(game.inventory.getQuantity('potion')).toBe(99);
  });
});
