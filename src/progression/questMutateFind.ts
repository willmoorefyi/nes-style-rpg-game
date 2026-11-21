/**
 * Locators of the mutation suite (docs/WORLD_PLAN.md 6.3): they find a gate-table element by what it does, not by
 * its id (an NPC that needs the crown, the patch `canal`, the composer's cut `W_isthmus`), so the same rows run on
 * the fixtures and on the real world. Each returns the elements found; none found means the element is not built.
 */
import { canEnter, terrainAllows } from '../systems/fieldRules.js';
import { TerrainType } from '../types/index.js';
import type { KeyItemGate, MapData, MapWorld } from '../types/index.js';
import type { QuestContext } from './questProofs.js';
import type { QuestEventSpec } from './questEvents.js';
import { townKeepers } from './questCatalog.js';
import { globMatch } from './questData.js';
import {
  dropFlagAt, dropItemAt, editMap, editQuest, flagsOf, forcePatch, npcDropFlag, npcFlags, setCells,
  type MutElement,
} from './questMutateOps.js';
import { openState } from './questGeo.js';

type XY = [number, number];

export function worldCuts(ctx: QuestContext): Record<string, XY[]> {
  const m = ctx.world.maps.get(ctx.world.worldMap);
  return (m?.world as (MapWorld & { cuts?: Record<string, XY[]> }) | undefined)?.cuts ?? {};
}

const el = (_ctx: QuestContext, map: string, kind: MutElement['kind'], x: number, y: number, label: string,
  apply: MutElement['apply']): MutElement => {
  const at: [number, number] = [x, y];
  return { map, kind, at, label, key: `${map}:${kind}:${at[0]},${at[1]}:${label}`, apply };
};

/** NPCs and gates whose `requiredItem` is the item: the condition removed. */
export function itemNeeds(ctx: QuestContext, item: string): MutElement[] {
  const out: MutElement[] = [];
  for (const m of ctx.world.maps.values()) {
    for (const n of m.npcs) {
      if (n.requiredItem !== item) continue;
      out.push(el(ctx, m.id, 'npc', n.x, n.y, `npc ${n.id} requiredItem ${item}`,
        (w) => editMap(w, m.id, (c) => dropItemAt(c, 'npc', n.x, n.y, item, n.id))));
    }
    for (const g of m.keyItemGates ?? []) {
      if (g.requiredItem !== item) continue;
      out.push(el(ctx, m.id, 'gate', g.x, g.y, `gate requiredItem ${item}`,
        (w) => editMap(w, m.id, (c) => dropItemAt(c, 'gate', g.x, g.y, item))));
    }
  }
  return out;
}

/** The NPC or scripted-encounter events matching `pred` that need the flag: the condition removed. */
export function flagNeeds(ctx: QuestContext, flag: string, pred: (ev: QuestEventSpec) => boolean): MutElement[] {
  const out: MutElement[] = [];
  for (const ev of ctx.cat.events) {
    if (!pred(ev)) continue;
    const m = ctx.world.maps.get(ev.map);
    if (!m) continue;
    const src = ev.source;
    if (src.type === 'npc' && npcFlags(m, src.npc).includes(flag)) {
      const n = src.npc;
      out.push(el(ctx, m.id, 'npc', n.x, n.y, `npc ${n.id} needs ${flag}`, (w) => editMap(w, m.id, (c) => npcDropFlag(c, n.id, flag))));
    } else if (src.type === 'encounter' && !src.encounter.npc && flagsOf(src.encounter).includes(flag)) {
      const e = src.encounter;
      out.push(el(ctx, m.id, 'encounter', e.x, e.y, `battle ${e.flag} needs ${flag}`,
        (w) => editMap(w, m.id, (c) => dropFlagAt(c, 'encounter', e.x, e.y, flag))));
    }
  }
  return out;
}

/** Gates and transitions on maps matching the globs that need the flag (`all` of them: their every flag). */
export function cellFlagNeeds(ctx: QuestContext, globs: string[], test: (flags: string[]) => boolean, flag: string): MutElement[] {
  const out: MutElement[] = [];
  for (const m of ctx.world.maps.values()) {
    if (!globs.some((g) => globMatch(m.id, g))) continue;
    for (const g of m.keyItemGates ?? []) if (test(flagsOf(g)) && flagsOf(g).includes(flag)) {
      out.push(el(ctx, m.id, 'gate', g.x, g.y, `gate needs ${flag}`, (w) => editMap(w, m.id, (c) => dropFlagAt(c, 'gate', g.x, g.y, flag))));
    }
    for (const t of m.transitions) if (test(flagsOf(t)) && flagsOf(t).includes(flag)) {
      out.push(el(ctx, m.id, 'transition', t.x, t.y, `transition to ${t.targetMap} needs ${flag}`,
        (w) => editMap(w, m.id, (c) => dropFlagAt(c, 'transition', t.x, t.y, flag))));
    }
  }
  return out;
}

