/**
 * `?sandbox=<level>&party=…&enemies=…` (dev only, docs/FEEDBACK_PLAN_2026-11-14.md §3.8): the title opens the battle
 * sandbox on page load, once, and the sandbox starts that fight at once. Production has no deep link
 * (`import.meta.env.DEV` is false there, so this returns false).
 */
let used = false;

/** Whether `search` carries the sandbox deep link in a dev build. */
export function hasSandboxDeepLink(search: string): boolean {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(search).has('sandbox');
}

/** Once per page load: true when the deep link is present (the title then opens the sandbox), else false. */
export function takeSandboxDeepLink(search = typeof location === 'undefined' ? '' : location.search): boolean {
  if (used) return false;
  used = true;
  return hasSandboxDeepLink(search);
}

/** Tests: forget that the deep link ran. */
export function resetSandboxDeepLink(): void {
  used = false;
}
