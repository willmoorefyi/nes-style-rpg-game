/**
 * The mutation suite's edits (docs/WORLD_PLAN.md 6.3, docs/QUEST_PLAN.md 5.4): copy a world with one element
 * changed. An element names where it is (`map`, `kind`, `at`: world cells on the world map) so it can be matched
 * against a stage's `nonLoadBearing`. The world's other maps and data are shared, never changed.
 */
import { TerrainType } from '../types/index.js';
import type { MapData, MapNPC, QuestData } from '../types/index.js';
import type { QuestWorld } from './questData.js';
import { worldOffsetOf } from './questGeo.js';

export type ElementKind = 'gate' | 'transition' | 'npc' | 'encounter' | 'spawn' | 'patch' | 'dock' | 'cut' | 'quest';

export interface MutElement {
  map: string;
  kind: ElementKind;
  /** World cells on the world map, map cells elsewhere. */
  at: [number, number];
  /** What is changed, e.g. `npc giant requiredItem ruby`. */
  label: string;
  /** Identity for de-duplicating the generic list against the named rows. */
  key: string;
  /** The flags and items it reads (a generic element of a pending stage's gate is pending). */
  reads?: string[];
  apply: (w: QuestWorld) => QuestWorld;
}

type Flagged = { requiredFlag?: string; requiredFlags?: string[] };

/** The world with one map replaced by an edited deep copy. */
export function editMap(w: QuestWorld, id: string, fn: (m: MapData) => void): QuestWorld {
  const src = w.maps.get(id);
  if (!src) return w;
  const copy = structuredClone(src);
  fn(copy);
  const maps = new Map(w.maps);
  maps.set(id, copy);
  return { ...w, maps };
}

/** The world with `quest.yaml` replaced by an edited deep copy. */
export function editQuest(w: QuestWorld, fn: (q: QuestData) => void): QuestWorld {
  const quest = structuredClone(w.quest);
  fn(quest);
  return { ...w, quest, stages: new Map(quest.stages.map((s) => [s.id, s])) };
}

/** A map cell in world cells when the map is the world map. */
export function worldAt(w: QuestWorld, map: string, x: number, y: number): [number, number] {
  if (map !== w.worldMap) return [x, y];
  const [ox, oy] = worldOffsetOf(w.maps.get(map));
  return [x + ox, y + oy];
}

/** Map cells of world cells on the world map. */
export function mapCell(w: QuestWorld, x: number, y: number): [number, number] {
  const [ox, oy] = worldOffsetOf(w.maps.get(w.worldMap));
  return [x - ox, y - oy];
}

export function flagsOf(o: Flagged): string[] {
  return [...(o.requiredFlag ? [o.requiredFlag] : []), ...(o.requiredFlags ?? [])];
}

function dropFlag(o: Flagged, f: string): void {
  if (o.requiredFlag === f) delete o.requiredFlag;
  if (o.requiredFlags) o.requiredFlags = o.requiredFlags.filter((x) => x !== f);
}

/** An NPC's flag conditions: presence, its cutscene, its scripted encounter. */
export function npcFlags(map: MapData, n: MapNPC): string[] {
  const enc = (map.scriptedEncounters ?? []).filter((e) => e.npc === n.id);
  return [...(n.showIf ? [n.showIf] : []), ...(n.cutscene ? flagsOf(n.cutscene) : []), ...enc.flatMap(flagsOf)];
}

/** Remove a flag condition from an NPC (showIf, its cutscene's, its encounter's). */
export function npcDropFlag(map: MapData, id: string, f: string): void {
  const n = map.npcs.find((x) => x.id === id);
  if (!n) return;
  if (n.showIf === f) delete n.showIf;
  if (n.cutscene) dropFlag(n.cutscene, f);
  for (const e of map.scriptedEncounters ?? []) if (e.npc === id) dropFlag(e, f);
}

/** Remove a flag condition from the element at a cell of a kind. */
export function dropFlagAt(map: MapData, kind: ElementKind, x: number, y: number, f: string): void {
  if (kind === 'gate') for (const g of map.keyItemGates ?? []) if (g.x === x && g.y === y) dropFlag(g, f);
  if (kind === 'transition') for (const t of map.transitions) if (t.x === x && t.y === y) dropFlag(t, f);
  if (kind === 'encounter') for (const e of map.scriptedEncounters ?? []) if (e.x === x && e.y === y) dropFlag(e, f);
  if (kind === 'spawn') for (const v of map.vehicles ?? []) if (v.x === x && v.y === y) dropFlag(v, f);
}

/** Remove an item condition (an NPC's `requiredItem` and `takeItem`, or a gate's). */
export function dropItemAt(map: MapData, kind: ElementKind, x: number, y: number, item: string, npcId?: string): void {
  if (kind === 'npc') {
    const n = map.npcs.find((v) => v.id === npcId);
    if (n?.requiredItem === item) { delete n.requiredItem; delete n.takeItem; }
  }
  if (kind === 'gate') for (const g of map.keyItemGates ?? []) if (g.x === x && g.y === y && g.requiredItem === item) delete g.requiredItem;
}

/** Cells (world cells on the world map) set to a terrain; gates on them go too (the cell is open ground). */
export function setCells(w: QuestWorld, cells: Array<[number, number]>, terrain: TerrainType): QuestWorld {
  return editMap(w, w.worldMap, (m) => {
    const local = new Set(cells.map(([x, y]) => mapCell(w, x, y)).map(([x, y]) => y * m.width + x));
    for (const c of local) if (c >= 0 && c < m.collision.length) m.collision[c] = terrain;
    m.keyItemGates = (m.keyItemGates ?? []).filter((g) => !local.has(g.y * m.width + g.x));
  });
}

/** A patch forced on from the start: its cells take its terrain for good, with no condition on them. */
export function forcePatch(w: QuestWorld, mapId: string, pid: string): QuestWorld {
  const m = w.maps.get(mapId);
  const p = m?.patches?.find((x) => x.id === pid);
  if (!m || !p) return w;
  return editMap(w, mapId, (c) => {
    const cells = new Set(p.cells.map(([x, y]) => y * c.width + x));
    for (const i of cells) c.collision[i] = p.terrain;
    c.keyItemGates = (c.keyItemGates ?? []).filter((g) => !cells.has(g.y * c.width + g.x));
    c.patches = (c.patches ?? []).filter((x) => x.id !== pid);
  });
}

export const GRASS = TerrainType.Grass;
export const WATER = TerrainType.Water;
