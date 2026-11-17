/**
 * Proof (h), the travel-requirement matrix (docs/WORLD_PLAN.md 6.2): each row starts from a synthetic state (the
 * flags, items and parked vehicles of its column, cumulative over `from`) at Cornelia and computes the closure under
 * that state only; no event fires. It must reach its targets and must not reach the others. The basin rows check the
 * ship's water and its docks. Plus the dock rule of 2.6: every world-map dock is an allowed one, in its basin.
 * A row whose targets or vehicle places are not built yet is pending (a failure with --strict).
 */
import { canLand } from '../systems/fieldRules.js';
import type { MapData, VehicleState } from '../types/index.js';
import type { ProofFailure, ProofResult, QuestPlace, QuestState } from './questTypes.js';
import { globMatch } from './questData.js';
import { Saturator } from './questSaturate.js';
import { fail, result, type QuestContext } from './questProofs.js';
import { lateOf } from './questLateData.js';
import { worldOffsetOf } from './questGeo.js';
import { AIRSHIP_ONLY, BASIN_SEEDS, type TravelRow } from './questTravelRows.js';

interface RowState {
  flags: Set<string>;
  items: Set<string>;
  vehicles: Array<{ type: VehicleState['type']; at: string }>;
}

function rowState(rows: readonly TravelRow[], row: TravelRow): RowState {
  const base: RowState = row.from ? rowState(rows, rows.find((r) => r.id === row.from)!) : { flags: new Set(), items: new Set(), vehicles: [] };
  const out: RowState = { flags: new Set(base.flags), items: new Set(base.items), vehicles: [...base.vehicles] };
  row.flags?.forEach((f) => out.flags.add(f));
  row.items?.forEach((i) => out.items.add(i));
  for (const v of row.vehicles ?? []) out.vehicles = [...out.vehicles.filter((x) => x.type !== v.type), v];
  row.drop?.items?.forEach((i) => out.items.delete(i));
  if (row.drop?.vehicles) out.vehicles = out.vehicles.filter((v) => !row.drop!.vehicles!.includes(v.type));
  return out;
}

/** A world-map cell named by a dock id or an entrance (map coordinates), or null. */
function namedCell(map: MapData, name: string): { x: number; y: number } | null {
  const d = map.docks?.find((k) => k.id === name);
  if (d) return { x: d.x, y: d.y };
  const e = map.entrances?.[name];
  return e ? { x: e[0], y: e[1] } : null;
}

type Hit = 'yes' | 'no' | 'missing';

function startOf(rows: readonly TravelRow[], row: TravelRow): string {
  if (row.start) return row.start;
  const base = row.from ? rows.find((r) => r.id === row.from) : undefined;
  return base ? startOf(rows, base) : 'cornelia';
}

export interface TravelOutcome {
  row: string;
  status: 'ok' | 'fail' | 'pending';
  failures: ProofFailure[];
  missing: string[];
}

export function travelRow(ctx: QuestContext, rows: readonly TravelRow[], row: TravelRow): TravelOutcome {
  const { world } = ctx;
  const map = world.maps.get(world.worldMap);
  const out: TravelOutcome = { row: row.id, status: 'ok', failures: [], missing: [] };
  const startName = startOf(rows, row);
  const startCell = map ? namedCell(map, startName) : null;
  if (!map || !startCell) return { ...out, status: 'pending', missing: [startName] };
  const st = rowState(rows, row);
  const vehicles: VehicleState[] = [];
  for (const v of st.vehicles) {
    const c = namedCell(map, v.at);
    if (!c) out.missing.push(v.at);
    else vehicles.push({ type: v.type, map: map.id, ...c });
  }
  const place: QuestPlace = { map: map.id, ...startCell, mode: 'walking' };
  const start: QuestState = { flags: st.flags, items: st.items, vehicles, gold: 0, place, fired: [] };
  const sat = new Saturator(ctx, start, { disabled: new Set(ctx.cat.events.map((e) => e.id)) });
  sat.reach();
  const reachedAt = (m: string, x: number, y: number): boolean => {
    const p: QuestPlace = { map: m, x, y, mode: 'walking' };
    const comp = ctx.places.component(p, sat.view(p));
    return !!comp && sat.reachedComps.has(comp.key);
  };
  const hit = (t: string): Hit => {
    const [m, e] = t.includes(':') ? t.split(':') : [world.worldMap, t];
    const tm = world.maps.get(m);
    if (t.includes(':') || map.entrances?.[t]) {
      const c = tm?.entrances?.[e];
      if (!c) return 'missing';
      return reachedAt(m, c[0], c[1]) ? 'yes' : 'no';
    }
    const ids = [...world.maps.keys()].filter((id) => globMatch(id, t));
    if (!ids.length) return 'missing';
    return ids.some((id) => sat.reachedMaps.has(id)) ? 'yes' : 'no';
  };
  for (const t of row.reach) {
    const h = hit(t);
    if (h === 'missing') out.missing.push(t);
    else if (h === 'no') out.failures.push(fail('h', 'TRAVEL', `TRAVEL ${row.id} cannot reach ${t}`));
    else if (row.landing && AIRSHIP_ONLY.includes(t) && !landingNear(ctx, map, t)) {
      out.failures.push(fail('h', 'TRAVEL', `TRAVEL ${row.id} ${t} has no landing cell within 8 steps`));
    }
  }
  for (const t of row.notReach) if (hit(t) === 'yes') out.failures.push(fail('h', 'TRAVEL', `TRAVEL ${row.id} reaches ${t}`));
  if (row.docks || row.basins) basinRow(ctx, map, row, vehicles, sat, out);
  if (out.failures.length) out.status = 'fail';
  else if (out.missing.length) out.status = 'pending';
  return out;
}

