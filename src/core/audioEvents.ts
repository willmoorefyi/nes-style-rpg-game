import type { EventBus, GameEvents } from './EventBus.js';
import type { AudioManager } from './AudioManager.js';

/**
 * The sound effect each game event plays. battleVictory has none: the battle scene plays the victory fanfare track.
 * partyHealed (a cutscene's heal, T2) reuses spell-cast (momus revision 10: no new manifest entry).
 */
export const EVENT_SFX: ReadonlyArray<readonly [keyof GameEvents, string]> = [
  ['cursorMove', 'cursor-move'],
  ['cursorSelect', 'cursor-select'],
  ['cursorCancel', 'cursor-cancel'],
  ['battleHit', 'battle-hit'],
  ['battleMiss', 'battle-miss'],
  ['spellCast', 'spell-cast'],
  ['partyHealed', 'spell-cast'],
];

/** Subscribe `audio` to the events in EVENT_SFX. */
export function wireAudioEvents(events: Pick<EventBus, 'on'>, audio: Pick<AudioManager, 'playSFX'>): void {
  for (const [event, sfx] of EVENT_SFX) {
    events.on(event, () => {
      audio.playSFX(sfx).catch((e) => console.error(`Sound ${sfx} failed:`, e));
    });
  }
}
