/**
 * The curve model (docs/QUEST_PLAN.md 5.2 (d), docs/WORLD_PLAN.md 6.0 (d), (d3), (f)): deterministic, no battles.
 * It replays the witness of proof (a) (the saturation from the start, event by event) and walks a shortest cell route
 * to each event. Each route cell in an encounter zone adds `1 / mean steps` fights, times the mode's multiplier
 * (walking 1, canoe 0.5, ship 1, airship 0) and the stage's `grind`; a fight gives the table's expected formation
 * xp and gold, and a scripted battle its enemies' rewards. Each member gets a quarter of the xp.
 *
 * Exploration (INT-W2c): the first time the walk enters a map other than the world map, the party is taken to explore
 * it, as a player does a dungeon or a town (chests, dead ends): once over each walkable cell of its encounter zones,
 * so each such cell adds `1 / mean steps` fights (walking rate, not times `grind`), charged to the event's stage. The
 * shortest route alone undercounts play: our encounter xp is FF1's (/tmp/int-w2c/xp_compare.md), and so are the bands.
 *
 * A pending stage has no maps to walk: when its synthetic grant fires the party is raised to its band's low level,
 * and the gold from then on is marked assumed (the gold rules skip it; `--strict` fails pending stages anyway).
 */
import { levelForXp, xpToReach } from '../entities/ExperienceTable.js';
import type { EncounterEntry, EncounterRate, FieldMode, MapData, QuestStage } from '../types/index.js';
import type { QuestPlace, QuestState } from './questTypes.js';
import { globMatch, stageOrder } from './questData.js';
import { baseTerrain, terrainAllows } from '../systems/fieldRules.js';
import { stageOfMap, townKeepers } from './questCatalog.js';
import type { QuestEventSpec } from './questEvents.js';
import { stageMark } from './questStates.js';
import { Saturator } from './questSaturate.js';
import { route } from './questRoute.js';
import type { QuestContext } from './questProofs.js';
import { lateOf, type LateData } from './questLateData.js';

export const MODE_RATE: Readonly<Record<FieldMode, number>> = { walking: 1, canoe: 0.5, ship: 1, airship: 0 };
const DEFAULT_RATE: EncounterRate = { min: 20, max: 30 };

export interface StagePoint {
  stage: string;
  /** Whole-party level (fractional) at the boss, or at the stage's end. */
  level: number;
  at: 'boss' | 'end' | 'assumed';
  boss?: string;
  fights: number;
}

export interface CurveResult {
  points: Map<string, StagePoint>;
  /** Cumulative gold when each stage's `after` stages are all done (its start). */
  stageStartGold: Map<string, number>;
  /** Cumulative gold when a keeper of each town first becomes talkable. */
  townFirstGold: Map<string, number>;
  /** Stages whose gold figures rest on a pending stage. */
  assumedGold: Set<string>;
  assumedTowns: Set<string>;
  /** `takeGold` NPC events: id, price, stage. */
  takeGold: Array<{ id: string; price: number; stage: string | null }>;
  fights: number;
  gold: number;
  xp: number;
}

/** Expected xp and gold of one fight from a table. */
export function tableRewards(data: LateData, table: readonly EncounterEntry[]): { xp: number; gold: number } {
  let w = 0;
  let xp = 0;
  let gold = 0;
  for (const e of table) {
    let ex = 0;
    let eg = 0;
    const add = (id: string, n: number): void => {
      const r = data.enemies.get(id);
      ex += n * (r?.xp ?? 0);
      eg += n * (r?.gold ?? 0);
    };
    if (e.groups) for (const g of e.groups) add(g.id, (g.min + (g.max ?? g.min)) / 2);
    else for (const id of e.enemies ?? []) add(id, 1);
    w += e.weight;
    xp += e.weight * ex;
    gold += e.weight * eg;
  }
  return w > 0 ? { xp: xp / w, gold: gold / w } : { xp: 0, gold: 0 };
}

