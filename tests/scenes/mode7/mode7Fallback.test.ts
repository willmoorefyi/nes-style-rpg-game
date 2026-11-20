import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Texture, type Renderer } from 'pixi.js';
import {
  SLOW_OVER, SLOW_P95_MS, SLOW_WINDOW, SlowRule, setSlowSession, slowThisSession,
} from '../../../src/scenes/exploration/mode7/mode7Toggle.js';
import { FlightStats, SETTLE_FRAMES, p95 } from '../../../src/scenes/exploration/mode7/flightStats.js';
import { FlightFallback, watchFlightContext, type ContextEvent } from '../../../src/scenes/exploration/mode7/FlightContext.js';
import { WorldAtlas, type AtlasLoader } from '../../../src/scenes/exploration/mode7/WorldAtlas.js';
import { ConfigScene } from '../../../src/scenes/ConfigScene.js';
import { resetSettingsCache } from '../../../src/core/Settings.js';
import type { Game } from '../../../src/core/Game.js';
import type { MapData } from '../../../src/types/index.js';
import { tapInput } from '../../helpers/realData.js';
import { flightField, flush, resetStub, stub } from './flightHarness.js';

vi.mock('../../../src/scenes/exploration/mode7/FlightRenderer.js', async () => (await import('./flightHarness.js')).rendererModule);

/**
 * M7-6, the fallbacks (docs/MODE7_PLAN.md 7, 9): the frame-time switch (the p95 of the last 120 steady frames staying
 * above 20 ms for a whole window sets `slow` for the session; `?mode7=1` keeps the view), the WebGL context loss and
 * restore (the world shows while the context is lost; the atlas reloads and recomposes; a failed restore logs, sets
 * `failed` and flies top-down).
 */
const world = (f: Awaited<ReturnType<typeof flightField>>) => f.scene.container.children[0];
/** The Mode 7 lines of a console spy (the mock game's art loads warn too). */
const mode7Lines = (spy: { mock: { calls: unknown[][] } }): string[] =>
  spy.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith('Mode 7'));

