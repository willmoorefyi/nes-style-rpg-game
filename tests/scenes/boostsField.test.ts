/**
 * Pass CHT: the field boosts. Encounters Off rolls no random battle (scripted ones still start), x2 halves the steps
 * between battles; Walk speed x2 halves the frames per tile on foot, by ship and by canoe, never the airship's (QF,
 * user ruling 2026-11-22: the airship flies at its own AIRSHIP_SPEED).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Texture } from 'pixi.js';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import { EncounterSystem } from '../../src/systems/EncounterSystem.js';
import { BattleTrigger } from '../../src/systems/BattleTrigger.js';
import { PlayerController } from '../../src/entities/PlayerController.js';
import { ShipMode } from '../../src/entities/ShipMode.js';
import { CanoeMode } from '../../src/entities/CanoeMode.js';
import { AirshipMode, AIRSHIP_SPEED } from '../../src/entities/AirshipMode.js';
import type { MovementMode } from '../../src/entities/MovementMode.js';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { InputManager } from '../../src/core/InputManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { TerrainType, type MapData } from '../../src/types/index.js';
import type { Game } from '../../src/core/Game.js';
import { createMockGame, createMapData } from '../helpers/testUtils.js';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

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

/** A field where every step is due a battle (rate 1). */
const battleField = () => createMapData({ id: 'field', width: 10, height: 10, encounterRate: { min: 1, max: 1 },
  encounters: [{ enemies: ['goblin'], weight: 1 }] });

/** 100 steps on open cells (the scene syncs its rate first, as it does every field frame). */
function walk100(game: { events: EventBus }, scene: ExplorationScene): void {
  scene.update(1);
  for (let i = 0; i < 100; i++) game.events.emit('playerMove', { x: 2 + (i % 5), y: 4 });
}

describe('the Encounters boost', () => {
  it('Off: 100 steps on a field due a battle every step start no random battle', async () => {
    const { game, scene } = await fieldAt(battleField(), 4, 4);
    const battle = vi.spyOn(BattleTrigger.prototype, 'triggerBattle').mockResolvedValue(undefined);
    game.boosts.encounters = 0;
    walk100(game, scene);
    expect(battle).not.toHaveBeenCalled();
  });

  it('x1 on the same field: the first step starts one (the control)', async () => {
    const { game, scene } = await fieldAt(battleField(), 4, 4);
    const battle = vi.spyOn(BattleTrigger.prototype, 'triggerBattle').mockResolvedValue(undefined);
    scene.update(1);
    game.events.emit('playerMove', { x: 3, y: 4 });
    expect(battle).toHaveBeenCalledTimes(1);
  });

  it('Off still starts a scripted (story / boss) battle', async () => {
    const map = createMapData({ id: 'temple', width: 10, height: 10,
      npcs: [{ id: 'garland', x: 3, y: 3, sprite: 'garland_npc', dialog: ['I, Garland, will knock you all down!'] }],
      scriptedEncounters: [{ x: 2, y: 3, enemyIds: ['garland'], flag: 'GARLAND_DEFEATED', isBoss: true, npc: 'garland',
        message: 'Garland attacks!' }] });
    const { game, scene } = await fieldAt(map, 3, 2);
    game.boosts.encounters = 0;
    const battle = vi.spyOn(BattleTrigger.prototype, 'triggerBattle').mockResolvedValue(undefined);
    game.input.isJustPressed.mockImplementation((a: string) => a === 'confirm');
    for (let i = 0; i < 20 && battle.mock.calls.length === 0; i++) scene.update(1);
    expect(battle).toHaveBeenCalledTimes(1);
    expect(battle.mock.calls[0][1]).toMatchObject({ isBoss: true, canRun: false });
  });

  it('x2 halves the steps to the next battle; x0.5 doubles them (EncounterSystem rate x mode x boost)', () => {
    const steps = (mult: number): number => {
      const sys = new EncounterSystem(new EventBus(), () => 0);
      sys.setRateMultiplier(mult);
      sys.setRate({ min: 30, max: 30 });
      return sys.stepsRemaining;
    };
    expect(steps(1)).toBe(30);
    expect(steps(2)).toBe(15);
    expect(steps(0.5)).toBe(60);
  });
});

