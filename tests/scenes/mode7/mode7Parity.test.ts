import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { CANT_LAND } from '../../../src/scenes/exploration/FieldVehicles.js';
import { MISS_HOLD_FRAMES } from '../../../src/rendering/chunkStreaming.js';
import type { MapData } from '../../../src/types/index.js';
import { deferred, flightField, flush, resetStub, stub, type Mode7Setup } from './flightHarness.js';

vi.mock('../../../src/scenes/exploration/mode7/FlightRenderer.js', async () => (await import('./flightHarness.js')).rendererModule);

/**
 * M7-2 parity (docs/MODE7_PLAN.md 9): the same inputs with Mode 7 on and off give the same position, mode, vehicles,
 * flags, dialog lines and encounters. The script: take-off, 20 steps, a confirm over forest (CANT_LAND), 5 steps, a
 * landing. M7-4: with Mode 7 on, each tilt holds the field for 42 frames (700 ms, the one behavioural change of 0):
 * the hero does not move through them, even with a direction held, and the end state is the same.
 */
type Run = Awaited<ReturnType<typeof flightField>>;

/** Frames while a tilt plays (`busy`), with `held` pressed; asserts the hero never moves. Returns how many. */
async function throughTilt(f: Run, held: string | null = null): Promise<number> {
  const at = { ...f.game.playerPosition };
  let n = 0;
  f.keys.held = held;
  while (f.report().busy === true) {
    await f.frame();
    expect(f.game.playerPosition).toEqual(at);
    n++;
  }
  f.keys.held = null;
  return n;
}

interface Played { tilts: number[]; right: number[] }

async function script(f: Run, between: { afterTakeoff?: () => void; duringStep?: (i: number) => Promise<void> } = {}):
  Promise<Played> {
  const tilts: number[] = [];
  await f.idle(2);
  await f.confirm();                                   // take off from the parked airship at (6, 20)
  await f.idle(1);
  between.afterTakeoff?.();
  tilts.push(await throughTilt(f, 'up'));              // a held direction waits for the tilt
  for (let i = 0; i < 10; i++) {
    if (between.duringStep) {
      f.keys.held = 'up';
      await f.frame();
      f.keys.held = null;
      await between.duringStep(i);
      while (f.game.playerPosition.y !== 19 - i) await f.frame();
    } else {
      await f.step('up');
    }
  }
  const right = await f.steps('right', 10);            // (16, 10): forest
  await f.idle(1);
  await f.confirm();                                   // CANT_LAND
  await f.closeDialog();
  await f.steps('right', 3);
  await f.steps('down', 2);                            // (19, 12): grass
  await f.idle(1);
  await f.confirm();                                   // land
  await f.idle(1);
  tilts.push(await throughTilt(f));
  await f.idle(2);
  return { tilts, right };
}

/** Every idle flight frame: the shadow's cell is the hero's cell (6). */
function watchShadow(f: Run): { checked: number } {
  const seen = { checked: 0 };
  f.setOnFrame(() => {
    const r = f.report();
    if ((r.state === 'flying' || r.busy === true) && r.shadowCell) {
      const c = r.shadowCell as { x: number; y: number };
      const p = f.game.playerPosition;
      // between steps the hero is idle; mid-step the shadow is on the origin or the target cell
      expect(Math.abs(c.x - p.x) + Math.abs(c.y - p.y)).toBeLessThanOrEqual(1);
      seen.checked++;
    }
  });
  return seen;
}

async function run(mode7: Mode7Setup, map?: MapData) {
  const f = await flightField({ mode7, map });
  const played = await script(f);
  return Object.assign(f, { played });
}

