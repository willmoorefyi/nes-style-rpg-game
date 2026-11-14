import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { resolveNPCDialog, type MapData, type MapNPC } from '../../src/types/index.js';

// CT-10 / ST-9 / ST-10 (T5c): the act-1 dialog, read from the compiled maps the game plays (assets/maps/ai).
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ids = parse(readFileSync(join(root, 'assets/maps/ai/index.yaml'), 'utf-8')) as string[];
const maps = ids.map((id) => parse(readFileSync(join(root, 'assets/maps/ai', `${id}.yaml`), 'utf-8')) as MapData);
const npcs: Array<{ map: string; npc: MapNPC }> = maps.flatMap((m) => m.npcs.map((npc) => ({ map: m.id, npc })));
const npc = (id: string): MapNPC => {
  const found = npcs.filter(({ npc: n }) => n.id === id);
  expect(found.length, id).toBe(1);
  return found[0].npc;
};

const FLAG_SETS: string[][] = [[], ['INTRO_COMPLETE'], ['INTRO_COMPLETE', 'PRINCESS_RESCUED'],
  ['INTRO_COMPLETE', 'PRINCESS_RESCUED', 'GOT_LUTE']];
const say = (n: MapNPC, flags: string[]): string[] => resolveNPCDialog(n.dialog, (f) => flags.includes(f));
// lines that several NPCs may share on purpose
const SHARED_OK = new Set([JSON.stringify(['Long live the King!'])]);

describe('act-1 dialog (CT-10)', () => {
  it('reads every NPC of the act-1 maps', () => {
    expect(ids).toContain('cornelia');
    expect(ids).toContain('cornelia-castle');
    expect(npcs.length).toBeGreaterThan(40);
  });

  it('no line talks about a "dungeon"', () => {
    for (const { map, npc: n } of npcs) {
      for (const flags of FLAG_SETS) {
        for (const line of say(n, flags)) expect(line, `${map} ${n.id}`).not.toMatch(/dungeon/i);
      }
    }
  });

  it('no two NPCs say the same lines under any flag set (chests and an allow-list aside)', () => {
    for (const flags of FLAG_SETS) {
      const byLines = new Map<string, string[]>();
      for (const { map, npc: n } of npcs.filter(({ npc: c }) => !c.chestItem)) {
        const key = JSON.stringify(say(n, flags));
        if (key === '[]' || SHARED_OK.has(key)) continue;
        byLines.set(key, [...(byLines.get(key) ?? []), `${map}:${n.id}`]);
      }
      const dupes = [...byLines.entries()].filter(([, who]) => who.length > 1);
      expect(dupes, `flags {${flags.join(', ')}}`).toEqual([]);
    }
  });
});

describe('castle lines before the audience (ST-9)', () => {
  it('the treasury guard and the cellar steward do not assume the party has met the King', () => {
    for (const id of ['treasury_guard', 'cellar_steward']) {
      for (const line of say(npc(id), [])) expect(line, id).not.toMatch(/for you|royal order/i);
    }
  });
});

describe('dialog keyed to the right flag (ST-10)', () => {
  it('the tower sage mentions the lute only once the party has it', () => {
    const rescued = say(npc('tower_sage'), ['INTRO_COMPLETE', 'PRINCESS_RESCUED']);
    expect(rescued.join(' ')).not.toMatch(/lute/i);
    expect(say(npc('tower_sage'), FLAG_SETS[3]).join(' ')).toMatch(/lute/i);
  });

  it('the princess stops offering the lute once it is given', () => {
    const princess = npc('princess');
    expect(princess.giftFlag).toBe('GOT_LUTE');
    expect(say(princess, ['PRINCESS_RESCUED']).join(' ')).toMatch(/take this lute/i);
    expect(say(princess, FLAG_SETS[3]).join(' ')).not.toMatch(/take this lute/i);
  });

  it('the cook has a line for the princess coming home', () => {
    const cook = npc('castle_cook');
    expect(say(cook, ['PRINCESS_RESCUED'])).not.toEqual(say(cook, []));
  });

  it('the garden maid does not say the princess walks in the gardens', () => {
    expect(say(npc('garden_maid'), ['PRINCESS_RESCUED']).join(' ')).not.toMatch(/garden/i);
  });
});
