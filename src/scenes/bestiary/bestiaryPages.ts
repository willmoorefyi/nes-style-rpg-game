/**
 * The bestiary's atlas pages (docs/ROSTER_PLAN.md 8, FW-8): the preview of an entry whose page is not loaded yet waits
 * for it (the previous preview stays until then), and the neighbours' pages are prefetched so paging through the list
 * rarely waits. CachedArt holds the shown entry's page; the page LRU (MonsterPages) keeps two more.
 */
import type { MonsterArtSource } from '../battle/AiEnemyView.js';
import { monsterSpriteKey } from '../../rendering/BattleArt.js';
import type { BestiaryEntry } from './bestiaryModel.js';

/** Sprites of the seen entries beside entry i (the prefetch). */
export function neighbourSprites(entries: readonly BestiaryEntry[], i: number): string[] {
  return [entries[i - 1], entries[i + 1]].filter((e): e is BestiaryEntry => !!e?.seen).map((e) => monsterSpriteKey(e.enemy));
}

/**
 * Run `show` now when `sprite` (null: nothing to draw) is ready, else after its page loads if `current()` still holds;
 * then prefetch `near`.
 */
export function showWhenReady(art: MonsterArtSource, sprite: string | null, near: string[], show: () => void,
  current: () => boolean): void {
  if (!sprite || !art.ensure || !art.isReady || art.isReady(sprite)) {
    show();
    if (near.length) void art.ensure?.(near);
    return;
  }
  void art.ensure([sprite, ...near]).then(() => { if (current()) show(); });
}