/** World-map gates matching `pred` (told whether a patch covers the cell), each removed. */
export function gatesRemoved(ctx: QuestContext, pred: (g: KeyItemGate, patched: boolean) => boolean): MutElement[] {
  const m = ctx.world.maps.get(ctx.world.worldMap);
  if (!m) return [];
  const patched = new Set((m.patches ?? []).flatMap((p) => p.cells.map(([x, y]) => `${x},${y}`)));
  return (m.keyItemGates ?? []).filter((g) => pred(g, patched.has(`${g.x},${g.y}`))).map((g) =>
    el(ctx, m.id, 'gate', g.x, g.y, `gate ${flagsOf(g).join('+') || g.requiredItem} removed`, (w) => editMap(w, m.id, (c) => {
      c.keyItemGates = (c.keyItemGates ?? []).filter((h) => h.x !== g.x || h.y !== g.y);
    })));
}

export function grantsAny(ev: QuestEventSpec, ids: string[]): boolean {
  return [...ev.grants.flags, ...ev.grants.items, ...ev.grants.vehicles].some((g) => ids.includes(g));
}

export function spawnNeeds(ctx: QuestContext, type: string, flag: string): MutElement[] {
  const m = ctx.world.maps.get(ctx.world.worldMap);
  return (m?.vehicles ?? []).filter((v) => v.type === type && flagsOf(v).includes(flag)).map((v) =>
    el(ctx, m!.id, 'spawn', v.x, v.y, `${type} spawn needs ${flag}`, (w) => editMap(w, m!.id, (c) => dropFlagAt(c, 'spawn', v.x, v.y, flag))));
}

/** The docks of the world map named, removed together (one element). */
export function docks(ctx: QuestContext, ids: string[]): MutElement[] {
  const m = ctx.world.maps.get(ctx.world.worldMap);
  const found = (m?.docks ?? []).filter((d) => ids.includes(d.id));
  if (!m || found.length !== ids.length) return [];
  return [el(ctx, m.id, 'dock', found[0].x, found[0].y, `dock ${ids.join(' + ')} removed`,
    (w) => editMap(w, m.id, (c) => { c.docks = (c.docks ?? []).filter((d) => !ids.includes(d.id)); }))];
}

export function patchOn(ctx: QuestContext, pid: string): MutElement[] {
  const out: MutElement[] = [];
  for (const m of ctx.world.maps.values()) {
    const p = m.patches?.find((x) => x.id === pid);
    if (p) out.push(el(ctx, m.id, 'patch', p.cells[0][0], p.cells[0][1], `patch ${pid} forced on`, (w) => forcePatch(w, m.id, pid)));
  }
  return out;
}

/** A composer cut (world cells) opened: set to Water (a wall's water cut) or Grass (a barrier's walkable cut). */
export function cutOpen(ctx: QuestContext, name: string, terrain: TerrainType): MutElement[] {
  const cells = worldCuts(ctx)[name];
  if (!cells?.length) return [];
  return [{ map: ctx.world.worldMap, kind: 'cut', at: cells[0], label: `cut ${name} opened (${cells.length} cells)`,
    key: `cut:${name}`, apply: (w) => setCells(w, cells, terrain) }];
}

/** The fewest canoe cells (River, Lake, or a gate that needs the canoe) joining two anchors on foot (0-1 BFS). An
 *  anchor is an entrance or `dock:<id>` (NW2: the dock's walkable shore, its first walkable 4-neighbour). */
export function canoeCut(ctx: QuestContext, from: string, to: string): MutElement[] {
  const { world } = ctx;
  const map = world.maps.get(world.worldMap);
  const a = map && place(map, from);
  const b = map && place(map, to);
  if (!map || !a || !b) return [];
  const cells = minimalCut(ctx, map, a, b);
  if (!cells.length) return [];
  const wc = cells.map(([x, y]): [number, number] => [x, y]);
  return [{ map: map.id, kind: 'cut', at: wc[0], label: `canoe cut ${from}-${to} made grass (${wc.length} cells)`,
    key: `canoecut:${from}:${to}`, apply: (w) => setCells(w, wc, TerrainType.Grass) }];
}

function place(map: MapData, name: string): { x: number; y: number } | undefined {
  const d = name.startsWith('dock:') ? map.docks?.find((k) => k.id === name.slice(5)) : undefined;
  const e = map.entrances?.[name];
  if (!d) return e ? { x: e[0], y: e[1] } : undefined;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: d.x + dx, y: d.y + dy }))
    .find((c) => terrainAllows('walking', map.collision[c.y * map.width + c.x]));
}

