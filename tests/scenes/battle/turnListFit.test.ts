/**
 * T6 review: the turn list's result lines stay inside the 340 px command window (they used to run into the party
 * panel). The worst case: the longest party name hitting the longest enemy name for 999, twice, with a crit, and
 * killing it.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { Container } from 'pixi.js';
import { BattleAnimationController } from '../../../src/scenes/battle/BattleAnimationController.js';
import { COMMAND_WINDOW } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { glyphWidth, fitToWidth } from '../../../src/scenes/battle/battleMessageUtils.js';
import { FONT_SIZE_SM, WINDOW_PADDING } from '../../../src/core/LayoutConstants.js';
import { NAME_MAX_LENGTH } from '../../../src/ui/NameEntryGrid.js';
import type { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import type { BattleStateMachine } from '../../../src/battle/BattleStateMachine.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import type { Window } from '../../../src/ui/Window.js';
import type { EnemyData } from '../../../src/types/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const enemies = parse(readFileSync(join(root, 'assets/data/enemies.yaml'), 'utf-8')) as EnemyData[];
/** The longest enemy name in the game, with a formation letter ("Cockatrice B"). */
const LONG_ENEMY = `${enemies.map(e => e.name).reduce((a, b) => (b.length > a.length ? b : a))} B`;
const LONG_HERO = 'W'.repeat(NAME_MAX_LENGTH);
const CONTENT_WIDTH = COMMAND_WINDOW.width - 2 * WINDOW_PADDING;

function run(actorName: string, targetName: string, messages: string[]) {
  const enemy = { displayName: targetName, currentHp: 0 };
  let queued = 1;
  const battle = {
    allEnemies: [enemy],
    allParty: [{ name: actorName, currentHp: 30 }],
    get livingEnemies() { return []; },
    livingParty: [{}],
    isOver: false,
    get actionQueueLength() { return queued; },
    peekNextAction: () => (queued > 0 ? { actorId: 'enemy_0', actorName, actionType: 'fight', targetName } : null),
    isNextActorAlive: () => true,
    executeNextAction: () => {
      queued = 0;
      return { done: true, damageEvents: [], messages: messages.map(text => ({ text })), missed: false };
    },
    skipRemainingActions: vi.fn(),
  } as unknown as BattleStateMachine;
  const display = {
    enemySprites: [new Container()], partySprites: [new Container()], enemyView: null,
    setActorPose: vi.fn(), flashHurt: vi.fn(), updatePartyDisplay: vi.fn(), updateEnemySprites: vi.fn(),
    updatePartySprites: vi.fn(),
  } as unknown as BattleDisplayManager;
  const input = { isJustPressed: () => false } as unknown as InputManager;
  const win = { contentX: WINDOW_PADDING, contentY: WINDOW_PADDING, contentWidth: CONTENT_WIDTH, contentHeight: 252,
    addChild: vi.fn(), removeChild: vi.fn() } as unknown as Window;
  const ctrl = new BattleAnimationController(new Container(), battle, display, input, win, new Container(), () => {}, vi.fn());
  for (let i = 0; i < 80 && ctrl.animPhase !== 'result'; i++) ctrl.updateAnimating(1);
  expect(ctrl.animPhase).toBe('result');
  return ctrl.turnListTexts.map(t => t.text);
}

describe('T6 review: turn-list lines fit the command window', () => {
  it('the longest name plus "Critical!" is cut to the window\'s content width', () => {
    const line = `${LONG_HERO} hits ${LONG_ENEMY} for 999! (2 hits) Critical!`;
    const [entry] = run(LONG_HERO, LONG_ENEMY, [line, `${LONG_ENEMY} defeated!`]);
    const maxChars = Math.floor(CONTENT_WIDTH / glyphWidth(FONT_SIZE_SM));
    expect(entry.length).toBeLessThanOrEqual(maxChars);
    expect(entry.length * glyphWidth(FONT_SIZE_SM)).toBeLessThanOrEqual(CONTENT_WIDTH);
    expect(entry.startsWith(`${LONG_HERO}: Fight →`)).toBe(true);
    expect(entry.endsWith('…')).toBe(true);     // it was cut, and shows it
  });

  it('a short line is left alone', () => {
    const [entry] = run('Hero', 'Imp', ['Hero hits Imp for 5!']);
    expect(entry).toBe('Hero: Fight → 5 to Imp');
  });

  it('fitToWidth cuts at the glyph count and marks the cut', () => {
    expect(fitToWidth('abcdef', glyphWidth(16) * 4, 16)).toBe('abc…');
    expect(fitToWidth('abcd', glyphWidth(16) * 4, 16)).toBe('abcd');
  });
});
