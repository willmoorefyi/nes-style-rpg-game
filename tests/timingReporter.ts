/**
 * Per-file timings and the fast-tier guard (tests/tiers.ts, AGENTS.md "Testing").
 * - Every run: a `fast` file whose collect + setup + run time is over the budget (FAST_FILE_BUDGET_S, or
 *   TEST_FILE_BUDGET_S; 0 is off) fails the run with a message naming it: move its heavy part into a file listed in
 *   tests/tiers.ts, or make it cheaper. Vitest's JSON reporter leaves out the collect time, where a file's top-level
 *   work (a whole-world search in a `describe` body) runs, so this reporter counts it.
 * - TEST_TIMINGS=<file>: writes every file's timings (seconds, slowest first) as JSON.
 */
import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { File, Reporter } from 'vitest';
import { FAST_FILE_BUDGET_S } from './tiers.js';

interface Timing {
  file: string;
  project: string;
  total: number;
  collect: number;
  setup: number;
  run: number;
}

const sec = (ms: number | undefined): number => Math.round((ms ?? 0) / 100) / 10;

export default class TimingReporter implements Reporter {
  onFinished(files: File[] = []): void {
    const rows: Timing[] = files.map((f) => {
      const collect = sec(f.collectDuration);
      const setup = sec(f.setupDuration);
      const run = sec(f.result?.duration);
      return { file: relative(process.cwd(), f.filepath), project: f.projectName, total: Math.round((collect + setup + run) * 10) / 10, collect, setup, run };
    }).sort((a, b) => b.total - a.total);
    const out = process.env.TEST_TIMINGS;
    if (out) writeFileSync(out, `${JSON.stringify(rows, null, 1)}\n`);
    const env = process.env.TEST_FILE_BUDGET_S;
    const budget = env !== undefined && env !== '' ? Number(env) : FAST_FILE_BUDGET_S;
    if (!(budget > 0)) return;
    const slow = rows.filter((r) => r.project === 'fast' && r.total > budget);
    if (!slow.length) return;
    console.error(`\nfast-tier guard: ${slow.length} fast file(s) over ${budget} s (tests/tiers.ts):`);
    for (const r of slow) console.error(`  ${r.total} s  ${r.file}  (collect ${r.collect}, setup ${r.setup}, run ${r.run})`);
    console.error('Make the file cheaper, or move its heavy part into a file listed in HEAVY_TESTS.\n');
    process.exitCode = 1;
  }
}
