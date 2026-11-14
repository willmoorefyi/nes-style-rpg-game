import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { resolveNPCDialog, type MapData, type MapNPC } from '../../src/types/index.js';

// CT-10 / ST-9 / ST-10 (T5c), T3-T6 (R4a): the act-1 dialog, read from the compiled maps the game plays (assets/maps/ai).
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ids = parse(readFileSync(join(root, 'assets/maps/ai/index.yaml'), 'utf-8')) as string[];
const readMap = (id: string) => parse(readFileSync(join(root, 'assets/maps/ai', `${id}.yaml`), 'utf-8')) as MapData;
const maps = ids.map(readMap);
const npcs: Array<{ map: string; npc: MapNPC }> = maps.flatMap((m) => m.npcs.map((npc) => ({ map: m.id, npc })));
const items = parse(readFileSync(join(root, 'assets/data/items.yaml'), 'utf-8')) as Array<{ id: string; name: string }>;
const npc = (id: string): MapNPC => {
  const found = npcs.filter(({ npc: n }) => n.id === id);
  expect(found.length, id).toBe(1);
  return found[0].npc;
};

// The five flag states act 1 can reach (/tmp/playtest2/town/dialog.py): INTRO_COMPLETE always comes with the rescue.
const RESCUED = ['GARLAND_DEFEATED', 'PRINCESS_RESCUED'];
const STATES: Record<string, string[]> = {
  start: [], rescued: RESCUED, lute: [...RESCUED, 'GOT_LUTE'], intro: [...RESCUED, 'INTRO_COMPLETE'],
  all: [...RESCUED, 'GOT_LUTE', 'INTRO_COMPLETE'],
};
const FLAG_SETS = Object.values(STATES);
const say = (n: MapNPC, flags: string[]): string[] => resolveNPCDialog(n.dialog, (f) => flags.includes(f));
const talkers = npcs.filter(({ npc: n }) => !n.chestItem);

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

  it('no two NPCs say the same lines under any flag set (chests aside)', () => {
    for (const flags of FLAG_SETS) {
      const byLines = new Map<string, string[]>();
      for (const { map, npc: n } of talkers) {
        const key = JSON.stringify(say(n, flags));
        if (key === '[]') continue;
        byLines.set(key, [...(byLines.get(key) ?? []), `${map}:${n.id}`]);
      }
      const dupes = [...byLines.entries()].filter(([, who]) => who.length > 1);
      expect(dupes, `flags {${flags.join(', ')}}`).toEqual([]);
    }
  });

  it('no two NPCs share an opening sentence (T6)', () => {
    for (const [state, flags] of Object.entries(STATES)) {
      const byFirst = new Map<string, string[]>();
      for (const { map, npc: n } of talkers) {
        const first = say(n, flags)[0];
        if (!first) continue;
        const sentence = (first.match(/^[^.!?]*[.!?]/)?.[0] ?? first).trim();
        byFirst.set(sentence, [...(byFirst.get(sentence) ?? []), `${map}:${n.id}`]);
      }
      expect([...byFirst.entries()].filter(([, who]) => who.length > 1), state).toEqual([]);
    }
  });
});

describe('directions match the map (T3)', () => {
  it('no line mentions a bay or a forest on the way to the temple', () => {
    for (const { map, npc: n } of npcs) {
      for (const flags of FLAG_SETS) {
        for (const line of say(n, flags)) expect(line, `${map} ${n.id}`).not.toMatch(/\bbay\b|beyond the forest/i);
      }
    }
  });

  it('every line naming the temple with a compass direction gives the one the overworld shows', () => {
    const ow = readMap('overworld');
    const door = ow.transitions.find((t) => t.targetMap === 'temple-of-fiends')!;
    const [cx, cy] = ow.entrances!.cornelia;
    const dx = door.x - cx, dy = door.y - cy;
    const ns = dy < -2 ? 'north' : dy > 2 ? 'south' : '';
    const ew = dx < -2 ? 'west' : dx > 2 ? 'east' : '';
    const want = ns && ew ? `${ns}-${ew}` : ns || ew;
    expect(want).toBe('north-west');
    let n = 0;
    for (const { map, npc: c } of npcs) {
      for (const flags of FLAG_SETS) {
        for (const line of say(c, flags)) {
          for (const sentence of line.split(/(?<=[.!?;])\s+/).filter((s) => /temple/i.test(s))) {
            const dirs = [...sentence.matchAll(/\b(?:north|south)-(?:east|west)\b|\b(?:north|south|east|west)\b(?= of\b)/gi)]
              .map((m) => m[0].toLowerCase());
            for (const d of dirs) { expect(d, `${map} ${c.id}: ${sentence}`).toBe(want); n++; }
          }
        }
      }
    }
    expect(n).toBeGreaterThan(0);
  });

  it('the east gate guard says the road crosses the river', () => {
    expect(say(npc('east_gate_guard'), []).join(' ')).toMatch(/river|bridge/i);
  });
});

