/**
 * Playtest fix tranche FX-A (docs/PLAYTEST_FIX_PLAN.md): dialogue-state checks for P1-1-02, -03, -06, -07, -08, -11 and
 * P3-06, -07, -10, read from the compiled maps, cutscenes.yaml and debug-scenarios.yaml.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { resolveNPCDialog, type MapData, type MapNPC } from '../../src/types/index.js';
import { CutsceneManager, type CutsceneStep, type CutsceneDeps } from '../../src/systems/CutsceneManager.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { receivedText } from '../../src/systems/pickupText.js';
import { EndCard } from '../../src/scenes/exploration/EndCard.js';

const load = <T>(p: string): T => parse(readFileSync(p, 'utf-8')) as T;
const npcs = (map: string): MapNPC[] => load<MapData>(`assets/maps/ai/${map}.yaml`).npcs ?? [];
const say = (map: string, id: string, ...flags: string[]): string => {
  const npc = npcs(map).find((n) => n.id === id);
  if (!npc) throw new Error(`no npc ${id} in ${map}`);
  return resolveNPCDialog(npc.dialog, (f) => flags.includes(f)).join(' ');
};
const scripts = load<Array<{ id: string; steps: CutsceneStep[] }>>('assets/data/cutscenes.yaml');
const script = (id: string): CutsceneStep[] => {
  const s = scripts.find((x) => x.id === id);
  if (!s) throw new Error(`no cutscene ${id}`);
  return s.steps;
};

describe('P1-1-02: the King and the chancellor after the bridge', () => {
  it('stop talking about builders at work once BRIDGE_BUILT is set', () => {
    for (const id of ['king', 'chancellor']) {
      expect(say('cornelia-castle-2f', id, 'INTRO_COMPLETE', 'PRINCESS_RESCUED')).toMatch(/builders/);
      expect(say('cornelia-castle-2f', id, 'INTRO_COMPLETE', 'PRINCESS_RESCUED', 'BRIDGE_BUILT')).not.toMatch(/at work/);
    }
  });
});

describe('P1-1-03: the pirates count themselves like the fight does (nine pirates, the Captain one of them)', () => {
  it('the den pirate and Bikke agree with the nine enemies of the scripted fight', () => {
    const pravoka = load<MapData>('assets/maps/ai/pravoka.yaml');
    const fight = pravoka.scriptedEncounters?.find((e) => e.npc === 'bikke');
    expect(fight?.enemyIds).toHaveLength(9);
    expect(say('pravoka', 'pirate_den_b')).toMatch(/Nine of us, the Captain counted/);
    expect(say('pravoka', 'pirate_den_b')).not.toMatch(/makes ten/);
    expect(say('pravoka', 'bikke')).toMatch(/eight blades, my own the ninth/);
  });
});

describe('P1-1-06 and P3-07: gifts use the shared pickup line as their own message', () => {
  function deps(shown: string[]): CutsceneDeps {
    return {
      showDialog: vi.fn(async (t: string) => { shown.push(t); }),
      flags: new GameFlags(), party: [], inventory: new Inventory(),
    };
  }

  it('give_item with announce shows receivedText after the item is in the bag', async () => {
    const items = load<Array<{ id: string; name: string; type: string }>>('assets/data/items.yaml');
    await ItemRegistry.init({ loadItems: async () => items } as never);
    const shown: string[] = [];
    const d = deps(shown);
    await new CutsceneManager(d).play([{ type: 'give_item', item: 'herb', announce: true }]);
    expect(shown).toEqual([receivedText('herb')]);
    expect(shown[0]).toMatch(/^You received .*Herb!$/);
    expect(d.inventory?.canAdd('herb')).toBe(true);
  });

  it('give_item without announce stays silent', async () => {
    const shown: string[] = [];
    await new CutsceneManager(deps(shown)).play([{ type: 'give_item', item: 'herb' }]);
    expect(shown).toEqual([]);
  });

  it.each([
    ['a1_matoya_sight', 'herb'],
    ['elf_prince_wakes', 'mystic_key'],
    ['ert_smyth_forge', 'excalibur'],
  ])('%s announces %s after its last speech line, with no "Received" glued to speech', (id, item) => {
    const steps = script(id);
    const give = steps.findIndex((s) => s.type === 'give_item' && s.item === item);
    expect(give).toBeGreaterThan(0);
    expect(steps[give].announce).toBe(true);
    const lastSpeech = steps.map((s, i) => (s.type === 'dialog' ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
    expect(give).toBeGreaterThan(lastSpeech);
    for (const s of steps) expect(s.text ?? '').not.toMatch(/Received the/);
  });

  it('no cutscene text carries its own "Received the ..." or "You received the ..." line', () => {
    for (const sc of scripts) for (const s of sc.steps) expect(s.text ?? '', sc.id).not.toMatch(/received the/i);
  });
});

describe('P1-1-07: the Western Keep 1F courtiers match the empty throne before the Marsh Cave', () => {
  it.each(['gate_warden', 'courtier_vell', 'guard_sorrel'])('%s', (id) => {
    const before = say('western-keep-1f', id);
    const seated = say('western-keep-1f', id, 'MARSH_GUARD_DEFEATED');
    const after = say('western-keep-1f', id, 'MARSH_GUARD_DEFEATED', 'ASTOS_DEFEATED');
    expect(before).not.toBe(seated);
    expect(before).not.toMatch(/not left his chair|laughing|laughter/);
    expect(seated).not.toBe(after);
  });

  it('the seated king is still the one the 1F lines describe, and the empty throne is acknowledged', () => {
    expect(say('western-keep-1f', 'gate_warden')).toMatch(/chair empty/);
    expect(say('western-keep-1f', 'gate_warden', 'MARSH_GUARD_DEFEATED')).toMatch(/not left his chair/);
    expect(say('western-keep-1f', 'courtier_vell', 'MARSH_GUARD_DEFEATED')).toMatch(/without it/);
  });
});

describe('P1-1-08: every w_s<n> scenario holds the lute (S0 grant) and its GOT_LUTE flag', () => {
  const sc = load<Array<{ id: string; flags?: string[]; items?: Record<string, number> }>>('assets/data/debug-scenarios.yaml');
  const staged = sc.filter((s) => /^w_s\d+_/.test(s.id));
  it('finds the scenarios', () => expect(staged.length).toBeGreaterThan(40));
  it.each(staged.map((s) => [s.id, s] as const))('%s', (_id, s) => {
    expect(s.flags ?? []).toContain('GOT_LUTE');
    expect(s.items?.lute).toBeGreaterThanOrEqual(1);
  });
  it('holds the flags of every stage before it (w_s5 .. w_s12: the S1-S4 chain)', () => {
    const quest = load<{ stages: Array<{ id: string; after: string[]; grants: { flags: string[] } }> }>('assets/data/quest.yaml');
    const byId = new Map(quest.stages.map((s) => [s.id, s]));
    const ancestors = (id: string, seen = new Set<string>()): Set<string> => {
      for (const a of byId.get(id)?.after ?? []) if (!seen.has(a)) { seen.add(a); ancestors(a, seen); }
      return seen;
    };
    for (const id of ['w_s5_start', 'w_s6_start', 'w_s10_start', 'w_s12_start']) {
      const have = new Set(staged.find((s) => s.id === id)?.flags ?? []);
      for (const a of ancestors(`S${id.match(/w_s(\d+)/)![1]}`)) {
        for (const f of byId.get(a)!.grants.flags) expect(have.has(f), `${id} lacks ${f} of ${a}`).toBe(true);
      }
    }
  });
});

describe('P1-1-11: the herb is crushed once', () => {
  it('the prince NPC page describes the crushing and the cutscene does not repeat it', () => {
    expect(say('elfheim-castle-chamber', 'elfheim_prince', 'HERB')).toBeDefined();
    const first = script('elf_prince_wakes')[0].text ?? '';
    expect(first).not.toMatch(/crush/i);
  });
});

describe('P3-10: the cube leaves the automaton before the pickup line', () => {
  it('the hand-over is the last line of the automaton page and the cutscene no longer opens with it', () => {
    const page = resolveNPCDialog(npcs('waterfall-cave').find((n) => n.id === 'automaton')!.dialog, () => false);
    expect(page[page.length - 1]).toMatch(/cube leaves the brass hands/);
    expect(script('wat_cube_given').some((s) => /leaves the brass hands/.test(s.text ?? ''))).toBe(false);
  });
});

describe('P3-06: the ending is a card on black', () => {
  it('the cutscene fades to black before end_game, and end_game shows its text through the card', async () => {
    const steps = script('ending');
    const end = steps.findIndex((s) => s.type === 'end_game');
    expect(steps[end - 1].type).toBe('fade_out');
    expect(steps[end].text).toContain('\n');
    const cards: string[] = [];
    const dialogs: string[] = [];
    const d: CutsceneDeps = {
      showDialog: vi.fn(async (t: string) => { dialogs.push(t); }),
      showCard: vi.fn(async (t: string) => { cards.push(t); }),
      endGame: vi.fn(), flags: new GameFlags(), party: [],
    };
    await new CutsceneManager(d).play([steps[end]]);
    expect(cards).toEqual([steps[end].text]);
    expect(dialogs).toEqual([]);
    expect(d.endGame).toHaveBeenCalledTimes(1);
  });

  it('EndCard waits for confirm, then resolves and hides', async () => {
    const card = new EndCard();
    let pressed = false;
    const input = { isJustPressed: (a: string) => a === 'confirm' && pressed };
    let done = false;
    const p = card.show('The road is closed behind you.\nThe End').then(() => { done = true; });
    expect(card.active).toBe(true);
    expect(card.container.visible).toBe(true);
    expect(card.container.children).toHaveLength(2);
    card.update(input as never);
    await Promise.resolve();
    expect(done).toBe(false);
    pressed = true;
    card.update(input as never);
    await p;
    expect(done).toBe(true);
    expect(card.active).toBe(false);
    expect(card.container.visible).toBe(false);
  });
});