/** A small seeded generator (the equivalence test). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

afterEach(() => { setSlowSession(false); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('M7-6: the frame-time rule', () => {
  it('the p95 of a full 120-frame window must stay above 20 ms for a whole window: 120 full windows in a row', () => {
    expect(SLOW_WINDOW).toBe(120);
    expect(SLOW_P95_MS).toBe(20);
    expect(SLOW_OVER).toBe(6);
    const run = (...parts: Array<[number, number]>): boolean[] => {
      const r = new SlowRule();
      return parts.flatMap(([n, ms]) => Array(n).fill(ms)).map((ms) => r.push(ms));
    };
    const first = (xs: boolean[]): number => xs.indexOf(true);
    // steady 10 ms, then a slowdown to 25 ms: the window's p95 is over from its 6th slow frame, and has stayed over
    // for a whole window 119 frames later
    expect(first(run([120, 10], [400, 25]))).toBe(120 + 5 + 119);
    // slow from the start: the window fills (frame 120), then stays over for a whole window
    expect(first(run([400, 30]))).toBe(119 + 119);
    expect(run([238, 30]).some(Boolean)).toBe(false);
    // a hitch of 10 slow frames never fires it; 11 in a row keep 6 in every window for 120 frames and do
    expect(run([120, 10], [10, 40], [400, 10]).some(Boolean)).toBe(false);
    expect(run([120, 10], [11, 40], [400, 10]).some(Boolean)).toBe(true);
    // one slow frame in 25 (at most 5 in a window): never; one in 20 (6 in every window): it fires
    const spread = (gap: number): Array<[number, number]> =>
      Array.from({ length: 40 }, () => [[gap - 1, 10], [1, 40]] as Array<[number, number]>).flat();
    expect(run(...spread(25)).some(Boolean)).toBe(false);
    expect(run(...spread(20)).some(Boolean)).toBe(true);
    const r = new SlowRule();
    for (let i = 0; i < 120; i++) r.push(30);
    expect(r.p95()).toBe(30);
    r.reset();
    expect(r.p95()).toBe(0);
  });

  it('fires exactly when the last 120 full windows all had a p95 above 20 ms (random sequences)', () => {
    for (const seed of [7, 11, 23]) {
      const rnd = lcg(seed);
      const r = new SlowRule();
      const xs: number[] = [];
      const over: boolean[] = [];
      let mode = 0;
      for (let i = 0; i < 3000; i++) {
        if (rnd() < 0.01) mode = 1 - mode;                         // spells of a slow GPU now and then
        const ms = mode ? 14 + rnd() * 14 : rnd() < 0.04 ? 18 + rnd() * 8 : 8 + rnd() * 6;
        xs.push(ms);
        over.push(xs.length >= 120 && p95(xs.slice(-120)) > 20);
        const want = over.length >= 120 && over.slice(-120).every(Boolean);
        expect(r.push(ms)).toBe(want);
      }
    }
  });

  it('the excluded frames: the 60 settle frames, every upload frame and the one after it', () => {
    const s = new FlightStats();
    for (let i = 0; i < SETTLE_FRAMES; i++) s.push(true, false, 0.1, 40);   // settling: left out
    expect(s.samples).toBe(0);
    for (let i = 0; i < 119; i++) s.push(true, false, 0.1, 30);
    s.push(true, true, 0.1, 30);                    // a recentre: left out, and the frame after it
    s.push(true, false, 0.1, 30);
    expect(s.heavyFrames).toBe(2);
    expect(s.samples).toBe(119);
    for (let i = 0; i < 119; i++) s.push(true, false, 0.1, 30);   // the window is full from the first of these
    expect(s.slow).toBe(false);
    s.push(true, false, 0.1, 30);
    expect(s.slow).toBe(true);
    expect(s.slowP95()).toBe(30);
    s.reset();                                      // the view hid or a tilt ended: the window starts again
    expect(s.slow).toBe(false);
    s.push(false, false, 0.1, 30);                  // not drawn: not a flight frame
    expect(s.samples).toBe(239);
  });
});

/** A canvas stand-in that dispatches the two context events. */
function canvas() {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    listeners,
    addEventListener: (t: string, f: () => void) => { (listeners[t] ??= []).push(f); },
    removeEventListener: (t: string, f: () => void) => { listeners[t] = (listeners[t] ?? []).filter((g) => g !== f); },
    fire: (t: string) => { for (const f of listeners[t] ?? []) f(); },
  };
}

describe('M7-6: the context watcher', () => {
  it('lost, then the restore runs and reports restored; a rejecting or throwing restore reports failed', async () => {
    const c = canvas();
    const seen: ContextEvent[] = [];
    let mode: 'ok' | 'reject' | 'throw' = 'ok';
    const restore = vi.fn(() => {
      if (mode === 'throw') throw new Error('sync');
      return mode === 'reject' ? Promise.reject(new Error('404')) : Promise.resolve();
    });
    const unwatch = watchFlightContext(c, restore, (e) => { seen.push(e); });
    c.fire('webglcontextlost');
    expect(seen).toEqual(['lost']);
    expect(restore).not.toHaveBeenCalled();
    c.fire('webglcontextrestored');
    await flush();
    expect(seen).toEqual(['lost', 'restored']);
    mode = 'reject';
    c.fire('webglcontextlost');
    c.fire('webglcontextrestored');
    await flush();
    mode = 'throw';
    c.fire('webglcontextrestored');
    await flush();
    expect(seen).toEqual(['lost', 'restored', 'lost', 'failed', 'failed']);
    unwatch();
    expect(c.listeners.webglcontextlost).toEqual([]);
    expect(c.listeners.webglcontextrestored).toEqual([]);
  });

  it('a loss while a restore runs drops that restore\'s result; no canvas watches nothing', async () => {
    const c = canvas();
    const seen: ContextEvent[] = [];
    let finish = (): void => {};
    watchFlightContext(c, () => new Promise<void>((res) => { finish = res; }), (e) => { seen.push(e); });
    c.fire('webglcontextrestored');
    c.fire('webglcontextlost');
    finish();
    await flush();
    expect(seen).toEqual(['lost']);
    expect(() => watchFlightContext(undefined, async () => {}, () => {})()).not.toThrow();
    expect(() => watchFlightContext({}, async () => {}, () => {})()).not.toThrow();
  });

  it('FlightFallback: lost until restored; failed logs one console.error and falls back; slow sets the session', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fail = vi.fn();
    const fb = new FlightFallback(fail);
    fb.context('lost');
    expect(fb.lost).toBe(true);
    fb.context('restored');
    expect(fb.lost).toBe(false);
    expect(error).not.toHaveBeenCalled();
    fb.context('lost');
    fb.context('failed', new Error('404'));
    expect(fb.lost).toBe(false);
    expect(fail).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(fb.slow(31.5, () => false)).toBe(false);
    expect(slowThisSession()).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/p95 31\.5 ms over 120 frames is above 20 ms; the airship flies top-down/);
    expect(fb.slow(31.5, () => true)).toBe(true);
    expect(String(warn.mock.calls[1][0])).toMatch(/keeps the view on/);
  });
});

