/**
 * The clinic (GAP-16; docs/WORLD_PLAN.md 1.5, W1-B): `action: clinic`, `clinicPrice: n` revives each fallen member to
 * 1 HP for n x level gold, after a confirm, through FieldNpcActions and ClinicScene.
 */
import { describe, it, expect, vi } from 'vitest';
import type { MapNPC } from '../../src/types/index.js';
import { clinicPrompt, clinicQuote, clinicRevive } from '../../src/systems/clinic.js';
import { ClinicScene } from '../../src/scenes/ClinicScene.js';
import { CLINIC_SCENE } from '../../src/scenes/exploration/FieldNpcActions.js';
import type { Game } from '../../src/core/Game.js';
import { member, npcHost } from '../helpers/npcActions.js';

const healer: MapNPC = { id: 'healer', x: 1, y: 1, sprite: 'white_mage', dialog: ['Shall I tend your fallen?'],
  action: 'clinic', clinicPrice: 20 };

describe('clinic: the quote and the revive', () => {
  it('charges price x level for each fallen member', () => {
    const party = [member('A', 5), member('B', 7, 0), member('C', 3, 0)];
    const quote = clinicQuote(party, 20);
    expect(quote.fallen.map((c) => c.name)).toEqual(['B', 'C']);
    expect(quote.cost).toBe(20 * 7 + 20 * 3);
    expect(clinicPrompt(quote)).toBe('Revive B, C for 200 G?');
  });

  it('revives every fallen member to 1 HP and takes the gold, all or nothing', () => {
    const all = [member('A', 5), member('B', 7, 0)];
    let gold = 140;
    const party = { all, spendGold: (n: number) => (gold >= n ? ((gold -= n), true) : false) };
    all[1].statusTracker.apply('death');
    const done = clinicRevive(party, 20);
    expect(done).toEqual({ revived: true, lines: ['B is revived!'] });
    expect(all[1].currentHp).toBe(1);
    expect(all[1].statusTracker.has('death')).toBe(false);
    expect(gold).toBe(0);
  });

  it('too little gold, or nobody fallen: nothing changes', () => {
    const all = [member('A', 5, 0)];
    const party = { all, spendGold: vi.fn().mockReturnValue(false) };
    expect(clinicRevive(party, 20).revived).toBe(false);
    expect(all[0].currentHp).toBe(0);
    expect(clinicRevive({ all: [member('A', 5)], spendGold: vi.fn() }, 20).lines).toEqual(['Nobody here needs reviving.']);
  });
});

describe('clinic: in the field', () => {
  it('after the healer\'s line, the Yes / No opens over the town', () => {
    const h = npcHost([healer], { gold: 500, party: [member('A', 4), member('B', 6, 0)] });
    h.actions.talk(h.entity('healer'));
    expect(h.lines[0]).toEqual(['Shall I tend your fallen?']);
    expect(h.actions.runPending()).toBe(true);
    expect(h.game.scenes.register).toHaveBeenCalledWith(CLINIC_SCENE, expect.any(ClinicScene));
    expect(h.game.scenes.push).toHaveBeenCalledWith(CLINIC_SCENE);
    const scene = h.game.scenes.register.mock.calls[0][1] as ClinicScene;
    expect(scene.transparent).toBe(true);
    expect(scene.prompt).toContain('Revive B for 120 G?');
  });

  it('Yes revives and the field shows the result; No keeps the gold', async () => {
    const h = npcHost([healer], { gold: 500, party: [member('A', 4), member('B', 6, 0)] });
    const shown: string[][] = [];
    const yes = new ClinicScene(h.game as unknown as Game, 20, (l) => shown.push(l));
    yes.answer(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(h.game.party.gold).toBe(380);
    expect(h.game.party.all[1].currentHp).toBe(1);
    expect(h.game.scenes.pop).toHaveBeenCalled();
    expect(shown).toEqual([['B is revived!']]);

    h.game.party.all[1].currentHp = 0;
    const no = new ClinicScene(h.game as unknown as Game, 20, (l) => shown.push(l));
    no.answer(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(h.game.party.gold).toBe(380);
    expect(h.game.party.all[1].currentHp).toBe(0);
  });

  it('with nobody fallen the healer just says so (no question)', () => {
    const h = npcHost([healer], { gold: 500, party: [member('A', 4)] });
    h.actions.talk(h.entity('healer'));
    h.actions.runPending();
    expect(h.game.scenes.push).not.toHaveBeenCalled();
    expect(h.lines[1]).toEqual(['Nobody here needs reviving.']);
  });
});
