/**
 * Two test tiers (tests/tiers.ts, AGENTS.md "Testing"): `fast` (everything but the heavy files) and `world` (the heavy
 * files). `vitest run` runs both; `--project fast` / `--project world` runs one.
 */
import { defineWorkspace } from 'vitest/config';
import { configDefaults } from 'vitest/config';
import { HEAVY_FILES } from './tests/tiers';

export default defineWorkspace([
  {
    extends: './vite.config.ts',
    test: {
      name: 'fast',
      exclude: [...configDefaults.exclude, '.claude/**', ...HEAVY_FILES],
    },
  },
  {
    extends: './vite.config.ts',
    test: {
      name: 'world',
      include: [...HEAVY_FILES],
    },
  },
]);
