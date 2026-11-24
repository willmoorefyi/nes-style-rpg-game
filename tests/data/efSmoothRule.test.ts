/**
 * The EF smoothing rule (the user's standing rule, 2026-11-24; docs/NEW_MONSTER_GUIDE.md 1.4 / 1.5): every monster
 * sheet approved on or after pass EF (its approved json dated 2026-11-24 or later, or a Bedrock sheet) has an entry in
 * assets-src/gen/monster_scale.yaml that smooths it: a dict with `smooth: [despur]` and/or a hi-res texture
 * (`tex` > 1, Scale2x by gen/monster_hires.py). The default is both; an image review may drop one of the two (the
 * shadow kept its texture without despur), never both. The same rule runs in the gen selftest (selftest_hires.py).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const APPROVED = join(root, 'assets-src/gen/approved');
/** The first day of pass EF: sheets approved from this date on fall under the rule. */
const EF_START = '2026-11-24';

interface SheetJson { backend?: string; approved?: string }
type ScaleValue = number | { scale?: number; tex?: number; smooth?: string[] };

/** The monster / boss sheets under the rule: {sprite id: [sheet file, ...]}. */
function ruledSheets(sheets: Record<string, Record<string, SheetJson>>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [id, files] of Object.entries(sheets)) {
    for (const [file, j] of Object.entries(files)) {
      if (!/^(monster|boss)_.*\.json$/.test(file)) continue;
      if (j.backend === 'bedrock' || String(j.approved ?? '') >= EF_START) (out[id] ??= []).push(file);
    }
  }
  return out;
}

/** The failures: one line per ruled sprite whose table entry does not smooth it. */
function smoothRuleFailures(sheets: Record<string, Record<string, SheetJson>>,
  table: Record<string, ScaleValue>): string[] {
  const fails: string[] = [];
  for (const [id, files] of Object.entries(ruledSheets(sheets))) {
    const v = table[id];
    const ok = typeof v === 'object' && v !== null &&
      ((v.smooth ?? []).includes('despur') || (v.tex ?? 1) > 1);
    if (!ok) fails.push(`${id} (${files.join(', ')}): no smooth / hi-res entry in monster_scale.yaml`);
  }
  return fails;
}

function readSheets(): Record<string, Record<string, SheetJson>> {
  const out: Record<string, Record<string, SheetJson>> = {};
  for (const d of readdirSync(APPROVED, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('_')) continue;   // _retired archives are never built
    const id = d.name;
    const dir = join(APPROVED, id);
    for (const f of readdirSync(dir)) {
      if (!/^(monster|boss)_.*\.json$/.test(f)) continue;
      (out[id] ??= {})[f] = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as SheetJson;
    }
  }
  return out;
}

const table = (parse(readFileSync(join(root, 'assets-src/gen/monster_scale.yaml'), 'utf-8')) ?? {}) as
  Record<string, ScaleValue>;
const sheets = readSheets();

describe('EF smoothing rule (standing rule 2026-11-24)', () => {
  it('every monster sheet approved on/after pass EF (or by Bedrock) has a smooth / hi-res entry', () => {
    expect(Object.keys(ruledSheets(sheets))).toContain('crazy_horse');
    expect(smoothRuleFailures(sheets, table)).toEqual([]);
  });

  it('fails on a ruled sheet without an entry, with a plain integer entry, or with neither despur nor tex', () => {
    const s = { new_beast: { 'monster_small.json': { backend: 'gemini', approved: '2026-11-25' } },
      br_beast: { 'monster_large.json': { backend: 'bedrock', approved: '2026-11-20' } },
      old_beast: { 'monster_small.json': { backend: 'gemini', approved: '2026-11-15' } } };
    expect(smoothRuleFailures(s, {})).toHaveLength(2);
    expect(smoothRuleFailures(s, { new_beast: 3, br_beast: { scale: 2, tex: 1 } })).toHaveLength(2);
    expect(smoothRuleFailures(s, { new_beast: { scale: 2, tex: 2 }, br_beast: { scale: 3, tex: 1, smooth: ['despur'] } }))
      .toEqual([]);
  });
});
