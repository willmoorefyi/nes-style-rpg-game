/** Fh test 11 (docs/BESTIARY_PLAN.md 3.5): every new bestiary source file is under 250 lines. */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const files = [
  ...readdirSync(join(root, 'src/scenes/bestiary')).map((f) => `src/scenes/bestiary/${f}`),
  'src/types/bestiaryData.ts',
  'src/core/bestiaryValidation.ts',
];

describe('bestiary file ceilings', () => {
  it('lists the seven bestiary modules', () => {
    for (const f of ['bestiaryModel.ts', 'bestiaryHabitats.ts', 'bestiaryAnim.ts', 'bestiaryLink.ts', 'BestiaryPreview.ts',
      'BestiaryStatsPanel.ts', 'BestiaryScene.ts']) expect(files).toContain(`src/scenes/bestiary/${f}`);
  });

  it.each(files)('%s is under 250 lines', (f) => {
    expect(readFileSync(join(root, f), 'utf-8').split('\n').length).toBeLessThan(250);
  });
});
