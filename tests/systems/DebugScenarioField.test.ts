import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
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
    resetState: vi.fn(),
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

  it('an entrance scenario hands the entrance name to exploration', async () => {
    const game = { ...fakeGame(), pendingEntrance: null as string | null };
    await new DebugScenarioLoader(game as unknown as Game).run({ ...field, spawn: undefined, entrance: 'south_gate' });
    expect(game.pendingEntrance).toBe('south_gate');
    expect(game.scenes.switchTo).toHaveBeenCalledWith('exploration');
  });

  it('every field scenario in debug-scenarios.yaml spawns on a walkable tile', () => {
    const scenarios = parse(readFileSync(resolve(root, 'assets/data/debug-scenarios.yaml'), 'utf-8')) as DebugScenario[];
    const fields = scenarios.filter((s) => s.mode === 'field');
    expect(fields.length).toBeGreaterThan(0);
    for (const s of fields) {
      const variants = [`assets/maps/${s.map}.yaml`, `assets/maps/ai/${s.map}.yaml`].filter((f) => existsSync(resolve(root, f)));
      expect(variants.length, `${s.id}: map ${s.map} exists`).toBeGreaterThan(0);
      for (const f of variants) {
        const map = parse(readFileSync(resolve(root, f), 'utf-8')) as
          { width: number; collision: number[]; entrances?: Record<string, [number, number]> };
        if (s.entrance && !map.entrances?.[s.entrance]) throw new Error(`${s.id}: ${f} has no entrance ${s.entrance}`);
        const [x, y] = s.entrance ? map.entrances![s.entrance] : s.spawn!;
        expect([1, 2], `${s.id} spawn in ${f}`).not.toContain(map.collision[y * map.width + x]);
      }
    }
  });

  it('T5: a member may start hurt or fallen (hp), the rest at full HP', async () => {
    const { ClassRegistry } = await import('../../src/data/ClassRegistry.js');
    const { PartyManager } = await import('../../src/entities/PartyManager.js');
    const { Inventory } = await import('../../src/entities/Inventory.js');
    const { testClass } = await import('../helpers/testUtils.js');
    ClassRegistry.reset();
    await ClassRegistry.init({ loadClasses: async () => [testClass('warrior')] } as never);
    const party = new PartyManager();
    const game = { ...fakeGame(), party, inventory: new Inventory(), pendingEntrance: null as string | null };
    const member = { class: 'warrior', level: 1, equipment: [], spells: [] };
    await new DebugScenarioLoader(game as unknown as Game).run({
      ...field, party: [{ ...member, name: 'A', hp: 0 }, { ...member, name: 'B', hp: 7 }, { ...member, name: 'C' }],
    });
    expect(party.all.map((c) => c.currentHp)).toEqual([0, 7, party.all[2].maxHp]);
  });
});
