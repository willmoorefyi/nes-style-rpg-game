import { describe, it, expect, afterEach, vi } from 'vitest';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import type { Game } from '../../src/core/Game.js';
import { createMockGame, createMapData } from '../helpers/testUtils.js';
import { EventBus } from '../../src/core/EventBus.js';
import type { FieldMode, VehicleState } from '../../src/types/index.js';

/**
 * P3-R1 (docs/PLAYTEST_RECHECK_PLAY_R.md): loading `w_s18_start` in a fresh browser, the first confirm over grass
 * did not land the airship. The controls hint of a first run swallowed that press; now any key dismisses the hint
 * and still acts on the same frame.
 */
async function airshipField(hintSeen: boolean) {
  const store: Record<string, string> = hintSeen ? { ff1_controlsSeen: 'true' } : {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  });
  const map = createMapData({ id: 'overworld', width: 10, height: 10 }); // collision 0 everywhere: grass
  const game = {
    ...createMockGame(map), events: new EventBus(), currentMapId: 'overworld', playerPosition: { x: 5, y: 5 },
    fieldMode: 'airship' as FieldMode, vehicles: [] as VehicleState[],
  };
  const scene = new ExplorationScene(game as unknown as Game);
  await scene.enter();
  return { game, scene, store };
}

describe('P3-R1: the first confirm lands the airship', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  for (const hintSeen of [false, true]) {
    it(`one confirm press over grass lands (controls hint ${hintSeen ? 'seen before' : 'showing: first run'})`, async () => {
      const { game, scene, store } = await airshipField(hintSeen);
      for (let i = 0; i < 30; i++) scene.update(1);              // the player waits; the hint (if any) stays up
      expect(game.fieldMode).toBe('airship');
      game.input.isJustPressed.mockImplementation((a: string) => a === 'confirm');
      scene.update(1);                                            // exactly one frame with the press
      game.input.isJustPressed.mockReturnValue(false);
      expect(game.fieldMode).toBe('walking');
      expect(game.vehicles).toContainEqual({ type: 'airship', map: 'overworld', x: 5, y: 5 });
      expect(store.ff1_controlsSeen).toBe('true');               // and the hint is gone for good
    });
  }
});
