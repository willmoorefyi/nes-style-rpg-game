/**
 * Art mode (docs/ART_2X_PLAN.md, docs/ART_TILES_PLAN.md): 2x art everywhere by default; `?art=legacy` (dev) for the
 * old 1x field art.
 */
/** Dev-only `?mute=1`: no audio at all (used for automated browser tests). */
export function isMutedByUrl(search: string = typeof location === 'undefined' ? '' : location.search): boolean {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(search).get('mute') === '1';
}

/** 2x art (96 px tiles, compiled maps, 2x field sprites) is the default since act 1 was completed (docs/ACT1_LOG.md).
 *  Dev builds can still open the old field art with `?art=legacy`. */
export function isPreviewAi(search: string = typeof location === 'undefined' ? '' : location.search,
  defaultOn: boolean = import.meta.env.MODE !== 'test'): boolean {
  if (!import.meta.env.DEV) return true;
  const art = new URLSearchParams(search).get('art');
  if (art === 'legacy') return false;
  if (art === 'ai') return true;
  return defaultOn;          // unit tests keep the legacy 48 px layout unless they opt in with ?art=ai
}

