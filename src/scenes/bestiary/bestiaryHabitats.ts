/**
 * Where each enemy lives (docs/BESTIARY_PLAN.md 3.7) and which background its bestiary page shows (3.2). Pure.
 * Tables per map: the main `encounters` (kind main), each `encounterZones[]` entry (zone), `scriptedEncounters[]`
 * (boss when `isBoss`, else main). Ids come from `groups[].id` (a `min: 0` group counts) and old-style `enemies[]`.
 */
import type { EncounterEntry, MapData } from '../../types/index.js';
import type { BestiaryData } from '../../types/bestiaryData.js';

/** One map an enemy appears on. */
export interface Habitat {
  mapId: string;
  /** The map's display name (its id when it has none). */
  map: string;
  /** In the main table (or scripted without isBoss): main wins over its zones. */
  main: boolean;
  /** encounterZones ids it appears in, in map order (used only when not `main`). */
  zones: string[];
  /** A scripted isBoss encounter names it. */
  boss: boolean;
  /** The background its first table there would use. */
  background: string | undefined;
}

const idsOf = (entries: readonly EncounterEntry[] | undefined): Set<string> => {
  const out = new Set<string>();
  for (const e of entries ?? []) {
    for (const g of e.groups ?? []) out.add(g.id);
    for (const id of e.enemies ?? []) out.add(id);
  }
  return out;
};

/** Every enemy's habitats, per map in `maps` order. */
export function habitatsOf(maps: readonly MapData[]): Map<string, Habitat[]> {
  const out = new Map<string, Habitat[]>();
  for (const m of maps) {
    const here = new Map<string, Habitat>();
    const get = (id: string): Habitat => {
      let h = here.get(id);
      if (!h) {
        h = { mapId: m.id, map: m.name ?? m.id, main: false, zones: [], boss: false, background: undefined };
        here.set(id, h);
      }
      return h;
    };
    const mapDefault = m.battleBackgrounds?.default;
    for (const id of idsOf(m.encounters)) Object.assign(get(id), { main: true });
    for (const z of m.encounterZones ?? []) {
      for (const id of idsOf(z.encounters)) {
        const h = get(id);
        if (!h.zones.includes(z.id)) h.zones.push(z.id);
      }
    }
    for (const s of m.scriptedEncounters ?? []) {
      for (const id of new Set(s.enemyIds)) {
        const h = get(id);
        if (s.isBoss) h.boss = true;
        else h.main = true;
      }
    }
    for (const [id, h] of here) {
      const zone = !h.main && h.zones.length > 0 ? m.battleBackgrounds?.zones?.[h.zones[0]]?.default : undefined;
      h.background = zone ?? mapDefault;
      out.set(id, [...(out.get(id) ?? []), h]);
    }
  }
  return out;
}

const fill = (t: string, vars: Record<string, string>): string => t.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

/** "World Map (East pocket), Temple of Fiends (boss)"; `notPlaced` when it is on no scanned map. */
export function habitatText(habitats: readonly Habitat[] | undefined, data: BestiaryData): string {
  const t = data.templates;
  const parts: string[] = [];
  for (const h of habitats ?? []) {
    if (h.main) parts.push(fill(t.habitatMain, { map: h.map }));
    else if (h.zones.length > 0) {
      const zones = h.zones.map((z) => data.habitats.zones[z] ?? z).join(t.list);
      parts.push(fill(t.habitatZone, { map: h.map, zones }));
    }
    if (h.boss) parts.push(fill(t.habitatBoss, { map: h.map }));
  }
  return parts.length > 0 ? parts.join(t.list) : t.notPlaced;
}

/** The background id: the bestiary override, else the first habitat's, else the bestiary default. */
export function backgroundFor(enemyId: string, habitats: readonly Habitat[] | undefined, data: BestiaryData): string {
  return data.backgrounds.enemies[enemyId] ?? habitats?.find((h) => h.background)?.background ?? data.backgrounds.default;
}
