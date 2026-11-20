/**
 * Global player preferences (not part of the save data), stored in `localStorage` under `ff.settings`.
 * Read once and cached; `setMessageSpeed` and `setAirshipView` write through. Without `localStorage` (Node tests, a private context) the
 * defaults apply silently; a storage exception or an invalid stored value warns once and falls back to the default.
 */
export type MessageSpeed = 1 | 2 | 3 | 4 | 5;
/** How the airship flies on the world map: the tilted Mode 7 view or the top-down field (docs/MODE7_PLAN.md 7). */
export type AirshipView = 'mode7' | 'topdown';

export interface GameSettings {
  /** Battle text speed, 1 (slowest) to 5 (fastest). */
  messageSpeed: MessageSpeed;
  airshipView: AirshipView;
}

export const SETTINGS_KEY = 'ff.settings';
/** Speed 3 (pass F item 6): slower than the old timing, which is about speed 5. */
export const DEFAULT_MESSAGE_SPEED: MessageSpeed = 3;
/** Top-down until M7-3 brings the near detail; M7-3 turns the default to 'mode7' (D-M8). */
export const DEFAULT_AIRSHIP_VIEW: AirshipView = 'topdown';

let cache: GameSettings | null = null;

export function isMessageSpeed(n: unknown): n is MessageSpeed {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5;
}

/** The store, or null when there is none (no warning: that is a normal environment, not a failure). */
function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' || localStorage === null ? null : localStorage;
  } catch (err) {
    // some private contexts throw on the access itself
    console.warn(`Settings: localStorage is not accessible; using the defaults`, err);
    return null;
  }
}

export function isAirshipView(v: unknown): v is AirshipView {
  return v === 'mode7' || v === 'topdown';
}

function load(): GameSettings {
  const settings: GameSettings = { messageSpeed: DEFAULT_MESSAGE_SPEED, airshipView: DEFAULT_AIRSHIP_VIEW };
  const s = store();
  if (!s) return settings;
  try {
    const raw = s.getItem(SETTINGS_KEY);
    if (raw === null) return settings;
    const parsed: unknown = JSON.parse(raw);
    const rec = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    const view = rec.airshipView;
    const viewOk = view === undefined || isAirshipView(view);  // older settings have no airshipView: the default
    if (isMessageSpeed(rec.messageSpeed)) settings.messageSpeed = rec.messageSpeed;
    if (isAirshipView(view)) settings.airshipView = view;
    if (!isMessageSpeed(rec.messageSpeed) || !viewOk) console.warn(`Settings: invalid ${SETTINGS_KEY} value ${raw}; using the defaults`);
  } catch (err) {
    console.warn(`Settings: cannot read ${SETTINGS_KEY}; using the defaults`, err);
  }
  return settings;
}

/** The current settings (read from storage on the first call only). */
export function getSettings(): Readonly<GameSettings> {
  if (!cache) cache = load();
  return cache;
}

/** Change the message speed (1-5) and write it through; a write failure is logged and the new value still applies. */
export function setMessageSpeed(n: MessageSpeed): void {
  if (!isMessageSpeed(n)) {
    console.error(`Settings: message speed must be 1-5, got ${String(n)}`);
    return;
  }
  write({ ...getSettings(), messageSpeed: n });
}

/** Change the airship view and write it through (a write failure is logged; the new value still applies). */
export function setAirshipView(v: AirshipView): void {
  if (!isAirshipView(v)) {
    console.error(`Settings: airship view must be 'mode7' or 'topdown', got ${String(v)}`);
    return;
  }
  write({ ...getSettings(), airshipView: v });
}

function write(next: GameSettings): void {
  cache = next;
  const s = store();
  if (!s) return;
  try {
    s.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn(`Settings: cannot write ${SETTINGS_KEY}`, err);
  }
}

/** Tests only: forget the cached settings so the next `getSettings` reads storage again. */
export function resetSettingsCache(): void {
  cache = null;
}
