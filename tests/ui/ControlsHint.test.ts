import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ControlsHint } from '../../src/ui/ControlsHint.js';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

function mockInput(action?: string) {
  return { isJustPressed: (a: string) => a === action };
}

describe('ControlsHint', () => {
  beforeEach(() => localStorageMock.clear());
  afterEach(() => localStorageMock.clear());

  it('is visible on first launch', () => {
    const hint = new ControlsHint();
    expect(hint.isDismissed).toBe(false);
    expect(hint.container.visible).toBe(true);
  });

  it('dismisses on key press', () => {
    const hint = new ControlsHint();
    hint.update(mockInput('confirm'));
    expect(hint.isDismissed).toBe(true);
    expect(hint.container.visible).toBe(false);
  });

  it('stores controlsSeen in localStorage after dismiss', () => {
    const hint = new ControlsHint();
    hint.update(mockInput('confirm'));
    expect(localStorageMock.getItem('ff1_controlsSeen')).toBe('true');
  });

  it('auto-dismisses after timer expires', () => {
    const hint = new ControlsHint();
    // Timer is 5000ms / (1000/60) = 300 frames
    for (let i = 0; i < 301; i++) hint.update(mockInput());
    expect(hint.isDismissed).toBe(true);
  });

  it('starts dismissed if already seen', () => {
    localStorageMock.setItem('ff1_controlsSeen', 'true');
    const hint = new ControlsHint();
    expect(hint.isDismissed).toBe(true);
    expect(hint.container.visible).toBe(false);
  });

  it('hasBeenSeen returns true when flag is set', () => {
    localStorageMock.setItem('ff1_controlsSeen', 'true');
    expect(ControlsHint.hasBeenSeen()).toBe(true);
  });

  it('hasBeenSeen returns false when flag is not set', () => {
    expect(ControlsHint.hasBeenSeen()).toBe(false);
  });
});
