/**
 * Pass PT (docs/PLAYTEST_ART_PLAN.md 6.1; the playtest of 2026-11-25: "Too many character sprites are the hero
 * sprites"): no map NPC wears a hero class's field sheet unless it is on the allowlist below, with its reason.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

type Npc = { id: string; sprite: string };
const classes = (parse(readFileSync('assets/data/classes.yaml', 'utf-8')) as { id: string }[]).map((c) => c.id);
const HERO = new Set(classes);

/** `<map>:<npc id>` -> why it keeps a hero sheet (plan 5.1, KEEP rows) */
const HERO_NPC_ALLOWLIST: Record<string, string> = {
  'cavern-earth-b4:ert_d_frozen_herald': "a dead knight of the king's escort in rimed armour: really a knight",
  'marsh-cave-b3:elf_d_last_escort': "a knight of the Western Keep's escort: really a knight",
  'giant-tunnel:ert_giant': 'the giant: a stone-tinted stand-in until a giant sheet exists, not a townsperson',
  'giant-tunnel:ert_giant_asleep': 'the giant, asleep (as ert_giant)',
  'past-temple-4:past_hollow_seraph': 'a boss stand-in (the Hollow Seraph speaks before its fight)',
  'sky-castle-5f:hollow_seraph': 'a boss stand-in (the Hollow Seraph, sky castle)',
  'past-temple-5:past_death_eye': 'a boss stand-in (the Death Eye) before its fight',
};

function users(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith('.yaml') && f !== 'index.yaml').flatMap((f) => {
    const npcs = (parse(readFileSync(`${dir}/${f}`, 'utf-8')) as { npcs?: Npc[] }).npcs ?? [];
    return npcs.filter((n) => HERO.has(n.sprite)).map((n) => `${f.replace(/\.yaml$/, '')}:${n.id}`);
  });
}

describe('PT: hero sheets are for the party', () => {
  it('reads the 16 hero classes from classes.yaml (pass CB: + barbarian, berserker, hunter, ranger)', () => {
    expect(classes).toHaveLength(16);
  });

  for (const dir of ['assets-src/maps', 'assets/maps/ai']) {
    it(`${dir}: only the allowlisted NPCs wear a hero sheet`, () => {
      expect(users(dir).sort()).toEqual(Object.keys(HERO_NPC_ALLOWLIST).sort());
    });
  }

  it('every allowlist entry has a reason', () => {
    for (const [k, why] of Object.entries(HERO_NPC_ALLOWLIST)) expect(why.length, k).toBeGreaterThan(10);
  });
});
