/**
 * What a set of statuses looks like (docs/FEEDBACK_PLAN_2026-11-14.md §3.5), from assets/data/status-visuals.yaml:
 * the posture, the icons (in the file's order, which is the priority), the panel / target-line tags and the multiplied
 * status tint. Pure (no PixiJS).
 */
import type { StatusPosture, StatusVisual } from '../../../types/fxData.js';
import { multiplyTint } from '../actorTint.js';

export type StatusVisuals = Readonly<Record<string, StatusVisual>>;

/** At most this many icons per actor. */
export const MAX_ICONS = 3;

/** Posture strength: the strongest posture among the statuses wins (a sleeping, feared enemy is dazed). */
const POSTURE_RANK: Record<StatusPosture, number> = { stone: 4, daze: 3, still: 2, tremble: 1, none: 0 };

/** The statuses in priority order (the order of status-visuals.yaml); unknown ones last, in their own order. */
export function byPriority(statuses: readonly string[], visuals: StatusVisuals): string[] {
  const order = Object.keys(visuals);
  const rank = (s: string): number => { const i = order.indexOf(s); return i < 0 ? order.length : i; };
  return [...statuses].sort((a, b) => rank(a) - rank(b));
}

/** The pose a set of statuses gives (enemies: daze frames, grey stone, tremble; party: see BattleDisplayManager). */
export function postureOf(statuses: readonly string[], visuals: StatusVisuals): StatusPosture {
  let best: StatusPosture = 'none';
  for (const s of statuses) {
    const p = visuals[s]?.posture ?? 'none';
    if (POSTURE_RANK[p] > POSTURE_RANK[best]) best = p;
  }
  return best;
}

/** The icon glyphs to show, highest priority first, at most MAX_ICONS. */
export function iconsFor(statuses: readonly string[], visuals: StatusVisuals, max = MAX_ICONS): string[] {
  return byPriority(statuses, visuals).flatMap((s) => (visuals[s]?.icon ? [visuals[s].icon as string] : [])).slice(0, max);
}

/** Short tags in priority order (`SLP PSN`); a status without a `tag` shows its name in capitals. */
export function tagsFor(statuses: readonly string[], visuals: StatusVisuals): string[] {
  return byPriority(statuses, visuals).filter((s) => s !== 'death').map((s) => visuals[s]?.tag ?? s.toUpperCase());
}

/** The product of the statuses' tints at `clock` (a pulsing tint is on for `on` frames of each `period`), or null
 *  when none is showing (the actorTint `status` source is then cleared). */
export function statusTint(statuses: readonly string[], visuals: StatusVisuals, clock: number): number | null {
  let tint: number | null = null;
  for (const s of statuses) {
    const v = visuals[s];
    if (v?.tint === undefined) continue;
    if (v.pulse && Math.floor(clock) % v.pulse[1] >= v.pulse[0]) continue;
    tint = multiplyTint(tint ?? 0xffffff, v.tint);
  }
  return tint;
}

/** Statuses with a visual on this side (`party: false` entries show on enemies only). */
export function shownOn(side: 'party' | 'enemy', statuses: readonly string[], visuals: StatusVisuals): string[] {
  return statuses.filter((s) => side === 'enemy' || visuals[s]?.party !== false);
}
