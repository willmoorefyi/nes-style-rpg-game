/**
 * Roster pass R data (docs/ROSTER_PLAN.md 3, 7): one enemies.yaml entry per approved roster sheet, numbered by the
 * spec (~/temp/ffgame-assets/Final_Fantasy_I_Complete_Bestiary.md), its stats converted by the 7.1 rules, the four
 * fiend rematches (124-127) as "<fiend> II" on their fiend's sprite, and the fiends' lore in bestiary.yaml.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { EnemyData } from '../../src/types/index.js';
import { validateBestiary } from '../../src/core/bestiaryValidation.js';
import { wrapText } from '../../src/scenes/bestiary/bestiaryInfo.js';
import { FULL_CHARS, STAT_LINES } from '../../src/scenes/bestiary/bestiaryModel.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = <T>(f: string): T => parse(readFileSync(join(root, f), 'utf-8')) as T;
const enemies = read<EnemyData[]>('assets/data/enemies.yaml');
const bestiary = validateBestiary(read('assets/data/bestiary.yaml'));
const atlas = JSON.parse(readFileSync(join(root, 'assets/sprites/monsters-ai.json'), 'utf-8')) as {
  scale: number; sheets: Record<string, { cell: [number, number]; scale?: number; frames: Record<string, unknown> }>;
};
const byId = (id: string): EnemyData => {
  const e = enemies.find((x) => x.id === id);
  if (!e) throw new Error(`no enemy ${id}`);
  return e;
};
const roster = enemies.filter((e) => !e.tuned);

describe('roster data: coverage and numbering', () => {
  it('every atlas sheet has an enemy, and every enemy a sheet', () => {
    const sprites = new Set(enemies.map((e) => e.sprite));
    expect(Object.keys(atlas.sheets).filter((s) => !sprites.has(s))).toEqual([]);
    expect([...sprites].filter((s) => !atlas.sheets[s])).toEqual([]);
  });

  it('every enemy has a num; they are unique, from 1 to 128, and each new sheet uses its own id as the sprite', () => {
    const nums = enemies.map((e) => e.num);
    expect(nums.every((n) => Number.isInteger(n) && n! >= 1 && n! <= 128)).toBe(true);
    expect(new Set(nums).size).toBe(nums.length);
    for (const e of roster.filter((x) => !x.rematchOf)) expect(e.sprite, e.id).toBe(e.id);
  });

  it('the fiends and Chaos sit at their spec numbers with the New Fiends names', () => {
    const at = (num: number): string | undefined => enemies.find((e) => e.num === num)?.name;
    expect([at(49), at(67), at(102), at(119), at(128)]).toEqual(['Rime Sovereign', 'Ashen Queen', 'Drowned Sovereign', 'Hollow Seraph', 'Chaos']);
  });

  it('every entry has an ASCII description, a size and a melee or ranged attack', () => {
    for (const e of enemies) {
      expect(e.description, e.id).toMatch(/^[\x20-\x7e]+$/);
      expect(['small', 'large', 'huge', 'boss', 'titan'].includes(e.size ?? 'small'), e.id).toBe(true);
      expect(['melee', 'ranged']).toContain(e.attack);
    }
  });

  it('size and FW-S display scale agree (REDESIGN_PLAN 2.3, 2.6): huge sheets and bigeyes at scale 3, every other at 2', () => {
    // V4: 22 tier-H `huge` enemies + bigeyes (`large`, FF1 large class) carry `scale: 3` from gen/monster_scale.yaml
    const scaleOf = (e: EnemyData): number => atlas.sheets[e.sprite ?? e.id].scale ?? atlas.scale;
    for (const e of enemies) {
      const want = e.size === 'huge' || e.sprite === 'bigeyes' ? 3 : 2;
      expect(scaleOf(e), `${e.id} (${e.size ?? 'small'})`).toBe(want);
    }
    expect(enemies.filter((e) => e.size === 'huge').length).toBe(22);
    expect(byId('bigeyes').size).toBe('large');
  });
});

describe('roster data: the 7.1 conversion', () => {
  it('parses ATK x hits, thousands separators, DEF 255, MDEF 100 % and keeps literal 0 and 1 values', () => {
    expect([byId('crawler').stats.attack, byId('crawler').stats.hits]).toEqual([1, 8]);
    expect([byId('green_slime').stats.defense, byId('green_slime').stats.vitality]).toEqual([255, 99]);
    const chaos = byId('chaos');
    expect([chaos.stats.hp, chaos.stats.magicDefense, chaos.stats.accuracy, chaos.xpReward, chaos.goldReward]).toEqual([2000, 200, 198, 0, 0]);
    const eye = byId('death_eye');
    expect([eye.xpReward, eye.goldReward, eye.stats.crit]).toEqual([1, 1, 40]);
    expect(byId('desert_baretta').goldReward).toBe(1);
    expect(byId('warmech').xpReward).toBe(32000);
  });

  it('crit: omitted at 1 %, else 2 x %', () => {
    expect([byId('anaconda').stats.crit, byId('sabertooth').stats.crit, byId('lizard').stats.crit]).toEqual([32, 70, 10]);
    expect(byId('goblin').stats.crit).toBeUndefined();
    expect(byId('crazy_horse').stats.crit).toBeUndefined();
  });

  it('every new entry derives its secondary stats: strength, vitality, intelligence, luck', () => {
    for (const e of roster) {
      const s = e.stats;
      expect(s.strength, e.id).toBe(Math.max(1, Math.round(0.8 * s.attack)));
      expect(s.vitality, e.id).toBe(Math.min(99, Math.max(1, Math.round(s.defense / 2) + 2)));
      expect(s.intelligence, e.id).toBe(Math.min(25, 1 + 3 * (e.spells?.length ?? 0)));
      expect(s.luck, e.id).toBe(5);
    }
  });

  it('elements: one weakness or resistance in the legacy fields, more in a full elementalProfile', () => {
    expect([byId('sahagin').weakness, byId('sahagin').resist]).toEqual(['lightning', 'fire']);
    expect(byId('green_slime').elementalProfile).toEqual({ weaknesses: ['fire', 'ice'], resistances: ['lightning'], immunities: [], absorbs: [] });
    expect(byId('chaos').elementalProfile?.resistances).toEqual(['fire', 'ice', 'lightning']);
    for (const e of roster) {
      if (!e.elementalProfile) continue;
      expect(e.weakness ?? e.resist, e.id).toBeUndefined();
      expect(e.elementalProfile.weaknesses.length + e.elementalProfile.resistances.length, e.id).toBeGreaterThan(1);
    }
  });

  it('statusWeak, protect and on-hit statuses come from the spec', () => {
    expect(byId('ashen_queen').statusWeak).toEqual(['status']);
    expect(byId('hollow_seraph').statusWeak).toEqual(['poison_stone']);
    expect(byId('hollow_seraph_2').statusWeak).toBeUndefined();
    expect(byId('chaos').protect).toEqual(['status', 'poison_stone', 'death', 'earth', 'time']);
    expect(byId('mindflayer').attackStatus).toEqual(['death']);
    expect(byId('shadow').attackStatus).toEqual(['blind']);
    expect(byId('ghoul').family).toBe('undead');
  });

  it('ai: only spells.yaml spells, at the spec use rate; codes without a spell stay display-only', () => {
    expect(byId('astos').ai?.rate).toBe(0.75);
    expect(byId('astos').spells).toContain('rub');
    expect(byId('astos').ai?.actions.map((a) => a.spellId)).toEqual(['fast', 'fir2', 'lit2', 'slow', 'dark', 'slep']);
    expect(byId('dark_wizard').spells?.length).toBe(6);
    expect(byId('dark_wizard').ai).toBeUndefined();
    expect(byId('lich_2').ai).toBeUndefined();
  });

  it('several specials share the spec use rate', () => {
    const rates = (id: string): number[] => (byId(id).specials ?? []).map((s) => s.rate);
    expect(rates('evil_eye')).toEqual([0.0575, 0.0575, 0.0575, 0.0575]);
    expect(rates('hollow_seraph').reduce((a, b) => a + b, 0)).toBeCloseTo(0.5);
    for (const e of enemies) for (const s of e.specials ?? []) expect(bestiary.specialNames[s.id], `${e.id}: ${s.id}`).toBeDefined();
  });
});

describe('roster data: the rematches (D1, 124-127)', () => {
  const REMATCH: Record<string, [string, number, number]> = {
    lich_2: ['lich', 124, 1000], ashen_queen_2: ['ashen_queen', 125, 700],
    drowned_sovereign_2: ['drowned_sovereign', 126, 900], hollow_seraph_2: ['hollow_seraph', 127, 1100],
  };

  it('each is "<fiend> II" on the fiend\'s sprite with the spec rematch rewards (2000 XP, 1 gold) and at least its HP', () => {
    for (const [id, [first, num, hp]] of Object.entries(REMATCH)) {
      const r = byId(id);
      const f = byId(first);
      expect([r.rematchOf, r.num, r.stats.hp, r.sprite, r.name, r.size], id).toEqual([first, num, hp, f.sprite, `${f.name} II`, 'boss']);
      expect([r.xpReward, r.goldReward], id).toEqual([2000, 1]);
      expect(r.stats.hp, id).toBeGreaterThanOrEqual(f.stats.hp);
    }
    expect(enemies.filter((e) => e.rematchOf).map((e) => e.id).sort()).toEqual(Object.keys(REMATCH).sort());
  });

  it('lich_2 scales the lich\'s tuned numbers by spec rematch / first: attack 44, defense 25, magic defense 23', () => {
    const s = byId('lich_2').stats;
    expect([s.hp, s.attack, s.defense, s.magicDefense, s.accuracy, s.evade]).toEqual([1000, 44, 25, 23, undefined, undefined]);
    expect(byId('lich_2').weakness).toBeUndefined();
    expect(byId('lich_2').resist).toBe('ice');
  });

  it('the new fiends\' rematches are the spec rematch rows', () => {
    const q = byId('ashen_queen_2').stats;
    expect([q.attack, q.hits, q.defense, q.evade, q.magicDefense, q.accuracy]).toEqual([60, 6, 60, 60, 184, 62]);
    const d = byId('drowned_sovereign_2').stats;
    expect([d.attack, d.hits, d.defense, d.evade, d.magicDefense, d.accuracy]).toEqual([70, 8, 70, 98, 200, 112]);
  });
});

describe('roster data: bestiary lore and backgrounds', () => {
  it('the three new fiends have lore; Astos and Chaos a short page; every page fits the 15 text lines of 56', () => {
    for (const id of ['ashen_queen', 'drowned_sovereign', 'hollow_seraph']) expect(bestiary.lore[id]?.length, id).toBe(3);
    for (const id of ['astos', 'chaos']) expect(bestiary.lore[id]?.length, id).toBe(1);
    for (const [id, pages] of Object.entries(bestiary.lore)) {
      for (const page of pages) {
        expect(page, id).toMatch(/^[\x20-\x7e\n]+$/);
        expect(wrapText(page, FULL_CHARS).length, id).toBeLessThanOrEqual(STAT_LINES - 2);
      }
    }
  });

  it('rematches have no lore of their own (they show their fiend\'s)', () => {
    for (const e of enemies.filter((x) => x.rematchOf)) expect(bestiary.lore[e.id], e.id).toBeUndefined();
  });

  it('every background override is a committed staged id', () => {
    const staged = ['abandoned_castle', 'cave', 'dark_forest', 'desert', 'evil_temple', 'forest', 'grassland', 'marsh', 'ocean',
      'river', 'ruined_forest', 'shoreline', 'swamp', 'temple', 'waterfall'];
    for (const [id, bg] of Object.entries(bestiary.backgrounds.enemies)) expect(staged, id).toContain(bg);
  });

  it('the water elemental stands on the shoreline (contrast; ROSTER_FIX_PLAN_2 P2-9)', () => {
    expect(bestiary.backgrounds.enemies.water_elemental).toBe('shoreline');
  });
});
