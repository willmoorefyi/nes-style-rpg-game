/**
 * ELF-O's Western Keep and stage S6 (docs/WORLD_PLAN.md 3.2, 4.2, 6.3 GT-6 / GT-7, 6.4, D-W14), on the compiled maps
 * and the real quest data: the false king sits on his throne only once the Marsh Cave's guard has fallen, his
 * cutscene plays only with the crown, Astos (the same cell) appears only after it, and only then does talking start
 * the fight; the crystal eye comes only from Astos's postVictoryCutscene. Then the S6 walk and proofs (a)-(c) in
 * assume mode (`--stage S6`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { MapData } from '../../../src/types/index.js';
import { npcOutcome, type FieldState } from '../../../src/systems/fieldRules.js';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { createQuestContext, proofOrder } from '../../../src/progression/questProofs.js';
import { proofSkips, proofSoftlocks } from '../../../src/progression/questChecks.js';

const f2 = parse(readFileSync('assets/maps/ai/western-keep-2f.yaml', 'utf-8')) as MapData;
const f1 = parse(readFileSync('assets/maps/ai/western-keep-1f.yaml', 'utf-8')) as MapData;
const cutscenes = parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Array<Record<string, unknown>> }>;
const npc = (id: string) => f2.npcs.find((n) => n.id === id)!;
const state = (flags: string[], items: string[] = []): FieldState => ({ flags: new Set(flags), items: new Set(items),
  vehicles: [], mode: 'walking' } as FieldState);
const talk = (id: string, s: FieldState) => npcOutcome(npc(id), s, f2.scriptedEncounters ?? []);

describe('ELF-O: the Western Keep', () => {
  it('before the Marsh Cave guard falls the throne is empty; without the crown the false king only asks for it', () => {
    expect(talk('false_king', state([])).present).toBe(false);
    const asks = talk('false_king', state(['MARSH_GUARD_DEFEATED']));
    expect(asks.present).toBe(true);
    expect(asks.cutscene).toBeUndefined();
    expect(asks.battle).toBeUndefined();
    expect(asks.dialog.join(' ')).toMatch(/crown/);
    expect(talk('astos', state(['MARSH_GUARD_DEFEATED'], ['crown'])).present).toBe(false);
  });

  it('with the crown his cutscene takes it and sets ELF_O_CROWN_GIVEN; then Astos stands there and fights', () => {
    const out = talk('false_king', state(['MARSH_GUARD_DEFEATED'], ['crown']));
    expect(out.cutscene).toBe('elf_o_crown_taken');
    const steps = cutscenes.find((c) => c.id === 'elf_o_crown_taken')!.steps;
    expect(steps.find((s) => s.type === 'take_item')?.item).toBe('crown');
    expect(steps.find((s) => s.type === 'set_flag')?.flag).toBe('ELF_O_CROWN_GIVEN');
    const after = state(['MARSH_GUARD_DEFEATED', 'ELF_O_CROWN_GIVEN']);
    expect(talk('false_king', after).present).toBe(false);
    expect(talk('astos', after).battle).toBe('ASTOS_DEFEATED');
    const enc = f2.scriptedEncounters!.find((e) => e.npc === 'astos')!;
    expect(enc.enemyIds).toEqual(['astos', 'gargoyle', 'gargoyle', 'gargoyle']);
    expect([enc.isBoss, enc.postVictoryCutscene]).toEqual([true, 'elf_astos_unmasked']);
    expect(talk('astos', state(['MARSH_GUARD_DEFEATED', 'ELF_O_CROWN_GIVEN', 'ASTOS_DEFEATED'])).present).toBe(false);
  });

  it('the crystal eye is given only by elf_astos_unmasked (D-W14), and 2F is the canSave-false boss floor', () => {
    const gives = cutscenes.filter((c) => c.steps.some((s) => s.type === 'give_item' && s.item === 'crystal_eye'));
    expect(gives.map((c) => c.id)).toEqual(['elf_astos_unmasked']);
    for (const m of [f1, f2]) expect(m.npcs.some((n) => n.chestItem === 'crystal_eye' || n.giftItem === 'crystal_eye')).toBe(false);
    expect(f2.canSave).toBe(false);
    expect(f2.entrances?.boss).toBeDefined();
    expect([f1.exit, f2.exit]).toEqual([{ map: 'overworld', entrance: 'elf_keep' }, { map: 'overworld', entrance: 'elf_keep' }]);
  });

  it('twin stairs: each wing of 1F climbs to its own 2F gallery and back', () => {
    const up = f1.transitions.filter((t) => t.targetMap === 'western-keep-2f').map((t) => t.targetEntrance);
    const down = f2.transitions.filter((t) => t.targetMap === 'western-keep-1f').map((t) => t.targetEntrance);
    expect([...new Set(up)].sort()).toEqual(['arrival', 'arrival_east']);
    expect([...new Set(down)].sort()).toEqual(['up', 'up_east']);
  });
});

describe('ELF-O: stage S6 in assume mode', () => {
  const ctx = createQuestContext(loadQuestWorld(), { stage: 'S6' });

  it('(a) the walk (the crown, then the fight) reaches S6; (b) no skip; (c) no soft-lock', () => {
    expect(proofOrder(ctx).failures.map((f) => f.message)).toEqual([]);
    expect(proofSkips(ctx).failures.map((f) => f.message)).toEqual([]);
    expect(proofSoftlocks(ctx).failures.map((f) => f.message)).toEqual([]);
  });
});
