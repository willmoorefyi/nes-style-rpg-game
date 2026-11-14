import type { EventBus } from '../core/EventBus.js';

/**
 * The event bus UI widgets fall back to for cursor sounds when their config has none (I3). Unset (silent) until
 * `Game.init` calls `setUiEventBus`, so unit tests stay quiet. Nothing calls it yet (R0); R1 wires `Menu` and
 * `Game.init`, R3 wires `NameEntryGrid`.
 */
let bus: EventBus | undefined;

export function setUiEventBus(next: EventBus | undefined): void {
  bus = next;
}

export function uiEventBus(): EventBus | undefined {
  return bus;
}
