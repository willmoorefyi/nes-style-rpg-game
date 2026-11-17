/**
 * The static index of the model (docs/QUEST_PLAN.md 5.1): every relevant event of every loaded map, the vehicle
 * spawns and the pending stages' synthetic grants, with the flags and items each map reads (the place cache key).
 * Relevance pass: only key items and the flags something reads are state; a chest or gift of an ordinary item is
 * not an event. Also the map-ownership and `towns:` lookups (WORLD 3.4) and where a transition lands.
 */
import type { MapData, MapTransition, QuestStage, QuestTown } from '../types/index.js';
import type { QuestPlace } from './questTypes.js';
import { globMatch, stageOrder, type QuestWorld } from './questData.js';
import {
  cutsceneEffects, encounterEffects, entryVehicle, flagList, npcKind, npcRelevant, staticNpc, type QuestEventSpec,
} from './questEvents.js';

export interface QuestCatalog {
  events: QuestEventSpec[];
  byId: ReadonlyMap<string, QuestEventSpec>;
  /** `<map>\0<npc id>` -> the NPC's event. */
  byNpc: ReadonlyMap<string, QuestEventSpec>;
  /** `<map>\0<x>,<y>` -> the cell-triggered encounter or gate event there. */
  byCell: ReadonlyMap<string, QuestEventSpec>;
  auto: QuestEventSpec[];
  /** Flags kept as state: read by a map, a cutscene condition or quest.yaml. */
  relevantFlags: ReadonlySet<string>;
  /** Flags read as conditions by maps (gates, transitions, encounters, NPC presence, cutscenes, spawns, patches). */
  readFlags: ReadonlyMap<string, string[]>;
  /** Items read as conditions (gate and NPC `requiredItem`), with their readers. */
  readItems: ReadonlyMap<string, string[]>;
  /** Per map: the flags and items its cells and NPCs read (the place cache key). */
  mapFlags: ReadonlyMap<string, readonly string[]>;
  mapItems: ReadonlyMap<string, readonly string[]>;
}

