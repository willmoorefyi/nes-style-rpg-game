/**
 * Per-file timings and the fast-tier guard (tests/tiers.ts, AGENTS.md "Testing").
 * - Every run: a `fast` file whose collect + setup + run time is over the budget (FAST_FILE_BUDGET_S, or
 *   TEST_FILE_BUDGET_S; 0 is off) fails the run with a message naming it: move its heavy part into a file listed in
 *   tests/tiers.ts, or make it cheaper. Vitest's JSON reporter leaves out the collect time, where a file's top-level
 *   work (a whole-world search in a `describe` body) runs, so this reporter counts it.
 * - TEST_TIMINGS=<file>: writes every file's timings (seconds, slowest first) as JSON, with the tasks' `meta`.
 * - R14 (docs/TEST_SPEED_PLAN.md 7.2): a run that included questMutateWorld.test.ts prints one line from its task
 *   meta, `questMutateWorld: cache hit <fp12> (audit <s> s)` or `questMutateWorld: cache MISS <fp12> (live run <s> s on
 *   <n> workers)`. A miss is never a failure (there is no world-tier budget), only visible.
 */
import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { File, Reporter, Task } from 'vitest';
import { FAST_FILE_BUDGET_S } from './tiers.js';

interface Timing {
  file: string;
  project: string;
  total: number;
  collect: number;
  setup: number;
  run: number;
  meta?: Record<string, unknown>;
}

interface CacheMeta {
  source: 'hit' | 'miss' | 'off';
  fp12: string;
  wallS: number;
  jobs: number;
}

/** The tasks' meta of a file, merged (vitest carries `task.meta` from the workers to the reporter). */
function metaOf(t: Task): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(t.meta ?? {}) };
  for (const c of 'tasks' in t ? t.tasks : []) Object.assign(out, metaOf(c));
  return out;
}

const sec = (ms: number | undefined): number => Math.round((ms ?? 0) / 100) / 10;

export default class TimingReporter implements Reporter {
  onFinished(files: File[] = []): void {
    const rows: Timing[] = files.map((f) => {
      const collect = sec(f.collectDuration);
      const setup = sec(f.setupDuration);
      const run = sec(f.result?.duration);
      const meta = metaOf(f);
      return { file: relative(process.cwd(), f.filepath), project: f.projectName, total: Math.round((collect + setup + run) * 10) / 10,
        collect, setup, run, ...(Object.keys(meta).length ? { meta } : {}) };
    }).sort((a, b) => b.total - a.total);
    const world = rows.find((r) => r.file.endsWith('questMutateWorld.test.ts'));
    const m = world?.meta?.questMutateCache as CacheMeta | undefined;
    if (world) {
      console.log(!m ? `questMutateWorld: no cache record (the file failed before its first test, ${world.total} s)`
        : m.source === 'hit' ? `questMutateWorld: cache hit ${m.fp12} (audit ${m.wallS} s)`
          : `questMutateWorld: cache MISS ${m.fp12 || '(off)'} (live run ${m.wallS} s on ${m.jobs} workers)`);
    }
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
