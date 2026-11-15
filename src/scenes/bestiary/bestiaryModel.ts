/**
 * The bestiary's text, pure (docs/BESTIARY_PLAN.md 3.3): entries in enemies.yaml order and the 17-line stats panel in
 * two 28-character columns (label 11, value 17); a full-width row is 56 characters and wraps. ASCII only.
 */
import type { EnemyData } from '../../types/index.js';
import type { BestiaryData, BestiaryTemplateKey } from '../../types/bestiaryData.js';
import { DEFAULT_SPELL_ACCURACY, statusChance } from '../../battle/DamageFormula.js';
import { habitatText, type Habitat } from './bestiaryHabitats.js';

export const STAT_LINES = 17;
export const COLUMN_CHARS = 28;
export const FULL_CHARS = 56;
const LABEL_CHARS = 11;

/** One panel line: a left and a right column, or (no `right`) one full-width row. */
export interface StatLine { left: string; right?: string }

export interface BestiaryEntry {
  id: string;
  enemy: EnemyData;
  /** "013 Garland" ("013 ???" while unseen in `mode: seen`). */
  label: string;
  /** Position in the list (0-based). */
  index: number;
  seen: boolean;
  boss: boolean;
  habitats: Habitat[];
}

/** The game flag a battle sets for each enemy it shows. */
export const seenFlag = (enemyId: string): string => `SEEN:${enemyId}`;

