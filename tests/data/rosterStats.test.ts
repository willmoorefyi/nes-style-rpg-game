/**
 * ROSTER_PLAN 7.1 (D4): new records take the spec's NES numbers through fixed rules; the 14 pre-roster entries keep
 * their tuned numbers (`tuned: true`). The only secondary stat the engine reads for an enemy is `agility` (the turn
 * order key): every new entry has `agility = 5 + round(evade / 6)`, i.e. 5 + round(EVA % / 3). A rematch (D1) shares
 * its fiend's sprite and has at least its HP.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { EnemyData } from '../../src/types/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const enemies = parse(readFileSync(join(root, 'assets/data/enemies.yaml'), 'utf-8')) as EnemyData[];

/** The spec's EVA % -> `stats.evade` (round(2 x %)). */
const evadeOf = (evaPct: number): number => Math.round(2 * evaPct);
/** The agility rule for a new entry, from its `evade`. */
const agilityOf = (evade: number): number => 5 + Math.round(evade / 6);

/** The 14 entries of act 1 and their spec numbers (ROSTER_PLAN 3.2). */
const PRE_ROSTER: Record<string, number> = {
  goblin: 1, gr_imp: 2, wolf: 3, skeleton: 5, gr_wolf: 8, garland: 12, ogre: 14, pirate: 17, mummy: 34, troll: 42,
  cockatrice: 45, vampire: 46, lich: 49, dragon: 66,
};

describe('roster stats: the agility rule (7.1)', () => {
  it('from the spec EVA it gives goblin 6, Goblin Guard 7, Warg Wolf 14, 5 at EVA 0 and 29 at the Air Elemental\'s 72 %', () => {
    expect(agilityOf(evadeOf(3))).toBe(6);
    expect(agilityOf(evadeOf(5))).toBe(7);
    expect(agilityOf(evadeOf(27))).toBe(14);
    expect(agilityOf(evadeOf(0))).toBe(5);
    expect(agilityOf(evadeOf(72))).toBe(29);
  });

  it('equals 5 + round(EVA % / 3) for every EVA from 0 to 100 %', () => {
    for (let pct = 0; pct <= 100; pct++) expect(agilityOf(evadeOf(pct)), `${pct} %`).toBe(5 + Math.round(pct / 3));
  });

  it('every entry with num and without tuned follows it', () => {
    for (const e of enemies.filter((x) => x.num !== undefined && !x.tuned)) {
      expect(e.stats.agility, e.id).toBe(agilityOf(e.stats.evade ?? 0));
    }
  });
});

describe('roster stats: the pre-roster entries (D4)', () => {
  it('the 14 act-1 entries carry their spec num and tuned: true', () => {
    for (const [id, num] of Object.entries(PRE_ROSTER)) {
      const e = enemies.find((x) => x.id === id);
      expect(e, id).toBeDefined();
      expect([e?.num, e?.tuned], id).toEqual([num, true]);
    }
  });

  it('only the pre-roster entries are tuned', () => {
    expect(enemies.filter((e) => e.tuned).map((e) => e.id).sort()).toEqual(Object.keys(PRE_ROSTER).sort());
  });

  it('display names follow the spec: Goblin Guard, Warg Wolf, Red Dragon, Rime Sovereign', () => {
    const name = (id: string): string | undefined => enemies.find((e) => e.id === id)?.name;
    expect([name('gr_imp'), name('gr_wolf'), name('dragon'), name('lich')]).toEqual(['Goblin Guard', 'Warg Wolf', 'Red Dragon', 'Rime Sovereign']);
    expect(enemies.find((e) => e.id === 'lich')?.bossPhases?.[0].message).toBe("The Rime Sovereign's skull fractures!");
  });

  it('protections from the spec: skeleton, mummy and the lich status/poison_stone/death; vampire also earth', () => {
    const protect = (id: string) => enemies.find((e) => e.id === id)?.protect;
    for (const id of ['skeleton', 'mummy', 'lich']) expect(protect(id), id).toEqual(['status', 'poison_stone', 'death']);
    expect(protect('vampire')).toEqual(['status', 'poison_stone', 'death', 'earth']);
    expect([protect('cockatrice'), protect('dragon')]).toEqual([['earth'], ['earth']]);
    for (const id of ['goblin', 'gr_imp', 'wolf', 'gr_wolf', 'pirate', 'ogre', 'troll', 'garland']) expect(protect(id), id).toBeUndefined();
  });
});

describe('roster stats: rematches (D1)', () => {
  const rematches = enemies.filter((e) => e.rematchOf);

  it('each rematch shares its first battle\'s sprite, has at least its HP and is named "<name> II"', () => {
    for (const r of rematches) {
      const first = enemies.find((e) => e.id === r.rematchOf)!;
      expect(r.sprite, r.id).toBe(first.sprite);
      expect(r.stats.hp, r.id).toBeGreaterThanOrEqual(first.stats.hp);
      expect(r.name, r.id).toBe(`${first.name} II`);
    }
  });

  it('the ratio rule: lich_2 HP would be 800 x 500 / 400 = 1000', () => {
    const scaled = (game: number, specFirst: number, specRematch: number): number =>
      (specFirst === 0 || specRematch === 0 || specFirst === specRematch ? game : Math.round((game * specRematch) / specFirst));
    expect(scaled(800, 400, 500)).toBe(1000);
    expect(scaled(35, 40, 50)).toBe(44);
    expect(scaled(20, 0, 5)).toBe(20);
  });
});
