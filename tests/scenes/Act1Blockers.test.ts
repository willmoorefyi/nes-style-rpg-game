/**
 * Tranche-1 blocker flows end to end through the real exploration scene, battle trigger, scene manager and the real
 * act-1 cutscene scripts (fades run on a stubbed animation frame; dialogs close as soon as they open).
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { Container } from 'pixi.js';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import { BattleTrigger } from '../../src/systems/BattleTrigger.js';
import { DialogManager } from '../../src/systems/DialogManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import { CutsceneRegistry } from '../../src/systems/CutsceneRegistry.js';
import type { CutsceneScript } from '../../src/systems/CutsceneManager.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Character } from '../../src/entities/Character.js';
import { Game } from '../../src/core/Game.js';
import type { MapData, Scene, CharacterClassData } from '../../src/types/index.js';
import { createMockGame, createMapData } from '../helpers/testUtils.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const realCutscenes = parse(readFileSync(join(root, 'assets/data/cutscenes.yaml'), 'utf-8')) as
  Array<{ id: string; steps: CutsceneScript }>;
const garland = {
  id: 'garland', name: 'Garland', xpReward: 500, goldReward: 250, sprite: 'garland.png',
  stats: { hp: 200, strength: 15, agility: 8, intelligence: 4, vitality: 12, luck: 5, attack: 25, defense: 10, magicDefense: 5 },
};

beforeAll(async () => {
  ClassRegistry.reset();
  const classes = parse(readFileSync(join(root, 'assets/data/classes.yaml'), 'utf-8')) as CharacterClassData[];
  await ClassRegistry.init({ loadClasses: async () => classes } as unknown as DataLoader);
});

/** Controls hint already seen (it would swallow the first inputs). */
const store: Record<string, string> = { ff1_controlsSeen: 'true' };
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; }, clear: () => {},
});

function party(level = 1): PartyManager {
  const p = new PartyManager();
  p.add(new Character({ name: 'WAR', classData: ClassRegistry.getClass('warrior')!, level }));
  return p;
}

/** A mock game with real events, flags, party and a pressed-keys set. */
function makeGame(map: MapData) {
  const base = createMockGame(map);
  const pressed = new Set<string>();
  const game = {
    ...base,
    events: new EventBus(),
    party: party(),
    input: { ...base.input, isJustPressed: vi.fn((a: string) => pressed.has(a)), isPressed: vi.fn(() => false) },
    data: { ...base.data, loadEnemies: vi.fn().mockResolvedValue([garland]) },
    pressed,
  };
  return game;
}

const settle = async (ms = 50) => { await new Promise((r) => setTimeout(r, ms)); };

beforeEach(() => {
  CutsceneRegistry.clear();
  for (const c of realCutscenes) CutsceneRegistry.register(c.id, c.steps);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 5));
  // dialogs close as soon as they open (their completion callback runs)
  vi.spyOn(DialogManager.prototype, 'enqueue').mockImplementation((_lines, done) => { done?.(); });
});
afterEach(() => { vi.restoreAllMocks(); });

const templeMap = () => createMapData({
  id: 'temple-of-fiends', width: 12, height: 12, entrances: { south: [5, 10] },
  npcs: [
    { id: 'garland', x: 3, y: 3, sprite: 'garland_npc', dialog: ['...'], hideIf: 'GARLAND_DEFEATED' },
    { id: 'captive_princess', x: 5, y: 3, sprite: 'princess', dialog: ['Help!'], hideIf: 'PRINCESS_RESCUED' },
    { id: 'priest', x: 7, y: 3, sprite: 'mage', dialog: ['...'] },
  ],
});
const npcSprites = (scene: ExplorationScene) => (scene.container.children[0] as Container).children.length;