describe('M7-2: parity, Mode 7 on and off', () => {
  beforeEach(() => resetStub());
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('the same inputs give the same end state; the hero landed at (19, 12) after one CANT_LAND', async () => {
    const off = await run('off');
    const on = await flightField({ mode7: 'on' });
    const error = vi.spyOn(console, 'error');           // FlightView logs an idle shadow / hero mismatch
    const seen = watchShadow(on);
    let shownAfterTakeoff = false;
    const played = await script(on, { afterTakeoff: () => { shownAfterTakeoff = stub.visible; } });
    const { frames: offFrames, ...offEnd } = off.outcome();
    const { frames: onFrames, ...onEnd } = on.outcome();
    expect(offEnd).toEqual(onEnd);
    expect(played.tilts).toEqual([42, 42]);             // 700 ms each, the hero still through both
    expect(off.played.tilts).toEqual([0, 0]);
    // the only difference: the two holds of 42 frames each (the tilt's first frame plus 41); the 'up' held through the
    // take-off steps on the frame the tilt ends, as after a dialog, so its step has already begun there: 42 + 42 - 1
    expect(onFrames - offFrames).toBe(83);
    expect(played.right).toEqual(off.played.right);
    expect(on.outcome().playerPosition).toEqual({ x: 19, y: 12 });
    expect(on.outcome().fieldMode).toBe('walking');
    expect(on.outcome().dialogs).toEqual([CANT_LAND]);
    expect(on.outcome().vehicles).toEqual([{ type: 'airship', map: 'overworld', x: 19, y: 12 }]);
    expect(on.outcome().battles).toBe(0);
    expect(shownAfterTakeoff).toBe(true);
    expect(seen.checked).toBeGreaterThan(100);
    expect(error).not.toHaveBeenCalled();
    expect(stub.visible).toBe(false);                  // landed: top-down again
    expect(on.report().history).toEqual(['off', 'tiltIn', 'flying', 'tiltOut', 'off']);
    expect(off.report().history).toEqual(['off']);
    expect(stub.created).toBe(1);
  });

  it('a run with no renderer (every older scene test) matches too', async () => {
    const none = await run('none');
    const off = await run('off');
    expect(none.outcome()).toEqual(off.outcome());
    expect(none.played).toEqual(off.played);
  });

  it('the landing marker shows over grass and not over the forest; the frame follows the hero', async () => {
    const on = await flightField({ mode7: 'on' });
    await on.idle(1);
    await on.confirm();
    await on.idle(1);
    for (let i = 0; i < 42; i++) {                     // no marker while the tilt plays
      expect(on.report().busy).toBe(true);
      expect(on.report().marker).toBe(false);
      expect(stub.last?.marker).toBeNull();
      await on.frame();
    }
    await on.idle(1);
    expect(on.report().state).toBe('flying');
    expect(on.report().marker).toBe(true);
    expect(stub.last?.marker).toHaveLength(4);
    expect(stub.last?.view.px).toBeCloseTo(6.5);
    expect(stub.last?.view.py).toBeCloseTo(20.5);
    expect(stub.last?.ship.x).toBe(960);
    await on.steps('up', 10);
    await on.steps('right', 10);
    await on.idle(1);
    expect(on.game.playerPosition).toEqual({ x: 16, y: 10 });
    expect(on.report().marker).toBe(false);
    expect(stub.last?.marker).toBeNull();
    expect(on.report().shadowCell).toEqual({ x: 16, y: 10 });
  });

  it('the loading variant: take-off before the atlas is ready flies top-down; ready during step 10, Mode 7 on the next idle frame', async () => {
    const off = await run('off');
    stub.gate = deferred();
    const on = await flightField({ mode7: 'on' });
    const states: string[] = [];
    const played = await script(on, {
      afterTakeoff: () => {
        expect(on.report().state).toBe('loading');
        expect(on.report().reason).toBe('takeoff');
        expect(on.report().busy).toBe(false);
      },
      duringStep: async (i) => {
        if (i === 9) {
          stub.gate?.resolve();
          await flush();
          await on.frame();                              // still mid-step: ready, but no Mode 7 yet
          expect(on.report().ready).toBe(true);
          expect(on.game.playerPosition.y).toBe(20 - i);
          states.push(on.report().state as string);
          while (on.game.playerPosition.y !== 19 - i) {
            await on.frame();
            states.push(on.report().state as string);
          }
          await on.frame();
          states.push(on.report().state as string);
        } else {
          expect(on.report().state).toBe('loading');
        }
      },
    });
    const { frames: _a, ...offEnd } = off.outcome();   // the variant's script spends its frames differently
    const { frames: _b, ...onEnd } = on.outcome();
    expect(onEnd).toEqual(offEnd);
    expect(states.slice(0, -1).every((s) => s === 'loading')).toBe(true);  // never mid-step
    expect(states[states.length - 1]).toBe('tiltIn');      // the first idle frame after the ready: the tilt begins
    expect(played.tilts).toEqual([0, 42]);                // the take-off flew top-down; the landing tilts out
    // the held direction (0): the next step east waited out the 42-frame tilt (it began on that idle frame), then went
    expect(played.right[0]).toBe(played.right[1] + 41);
    expect(off.played.right[0]).toBe(off.played.right[1]);
    expect(on.report().history).toEqual(['off', 'loading', 'tiltIn', 'flying', 'tiltOut', 'off']);
  });
});