describe('M7-6: the atlas after a context restore', () => {
  const map = {
    id: 'overworld', width: 192, height: 192, layers: [], tilesets: [],
    art: { tile: 48, chunk: 16, below: ['assets/maps/ai/overworld/below_0_0.png'], above: [null] },
  } as unknown as MapData;
  const META = { version: 1, cellPx: 16, size: 3072, lowCellPx: 8, lowSize: 1536, inputs: 'x' };

  it('reloads the freed source, recomposes and frees it again; a failed reload rejects', async () => {
    const loaded: string[] = [];
    const unloaded: string[] = [];
    let broken = false;
    const loader: AtlasLoader = {
      meta: async () => META,
      texture: async (url) => { if (broken) throw new Error(`${url}: 404`); loaded.push(url); return Texture.EMPTY; },
      unload: async (url) => { unloaded.push(url); },
    };
    const render = vi.fn();
    const atlas = new WorldAtlas({ map, profile: 'full', webgl2: true, renderer: { render } as unknown as Renderer,
      hasFlag: () => false, loader });
    await atlas.load();
    expect(render).toHaveBeenCalledTimes(1);
    await atlas.restore();
    expect(render).toHaveBeenCalledTimes(2);
    expect(loaded).toEqual(['assets/maps/ai/overworld/mode7.png', 'assets/maps/ai/overworld/mode7.png']);
    expect(unloaded).toHaveLength(2);
    broken = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(atlas.restore()).rejects.toThrow(/404/);
    atlas.destroy();
  });
});

