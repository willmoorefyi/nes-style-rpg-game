/**
 * The model's events (docs/QUEST_PLAN.md 5.1): chests, NPC gifts and trades, NPC cutscenes, scripted encounters
 * (assumed won, then their `postVictoryCutscene`), permanent gates, vehicle spawns, and the synthetic grant of each
 * pending stage (assume mode). What an event does now is asked of src/systems/fieldRules.ts (`npcOutcome`,
 * `gateCheck`, `dueEncounterWhere`, `flagsMet`), the module the game calls; the static requires / grants here
 * (questCatalog.ts) are used to withhold a stage's grants (proof (b)) and by the mutation suite.
 */
import { dueEncounterWhere, flagsMet, gateCheck, npcOutcome } from '../systems/fieldRules.js';
import type {
  KeyItemGate, MapNPC, QuestNeeds, QuestStage, ScriptedEncounter, VehicleSpawn, VehicleState, VehicleType,
} from '../types/index.js';
import type { QuestEvent, QuestEventKind, QuestPlace, QuestState } from './questTypes.js';
import type { QuestCutStep, QuestWorld } from './questData.js';
import { fieldStateOf, needsHeld, stageDone, stageMark } from './questStates.js';

export type EventSource =
  | { type: 'npc'; npc: MapNPC }
  | { type: 'encounter'; encounter: ScriptedEncounter }
  | { type: 'gate'; gate: KeyItemGate }
  | { type: 'spawn'; spawn: VehicleSpawn }
  | { type: 'stage'; stage: QuestStage };

/** A catalog event: QuestEvent plus where it comes from, its walk aliases, and its battle's enemy ids. */
export interface QuestEventSpec extends QuestEvent {
  source: EventSource;
  /** Fires without the party being anywhere (a pending stage's grant, a vehicle spawn). */
  auto: boolean;
  /** Other ids a `walk` step may use for it (`<map>:npc:<id>`, `<map>:chest:<item>`, `<map>:battle:<flag>`). */
  aliases: string[];
  /** The enemy ids of the battle it starts ([] when none). */
  boss: string[];
}

/** What firing an event changes. */
export interface QuestEffects {
  flags: string[];
  items: string[];
  takes: string[];
  gold: number;
  vehicles: VehicleState[];
  warp?: QuestPlace;
  /** Enemy ids of the battle fought. */
  battle?: string[];
}

export const none = (): QuestNeeds => ({ flags: [], items: [], vehicles: [] });

export function flagList(o: { requiredFlag?: string; requiredFlags?: string[] }): string[] {
  return [...(o.requiredFlag ? [o.requiredFlag] : []), ...(o.requiredFlags ?? [])];
}

/** The effects of a cutscene's steps (set_flag, give_item, take_item, set_vehicle, warp; the last warp wins). */
export function cutsceneEffects(world: QuestWorld, id: string | undefined): QuestEffects {
  const out: QuestEffects = { flags: [], items: [], takes: [], gold: 0, vehicles: [] };
  if (!id) return out;
  for (const s of world.cutscenes.get(id) ?? []) addStep(world, out, s);
  return out;
}

function addStep(world: QuestWorld, out: QuestEffects, s: QuestCutStep): void {
  if (s.type === 'set_flag' && s.flag) out.flags.push(s.flag);
  else if (s.type === 'give_item' && s.item) out.items.push(s.item);
  else if (s.type === 'take_item' && s.item) out.takes.push(s.item);
  else if (s.type === 'set_vehicle' && s.vehicle && s.map && s.x !== undefined && s.y !== undefined) {
    out.vehicles.push({ type: s.vehicle as VehicleType, map: s.map, x: s.x, y: s.y });
  } else if (s.type === 'warp' && s.map) {
    const m = world.maps.get(s.map);
    const e = s.entrance !== undefined ? m?.entrances?.[s.entrance] : undefined;
    if (e) out.warp = { map: s.map, x: e[0], y: e[1], mode: 'walking' };
    else if (s.x !== undefined && s.y !== undefined && m) out.warp = { map: s.map, x: s.x, y: s.y, mode: 'walking' };
  }
}

