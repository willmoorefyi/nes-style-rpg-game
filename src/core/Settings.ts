/**
 * Global player preferences (not part of the save data), stored in `localStorage` under `ff.settings`.
 * Read once and cached; `setMessageSpeed` writes through. Without `localStorage` (Node tests, a private context) the
 * defaults apply silently; a storage exception or an invalid stored value warns once and falls back to the default.
 */
export type MessageSpeed = 1 | 2 | 3 | 4 | 5;

export interface GameSettings {
  /** Battle text speed, 1 (slowest) to 5 (fastest). */
  messageSpeed: MessageSpeed;
}

export const SETTINGS_KEY = 'ff.settings';
/** F0 keeps today's timing (5); pass F's Fb moves the default to 3. */
export const DEFAULT_MESSAGE_SPEED: MessageSpeed = 5;

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

function load(): GameSettings {
  const settings: GameSettings = { messageSpeed: DEFAULT_MESSAGE_SPEED };
  const s = store();
  if (!s) return settings;
  try {
    const raw = s.getItem(SETTINGS_KEY);
    if (raw === null) return settings;
    const parsed: unknown = JSON.parse(raw);
    const speed = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>).messageSpeed : undefined;
    if (isMessageSpeed(speed)) settings.messageSpeed = speed;
    else console.warn(`Settings: invalid ${SETTINGS_KEY} value ${raw}; using the defaults`);
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
  const next: GameSettings = { ...getSettings(), messageSpeed: n };
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
