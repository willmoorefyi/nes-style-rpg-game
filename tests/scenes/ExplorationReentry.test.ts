import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import { BattleTrigger } from '../../src/systems/BattleTrigger.js';
import { EventBus } from '../../src/core/EventBus.js';
import { CutsceneRegistry } from '../../src/systems/CutsceneRegistry.js';
import type { Game } from '../../src/core/Game.js';
import { createMockGame, createMapData } from '../helpers/testUtils.js';

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
