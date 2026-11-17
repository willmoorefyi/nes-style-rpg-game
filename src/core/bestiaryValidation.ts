/**
 * Validator for assets/data/bestiary.yaml (docs/BESTIARY_PLAN.md 3.4). Never throws: an unknown key, a bad value or a
 * missing label or template logs `console.error` and that key falls back to its built-in default below.
 */
import {
  BESTIARY_LABEL_KEYS, BESTIARY_STEPS, TEMPLATE_PLACEHOLDERS,
  type BestiaryData, type BestiaryLabels, type BestiaryStep, type BestiaryTemplates,
} from '../types/bestiaryData.js';

/** The built-in defaults (the shipped bestiary.yaml has the same values). */
export const DEFAULT_BESTIARY: BestiaryData = {
  mode: 'all', order: 'data', listRows: 6,
  habitats: { maps: ['overworld', 'temple-of-fiends'], zones: {} },
  backgrounds: { default: 'grassland', enemies: {} },
  anim: { order: [...BESTIARY_STEPS], firstBreak: 30, idleBreak: 60, dazeHold: 144 },
  labels: {
    title: 'BESTIARY', boss: 'Boss', hp: 'HP', attack: 'Attack', hits: 'Hits', damage: 'Dmg/hit', defense: 'Defense',
    magicDefense: 'Mag.Def', strength: 'Strength', agility: 'Agility', intelligence: 'Intellect', vitality: 'Vitality',
    luck: 'Luck', accuracy: 'Accuracy', evade: 'Evade', family: 'Family', size: 'Size', attacks: 'Attacks', xp: 'XP',
    gold: 'Gold', weak: 'Weak', resist: 'Resist', immune: 'Immune', absorb: 'Absorb', statusHit: 'Status hit',
    actions: 'Actions', spells: 'Spells', habitat: 'Habitat', none: 'None', unknown: '???', blank: '-', paused: 'Paused',
    noArt: 'No art yet', noData: 'No bestiary data', info: 'Info', specials: 'Specials', onHit: 'On hit',
    noDescription: 'No description yet',
    sizes: { small: 'Small', large: 'Large', huge: 'Huge', boss: 'Boss', titan: 'Titan' },
    attackKinds: { melee: 'Melee', heavy: 'Melee (heavy)', ranged: 'Ranged' },
    anim: { attack: 'Attack', heavy: 'Attack (heavy)', ranged: 'Attack (ranged)', hurt: 'Hurt', cast: 'Cast', daze: 'Dazed' },
  },
  templates: {
    entry: '{num} {name}', titleCount: '{entry}  {index}/{total}', damage: '{min}-{max}', hits: 'x{hits}',
    fight: 'Fight x{hits}', statusHit: '{pct}% (spell accuracy {acc})', phase: 'At {pct}% HP', phaseHits: 'Fight x{hits}',
    phaseAttack: 'Attack {attack}', phaseMessage: '"{message}"', phaseForm: 'becomes the {form}', habitatMain: '{map}', habitatZone: '{map} ({zones})',
    habitatBoss: '{map} (boss)', notPlaced: 'Not placed yet', list: ', ', special: '{name} {pct}%',
    loreTitle: 'Lore {page}/{pages}',
  },
  elements: { fire: 'Fire', ice: 'Ice', lightning: 'Bolt', earth: 'Earth', holy: 'Holy', dark: 'Dark', water: 'Water', wind: 'Wind' },
  families: {},
  protections: { status: 'Status', poison_stone: 'Poison/Stone', death: 'Death', earth: 'Earth', time: 'Time' },
  statuses: { poison: 'Poison', stun: 'Paralysis', sleep: 'Sleep', blind: 'Blind', stone: 'Stone', death: 'Death' },
  spellNames: {},
  specialNames: {},
  formTitles: {},
  lore: {},
  help: 'Up/Down: scroll   Left/Right: page   Z: next move   C: info/lore   Shift: pause   X: close',
};

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** `{name}` placeholders used by a template. */
export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

class Checker {
  constructor(private readonly path: string) {}

  error(key: string, what: string): void {
    console.error(`${this.path}: ${key} ${what}; using the default`);
  }

  /** `raw[key]` when `ok`, else the default (logged). */
  value<T>(raw: Raw, key: string, def: T, ok: (v: unknown) => boolean, where = key): T {
    if (ok(raw[key])) return raw[key] as T;
    this.error(where, raw[key] === undefined ? 'is missing' : `is invalid (${JSON.stringify(raw[key])})`);
    return def;
  }

  unknownKeys(raw: Raw, known: readonly string[], where: string): void {
    for (const k of Object.keys(raw)) if (!known.includes(k)) console.error(`${this.path}: unknown key ${where}${k}`);
  }

  /** A section with fixed string keys (labels, templates): each key checked on its own. */
  fixed<T extends Record<string, string>>(raw: unknown, def: T, where: string, extra: readonly string[] = []): T {
    const src = isObj(raw) ? raw : (this.error(where, 'is not a mapping'), {});
    this.unknownKeys(src, [...Object.keys(def), ...extra], `${where}.`);
    const out = { ...def };
    for (const k of Object.keys(def) as (keyof T & string)[]) out[k] = this.value(src, k, def[k], isStr, `${where}.${k}`);
    return out;
  }

