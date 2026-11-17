/**
 * D-W14 (docs/WORLD_PLAN.md 1.3, 6.3 GT-6): a key item that 3.1 lists as a boss-cutscene gift is given only by a
 * boss's `postVictoryCutscene` (`give_item`), never by a chest, a non-boss NPC's gift or another cutscene; so no
 * presence mutation can hand it out without the fight. Checked statically on every map the game loads.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { MapData } from '../../src/types/index.js';

/** WORLD 3.1: the key items a boss's cutscene gives (stage, boss). */
export const BOSS_GIFTS: Readonly<Record<string, string>> = {
  crown: 'S5 marsh guard', crystal_eye: 'S6 astos', ruby: 'S11 vampire', levistone: 'S16 evil_eye',
  ordeal_seal: 'S18 dragon_zombie', slab: 'S24 drowned_sovereign',
};

type Cutscenes = Array<{ id: string; steps?: Array<{ type: string; item?: string }> }>;

/** The map fields the check reads (MapData has them). */
interface LeakMap {
  id: string;
  npcs?: Array<{ id: string; chestItem?: string; giftItem?: string }>;
  scriptedEncounters?: Array<{ isBoss?: boolean; postVictoryCutscene?: string }>;
}

/** The ways a map or a cutscene hands out a boss gift other than its boss's victory. */
export function bossGiftLeaks(maps: LeakMap[], cutscenes: Cutscenes): string[] {
  const out: string[] = [];
  const bossCuts = new Set<string>();
  for (const m of maps) for (const e of m.scriptedEncounters ?? []) if (e.isBoss && e.postVictoryCutscene) bossCuts.add(e.postVictoryCutscene);
  for (const m of maps) {
    for (const n of m.npcs ?? []) {
      if (n.chestItem && BOSS_GIFTS[n.chestItem]) out.push(`${m.id}: chest ${n.id} holds ${n.chestItem}`);
      if (n.giftItem && BOSS_GIFTS[n.giftItem]) out.push(`${m.id}: npc ${n.id} gives ${n.giftItem}`);
    }
  }
  for (const c of cutscenes) {
    for (const s of c.steps ?? []) {
      if (s.type === 'give_item' && s.item && BOSS_GIFTS[s.item] && !bossCuts.has(c.id)) {
        out.push(`cutscene ${c.id} gives ${s.item} but is no boss's postVictoryCutscene`);
      }
    }
  }
  return out;
}

function gameMaps(): MapData[] {
  const out = new Map<string, MapData>();
  for (const dir of ['assets/maps', 'assets/maps/ai']) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.yaml') && x !== 'index.yaml')) {
      const m = parse(readFileSync(join(dir, f), 'utf-8')) as MapData;
      if (m && typeof m === 'object' && 'id' in m) out.set(`${dir}/${m.id}`, m);
    }
  }
  return [...out.values()];
}

describe('bossItems: D-W14', () => {
  it('RED: a crown in a chest, a ruby from a plain NPC, a levistone from a non-boss cutscene', () => {
    const map: LeakMap = {
      id: 'marsh-cave-b3', npcs: [{ id: 'c', chestItem: 'crown' }, { id: 'g', giftItem: 'ruby' }],
      scriptedEncounters: [{ isBoss: true, postVictoryCutscene: 'won' }],
    };
    const cuts: Cutscenes = [{ id: 'won', steps: [{ type: 'give_item', item: 'crown' }] },
      { id: 'talk', steps: [{ type: 'give_item', item: 'levistone' }] }];
    expect(bossGiftLeaks([map], cuts)).toEqual(['marsh-cave-b3: chest c holds crown', 'marsh-cave-b3: npc g gives ruby',
      'cutscene talk gives levistone but is no boss\'s postVictoryCutscene']);
    expect(bossGiftLeaks([{ ...map, npcs: [] }], cuts.slice(0, 1))).toEqual([]);
  });

  it('every map and cutscene of the repository keeps the boss gifts behind their fights', () => {
    const cuts = (parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Cutscenes) ?? [];
    expect(bossGiftLeaks(gameMaps(), cuts)).toEqual([]);
  });
});