export function fill(data: BestiaryData, key: BestiaryTemplateKey, vars: Record<string, string | number> = {}): string {
  return data.templates[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/** Boss tag: boss phases, `size: boss`, or a scripted isBoss encounter names it. */
export function bossTag(enemy: EnemyData, habitats: readonly Habitat[] = []): boolean {
  return (enemy.bossPhases?.length ?? 0) > 0 || enemy.size === 'boss' || habitats.some((h) => h.boss);
}

export function buildEntries(enemies: readonly EnemyData[], data: BestiaryData, habitats: Map<string, Habitat[]>,
  isSeen: (id: string) => boolean): BestiaryEntry[] {
  return enemies.map((enemy, index) => {
    const seen = data.mode === 'all' || isSeen(enemy.id);
    const hab = habitats.get(enemy.id) ?? [];
    const num = String(index + 1).padStart(3, '0');
    return { id: enemy.id, enemy, index, seen, boss: seen && bossTag(enemy, hab), habitats: hab,
      label: fill(data, 'entry', { num, name: seen ? enemy.name : data.labels.unknown }) };
  });
}

/** The title bar's "013 Garland  13/14". */
export function titleCount(entry: BestiaryEntry, total: number, data: BestiaryData): string {
  return fill(data, 'titleCount', { entry: entry.label, index: entry.index + 1, total });
}

const warned = new Set<string>();
const warnOnce = (key: string, msg: string): void => {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg);
};

/** Weak / resist / immune / absorb: legacy fields and elementalProfile merged, in bestiary.yaml `elements` order. */
export function elementSummary(enemy: EnemyData): Record<'weak' | 'resist' | 'immune' | 'absorb', string[]> {
  const p = enemy.elementalProfile;
  const opt = (v: string | undefined): string[] => (v ? [v] : []);
  return { weak: [...opt(enemy.weakness), ...(p?.weaknesses ?? [])], resist: [...opt(enemy.resist), ...(p?.resistances ?? [])],
    immune: [...(p?.immunities ?? [])], absorb: [...(p?.absorbs ?? [])] };
}

function elementList(ids: readonly string[], data: BestiaryData): string {
  const order = Object.keys(data.elements);
  const uniq = [...new Set(ids)].sort((a, b) => rank(order, a) - rank(order, b));
  if (uniq.length === 0) return data.labels.none;
  return uniq.map((id) => {
    const label = data.elements[id];
    if (label === undefined) warnOnce(`element:${id}`, `Bestiary: no label for element "${id}" in bestiary.yaml`);
    return label ?? id;
  }).join(data.templates.list);
}

const rank = (order: string[], id: string): number => (order.includes(id) ? order.indexOf(id) : order.length);

/** A future `spells` list (BS-F3): its names, else none. */
export function spellIdsOf(enemy: EnemyData): string[] {
  const spells = (enemy as EnemyData & { spells?: unknown }).spells;
  return Array.isArray(spells) ? spells.filter((s): s is string => typeof s === 'string') : [];
}

const clip = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, n - 3)}...`);
const cell = (label: string, value: string): string => clip(`${clip(label, LABEL_CHARS - 1).padEnd(LABEL_CHARS)}${value}`, COLUMN_CHARS);

/** Full-width rows: the label, then the value wrapped at 56 with continuation lines indented under the value. */
function wrapped(label: string, value: string, maxLines: number, warnKey: string): StatLine[] {
  const width = FULL_CHARS - LABEL_CHARS;
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) { lines.push(line); line = word; } else line = next;
  }
  lines.push(line);
  const out = lines.map((l) => clip(l, width));
  if (out.length > maxLines) {
    warnOnce(warnKey, `Bestiary: "${label}" text is cut to ${maxLines} line(s)`);
    out.length = Math.max(1, maxLines);
    out[out.length - 1] = clip(`${out[out.length - 1]} ...`, width);
  }
  return out.map((l, i) => ({ left: `${(i === 0 ? clip(label, LABEL_CHARS - 1) : '').padEnd(LABEL_CHARS)}${l}` }));
}

/** At most 17 lines for the stats panel (3.3); every value is "-" for an unseen entry. */
export function statLines(entry: BestiaryEntry, data: BestiaryData, spellName: (id: string) => string = (id) => id): StatLine[] {
  const L = data.labels;
  const e = entry.enemy;
  const s = e.stats;
  const v = (x: string | number): string => (entry.seen ? String(x) : L.blank);
  const hits = s.hits ?? 1;
  const kind = e.attack === 'ranged' ? 'ranged' : e.attackAnim === 'heavy' ? 'heavy' : 'melee';
  const family = e.family ? data.families[e.family] ?? (warnOnce(`family:${e.family}`, `Bestiary: no label for family "${e.family}"`), e.family) : L.none;
  const el = elementSummary(e);
  const spells = spellIdsOf(e);
  const pair = (a: string, av: string | number, b: string, bv: string | number): StatLine => ({ left: cell(a, v(av)), right: cell(b, v(bv)) });
  const lines: StatLine[] = [
    pair(L.hp, s.hp, L.attack, s.attack),
    pair(L.hits, fill(data, 'hits', { hits }), L.damage, fill(data, 'damage', { min: s.attack, max: 2 * s.attack })),
    pair(L.defense, s.defense, L.magicDefense, s.magicDefense),
    pair(L.strength, s.strength, L.agility, s.agility),
    pair(L.intelligence, s.intelligence, L.vitality, s.vitality),
    pair(L.luck, s.luck, L.accuracy, s.accuracy ?? 0),
    pair(L.evade, s.evade ?? 0, L.family, family),
    pair(L.size, L.sizes[e.size ?? 'small'], L.attacks, L.attackKinds[kind]),
    pair(L.xp, e.xpReward, L.gold, e.goldReward),
    ...wrapped(L.weak, v(elementList(el.weak, data)), 2, `${e.id}:weak`),
    ...wrapped(L.resist, v(elementList(el.resist, data)), 2, `${e.id}:resist`),
    pair(L.immune, elementList(el.immune, data), L.absorb, elementList(el.absorb, data)),
    ...wrapped(L.statusHit, v(fill(data, 'statusHit', { pct: Math.round(100 * statusChance(DEFAULT_SPELL_ACCURACY, s.magicDefense)),
      acc: DEFAULT_SPELL_ACCURACY })), 1, `${e.id}:status`),
    pair(L.actions, fill(data, 'fight', { hits }), L.spells, spells.length > 0 ? spells.map(spellName).join(data.templates.list) : L.none),
  ];
  const phases = entry.seen ? e.bossPhases ?? [] : [];
  for (const [i, p] of phases.entries()) {
    const room = STAT_LINES - lines.length - 1 - (phases.length - 1 - i);
    if (room < 1) { warnOnce(`${e.id}:phases`, `Bestiary: ${e.id} has more boss phases than the panel shows`); break; }
    const parts = [fill(data, 'phaseHits', { hits: p.hits ?? hits }), ...(p.attack !== undefined ? [fill(data, 'phaseAttack', { attack: p.attack })] : []),
      ...(p.message ? [fill(data, 'phaseMessage', { message: p.message })] : [])];
    lines.push(...wrapped(fill(data, 'phase', { pct: Math.round(p.hpThreshold * 100) }), parts.join(' '), room, `${e.id}:phase${i}`));
  }
  lines.push(...wrapped(L.habitat, v(habitatText(entry.habitats, data)), STAT_LINES - lines.length, `${e.id}:habitat`));
  return lines.slice(0, STAT_LINES);
}