function minimalCut(ctx: QuestContext, map: MapData, a: { x: number; y: number }, b: { x: number; y: number }): XY[] {
  const w = map.width;
  const st = openState(ctx, { map: map.id, ...a, mode: 'walking' });
  const items = new Set([...st.items].filter((i) => i !== 'canoe'));
  const fs = { flags: st.flags, items, vehicles: [], mode: 'walking' as const };
  const canoeGate = (x: number, y: number): boolean => !!map.keyItemGates?.some((g) => g.x === x && g.y === y && g.requiredItem === 'canoe');
  const cost = (x: number, y: number): number => {
    const t = map.collision[y * w + x];
    if (t === TerrainType.River || t === TerrainType.Lake || canoeGate(x, y)) return 1;
    return canEnter(map, { x, y }, 'walking', fs) ? 0 : Infinity;
  };
  const dist = new Map<number, number>([[a.y * w + a.x, 0]]);
  const prev = new Map<number, number>();
  const dq: number[] = [a.y * w + a.x];
  while (dq.length) {
    const c = dq.shift()!;
    const cx = c % w;
    const cy = Math.floor(c / w);
    if (cx === b.x && cy === b.y) break;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= map.height) continue;
      const k = cost(x, y);
      if (!Number.isFinite(k)) continue;
      const n = y * w + x;
      const d = dist.get(c)! + k;
      if (d >= (dist.get(n) ?? Infinity)) continue;
      dist.set(n, d);
      prev.set(n, c);
      if (k === 0) dq.unshift(n); else dq.push(n);
    }
  }
  const end = b.y * w + b.x;
  if (!dist.has(end)) return [];
  const out: XY[] = [];
  for (let c: number | undefined = end; c !== undefined; c = prev.get(c)) {
    const x = c % w;
    const y = Math.floor(c / w);
    if (cost(x, y) === 1) out.push([x, y]);
  }
  return out.reverse();
}

/** The NPC that needs the item, removed (the giant on the tunnel's chokepoint). */
export function npcRemoved(ctx: QuestContext, item: string): MutElement[] {
  const out: MutElement[] = [];
  for (const m of ctx.world.maps.values()) {
    for (const n of m.npcs.filter((x) => x.requiredItem === item)) {
      out.push(el(ctx, m.id, 'npc', n.x, n.y, `npc ${n.id} removed`, (w) => editMap(w, m.id, (c) => {
        c.npcs = c.npcs.filter((x) => x.id !== n.id);
        c.scriptedEncounters = (c.scriptedEncounters ?? []).filter((e) => e.npc !== n.id);
      })));
    }
  }
  return out;
}

/** The trigger of the cutscene that places a vehicle (or sets its flag), with every condition removed. */
export function vehicleTrigger(ctx: QuestContext, vehicle: string, flag: string): MutElement[] {
  const out: MutElement[] = [];
  for (const ev of ctx.cat.events) {
    if (ev.source.type !== 'npc' || !(ev.grants.vehicles.includes(vehicle) || ev.grants.flags.includes(flag))) continue;
    const n = ev.source.npc;
    const m = ctx.world.maps.get(ev.map)!;
    out.push(el(ctx, m.id, 'npc', n.x, n.y, `npc ${n.id} fires with no conditions`, (w) => editMap(w, m.id, (c) => {
      for (const f of npcFlags(c, n)) npcDropFlag(c, n.id, f);
      const x = c.npcs.find((v) => v.id === n.id);
      if (x) { delete x.requiredItem; delete x.takeItem; }
    })));
  }
  return out;
}

export function keeperShowIf(ctx: QuestContext, townId: string, flag: string): MutElement[] {
  const town = ctx.world.quest.towns.find((t) => t.id === townId);
  if (!town) return [];
  const npcOf = (k: { map: string; npc: string }): MapData['npcs'][number] | undefined =>
    ctx.world.maps.get(k.map)?.npcs.find((x) => x.id === k.npc);
  const ks = townKeepers(ctx.world, town).filter((k) => npcOf(k)?.showIf === flag);
  if (!ks.length) return [];
  const n = npcOf(ks[0])!;
  return [el(ctx, ks[0].map, 'npc', n.x, n.y, `keepers of ${townId} showIf ${flag} removed`, (w) => ks.reduce((acc, k) =>
    editMap(acc, k.map, (c) => { const x = c.npcs.find((v) => v.id === k.npc); if (x) delete x.showIf; }), w))];
}

export function townOpensAfter(ctx: QuestContext, townId: string, after: string[]): MutElement[] {
  const town = ctx.world.quest.towns.find((t) => t.id === townId);
  if (!town || !townKeepers(ctx.world, town).length) return [];
  return [{ map: 'quest', kind: 'quest', at: [0, 0], label: `town ${townId} opensAfter [${after.join(', ')}]`,
    key: `quest:town:${townId}`, apply: (w) => editQuest(w, (q) => { q.towns.find((t) => t.id === townId)!.opensAfter = after; }) }];
}