/** The table and rate in force on a cell in a mode (the first zone whose rects hold it and whose modes allow it). */
export function encounterAt(map: MapData, x: number, y: number, mode: FieldMode):
  { table: readonly EncounterEntry[]; rate: EncounterRate } | null {
  for (const z of map.encounterZones ?? []) {
    if (!z.rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) continue;
    if (!(z.modes ?? ['walking', 'canoe']).includes(mode)) continue;
    return z.encounters.length ? { table: z.encounters, rate: z.encounterRate ?? map.encounterRate ?? DEFAULT_RATE } : null;
  }
  if (mode !== 'walking' && mode !== 'canoe') return null;
  return map.encounters?.length ? { table: map.encounters, rate: map.encounterRate ?? DEFAULT_RATE } : null;
}

/** One exploration of a map: a pass over every walkable cell with a walking encounter table (see the header). */
export function explorationRewards(data: LateData, map: MapData): { fights: number; xp: number; gold: number } {
  let fights = 0;
  let xp = 0;
  let gold = 0;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!terrainAllows('walking', baseTerrain(map, x, y))) continue;
      const enc = encounterAt(map, x, y, 'walking');
      if (!enc) continue;
      const per = 1 / ((enc.rate.min + enc.rate.max) / 2);
      const r = tableRewards(data, enc.table);
      fights += per;
      xp += per * r.xp;
      gold += per * r.gold;
    }
  }
  return { fights, xp, gold };
}

/** Fractional level for a member's xp (L2.9 = level 2, 90 % of the way to 3). */
export function fractionalLevel(memberXp: number): number {
  const lv = levelForXp(memberXp);
  const lo = xpToReach(lv);
  const hi = xpToReach(lv + 1);
  return Number.isFinite(hi) && hi > lo ? lv + (memberXp - lo) / (hi - lo) : lv;
}

/** The stage an event's walk is charged to. */
function stageOfEvent(ctx: QuestContext, ev: QuestEventSpec, done: (id: string) => boolean): QuestStage | null {
  const { world } = ctx;
  if (ev.stage) return world.stages.get(ev.stage) ?? null;
  const grants = new Set([...ev.grants.flags, ...ev.grants.items]);
  const byGrant = world.quest.stages.find((s) => [...s.grants.flags, ...s.grants.items].some((g) => grants.has(g)));
  if (byGrant) return byGrant;
  const byMap = stageOfMap(world, ev.map);
  if (byMap) return byMap;
  return stageOrder(world.quest).map((id) => world.stages.get(id)!).find((s) => !done(s.id)) ?? null;
}

const snapshot = (sat: Saturator, place: QuestPlace): QuestState => ({
  flags: new Set(sat.flags), items: new Set(sat.items), vehicles: sat.vehicles.map((v) => ({ ...v })), gold: 0,
  place, fired: [],
});

/**
 * Runs the curve model along the witness of proof (a). Cached on the context. `rush`: every stage's `grind` is 1.0,
 * and no map explored: a party that rushes (proof (f)'s price walls stop a rusher; a grinding party earns its way in;
 * INT-W2c).
 */
