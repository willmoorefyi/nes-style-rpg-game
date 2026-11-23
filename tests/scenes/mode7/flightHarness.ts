/**
 * The Mode 7 scene tests' harness (docs/MODE7_PLAN.md 9): an `ExplorationScene` over `createMockGame` on an
 * `overworld` map, driven frame by frame with a scripted input, with Mode 7 forced on (`?mode7=1`, a stub WebGL2
 * renderer on the app) or off (`?mode7=0`, or no renderer at all, as every older scene test has). The Pixi part,
 * `FlightRenderer`, is replaced by `rendererModule` through `vi.mock` in each test file: a stub that records its calls
 * and whose load resolves, waits on `stub.gate`, or rejects.
 */
import { vi } from 'vitest';
import { Container } from 'pixi.js';
import { ExplorationScene } from '../../../src/scenes/ExplorationScene.js';
import { DialogBox } from '../../../src/ui/DialogBox.js';
import { EventBus } from '../../../src/core/EventBus.js';
import { SETTINGS_KEY, resetSettingsCache, type AirshipView } from '../../../src/core/Settings.js';
import type { Game } from '../../../src/core/Game.js';
import type { FieldMode, MapData, VehicleState } from '../../../src/types/index.js';
import type { FlightFrame, FlightRendererOptions } from '../../../src/scenes/exploration/mode7/FlightRenderer.js';
import { createMapData, createMockGame } from '../../helpers/testUtils.js';

export interface Deferred { promise: Promise<void>; resolve: () => void; reject: (e: unknown) => void }

