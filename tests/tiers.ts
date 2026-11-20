/**
 * The test tiers (AGENTS.md "Testing"; pass TST). `vitest.workspace.ts` builds two projects from this list:
 * - `fast`: every test file except the heavy ones (`npm run test:fast`, what an agent runs before a handoff);
 * - `world`: the heavy files only (`npm run test:world`); `npm run test:full` (and `npm test`) runs both.
 * A heavy file must be listed here by path. Anything not listed is fast, and the timing reporter
 * (tests/timingReporter.ts) fails a run in which a fast file takes longer than FAST_FILE_BUDGET_S.
 */

/** Repository-relative paths of the heavy test files, each with the reason it is heavy. */
export const HEAVY_TESTS: ReadonlyArray<{ file: string; why: string }> = [
  {
    file: 'tests/progression/questMutateWorld.test.ts',
    why: 'the real-world no-skip mutation suite (`npm run quest -- --mutate`), plain and --strict: every gate-table '
      + 'and generic element re-runs the proofs on the 192x192 world (about half an hour on one worker)',
  },
];

export const HEAVY_FILES: readonly string[] = HEAVY_TESTS.map((t) => t.file);

/**
 * The slowest a fast-tier file may be, in seconds of collect + setup + run. Measured at TST under 2 workers: the
 * slowest fast file is questGraph.test.ts at 35 s (the real world's proofs (a)-(c)), the next questLate.test.ts at
 * 10 s. Override with TEST_FILE_BUDGET_S (0 turns the guard off, e.g. on a heavily loaded host).
 */
export const FAST_FILE_BUDGET_S = 90;
