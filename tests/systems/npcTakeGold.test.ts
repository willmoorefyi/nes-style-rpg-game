/**
 * NPC `takeGold` (GAP-15; docs/WORLD_PLAN.md 1.5, W1-B): the caravan sells the bottle. The trade needs gold of at
 * least n and takes it, through npcOutcome's `take.gold`; a state without gold (the verifier) passes the gold term.
 */
import { describe, it, expect } from 'vitest';
import type { MapNPC } from '../../src/types/index.js';
import { npcOutcome, tradeTermsMet, type FieldState } from '../../src/systems/fieldRules.js';
import { npcHost } from '../helpers/npcActions.js';
import type { PurchaseScene } from '../../src/scenes/PurchaseScene.js';

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

describe('npcTakeGold: FieldNpcActions (P2-09: a Yes / No before the sale)', () => {
  /** Talk, close the dialog, and answer the question the trader pushes. */
  async function buy(gold: number, yes: boolean) {
    const h = npcHost([caravan], { gold });
    h.actions.talk(h.entity('caravan'));
    const before = { gold: h.game.party.gold, bottle: h.game.inventory.has('fairy_bottle') };
    expect(h.actions.runPending()).toBe(true);
    const scene = h.game.scenes.register.mock.calls[0]?.[1] as PurchaseScene | undefined;
    if (scene) {
      scene.answer(yes);
      await Promise.resolve();
      await Promise.resolve();
    }
    return { h, scene, before };
  }

  it('talking alone pays nothing: the pitch plays, then a Yes / No asks', async () => {
    const { h, scene, before } = await buy(5200, false);
    expect(before).toEqual({ gold: 5200, bottle: false });
    expect(scene?.prompt).toContain('Pay 5000 G for');
    expect(scene?.prompt).toContain('Gold: 5200 G');
    expect(h.lines[0]).toEqual(['A bottle with something inside. 5000 G.']);
  });

  it('No keeps the gold and the offer (the flag stays unset)', async () => {
    const { h } = await buy(5200, false);
    expect(h.game.party.gold).toBe(5200);
    expect(h.game.inventory.has('fairy_bottle')).toBe(false);
    expect(h.game.gameFlags.has('GOT_BOTTLE')).toBe(false);
    expect(h.lines[1]).toEqual(['Another time, then.']);
  });

  it('Yes pays, says it paid, gives the bottle and sets the flag', async () => {
    const { h } = await buy(5200, true);
    expect(h.game.party.gold).toBe(200);
    expect(h.game.inventory.has('fairy_bottle')).toBe(true);
    expect(h.game.gameFlags.has('GOT_BOTTLE')).toBe(true);
    expect(h.lines[1][0]).toBe('You paid 5000 G.');
    expect(h.lines[1][1]).toMatch(/^You received/);
  });

  it('one time only: once sold, talking asks nothing', async () => {
    const { h } = await buy(9000, true);
    h.game.scenes.register.mockClear();
    h.actions.talk(h.entity('caravan'));
    expect(h.actions.runPending()).toBe(false);
    expect(h.game.scenes.register).not.toHaveBeenCalled();
    expect(h.game.party.gold).toBe(4000);
  });

  it('too poor: no question, the gold stays and nothing is given', () => {
    const h = npcHost([caravan], { gold: 4000 });
    h.actions.talk(h.entity('caravan'));
    expect(h.actions.runPending()).toBe(false);
    expect(h.game.party.gold).toBe(4000);
    expect(h.game.inventory.has('fairy_bottle')).toBe(false);
    expect(h.lines[0]).toEqual(['A bottle with something inside. 5000 G.']);
  });
});
