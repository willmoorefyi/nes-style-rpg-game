/**
 * `assets/data/quest.yaml`, the declared DAG of pass W (docs/WORLD_PLAN.md 3.2-3.5, 5.1 W1-0a): it validates, holds
 * S0-S31 and the eight shop towns, and every stage and town sits between its owner's anchors.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { validateQuestData } from '../../src/core/schemaValidationQuest.js';
import { isKnownFlag } from '../../src/core/GameFlags.js';
import { ValidationError } from '../../src/core/schemaValidation.js';

const text = readFileSync('assets/data/quest.yaml', 'utf-8');
const quest = validateQuestData(parse(text));
const enemyIds = new Set((parse(readFileSync('assets/data/enemies.yaml', 'utf-8')) as { id: string }[]).map((e) => e.id));

/** The owner anchors in file order: which owner each `- id:` line sits under (null outside any anchor). */
function ownersByLine(): Map<string, string | null> {
  const out = new Map<string, string | null>();
  let open: string | null = null;
  for (const line of text.split('\n')) {
    const start = /^ {2}# === (\S+)( town)? \(pass W: owned by (\S+)\) ===$/.exec(line);
    const end = /^ {2}# === end (\S+)( town)? ===$/.exec(line);
    if (start) {
      expect(open, `anchor ${start[1]} opened inside ${open}`).toBeNull();
      expect(start[3]).toBe(start[1]);
      open = start[1];
    } else if (end) {
      expect(end[1]).toBe(open);
      open = null;
    }
    const id = /^ {2}- id: (\S+)$/.exec(line);
    if (id) out.set(id[1], open);
  }
  expect(open).toBeNull();
  return out;
}

describe('quest.yaml', () => {
  it('has the goal, S0-S31 and the eight towns', () => {
    expect(quest.goal).toBe('CHAOS_DEFEATED');
    expect(quest.stages.map((s) => s.id).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))))
      .toEqual(Array.from({ length: 32 }, (_, i) => `S${i}`));
    expect(quest.towns.map((t) => t.id).sort())
      .toEqual(['crescent', 'dwarf', 'elfheim', 'gaia', 'lufenia', 'melmond', 'onrac', 'pravoka']);
  });

  it('S0 is built and every other stage pending; S19 and S31 are optional', () => {
    for (const s of quest.stages) expect(s.status, s.id).toBe(s.id === 'S0' ? 'built' : 'pending');
    expect(quest.stages.filter((s) => s.optional).map((s) => s.id).sort()).toEqual(['S19', 'S31']);
    for (const t of quest.towns) expect(t.status).toBe('pending');
  });

  it('every stage and town sits between its owner\'s anchors (S0 outside them)', () => {
    const owners = ownersByLine();
    for (const s of quest.stages) expect(owners.get(s.id), s.id).toBe(s.id === 'S0' ? null : s.tranche);
    for (const t of quest.towns) expect(owners.get(t.id), t.id).toBe(t.owner);
  });

  it('names only known flags and existing bosses; milestones are S13\'s and S30\'s, in order', () => {
    for (const s of quest.stages) {
      for (const f of [...s.requires.flags, ...s.grants.flags]) expect(isKnownFlag(f), `${s.id} ${f}`).toBe(true);
      for (const b of s.boss) expect(enemyIds.has(b), `${s.id} boss ${b}`).toBe(true);
      expect(s.basins, s.id).toEqual({});
    }
    const ms = Object.fromEntries(quest.stages.filter((s) => s.milestones).map((s) => [s.id, s.milestones]));
    expect(Object.keys(ms).sort()).toEqual(['S13', 'S30']);
    expect(ms.S13).toEqual(['EARTH_SEAL_BROKEN', 'EARTH_CAVE_COMPLETE', 'EARTH_CRYSTAL_LIT']);
    expect(ms.S30?.[ms.S30.length - 1]).toBe('CHAOS_DEFEATED');
  });

  // WORLD 3.3: S18 (the Citadel) leads only to the optional S19, so it is the one non-optional stage off the goal's path
  it('the goal is granted by S30, which every stage but S18, S19 and S31 leads to', () => {
    const byId = new Map(quest.stages.map((s) => [s.id, s]));
    expect(byId.get('S30')?.grants.flags).toContain(quest.goal);
    const closure = new Set<string>();
    const visit = (id: string): void => {
      if (closure.has(id)) return;
      closure.add(id);
      for (const a of byId.get(id)?.after ?? []) visit(a);
    };
    visit('S30');
    expect(quest.stages.filter((s) => !closure.has(s.id)).map((s) => s.id).sort()).toEqual(['S18', 'S19', 'S31']);
  });

  it('the validator rejects a cycle and an unknown stage', () => {
    const bad = parse(text) as { stages: { id: string; after: string[] }[] };
    bad.stages[0].after = ['S30'];
    expect(() => validateQuestData(bad)).toThrow(ValidationError);
    const unknown = parse(text) as { stages: { id: string; after: string[] }[] };
    unknown.stages[1].after = ['S99'];
    expect(() => validateQuestData(unknown)).toThrow(/unknown S99/);
  });
});
