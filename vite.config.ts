/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

/** This checkout's `.claude/` (absolute, so a dev server run from inside a worktree still watches its own files). */
const CLAUDE_DIR = fileURLToPath(new URL('./.claude', import.meta.url));

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
  },
  server: {
    watch: {
      // agent worktrees (.claude/worktrees/*) change under the dev server and caused full page reloads mid-session
      ignored: [`${CLAUDE_DIR}/**`],
    },
  },
  test: {
    // per-file timings and the fast-tier guard (tests/timingReporter.ts; tiers: vitest.workspace.ts, tests/tiers.ts)
    reporters: ['default', './tests/timingReporter.ts'],
    // agent worktrees (.claude/worktrees/*) are full repo copies; their tests are not this checkout's
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
