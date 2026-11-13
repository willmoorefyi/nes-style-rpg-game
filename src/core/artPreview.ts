/**
 * AI art preview (docs/ART_2X_PLAN.md): dev builds only, opted in with ?art=ai.
 * Normal play is unchanged until every asset on a screen is drawn at the 2x art scale.
 */
/** Dev-only `?mute=1`: no audio at all (used for automated browser tests). */
export function isMutedByUrl(search: string = typeof location === 'undefined' ? '' : location.search): boolean {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(search).get('mute') === '1';
}

export function isPreviewAi(search: string = typeof location === 'undefined' ? '' : location.search): boolean {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(search).get('art') === 'ai';
}

/**
 * 2x battle art (party, monsters, poses, staged backgrounds; docs/ART_BATTLE_PLAN.md) is the default in every build.
 * `?art=legacy` switches battles back to the original art. Field art and 96 px tiles stay behind isPreviewAi().
 */
export function useAiBattleArt(search: string = typeof location === 'undefined' ? '' : location.search): boolean {
  return new URLSearchParams(search).get('art') !== 'legacy';
}
