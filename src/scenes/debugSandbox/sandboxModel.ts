import { MAX_LAYOUT } from '../battle/EnemyLayoutAi.js';
import type { EnemyAiPatterns } from '../battle/BattleSceneTypes.js';

/**
 * The battle sandbox's pure model (docs/FEEDBACK_PLAN_2026-11-14.md §3.8): the data in
 * `assets/data/debug-sandbox.yaml`, the current configuration, value cycling, the custom formation and the deep link.
 */

export interface SandboxLevel {
  id: string;
  name: string;
  /** The party's level. */
  level: number;
  /** A kit name in kits.yaml. */
  kit: string;
  items: Record<string, number>;
  gold: number;
  /** Enemy-id lists, at most MAX_LAYOUT each. */
  formations: string[][];
  /** A background id (`assets/backgrounds/<id>.webp`). */
  background?: string;
  enemyAi?: EnemyAiPatterns;
}

export interface SandboxData {
  /** `promoted[i]` is the upgrade of `base[i]`. */
  classes: { base: string[]; promoted: string[] };
  kits: string[];
  backgrounds: string[];
  /** The slots' default classes. */
  party: string[];
  levels: SandboxLevel[];
}

export const AUTO = 'auto';
/** `formation` value for the custom list. */
export const CUSTOM = -1;
export const MAX_CUSTOM = MAX_LAYOUT;
export const PARTY_SIZE = 4;

export interface SandboxConfig {
  level: string;
  party: string[];
  /** The promoted classes join the class cycle. */
  promoted: boolean;
  /** AUTO (the level's kit) or a kit name. */
  kit: string;
  /** An index into the level's formations, or CUSTOM. */
  formation: number;
  custom: string[];
  /** AUTO (the level's background) or a background id. */
  background: string;
}

export function defaultConfig(data: SandboxData): SandboxConfig {
  const party = Array.from({ length: PARTY_SIZE }, (_, i) => data.party[i] ?? data.classes.base[0]);
  return { level: data.levels[0].id, party, promoted: false, kit: AUTO, formation: 0, custom: [], background: AUTO };
}

/** Step `value` by `dir` through `options` (wrapping); an unknown value starts at the first option. */
export function cycle<T>(options: readonly T[], value: T, dir: number): T {
  const i = options.indexOf(value);
  if (i < 0) return options[0];
  return options[(i + dir + options.length * 2) % options.length];
}

export function levelOf(data: SandboxData, config: SandboxConfig): SandboxLevel {
  return data.levels.find((l) => l.id === config.level) ?? data.levels[0];
}

export function classOptions(data: SandboxData, config: SandboxConfig): string[] {
  return config.promoted ? [...data.classes.base, ...data.classes.promoted] : [...data.classes.base];
}

export function cycleLevel(data: SandboxData, config: SandboxConfig, dir: number): SandboxConfig {
  const level = cycle(data.levels.map((l) => l.id), config.level, dir);
  return { ...config, level, formation: config.formation === CUSTOM ? CUSTOM : 0 };
}

export function cycleClass(data: SandboxData, config: SandboxConfig, slot: number, dir: number): SandboxConfig {
  const party = [...config.party];
  party[slot] = cycle(classOptions(data, config), party[slot], dir);
  return { ...config, party };
}

/** Turning promoted off demotes every promoted member to its base class. */
export function togglePromoted(data: SandboxData, config: SandboxConfig): SandboxConfig {
  const promoted = !config.promoted;
  const party = promoted ? config.party : config.party.map((c) => {
    const i = data.classes.promoted.indexOf(c);
    return i < 0 ? c : data.classes.base[i];
  });
  return { ...config, promoted, party };
}

export function cycleKit(data: SandboxData, config: SandboxConfig, dir: number): SandboxConfig {
  return { ...config, kit: cycle([AUTO, ...data.kits], config.kit, dir) };
}

/** Through the level's formations, then Custom. */
export function cycleFormation(data: SandboxData, config: SandboxConfig, dir: number): SandboxConfig {
  const options = [...levelOf(data, config).formations.map((_, i) => i), CUSTOM];
  return { ...config, formation: cycle(options, config.formation, dir) };
}

export function cycleBackground(data: SandboxData, config: SandboxConfig, dir: number): SandboxConfig {
  return { ...config, background: cycle([AUTO, ...data.backgrounds], config.background, dir) };
}

/** Add an enemy to the custom list (and select Custom); false when the list already holds MAX_CUSTOM. */
export function addCustom(config: SandboxConfig, enemyId: string): { config: SandboxConfig; added: boolean } {
  if (config.custom.length >= MAX_CUSTOM) return { config: { ...config, formation: CUSTOM }, added: false };
  return { config: { ...config, formation: CUSTOM, custom: [...config.custom, enemyId] }, added: true };
}

