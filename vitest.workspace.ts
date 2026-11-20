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
      // NW-5: the 256x256 world's state graphs need more than the default 4 GB heap: child processes (forks) take the
      // 8 GB of the scripts' NODE_OPTIONS (package.json `test`, `test:full`, `test:world`), as `npm run quest` does
      pool: 'forks',
    },
  },
]);
