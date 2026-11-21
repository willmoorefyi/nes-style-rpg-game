/**
 * The extra input of W1-I's proofs (docs/WORLD_PLAN.md 6.0-6.2, docs/QUEST_PLAN.md 5.2 (d)): enemy rewards, the
 * kits and their prices, the macro-geography anchors (`world-anchors.yaml`), the travel-matrix rows and the allowed
 * docks. `buildLateData` is pure (the fixtures use it); `loadLateData` reads the repository. The data is attached
 * to a proof context with `attachLate`; `lateOf` loads it from the repository when nothing is attached.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { QuestContext } from './questProofs.js';
import { DEFAULT_TRAVEL_ROWS, type TravelRow } from './questTravelRows.js';

/** SpellPurchase.SPELL_PRICE_BY_LEVEL (src/systems may not be imported here; questLate.test.ts pins the copy). */
export const SPELL_PRICES: readonly number[] = [100, 400, 1500, 4000, 8000, 20000, 45000, 60000];

/** PartyManager.STARTING_GOLD (pinned by questLate.test.ts). */
export const START_GOLD = 400;

/** The 4-member party a kit's price is taken over (W1-F's figures: W / T / WM / BM). */
export const PRICE_PARTY: readonly string[] = ['warrior', 'thief', 'white_mage', 'black_mage'];

/** WORLD 2.6: the docks the world may have, with their basins. */
export const DOCKS_ALLOWED: Readonly<Record<string, string>> = {
  a1_pravoka: 'aldi', elf_port: 'aldi', ert_dwarf: 'aldi', ert_melmond: 'ocean', fir_crescent: 'ocean', fir_ice: 'ocean',
};

export interface GeoAnchor {
  name: string;
  entrance: string;
  region: string;
  built?: boolean;
  ref: [number, number];
  target: [number, number];
}

export interface GeoDetour {
  pair: [string, string];
  mode: string;
  factor: number;
}

/** NW2 (docs/NW2_EDITS_PLAN.md D-NW2-12): the hike bounds, one source with the composer's `landings` / `hikes`. */
export interface HikeBounds {
  /** K: no landing within this many steps of a hike site (foot+canoe). */
  floor: number;
  /** U: every airship-only anchor has a landing within this many steps in its mode (T6's `landingNear`). */
  cap: number;
  /** The anchors' modes (an anchor not listed walks). */
  sites: Readonly<Record<string, 'walking' | 'canoe'>>;
}

export interface GeoData {
  tolerance: number;
  scale: [number, number];
  longPair: number;
  ratio: { long: [number, number]; short: [number, number] };
  bearing: { long: number; short: number };
  anchors: GeoAnchor[];
  pairs: Array<[string, string]>;
  distanceExempt: Array<[string, string]>;
  detours: GeoDetour[];
  /** The `hike:` block (absent in pass W's file: then T6's landing check fails, naming it). */
  hike: HikeBounds | null;
}

export interface KitClass {
  gear: string[];
  spells: string[];
}

export interface LateData {
  enemies: ReadonlyMap<string, { xp: number; gold: number }>;
  itemPrices: ReadonlyMap<string, number>;
  spellLevels: ReadonlyMap<string, number>;
  kits: ReadonlyMap<string, Record<string, KitClass>>;
  startGold: number;
  geo: GeoData | null;
  travelRows: TravelRow[];
  docksAllowed: Readonly<Record<string, string>>;
  /** World-map coordinates = map coordinates + this offset (the legacy 72x72 act-1 map: the A1 origin). */
  worldOffset?: [number, number];
  /** NW-1 `--worst-canoe` (docs/NATURAL_WORLD_PLAN.md 4.3): proof (h) runs rows T0-T4 again with the canoe. */
  worstCanoe?: boolean;
}

export interface LateInput {
  enemies?: Array<{ id: string; xpReward?: number; goldReward?: number }>;
  items?: Array<{ id: string; price?: number }>;
  spells?: Array<{ id: string; level?: number; price?: number }>;
  kits?: Record<string, Record<string, KitClass>>;
  startGold?: number;
  geo?: unknown;
  travelRows?: TravelRow[];
  docksAllowed?: Record<string, string>;
}

/** The anchors file's bands (tolerance, fit.scale, longPair, ratio, bearing) come from the file, never from code
 *  defaults: pass W's file and NW's re-fitted one differ (docs/NATURAL_WORLD_PLAN.md 4.2). A missing band throws. */
