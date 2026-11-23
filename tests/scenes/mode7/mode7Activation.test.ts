import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMapData } from '../../helpers/testUtils.js';
import { deferred, flightField, flightMap, flush, rendererModule, resetStub, stub } from './flightHarness.js';
import { atlasSize } from '../../../src/scenes/exploration/mode7/WorldAtlas.js';

vi.mock('../../../src/scenes/exploration/mode7/FlightRenderer.js', async () => (await import('./flightHarness.js')).rendererModule);

/**
 * M7-2 activation (docs/MODE7_PLAN.md 4.3, 7, 9): Mode 7 shows only on `overworld` in the airship; a map change, the URL
 * `?mode7=0` and the setting `topdown` keep the top-down view; a missing atlas falls back with one console.error; the
 * renderer loads only when an airship is raised, parked or ridden there; a load in flight starts in the view, no tilt.
 */
const world = (f: Awaited<ReturnType<typeof flightField>>) => f.scene.container.children[0];

describe('M7-2: activation', () => {
  beforeEach(() => resetStub());
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('take-off shows the view and hides the world; landing gives the world back', async () => {
    const f = await flightField({ mode7: 'on' });
    expect(stub.created).toBe(1);                        // loaded behind the fade-in: an airship is parked here
    expect(stub.opts?.profile).toBe('full');
    expect(stub.opts?.at).toBe(1);
    await f.confirm();
    await f.frame();
    expect(f.report().state).toBe('tiltIn');             // M7-4: the 700 ms tilt, drawn in Mode 7 from its first frame
    expect(stub.visible).toBe(true);
    expect(world(f).visible).toBe(false);
    await f.idle(42);
    expect(f.report().state).toBe('flying');
    await f.step('up');
    await f.frame();
    await f.confirm();
    await f.frame();
    expect(f.game.fieldMode).toBe('walking');
    expect(f.report().state).toBe('tiltOut');            // the world (the hero on foot, the parked ship) waits under it
    expect(stub.visible).toBe(true);
    expect(world(f).visible).toBe(false);
    await f.idle(41);
    expect(f.report().state).toBe('tiltOut');
    await f.frame();
    expect(f.report().state).toBe('off');
    expect(stub.visible).toBe(false);
    expect(world(f).visible).toBe(true);
  });

  it('a map change ends Mode 7 at once and frees the renderer; only overworld draws it', async () => {
    const f = await flightField({ mode7: 'on', fieldMode: 'airship', vehicles: [] });
    await f.frame();
    expect(f.report().state).toBe('flying');
    f.game.data.loadMap.mockResolvedValueOnce(createMapData({ id: 'cornelia', width: 10, height: 10 }));
    await f.scene.loadMap('cornelia');
    expect(f.report().state).toBe('off');
    expect(stub.destroyed).toBe(1);
    expect(world(f).visible).toBe(true);
    await f.idle(3);
    expect(f.report().history).toEqual(['off', 'flying', 'off']);
  });

  it('FX-S: a scene change mid-flight (exit, enter again) frees the renderer once and flies on a new one', async () => {
    const f = await flightField({ mode7: 'on', fieldMode: 'airship', vehicles: [] });
    await f.frame();
    expect(f.report().state).toBe('flying');
    f.scene.exit();                                        // a debug scenario or a battle retry switches scenes
    expect(stub.destroyed).toBe(1);
    expect(world(f).visible).toBe(true);
    await f.scene.enter();
    await flush();
    expect(stub.created).toBe(2);
    await f.frame();
    await f.frame();
    expect(f.report().state).toBe('flying');               // a fresh renderer, restored with no tilt
    expect(stub.destroyed).toBe(1);
    expect(stub.visible).toBe(true);
    f.scene.exit();
    expect(stub.destroyed).toBe(2);
  });

  it('?mode7=0 flies top-down and loads nothing, even with a renderer', async () => {
    const off = await flightField({ mode7: 'off', fieldMode: 'airship', vehicles: [] });
    await off.idle(3);
    expect(off.report().state).toBe('off');
    expect(off.report().profile).toBe('off');
    expect(stub.created).toBe(0);
    expect(world(off).visible).toBe(true);
  });

  it('the setting: topdown keeps top-down, mode7 shows the view, with no URL value', async () => {
    for (const view of ['topdown', 'mode7'] as const) {
      resetStub();
      const f = await flightField({ mode7: 'on', fieldMode: 'airship', vehicles: [], search: '', view });
      await f.idle(2);
      expect(f.report().profile).toBe(view === 'mode7' ? 'full' : 'off');
      expect(f.report().state).toBe(view === 'mode7' ? 'flying' : 'off');
      expect(stub.created).toBe(view === 'mode7' ? 1 : 0);
    }
  });

  it('a missing atlas: failed, one console.error, and the airship flies top-down', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    stub.fail = true;
    const f = await flightField({ mode7: 'on' });
    await f.confirm();
    await f.steps('up', 3);
    expect(f.game.fieldMode).toBe('airship');
    expect(f.game.playerPosition).toEqual({ x: 6, y: 17 });
    expect(f.report().failed).toBe(true);
    expect(f.report().state).toBe('off');
    expect(world(f).visible).toBe(true);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain('Mode 7');
  });

  it('WR: a wrapped world with an NPOT atlas under WebGL1 rejects in atlasSize: failed, top-down, as a missing atlas', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const map = flightMap({ width: 256, height: 256, wrap: true });
    const meta = { version: 1, cellPx: 12, size: 3072, lowCellPx: 6, lowSize: 1536, inputs: 'x' };
    stub.fail = (() => { try { atlasSize(meta, map, 'low', false); return true; } catch (e) { return e as Error; } })();
    expect(String(stub.fail)).toContain('a wrapped map needs a power-of-two atlas under WebGL1 (1536)');
    const f = await flightField({ mode7: 'on', map, start: { x: 6, y: 20 } });
    await f.confirm();
    await f.steps('up', 3);
    expect(f.game.fieldMode).toBe('airship');
    expect(f.report().failed).toBe(true);
    expect(f.report().state).toBe('off');
    expect(world(f).visible).toBe(true);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][1])).toContain('power-of-two');
  });

  it('the renderer loads only once an airship is raised, parked or ridden on the world map', async () => {
    const f = await flightField({ mode7: 'on', vehicles: [] });
    await f.idle(3);
    expect(rendererModule.createFlightRenderer).not.toHaveBeenCalled();
    f.game.gameFlags.set('AIRSHIP_RAISED');
    await f.frame();
    await vi.dynamicImportSettled();
    await flush();
    expect(rendererModule.createFlightRenderer).toHaveBeenCalledTimes(1);
    for (const vehicles of [[{ type: 'airship' as const, map: 'overworld', x: 1, y: 1 }], []]) {
      resetStub();
      const g = await flightField({ mode7: 'on', vehicles, fieldMode: vehicles.length ? 'walking' : 'airship' });
      expect(stub.created).toBe(1);
      void g;
    }
    resetStub();
    await flightField({ mode7: 'on', vehicles: [{ type: 'airship', map: 'elfheim', x: 1, y: 1 }] });
    expect(stub.created).toBe(0);
  });

  it('a load in flight starts in the view with no tilt; not ready, it waits in loading (restore), even mid-step', async () => {
    const ready = await flightField({ mode7: 'on', fieldMode: 'airship', vehicles: [] });
    await ready.frame();
    expect(ready.report().history).toEqual(['off', 'flying']);
    resetStub();
    stub.gate = deferred();
    const f = await flightField({ mode7: 'on', fieldMode: 'airship', vehicles: [] });
    await f.frame();
    expect(f.report().state).toBe('loading');
    expect(f.report().reason).toBe('restore');
    f.keys.held = 'up';
    await f.frame();
    stub.gate.resolve();
    await flush();
    await f.frame();                                      // mid-step, but a restore never waits for idle
    f.keys.held = null;
    expect(f.report().state).toBe('flying');
    expect(f.report().history).toEqual(['off', 'loading', 'flying']);
  });

  it('without a renderer (every older scene test): no factory call, no Mode 7 log, state off, the same end as ?mode7=0', async () => {
    const play = async (mode7: 'none' | 'off') => {
      const error = vi.spyOn(console, 'error');
      const warn = vi.spyOn(console, 'warn');
      const f = await flightField({ mode7 });
      await f.confirm();
      await f.steps('up', 10);
      await f.idle(1);
      await f.confirm();
      await f.idle(2);
      const logs = [...error.mock.calls, ...warn.mock.calls].map((c) => String(c[0]));
      vi.restoreAllMocks();
      return { f, logs };
    };
    const none = await play('none');
    const off = await play('off');
    expect(rendererModule.createFlightRenderer).not.toHaveBeenCalled();
    expect(none.f.report().history).toEqual(['off']);
    expect(none.logs.filter((l) => l.includes('Mode 7'))).toEqual([]);
    expect(none.logs).toEqual(off.logs);                 // only what the field logs anyway (the vehicle sheet in Node)
    expect(none.f.outcome()).toEqual(off.f.outcome());
    expect(none.f.game.fieldMode).toBe('walking');
  });
});
