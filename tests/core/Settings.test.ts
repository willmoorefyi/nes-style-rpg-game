/** F0 (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 2): global settings in localStorage `ff.settings`, read once. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_AIRSHIP_VIEW, DEFAULT_MESSAGE_SPEED, SETTINGS_KEY, getSettings, resetSettingsCache, setAirshipView, setMessageSpeed, type AirshipView, type MessageSpeed } from '../../src/core/Settings.js';

function fakeStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: vi.fn((k: string) => data[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { data[k] = v; }),
    removeItem: vi.fn((k: string) => { delete data[k]; }),
    clear: vi.fn(),
  };
}

beforeEach(() => { resetSettingsCache(); });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetSettingsCache();
});

describe('Settings', () => {
  it('defaults to message speed 3 (Fb: slower than the old timing, about speed 5; old default 5)', () => {
    expect(DEFAULT_MESSAGE_SPEED).toBe(3);
    vi.stubGlobal('localStorage', fakeStore());
    expect(getSettings().messageSpeed).toBe(3);
  });

  it('without localStorage it uses the default and warns nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('localStorage', undefined);
    expect(getSettings().messageSpeed).toBe(DEFAULT_MESSAGE_SPEED);
    setMessageSpeed(2);
    expect(getSettings().messageSpeed).toBe(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a throwing store warns once and falls back to the default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = fakeStore();
    store.getItem.mockImplementation(() => { throw new Error('denied'); });
    vi.stubGlobal('localStorage', store);
    expect(getSettings().messageSpeed).toBe(DEFAULT_MESSAGE_SPEED);
    expect(getSettings().messageSpeed).toBe(DEFAULT_MESSAGE_SPEED);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('an invalid stored value warns once and falls back to the default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const raw of ['{"messageSpeed":9}', 'not json', '"3"']) {
      resetSettingsCache();
      warn.mockClear();
      vi.stubGlobal('localStorage', fakeStore({ [SETTINGS_KEY]: raw }));
      expect(getSettings().messageSpeed, raw).toBe(3);
      getSettings();
      expect(warn, raw).toHaveBeenCalledTimes(1);
    }
  });

  it('is read once: a second getSettings does not touch storage', () => {
    const store = fakeStore({ [SETTINGS_KEY]: '{"messageSpeed":2}' });
    vi.stubGlobal('localStorage', store);
    expect(getSettings().messageSpeed).toBe(2);
    expect(getSettings().messageSpeed).toBe(2);
    expect(store.getItem).toHaveBeenCalledTimes(1);
  });

  it('round trip: setMessageSpeed writes through and a fresh read gets it back', () => {
    const store = fakeStore();
    vi.stubGlobal('localStorage', store);
    setMessageSpeed(4);
    expect(getSettings().messageSpeed).toBe(4);
    expect(JSON.parse(store.data[SETTINGS_KEY])).toMatchObject({ messageSpeed: 4 });
    resetSettingsCache();
    expect(getSettings().messageSpeed).toBe(4);
  });

  it('a failed write is logged and the new speed still applies; an out-of-range speed is refused', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = fakeStore();
    store.setItem.mockImplementation(() => { throw new Error('quota'); });
    vi.stubGlobal('localStorage', store);
    setMessageSpeed(1);
    expect(getSettings().messageSpeed).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    setMessageSpeed(Number('7') as MessageSpeed);
    expect(getSettings().messageSpeed).toBe(1);
    expect(error).toHaveBeenCalledTimes(1);
  });

  // M7-2 (docs/MODE7_PLAN.md 7, 9): the airship view; M7-3 turned the default to 'mode7' (D-M8)
  it("airshipView defaults to 'mode7' since M7-3", () => {
    expect(DEFAULT_AIRSHIP_VIEW).toBe('mode7');
    vi.stubGlobal('localStorage', fakeStore());
    expect(getSettings().airshipView).toBe('mode7');
  });

  it('airshipView: older settings without it take the default silently; round trip', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = fakeStore({ [SETTINGS_KEY]: '{"messageSpeed":2}' });
    vi.stubGlobal('localStorage', store);
    expect(getSettings()).toEqual({ messageSpeed: 2, airshipView: DEFAULT_AIRSHIP_VIEW });
    expect(warn).not.toHaveBeenCalled();
    setAirshipView('mode7');
    expect(JSON.parse(store.data[SETTINGS_KEY])).toEqual({ messageSpeed: 2, airshipView: 'mode7' });
    resetSettingsCache();
    expect(getSettings().airshipView).toBe('mode7');
    setAirshipView('topdown');
    resetSettingsCache();
    expect(getSettings().airshipView).toBe('topdown');
  });

  it('airshipView: an invalid stored value warns once and takes the default; an invalid set is refused', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('localStorage', fakeStore({ [SETTINGS_KEY]: '{"messageSpeed":4,"airshipView":"sideways"}' }));
    expect(getSettings()).toEqual({ messageSpeed: 4, airshipView: DEFAULT_AIRSHIP_VIEW });
    expect(warn).toHaveBeenCalledTimes(1);
    setAirshipView('sideways' as AirshipView);
    expect(getSettings().airshipView).toBe(DEFAULT_AIRSHIP_VIEW);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
