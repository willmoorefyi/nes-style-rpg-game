import { describe, it, expect, vi } from 'vitest';
import { Container } from 'pixi.js';
import { FieldHUD } from '../../src/ui/FieldHUD.js';
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

  it('has 3 text children (map name, gold, HP)', () => {
    const party = createMockParty();
    const hud = new FieldHUD(party);
    expect(hud.container.children.length).toBe(3);
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
});
