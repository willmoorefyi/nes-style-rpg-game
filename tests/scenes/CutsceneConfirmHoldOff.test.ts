/**
 * U12 review: a field cutscene's dialog steps take confirm at once; the 24-frame confirm hold-off comes once, when
 * the cutscene ends, so mashing through the act1_complete ending does not talk to the King again.
 * Real InputManager (on a stand-in window), real dialog box, real act1_complete script; fades run on a frame clock.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import { DialogManager } from '../../src/systems/DialogManager.js';
import { InputManager } from '../../src/core/InputManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { CutsceneRegistry } from '../../src/systems/CutsceneRegistry.js';
import type { CutsceneScript } from '../../src/systems/CutsceneManager.js';
import type { Game } from '../../src/core/Game.js';
import { createMockGame, createMapData } from '../helpers/testUtils.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const realCutscenes = parse(readFileSync(join(root, 'assets/data/cutscenes.yaml'), 'utf-8')) as
  Array<{ id: string; steps: CutsceneScript }>;
const AFTER = 'Builders at work.';

describe('U12 review: confirm hold-off around a field cutscene', () => {
  let input: InputManager;
  let win: EventTarget;
  let now = 0;
  let rafQueue: FrameRequestCallback[] = [];

  beforeEach(() => {
    win = new EventTarget();
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k === 'ff1_controlsSeen' ? 'true' : null), setItem: () => {}, removeItem: () => {},
    });
    now = 0;
    rafQueue = [];
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { rafQueue.push(cb); return rafQueue.length; });
    CutsceneRegistry.clear();
    for (const c of realCutscenes) CutsceneRegistry.register(c.id, c.steps);
    input = new InputManager();
    input.attach();
  });
  afterEach(() => { input.detach(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  const keyDown = (): void => { win.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyZ', repeat: false })); };
  const keyUp = (): void => { win.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyZ', repeat: false })); };

  async function setup() {
    const map = createMapData({
      id: 'cornelia-castle-2f', width: 10, height: 10,
      npcs: [{ id: 'king', x: 5, y: 6, sprite: 'king',
        dialog: [{ condition: 'INTRO_COMPLETE', text: [AFTER] }, { condition: 'PRINCESS_RESCUED', text: ['Thank you!'] }],
        cutscene: { id: 'act1_complete', requiredFlag: 'PRINCESS_RESCUED', onceFlag: 'INTRO_COMPLETE' } }],
    });
    const game = { ...createMockGame(map), events: new EventBus(), input, currentMapId: 'cornelia-castle-2f',
      playerPosition: { x: 5, y: 5 } };                               // the King is just below; the hero faces down
    game.gameFlags.set('PRINCESS_RESCUED');
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    const start = vi.spyOn(DialogManager.prototype, 'start');
    const play = vi.spyOn(ExplorationScene.prototype, 'playCutscene');
    /** One 60 fps frame: the scene, the input tick, then the animation frames and the promise work they release. */
    const frame = async (): Promise<void> => {
      scene.update(1);
      input.update();
      now += 1000 / 60;
      const due = rafQueue;
      rafQueue = [];
      for (const cb of due) cb(now);
      for (let i = 0; i < 5; i++) await Promise.resolve();
    };
    const tap = async (): Promise<void> => { keyDown(); keyUp(); await frame(); };
    const talksAfter = (): number => start.mock.calls.filter(([lines]) => lines[0] === AFTER).length;
    return { game, start, play, frame, tap, talksAfter };
  }

  it('consecutive cutscene dialog steps take confirm at once; the hold-off comes once, when the cutscene ends', async () => {
    const { play, start, frame, tap } = await setup();
    await tap();                                                       // talk to the King
    for (let i = 0; i < 30 && play.mock.calls.length === 0; i++) await tap();   // reveal and close 'Thank you!'
    expect(play).toHaveBeenCalledTimes(1);
    let ended = false;
    void (play.mock.results[0].value as Promise<void>).then(() => { ended = true; });
    const holdOff = vi.spyOn(input, 'holdOff');
    let shown = start.mock.calls.length;
    let checked = 0;
    for (let i = 0; i < 400 && !ended; i++) {
      if (start.mock.calls.length > shown) {
        shown = start.mock.calls.length;
        if (shown > 2) {                                               // a cutscene line after another one
          keyDown();
          expect(input.isJustPressed('confirm')).toBe(true);
          keyUp();
          checked++;
          await frame();
          continue;
        }
      }
      if (start.mock.calls.length > 1) await tap(); else await frame();
    }
    expect(ended).toBe(true);
    expect(checked).toBe(2);                                           // lines 2 and 3 of the ending
    expect(holdOff).toHaveBeenCalledTimes(1);
    expect(holdOff).toHaveBeenCalledWith(24, ['confirm']);
  });

  it('after the act1_complete ending, mashing confirm for 20 frames does not talk to the King; a later press does', async () => {
    const { game, play, frame, tap, talksAfter } = await setup();
    await tap();
    for (let i = 0; i < 30 && play.mock.calls.length === 0; i++) await tap();
    let ended = false;
    void (play.mock.results[0].value as Promise<void>).then(() => { ended = true; });
    for (let i = 0; i < 400 && !ended; i++) await tap();                // mash through the whole ending
    expect(ended).toBe(true);
    expect(game.gameFlags.has('INTRO_COMPLETE')).toBe(true);
    for (let i = 0; i < 20; i++) await tap();
    expect(talksAfter()).toBe(0);                                      // the mash talked to nobody
    for (let i = 0; i < 5; i++) await frame();
    await tap();
    expect(talksAfter()).toBe(1);                                      // a deliberate press later talks again
  });
});
