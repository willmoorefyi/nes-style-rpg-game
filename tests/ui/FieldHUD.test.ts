import { describe, it, expect, vi } from 'vitest';
import { Container } from 'pixi.js';
import { FieldHUD, windowBox } from '../../src/ui/FieldHUD.js';
import { Window } from '../../src/ui/Window.js';
import { CHAR_WIDTH, GAME_WIDTH } from '../../src/core/LayoutConstants.js';
import { allTexts } from '../helpers/realData.js';
import { createMockGame } from '../helpers/testUtils.js';
import { InnScene } from '../../src/scenes/InnScene.js';
import type { Game } from '../../src/core/Game.js';
import type { ShopData } from '../../src/types/index.js';
import type { PartyManager } from '../../src/entities/PartyManager.js';

function createMockParty(members: Array<{ name: string; currentHp: number; maxHp: number }> = [], gold = 0): PartyManager {
  return {
    all: members,
    gold,
    size: members.length,
    get: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    swap: vi.fn(),
    addGold: vi.fn(),
    spendGold: vi.fn(),
    distributeXp: vi.fn(),
    maxSize: 4,
    toJSON: vi.fn(),
  } as unknown as PartyManager;
}

describe('FieldHUD', () => {
  it('creates a container', () => {
    const party = createMockParty();
    const hud = new FieldHUD(party);
    expect(hud.container).toBeInstanceOf(Container);
  });

  it('has 3 panel children (map name, gold, HP), each a Window', () => {
    const party = createMockParty();
    const hud = new FieldHUD(party);
    expect(hud.container.children.length).toBe(3);
    for (const child of hud.container.children) expect(child).toBeInstanceOf(Window);
  });

  it('updates map name', () => {
    const party = createMockParty();
    const hud = new FieldHUD(party);
    hud.setMapName('cornelia');
    // No error thrown — text is set internally
  });

  it('updates gold display', () => {
    const party = createMockParty([], 500);
    const hud = new FieldHUD(party);
    hud.setGold(500);
    // No error thrown
  });

  it('redraws the gold panel only when the gold text changes, not on every frame (T6 review)', () => {
    const party = createMockParty([], 500) as { gold: number } & PartyManager;
    const hud = new FieldHUD(party);
    const resize = vi.spyOn(hud.goldPanel, 'resize');
    for (let i = 0; i < 60; i++) hud.update(party);   // a second of frames, gold unchanged
    expect(resize).not.toHaveBeenCalled();
    party.gold = 123456;
    hud.update(party);
    hud.update(party);
    expect(resize).toHaveBeenCalledTimes(1);
    expect(allTexts(hud.goldPanel)[0].text).toBe('123456G');
    const box = hud.panelBox(hud.goldPanel);
    expect(box.x + box.width).toBe(GAME_WIDTH - 24);   // still right-aligned at the screen margin
  });

  it('updates party HP from party data', () => {
    const party = createMockParty([
      { name: 'FGHTR', currentHp: 100, maxHp: 150 },
      { name: 'W.MAG', currentHp: 30, maxHp: 60 },
    ], 200);
    const hud = new FieldHUD(party);
    hud.update(party);
    // No error thrown — HP strip is rendered
  });

  it('handles empty party', () => {
    const party = createMockParty([], 0);
    const hud = new FieldHUD(party);
    expect(() => hud.update(party)).not.toThrow();
  });

  it('container can be hidden', () => {
    const party = createMockParty();
    const hud = new FieldHUD(party);
    hud.container.visible = false;
    expect(hud.container.visible).toBe(false);
    hud.container.visible = true;
    expect(hud.container.visible).toBe(true);
  });

  describe('UI-1: panels and full names', () => {
    const fourMembers = [
      { name: 'FGHTR', currentHp: 35, maxHp: 35 },
      { name: 'FGHTR2', currentHp: 12, maxHp: 35 },
      { name: 'W.MAGE', currentHp: 28, maxHp: 28 },
      { name: 'B.MAGE', currentHp: 25, maxHp: 25 },
    ];

    it('shows a 6-character name in full (FGHTR2), one fixed column per member', () => {
      const hud = new FieldHUD(createMockParty(fourMembers));
      expect(hud.hpLines).toEqual(['FGHTR  35/35', 'FGHTR2 12/35', 'W.MAGE 28/28', 'B.MAGE 25/25']);
      const xs = allTexts(hud.hpPanel).map((t) => t.x);
      const step = xs[1] - xs[0];
      expect(step).toBeGreaterThanOrEqual('FGHTR2 999/999 '.length * CHAR_WIDTH);
      xs.forEach((x, i) => expect(x - xs[0]).toBeCloseTo(i * step));
    });

    it('the map label, gold and HP texts each sit inside a panel', () => {
      const hud = new FieldHUD(createMockParty(fourMembers, 300));
      hud.setMapName('Cornelia');
      const panels = [hud.mapPanel, hud.goldPanel, hud.hpPanel];
      for (const panel of panels) {
        expect(panel.visible).toBe(true);
        const texts = allTexts(panel).filter((t) => t.text !== '');
        expect(texts.length).toBeGreaterThan(0);
        for (const t of texts) {
          expect(t.x).toBeGreaterThan(0);
          expect(t.x + t.text.length * CHAR_WIDTH).toBeLessThanOrEqual(hud.panelBox(panel).width);
        }
      }
      expect(allTexts(hud.mapPanel)[0].text).toBe('CORNELIA');
    });

    it('99999G stays inside its panel, which stays on screen', () => {
      const hud = new FieldHUD(createMockParty([], 0));
      hud.setGold(99999);
      const t = allTexts(hud.goldPanel)[0];
      expect(t.text).toBe('99999G');
      expect(t.x).toBeGreaterThan(0);
      expect(t.x + t.text.length * CHAR_WIDTH).toBeLessThan(hud.panelBox(hud.goldPanel).width);
      { const b = hud.panelBox(hud.goldPanel); expect(b.x + b.width).toBeLessThanOrEqual(GAME_WIDTH); }
      hud.setGold(0);
      { const b = hud.panelBox(hud.goldPanel); expect(b.x + b.width).toBeLessThanOrEqual(GAME_WIDTH); }
    });

    it('the inn box (0 G) and the HUD panels do not overlap', () => {
      const hud = new FieldHUD(createMockParty(fourMembers, 0));
      hud.setMapName('Cornelia');
      const game = createMockGame();
      const inn = new InnScene(game as unknown as Game, { id: 'inn', name: 'Inn', type: 'inn', innPrice: 30 } as ShopData);
      const box = windowBox(inn.container.children[0] as Window);
      const overlap = (a: typeof box, b: typeof box) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      for (const panel of [hud.mapPanel, hud.goldPanel, hud.hpPanel]) {
        expect(overlap(hud.panelBox(panel), box)).toBe(false);
      }
    });
  });
});