function merge(a: QuestEffects, b: QuestEffects): QuestEffects {
  return {
    flags: [...a.flags, ...b.flags], items: [...a.items, ...b.items], takes: [...a.takes, ...b.takes],
    gold: a.gold + b.gold, vehicles: [...a.vehicles, ...b.vehicles], warp: b.warp ?? a.warp,
    battle: a.battle ?? b.battle,
  };
}

export function encounterEffects(world: QuestWorld, e: ScriptedEncounter): QuestEffects {
  return merge({ flags: [e.flag], items: [], takes: [], gold: 0, vehicles: [], battle: e.enemyIds },
    cutsceneEffects(world, e.postVictoryCutscene));
}

export function npcKind(npc: MapNPC, battle: boolean): QuestEventKind {
  if (npc.chestItem) return 'chest';
  if (battle) return 'battle';
  if (npc.cutscene) return 'cutscene';
  if (npc.requiredItem || npc.takeGold !== undefined) return 'trade';
  if (npc.giftItem) return 'gift';
  if (npc.shopId || npc.action === 'inn') return 'shop';
  if (npc.action === 'clinic') return 'clinic';
  return 'npc';
}

/** A map's NPC is an event when it can change state or is a keeper (proof (e) asks when keepers become talkable). */
export function npcRelevant(world: QuestWorld, npc: MapNPC, battle: boolean): boolean {
  const keyGift = (it: string | undefined): boolean => it !== undefined && world.keyItems.has(it);
  return keyGift(npc.chestItem) || keyGift(npc.giftItem) || questFlag(world, npc.chestItem && npc.chestFlag)
    || questFlag(world, npc.giftItem && npc.giftFlag) || battle || !!npc.cutscene || !!npc.requiredItem
    || npc.takeGold !== undefined || !!npc.shopId || npc.action === 'inn' || npc.action === 'clinic';
}

/** A flag quest.yaml names (a stage's grant, requirement or milestone, or the goal): state even when an ordinary
 *  chest or gift sets it. */
export function questFlag(world: QuestWorld, f: string | undefined): boolean {
  if (!f) return false;
  return f === world.quest.goal || world.quest.stages.some((s) => s.grants.flags.includes(f)
    || s.requires.flags.includes(f) || (s.milestones ?? []).includes(f));
}

export function staticNpc(world: QuestWorld, npc: MapNPC, enc: ScriptedEncounter | undefined): {
  requires: QuestNeeds; grants: QuestNeeds; takes: { items: string[]; gold: number };
} {
  const requires = none();
  const grants = none();
  if (npc.showIf) requires.flags.push(npc.showIf);
  if (npc.requiredItem) requires.items.push(npc.requiredItem);
  if (npc.chestItem && world.keyItems.has(npc.chestItem)) {
    grants.items.push(npc.chestItem);
    if (npc.chestFlag) grants.flags.push(npc.chestFlag);
  } else if (npc.giftItem && world.keyItems.has(npc.giftItem)) {
    grants.items.push(npc.giftItem);
    if (npc.giftFlag) grants.flags.push(npc.giftFlag);
  } else if (questFlag(world, npc.chestItem && npc.chestFlag)) {
    grants.flags.push(npc.chestFlag!);
  } else if (questFlag(world, npc.giftItem && npc.giftFlag)) {
    // an ordinary item given while a quest flag is set (W1-I hand-off): the item is not state, the flag is
    grants.flags.push(npc.giftFlag!);
  }
  const parts: QuestEffects[] = [];
  if (npc.cutscene) {
    requires.flags.push(...flagList(npc.cutscene));
    parts.push(cutsceneEffects(world, npc.cutscene.id));
  }
  if (enc) {
    requires.flags.push(...flagList(enc));
    parts.push(encounterEffects(world, enc));
  }
  for (const p of parts) {
    grants.flags.push(...p.flags);
    grants.items.push(...p.items);
    grants.vehicles.push(...p.vehicles.map((v) => v.type));
  }
  const takes = { items: npc.takeItem && npc.requiredItem ? [npc.requiredItem] : [], gold: npc.takeGold ?? 0 };
  for (const p of parts) takes.items.push(...p.takes);
  return { requires, grants, takes };
}

