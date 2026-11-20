/**
 * Proof (g), the macro-geography test (docs/WORLD_PLAN.md 6.1): each anchor of `world-anchors.yaml` is a named
 * entrance of the compiled world map; built anchors sit within the tolerance of their targets, the fitted scale s*
 * is in its band, each pair's distance ratio and bearing error are in theirs, and the listed hops have no long
 * detour. An anchor whose entrance does not exist yet uses its target and is `assumed` (a failure with --strict).
 */
import type { FieldMode } from '../types/index.js';
import type { ProofFailure, ProofResult, QuestPlace, QuestState } from './questTypes.js';
import { fail, result, type QuestContext } from './questProofs.js';
import { route } from './questRoute.js';
import { lateOf, type GeoData } from './questLateData.js';

type XY = [number, number];

/** Compass bearing in degrees: north 0, east 90 (y grows south). */
export function bearing(dx: number, dy: number): number {
  return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
}

const dist = (a: XY, b: XY): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const pairKey = (a: string, b: string): string => [a, b].sort().join('|');

export interface GeoInput {
  geo: GeoData;
  /** Placed anchors' world cells, by anchor name (absent: assumed at its target). */
  cells: ReadonlyMap<string, XY>;
  strict?: boolean;
  /** The path length of a detour hop between two world cells in a mode, or null when there is no route. */
  pathLength?: (from: XY, to: XY, mode: string) => number | null;
}

export interface GeoOutcome {
  failures: ProofFailure[];
  scale: number;
  pairs: number;
  assumed: string[];
}

/** Steps 1-6 of 6.1 on given cells (pure: the RED fixtures call it directly). */
export function geoCheck(input: GeoInput): GeoOutcome {
  const { geo } = input;
  const failures: ProofFailure[] = [];
  const at = new Map<string, XY>();
  const assumed: string[] = [];
  for (const a of geo.anchors) {
    const c = input.cells.get(a.name);
    if (c) {
      at.set(a.name, c);
      const [dx, dy] = [c[0] - a.target[0], c[1] - a.target[1]];
      if (Math.abs(dx) > geo.tolerance || Math.abs(dy) > geo.tolerance) {
        failures.push(fail('g', 'GEO', `GEO place ${a.name} at (${c[0]}, ${c[1]}), target (${a.target[0]}, ${a.target[1]})`));
      }
    } else {
      at.set(a.name, a.target);
      assumed.push(a.name);
      if (a.built) failures.push(fail('g', 'GEO', `GEO missing ${a.name}: no entrance ${a.entrance} on the world map`));
      else if (input.strict) failures.push(fail('g', 'GEO', `GEO assumed ${a.name} (entrance ${a.entrance} not built)`));
    }
  }
  const ref = new Map(geo.anchors.map((a) => [a.name, a.ref]));
  const exempt = new Set(geo.distanceExempt.map(([a, b]) => pairKey(a, b)));
  const pairs = geo.pairs.filter(([a, b]) => at.has(a) && at.has(b));
  let num = 0;
  let den = 0;
  for (const [a, b] of pairs) {
    if (exempt.has(pairKey(a, b))) continue;
    const dr = dist(ref.get(a)!, ref.get(b)!);
    num += dist(at.get(a)!, at.get(b)!) * dr;
    den += dr * dr;
  }
  const s = den > 0 ? num / den : 0;
  if (s < geo.scale[0] || s > geo.scale[1]) {
    failures.push(fail('g', 'GEO', `GEO scale s*=${s.toFixed(3)} outside [${geo.scale[0].toFixed(2)}, ${geo.scale[1].toFixed(2)}]`));
  }
  for (const [a, b] of pairs) {
    const ra = ref.get(a)!;
    const rb = ref.get(b)!;
    const wa = at.get(a)!;
    const wb = at.get(b)!;
    const expected = s * dist(ra, rb);
    const long = expected >= geo.longPair;
    if (!exempt.has(pairKey(a, b))) {
      const r = expected > 0 ? dist(wa, wb) / expected : 0;
      const [lo, hi] = long ? geo.ratio.long : geo.ratio.short;
      if (r < lo || r > hi) failures.push(fail('g', 'GEO', `GEO distance ${a}-${b} r=${r.toFixed(2)} outside [${lo}, ${hi}]`));
    }
    const d = Math.abs(bearing(wb[0] - wa[0], wb[1] - wa[1]) - bearing(rb[0] - ra[0], rb[1] - ra[1]));
    const err = Math.min(d, 360 - d);
    const max = long ? geo.bearing.long : geo.bearing.short;
    if (err > max) failures.push(fail('g', 'GEO', `GEO bearing ${a}-${b} ${err.toFixed(1)}° > ${max}°`));
  }
  if (input.pathLength) {
    for (const h of geo.detours) {
      const [a, b] = h.pair;
      if (!input.cells.has(a) || !input.cells.has(b)) continue;
      const wa = input.cells.get(a)!;
      const wb = input.cells.get(b)!;
      const len = input.pathLength(wa, wb, h.mode);
      const euclid = dist(wa, wb);
      if (len === null) failures.push(fail('g', 'GEO', `GEO detour ${a}-${b} unreachable (${h.mode})`));
      else if (len > h.factor * euclid) {
        failures.push(fail('g', 'GEO', `GEO detour ${a}-${b} ${len} > ${h.factor} x ${euclid.toFixed(1)}`));
      }
    }
  }
  return { failures, scale: s, pairs: pairs.length, assumed };
}

