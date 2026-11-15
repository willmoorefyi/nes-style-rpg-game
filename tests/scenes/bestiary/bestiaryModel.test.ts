/**
 * Fh test 1 (docs/BESTIARY_PLAN.md 3.3, 7): the bestiary model on the real enemies.yaml and bestiary.yaml.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { EnemyData } from '../../../src/types/index.js';
import { validateBestiary } from '../../../src/core/bestiaryValidation.js';
import { buildEntries, statLines, titleCount, elementSummary, COLUMN_CHARS, FULL_CHARS, STAT_LINES,
  type BestiaryEntry } from '../../../src/scenes/bestiary/bestiaryModel.js';
import type { Habitat } from '../../../src/scenes/bestiary/bestiaryHabitats.js';
import { statusChance, statusHits } from '../../../src/battle/DamageFormula.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = <T>(f: string): T => parse(readFileSync(join(root, f), 'utf-8')) as T;
const enemies = read<EnemyData[]>('assets/data/enemies.yaml');
const data = validateBestiary(read<unknown>('assets/data/bestiary.yaml'));
const entries = buildEntries(enemies, data, new Map(), () => false);
const byId = (id: string): BestiaryEntry => entries.find((e) => e.id === id)!;
/** "Label   value" for a column cell or full row. */
const flat = (e: BestiaryEntry): string[] => statLines(e, data).flatMap((l) => [l.left, ...(l.right !== undefined ? [l.right] : [])]);
const cellOf = (e: BestiaryEntry, label: string): string | undefined =>
  flat(e).find((c) => c.startsWith(label.padEnd(11)))?.slice(11).trimEnd();

afterEach(() => { vi.restoreAllMocks(); });

describe('bestiary model: order and numbering', () => {
  it('lists every enemy in enemies.yaml order, 001 Goblin ... 014 Lich', () => {
    expect(entries.map((e) => e.id)).toEqual(enemies.map((e) => e.id));
    expect(entries[0].label).toBe('001 Goblin');
    expect(entries[13].label).toBe('014 Lich');
    expect(titleCount(byId('garland'), entries.length, data)).toBe('013 Garland  13/14');
  });
});

describe('bestiary model: stats', () => {
  it('goblin: HP 8, Attack 4, x1, 4-8, weak Fire, resist None, status 78%, no spells', () => {
    const g = byId('goblin');
    expect(cellOf(g, 'HP')).toBe('8');
    expect(cellOf(g, 'Attack')).toBe('4');
    expect(cellOf(g, 'Hits')).toBe('x1');
    expect(cellOf(g, 'Dmg/hit')).toBe('4-8');
    expect(cellOf(g, 'Weak')).toBe('Fire');
    expect(cellOf(g, 'Resist')).toBe('None');
    expect(cellOf(g, 'Status hit')).toBe('78% (spell accuracy 24)');
    expect(cellOf(g, 'Spells')).toBe('None');
    expect(g.boss).toBe(false);
  });

  it('garland: Boss tag, Attack 9, x2, 9-18 and the 50% phase with Fight x3 and its message', () => {
    const g = byId('garland');
    expect(g.boss).toBe(true);
    expect(cellOf(g, 'Attack')).toBe('9');
    expect(cellOf(g, 'Hits')).toBe('x2');
    expect(cellOf(g, 'Dmg/hit')).toBe('9-18');
    expect(cellOf(g, 'At 50% HP')).toBe('Fight x3 "Garland\'s attacks grow fiercer!"');
  });

  it('elements: wolf weak Fire / resist Ice; dragon weak Ice / resist Fire', () => {
    expect([cellOf(byId('wolf'), 'Weak'), cellOf(byId('wolf'), 'Resist')]).toEqual(['Fire', 'Ice']);
    expect([cellOf(byId('dragon'), 'Weak'), cellOf(byId('dragon'), 'Resist')]).toEqual(['Ice', 'Fire']);
  });

  it('merges the legacy fields and elementalProfile without duplicates; an unlabelled element shows its id once warned', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const base = enemies[0];
    const e: EnemyData = { ...base, id: 'synthetic', weakness: 'fire',
      elementalProfile: { weaknesses: ['fire', 'holy'], resistances: [], immunities: ['dark'], absorbs: ['ice'] } };
    const [entry] = buildEntries([e], data, new Map(), () => true);
    expect(elementSummary(e).weak).toEqual(['fire', 'fire', 'holy']);
    expect(cellOf(entry, 'Weak')).toBe('Fire, Holy');
    expect(cellOf(entry, 'Immune')).toBe('Dark');
    expect(cellOf(entry, 'Absorb')).toBe('Ice');
    const odd: EnemyData = { ...base, id: 'odd', weakness: 'plasma' };
    const [oddEntry] = buildEntries([odd], data, new Map(), () => true);
    expect(cellOf(oddEntry, 'Weak')).toBe('plasma');
    statLines(oddEntry, data);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('plasma'))).toHaveLength(1);
  });

  it('statusChance: magic defence 0 gives 0.86, 200 gives 0; statusHits rolls as before', () => {
    expect(statusChance(24, 0)).toBeCloseTo(0.86);
    expect(statusChance(24, 200)).toBe(0);
    // old statusHits: rng() * 200 < base + accuracy - magicDefense
    const old = (acc: number, md: number, r: number, rel: 'weak' | 'resist' | 'normal') =>
      r * 200 < (rel === 'resist' ? 0 : 148 + (rel === 'weak' ? 40 : 0)) + acc - md;
    const cases: [number, number, number, 'weak' | 'resist' | 'normal'][] = [
      [24, 16, 0.77, 'normal'], [24, 16, 0.78, 'normal'], [24, 100, 0.5, 'weak'], [24, 0, 0.1, 'resist'], [0, 200, 0, 'normal']];
    for (const [acc, md, r, rel] of cases) expect(statusHits(acc, md, () => r, rel)).toBe(old(acc, md, r, rel));
  });

  it('defaults: missing accuracy, evade and hits show 0, 0 and x1', () => {
    const { accuracy: _a, evade: _e, hits: _h, ...stats } = enemies[0].stats;
    const [entry] = buildEntries([{ ...enemies[0], stats }], data, new Map(), () => true);
    expect([cellOf(entry, 'Accuracy'), cellOf(entry, 'Evade'), cellOf(entry, 'Hits')]).toEqual(['0', '0', 'x1']);
  });
});

