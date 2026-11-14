import { describe, it, expect, beforeAll, vi } from 'vitest';
import { FieldOrderScene } from '../../src/scenes/FieldOrderScene.js';
import type { Game } from '../../src/core/Game.js';
import { Character } from '../../src/entities/Character.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { loadRealRegistries, tapInput } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

function open() {
  const party = new PartyManager();
  for (const [name, cls] of [['A', 'warrior'], ['B', 'thief'], ['C', 'white_mage'], ['D', 'black_mage']]) {
    party.add(new Character({ name, classData: ClassRegistry.getClass(cls)! }));
  }
  const input = tapInput();
  const scene = new FieldOrderScene({ party, input, scenes: { pop: vi.fn() } } as unknown as Game);
  scene.enter();
  const tap = (a: Parameters<typeof input.tap>[0]): void => input.tap(a, () => scene.update(1));
  return { scene, tap, party };
}

describe('E10: the Order cursor stays where the player picked', () => {
  it('stays on the first pick, then on the second pick after the swap', () => {
    const { scene, tap, party } = open();
    tap('down');
    tap('down');
    tap('confirm'); // pick C
    expect(scene.cursorIndex).toBe(2);
    tap('down');
    tap('confirm'); // swap with D
    expect(party.all.map((c) => c.name)).toEqual(['A', 'B', 'D', 'C']);
    expect(scene.cursorIndex).toBe(3);
  });

  it('cancelling the second pick puts the cursor back on the first', () => {
    const { scene, tap } = open();
    tap('down');
    tap('down');
    tap('confirm');
    tap('up');
    tap('cancel');
    expect(scene.cursorIndex).toBe(2);
  });
});