export function curveOf(ctx: QuestContext, opts: { rush?: boolean } = {}): CurveResult {
  const cache = opts.rush ? RUSH_CURVES : CURVES;
  const cached = cache.get(ctx);
  if (cached) return cached;
  const data = lateOf(ctx);
  const { world } = ctx;
  const out: CurveResult = {
    points: new Map(), stageStartGold: new Map(), townFirstGold: new Map(), assumedGold: new Set(),
    assumedTowns: new Set(), takeGold: [], fights: 0, gold: data.startGold, xp: 0,
  };
  // `--stage` (assume mode): the party arrives at the stage's band low, as its `w_s<n>_start` scenario does
  const own = ctx.stage ? world.stages.get(ctx.stage)?.band : null;
  if (own) out.xp = 4 * xpToReach(own[0]);
  let tainted = !!own;
  const fightsBy = new Map<string, number>();
  const explored = new Set<string>([world.worldMap]);
  const sat = new Saturator(ctx, ctx.start);
  let pos: QuestPlace = { ...ctx.start.place };
  const done = (id: string): boolean => sat.flags.has(stageMark(id));
  const level = (): number => fractionalLevel(out.xp / 4);
  const keepers = world.quest.towns.map((t) => ({
    t, ids: new Set(townKeepers(world, t).flatMap((k) => ctx.cat.byNpc.get(`${k.map}\0${k.npc}`)?.id ?? [])),
  }));
  const noteStages = (): void => {
    for (const s of world.quest.stages) {
      if (!out.stageStartGold.has(s.id) && s.after.every(done)) {
        out.stageStartGold.set(s.id, out.gold);
        if (tainted) out.assumedGold.add(s.id);
      }
      if (done(s.id) && !out.points.has(s.id)) {
        out.points.set(s.id, { stage: s.id, level: level(), at: 'end', fights: fightsBy.get(s.id) ?? 0 });
      }
    }
  };
  noteStages();
  for (let guard = 0; guard < 20000; guard++) {
    sat.reach();
    const avail = sat.available();
    for (const { ev } of avail) {
      const town = keepers.find((k) => k.ids.has(ev.id));
      if (town && !out.townFirstGold.has(town.t.id)) {
        out.townFirstGold.set(town.t.id, out.gold);
        if (tainted) out.assumedTowns.add(town.t.id);
      }
    }
    const next = avail.find((a) => sat.adds(a.eff));
    if (!next) break;
    const { ev, eff, at } = next;
    const stage = stageOfEvent(ctx, ev, done);
    if (ev.takes.gold > 0) out.takeGold.push({ id: ev.id, price: ev.takes.gold, stage: stage?.id ?? null });
    if (ev.source.type === 'stage') {
      const band = ev.source.stage.band;
      if (band) out.xp = Math.max(out.xp, 4 * xpToReach(band[0]));
      tainted = true;
      sat.apply(ev.id, eff, at);
      const s = ev.source.stage;
      noteStages();
      const p = out.points.get(s.id);
      if (p) p.at = 'assumed';
      continue;
    }
    if (!ev.auto) {
      const state = snapshot(sat, pos);
      const path = route(ctx, pos, (p) => p.map === at.map && p.x === at.x && p.y === at.y, state)
        ?? sat.roots.map((r) => route(ctx, r, (p) => p.map === at.map && p.x === at.x && p.y === at.y, state)).find((r) => r) ?? [];
      const grind = opts.rush ? 1 : stage?.grind ?? 1;
      let f = 0;
      let xp = 0;
      let gold = 0;
      for (const c of path) {
        const map = world.maps.get(c.map);
        if (map && !opts.rush && !explored.has(c.map)) {
          explored.add(c.map);
          const ex = explorationRewards(data, map);
          f += ex.fights;
          xp += ex.xp;
          gold += ex.gold;
        }
        const enc = map ? encounterAt(map, c.x, c.y, c.mode) : null;
        if (!enc) continue;
        const per = grind * MODE_RATE[c.mode] / ((enc.rate.min + enc.rate.max) / 2);
        const r = tableRewards(data, enc.table);
        f += per;
        xp += per * r.xp;
        gold += per * r.gold;
      }
      out.fights += f;
      out.xp += xp;
      out.gold += gold;
      if (stage) fightsBy.set(stage.id, (fightsBy.get(stage.id) ?? 0) + f);
      pos = eff.warp ?? at;
    }
    if (eff.battle?.length && stage && !out.points.has(stage.id) && stage.boss.some((b) => eff.battle!.includes(b))) {
      out.points.set(stage.id, {
        stage: stage.id, level: level(), at: 'boss', boss: stage.boss.filter((b) => eff.battle!.includes(b)).join('+'),
        fights: fightsBy.get(stage.id) ?? 0,
      });
    }
    for (const id of eff.battle ?? []) {
      const r = data.enemies.get(id);
      out.xp += r?.xp ?? 0;
      out.gold += r?.gold ?? 0;
    }
    out.gold -= ev.takes.gold;
    sat.apply(ev.id, eff, at);
    noteStages();
  }
  cache.set(ctx, out);
  return out;
}

const CURVES = new WeakMap<QuestContext, CurveResult>();
const RUSH_CURVES = new WeakMap<QuestContext, CurveResult>();

/** Whether a map id belongs to the stage (its `maps` globs). */
export function stageOwnsMap(s: QuestStage, mapId: string): boolean {
  return s.maps.some((g) => globMatch(mapId, g));
}