export function deferred(): Deferred {
  let resolve = (): void => {};
  let reject = (_e: unknown): void => {};
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** What the stub renderer saw. */
export const stub = {
  created: 0, destroyed: 0, draws: 0, visible: false,
  last: null as FlightFrame | null, opts: null as FlightRendererOptions | null,
  /** When set, `load` waits on it; `fail` makes it reject (an Error: with that error, WR's atlas guard). */
  gate: null as Deferred | null, fail: false as boolean | Error,
};

export function resetStub(): void {
  Object.assign(stub, { created: 0, destroyed: 0, draws: 0, visible: false, last: null, opts: null, gate: null, fail: false });
  rendererModule.createFlightRenderer.mockClear();
}

export const rendererModule = {
  createFlightRenderer: vi.fn((opts: FlightRendererOptions) => {
    stub.created++;
    stub.opts = opts;
    return {
      load: () => (stub.fail ? Promise.reject(stub.fail instanceof Error ? stub.fail : new Error('mode7.json: 404'))
        : stub.gate?.promise ?? Promise.resolve()),
      setVisible: (v: boolean) => { stub.visible = v; },
      draw: (f: FlightFrame) => { stub.draws++; stub.last = f; },
      destroy: () => { stub.destroyed++; },
      textures: null,
    };
  }),
};

/** A stub WebGL2 context: `capsOf` reads it as `full`. */
export function stubGl() {
  return {
    VERSION: 0x1f02, MAX_TEXTURE_SIZE: 0x0d33, RENDERER: 0x1f01,
    getParameter: (p: number) => ({ 0x1f02: 'WebGL 2.0', 0x0d33: 16384, 0x1f01: 'stub' } as Record<number, unknown>)[p],
    getExtension: () => null,
  };
}

/** The field map: 24x24 grass with a forest strip at x 16, y 8-12 (the refused landing). */
export function flightMap(overrides: Partial<MapData> = {}): MapData {
  const width = overrides.width ?? 24;
  const height = overrides.height ?? 24;
  const collision = Array(width * height).fill(0);
  for (let y = 8; y <= 12; y++) collision[y * width + 16] = 4;
  return createMapData({ id: 'overworld', width, height, collision, ...overrides });
}

export type Mode7Setup = 'on' | 'off' | 'none';

export interface FieldOptions {
  mode7: Mode7Setup;
  map?: MapData;
  start?: { x: number; y: number };
  fieldMode?: FieldMode;
  vehicles?: VehicleState[];
  /** Overrides the URL the setup implies (e.g. '' to let the setting decide). */
  search?: string;
  /** The stored airship view setting (none stored: the default). */
  view?: AirshipView;
}

export async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** A field with Mode 7 on, off (`?mode7=0`) or with no renderer (`none`), and a driver for it. */
export async function flightField(opts: FieldOptions) {
  resetSettingsCache();
  const store: Record<string, string> = { ff1_controlsSeen: 'true' };
  if (opts.view) store[SETTINGS_KEY] = JSON.stringify({ messageSpeed: 3, airshipView: opts.view });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  });
  vi.stubGlobal('location', { search: opts.search ?? (opts.mode7 === 'on' ? '?mode7=1' : opts.mode7 === 'off' ? '?mode7=0' : '') });
  const map = opts.map ?? flightMap();
  const start = opts.start ?? { x: 6, y: 20 };
  const base = createMockGame(map);
  const app = opts.mode7 === 'none' ? base.app : { stage: new Container(), renderer: { gl: stubGl(), render: vi.fn() }, ticker: { deltaMS: 16.7 } };
  const game = {
    ...base, app, events: new EventBus(), currentMapId: 'overworld', playerPosition: { ...start },
    fieldMode: opts.fieldMode ?? ('walking' as FieldMode),
    vehicles: opts.vehicles ?? [{ type: 'airship', map: 'overworld', ...start }] as VehicleState[],
  };
  const dialogs: string[] = [];
  game.events.on('showDialog', (d: { text: string }) => { dialogs.push(d.text); });
  const keys = { held: null as string | null, just: null as string | null };
  game.input.isPressed.mockImplementation((a: string) => a === keys.held);
  game.input.isJustPressed.mockImplementation((a: string) => a === keys.just);
  const scene = new ExplorationScene(game as unknown as Game);
  await scene.enter();
  await vi.dynamicImportSettled();
  await flush();
  const rep = (globalThis as Record<string, unknown>).__mode7 as Record<string, unknown>;
  const dialogBox = scene.container.children.find((c): c is DialogBox => c instanceof DialogBox);
  /** This scene's `window.__mode7` (a later scene replaces the global). */
  const report = (): Record<string, unknown> => rep;
  const pos = (): string => `${game.playerPosition.x},${game.playerPosition.y}`;
  let frames = 0;
  /** Called after every frame (the tests' per-frame checks). */
  let onFrame: () => Promise<void> | void = () => {};

  const frame = async (): Promise<void> => {
    scene.update(1);
    keys.just = null;
    frames++;
    await onFrame();
  };
  const confirm = async (): Promise<void> => { keys.just = 'confirm'; await frame(); };
  /** One cell: the direction held until the hero's cell changes (a held step waits; at most `guard` frames). The
   *  frame a step ends never starts the next one, so releasing then takes exactly one step. */
  const step = async (dir: 'up' | 'down' | 'left' | 'right', guard = 80): Promise<number> => {
    const before = pos();
    keys.held = dir;
    let n = 0;
    do { await frame(); n++; } while (pos() === before && n < guard);
    keys.held = null;
    return n;
  };
  const steps = async (dir: 'up' | 'down' | 'left' | 'right', count: number): Promise<number[]> => {
    const out: number[] = [];
    for (let i = 0; i < count; i++) out.push(await step(dir));
    return out;
  };
  /** Confirm every 4th frame until the dialog box is closed, then the close hold-off's frames. */
  const closeDialog = async (): Promise<void> => {
    for (let i = 0; i < 200 && dialogBox?.visible; i++) {
      if (i % 4 === 0) keys.just = 'confirm';
      await frame();
    }
    for (let i = 0; i < 30; i++) await frame();
  };
  const idle = async (n: number): Promise<void> => { for (let i = 0; i < n; i++) await frame(); };

  /** Everything the parity tests compare. */
  const outcome = () => ({
    playerPosition: { ...game.playerPosition }, fieldMode: game.fieldMode, vehicles: game.vehicles,
    flags: game.gameFlags.getAll(), dialogs: [...dialogs], battles: game.scenes.push.mock.calls.length
      + game.scenes.switchTo.mock.calls.length, frames,
  });

  return {
    game, scene, dialogs, keys, report, frame, confirm, step, steps, closeDialog, idle, outcome,
    get frames() { return frames; },
    setOnFrame(f: () => Promise<void> | void) { onFrame = f; },
    get dialogOpen() { return !!dialogBox?.visible; },
  };
}