describe('ST-5 / ST-1: beating Garland (real trigger, real garland_defeated script)', () => {
  it('sets the boss flag, plays the cutscene, removes Garland and the princess, and never builds the bridge', async () => {
    const game = makeGame(templeMap());
    // T2: the script may warp the party to the throne room; that map has the arrival entrance
    const castle = createMapData({ id: 'cornelia-castle-2f', width: 30, height: 20, entrances: { throne_return: [21, 9] } });
    game.data.loadMap.mockImplementation((path: string) =>
      Promise.resolve(path.includes('cornelia-castle-2f') ? castle : templeMap()));
    const warp = realCutscenes.find((c) => c.id === 'garland_defeated')?.steps.find((s) => s.type === 'warp');
    game.currentMapId = 'temple-of-fiends';
    game.playerPosition = { x: 5, y: 6 };
    const boss = { canRun: false, isBoss: true, flag: 'GARLAND_DEFEATED', postVictoryCutscene: 'garland_defeated' };
    (game as unknown as Game).pendingBattle = { enemyIds: ['garland'], bossConfig: boss };
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    await settle();
    const before = npcSprites(scene);
    expect(game.scenes.push).toHaveBeenCalledWith('battle');
    expect((game as unknown as Game).battleRetry?.battle.bossConfig).toEqual(boss);   // retryable

    game.events.emit('battleEnd', { victory: true, xpReward: 500, goldReward: 250 });
    expect(game.gameFlags.has('GARLAND_DEFEATED')).toBe(true);
    expect((game as unknown as Game).battleRetry).toBeNull();
    await settle(1500);                                         // two 500 ms fades
    expect(game.gameFlags.has('PRINCESS_RESCUED')).toBe(true);
    expect(game.gameFlags.has('BRIDGE_BUILT')).toBe(false);
    if (warp) {
      // the party left the temple for the throne room (R4a's script)
      expect(scene.getMapId()).toBe(warp.map);
      expect(game.playerPosition).toEqual({ x: 21, y: 9 });
    } else {
      expect(npcSprites(scene)).toBe(before - 2);
    }
  });

  it('returning from any battle drops NPCs whose flags are now set (onResume)', async () => {
    const game = makeGame(templeMap());
    game.currentMapId = 'temple-of-fiends';
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    const before = npcSprites(scene);
    scene.onPause();
    game.gameFlags.set('GARLAND_DEFEATED');
    scene.onResume();
    expect(npcSprites(scene)).toBe(before - 1);
  });
});

describe('BattleTrigger victory order', () => {
  it('queues level-up messages before returning to the field, then plays the cutscene', async () => {
    const game = makeGame(templeMap());
    game.currentMapId = 'temple-of-fiends';
    const order: string[] = [];
    game.events.on('showDialog', (d: { text: string }) => order.push(`dialog:${d.text}`));
    game.scenes.pop.mockImplementation(() => { order.push('pop'); });
    const trigger = new BattleTrigger(game as unknown as Game);
    trigger.setCutscenePlayer(async (id) => { order.push(`cutscene:${id}`); });
    await trigger.triggerBattle(['garland'], { canRun: false, isBoss: true, postVictoryCutscene: 'garland_defeated' });
    trigger.onBattleEnd({ victory: true, xpReward: 5000, goldReward: 0 });
    expect(order[0]).toMatch(/^dialog:WAR reached Level \d+!$/);
    expect(order.slice(1)).toEqual(['pop', 'cutscene:garland_defeated']);
  });

  it('a lost battle keeps the retry snapshot for the Game Over menu', async () => {
    const game = makeGame(templeMap());
    game.currentMapId = 'temple-of-fiends';
    const trigger = new BattleTrigger(game as unknown as Game);
    await trigger.triggerBattle(['garland']);
    trigger.onBattleEnd({ victory: false, xpReward: 0, goldReward: 0 });
    expect((game as unknown as Game).battleRetry?.battle.enemyIds).toEqual(['garland']);
    expect(game.scenes.switchTo).toHaveBeenCalledWith('gameover');
  });
});