function basinRow(ctx: QuestContext, map: MapData, row: TravelRow, vehicles: VehicleState[], sat: Saturator,
  out: TravelOutcome): void {
  const ship = vehicles.find((v) => v.type === 'ship');
  if (!ship) return;
  const p: QuestPlace = { map: map.id, x: ship.x, y: ship.y, mode: 'ship' };
  const comp = ctx.places.component(p, sat.view(p));
  if (!comp) {
    out.failures.push(fail('h', 'TRAVEL', `TRAVEL ${row.id} the ship at (${ship.x}, ${ship.y}) is not on water`));
    return;
  }
  const w = map.width;
  if (row.docks) {
    const want = new Set(row.docks);
    const missing = row.docks.filter((d) => !map.docks?.some((k) => k.id === d));
    out.missing.push(...missing);
    const got = (map.docks ?? []).filter((d) => comp.cellSet.has(d.y * w + d.x)).map((d) => d.id).sort();
    const extra = got.filter((d) => !want.has(d));
    const lacking = row.docks.filter((d) => !missing.includes(d) && !got.includes(d));
    if (extra.length || lacking.length) {
      out.failures.push(fail('h', 'TRAVEL', `TRAVEL ${row.id} ship docks ${got.join(' ') || '-'} (want ${row.docks.join(' ')})`));
    }
  }
  const [ox, oy] = worldOffsetOf(map);
  const inComp = (b: string): boolean => {
    const [x, y] = BASIN_SEEDS[b];
    return comp.cellSet.has((y - oy) * w + (x - ox));
  };
  for (const b of row.basins?.holds ?? []) if (!inComp(b)) out.failures.push(fail('h', 'TRAVEL', `TRAVEL ${row.id} the ship's water lacks ${b}`));
  for (const b of row.basins?.lacks ?? []) if (inComp(b)) out.failures.push(fail('h', 'TRAVEL', `TRAVEL ${row.id} the ship's water holds ${b}`));
}

/** A grass landing cell (`canLand`) within 8 walking steps of an anchor's entrance. */
function landingNear(ctx: QuestContext, map: MapData, anchor: string): boolean {
  const e = map.entrances?.[anchor];
  if (!e) return false;
  const fly = { flags: new Set<string>(), items: new Set<string>(), vehicles: [], mode: 'airship' as const };
  const seen = new Set<number>([e[1] * map.width + e[0]]);
  let frontier = [{ x: e[0], y: e[1] }];
  for (let d = 0; d <= 8; d++) {
    const next: Array<{ x: number; y: number }> = [];
    for (const c of frontier) {
      if (canLand(map, c, fly)) return true;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const n = { x: c.x + dx, y: c.y + dy };
        const k = n.y * map.width + n.x;
        if (n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height || seen.has(k)) continue;
        seen.add(k);
        next.push(n);
      }
    }
    frontier = next;
  }
  void ctx;
  return false;
}

/** WORLD 2.6: every dock of the world map is allowed, in its basin. */
export function dockFailures(ctx: QuestContext): ProofFailure[] {
  const map = ctx.world.maps.get(ctx.world.worldMap);
  const allowed = lateOf(ctx).docksAllowed;
  return (map?.docks ?? []).filter((d) => allowed[d.id] !== d.basin).map((d) =>
    fail('h', 'DOCK', `DOCK ${map!.id} (${d.x},${d.y}) ${d.id} basin ${d.basin} not allowed`));
}

export function proofTravel(ctx: QuestContext): ProofResult {
  const rows = lateOf(ctx).travelRows;
  const outs = rows.map((r) => travelRow(ctx, rows, r));
  const failures = [...dockFailures(ctx), ...outs.flatMap((o) => o.failures)];
  const pending = outs.filter((o) => o.status === 'pending');
  if (ctx.strict) for (const o of pending) failures.push(fail('h', 'TRAVEL', `TRAVEL ${o.row} pending: ${o.missing.join(' ')} not built`));
  const basin = rows.filter((r) => r.docks || r.basins).length;
  const ok = outs.filter((o) => o.status === 'ok').length;
  return result('h', 'travel matrix', failures,
    `(${rows.length - basin} rows, ${basin} basin rows; ${ok} checked, ${pending.length} pending)`);
}
