import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { DebugScenarioLoader, type DebugScenario } from '../../src/systems/DebugScenarioLoader.js';
import type { Game } from '../../src/core/Game.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function fakeGame() {
  return {
    party: { all: [] as unknown[], remove: vi.fn(), add: vi.fn(), setGold: vi.fn() },
    inventory: { clear: vi.fn(), add: vi.fn() },
    scenes: { switchTo: vi.fn() },
    currentMapId: '',
    playerPosition: { x: 0, y: 0 },
  };
}

const field: DebugScenario = {
  id: 'f', name: 'f', mode: 'field', map: 'cornelia', spawn: [13, 13], party: [], items: {}, gold: 7, enemies: [],
};

describe('DebugScenarioLoader field mode', () => {
  it('drops the party onto the map at the spawn tile and opens exploration', async () => {
    const game = fakeGame();
    await new DebugScenarioLoader(game as unknown as Game).run(field);
    expect(game.currentMapId).toBe('cornelia');
    expect(game.playerPosition).toEqual({ x: 13, y: 13 });
    expect(game.party.setGold).toHaveBeenCalledWith(7);
    expect(game.scenes.switchTo).toHaveBeenCalledWith('exploration');
  });

  it('rejects a field scenario without map or spawn', async () => {
    const game = fakeGame();
    await expect(new DebugScenarioLoader(game as unknown as Game).run({ ...field, spawn: undefined })).rejects.toThrow(/map and spawn/);
  });

  it('every field scenario in debug-scenarios.yaml spawns on a walkable tile', () => {
    const scenarios = parse(readFileSync(resolve(root, 'assets/data/debug-scenarios.yaml'), 'utf-8')) as DebugScenario[];
    const fields = scenarios.filter((s) => s.mode === 'field');
    expect(fields.length).toBeGreaterThan(0);
    for (const s of fields) {
      const map = parse(readFileSync(resolve(root, `assets/maps/${s.map}.yaml`), 'utf-8')) as { width: number; collision: number[] };
      const [x, y] = s.spawn!;
      expect(map.collision[y * map.width + x], `${s.id} spawn`).toBe(0);
    }
  });
});