describe('the Walk speed boost', () => {
  type Vehicle = 'ship' | 'canoe' | 'airship';
  const MODES: Record<Vehicle, { mode: () => MovementMode; terrain: TerrainType }> = {
    ship: { mode: () => new ShipMode(), terrain: TerrainType.Water },
    canoe: { mode: () => new CanoeMode(), terrain: TerrainType.River },
    airship: { mode: () => new AirshipMode(), terrain: TerrainType.Mountain },
  };
  function framesPerTile(boost: number, ship: boolean | Vehicle = false): number {
    const input = new InputManager();
    vi.spyOn(input, 'isPressed').mockImplementation((a) => a === 'right');
    const vehicle = ship === true ? 'ship' : ship || null;
    const terrain = vehicle ? MODES[vehicle].terrain : TerrainType.Grass;
    const map = createMapData({ id: 't', width: 8, height: 8, collision: Array(64).fill(terrain) });
    const player = new PlayerController({ startX: 1, startY: 1, texture: Texture.WHITE, collisionMap: new CollisionMap(map),
      input, events: new EventBus(), moveSpeed: 200, ...(vehicle ? { movementMode: MODES[vehicle].mode() } : {}) });
    player.speedBoost = boost;
    // a held direction over 4 tiles: no idle frame between tiles (the step's carry), so the mean is exact
    let frames = 0;
    while (player.gridX < 5 && frames < 400) { player.update(1); frames++; }
    return frames / 4;
  }

  it('x2 takes half the frames per tile on foot, with no idle frame between held steps', () => {
    const base = framesPerTile(1);
    expect(base).toBe(12);            // moveSpeed 200 at 16.67 ms frames: 12 frames a tile, not 12 + 1
    expect(framesPerTile(2)).toBe(6);
  });

  it('a held walk emits one playerMove per tile, each on its own frame, and a step never ends on its start frame', () => {
    const input = new InputManager();
    vi.spyOn(input, 'isPressed').mockImplementation((a) => a === 'right');
    const map = createMapData({ id: 't', width: 8, height: 8, collision: Array(64).fill(TerrainType.Grass) });
    const events = new EventBus();
    const player = new PlayerController({ startX: 1, startY: 1, texture: Texture.WHITE, collisionMap: new CollisionMap(map),
      input, events, moveSpeed: 200 });
    player.speedBoost = 4;
    const moves: number[] = [];
    let frame = 0;
    events.on('playerMove', () => moves.push(frame));
    for (; frame < 40 && player.gridX < 6; frame++) {
      const before = player.isMoving;
      player.update(1);
      if (!before) expect(player.isMoving || player.gridX === 6).toBe(true);
    }
    expect(moves).toHaveLength(5);
    expect(new Set(moves).size).toBe(5);
  });

  it('x2 takes half the frames per tile by ship', () => {
    const base = framesPerTile(1, true);
    expect(base).toBeGreaterThan(1);
    expect(Math.abs(framesPerTile(2, true) - base / 2)).toBeLessThanOrEqual(1);
  });

  it('x2 takes half the frames per tile by canoe', () => {
    const base = framesPerTile(1, 'canoe');
    expect(base).toBeGreaterThan(1);
    expect(Math.abs(framesPerTile(2, 'canoe') - base / 2)).toBeLessThanOrEqual(1);
  });

  it('QF: the airship ignores Walk speed: the same frames per tile at x1 and x2, AIRSHIP_SPEED (3) times walking', () => {
    expect(AIRSHIP_SPEED).toBe(3);
    const air = framesPerTile(1, 'airship');
    expect(framesPerTile(2, 'airship')).toBe(air);
    expect(air).toBe(4);              // 12 frames a tile on foot / 3
    expect(new AirshipMode().getEncounterRateMultiplier()).toBe(0);
  });

  it('the field scene applies the boost to its player every frame', async () => {
    const { game, scene } = await fieldAt(createMapData({ id: 'town', width: 10, height: 10 }), 4, 4);
    game.boosts.walkSpeed = 2;
    game.input.isPressed.mockImplementation((a: string) => a === 'right');
    let frames = 0;
    while (game.playerPosition.x === 4 && frames < 100) { scene.update(1); frames++; }
    game.input.isPressed.mockReturnValue(false);
    const fast = frames;
    const slow = await fieldAt(createMapData({ id: 'town', width: 10, height: 10 }), 4, 4);
    slow.game.input.isPressed.mockImplementation((a: string) => a === 'right');
    frames = 0;
    while (slow.game.playerPosition.x === 4 && frames < 100) { slow.scene.update(1); frames++; }
    expect(fast).toBeLessThan(frames);
    expect(Math.abs(fast - frames / 2)).toBeLessThanOrEqual(1);
  });
});