/** A state with every flag and key item the world knows (the detour hops are measured with everything open). */
export function openState(ctx: QuestContext, place: QuestPlace): QuestState {
  const flags = new Set<string>(ctx.cat.relevantFlags);
  for (const s of ctx.world.quest.stages) s.grants.flags.forEach((f) => flags.add(f));
  return { flags, items: new Set(ctx.world.keyItems), vehicles: [], gold: 0, place, fired: [] };
}

const MODES: Record<string, FieldMode[]> = {
  walking: ['walking'], 'ship+walking': ['walking', 'ship'], 'canoe+walking': ['walking', 'canoe'],
};

/** Path lengths on the world map in a hop's modes, the ship parked at the dock nearest the start. */
export function worldPathLength(ctx: QuestContext): (from: XY, to: XY, mode: string) => number | null {
  const map = ctx.world.maps.get(ctx.world.worldMap);
  return (from, to, mode) => {
    if (!map) return null;
    const a: QuestPlace = { map: map.id, x: from[0], y: from[1], mode: 'walking' };
    const st = openState(ctx, a);
    const modes = new Set<FieldMode>(MODES[mode] ?? ['walking']);
    if (modes.has('ship')) {
      const near = [...(map.docks ?? [])].sort((d, e) => Math.hypot(d.x - a.x, d.y - a.y) - Math.hypot(e.x - a.x, e.y - a.y))[0];
      if (near) st.vehicles = [{ type: 'ship', map: map.id, x: near.x, y: near.y }];
    }
    const path = route(ctx, a, (p) => p.map === map.id && p.x === to[0] && p.y === to[1] && p.mode === 'walking',
      st, { modes, exitSpell: false });
    return path ? path.length : null;
  };
}

/** The anchors' placed world cells (entrances of the world map). */
export function anchorCells(ctx: QuestContext, geo: GeoData): Map<string, XY> {
  const map = ctx.world.maps.get(ctx.world.worldMap);
  const out = new Map<string, XY>();
  for (const a of geo.anchors) {
    const e = map?.entrances?.[a.entrance];
    if (e) out.set(a.name, [e[0], e[1]]);
  }
  return out;
}

export function proofGeo(ctx: QuestContext): ProofResult {
  const geo = lateOf(ctx).geo;
  if (!geo) return result('g', 'geography', [fail('g', 'GEO', 'GEO no world-anchors.yaml')], '');
  const out = geoCheck({ geo, cells: anchorCells(ctx, geo), strict: ctx.strict, pathLength: worldPathLength(ctx) });
  return result('g', 'geography', out.failures, `s*=${out.scale.toFixed(3)} (${out.pairs} pairs; ${out.assumed.length} assumed)`);
}
