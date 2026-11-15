/**
 * `?bestiary=<id>` (dev only, docs/BESTIARY_PLAN.md BS-1): the title opens the bestiary on that entry once per page
 * load. Production has no deep link (`import.meta.env.DEV` is false there, so this returns null).
 */
let used = false;
let startEntry: string | null = null;

/** The `?bestiary=` id in a dev build, else null. */
export function bestiaryDeepLink(search: string): string | null {
  if (!import.meta.env.DEV) return null;
  return new URLSearchParams(search).get('bestiary') || null;
}

/** Once per page load: the deep link's id (kept as the bestiary's start entry), else null. */
export function takeBestiaryDeepLink(search = typeof location === 'undefined' ? '' : location.search): string | null {
  if (used) return null;
  used = true;
  startEntry = bestiaryDeepLink(search);
  return startEntry;
}

/** The entry the bestiary should open on (the deep link's), consumed by its next enter. */
export function takeBestiaryStartEntry(): string | null {
  const id = startEntry;
  startEntry = null;
  return id;
}

/** Tests: forget that the deep link ran. */
export function resetBestiaryDeepLink(): void {
  used = false;
  startEntry = null;
}