describe('M7-6: the fallbacks in the field', () => {
  beforeEach(() => resetStub());

  it('a lost context mid-flight shows the world; the restore brings Mode 7 back; the flight never stops', async () => {
    const f = await flightField({ mode7: 'on', fieldMode: 'airship', vehicles: [] });
    await f.idle(2);
    expect(f.report().state).toBe('flying');
    expect(stub.visible).toBe(true);
    const onContext = stub.opts?.onContext;
    expect(onContext).toBeTypeOf('function');
    onContext?.('lost');
    await f.frame();
    expect(f.report().lost).toBe(true);
    expect(stub.visible).toBe(false);
    expect(world(f).visible).toBe(true);
    expect(f.report().state).toBe('flying');           // the state is the flight's, not the view's
    await f.step('up');                                // the hero flies on, top-down, while the context is gone
    const draws = stub.draws;
    onContext?.('restored');
    await f.frame();
    expect(f.report().lost).toBe(false);
    expect(stub.visible).toBe(true);
    expect(world(f).visible).toBe(false);
    expect(stub.draws).toBe(draws + 1);
    expect(stub.destroyed).toBe(0);
  });

  it('a failed restore: one console.error, failed, the renderer freed, and the airship flies top-down', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = await flightField({ mode7: 'on', fieldMode: 'airship', vehicles: [] });
    await f.idle(2);
    stub.opts?.onContext?.('lost');
    await f.frame();
    stub.opts?.onContext?.('failed', new Error('mode7.png: 404'));
    await f.frame();
    expect(mode7Lines(error)).toHaveLength(1);
    expect(mode7Lines(error)[0]).toMatch(/could not be redrawn after the WebGL context was restored/);
    expect(f.report()).toMatchObject({ failed: true, state: 'off', profile: 'off', lost: false });
    expect(stub.destroyed).toBe(1);
    expect(world(f).visible).toBe(true);
    const before = f.game.playerPosition.y;
    await f.step('up');
    expect(f.game.playerPosition.y).toBe(before - 1);
    expect(f.game.fieldMode).toBe('airship');
    await f.idle(3);
    expect(stub.created).toBe(1);                      // failed for the session: no reload
  });

  it('the frame-time switch: p95 30 ms in steady flight goes top-down with one console.warn and frees the view', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = await flightField({ mode7: 'on', fieldMode: 'airship', vehicles: [], search: '' });   // the setting: Mode 7
    (f.game.app as unknown as { ticker: { deltaMS: number } }).ticker.deltaMS = 30;
    await f.idle(SETTLE_FRAMES + 2 * SLOW_WINDOW - 2);   // the view shows on the first: 60 settle, 120 fill, 119 over
    expect(f.report().state).toBe('flying');           // the window is not full yet
    expect(mode7Lines(warn)).toEqual([]);
    await f.frame();
    expect(mode7Lines(warn)).toHaveLength(1);
    expect(slowThisSession()).toBe(true);
    expect(stub.destroyed).toBe(1);
    expect(world(f).visible).toBe(true);
    await f.frame();
    expect(f.report()).toMatchObject({ state: 'off', profile: 'off', slow: true, failed: false });
    await f.idle(200);
    expect(mode7Lines(warn)).toHaveLength(1);
    expect(stub.created).toBe(1);
  });

  it('?mode7=1 overrides the frame-time switch: the warning says so, and the view stays', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = await flightField({ mode7: 'on', fieldMode: 'airship', vehicles: [] });
    (f.game.app as unknown as { ticker: { deltaMS: number } }).ticker.deltaMS = 30;
    await f.idle(SETTLE_FRAMES + 2 * SLOW_WINDOW + 50);
    expect(mode7Lines(warn)).toHaveLength(1);
    expect(mode7Lines(warn)[0]).toMatch(/keeps the view on/);
    expect(f.report()).toMatchObject({ state: 'flying', profile: 'full', slow: true });
    expect(stub.visible).toBe(true);
    expect(stub.destroyed).toBe(0);
  });

  it('a steady 16.7 ms flight never switches; landing-free flight frames under 20 ms stay in Mode 7', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = await flightField({ mode7: 'on', fieldMode: 'airship', vehicles: [], search: '' });
    await f.idle(400);
    expect(mode7Lines(warn)).toEqual([]);
    expect(f.report()).toMatchObject({ state: 'flying', slow: false });
  });

  it('re-choosing Mode 7 in Config clears the switch, and the next flight loads the view again', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = await flightField({ mode7: 'on', fieldMode: 'airship', vehicles: [], search: '' });
    (f.game.app as unknown as { ticker: { deltaMS: number } }).ticker.deltaMS = 30;
    await f.idle(SETTLE_FRAMES + 2 * SLOW_WINDOW + 2);
    expect(slowThisSession()).toBe(true);
    const game = { input: tapInput(), scenes: { pop: vi.fn(() => Promise.resolve()) } };
    const config = new ConfigScene(game as unknown as Game);
    config.enter();
    game.input.tap('down', () => config.update(1));
    game.input.tap('right', () => config.update(1));   // Top-down: still slow
    expect(slowThisSession()).toBe(true);
    game.input.tap('left', () => config.update(1));    // Mode 7 again: cleared
    expect(slowThisSession()).toBe(false);
    (f.game.app as unknown as { ticker: { deltaMS: number } }).ticker.deltaMS = 16.7;
    await f.frame();
    await vi.dynamicImportSettled();
    await flush();
    await f.idle(2);
    expect(stub.created).toBe(2);
    expect(f.report()).toMatchObject({ state: 'tiltIn', slow: false });   // in the air: it tilts in from top-down
    await f.idle(42);
    expect(f.report()).toMatchObject({ state: 'flying', slow: false });
    resetSettingsCache();
  });
});
