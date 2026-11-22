/**
 * Pass W file-size ceilings (docs/QUEST_PLAN.md 4.1, docs/WORLD_PLAN.md 5.1): every file of the verifier, the field
 * rules, the quest types and the world layouts stays under 250 lines (AGENTS.md "File Size Guidelines"). Files are
 * found at test time, so the files later tranches add are covered as they land.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const lines = (path: string): number => readFileSync(path, 'utf-8').split('\n').length - 1;

function walk(dir: string, keep: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__pycache__' ? [] : walk(path, keep);
    return keep(name) ? [path] : [];
  });
}

const LAYOUTS = 'assets-src/tools/layouts';
/** The region layout directories (WORLD 4.1-4.8). */
const REGION_DIRS = ['a1', 'elf', 'earth', 'fire', 'ordeal', 'water', 'wind', 'past'];

/** Files over 250 lines that AGENTS.md allows (none in this set yet); path -> ceiling. */
const EXCEPTIONS: Record<string, number> = {};

const FILES = [
  ...walk('src/progression', (n) => n.endsWith('.ts')),
  'src/types/quest.ts',
  'src/systems/fieldRules.ts',
  'src/systems/fieldRulesVehicles.ts',
  'src/core/schemaValidationQuest.ts',
  'src/scenes/exploration/FieldVehicles.ts',
  'src/scenes/exploration/FieldNpcActions.ts',
  ...walk(LAYOUTS, (n) => /^world.*\.py$/.test(n)).filter((p) => !REGION_DIRS.some((d) => p.includes(`/${d}/`))),
  ...REGION_DIRS.flatMap((d) => walk(join(LAYOUTS, d), (n) => n.endsWith('.py'))),
  // pass NW (docs/NATURAL_WORLD_PLAN.md 3.2): the generator and the continent specs
  ...walk('assets-src/tools/worldgen', (n) => n.endsWith('.py')),
  ...walk(join(LAYOUTS, 'world_specs'), (n) => n.endsWith('.py')),
  // WR (docs/WORLD_WRAP_PLAN.md 6.2): the compile check of the wrapped world's seam
  'assets-src/tools/map_checks_wrap.py', 'assets-src/tools/layouts/sea_tables.py',   // + F-WR's shared sea tables
];

describe('pass W file-size ceilings', () => {
  it('finds the contract files', () => {
    expect(FILES).toContain('src/progression/questTypes.ts');
    expect(FILES).toContain('src/systems/fieldRules.ts');
    expect(FILES).toContain('assets-src/tools/worldgen/spec.py');
    expect(FILES).toContain(`${LAYOUTS}/world_api.py`);
  });

  it.each(FILES)('%s is under 250 lines', (path) => {
    const max = EXCEPTIONS[path];
    if (max !== undefined) expect(lines(path)).toBeLessThanOrEqual(max);
    else expect(lines(path)).toBeLessThan(250);
  });
});
