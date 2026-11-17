/**
 * NPC trades and item conditions (GAP-3; docs/QUEST_PLAN.md 4.2, W1-B): `requiredItem`, `takeItem`, a gift once,
 * `item:<id>` dialog and gate conditions, a cutscene behind an item, and FieldNpcActions applying a trade to the game.
 */
import { describe, it, expect } from 'vitest';
import type { KeyItemGate, MapNPC } from '../../src/types/index.js';
import { conditionMet, fieldStep, gateMessage, npcOutcome, type FieldState } from '../../src/systems/fieldRules.js';
import { createMapData } from '../helpers/testUtils.js';
import { npcHost } from '../helpers/npcActions.js';

const state = (flags: string[] = [], items: string[] = []): FieldState =>
  ({ flags: new Set(flags), items: new Set(items), mode: 'walking', vehicles: [] });

/** The Elfheim prince's waking, as a trade: the herb for a crown-sized favour. */
const trader: MapNPC = {
  id: 'apothecary', x: 1, y: 1, sprite: 'old_man',
  dialog: [
    { condition: 'GOT_KEY', text: ['The key served you well?'] },
    { condition: 'item:herb', text: ['The herb! Take this key.'] },
    { text: ['Bring me the herb from the marsh.'] },
  ],
  requiredItem: 'herb', takeItem: true, giftItem: 'mystic_key', giftFlag: 'GOT_KEY',
};

describe('npcTrade: npcOutcome', () => {
  it('without the required item the NPC only talks', () => {
    const out = npcOutcome(trader, state(), []);
    expect(out).toMatchObject({ present: true, dialog: ['Bring me the herb from the marsh.'], setFlags: [] });
    expect(out.give).toBeUndefined();
    expect(out.take).toBeUndefined();
  });

  it('with it: the item line, the gift, the flag and the take', () => {
    const out = npcOutcome(trader, state([], ['herb']), []);
    expect(out.dialog).toEqual(['The herb! Take this key.']);
    expect(out).toMatchObject({ give: 'mystic_key', setFlags: ['GOT_KEY'], take: { item: 'herb' } });
  });

  it('once the gift flag is set the trade is over', () => {
    const out = npcOutcome(trader, state(['GOT_KEY'], ['herb']), []);
    expect(out.dialog).toEqual(['The key served you well?']);
    expect(out.give).toBeUndefined();
    expect(out.take).toBeUndefined();
  });

  it('a trade without takeItem keeps the item (a show, not a swap)', () => {
    const out = npcOutcome({ ...trader, takeItem: undefined }, state([], ['herb']), []);
    expect(out.give).toBe('mystic_key');
    expect(out.take).toBeUndefined();
  });

  it('a cutscene behind a required item plays only while it is held (the Mirage console and the cube)', () => {
    const console_: MapNPC = { id: 'console', x: 0, y: 0, sprite: 'chest', dialog: ['A dead console.'], requiredItem: 'cube',
      cutscene: { id: 'mirage_ascent', onceFlag: 'SKY_FORTRESS_OPEN' } };
    expect(npcOutcome(console_, state(), []).cutscene).toBeUndefined();
    expect(npcOutcome(console_, state([], ['cube']), []).cutscene).toBe('mirage_ascent');
    expect(npcOutcome(console_, state(['SKY_FORTRESS_OPEN'], ['cube']), []).cutscene).toBeUndefined();
  });
});

describe('npcTrade: item conditions', () => {
  it('conditionMet reads item:<id> on the items and anything else on the flags', () => {
    expect(conditionMet('item:herb', state([], ['herb']))).toBe(true);
    expect(conditionMet('item:herb', state(['item:herb']))).toBe(false);
    expect(conditionMet('BRIDGE_BUILT', state(['BRIDGE_BUILT']))).toBe(true);
  });

  it('a gate message may name an item', () => {
    const gate: KeyItemGate = { x: 1, y: 0, requiredItem: 'mystic_key', flag: 'DOOR', permanent: true,
      message: [{ condition: 'item:lute', text: ['The lute hums, but this door wants a key.'] }, { text: ['Locked.'] }] };
    expect(gateMessage(gate, new Set(), new Set(['lute']))).toBe('The lute hums, but this door wants a key.');
    const map = createMapData({ keyItemGates: [gate] });
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state()).message).toBe('Locked.');
    expect(fieldStep(map, { x: 0, y: 0 }, { x: 1, y: 0 }, state([], ['lute'])).message)
      .toBe('The lute hums, but this door wants a key.');
  });
});

describe('npcTrade: FieldNpcActions applies the trade', () => {
  it('takes the herb, gives the key, sets the flag and says so; then it is over', () => {
    const h = npcHost([trader]);
    h.game.inventory.add('herb', 1);
    expect(h.actions.talk(h.entity('apothecary'))).toBe(true);
    expect(h.game.inventory.has('herb')).toBe(false);
    expect(h.game.inventory.has('mystic_key')).toBe(true);
    expect(h.game.gameFlags.has('GOT_KEY')).toBe(true);
    expect(h.lines[0][0]).toBe('The herb! Take this key.');
    expect(h.lines[0]).toHaveLength(2);
    h.actions.talk(h.entity('apothecary'));
    expect(h.lines[1]).toEqual(['The key served you well?']);
    expect(h.game.inventory.getQuantity('mystic_key')).toBe(1);
  });

  it('without the herb nothing changes hands', () => {
    const h = npcHost([trader]);
    h.actions.talk(h.entity('apothecary'));
    expect(h.lines[0]).toEqual(['Bring me the herb from the marsh.']);
    expect(h.game.gameFlags.has('GOT_KEY')).toBe(false);
  });

  it('a full bag keeps the trade for later: the herb stays, no flag', () => {
    const h = npcHost([trader]);
    h.game.inventory.add('herb', 1);
    h.game.inventory.add('mystic_key', 99);
    h.actions.talk(h.entity('apothecary'));
    expect(h.game.inventory.has('herb')).toBe(true);
    expect(h.game.gameFlags.has('GOT_KEY')).toBe(false);
  });
});
