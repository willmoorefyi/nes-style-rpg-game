/** T3e: inspect cells (a tomb, a sign) show their text when the hero faces one and presses confirm. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import { DialogManager } from '../../src/systems/DialogManager.js';
import { inspectAt } from '../../src/scenes/exploration/FieldInspect.js';
import type { Game } from '../../src/core/Game.js';
import type { MapData } from '../../src/types/index.js';
import { createMockGame, createMapData } from '../helpers/testUtils.js';

/** Controls hint already seen (it would swallow the first inputs). */
const store: Record<string, string> = { ff1_controlsSeen: 'true' };
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; }, clear: () => {},
});

afterEach(() => { vi.restoreAllMocks(); });

describe('inspectAt', () => {
  const map: Pick<MapData, 'inspect'> = {
    inspect: [
      { x: 2, y: 3, text: ['Here lies Erdrick.'] },
      { x: 4, y: 4, text: [{ condition: 'BRIDGE_BUILT', text: ['The bridge is open.'] }, { text: ['Keep out.'] }] },
      { x: 6, y: 6, text: [{ condition: 'NEVER', text: ['Hidden.'] }] },
    ],
  };
  const none = () => false;

  it('returns the lines of the cell, or null where there is none', () => {
    expect(inspectAt(map, 2, 3, none)).toEqual(['Here lies Erdrick.']);
    expect(inspectAt(map, 3, 2, none)).toBeNull();
    expect(inspectAt({}, 2, 3, none)).toBeNull();
  });

  it('resolves conditional text like NPC dialog', () => {
    expect(inspectAt(map, 4, 4, none)).toEqual(['Keep out.']);
    expect(inspectAt(map, 4, 4, (f) => f === 'BRIDGE_BUILT')).toEqual(['The bridge is open.']);
    expect(inspectAt(map, 6, 6, none)).toBeNull();     // no match and no default: nothing to show
  });
});

describe('ExplorationScene inspect cells', () => {
  /** The hero stands at (5, 5) and faces down, toward (5, 6). */
  async function confirmAt(map: MapData) {
    const start = vi.spyOn(DialogManager.prototype, 'start').mockImplementation(() => {});
    const base = createMockGame(map);
    const pressed = new Set<string>();
    const game = {
      ...base,
      input: { ...base.input, isJustPressed: vi.fn((a: string) => pressed.has(a)), isPressed: vi.fn(() => false) },
    };
    game.currentMapId = map.id;
    game.playerPosition = { x: 5, y: 5 };
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    start.mockClear();
    pressed.add('confirm');
    scene.update(1);
    return start;
  }

  it('facing an inspect cell and pressing confirm shows its text', async () => {
    const map = createMapData({ id: 'tomb', width: 10, height: 10, inspect: [{ x: 5, y: 6, text: ['Here lies Erdrick.'] }] });
    const start = await confirmAt(map);
    expect(start).toHaveBeenCalledWith(['Here lies Erdrick.']);
  });

  it('facing away from the cell does nothing', async () => {
    const map = createMapData({ id: 'tomb', width: 10, height: 10, inspect: [{ x: 5, y: 4, text: ['Here lies Erdrick.'] }] });
    const start = await confirmAt(map);
    expect(start).not.toHaveBeenCalled();
  });

  it('an NPC standing on the cell wins', async () => {
    const map = createMapData({
      id: 'tomb', width: 10, height: 10,
      npcs: [{ id: 'monk', x: 5, y: 6, sprite: 'mage', dialog: ['Pray with me.'] }],
      inspect: [{ x: 5, y: 6, text: ['Here lies Erdrick.'] }],
    });
    const start = await confirmAt(map);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(['Pray with me.']);
  });
});
