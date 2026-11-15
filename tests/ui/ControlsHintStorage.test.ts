/** AGENTS.md "no silent catches" (pass F Fb): a failing localStorage is logged, not swallowed, and the hint still works. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ControlsHint } from '../../src/ui/ControlsHint.js';

const throwing = () => ({
  getItem: vi.fn(() => { throw new Error('denied'); }),
  setItem: vi.fn(() => { throw new Error('quota'); }),
  removeItem: vi.fn(), clear: vi.fn(),
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('ControlsHint with a failing store (old: catch { /* noop */ })', () => {
  it('an unreadable store warns and shows the hint', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('localStorage', throwing());
    expect(ControlsHint.hasBeenSeen()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('an unwritable store warns on dismiss and the hint still closes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('localStorage', throwing());
    const hint = new ControlsHint();
    warn.mockClear();
    hint.update({ isJustPressed: (a: string) => a === 'confirm' });
    expect(hint.isDismissed).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
