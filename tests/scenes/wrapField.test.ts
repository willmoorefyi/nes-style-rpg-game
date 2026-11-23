/**
 * WR (docs/WORLD_WRAP_PLAN.md 5, 10): ExplorationScene on a streamed, wrapped 192x192 world (144 chunks, so it
 * streams). The ship crosses east and west, the airship the corner; on every frame of a crossing each visible chunk's
 * screen position moves by the same step of under one tile (no period jump shows); the hero's cell, `playerMove` and
 * the saved position stay canonical; a landing on the first grass after a crossing; a parked ship across the seam is
 * drawn at its image.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Container } from 'pixi.js';
import { TILE_SIZE } from '../../src/core/LayoutConstants.js';
import { EncounterSystem } from '../../src/systems/EncounterSystem.js';
import { EventBus } from '../../src/core/EventBus.js';
import type { FieldMode, VehicleState } from '../../src/types/index.js';
import { flightField, flush, resetStub } from './mode7/flightHarness.js';
import { fakeChunks, streamedWorld, STREAMED_SIZE } from '../helpers/streamedWorld.js';

vi.mock('../../src/scenes/exploration/mode7/FlightRenderer.js', async () => (await import('./mode7/flightHarness.js')).rendererModule);

const N = STREAMED_SIZE;
const GRASS_X = 2;   // a grass column at x 2 (the landing after the east crossing); the rest is open sea
const ZONES = [{ id: 'east_sea', rects: [[96, 0, N - 1, N - 1]] as [number, number, number, number][], encounters: [] },
  { id: 'west_sea', rects: [[0, 0, 95, N - 1]] as [number, number, number, number][], encounters: [] }];

async function field(start: { x: number; y: number }, fieldMode: FieldMode, vehicles: VehicleState[] = []) {
  const chunks = fakeChunks({ allRows: true });
  const map = streamedWorld({ wrap: true, water: (x) => x !== GRASS_X });
  map.encounterZones = ZONES;
  const f = await flightField({ mode7: 'off', map, start, fieldMode, vehicles });
  const moves: Array<{ x: number; y: number }> = [];
  f.game.events.on('playerMove', (c: { x: number; y: number }) => moves.push({ ...c }));
  f.setOnFrame(async () => { chunks.tick(); await flush(); });
  await f.idle(4);
  return { f, map, moves };
}

/** The world container (the scene's first child) and the visible chunk sprites of its below layer. */
function chunkScreen(scene: { container: Container }): Map<object, number[]> {
  const world = scene.container.children[0] as Container;
  const below = world.children.find((c) => c.zIndex === -1_000_000) as Container;
  const out = new Map<object, number[]>();
  for (const c of below.children) if (c.visible && c.zIndex === 0) out.set(c, [c.x + world.x, c.y + world.y]);
  return out;
}

beforeEach(() => resetStub());
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('WR: the field on a wrapped world', () => {
  it('the ship sails east across x 191 | 0 and back west; the view moves by under a tile each frame', async () => {
    const { f, moves } = await field({ x: N - 3, y: 100 }, 'ship');
    let prev = chunkScreen(f.scene);
    let worst = 0;
    f.setOnFrame(async () => {
      await flush();
      const now = chunkScreen(f.scene);
      const deltas = [...now].filter(([c]) => prev.has(c)).map(([c, p]) => [p[0] - prev.get(c)![0], p[1] - prev.get(c)![1]]);
      for (const [dx, dy] of deltas) {
        expect(Math.abs(dx)).toBeLessThan(TILE_SIZE);
        expect(dy).toBe(0);
        expect(dx).toBe(deltas[0][0]);   // every chunk moves together
        worst = Math.max(worst, Math.abs(dx));
      }
      prev = now;
    });
    await f.steps('right', 4);
    expect(moves.map((m) => m.x)).toEqual([N - 2, N - 1, 0, 1]);
    expect(f.game.playerPosition).toEqual({ x: 1, y: 100 });
    expect(f.game.fieldMode).toBe('ship');
    await f.steps('left', 3);
    expect(moves.slice(4).map((m) => m.x)).toEqual([0, N - 1, N - 2]);
    expect(f.game.playerPosition).toEqual({ x: N - 2, y: 100 });
    expect(worst).toBeGreaterThan(0);
    // the zone of each arrival is read at its canonical cell
    const enc = new EncounterSystem(new EventBus());
    enc.setZones(ZONES);
    expect(moves.map((m) => enc.zoneAt(m.x, m.y)?.id)).toEqual(['east_sea', 'east_sea', 'west_sea', 'west_sea',
      'west_sea', 'east_sea', 'east_sea']);
  });

  it('the airship crosses the corner in two steps, then lands on the first grass east of the seam', async () => {
    const { f, moves } = await field({ x: N - 1, y: N - 1 }, 'airship');
    await f.step('right');
    await f.step('down');
    expect(moves).toEqual([{ x: 0, y: N - 1 }, { x: 0, y: 0 }]);
    for (let y = 0; y < 100; y++) await f.step('down');
    await f.steps('right', GRASS_X);
    expect(f.game.playerPosition).toEqual({ x: GRASS_X, y: 100 });
    await f.idle(2);
    await f.confirm();
    await f.idle(40);
    expect(f.game.fieldMode).toBe('walking');
    expect(f.game.vehicles.find((v) => v.type === 'airship')).toMatchObject({ x: GRASS_X, y: 100 });
  });

  it('draws a ship parked across the seam at its image', async () => {
    const { f } = await field({ x: N - 4, y: 100 }, 'airship', [{ type: 'ship', map: 'overworld', x: 1, y: 100 }]);
    const world = f.scene.container.children[0] as Container;
    const ship = world.children.find((c) => c.label === 'vehicle:ship')!;
    ship.onRender?.(undefined as never);
    expect(ship.x).toBe((N + 1) * TILE_SIZE + TILE_SIZE / 2);
    await f.steps('right', 8);   // the hero now east of the seam too: the canonical image
    ship.onRender?.(undefined as never);
    expect(ship.x).toBe(1 * TILE_SIZE + TILE_SIZE / 2);
  });
});