/** Builds the catalog: every relevant event of every loaded map, the vehicle spawns and the pending stages. */
export function buildCatalog(world: QuestWorld): QuestCatalog {
  const events: QuestEventSpec[] = [];
  const byNpc = new Map<string, QuestEventSpec>();
  const byCell = new Map<string, QuestEventSpec>();
  const readFlags = new Map<string, string[]>();
  const readItems = new Map<string, string[]>();
  const mapFlags = new Map<string, string[]>();
  const mapItems = new Map<string, string[]>();
  const read = (m: Map<string, string[]>, k: string | undefined, by: string): void => {
    if (!k) return;
    const list = m.get(k) ?? [];
    list.push(by);
    m.set(k, list);
  };
  for (const map of [...world.maps.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const mf = new Set<string>();
    const mi = new Set<string>();
    const flag = (f: string | undefined, by: string): void => { if (f) { mf.add(f); read(readFlags, f, `${map.id}:${by}`); } };
    const item = (i: string | undefined, by: string): void => { if (i) { mi.add(i); read(readItems, i, `${map.id}:${by}`); } };
    for (const g of map.keyItemGates ?? []) {
      flagList(g).forEach((f) => flag(f, `gate:${g.x},${g.y}`));
      if (g.permanent) mf.add(g.flag ?? '');
      item(g.requiredItem, `gate:${g.x},${g.y}`);
    }
    for (const t of map.transitions) flagList(t).forEach((f) => flag(f, `transition:${t.targetMap}`));
    for (const e of map.scriptedEncounters ?? []) {
      mf.add(e.flag);
      flagList(e).forEach((f) => flag(f, `battle:${e.flag}`));
    }
    for (const n of map.npcs) {
      flag(n.showIf, `npc:${n.id}`);
      flag(n.hideIf, `npc:${n.id}`);
      if (n.cutscene) {
        flagList(n.cutscene).forEach((f) => flag(f, `npc:${n.id}`));
        mf.add(n.cutscene.onceFlag);
      }
      item(n.requiredItem, `npc:${n.id}`);
    }
    for (const v of map.vehicles ?? []) flagList(v).forEach((f) => flag(f, `vehicle:${v.type}`));
    for (const p of map.patches ?? []) flag(p.flag, `patch:${p.id}`);
    mf.delete('');

    const npcEnc = new Map((map.scriptedEncounters ?? []).filter((e) => e.npc).map((e) => [e.npc!, e]));
    for (const n of map.npcs) {
      const enc = npcEnc.get(n.id);
      if (!npcRelevant(world, n, !!enc)) continue;
      const kind = npcKind(n, !!enc);
      const st = staticNpc(world, n, enc);
      if (n.chestFlag && st.grants.flags.includes(n.chestFlag)) mf.add(n.chestFlag);
      if (n.giftFlag && st.grants.flags.includes(n.giftFlag)) mf.add(n.giftFlag);
      const ev: QuestEventSpec = {
        id: `${map.id}:${kind}:${n.id}`, kind, map: map.id, at: [{ x: n.x, y: n.y }],
        requires: st.requires, grants: st.grants, takes: st.takes, once: !!(n.chestItem || n.giftItem || enc),
        source: { type: 'npc', npc: n }, auto: false, boss: enc?.enemyIds ?? [],
        aliases: [`${map.id}:npc:${n.id}`, ...(n.chestItem ? [`${map.id}:chest:${n.chestItem}`] : []),
          ...(n.giftItem ? [`${map.id}:gift:${n.giftItem}`] : []),
          ...(enc ? [`${map.id}:battle:${n.id}`, `${map.id}:battle:${enc.flag}`] : [])],
      };
      events.push(ev);
      byNpc.set(`${map.id}\0${n.id}`, ev);
    }
    for (const e of map.scriptedEncounters ?? []) {
      const eff = encounterEffects(world, e);
      const ev: QuestEventSpec = {
        id: `${map.id}:battle:${e.flag}:${e.x},${e.y}`, kind: 'battle', map: map.id, at: [{ x: e.x, y: e.y }],
        requires: { flags: flagList(e), items: [], vehicles: [] },
        grants: { flags: eff.flags, items: eff.items, vehicles: eff.vehicles.map((v) => v.type) },
        takes: { items: eff.takes, gold: 0 }, once: true, source: { type: 'encounter', encounter: e }, auto: false,
        boss: e.enemyIds,
        aliases: [`${map.id}:battle:${e.flag}`, ...(e.npc ? [`${map.id}:battle:${e.npc}`] : []),
          ...e.enemyIds.map((id) => `${map.id}:battle:${id}`)],
      };
      events.push(ev);
      byCell.set(`${map.id}\0${e.x},${e.y}`, ev);
    }
    for (const g of map.keyItemGates ?? []) {
      if (!g.permanent || !g.flag) continue;
      const ev: QuestEventSpec = {
        id: `${map.id}:gate:${g.x},${g.y}`, kind: 'gate', map: map.id, at: [{ x: g.x, y: g.y }],
        requires: { flags: flagList(g), items: g.requiredItem ? [g.requiredItem] : [], vehicles: [] },
        grants: { flags: [g.flag], items: [], vehicles: [] }, takes: { items: [], gold: 0 }, once: true,
        source: { type: 'gate', gate: g }, auto: false, boss: [], aliases: [`${map.id}:gate:${g.flag}`],
      };
      events.push(ev);
      if (!byCell.has(`${map.id}\0${g.x},${g.y}`)) byCell.set(`${map.id}\0${g.x},${g.y}`, ev);
    }
    for (const v of map.vehicles ?? []) {
      events.push({
        id: `${map.id}:vehicle:${v.type}`, kind: 'vehicle', map: map.id, at: [{ x: v.x, y: v.y }],
        requires: { flags: flagList(v), items: [], vehicles: [] }, grants: { flags: [], items: [], vehicles: [v.type] },
        takes: { items: [], gold: 0 }, places: [{ type: v.type, map: map.id, x: v.x, y: v.y }], once: true,
        source: { type: 'spawn', spawn: v }, auto: true, boss: [], aliases: [],
      });
    }
    mapFlags.set(map.id, [...mf].sort());
    mapItems.set(map.id, [...mi].sort());
  }
  for (const id of stageOrder(world.quest)) {
    const s = world.stages.get(id)!;
    if (s.status !== 'pending') continue;
    events.push({
      id: `quest:stage:${s.id}`, kind: 'gift', map: 'quest', at: [], stage: s.id,
      requires: { flags: [...s.requires.flags], items: [...s.requires.items], vehicles: [...s.requires.vehicles] },
      grants: { flags: [...s.grants.flags], items: [...s.grants.items], vehicles: [...s.grants.vehicles] },
      takes: { items: s.requires.items.filter((i) => world.consumed.has(i)), gold: 0 },
      places: s.grants.vehicles.map((t) => entryVehicle(s, t)), once: true, source: { type: 'stage', stage: s },
      auto: true, boss: [], aliases: [],
    });
  }
  const relevantFlags = new Set<string>([...readFlags.keys(), world.quest.goal]);
  for (const f of mapFlags.values()) f.forEach((x) => relevantFlags.add(x));
  for (const s of world.quest.stages) {
    [...s.requires.flags, ...s.grants.flags, ...(s.milestones ?? [])].forEach((f) => relevantFlags.add(f));
  }
  return {
    events, byId: new Map(events.flatMap((e) => [[e.id, e] as const])), byNpc, byCell,
    auto: events.filter((e) => e.auto), relevantFlags, readFlags, readItems, mapFlags, mapItems,
  };
}

/** Where a transition lands (MapTransition.arrivalFor: a named entrance or the target cell), or null when the target
 *  map is not loaded or lacks the entrance. */
export function arrivalOf(world: QuestWorld, t: MapTransition): QuestPlace | null {
  const target = world.maps.get(t.targetMap);
  if (!target) return null;
  if (t.targetEntrance !== undefined) {
    const e = target.entrances?.[t.targetEntrance];
    return e ? { map: t.targetMap, x: e[0], y: e[1], mode: 'walking' } : null;
  }
  return { map: t.targetMap, x: t.targetX, y: t.targetY, mode: 'walking' };
}

/** The stage whose `maps` globs own a map id (first in file order), or null. */
export function stageOfMap(world: QuestWorld, mapId: string): QuestStage | null {
  return world.quest.stages.find((s) => s.maps.some((g) => globMatch(mapId, g))) ?? null;
}

/** The shop town whose `maps` globs own a map id, or null (WORLD 3.4 `towns:`). */
export function townOfMap(world: QuestWorld, mapId: string): QuestTown | null {
  return world.quest.towns.find((t) => t.maps.some((g) => globMatch(mapId, g))) ?? null;
}

/** The loaded map ids a town owns. */
export function townMapIds(world: QuestWorld, town: QuestTown): string[] {
  return [...world.maps.keys()].filter((id) => town.maps.some((g) => globMatch(id, g))).sort();
}

/** The town's keepers on its loaded maps: NPCs with a `shopId`, or the inn and clinic actions (proof (e)). */
export function townKeepers(world: QuestWorld, town: QuestTown): Array<{ map: string; npc: string }> {
  const out: Array<{ map: string; npc: string }> = [];
  for (const id of townMapIds(world, town)) {
    for (const n of world.maps.get(id)?.npcs ?? []) {
      if (n.shopId || n.action === 'inn' || n.action === 'clinic') out.push({ map: id, npc: n.id });
    }
  }
  return out;
}

/** Every flag a map sets: chests, gifts, permanent gates, scripted encounters and their cutscenes, NPC cutscenes
 *  (questFlags.test.ts checks them against the owner's prefix). */
export function flagsSetByMap(world: QuestWorld, map: MapData): string[] {
  const out = new Set<string>();
  const cut = (id: string | undefined): void => cutsceneEffects(world, id).flags.forEach((f) => out.add(f));
  for (const n of map.npcs) {
    if (n.chestFlag) out.add(n.chestFlag);
    if (n.giftFlag) out.add(n.giftFlag);
    if (n.cutscene) cut(n.cutscene.id);
  }
  for (const g of map.keyItemGates ?? []) if (g.permanent && g.flag) out.add(g.flag);
  for (const e of map.scriptedEncounters ?? []) {
    out.add(e.flag);
    cut(e.postVictoryCutscene);
  }
  return [...out].sort();
}