describe('bestiary model: the 17-line budget', () => {
  const fits = (e: BestiaryEntry): void => {
    const lines = statLines(e, data);
    expect(lines.length).toBeLessThanOrEqual(STAT_LINES);
    for (const l of lines) {
      if (l.right === undefined) expect(l.left.length).toBeLessThanOrEqual(FULL_CHARS);
      else expect(Math.max(l.left.length, l.right.length)).toBeLessThanOrEqual(COLUMN_CHARS);
    }
  };

  it('every real enemy fits', () => {
    for (const e of entries) fits(e);
  });

  it('a synthetic enemy with 4 weaknesses, 4 resistances, 2 phases and 3 habitats fits', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e: EnemyData = { ...enemies[0], id: 'big', weakness: undefined,
      elementalProfile: { weaknesses: ['fire', 'ice', 'lightning', 'earth'], resistances: ['holy', 'dark', 'water', 'wind'],
        immunities: [], absorbs: [] },
      bossPhases: [{ hpThreshold: 0.5, patternId: 'x', hits: 3, attack: 20, message: 'A very long phase message that goes on and on to wrap' },
        { hpThreshold: 0.25, patternId: 'y', message: 'Another long message for the second phase of the fight' }] };
    const hab = (map: string, main: boolean, zones: string[], boss: boolean): Habitat =>
      ({ mapId: map, map, main, zones, boss, background: undefined });
    const habitats = new Map([['big', [hab('World Map', false, ['east_pocket', 'temple_approach'], false),
      hab('Temple of Fiends', true, [], true), hab('Marsh Cave Underground Floor', true, [], false)]]]);
    const [entry] = buildEntries([e], data, habitats, () => true);
    fits(entry);
    expect(statLines(entry, data).some((l) => l.left.startsWith('At 25% HP'))).toBe(true);
  });
});

describe('bestiary model: mode seen', () => {
  it('an unseen entry shows ??? and - and is not seen; mode all ignores the predicate', () => {
    const seenData = { ...data, mode: 'seen' as const };
    const list = buildEntries(enemies, seenData, new Map(), (id) => id === 'goblin');
    expect(list[0].seen).toBe(true);
    expect(list[1].label).toBe('002 ???');
    expect(list[1].seen).toBe(false);
    expect(cellOf(list[1], 'HP')).toBe('-');
    expect(cellOf(list[1], 'Habitat')).toBe('-');
    expect(buildEntries(enemies, data, new Map(), () => false).every((e) => e.seen)).toBe(true);
  });

  it('every returned string is printable ASCII', () => {
    for (const e of entries) {
      for (const s of [e.label, titleCount(e, 14, data), ...flat(e)]) expect(s).toMatch(/^[\x20-\x7e]*$/);
    }
  });
});