/** Where a pending stage's synthetic grant puts a vehicle: its `entry.vehicles`, else nowhere in particular. */
export function entryVehicle(s: QuestStage, type: string): VehicleState {
  const v = s.entry?.vehicles?.find((e) => e.type === type);
  return v ? { ...v } : { type: type as VehicleType, map: '', x: -1, y: -1 };
}

/** The NPC's take, from npcOutcome (a string item, or `{item, gold}` once W1-B widens it). */
function outcomeTake(take: unknown): { item?: string; gold?: number } {
  if (typeof take === 'string') return { item: take };
  if (take && typeof take === 'object') {
    const t = take as { item?: unknown; gold?: unknown };
    return { item: typeof t.item === 'string' ? t.item : undefined, gold: typeof t.gold === 'number' ? t.gold : undefined };
  }
  return {};
}

function empty(): QuestEffects {
  return { flags: [], items: [], takes: [], gold: 0, vehicles: [] };
}

/**
 * What the event does in `state`, or null when it can't fire now (the NPC absent, the encounter done, the stage's
 * prerequisites unmet). The trade fallback covers `requiredItem` / `takeItem` until npcOutcome reports a take.
 */
export function effectsOf(world: QuestWorld, ev: QuestEventSpec, state: QuestState): QuestEffects | null {
  const fs = fieldStateOf(state);
  const src = ev.source;
  switch (src.type) {
    case 'stage': {
      const s = src.stage;
      if (stageDone(state, s.id) || !s.after.every((a) => stageDone(state, a)) || !needsHeld(state, s.requires)) return null;
      return {
        flags: [...s.grants.flags, stageMark(s.id)], items: [...s.grants.items], takes: [...(ev.takes.items)], gold: 0,
        vehicles: (ev.places ?? []).map((v) => ({ ...v })),
      };
    }
    case 'spawn': {
      const v = src.spawn;
      if (!flagsMet(v, state.flags) || state.place.mode === v.type) return null;
      if (state.vehicles.some((x) => x.type === v.type && x.map !== '')) return null;
      return { ...empty(), vehicles: [{ type: v.type, map: ev.map, x: v.x, y: v.y }] };
    }
    case 'gate': {
      const g = gateCheck(src.gate, fs);
      return g.open && g.setFlags.length ? { ...empty(), flags: g.setFlags } : null;
    }
    case 'encounter': {
      const due = dueEncounterWhere([src.encounter], () => true, fs);
      return due ? encounterEffects(world, due) : null;
    }
    case 'npc': {
      const map = world.maps.get(ev.map)!;
      const npc = src.npc;
      const out = npcOutcome(npc, fs, map.scriptedEncounters ?? []);
      if (!out.present) return null;
      let eff = empty();
      const take = outcomeTake(out.take);
      if (npc.requiredItem && take.item === undefined && !state.items.has(npc.requiredItem)) {
        // the trade fallback: without the item the NPC only talks
        out.give = undefined;
        out.setFlags = [];
      } else if (npc.requiredItem && take.item === undefined && npc.takeItem && (out.give || out.setFlags.length)) {
        eff.takes.push(npc.requiredItem);
      }
      if (take.item) eff.takes.push(take.item);
      eff.gold += take.gold ?? (npc.takeGold !== undefined && (out.give || out.setFlags.length) ? npc.takeGold : 0);
      if (out.give && world.keyItems.has(out.give)) eff.items.push(out.give);   // an ordinary gift is not state
      eff.flags.push(...out.setFlags);
      if (out.cutscene) eff = merge(eff, cutsceneEffects(world, out.cutscene));
      if (out.battle) {
        const enc = (map.scriptedEncounters ?? []).find((e) => e.flag === out.battle && e.npc === npc.id);
        if (enc) eff = merge(eff, encounterEffects(world, enc));
      }
      return eff;
    }
  }
}
