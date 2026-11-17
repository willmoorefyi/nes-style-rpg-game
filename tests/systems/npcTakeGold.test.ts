/**
 * NPC `takeGold` (GAP-15; docs/WORLD_PLAN.md 1.5, W1-B): the caravan sells the bottle. The trade needs gold of at
 * least n and takes it, through npcOutcome's `take.gold`; a state without gold (the verifier) passes the gold term.
 */
import { describe, it, expect } from 'vitest';
import type { MapNPC } from '../../src/types/index.js';
import { npcOutcome, tradeTermsMet, type FieldState } from '../../src/systems/fieldRules.js';
import { npcHost } from '../helpers/npcActions.js';

const state = (gold?: number, flags: string[] = []): FieldState =>
  ({ flags: new Set(flags), items: new Set(), mode: 'walking', vehicles: [], gold });

const caravan: MapNPC = {
  id: 'caravan', x: 2, y: 2, sprite: 'merchant',
  dialog: [{ condition: 'GOT_BOTTLE', text: ['Safe travels!'] }, { text: ['A bottle with something inside. 5000 G.'] }],
  takeGold: 5000, giftItem: 'fairy_bottle', giftFlag: 'GOT_BOTTLE',
};

describe('npcTakeGold: npcOutcome', () => {
  it('needs at least the price', () => {
    expect(tradeTermsMet(caravan, state(4999))).toBe(false);
    expect(tradeTermsMet(caravan, state(5000))).toBe(true);
    const poor = npcOutcome(caravan, state(4999), []);
    expect(poor.give).toBeUndefined();
    expect(poor.take).toBeUndefined();
    expect(poor.setFlags).toEqual([]);
  });

  it('with the gold: the bottle, the flag and take.gold', () => {
    expect(npcOutcome(caravan, state(6000), [])).toMatchObject({
      give: 'fairy_bottle', setFlags: ['GOT_BOTTLE'], take: { gold: 5000 },
    });
  });

  it('once sold it never sells again', () => {
    const out = npcOutcome(caravan, state(9999, ['GOT_BOTTLE']), []);
    expect(out.dialog).toEqual(['Safe travels!']);
    expect(out.take).toBeUndefined();
  });

  it('a state without gold (the verifier counts gold itself) passes the gold term', () => {
    expect(npcOutcome(caravan, state(undefined), []).take).toEqual({ gold: 5000 });
  });

  it('an item and gold together', () => {
    const swap: MapNPC = { ...caravan, requiredItem: 'ruby', takeItem: true };
    expect(npcOutcome(swap, { ...state(5000), items: new Set(['ruby']) }, []).take).toEqual({ item: 'ruby', gold: 5000 });
    expect(npcOutcome(swap, state(5000), []).take).toBeUndefined();
  });
});

describe('npcTakeGold: FieldNpcActions', () => {
  it('pays and gets the bottle', () => {
    const h = npcHost([caravan], { gold: 5200 });
    h.actions.talk(h.entity('caravan'));
    expect(h.game.party.gold).toBe(200);
    expect(h.game.inventory.has('fairy_bottle')).toBe(true);
    expect(h.game.gameFlags.has('GOT_BOTTLE')).toBe(true);
  });

  it('too poor: the gold stays and nothing is given', () => {
    const h = npcHost([caravan], { gold: 4000 });
    h.actions.talk(h.entity('caravan'));
    expect(h.game.party.gold).toBe(4000);
    expect(h.game.inventory.has('fairy_bottle')).toBe(false);
    expect(h.lines[0]).toEqual(['A bottle with something inside. 5000 G.']);
  });
});
