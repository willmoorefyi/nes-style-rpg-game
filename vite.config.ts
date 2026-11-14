/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
  },
  test: {
    // agent worktrees (.claude/worktrees/*) are full repo copies; their tests are not this checkout's
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
