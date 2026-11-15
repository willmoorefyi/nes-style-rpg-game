/**
 * Real game data and the T4 kits for the balance tests (docs/FIX_PLAN_PENINSULA.md T4 §1.5, §4).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { Character } from '../../src/entities/Character.js';
import { slotOf } from '../../src/entities/EquipmentRules.js';
import { EncounterTable } from '../../src/systems/EncounterTable.js';
import type { CharacterClassData, EncounterEntry, EnemyData, ItemData, MapData, ShopData, SpellData } from '../../src/types/index.js';

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/data');
const read = <T>(file: string): T => parse(readFileSync(join(dataDir, file), 'utf-8')) as T;

export const CLASSES = read<CharacterClassData[]>('classes.yaml');
export const ITEMS = read<ItemData[]>('items.yaml');
export const SPELLS = read<SpellData[]>('spells.yaml');
export const ENEMIES = read<EnemyData[]>('enemies.yaml');
export const SHOPS = read<ShopData[]>('shops.yaml');

function byId<T extends { id: string }>(list: T[], id: string, what: string): T {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`${what} "${id}" is not in the data`);
  return found;
}
export const item = (id: string): ItemData => byId(ITEMS, id, 'item');
export const spell = (id: string): SpellData => byId(SPELLS, id, 'spell');
export const enemy = (id: string): EnemyData => byId(ENEMIES, id, 'enemy');
export const classOf = (id: string): CharacterClassData => byId(CLASSES, id, 'class');
/** A fresh copy for one battle. */
export const enemyCopy = (id: string): EnemyData => structuredClone(enemy(id));

export interface Kit { gear: string[]; spells: string[] }

/** assets/data/kits.yaml: kit name -> class id -> gear and spells (F0 of docs/FEEDBACK_PLAN_2026-11-14.md). */
export const KITS = read<Record<string, Record<string, Kit>>>('kits.yaml');

/**
 * The 400 G starting kit per base class (§1.5, revision 10). The Red Mage starts with no spell: with one, a party of
 * the three mages and a Warrior would pass 400 G.
 */
export const START_KIT: Record<string, Kit> = KITS.start;

/** The full kit (§4): + chain mail, caps, LIT, SLEP, RUSE (plus 3 potions, passed to the battle). */
export const FULL_KIT: Record<string, Kit> = KITS.full;

/** The plan's party: Warrior / Thief / White Mage / Black Mage. */
export const PARTY = ['warrior', 'thief', 'white_mage', 'black_mage'];

/** What a kit costs at the real shop prices (spells at their price or the per-level table, via `spellCost`). */
export function kitCost(kit: Kit, spellCost: (s: SpellData) => number): number {
  return kit.gear.reduce((sum, id) => sum + item(id).price, 0) + kit.spells.reduce((sum, id) => sum + spellCost(spell(id)), 0);
}

/** A character of `cls` at `level`, wearing `gear` (the real equip rules: throws if refused) and knowing `spells`. */
export function makeMember(cls: string, level: number, kit: Kit, index = 0): Character {
  const c = new Character({ name: `${cls}${index}`, classData: classOf(cls), level });
  for (const id of kit.gear) {
    const it = item(id);
    const slot = slotOf(it);
    if (!slot || c.equip(slot, it) === false) throw new Error(`${cls} cannot equip ${id}`);
  }
  for (const id of kit.spells) c.learnSpell(id, spell(id).level);
  c.restoreAllCharges();
  return c;
}

export type KitName = 'start' | 'lv2' | 'arrive' | 'full' | 'naked';
/**
 * The potions that go with each kit in the balance tests (docs/FEEDBACK_PLAN_2026-11-14.md §3.2): the `lv2` and
 * `arrive` kits carry the 2 potions the pass-F gold buys at Lv 2; `full` carries 3 (T4 §4). kits.yaml holds gear and
 * spells per class only, so its every entry stays a class kit (the sandbox gives its levels their own `items`).
 */
export const KIT_POTIONS: Record<KitName, number> = { start: 0, lv2: 2, arrive: 2, full: 3, naked: 0 };
/** The plan's party (or `comp`) at `level` with a kit; careless play knows no spells (the simulation's rule). */
export function makeParty(level: number, kit: KitName, withSpells: boolean, comp: string[] = PARTY): Character[] {
  return comp.map((cls, i) => {
    const k = KITS[kit]?.[cls];
    if (!k) throw new Error(`kits.yaml has no ${kit}.${cls}`);
    return makeMember(cls, level, { gear: k.gear, spells: withSpells ? k.spells : [] }, i);
  });
}

// ── §1.6 formation tables, read from the compiled act-1 maps (T4e; revision 3) ──
const mapsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/maps');
/** A map as the game loads it: the compiled 2x map (`ai/<id>.yaml`), or the legacy 1x one with `legacy`. */
export const readMap = (id: string, legacy = false): MapData =>
  parse(readFileSync(join(mapsDir, legacy ? `${id}.yaml` : `ai/${id}.yaml`), 'utf-8')) as MapData;
export const OVERWORLD = readMap('overworld');
export const TEMPLE = readMap('temple-of-fiends');
const zoneTable = (map: MapData, id: string): EncounterEntry[] => {
  const zone = (map.encounterZones ?? []).find((z) => z.id === id);
  if (!zone) throw new Error(`map ${map.id} has no encounter zone "${id}"`);
  return zone.encounters;
};
export const ZONE_TABLES: Record<'fields' | 'approach' | 'east' | 'temple', EncounterEntry[]> = {
  fields: OVERWORLD.encounters ?? [],
  approach: zoneTable(OVERWORLD, 'temple_approach'),
  east: zoneTable(OVERWORLD, 'east_pocket'),
  temple: TEMPLE.encounters ?? [],
};
export type Zone = keyof typeof ZONE_TABLES;

/** A formation rolled by the real EncounterTable on the battle's RNG stream. */
export function rollFormation(zone: Zone, rng: () => number): EnemyData[] {
  const table = new EncounterTable(rng);
  table.setEntries(ZONE_TABLES[zone]);
  return table.selectEnemies().map(enemyCopy);
}
