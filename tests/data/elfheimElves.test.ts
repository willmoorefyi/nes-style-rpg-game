/**
 * Pass PT (docs/PLAYTEST_ART_PLAN.md 6.2; the playtest of 2026-11-25: "There are no elves in elfheim"): Elfheim's
 * people are elves, drawn as elves (no tint), and the elf sheets stay in Elfheim.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

type Npc = { id: string; sprite: string; tint?: string };
const DIR = 'assets/maps/ai';
const maps = readdirSync(DIR).filter((f) => f.endsWith('.yaml') && f !== 'index.yaml').map((f) => f.replace(/\.yaml$/, ''));
const npcs = (m: string) => ((parse(readFileSync(`${DIR}/${m}.yaml`, 'utf-8')) as { npcs?: Npc[] }).npcs ?? [])
  .filter((n) => n.sprite !== 'chest');
const ELFHEIM = maps.filter((m) => m === 'elfheim' || m.startsWith('elfheim-'));
/** the visitors who are not elves, `<map>:<npc id>` -> who they are */
const ELFHEIM_VISITORS: Record<string, string> = {
  'elfheim:elfheim_trader': "a trader from Pravoka (\"I'm from Pravoka\")",
  'elfheim:elfheim_dwarf_peddler': 'a dwarf from the strait',
  'elfheim-inn:elfheim_inn_guest': 'a human waiting for a ship to Pravoka',
};
const ELF_SHEETS = ['elf_man', 'elf_woman', 'elf_guard', 'elf_elder', 'elf_mage', 'elf_child', 'elf_prince'];

describe('PT: the elves of Elfheim', () => {
  it('every person on an Elfheim map wears an elf sheet, but the three visitors', () => {
    const bad = ELFHEIM.flatMap((m) => npcs(m).filter((n) => !n.sprite.startsWith('elf_') && !ELFHEIM_VISITORS[`${m}:${n.id}`])
      .map((n) => `${m}:${n.id} (${n.sprite})`));
    expect(bad).toEqual([]);
    const visitors = ELFHEIM.flatMap((m) => npcs(m).filter((n) => ELFHEIM_VISITORS[`${m}:${n.id}`]).map((n) => `${m}:${n.id}`));
    expect(visitors.sort()).toEqual(Object.keys(ELFHEIM_VISITORS).sort());
  });

  it('no elf is tinted (the sheets are elves by their own colours)', () => {
    const tinted = ELFHEIM.flatMap((m) => npcs(m).filter((n) => n.sprite.startsWith('elf_') && n.tint).map((n) => `${m}:${n.id}`));
    expect(tinted).toEqual([]);
  });

  it('each of the seven elf sheets is placed, and only in Elfheim', () => {
    const used = new Set(ELFHEIM.flatMap((m) => npcs(m).map((n) => n.sprite)));
    for (const s of ELF_SHEETS) expect(used.has(s), s).toBe(true);
    const outside = maps.filter((m) => !ELFHEIM.includes(m))
      .flatMap((m) => npcs(m).filter((n) => ELF_SHEETS.includes(n.sprite)).map((n) => `${m}:${n.id}`));
    expect(outside).toEqual([]);
  });
});
