import { describe, it, expect, beforeAll } from 'vitest';
import { PartyPanel, partyRowData, FALLEN_GREY } from '../../src/ui/PartyPanel.js';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { MAX_LEVEL, xpToReach } from '../../src/entities/ExperienceTable.js';
import { allTexts, loadRealRegistries } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

const make = (name: string, cls: string, level = 1) =>
  new Character({ name, classData: ClassRegistry.getClass(cls)!, level, xp: xpToReach(level) });

describe('MS-7: party row data', () => {
  it('a fighter: full 6-char name, class, Lv, HP, Next, no charges', () => {
    const war = make('FGHTR2', 'warrior');
    war.currentHp = 10;
    const row = partyRowData(war);
    expect(row.name).toBe('FGHTR2');
    expect(row.className).toBe('Warrior');
    expect(row.level).toBe('Lv 1');
    expect(row.hp).toBe(`HP 10/${war.maxHp}`);
    expect(row.hpRatio).toBeCloseTo(10 / war.maxHp);
    expect(row.next).toBe(`Next: ${xpToReach(2)}`);
    expect(row.charges).toBe('');
    expect(row.fallen).toBe(false);
  });

  it('a caster shows only charge levels with max > 0', () => {
    const wm = make('WHITE', 'white_mage', 3);
    const row = partyRowData(wm);
    const levels = [1, 2, 3, 4, 5, 6, 7, 8].filter((lv) => wm.getMaxCharges(lv) > 0);
    expect(levels.length).toBeGreaterThan(0);
    expect(row.charges).toBe(levels.map((lv) => `L${lv} ${wm.getSpellCharges(lv)}/${wm.getMaxCharges(lv)}`).join(' '));
    expect(row.charges).not.toContain('L8');
    expect(row.next).toBe(`Next: ${xpToReach(4) - wm.xp}`);
  });

  it('MAX at the level cap; a fallen member is FALLEN', () => {
    expect(partyRowData(make('OLD', 'warrior', MAX_LEVEL)).next).toBe('Next: MAX');
    const dead = make('DEAD', 'warrior');
    dead.currentHp = 0;
    const row = partyRowData(dead);
    expect(row.fallen).toBe(true);
    expect(row.status).toBe('FALLEN');
  });

  it('shows status effects', () => {
    const war = make('WAR', 'warrior');
    war.statusTracker.apply('poison');
    expect(partyRowData(war).status).toBe('POISON');
  });
});

describe('MS-7: PartyPanel', () => {
  it('draws one row per member, fallen members in grey', () => {
    const panel = new PartyPanel({ x: 408, y: 24, width: 1488, rowHeight: 168, rows: 4 });
    const dead = make('DEAD', 'warrior');
    dead.currentHp = 0;
    panel.refresh([make('FGHTR', 'warrior'), make('FGHTR2', 'warrior'), make('WHITE', 'white_mage'), dead]);
    expect(panel.rows).toHaveLength(4);
    const texts = allTexts(panel);
    const labels = texts.map((t) => t.text);
    for (const name of ['FGHTR', 'FGHTR2', 'WHITE', 'DEAD']) expect(labels).toContain(name);
    expect(labels.filter((l) => l.startsWith('Lv '))).toHaveLength(4);
    expect(labels.filter((l) => l.startsWith('Next: '))).toHaveLength(4);
    expect(texts.find((t) => t.text === 'DEAD')!.style.fill).toBe(FALLEN_GREY);
    expect(texts.find((t) => t.text === 'FGHTR')!.style.fill).not.toBe(FALLEN_GREY);
    panel.refresh([make('SOLO', 'warrior')]);
    expect(allTexts(panel).map((t) => t.text)).not.toContain('FGHTR');
  });
});
