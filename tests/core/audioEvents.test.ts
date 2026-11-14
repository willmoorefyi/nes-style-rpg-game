import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';
import { wireAudioEvents } from '../../src/core/audioEvents.js';

describe('I3 / T2: wireAudioEvents', () => {
  const cases: Array<[Parameters<EventBus['emit']>[0], string]> = [
    ['cursorMove', 'cursor-move'],
    ['cursorSelect', 'cursor-select'],
    ['cursorCancel', 'cursor-cancel'],
    ['battleHit', 'battle-hit'],
    ['battleMiss', 'battle-miss'],
    ['spellCast', 'spell-cast'],
    ['partyHealed', 'spell-cast'],
  ];

  it.each(cases)('%s plays %s', (event, sfx) => {
    const events = new EventBus();
    const audio = { playSFX: vi.fn().mockResolvedValue(undefined) };
    wireAudioEvents(events, audio);
    events.emit(event, {} as never);
    expect(audio.playSFX).toHaveBeenCalledTimes(1);
    expect(audio.playSFX).toHaveBeenCalledWith(sfx);
  });

  it('battleVictory plays no sound effect (the battle plays the fanfare track)', () => {
    const events = new EventBus();
    const audio = { playSFX: vi.fn().mockResolvedValue(undefined) };
    wireAudioEvents(events, audio);
    events.emit('battleVictory', {});
    expect(audio.playSFX).not.toHaveBeenCalled();
  });

  it('a failing sound is logged, not thrown', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const events = new EventBus();
    const audio = { playSFX: vi.fn().mockRejectedValue(new Error('no file')) };
    wireAudioEvents(events, audio);
    events.emit('cursorMove', {});
    await new Promise((r) => setTimeout(r, 0));
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