describe('ST-1: the King ends act 1 once (real act1_complete script, through the field update loop)', () => {
  const castle = () => createMapData({
    id: 'cornelia-castle-2f', width: 10, height: 10,
    npcs: [{ id: 'king', x: 5, y: 6, sprite: 'king', dialog: [{ condition: 'INTRO_COMPLETE', text: ['Builders at work.'] },
      { condition: 'PRINCESS_RESCUED', text: ['Thank you!'] }, { text: ['Save my daughter.'] }],
    cutscene: { id: 'act1_complete', requiredFlag: 'PRINCESS_RESCUED', onceFlag: 'INTRO_COMPLETE' } }],
  });

  it('plays after the rescue, blocks the menu while it runs, sets INTRO_COMPLETE, and does not replay', async () => {
    vi.spyOn(DialogManager.prototype, 'start').mockImplementation(() => {});   // NPC lines close at once
    const play = vi.spyOn(ExplorationScene.prototype, 'playCutscene');
    const game = makeGame(castle());
    game.currentMapId = 'cornelia-castle-2f';
    game.playerPosition = { x: 5, y: 5 };                          // the King is just below, the hero faces down
    game.gameFlags.set('PRINCESS_RESCUED');
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    const talk = () => { game.pressed.add('confirm'); scene.update(1); game.pressed.clear(); scene.update(1); };

    talk();
    expect(play).toHaveBeenCalledTimes(1);
    game.pressed.add('cancel');
    scene.update(1);                                               // mid-cutscene: no field menu
    game.pressed.clear();
    expect(game.scenes.push).not.toHaveBeenCalledWith('fieldMenu');
    await settle(2200);                                            // two 800 ms fades
    expect(game.gameFlags.has('INTRO_COMPLETE')).toBe(true);
    expect(game.gameFlags.has('BRIDGE_BUILT')).toBe(false);

    talk();
    expect(play).toHaveBeenCalledTimes(1);                         // only the dialog the second time
  });

  it('before the rescue, talking to the King plays nothing', async () => {
    vi.spyOn(DialogManager.prototype, 'start').mockImplementation(() => {});
    const play = vi.spyOn(ExplorationScene.prototype, 'playCutscene');
    const game = makeGame(castle());
    game.currentMapId = 'cornelia-castle-2f';
    game.playerPosition = { x: 5, y: 5 };
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    game.pressed.add('confirm'); scene.update(1); game.pressed.clear(); scene.update(1);
    expect(play).not.toHaveBeenCalled();
  });
});

describe('ST-2 / ST-3 with a real SceneManager', () => {
  it('after push(battle) then switchTo away and back, the field is visible and accepts input', async () => {
    const game = makeGame(createMapData({ id: 'overworld', width: 10, height: 10 }));
    game.currentMapId = 'overworld';
    const scene = new ExplorationScene(game as unknown as Game);
    const stub = (): Scene => ({ container: new Container(), enter() {}, exit() {}, update() {} });
    const sm = new SceneManager(new Container());
    sm.register('exploration', scene);
    sm.register('battle', stub());
    sm.register('gameover', stub());
    await sm.switchTo('exploration');
    await sm.push('battle');
    await sm.switchTo('gameover');
    await sm.switchTo('exploration');
    expect(scene.container.visible).toBe(true);
    game.pressed.add('cancel');
    scene.update(1);
    expect(game.scenes.push).toHaveBeenCalledWith('fieldMenu');    // not paused
  });

  it('a save loaded after a battle is entered on its own map and tile, not where the battle began', async () => {
    let onTriggered: (() => void) | null = null;
    vi.spyOn(BattleTrigger.prototype, 'setOnBattleTriggered').mockImplementation((cb) => { onTriggered = cb; });
    const game = makeGame(createMapData({ id: 'overworld', width: 10, height: 10 }));
    game.currentMapId = 'overworld';
    game.playerPosition = { x: 2, y: 2 };
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    onTriggered!();                                                // a battle starts at (2,2) on the overworld
    game.currentMapId = 'cornelia-castle-2f';                      // ...then Game Over > Load restores a save
    game.playerPosition = { x: 7, y: 4 };
    scene.exit();
    await scene.enter();
    expect(game.data.loadMap).toHaveBeenLastCalledWith('assets/maps/cornelia-castle-2f.yaml');
    expect(game.playerPosition).toEqual({ x: 7, y: 4 });
  });
});

describe('NG-2: a new game starts from nothing', () => {
  it('Game.resetState empties the party, gold, items, flags, map, retry state and play time', () => {
    const game = new Game();
    game.party.add(new Character({ name: 'OLD', classData: ClassRegistry.getClass('warrior')! }));
    game.party.addGold(999);
    game.inventory.add('potion', 5);
    game.gameFlags.set('GARLAND_DEFEATED');
    game.currentMapId = 'temple-of-fiends';
    game.playTime = 1234;
    game.pendingBattle = { enemyIds: ['garland'] };
    game.resetState();
    expect(game.party.size).toBe(0);
    expect(game.party.gold).toBe(0);
    expect(game.inventory.getQuantity('potion')).toBe(0);
    expect(game.gameFlags.has('GARLAND_DEFEATED')).toBe(false);
    expect(game.currentMapId).toBe('');
    expect(game.playTime).toBe(0);
    expect(game.battleRetry).toBeNull();
    expect(game.pendingBattle).toBeNull();
  });
});
