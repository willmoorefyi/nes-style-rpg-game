/**
 * BA-8 (docs/FIX_PLAN_PENINSULA.md T6e): the enemy list groups by species and fits 9 enemies inside its window; the
 * compact party panel has one row per member with HP `cur/max`.
 */
import { describe, it, expect } from 'vitest';
import { Container } from 'pixi.js';
import { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { BattlePartyPanel } from '../../../src/scenes/battle/BattlePartyPanel.js';
import { ENEMY_WINDOW, PARTY_PANEL, PANEL_FONT, STRIP_HEIGHT, STRIP_Y } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { ENEMY_LIST_LINE, groupEnemies } from '../../../src/scenes/battle/enemyList.js';
import { Window } from '../../../src/ui/Window.js';
import { Character } from '../../../src/entities/Character.js';
import { CHAR_WIDTH, FONT_SIZE, GAME_WIDTH } from '../../../src/core/LayoutConstants.js';
import type { BattleStateMachine } from '../../../src/battle/BattleStateMachine.js';
import type { CharacterClassData } from '../../../src/types/index.js';

const fighter: CharacterClassData = {
  id: 'fighter', name: 'Fighter',
  baseStats: { hp: 30, strength: 10, agility: 5, intelligence: 3, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 1, vitality: 2, luck: 1 },
  usableEquipment: [], spellLevels: { white: 0, black: 0 },
};

type Foe = { data: { name: string }; displayName: string; currentHp: number };
const foes = (spec: [string, number][]): Foe[] => spec.flatMap(([name, n]) =>
  Array.from({ length: n }, (_, i) => ({ data: { name }, displayName: `${name} ${String.fromCharCode(65 + i)}`, currentHp: 8 })));

function manager(enemies: Foe[], party: Character[] = []) {
  const win = new Window({ x: ENEMY_WINDOW.x, y: STRIP_Y, width: ENEMY_WINDOW.width, height: STRIP_HEIGHT });
  const battle = { allEnemies: enemies, allParty: party } as unknown as BattleStateMachine;
  const dm = new BattleDisplayManager(new Container(), battle, { party, enemies: [] }, win);
  dm.updateEnemyList();
  return { dm, win };
}

/** Every list line lies inside the window's content box (the font is monospace: CHAR_WIDTH per glyph). */
function expectInside(dm: BattleDisplayManager, win: Window): void {
  for (const t of dm.enemyListTexts) {
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.x + t.text.length * CHAR_WIDTH).toBeLessThanOrEqual(win.contentWidth);
    expect(t.y + FONT_SIZE).toBeLessThanOrEqual(win.contentHeight);
  }
}

describe('BA-8: the enemy list', () => {
  it('9 enemies (6 goblins + 3 wolves) give 2 lines by species, inside the window', () => {
    const { dm, win } = manager(foes([['Goblin', 6], ['Wolf', 3]]));
    expect(dm.enemyListTexts.map(t => t.text)).toEqual(['6x Goblin', '3x Wolf']);
    expectInside(dm, win);
  });

  it('6 species use two columns, inside the window', () => {
    const { dm, win } = manager(foes([['Goblin', 2], ['Wolf', 2], ['Crawl', 1], ['Imp', 1], ['Bone', 2], ['Madpony', 1]]));
    const texts = dm.enemyListTexts;
    expect(texts).toHaveLength(6);
    expect(new Set(texts.map(t => t.x)).size).toBe(2);
    expect(Math.max(...texts.map(t => t.y))).toBeLessThan(5 * ENEMY_LIST_LINE);
    expectInside(dm, win);
  });

  it('9 species of one each still fit (two columns of 5)', () => {
    const { dm, win } = manager(foes(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map(n => [`Monster${n}`, 1] as [string, number])));
    expect(dm.enemyListTexts).toHaveLength(9);
    expectInside(dm, win);
  });

  it('a dead species greys out; the count drops as members fall', () => {
    const enemies = foes([['Goblin', 2], ['Wolf', 1]]);
    enemies[0].currentHp = 0;
    enemies[2].currentHp = 0;
    const { dm } = manager(enemies);
    expect(dm.enemyListTexts.map(t => t.text)).toEqual(['Goblin', 'Wolf']);
    expect(dm.enemyListTexts[0].tint).toBe(0xffffff);
    expect(dm.enemyListTexts[1].tint).toBe(0x888888);
    expect(dm.listIndexFor(enemies[1])).toBe(0);
    expect(groupEnemies(enemies).map(g => g.alive)).toEqual([1, 0]);
  });
});

describe('BA-8: the party panel', () => {
  const party = () => ['KNIGHT', 'THIEF', 'HEALER', 'MAGE'].map(name => new Character({ name, classData: fighter }));

  it('has 4 rows of name and HP text, inside the panel at x 900-1920 of the bottom strip', () => {
    const members = party();
    const panel = new BattlePartyPanel(members);
    expect(panel.window.x).toBe(PARTY_PANEL.x);
    expect(panel.window.x + PARTY_PANEL.width).toBeLessThanOrEqual(GAME_WIDTH);
    expect(panel.rows).toHaveLength(4);
    panel.rows.forEach((row, i) => {
      expect(row.name.text).toBe(members[i].name);
      expect(row.hp.text).toBe(`${members[i].currentHp}/${members[i].maxHp}`);
      expect(row.hp.style.fontSize).toBe(PANEL_FONT);
      expect(row.root.y + PANEL_FONT).toBeLessThanOrEqual(panel.window.contentY + panel.window.contentHeight);
      expect(row.root.x + row.status.x + 4 * CHAR_WIDTH * PANEL_FONT / FONT_SIZE).toBeLessThanOrEqual(panel.window.contentX + panel.window.contentWidth);
    });
  });

  it('refresh shows damage and a KO tag; the active row has the cursor', () => {
    const members = party();
    const panel = new BattlePartyPanel(members);
    members[1].currentHp = 0;
    members[2].currentHp = 5;
    panel.refresh();
    expect(panel.rows[1].status.text).toBe('KO');
    expect(panel.rows[2].hp.text).toBe(`5/${members[2].maxHp}`);
    panel.setActive(2);
    expect(panel.rows.map(r => r.cursor.visible)).toEqual([false, false, true, false]);
    panel.setActive(-1);
    expect(panel.rows.some(r => r.cursor.visible)).toBe(false);
  });

  it('the display manager owns the panel and no longer draws the four status boxes', () => {
    const members = party();
    const { dm } = manager(foes([['Goblin', 1]]), members);
    expect(dm.partyPanel.rows).toHaveLength(4);
    expect('statusBoxes' in dm).toBe(false);
  });
});
