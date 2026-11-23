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
    why: 'the real-world mutation suite (`npm run quest -- --mutate`), plain and --strict, through the mutation cache '
      + '(docs/TEST_SPEED_PLAN.md 4): a cache hit takes about 3 min (the live audit), a miss runs the parallel suite live '
      + '(about 13 min at 6 workers, 20 at the 4 workers of vitest)',
  },
  {
    file: 'tests/progression/questGraph.test.ts',
    why: 'the real world\'s proofs (a)-(c) at collect time: 35 s on pass W\'s 192x192 world (311,272 states), 170 s on '
      + 'the 256x256 NW world (1,291,102 states; NW-5), over the fast budget',
  },
];

export const HEAVY_FILES: readonly string[] = HEAVY_TESTS.map((t) => t.file);

/**
 * The slowest a fast-tier file may be, in seconds of collect + setup + run. Measured at TST under 2 workers: the
 * slowest fast file is questGraph.test.ts at 35 s (the real world's proofs (a)-(c)), the next questLate.test.ts at
 * 10 s. Override with TEST_FILE_BUDGET_S (0 turns the guard off, e.g. on a heavily loaded host).
 */
export const FAST_FILE_BUDGET_S = 90;
