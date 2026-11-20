/**
 * The north bridge (docs/WORLD_PLAN.md 4.1, 6.3 GT-1 / GT-2, D-W13; A1-O). The King's scene `act1_complete` sets
 * INTRO_COMPLETE and BRIDGE_BUILT; the compiled world's patch `north_bridge` (flag BRIDGE_BUILT) turns the two gap
 * rows into Bridge and also covers the two bridge gate cells, so forcing it on opens the span and drops the gates
 * together (GT-2). Its overlay is opaque on every cell (its art covers the debris). NW-5: the cells come from the
 * records (the gates `a1_bridge_gate_w` / `_e`, the two Water rows north of them, the `north_shore` entrance), not
 * pass W's act-1 cells.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { execFileSync } from 'node:child_process';
import { TerrainType, type MapData } from '../../../src/types/index.js';
import { canEnter, fieldStep, npcOutcome, type FieldState } from '../../../src/systems/fieldRules.js';
import { validateMapData } from '../../../src/core/schemaValidation.js';

const map = validateMapData(parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8'))) as MapData;
const state = (flags: string[]): FieldState => ({ flags: new Set(flags), items: new Set(), mode: 'walking', vehicles: [] });
const AFTER = ['GARLAND_DEFEATED', 'PRINCESS_RESCUED', 'INTRO_COMPLETE'];
const GATES = (map.keyItemGates ?? []).filter((g) => g.id === 'a1_bridge_gate_w' || g.id === 'a1_bridge_gate_e')
  .map((g) => [g.x, g.y]);
/** The two Water rows north of the gates (the broken span). */
const GAP = [2, 1].flatMap((d) => GATES.map(([x, y]) => [x, y - d]));
const [GX, GY] = GATES[0];
type Step = { type: string; flag?: string };
const cutscenes = parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Step[] }>;
const flagsOf = (id: string) => cutscenes.find((c) => c.id === id)!.steps.filter((s) => s.type === 'set_flag').map((s) => s.flag);

describe('the north bridge patch (WORLD_PLAN 4.1, GT-2)', () => {
  const patch = (map.patches ?? []).find((p) => p.id === 'north_bridge')!;

  it('is on the compiled world: flag BRIDGE_BUILT, Bridge on the gap rows and the gate cells', () => {
    expect(patch).toBeDefined();
    expect(patch.flag).toBe('BRIDGE_BUILT');
    expect(patch.terrain).toBe(TerrainType.Bridge);
    expect(patch.cells).toEqual(expect.arrayContaining([...GAP, ...GATES]));
    const gates = (map.keyItemGates ?? []).filter((g) => g.requiredFlag === 'BRIDGE_BUILT').map((g) => [g.x, g.y]);
    expect(gates).toEqual(GATES);
  });

  it('closed until BRIDGE_BUILT: the gap is water, the gate refuses the step; then the span walks', () => {
    expect(GATES).toHaveLength(2);
    for (const [x, y] of GAP) expect(canEnter(map, { x, y }, 'walking', state(AFTER)), `(${x}, ${y})`).toBe(false);
    expect(fieldStep(map, { x: GX, y: GY + 1 }, { x: GX, y: GY }, state(AFTER)).ok).toBe(false);
    const built = state([...AFTER, 'BRIDGE_BUILT']);
    let at = { x: GX, y: GY + 1 };
    for (const y of [GY, GY - 1, GY - 2, GY - 3, GY - 4]) {
      const to = { x: GX, y };
      expect(fieldStep(map, at, to, built).ok, `(${GX}, ${y})`).toBe(true);
      at = to;
    }
    expect(map.entrances?.north_shore).toEqual([GX, GY - 4]);
  });

  it('its overlay exists and is opaque on every patch cell', () => {
    const file = map.art?.patches?.north_bridge;
    expect(file).toBeDefined();
    const path = `assets/maps/ai/${file!.replace(/^.*?overworld\//, 'overworld/')}`;
    expect(existsSync(path), path).toBe(true);
    // build_hooks.patch_errors: the overlay is opaque on every patch cell (read with Pillow)
    const code = 'import sys; sys.path.insert(0, "assets-src/tools"); import yaml, build_hooks as H; '
      + 'src = yaml.safe_load(open("assets-src/maps/overworld.yaml")); '
      + 'src["patches"] = [p for p in src["patches"] if p["id"] == "north_bridge"]; '
      + 'print(H.patch_errors(src, "assets/maps/ai"))';
    expect(execFileSync('python3', ['-I', '-c', code], { encoding: 'utf-8' }).trim()).toBe('[]');
  });

  it('the King orders the span (INTRO_COMPLETE); the foreman lays it once the lute is held (BRIDGE_BUILT)', () => {
    expect(flagsOf('act1_complete')).toEqual(['INTRO_COMPLETE']);
    expect(flagsOf('a1_bridge_finished')).toEqual(['BRIDGE_BUILT']);
    const foreman = map.npcs.find((n) => n.id === 'bridge_worker_w')!;
    expect(foreman.cutscene).toEqual({ id: 'a1_bridge_finished', requiredFlag: 'INTRO_COMPLETE', onceFlag: 'BRIDGE_BUILT' });
    expect(foreman.requiredItem).toBe('lute');
    const st = (flags: string[], items: string[] = []): FieldState => ({ ...state(flags), items: new Set(items) });
    expect(npcOutcome(foreman, st(AFTER), []).cutscene).toBeUndefined();
    expect(npcOutcome(foreman, st(AFTER, ['lute']), []).cutscene).toBe('a1_bridge_finished');
    expect(npcOutcome(foreman, st([...AFTER, 'BRIDGE_BUILT'], ['lute']), []).cutscene).toBeUndefined();
    const lines = cutscenes.find((c) => c.id === 'act1_complete')!.steps.map((s) => JSON.stringify(s)).join(' ');
    expect(lines).not.toMatch(/completed the introduction/i);
  });
});
