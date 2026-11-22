/**
 * NW2 (docs/NW2_EDITS_PLAN.md 7, 13; D-NW2-1, D-NW2-12): the five northern hikes on the committed world source, as
 * `world.py`'s `hikes` line checks them (`worldgen/gates_hike.py`), with every patch on:
 * - floor: no airship landing (a free grass cell: not a transition, gate, entrance or dock) within K steps of the
 *   site's arrival cell on foot+canoe;
 * - cap: the site's landing spot is a free grass cell within U steps in the site's mode (walking, or foot+canoe for
 *   the waterfall).
 * K, U and the modes come from `assets/data/world-anchors.yaml`'s `hike:` block (the one source). Places are read by
 * name (`worldSpots.ts`); each check fails on a mutated world or input.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { entrance, spot } from '../helpers/worldSpots.js';
import { LANDING, WorldGrid, loadWorldSource, type WorldSource, type XY } from '../helpers/worldGrid.js';

interface Hike { floor: number; cap: number; sites: Record<string, 'walking' | 'canoe'> }

const SRC = loadWorldSource();
const HIKE = (parse(readFileSync('assets/data/world-anchors.yaml', 'utf-8')) as { hike: Hike }).hike;
const SITES = ['wat_onrac', 'wat_waterfall', 'wat_caravan', 'wnd_mirage', 'wnd_lufenia'];

/** A site's landing spot: `<region>_s_<name>_airship` for the site `<region>_<name>` (the specs' `Hike` records). */
const landingOf = (site: string): string => site.replace(/^([a-z]+)_/, '$1_s_') + '_airship';

/** The cells no airship lands on although they may be grass (`world_content.taken` plus the entrances). */
function taken(src: WorldSource): Set<string> {
  const k = (x: number, y: number): string => `${x},${y}`;
  return new Set([
    ...src.transitions.map((t) => k(t.x, t.y)), ...(src.keyItemGates ?? []).map((g) => k(g.x, g.y)),
    ...(src.docks ?? []).map((d) => k(d.x, d.y)), ...Object.values(src.entrances ?? {}).map(([x, y]) => k(x, y)),
  ]);
}

interface HikeRow { site: string; floor: number | null; cap: number | null; why: string[] }

/** `gates_hike.hikes` over the source and the bounds: one row per site. */
function hikes(src: WorldSource, hike: Hike, grid = WorldGrid.of(src)): HikeRow[] {
  const busy = taken(src);
  const landing = (c: XY): boolean => grid.at(c.x, c.y) === LANDING && !busy.has(`${c.x},${c.y}`);
  return SITES.map((site) => {
    const why: string[] = [];
    const at = entrance(src, site);
    const foot = grid.dist([at], grid.canoe);
    let floor: number | null = null;
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
      const n = foot[y * grid.w + x];
      if (n >= 0 && landing({ x, y }) && (floor === null || n < floor)) floor = n;
    }
    if (floor !== null && floor < hike.floor) why.push(`a landing ${floor} steps away on foot+canoe (want >= ${hike.floor})`);
    const name = landingOf(site);
    const l = spot(src, name);
    if (src.spots?.[name]?.kind !== 'landing') why.push(`${name} is not a landing spot`);
    if (!landing(l)) why.push(`${name} is not a free grass cell`);
    const mode = hike.sites[site] ?? 'walking';
    const n = grid.steps(grid.dist([at], mode === 'canoe' ? grid.canoe : grid.walk), l);
    const cap = n >= 0 ? n : null;
    if (cap === null || cap > hike.cap) why.push(`${name} is ${cap ?? 'unreachable'} steps away (${mode}; want <= ${hike.cap})`);
    return { site, floor, cap, why };
  });
}

describe('NW2: the northern hikes (K 25, U 50)', () => {
  it('the bounds and the five sites are the plan\'s (D-NW2-1, D-NW2-12)', () => {
    expect([HIKE.floor, HIKE.cap]).toEqual([25, 50]);
    expect(Object.keys(HIKE.sites).sort()).toEqual([...SITES].sort());
    expect(HIKE.sites.wat_waterfall).toBe('canoe');
  });

  const rows = hikes(SRC, HIKE);
  it.each(rows.map((r) => [r.site, `${r.floor} / ${r.cap}`, r] as const))('%s: no landing within K, its landing within U (d %s)', (_s, _d, r) => {
    expect(r.why).toEqual([]);
    expect(r.floor).not.toBeNull();
    expect(r.floor as number).toBeGreaterThanOrEqual(HIKE.floor);
    expect(r.cap as number).toBeLessThanOrEqual(HIKE.cap);
    expect(r.cap as number).toBeGreaterThanOrEqual(r.floor as number);   // its own landing is one of the landings
  });

  it('fails when a grass cell lands within K of a site (mutated world)', () => {
    const grid = WorldGrid.of(SRC);
    const at = entrance(SRC, 'wat_onrac');
    const d = grid.dist([at], grid.walk);
    const busy = taken(SRC);
    let near: XY | null = null;
    for (let i = 0; i < d.length && !near; i++) {
      const c = { x: i % grid.w, y: Math.floor(i / grid.w) };
      if (d[i] === 10 && !busy.has(`${c.x},${c.y}`)) near = c;
    }
    expect(near).not.toBeNull();
    grid.set(near as XY, LANDING);
    const onrac = hikes(SRC, HIKE, grid).find((r) => r.site === 'wat_onrac') as HikeRow;
    expect(onrac.floor).toBeLessThanOrEqual(10);
    expect(onrac.why.join()).toMatch(/a landing \d+ steps away on foot\+canoe \(want >= 25\)/);
  });

  it('fails when a landing turns to forest, or the cap is tighter than a hike (mutated input)', () => {
    const grid = WorldGrid.of(SRC);
    grid.set(spot(SRC, 'wnd_s_lufenia_airship'), 'f');
    expect(hikes(SRC, HIKE, grid).find((r) => r.site === 'wnd_lufenia')?.why.join()).toMatch(/not a free grass cell/);
    const tight = hikes(SRC, { ...HIKE, cap: HIKE.floor });
    expect(tight.filter((r) => r.why.some((w) => /want <= 25/.test(w))).length).toBeGreaterThan(0);
    const high = hikes(SRC, { ...HIKE, floor: 60 });
    expect(high.every((r) => r.why.some((w) => /want >= 60/.test(w)))).toBe(true);
  });
});
