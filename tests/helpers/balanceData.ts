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
import { runBattle, mulberry32, type Policy } from './battlePolicies.js';
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

/** `found` (pass EQ D-EQ11): chest items equipped after `gear`, each replacing its slot's item; never priced. */
export interface Kit { gear: string[]; found?: string[]; spells: string[] }

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
  for (const id of [...kit.gear, ...(kit.found ?? [])]) {
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
/**
 * The plan's party (or `comp`) at `level` with a kit (any kits.yaml name, e.g. `full` or a pass W `w_s5`); careless
 * play knows no spells (the simulation's rule).
 */
export function makeParty(level: number, kit: KitName | string, withSpells: boolean, comp: string[] = PARTY): Character[] {
  return comp.map((cls, i) => {
    const k = KITS[kit]?.[cls];
    if (!k) throw new Error(`kits.yaml has no ${kit}.${cls}`);
    return makeMember(cls, level, { gear: k.gear, found: k.found, spells: withSpells ? k.spells : [] }, i);
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
/** The formations of a table made only of wolves (the play test's wolf-heavy temple approach). */
const wolvesOnly = (table: EncounterEntry[]): EncounterEntry[] =>
  table.filter((e) => (e.groups ?? []).length > 0 && (e.groups ?? []).every((g) => g.id === 'wolf'));
export const ZONE_TABLES: Record<'fields' | 'approach' | 'approach_wolves' | 'east' | 'temple', EncounterEntry[]> = {
  fields: OVERWORLD.encounters ?? [],
  approach: zoneTable(OVERWORLD, 'temple_approach'),
  approach_wolves: wolvesOnly(zoneTable(OVERWORLD, 'temple_approach')),
  east: zoneTable(OVERWORLD, 'east_pocket'),
  temple: TEMPLE.encounters ?? [],
};
export type Zone = keyof typeof ZONE_TABLES;

/** A formation rolled by the real EncounterTable on the battle's RNG stream. */
export function rollFormation(zone: Zone, rng: () => number): EnemyData[] {
  return rollFrom(ZONE_TABLES[zone], rng);
}

/** A formation rolled from any encounter table (e.g. a compiled zone's `encounters`) on the battle's RNG stream. */
export function rollFrom(table: EncounterEntry[], rng: () => number): EnemyData[] {
  const t = new EncounterTable(rng);
  t.setEntries(table);
  return t.selectEnemies().map(enemyCopy);
}

// ── pass W helpers (docs/QUEST_PLAN.md 4.4, 6.2, 6.3; docs/WORLD_PLAN.md 3.7) ──

/** The upgraded party the boss tests use from S20 on (QUEST open question 3): Knight / Ninja / W.Wiz / B.Wiz. */
export const UPGRADED_PARTY = ['knight', 'ninja', 'white_wizard', 'black_wizard'];

export interface SimOptions {
  /** The party's classes (default `PARTY`; `UPGRADED_PARTY` from S20 on). */
  comp?: string[];
  /** Potions the policy may use (default 3; a floor run shares them over its fights). */
  potions?: number;
  /** A boss form chain (`formChain`), for a fight with forms. */
  forms?: EnemyData[];
  /** Added to every seed, so two cases of one test need not share a stream. */
  salt?: number;
}

const seedOf = (s: number, level: number, salt: number): number => s * 7919 + level * 131 + salt * 104729;

/**
 * The share (0-1) of `seeds` seeded battles that a party at `level` with the kits.yaml `kit` wins against the enemy
 * `ids` (a fresh copy each), on the real `BattleStateMachine` with `policy` (QUEST 6.2: 400 seeds per policy).
 */
export function bossWinRate(ids: string[], level: number, kit: string, policy: Policy, seeds: number,
  opts: SimOptions = {}): number {
  let wins = 0;
  for (let s = 1; s <= seeds; s++) {
    const rng = mulberry32(seedOf(s, level, opts.salt ?? 0));
    const party = makeParty(level, kit, policy !== 'careless', opts.comp);
    const r = runBattle(party, ids.map(enemyCopy), SPELLS, policy, rng, { potions: { n: opts.potions ?? 3 }, forms: opts.forms });
    if (r.outcome === 'victory') wins++;
  }
  return wins / seeds;
}

/**
 * QUEST 6.3's floor run: the share (0-1) of `seeds` runs (default 200) in which a sensible party at `level` with `kit`
 * survives `fights` battles in a row rolled from `zoneTable`, with no inn and the potions shared (default 3).
 */
export function floorRun(zoneTable: EncounterEntry[], fights: number, level: number, kit: string,
  opts: SimOptions & { seeds?: number } = {}): number {
  const seeds = opts.seeds ?? 200;
  let survived = 0;
  for (let s = 1; s <= seeds; s++) {
    const rng = mulberry32(seedOf(s, level, (opts.salt ?? 0) + fights));
    const party = makeParty(level, kit, true, opts.comp);
    const shared = { n: opts.potions ?? 3 };
    let alive = true;
    for (let f = 0; f < fights && alive; f++) {
      alive = runBattle(party, rollFrom(zoneTable, rng), SPELLS, 'sensible', rng, { potions: shared }).outcome === 'victory';
    }
    if (alive) survived++;
  }
  return survived / seeds;
}
