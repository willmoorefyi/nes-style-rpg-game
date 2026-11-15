import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import config from '../../vite.config.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');

describe('vite.config.ts (play-test fix: agent worktrees reloaded the dev page)', () => {
  it("the dev server's watcher ignores this checkout's .claude/ (old: no watch option, so worktree writes reloaded the page)", () => {
    const ignored = config.server?.watch?.ignored;
    const list = Array.isArray(ignored) ? ignored : [ignored];
    expect(list).toContain(`${ROOT}/.claude/**`);
    // anchored to this checkout: a dev server started inside a worktree still watches its own src/
    expect(list.some((p) => typeof p === 'string' && p.startsWith('**'))).toBe(false);
  });

  it('keeps the test exclude for .claude/**', () => {
    expect(config.test?.exclude).toContain('.claude/**');
  });
});
