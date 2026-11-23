import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { DebugScenarioLoader, type DebugScenario } from '../../src/systems/DebugScenarioLoader.js';
import type { Game } from '../../src/core/Game.js';
import { isKnownFlag } from '../../src/core/GameFlags.js';
import type { MapData } from '../../src/types/index.js';

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

  // NW-1 (docs/NATURAL_WORLD_PLAN.md 5.2): a spot spawn and a vehicle's spot become cells when the scenario starts
  const spotData = {
    loadMapManifest: vi.fn(async () => [] as string[]),
    loadMap: vi.fn(async (path: string) => ({ id: path.includes('cave') ? 'cave' : 'overworld',
      spots: path.includes('cave') ? {} : {
        t_s_meadow: { at: [5, 6], kind: 'land' }, t_s_quay: { at: [7, 8], kind: 'dock' },
        t_s_field: { at: [9, 2], kind: 'landing' } } }) as unknown as MapData),
  };
  const atSpot: DebugScenario = { ...field, map: 'overworld', spawn: undefined, spot: 't_s_meadow',
    vehicles: [{ type: 'ship', map: 'overworld', at: 't_s_quay' }, { type: 'airship', map: 'overworld', x: 1, y: 2 }] };

  it('NW-1: a spot spawn and the vehicles\' spots resolve to cells on the maps they name', async () => {
    const game = { ...fakeGame(), data: spotData, pendingEntrance: null as string | null, vehicles: [] as unknown[] };
    await new DebugScenarioLoader(game as unknown as Game).run(atSpot);
    expect(game.playerPosition).toEqual({ x: 5, y: 6 });
    expect(game.vehicles).toEqual([{ type: 'ship', map: 'overworld', x: 7, y: 8 }, { type: 'airship', map: 'overworld', x: 1, y: 2 }]);
    expect(spotData.loadMap).toHaveBeenCalledTimes(1);   // each map read once
    expect(game.scenes.switchTo).toHaveBeenCalledWith('exploration');
  });

  it('NW-1: an unknown spot throws before the game changes', async () => {
    const game = { ...fakeGame(), data: spotData, pendingEntrance: null as string | null, vehicles: [] as unknown[] };
    await expect(new DebugScenarioLoader(game as unknown as Game).run({ ...atSpot, spot: 't_s_nowhere' }))
      .rejects.toThrow(/map overworld has no spot t_s_nowhere/);
    await expect(new DebugScenarioLoader(game as unknown as Game).run({ ...atSpot,
      vehicles: [{ type: 'ship', map: 'cave', at: 't_s_quay' }] })).rejects.toThrow(/map cave has no spot t_s_quay/);
    expect(game.currentMapId).toBe('');
    expect(game.scenes.switchTo).not.toHaveBeenCalled();
  });

  it('every field scenario in debug-scenarios.yaml spawns on a walkable tile', () => {
    const scenarios = parse(readFileSync(resolve(root, 'assets/data/debug-scenarios.yaml'), 'utf-8')) as DebugScenario[];
    // WR: the wr_* seam scenarios start on the ship or in flight over open sea (docs/WORLD_WRAP_PLAN.md 6.3)
    const fields = scenarios.filter((s) => s.mode === 'field' && !(s.id.startsWith('wr_') && s.fieldMode && s.fieldMode !== 'walking'));
    const compiled = parse(readFileSync(resolve(root, 'assets/maps/ai/index.yaml'), 'utf-8')) as string[];
    expect(fields.length).toBeGreaterThan(0);
    for (const s of fields) {
      // R revision 2: maps in ai/index.yaml are checked on their compiled variant only (the one the game plays)
      const variants = (compiled.includes(s.map!) ? [`assets/maps/ai/${s.map}.yaml`] : [`assets/maps/${s.map}.yaml`])
        .filter((f) => existsSync(resolve(root, f)));
      expect(variants.length, `${s.id}: map ${s.map} exists`).toBeGreaterThan(0);
      for (const f of variants) {
        const map = parse(readFileSync(resolve(root, f), 'utf-8')) as
          { width: number; collision: number[]; entrances?: Record<string, [number, number]> } & Pick<MapData, 'spots'>;
        if (s.entrance && !map.entrances?.[s.entrance]) throw new Error(`${s.id}: ${f} has no entrance ${s.entrance}`);
        if (s.spot && !map.spots?.[s.spot]) throw new Error(`${s.id}: ${f} has no spot ${s.spot}`);
        // NW-1: a spot; NW-5: a raw spawn is a plain cell (pass W's act-1 frame is gone)
        const [x, y] = s.entrance ? map.entrances![s.entrance] : s.spot ? map.spots![s.spot].at : s.spawn ?? [0, 0];
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

  it('R0: scenario flags are set on the fresh game and members may start with a status', async () => {
    const { ClassRegistry } = await import('../../src/data/ClassRegistry.js');
    const { PartyManager } = await import('../../src/entities/PartyManager.js');
    const { Inventory } = await import('../../src/entities/Inventory.js');
    const { GameFlags } = await import('../../src/core/GameFlags.js');
    const { testClass } = await import('../helpers/testUtils.js');
    ClassRegistry.reset();
    await ClassRegistry.init({ loadClasses: async () => [testClass('warrior')] } as never);
    const party = new PartyManager();
    const game = { ...fakeGame(), party, inventory: new Inventory(), gameFlags: new GameFlags(), pendingEntrance: null as string | null };
    const order: string[] = [];
    game.resetState = vi.fn(() => { order.push('reset'); });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const member = { class: 'warrior', level: 1, equipment: [], spells: [] };
    await new DebugScenarioLoader(game as unknown as Game).run({
      ...field, flags: ['GARLAND_DEFEATED', 'PRINCESS_RESCUED'],
      party: [{ ...member, name: 'A', status: ['poison'] }, { ...member, name: 'B', status: ['nonsense'] }],
    });
    expect(order).toEqual(['reset']);
    expect(game.gameFlags.has('GARLAND_DEFEATED')).toBe(true);
    expect(game.gameFlags.has('PRINCESS_RESCUED')).toBe(true);
    expect(party.all[0].statusTracker.has('poison')).toBe(true);
    expect(party.all[1].statusTracker.has('poison')).toBe(false);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("unknown status 'nonsense'"));
    error.mockRestore();
  });

  it('R0: every r_* scenario flag and status is a known name', () => {
    const scenarios = parse(readFileSync(resolve(root, 'assets/data/debug-scenarios.yaml'), 'utf-8')) as DebugScenario[];
    const known = ['GARLAND_DEFEATED', 'PRINCESS_RESCUED', 'GOT_LUTE', 'INTRO_COMPLETE'];
    for (const s of scenarios) {
      // pass W's w_* stage starts (and pass CD's cd_* Cardia starts, AV's av_* airship previews) hold later story flags
      // (WORLD 6.5): any known flag
      for (const f of s.flags ?? []) {
        if (['w_', 'm7_', 'cd_', 'av_', 'wr_'].some((p) => s.id.startsWith(p))) expect(known.includes(f) || isKnownFlag(f), `${s.id} flag ${f}`).toBe(true);
        else expect(known, `${s.id} flag ${f}`).toContain(f);
      }
      // pass F's f_* scenarios also start members stoned and afraid
      for (const m of s.party) for (const st of m.status ?? []) expect(['poison', 'blind', 'silence', 'sleep', 'stun', 'stone', 'fear'], `${s.id}`).toContain(st);
    }
  });
  it('U0: the u_* scenarios exist; battle ones use full background paths that exist (revisions 9, 12)', () => {
    const scenarios = parse(readFileSync(resolve(root, 'assets/data/debug-scenarios.yaml'), 'utf-8')) as DebugScenario[];
    const byId = new Map(scenarios.map((s) => [s.id, s]));
    const ids = ['u_garland_400_l1', 'u_temple_400', 'u_retry_trap', 'u_ko_leader', 'u_items_hurt', 'u_shop_kit',
      'u_lunge_rows', 'u_cmd_menu'];
    for (const id of ids) expect(byId.has(id), id).toBe(true);
    for (const s of scenarios.filter((x) => x.id.startsWith('u_') && x.mode !== 'field')) {
      expect(s.background, s.id).toMatch(/^assets\/backgrounds\/[a-z_]+\.webp$/);
      expect(existsSync(resolve(root, s.background!)), `${s.id}: ${s.background}`).toBe(true);
    }
    const lunge = byId.get('u_lunge_rows')!;
    expect(lunge.enemies).toHaveLength(6);
    for (const m of lunge.party) {
      expect(m.level).toBe(1);
      expect(m.equipment.some((e) => ['rapier', 'iron_sword', 'small_knife', 'hammer'].includes(e)), m.name).toBe(false);
    }
    expect(byId.get('u_retry_trap')!.spawn).toEqual([11, 7]);
  });
});