  /** A free id -> label mapping (zones, elements, families, background overrides). */
  record(raw: unknown, def: Record<string, string>, where: string): Record<string, string> {
    if (isObj(raw) && Object.values(raw).every(isStr)) return raw as Record<string, string>;
    this.error(where, 'is not a mapping of strings');
    return { ...def };
  }
}

function labels(c: Checker, raw: unknown): BestiaryLabels {
  const d = DEFAULT_BESTIARY.labels;
  const nested = ['sizes', 'attackKinds', 'anim'] as const;
  const flat = Object.fromEntries(BESTIARY_LABEL_KEYS.map((k) => [k, d[k]])) as Record<string, string>;
  const src = isObj(raw) ? raw : {};
  const out = c.fixed(raw, flat, 'labels', nested) as Omit<BestiaryLabels, (typeof nested)[number]>;
  return { ...out, sizes: c.fixed(src.sizes, d.sizes, 'labels.sizes'),
    attackKinds: c.fixed(src.attackKinds, d.attackKinds, 'labels.attackKinds'), anim: c.fixed(src.anim, d.anim, 'labels.anim') };
}

function templates(c: Checker, raw: unknown): BestiaryTemplates {
  const out = c.fixed(raw, DEFAULT_BESTIARY.templates, 'templates');
  for (const k of Object.keys(TEMPLATE_PLACEHOLDERS) as (keyof BestiaryTemplates)[]) {
    const allowed: readonly string[] = TEMPLATE_PLACEHOLDERS[k];
    const bad = placeholdersOf(out[k]).filter((p) => !allowed.includes(p));
    if (bad.length > 0) { c.error(`templates.${k}`, `uses unknown placeholders ${bad.join(', ')}`); out[k] = DEFAULT_BESTIARY.templates[k]; }
  }
  return out;
}

/** `lore: {enemyId: [page, ...]}`: every page a non-empty printable-ASCII string (the NES font). */
function lore(c: Checker, raw: unknown): Record<string, string[]> {
  if (raw === undefined) return {};
  const ok = (v: unknown): boolean => Array.isArray(v) && v.length > 0 && v.every((p) => isStr(p) && /^[\x20-\x7e\n]+$/.test(p));
  if (isObj(raw) && Object.values(raw).every(ok)) return raw as Record<string, string[]>;
  c.error('lore', 'is not a mapping of enemy id -> ASCII pages');
  return {};
}

/** The bestiary data from parsed YAML; every problem is logged and that key takes its default. */
export function validateBestiary(raw: unknown, path = 'bestiary.yaml'): BestiaryData {
  const c = new Checker(path);
  const d = DEFAULT_BESTIARY;
  const src: Raw = isObj(raw) ? raw : (c.error('the file', 'is not a mapping'), {});
  c.unknownKeys(src, Object.keys(d), '');
  const hab: Raw = isObj(src.habitats) ? src.habitats : {};
  const bg: Raw = isObj(src.backgrounds) ? src.backgrounds : {};
  const anim: Raw = isObj(src.anim) ? src.anim : {};
  c.unknownKeys(hab, ['maps', 'zones'], 'habitats.');
  c.unknownKeys(bg, ['default', 'enemies'], 'backgrounds.');
  c.unknownKeys(anim, Object.keys(d.anim), 'anim.');
  const isSteps = (v: unknown): boolean => Array.isArray(v) && v.every((s) => (BESTIARY_STEPS as readonly unknown[]).includes(s));
  return {
    mode: c.value(src, 'mode', d.mode, (v) => v === 'all' || v === 'seen'),
    order: c.value(src, 'order', d.order, (v) => v === 'data'),
    listRows: c.value(src, 'listRows', d.listRows, (v) => isCount(v) && v > 0),
    habitats: {
      maps: c.value(hab, 'maps', d.habitats.maps, (v) => v === 'manifest' || (Array.isArray(v) && v.every(isStr)), 'habitats.maps'),
      zones: c.record(hab.zones, d.habitats.zones, 'habitats.zones'),
    },
    backgrounds: {
      default: c.value(bg, 'default', d.backgrounds.default, isStr, 'backgrounds.default'),
      enemies: c.record(bg.enemies, d.backgrounds.enemies, 'backgrounds.enemies'),
    },
    anim: {
      order: c.value<BestiaryStep[]>(anim, 'order', d.anim.order, isSteps, 'anim.order'),
      firstBreak: c.value(anim, 'firstBreak', d.anim.firstBreak, isCount, 'anim.firstBreak'),
      idleBreak: c.value(anim, 'idleBreak', d.anim.idleBreak, isCount, 'anim.idleBreak'),
      dazeHold: c.value(anim, 'dazeHold', d.anim.dazeHold, isCount, 'anim.dazeHold'),
    },
    labels: labels(c, src.labels),
    templates: templates(c, src.templates),
    elements: c.record(src.elements, d.elements, 'elements'),
    families: c.record(src.families, d.families, 'families'),
    protections: c.record(src.protections, d.protections, 'protections'),
    statuses: c.record(src.statuses, d.statuses, 'statuses'),
    spellNames: c.record(src.spellNames, d.spellNames, 'spellNames'),
    specialNames: c.record(src.specialNames, d.specialNames, 'specialNames'),
    formTitles: src.formTitles === undefined ? {} : c.record(src.formTitles, d.formTitles, 'formTitles'),
    lore: lore(c, src.lore),
    help: c.value(src, 'help', d.help, isStr),
  };
}
