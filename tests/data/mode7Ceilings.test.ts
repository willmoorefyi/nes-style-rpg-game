/**
 * Mode 7 file sizes (docs/MODE7_PLAN.md 8): every file of `src/scenes/exploration/mode7/` stays under 250 lines,
 * found as it lands.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

const DIR = 'src/scenes/exploration/mode7';
const files = readdirSync(DIR).filter((f) => f.endsWith('.ts')).map((f) => `${DIR}/${f}`);

describe('mode7 file-size ceilings', () => {
  it('finds the mode7 modules', () => {
    expect(files).toContain(`${DIR}/mode7Math.ts`);
  });

  it.each(files)('%s is under 250 lines', (path) => {
    expect(readFileSync(path, 'utf-8').split('\n').length - 1).toBeLessThan(250);
  });
});