export function removeLastCustom(config: SandboxConfig): SandboxConfig {
  return { ...config, custom: config.custom.slice(0, -1) };
}

/** The enemies the next fight uses. */
export function enemiesOf(data: SandboxData, config: SandboxConfig): string[] {
  if (config.formation === CUSTOM) return [...config.custom];
  const formations = levelOf(data, config).formations;
  return [...(formations[config.formation] ?? formations[0] ?? [])];
}

export function kitOf(data: SandboxData, config: SandboxConfig): string {
  return config.kit === AUTO ? levelOf(data, config).kit : config.kit;
}

/** The background id the next fight uses (none: the plain two-tone stage). */
export function backgroundOf(data: SandboxData, config: SandboxConfig): string | undefined {
  return config.background === AUTO ? levelOf(data, config).background : config.background;
}

export const backgroundPath = (id: string | undefined): string | undefined =>
  id ? `assets/backgrounds/${id}.webp` : undefined;

/** One key per resolved setup (level, classes, kit, enemies, background), for the results tally. */
export function configKey(data: SandboxData, config: SandboxConfig): string {
  return [levelOf(data, config).id, config.party.join(','), kitOf(data, config), enemiesOf(data, config).join(','),
    backgroundOf(data, config) ?? '-'].join('|');
}

/** A stored or hand-made configuration made valid: unknown values log `console.warn` and fall back. */
export function sanitizeConfig(data: SandboxData, raw: unknown, enemyIds: ReadonlySet<string>): SandboxConfig {
  const base = defaultConfig(data);
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Partial<Record<keyof SandboxConfig, unknown>>;
  const warn = (what: string, v: unknown): void => console.warn(`Debug sandbox: unknown ${what} ${JSON.stringify(v)}; using the default`);
  const out: SandboxConfig = { ...base, promoted: r.promoted === true };
  if (r.level !== undefined) {
    if (data.levels.some((l) => l.id === r.level)) out.level = r.level as string; else warn('level', r.level);
  }
  const classes = [...data.classes.base, ...data.classes.promoted];
  if (Array.isArray(r.party)) {
    out.party = base.party.map((d, i) => {
      const c: unknown = (r.party as unknown[])[i];
      if (c === undefined) return d;
      if (typeof c === 'string' && classes.includes(c)) return c;
      warn('class', c);
      return d;
    });
    if (out.party.some((c) => data.classes.promoted.includes(c))) out.promoted = true;
  }
  if (r.kit !== undefined) {
    if (r.kit === AUTO || data.kits.includes(r.kit as string)) out.kit = r.kit as string; else warn('kit', r.kit);
  }
  if (r.background !== undefined) {
    if (r.background === AUTO || data.backgrounds.includes(r.background as string)) out.background = r.background as string;
    else warn('background', r.background);
  }
  if (Array.isArray(r.custom)) {
    out.custom = r.custom.filter((e): e is string => {
      const ok = typeof e === 'string' && enemyIds.has(e);
      if (!ok) warn('enemy', e);
      return ok;
    }).slice(0, MAX_CUSTOM);
  }
  const formations = levelOf(data, out).formations.length;
  if (r.formation === CUSTOM || (typeof r.formation === 'number' && Number.isInteger(r.formation) && r.formation >= 0
    && r.formation < formations)) out.formation = r.formation;
  return out;
}

/**
 * `?sandbox=<level>&party=<ids>&enemies=<ids>` as a configuration, or null without `sandbox=`. Unknown ids log and
 * fall back (an unknown level: the first; an unknown class: that slot's default; unknown enemies are dropped).
 */
export function parseDeepLink(data: SandboxData, search: string, enemyIds: ReadonlySet<string>): SandboxConfig | null {
  const params = new URLSearchParams(search);
  const level = params.get('sandbox');
  if (level === null) return null;
  const list = (key: string): string[] | undefined =>
    params.get(key)?.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  const raw: Record<string, unknown> = { level };
  const party = list('party');
  if (party) raw.party = party;
  const kit = params.get('kit');
  if (kit) raw.kit = kit;
  const enemies = list('enemies');
  if (enemies) {
    raw.custom = enemies;
    raw.formation = CUSTOM;
  }
  const config = sanitizeConfig(data, raw, enemyIds);
  // every listed enemy was unknown: fight the level's first formation instead of nobody
  if (config.formation === CUSTOM && config.custom.length === 0) config.formation = 0;
  return config;
}
