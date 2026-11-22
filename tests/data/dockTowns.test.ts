/**
 * NW2 (docs/NW2_EDITS_PLAN.md 6, 8, 13): the dock audit on the committed world source, as `world.py`'s `dock_towns`
 * line checks it (`worldgen/prewalk.dock_towns`), plus the plan's non-town dock sites.
 * - A town of quest.yaml's `towns` needs a dock when no stage of its `bandStage`'s `after` closure (itself included)
 *   grants the airship and its gate is not on foot from Cornelia with the patches its bandStage's ancestors open.
 *   Such a town has a dock the ship reaches at its bandStage (the Aldi's once the ship is held, the ocean's too with
 *   CANAL_OPEN; and its basin's water joins the dock), with the gate within DOCK_GATE_STEPS walking steps of the
 *   dock's shore. The gate is the overworld entrance the town's maps exit onto.
 * - The other dock sites of plan 6: `elf_keep` and `elf_marsh` from `elf_port`, `ert_giant` and `ert_earth_cave`
 *   from `ert_melmond` on foot; `fir_volcano` from `fir_crescent` and `fir_ice` from its own dock `fir_ice`, both only
 *   with the canoe; `fir_ice` not from Crescent's dock even with the canoe (canoe_gates (iii)).
 * Places are read by name (`worldSpots.ts`); each check fails on a mutated world or input.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { dock, entrance } from '../helpers/worldSpots.js';
import { WorldGrid, around, loadWorldSource, type WorldSource } from '../helpers/worldGrid.js';

/** `prewalk.DOCK_GATE_STEPS`: a needs-dock town's gate from its dock's shore. */
const DOCK_GATE_STEPS = 12;

interface Stage { id: string; after?: string[]; grants: { flags?: string[]; vehicles?: string[] } }
interface Town { id: string; maps: string[]; bandStage: string }
interface Quest { stages: Stage[]; towns: Town[] }

const SRC = loadWorldSource();
const QUEST = parse(readFileSync('assets/data/quest.yaml', 'utf-8')) as Quest;
const STAGES = new Map(QUEST.stages.map((s) => [s.id, s]));

function closure(sid: string): Set<string> {
  const out = new Set<string>();
  const todo = [...(STAGES.get(sid)?.after ?? [])];
  while (todo.length) {
    const s = todo.pop() as string;
    if (out.has(s)) continue;
    out.add(s);
    todo.push(...(STAGES.get(s)?.after ?? []));
  }
  return out;
}

/** (flags, vehicles) the ancestors of `sid` grant (`prewalk.stage_state`). */
function stageState(sid: string): { flags: Set<string>; vehicles: Set<string> } {
  const anc = [...closure(sid)].map((a) => STAGES.get(a) as Stage);
  return { flags: new Set(anc.flatMap((s) => s.grants.flags ?? [])),
    vehicles: new Set(anc.flatMap((s) => s.grants.vehicles ?? [])) };
}

