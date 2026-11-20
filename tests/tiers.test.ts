/**
 * The tier list (tests/tiers.ts): every heavy file exists and is a test file, so a renamed heavy file cannot fall
 * silently out of the `world` project (the `fast` project's guard, tests/timingReporter.ts, would then fail on it).
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FAST_FILE_BUDGET_S, HEAVY_TESTS } from './tiers.js';

describe('test tiers', () => {
  it.each(HEAVY_TESTS.map((t) => [t.file, t.why]))('%s exists and says why it is heavy', (file, why) => {
    expect(existsSync(file)).toBe(true);
    expect(file).toMatch(/^tests\/.+\.test\.ts$/);
    expect(why.length).toBeGreaterThan(20);
  });

  it('the fast-file budget is positive', () => {
    expect(FAST_FILE_BUDGET_S).toBeGreaterThan(0);
  });
});
