import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MapNPC } from '../../../src/types/index.js';
import { flightField, flightMap, resetStub, stub } from './flightHarness.js';

vi.mock('../../../src/scenes/exploration/mode7/FlightRenderer.js', async () => (await import('./flightHarness.js')).rendererModule);

/**
 * M7-5 in the field (docs/MODE7_PLAN.md 5): each flight frame hands the renderer the billboards read from the
 * top-down world, the parked ship and the map's NPCs, never the airship itself (the view's own screen-fixed hull). The
 * rules see none of it: an NPC that leaves (a flag) leaves the billboards too.
 */
const npc = (id: string, x: number, y: number, extra: Partial<MapNPC> = {}): MapNPC =>
  ({ id, x, y, sprite: 'villager', dialog: ['Hello.'], ...extra });

describe('M7-5: the billboards of a flight frame', () => {
  beforeEach(() => resetStub());
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('stands up the parked ship and the NPCs in view, not the flying airship', async () => {
    const map = flightMap({ width: 60, height: 60, npcs: [npc('elder', 28, 20), npc('worker', 34, 22, { hideIf: 'LEFT' })] });
    const f = await flightField({ mode7: 'on', map, start: { x: 30, y: 30 }, fieldMode: 'airship',
      vehicles: [{ type: 'ship', map: 'overworld', x: 33, y: 25 }] });
    await f.idle(2);
    expect(f.report().state).toBe('flying');
    const props = stub.last?.props ?? [];
    const labels = props.map((p) => (p.sprite as { label?: string }).label ?? '');
    expect(labels.filter((l) => l.startsWith('vehicle:airship'))).toEqual([]);
    expect(labels).toContain('vehicle:ship');
    const ship = props.find((p) => (p.sprite as { label?: string }).label === 'vehicle:ship')!;
    expect(ship.gx).toBeCloseTo(33.5, 9);
    expect(ship.gy).toBe(26);
    const npcs = props.filter((p) => !(p.sprite as { label?: string }).label?.startsWith('vehicle:'));
    expect(npcs.map((p) => [p.gx, p.gy])).toEqual([[28.5, 21], [34.5, 23]]);
    // a flag sends the worker away: its billboard goes with it
    f.game.gameFlags.set('LEFT');
    await f.idle(2);
    const after = (stub.last?.props ?? []).filter((p) => !(p.sprite as { label?: string }).label?.startsWith('vehicle:'));
    expect(after.map((p) => [p.gx, p.gy])).toEqual([[28.5, 21]]);
  });

  it('with Mode 7 off nothing is drawn, and the field keeps its sprites', async () => {
    const map = flightMap({ width: 60, height: 60, npcs: [npc('elder', 28, 20)] });
    const f = await flightField({ mode7: 'off', map, start: { x: 30, y: 30 }, fieldMode: 'airship',
      vehicles: [{ type: 'ship', map: 'overworld', x: 33, y: 25 }] });
    await f.idle(2);
    expect(stub.draws).toBe(0);
    expect(f.scene.container.children[0].visible).toBe(true);
  });
});