const glob = (pat: string): RegExp => new RegExp(`^${pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

/** The overworld entrances the maps matching `globs` exit onto (sources first, then the legacy maps). */
function townGates(globs: string[]): string[] {
  const seen = new Map<string, string>();
  for (const dir of ['assets-src/maps', 'assets/maps']) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.yaml')).sort()) {
      const id = f.slice(0, -5);
      if (id !== 'overworld' && !seen.has(id)) seen.set(id, `${dir}/${f}`);
    }
  }
  const out: string[] = [];
  const scan = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(scan); return; }
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if (o.targetMap === 'overworld' && typeof o.targetEntrance === 'string' && !out.includes(o.targetEntrance)) out.push(o.targetEntrance);
    Object.values(o).forEach(scan);
  };
  for (const [id, path] of [...seen].sort()) if (globs.some((g) => glob(g).test(id))) scan(parse(readFileSync(path, 'utf-8')));
  return out;
}

type TownRow = { town: string; how: 'airship' | 'on foot' | 'dock'; dock?: string; steps?: number; why: string[] };

/** `prewalk.dock_towns` over the source. */
function dockTowns(src: WorldSource): TownRow[] {
  return QUEST.towns.map((t): TownRow => {
    const why: string[] = [];
    const gates = townGates(t.maps).filter((e) => src.entrances?.[e]);
    if (!gates.length) return { town: t.id, how: 'dock', why: [`no overworld entrance leads to ${t.maps}`] };
    const { flags, vehicles } = stageState(t.bandStage);
    const grid = WorldGrid.of(src, { bridge: flags.has('BRIDGE_BUILT'), canal: flags.has('CANAL_OPEN') });
    const air = [...closure(t.bandStage), t.bandStage].some((s) => STAGES.get(s)?.grants.vehicles?.includes('airship'));
    const cornelia = grid.dist([entrance(src, 'cornelia')], grid.walk);
    if (air) return { town: t.id, how: 'airship', why };
    if (gates.some((e) => grid.steps(cornelia, entrance(src, e)) >= 0)) return { town: t.id, how: 'on foot', why };
    let best: { dock: string; steps: number } | null = null;
    const docks = vehicles.has('ship') ? (src.docks ?? []).filter((d) => d.basin === 'aldi' || flags.has('CANAL_OPEN')) : [];
    for (const d of docks) {
      const seed = src.world.basins[d.basin];
      const sea = grid.dist([{ x: seed[0], y: seed[1] }], grid.water);
      if (!around(d).some((c) => grid.steps(sea, c) >= 0) && grid.steps(sea, d) < 0) continue;   // its basin never joins it
      const shore = grid.dist(around(d), grid.walk);
      for (const e of gates) {
        const n = grid.steps(shore, entrance(src, e));
        if (n >= 0 && (!best || n < best.steps)) best = { dock: d.id, steps: n };
      }
    }
    if (!best || best.steps > DOCK_GATE_STEPS) {
      why.push(`town ${t.id} (needs a dock at ${t.bandStage}): ` + (best ? `${best.steps} steps from dock ${best.dock}`
        : 'reached from no dock the ship reaches') + ` (want <= ${DOCK_GATE_STEPS})`);
    }
    return { town: t.id, how: 'dock', ...(best ?? {}), why };
  });
}

/** Steps from a dock's shore to an entrance on foot (or foot+canoe); -1 when unreached. */
function fromDock(src: WorldSource, dockId: string, site: string, mode: 'walking' | 'canoe'): number {
  const grid = WorldGrid.of(src);
  return grid.steps(grid.dist(around(dock(src, dockId)), mode === 'canoe' ? grid.canoe : grid.walk), entrance(src, site));
}

/** A copy of the source whose ground can be edited (`set` cells to a legend char). */
function mutated(edit: (rows: string[][]) => void, src: WorldSource = SRC): WorldSource {
  const rows = src.ground.replace(/\n$/, '').split('\n').map((r) => [...r]);
  edit(rows);
  return { ...src, ground: rows.map((r) => r.join('')).join('\n') + '\n' };
}

describe('NW2: the dock audit (dock_towns)', () => {
  const rows = dockTowns(SRC);
  const by = new Map(rows.map((r) => [r.town, r]));

  it('every town is reached as plan 6 says: Pravoka on foot, the four southern towns by dock, the north by airship', () => {
    expect(rows.map((r) => r.why).flat()).toEqual([]);
    expect(Object.fromEntries(rows.map((r) => [r.town, r.how]))).toEqual({
      pravoka: 'on foot', elfheim: 'dock', dwarf: 'dock', melmond: 'dock', crescent: 'dock',
      onrac: 'airship', gaia: 'airship', lufenia: 'airship' });
  });

  it.each([['elfheim', 'elf_port'], ['dwarf', 'ert_dwarf'], ['melmond', 'ert_melmond'], ['crescent', 'fir_crescent']]
    .map(([t, id]) => [t, id, by.get(t)?.steps]))('%s has its dock %s within DOCK_GATE_STEPS of its gate (%s steps)', (town, id) => {
      const r = by.get(town) as TownRow;
      expect(r.dock).toBe(id);
      expect(r.steps as number).toBeLessThanOrEqual(DOCK_GATE_STEPS);
    });

  it('the docks are in their basins: ert_dwarf on the Aldi, fir_ice on the ocean', () => {
    expect(SRC.docks?.find((d) => d.id === 'ert_dwarf')?.basin).toBe('aldi');
    expect(SRC.docks?.find((d) => d.id === 'fir_ice')?.basin).toBe('ocean');
  });

  it.each([['elf_port', 'elf_keep'], ['elf_port', 'elf_marsh'], ['ert_melmond', 'ert_giant'], ['ert_melmond', 'ert_earth_cave']])(
    'the dock %s reaches %s on foot', (id, site) => {
      expect(fromDock(SRC, id, site, 'walking')).toBeGreaterThan(0);
    });

  it.each([['fir_crescent', 'fir_volcano'], ['fir_ice', 'fir_ice']])('the dock %s reaches %s only with the canoe', (id, site) => {
    expect(fromDock(SRC, id, site, 'walking')).toBe(-1);
    expect(fromDock(SRC, id, site, 'canoe')).toBeGreaterThan(0);
  });

  it('the Ice Cavern is not reached from Crescent\'s dock, even with the canoe: only through its own dock', () => {
    expect(fromDock(SRC, 'fir_crescent', 'fir_ice', 'canoe')).toBe(-1);
  });

  it('fails when the dwarves\' dock is withheld or its shore walled off (mutated input and world)', () => {
    const noDock = { ...SRC, docks: (SRC.docks ?? []).filter((d) => d.id !== 'ert_dwarf') };
    expect(dockTowns(noDock).find((r) => r.town === 'dwarf')?.why.join()).toMatch(/town dwarf \(needs a dock at S10\)/);
    const g = entrance(SRC, 'ert_dwarf');
    const walled = mutated((rows) => {   // a ring of rock round the hall's gate: no dock reaches it
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) rows[g.y + dy][g.x + dx] = 'm';
      }
    });
    expect(dockTowns(walled).find((r) => r.town === 'dwarf')?.why.join()).toMatch(/dwarf .*(steps from dock|no dock)/);
  });

  it('fails when a town gate is farther than DOCK_GATE_STEPS from every dock (a moved dock)', () => {
    const far = { ...SRC, docks: (SRC.docks ?? []).map((x) => (x.id === 'fir_crescent' ? { ...x, ...dock(SRC, 'fir_ice') } : x)) };
    expect(dockTowns(far).find((r) => r.town === 'crescent')?.why.join()).toMatch(/town crescent/);
  });
});
