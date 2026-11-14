import { describe, it, expect, afterEach } from 'vitest';
import { setUiEventBus, uiEventBus } from '../../src/ui/uiSounds.js';
import { EventBus } from '../../src/core/EventBus.js';

describe('uiSounds (R0-10)', () => {
  afterEach(() => setUiEventBus(undefined));

  it('is unset until a bus is registered, then returns it', () => {
    expect(uiEventBus()).toBeUndefined();
    const bus = new EventBus();
    setUiEventBus(bus);
    expect(uiEventBus()).toBe(bus);
  });
});