function geoOf(raw: unknown): GeoData | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  const fit = (g.fit ?? {}) as Record<string, unknown>;
  const need = <T>(v: unknown, key: string): T => {
    if (v === undefined || v === null) throw new Error(`world-anchors: missing ${key}`);
    return v as T;
  };
  return {
    tolerance: Number(need(g.tolerance, 'tolerance')),
    scale: need<[number, number]>(fit.scale, 'fit.scale'),
    longPair: Number(need(fit.longPair, 'fit.longPair')),
    ratio: need<GeoData['ratio']>(fit.ratio, 'fit.ratio'),
    bearing: need<GeoData['bearing']>(fit.bearing, 'fit.bearing'),
    anchors: (g.anchors as GeoAnchor[]) ?? [],
    pairs: (g.pairs as Array<[string, string]>) ?? [],
    distanceExempt: (g.distanceExempt as Array<[string, string]>) ?? [],
    detours: (g.detours as GeoDetour[]) ?? [],
    hike: hikeOf(g.hike),
  };
}

/** A malformed `hike:` block throws (like a missing band); an absent one is null. */
function hikeOf(raw: unknown): HikeBounds | null {
  if (raw === undefined || raw === null) return null;
  const h = raw as Record<string, unknown>;
  const sites = (h.sites ?? {}) as Record<string, unknown>;
  if (typeof h.floor !== 'number' || typeof h.cap !== 'number' || typeof sites !== 'object'
    || Object.values(sites).some((m) => m !== 'walking' && m !== 'canoe')) {
    throw new Error(`world-anchors: malformed hike block ${JSON.stringify(raw)}`);
  }
  return { floor: h.floor, cap: h.cap, sites: sites as HikeBounds['sites'] };
}

export function buildLateData(input: LateInput): LateData {
  const spellLevels = new Map<string, number>();
  const prices = new Map<string, number>();
  for (const i of input.items ?? []) prices.set(i.id, i.price ?? 0);
  for (const s of input.spells ?? []) {
    spellLevels.set(s.id, s.level ?? 1);
    prices.set(`spell:${s.id}`, s.price ?? SPELL_PRICES[Math.min(SPELL_PRICES.length, Math.max(1, s.level ?? 1)) - 1]);
  }
  return {
    enemies: new Map((input.enemies ?? []).map((e) => [e.id, { xp: e.xpReward ?? 0, gold: e.goldReward ?? 0 }])),
    itemPrices: prices,
    spellLevels,
    kits: new Map(Object.entries(input.kits ?? {})),
    startGold: input.startGold ?? START_GOLD,
    geo: geoOf(input.geo),
    travelRows: input.travelRows ?? DEFAULT_TRAVEL_ROWS,
    docksAllowed: input.docksAllowed ?? DOCKS_ALLOWED,
  };
}

function readYaml(path: string): unknown {
  return existsSync(path) ? parse(readFileSync(path, 'utf-8')) : undefined;
}

/** The repository's late data (assets/data); `anchors` replaces `world-anchors.yaml` (NW-1 `--anchors FILE`). */
export function loadLateData(root: string = process.cwd(), opts: { anchors?: string; worstCanoe?: boolean } = {}): LateData {
  const d = join(root, 'assets/data');
  if (opts.anchors && !existsSync(opts.anchors)) throw new Error(`--anchors ${opts.anchors}: no such file`);
  const late = buildLateData({
    enemies: readYaml(join(d, 'enemies.yaml')) as LateInput['enemies'],
    items: readYaml(join(d, 'items.yaml')) as LateInput['items'],
    spells: readYaml(join(d, 'spells.yaml')) as LateInput['spells'],
    kits: readYaml(join(d, 'kits.yaml')) as LateInput['kits'],
    geo: readYaml(opts.anchors ?? join(d, 'world-anchors.yaml')),
  });
  return opts.worstCanoe ? { ...late, worstCanoe: true } : late;
}

const LATE = new WeakMap<QuestContext, LateData>();

export function attachLate(ctx: QuestContext, data: LateData): QuestContext {
  LATE.set(ctx, data);
  return ctx;
}

/** A `--flag VALUE` of the CLI's arguments (the late data is read from the same repository as the world). */
function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}

export function lateOf(ctx: QuestContext): LateData {
  let d = LATE.get(ctx);
  if (!d) {
    d = loadLateData(argValue('--root') ?? process.cwd(),
      { anchors: argValue('--anchors'), worstCanoe: process.argv.includes('--worst-canoe') });
    LATE.set(ctx, d);
  }
  return d;
}

/** The 4-member gear price of a kit (W1-F's figure: w_s1 520, w_pravoka 1725; spells are not counted), or null for
 *  an unknown kit. */
export function kitPrice(data: LateData, kit: string | null): number | null {
  const k = kit ? data.kits.get(kit) : undefined;
  if (!k) return null;
  let sum = 0;
  for (const cls of PRICE_PARTY) {
    const c = k[cls];
    if (!c) continue;
    for (const g of c.gear ?? []) sum += data.itemPrices.get(g) ?? 0;
  }
  return sum;
}