describe('lines that follow the story (T4 / T5 / T6)', () => {
  it('after the rescue no castle line says the princess is resting in her room (T4)', () => {
    for (const { map, npc: n } of npcs.filter((e) => e.map.startsWith('cornelia-castle'))) {
      for (const flags of FLAG_SETS.filter((f) => f.includes('PRINCESS_RESCUED'))) {
        for (const line of say(n, flags)) expect(line, `${map} ${n.id}`).not.toMatch(/resting|in her (room|chamber)|asleep/i);
      }
    }
  });

  it('nobody mentions the builders before the King orders them (T5)', () => {
    for (const flags of FLAG_SETS.filter((f) => !f.includes('INTRO_COMPLETE'))) {
      for (const { map, npc: n } of npcs) {
        for (const line of say(n, flags)) expect(line, `${map} ${n.id} {${flags.join(', ')}}`).not.toMatch(/builders?/i);
      }
    }
  });

  it('a looted chest is not offered again: its owner has an entry keyed on the chest flag (T6)', () => {
    for (const m of maps) {
      const chests = m.npcs.filter((n) => n.chestItem && n.chestFlag);
      if (!chests.length) continue;
      const open = chests.map((c) => c.chestFlag!);
      for (const n of m.npcs.filter((c) => !c.chestItem)) {
        const lines = say(n, []).join(' ');
        for (const c of chests) {
          const name = items.find((i) => i.id === c.chestItem)?.name ?? c.chestItem!;
          if (!/\bchest\b/i.test(lines) && !lines.toLowerCase().includes(name.toLowerCase())) continue;
          const keyed = (n.dialog as Array<string | { condition?: string }>)
            .some((d) => typeof d !== 'string' && d.condition === c.chestFlag);
          expect(keyed, `${m.id} ${n.id} has an entry for ${c.chestFlag}`).toBe(true);
          expect(say(n, open), `${m.id} ${n.id}`).not.toEqual(say(n, []));
        }
      }
    }
  });

  it('stale lines change once Garland falls, or once the act ends (T6)', () => {
    for (const id of ['villager', 'treasury_guard', 'patron_soldier']) {
      expect(say(npc(id), STATES.rescued), id).not.toEqual(say(npc(id), STATES.start));
    }
    expect(say(npc('stair_guard'), STATES.intro)).not.toEqual(say(npc('stair_guard'), STATES.start));
  });

  it('the weaver never calls a rug blue, the priestess never offers rest (T6)', () => {
    for (const flags of FLAG_SETS) {
      expect(say(npc('weaver'), flags).join(' ')).not.toMatch(/blue/i);
      expect(say(npc('priestess'), flags).join(' ')).not.toMatch(/\brest\b/i);
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
    expect(say(npc('tower_sage'), STATES.intro).join(' ')).not.toMatch(/lute/i);
    expect(say(npc('tower_sage'), STATES.all).join(' ')).toMatch(/lute/i);
  });

  it('the princess stops offering the lute once it is given', () => {
    const princess = npc('princess');
    expect(princess.giftFlag).toBe('GOT_LUTE');
    expect(say(princess, STATES.rescued).join(' ')).toMatch(/take this lute/i);
    expect(say(princess, STATES.all).join(' ')).not.toMatch(/take this lute/i);
  });

  it('the cook has a line for the princess coming home', () => {
    const cook = npc('castle_cook');
    expect(say(cook, STATES.rescued)).not.toEqual(say(cook, []));
  });

  it('the garden maid does not say the princess walks in the gardens', () => {
    expect(say(npc('garden_maid'), STATES.rescued).join(' ')).not.toMatch(/garden/i);
  });
});
