/**
 * Pass EQ (docs/EQUIP_FF1_PLAN.md D-EQ3 to D-EQ7, Appendix A): every gear item has FF1 NES stats (or its plan 3.3
 * retune), its NES price where a shop sells it, FF1's job list over the 12 classic classes, and FF1's effects. A copy
 * class equips exactly what its `copyOf` source equips (D-EQ4), so no copy id appears in any `usableBy`.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import type { CharacterClassData, ItemData } from '../../src/types/index.js';
import { loadRealRegistries } from '../helpers/realData.js';
import { GEAR } from './ff1Tables.js';

const ITEMS = parse(readFileSync('assets/data/items.yaml', 'utf-8')) as ItemData[];
const CLASSES = parse(readFileSync('assets/data/classes.yaml', 'utf-8')) as CharacterClassData[];
const SPELLS = parse(readFileSync('assets/data/spells.yaml', 'utf-8')) as Array<{ id: string }>;
const byId = new Map(ITEMS.map((i) => [i.id, i]));
const CLASSIC = ['warrior', 'knight', 'thief', 'ninja', 'monk', 'master', 'red_mage', 'red_wizard', 'white_mage',
  'white_wizard', 'black_mage', 'black_wizard'];

describe('EQ: FF1 gear (Appendix A)', () => {
  beforeAll(loadRealRegistries);

  it('the table covers every gear item and nothing else', () => {
    const gear = ITEMS.filter((i) => i.type === 'weapon' || i.type === 'armor').map((i) => i.id).sort();
    expect(GEAR.map((r) => r.id).sort()).toEqual(gear);
  });

  it.each(GEAR.map((r) => [r.id, r] as const))('%s: stats, price, jobs and effects', (id, r) => {
    const it = byId.get(id)!;
    if (it.type === 'weapon') {
      expect({ attack: it.stats.attack, hit: it.hit, crit: it.crit }).toEqual({ attack: r.attack, hit: r.hit, crit: r.crit });
    } else {
      expect({ defense: it.stats.defense, weight: it.weight ?? 0 }).toEqual({ defense: r.defense, weight: r.weight });
    }
    expect(it.price).toBe(r.price);
    expect(it.usableBy).toEqual(r.usableBy);
    for (const k of ['element', 'bonusVsFamily', 'battleSpell', 'resist'] as const) expect(it[k], k).toEqual(r[k]);
  });

  it('usableBy names only the 12 classic classes (D-EQ4)', () => {
    for (const it of ITEMS) for (const c of it.usableBy) expect(CLASSIC, `${it.id}: ${c}`).toContain(c);
  });

  it('FF1 lists name the promoted class wherever they name its base (so inheritance changes nothing)', () => {
    const promo: Record<string, string> = { warrior: 'knight', thief: 'ninja', monk: 'master', red_mage: 'red_wizard',
      white_mage: 'white_wizard', black_mage: 'black_wizard' };
    for (const it of ITEMS) for (const [b, p] of Object.entries(promo)) {
      if (it.usableBy.includes(b)) expect(it.usableBy, `${it.id}: ${b} without ${p}`).toContain(p);
    }
  });

  it('every copy class equips exactly its copyOf source\'s gear, in both tiers', () => {
    const gear = ITEMS.filter((i) => i.type === 'weapon' || i.type === 'armor');
    const copies = CLASSES.filter((c) => c.copyOf);
    expect(copies.length).toBeGreaterThanOrEqual(24);
    for (const c of copies) {
      const a = new Character({ name: 'A', classData: ClassRegistry.getClass(c.id)! });
      const b = new Character({ name: 'B', classData: ClassRegistry.getClass(c.copyOf!)! });
      expect(gear.filter((i) => a.canEquip(i)).map((i) => i.id), c.id).toEqual(gear.filter((i) => b.canEquip(i)).map((i) => i.id));
    }
  });

  it('Cat Claw is FF1\'s: Knight, Ninja, Red and Black Wizard, no Monk', () => {
    expect(byId.get('cat_claw')!.usableBy).toEqual(['knight', 'ninja', 'red_wizard', 'black_wizard']);
  });

  it('every battleSpell is a spell; every resist is an element or a protection category', () => {
    const spells = new Set(SPELLS.map((s) => s.id));
    const cats = ['fire', 'ice', 'lightning', 'earth', 'holy', 'poison', 'death', 'poison_stone', 'status', 'time'];
    for (const it of ITEMS) {
      if (it.battleSpell) expect(spells.has(it.battleSpell), it.id).toBe(true);
      for (const r of it.resist ?? []) expect(cats, `${it.id}: ${r}`).toContain(r);
    }
  });

  it('the hand slot holds FF1\'s 8 glove items', () => {
    expect(ITEMS.filter((i) => i.slot === 'hands').map((i) => i.id)).toEqual(['gloves', 'copper_gauntlet', 'iron_gauntlet',
      'silver_gauntlet', 'zeus_gauntlet', 'power_gauntlet', 'opal_gauntlet', 'pro_ring']);
  });

  it('the House is a 3000 G camp item with a prompt', () => {
    expect(byId.get('house')).toMatchObject({ type: 'consumable', price: 3000 });
    expect(byId.get('house')!.prompt).toMatch(/House/);
  });
});