describe('M7-2 / M7-3: parity on a streamed world (192x192, late chunks on the route)', () => {
  beforeEach(() => resetStub());
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  /** A 192x192 grass world in 144 chunks: `StreamedCollisionMap` holds a step while the view there is missing. */
  function streamedWorld(): MapData {
    const at = (i: number): string => `assets/maps/ai/overworld/below_${Math.floor(i / 12)}_${i % 12}.png`;
    return {
      id: 'overworld', width: 192, height: 192, layers: [], tilesets: [], collision: new Array(192 * 192).fill(0),
      npcs: [], transitions: [],
      art: { tile: 48, chunk: 16, below: Array.from({ length: 144 }, (_, i) => at(i)), above: Array(144).fill(null) },
    };
  }

  /** Chunk loads resolve a frame after they start, except those of rows 0-4 (north of the route's start): never. */
  function fakeChunks() {
    const original = Assets.load.bind(Assets);
    const pending: Array<{ url: string; resolve: (t: Texture) => void }> = [];
    vi.spyOn(Assets, 'unload').mockResolvedValue(undefined);
    vi.spyOn(Assets, 'load').mockImplementation(((url: string) => {
      const m = /below_(\d+)_\d+\.png$/.exec(String(url));
      if (!m) return original(url);
      return new Promise<Texture>((resolve) => { if (Number(m[1]) > 4) pending.push({ url, resolve }); });
    }) as typeof Assets.load);
    return { tick: () => { for (const p of pending.splice(0)) p.resolve(Texture.EMPTY); } };
  }

  async function streamedRun(mode7: Mode7Setup) {
    const chunks = fakeChunks();
    const f = await flightField({ mode7, map: streamedWorld(), start: { x: 100, y: 100 } });
    f.setOnFrame(async () => { chunks.tick(); await flush(); });
    await f.idle(4);
    await f.confirm();
    await f.idle(1);
    let tilted = await throughTilt(f);
    const perStep = await f.steps('up', 20);
    await f.idle(1);
    await f.confirm();
    await f.idle(1);
    tilted += await throughTilt(f);
    await f.idle(1);
    vi.restoreAllMocks();
    return { f, perStep, tilted };
  }

  it('in both modes a held step waits at most MISS_HOLD_FRAMES, then goes on; the end state is equal', async () => {
    const off = await streamedRun('off');
    const on = await streamedRun('on');
    const { frames: offFrames, ...offEnd } = off.f.outcome();
    const { frames: onFrames, ...onEnd } = on.f.outcome();
    expect(onEnd).toEqual(offEnd);
    expect(on.f.game.playerPosition).toEqual({ x: 100, y: 80 });
    expect(on.f.game.fieldMode).toBe('walking');
    const base = Math.min(...off.perStep);
    expect(Math.min(...on.perStep)).toBe(base);
    const held = (per: number[]): number[] => per.flatMap((n, i) => (n > base ? [i] : []));
    for (const per of [off.perStep, on.perStep]) {
      expect(Math.max(...per)).toBeLessThanOrEqual(base + MISS_HOLD_FRAMES + 1);   // at most one hold per miss
    }
    // M7-3 (D-M11): in flight the hold reads the flight window, which reaches farther north than the top-down view:
    // top-down holds once, as chunk row 4 enters the view (step 9); the flight window (4x4 chunks, the ship 24 or more
    // cells from its edges, plus 1 ahead) holds at the take-off's first step (row 4) and again at step 13 (row 3)
    expect(held(off.perStep)).toEqual([8]);
    expect(held(on.perStep)).toEqual([0, 12]);
    expect(off.tilted).toBe(0);
    expect(on.tilted).toBe(84);
    expect(onFrames - offFrames - on.tilted).toBe(on.perStep.reduce((a, n) => a + n, 0) - off.perStep.reduce((a, n) => a + n, 0));
  });
});
