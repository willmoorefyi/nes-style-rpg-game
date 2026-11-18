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
import { bossTag, buildEntries, statLines, titleCount, elementSummary, COLUMN_CHARS, FULL_CHARS, STAT_LINES,
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
  it('lists every enemy by its spec number (ROSTER_PLAN 7.3), 001 Goblin ... 049 Rime Sovereign, 066 Red Dragon', () => {
    // CHAOS_FORMS_PLAN R11: the boss form records (`formOf`, no num) are not top-level entries
    expect(entries.map((e) => e.id)).toEqual(enemies.filter((e) => !e.formOf).sort((a, b) => a.num! - b.num!).map((e) => e.id));
    expect(enemies.filter((e) => e.formOf).map((e) => e.id)).toEqual(['chaos_orrery', 'chaos_horizon', 'chaos_horizon_core']);
    expect(entries[0].label).toBe('001 Goblin');
    expect(byId('lich').label).toBe('049 Rime Sovereign');
    expect(byId('dragon').label).toBe('066 Red Dragon');
    expect(byId('lich_2').label).toBe('124 Rime Sovereign II');
    expect(entries[entries.length - 1].label).toBe('128 Chaos');
    // 1-49 are all listed, so the list place equals num up to the lich; the total is the listed count (127 of 128)
    expect(titleCount(byId('garland'), entries.length, data)).toBe('012 Garland  12/127');
    expect(titleCount(byId('lich'), entries.length, data)).toBe('049 Rime Sovereign  49/127');
  });

  it('the real numbering: every num from 001 to 128 at most once, in order; the gaps (unbuilt sprites) are skipped', () => {
    const nums = entries.map((e) => Number(e.label.slice(0, 3)));
    expect(nums.every((n, i) => n >= 1 && n <= 128 && (i === 0 || n > nums[i - 1]))).toBe(true);
    for (const e of entries) expect(e.label, e.id).toBe(`${String(e.enemy.num).padStart(3, '0')} ${e.enemy.name}`);
    // a gap: 050 Ankheg is followed by 052 Red Piranha (051 Piranha is cut), and the count runs on by list place
    const ankheg = entries.findIndex((e) => e.id === 'ankheg');
    expect(entries[ankheg + 1].label).toBe('052 Red Piranha');
    expect(titleCount(entries[ankheg + 1], entries.length, data)).toBe(`052 Red Piranha  ${ankheg + 2}/127`);
    expect(entries[ankheg + 2].label).toBe('053 Crocodile');
  });

  it('a gap in the numbers: the label keeps num, the count is the list place of the listed entries', () => {
    const [a, b] = buildEntries([{ ...enemies[0], id: 'b', name: 'Second', num: 49 }, { ...enemies[0], id: 'a', name: 'First', num: 2 }],
      data, new Map(), () => true);
    expect([a.id, a.label, b.label]).toEqual(['a', '002 First', '049 Second']);
    expect(titleCount(b, 2, data)).toBe('049 Second  2/2');
  });

  it('an entry without num keeps its enemies.yaml place (1-based) and sorts by it', () => {
    const { num: _n, ...plain } = enemies[0];
    const list = buildEntries([{ ...plain, id: 'x' }, { ...plain, id: 'y', num: 1 }], data, new Map(), () => true);
    expect(list.map((e) => e.label)).toEqual(['001 Goblin', '001 Goblin']);
    expect(list.map((e) => e.id)).toEqual(['x', 'y']);
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

  it('garland: Boss tag, Attack 9, x2, 9-18 and the 75% phase with Fight x3 and its message', () => {
    const g = byId('garland');
    expect(g.boss).toBe(true);
    expect(cellOf(g, 'Attack')).toBe('9');
    expect(cellOf(g, 'Hits')).toBe('x2');
    expect(cellOf(g, 'Dmg/hit')).toBe('9-18');
    expect(cellOf(g, 'At 75% HP')).toBe('Fight x3 "Garland\'s attacks grow fiercer!"');
  });

  it('elements: wolf weak Fire / resist Ice; the Red Dragon weak Ice and Poison/Stone (statusWeak) / resist Fire', () => {
    expect([cellOf(byId('wolf'), 'Weak'), cellOf(byId('wolf'), 'Resist')]).toEqual(['Fire', 'Ice']);
    expect([cellOf(byId('dragon'), 'Weak'), cellOf(byId('dragon'), 'Resist')]).toEqual(['Ice, Poison/Stone', 'Fire']);
    // V8 F9: by design the dragon's 17-character Weak value takes a full-width row (no Resist beside it), so it can
    // never run into the next label
    const weak = statLines(byId('dragon'), data).find((l) => l.left.startsWith('Weak'));
    expect(weak?.right).toBeUndefined();
  });

  it('the Immune row: elemental immunities, then the status protections (protect, D5)', () => {
    expect(cellOf(byId('goblin'), 'Immune')).toBe('None');
    expect(cellOf(byId('skeleton'), 'Immune')).toBe('Status, Poison/Stone, Death');
    expect(cellOf(byId('vampire'), 'Immune')).toBe('Status, Poison/Stone, Death, Earth');
    expect(cellOf(byId('cockatrice'), 'Immune')).toBe('Earth');
    const e: EnemyData = { ...enemies[0], id: 'mixed', protect: ['death', 'status'],
      elementalProfile: { weaknesses: [], resistances: [], immunities: ['dark'], absorbs: [] } };
    const [entry] = buildEntries([e], data, new Map(), () => true);
    expect(cellOf(entry, 'Immune')).toBe('Dark, Status, Death');
  });

  it('the lich (Rime Sovereign): spells on full-width rows and its phase line, in 17 lines', () => {
    const lich = byId('lich');
    const lines = statLines(lich, data, (id) => id.toUpperCase());
    expect(lines.length).toBeLessThanOrEqual(STAT_LINES);
    const text = lines.map((l) => l.left).join('\n');
    expect(text).toContain('Spells     ICE2, SLP2, FAST, LIT2, HOLD, FIR2, SLOW,');
    expect(cellOf(lich, 'At 99% HP')).toBe('Fight x4 Attack 90 "His skull fractures!"');   // ERT-D's phase (WORLD 3.7)
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
      else {
        // V8 F9: a left cell with a right cell beside it keeps a trailing space before the right column
        expect(l.left.trimEnd().length, `${e.id}: ${l.left}|${l.right}`).toBeLessThanOrEqual(COLUMN_CHARS - 1);
        expect(l.right.length).toBeLessThanOrEqual(COLUMN_CHARS);
      }
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
      for (const s of [e.label, titleCount(e, entries.length, data), ...flat(e)]) expect(s).toMatch(/^[\x20-\x7e]*$/);
    }
  });
});

describe('bestiary model: the boss tag of the new size classes (TS-2, REDESIGN_PLAN 2.6 rev 11)', () => {
  const chaos = enemies.find((e) => e.id === 'chaos')!;
  it('chaos keeps its boss tag as a titan through its bossPhases', () => {
    expect(chaos.bossPhases?.length).toBeGreaterThan(0);
    expect(bossTag({ ...chaos, size: 'titan' })).toBe(true);
  });
  it('a titan without phases is still a boss; a huge sheet is not', () => {
    expect(bossTag({ ...chaos, size: 'titan', bossPhases: undefined })).toBe(true);
    expect(bossTag({ ...chaos, size: 'huge', bossPhases: undefined })).toBe(false);
  });
  it('the size labels name the new classes (D-V5)', () => {
    expect([data.labels.sizes.huge, data.labels.sizes.titan]).toEqual(['Huge', 'Titan']);
  });
});
