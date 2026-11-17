/**
 * The pass W cutscene steps (docs/QUEST_PLAN.md 4.1-4.2, W1-B): end_game (GAP-13: the card, confirm, the title, no
 * save; nothing after it plays), give_item / take_item on the bag, set_vehicle through the host, and the registry's
 * checks of their fields.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CutsceneManager, END_GAME_TEXT, cutsceneVehicle, type CutsceneDeps } from '../../src/systems/CutsceneManager.js';
import { CutsceneRegistry, scriptProblem } from '../../src/systems/CutsceneRegistry.js';
import { playFieldCutscene } from '../../src/scenes/exploration/ExplorationCutscenes.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { Inventory } from '../../src/entities/Inventory.js';

function deps(extra: Partial<CutsceneDeps> = {}) {
  const shown: string[] = [];
  const d: CutsceneDeps = {
    showDialog: vi.fn(async (t: string) => { shown.push(t); }),
    flags: new GameFlags(),
    party: [],
    ...extra,
  };
  return { d, shown };
}

describe('end_game', () => {
  it('shows its text, then leaves for the title; the steps after it never play', async () => {
    const endGame = vi.fn();
    const { d, shown } = deps({ endGame });
    await new CutsceneManager(d).play([
      { type: 'set_flag', flag: 'CHAOS_DEFEATED' },
      { type: 'end_game', text: 'The light returns.' },
      { type: 'set_flag', flag: 'AFTER' },
    ]);
    expect(shown).toEqual(['The light returns.']);
    expect(endGame).toHaveBeenCalledTimes(1);
    expect(d.flags.has('CHAOS_DEFEATED')).toBe(true);
    expect(d.flags.has('AFTER')).toBe(false);
  });

  it('shows "The End" without text; the title comes only after the card was confirmed', async () => {
    let confirm: () => void = () => {};
    const order: string[] = [];
    const { d } = deps({
      showDialog: vi.fn((t: string) => new Promise<void>((r) => { order.push(`card:${t}`); confirm = r; })),
      endGame: vi.fn(() => { order.push('title'); }),
    });
    const done = new CutsceneManager(d).play([{ type: 'end_game' }]);
    await Promise.resolve();
    expect(order).toEqual([`card:${END_GAME_TEXT}`]);
    confirm();
    await done;
    expect(order).toEqual([`card:${END_GAME_TEXT}`, 'title']);
  });

  it('a host without endGame logs and the card still shows', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { d, shown } = deps();
    await new CutsceneManager(d).play([{ type: 'end_game' }]);
    expect(shown).toEqual(['The End']);
    expect(err).toHaveBeenCalledWith(expect.stringContaining('end_game'));
    err.mockRestore();
  });

  it('in the field, end_game switches to the title (the field host wires it)', async () => {
    CutsceneRegistry.clear();
    CutsceneRegistry.register('ending', [{ type: 'end_game', text: 'Fin' }]);
    const endGame = vi.fn();
    const dialog = { enqueue: vi.fn((_l: string[], done: () => void) => done()), holdOffConfirm: vi.fn() };
    await playFieldCutscene('ending', { dialog: dialog as never, fadeOut: vi.fn(), fadeIn: vi.fn(), flags: new GameFlags(),
      party: [], endGame });
    expect(dialog.enqueue).toHaveBeenCalledWith(['Fin'], expect.any(Function), { holdOff: false });
    expect(endGame).toHaveBeenCalledTimes(1);
  });
});

describe('give_item / take_item', () => {
  let inventory: Inventory;
  beforeEach(() => { inventory = new Inventory(); });

  it('give_item adds one; take_item removes one', async () => {
    const { d } = deps({ inventory });
    await new CutsceneManager(d).play([{ type: 'give_item', item: 'crown' }, { type: 'give_item', item: 'crown' },
      { type: 'take_item', item: 'crown' }]);
    expect(inventory.getQuantity('crown')).toBe(1);
  });

  it('a full bag says so and keeps nothing; taking what is not held logs', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    inventory.add('potion', 99);
    const { d, shown } = deps({ inventory });
    await new CutsceneManager(d).play([{ type: 'give_item', item: 'potion' }, { type: 'take_item', item: 'tnt' }]);
    expect(inventory.getQuantity('potion')).toBe(99);
    expect(shown).toHaveLength(1);
    expect(err).toHaveBeenCalledWith(expect.stringContaining('tnt'));
    err.mockRestore();
  });

  it('a host without an inventory logs and goes on', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { d } = deps();
    await new CutsceneManager(d).play([{ type: 'give_item', item: 'crown' }, { type: 'set_flag', flag: 'NEXT' }]);
    expect(d.flags.has('NEXT')).toBe(true);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('set_vehicle', () => {
  it('hands the vehicle to the host', async () => {
    const setVehicle = vi.fn();
    const { d } = deps({ setVehicle });
    await new CutsceneManager(d).play([{ type: 'set_vehicle', vehicle: 'airship', map: 'overworld', x: 170, y: 120 }]);
    expect(setVehicle).toHaveBeenCalledWith({ type: 'airship', map: 'overworld', x: 170, y: 120 });
  });

  it('cutsceneVehicle needs a known vehicle, a map and both coordinates', () => {
    expect(cutsceneVehicle({ type: 'set_vehicle', vehicle: 'ship', map: 'overworld', x: 1 })).toBeNull();
    expect(cutsceneVehicle({ type: 'set_vehicle', vehicle: 'balloon' as never, map: 'overworld', x: 1, y: 2 })).toBeNull();
  });
});

describe('the registry checks the new steps', () => {
  it.each([
    [[{ type: 'give_item' }], /give_item without an item/],
    [[{ type: 'take_item', item: '' }], /take_item without an item/],
    [[{ type: 'set_vehicle', vehicle: 'ship' }], /set_vehicle without/],
    [[{ type: 'end_game', text: 3 }], /end_game whose text/],
  ])('%j is dropped', (steps, why) => {
    expect(scriptProblem(steps as never)).toMatch(why);
  });

  it('well-formed steps pass', () => {
    expect(scriptProblem([{ type: 'give_item', item: 'crown' }, { type: 'take_item', item: 'crown' },
      { type: 'set_vehicle', vehicle: 'canoe', map: 'overworld', x: 1, y: 2 }, { type: 'end_game' }])).toBeNull();
  });
});
