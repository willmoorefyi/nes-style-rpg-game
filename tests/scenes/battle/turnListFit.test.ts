/**
 * T6 review and B12: the turn list's lines stay inside the 340 px command window (they used to run into the party
 * panel), at the normal 24 px UI size on a 32 px pitch, with one label for both states (`THIEF Fight` while pending,
 * `THIEF Fight 19` when done) and no target in the entry.
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
import { WINDOW_PADDING } from '../../../src/core/LayoutConstants.js';
import { TURN_FONT, TURN_PITCH, actionLabel, compactResult } from '../../../src/scenes/battle/TurnList.js';
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

interface Extra { actionType?: string; spellName?: string; itemName?: string }

function run(actorName: string, targetName: string, messages: string[], extra: Extra = {}) {
  const enemy = { displayName: targetName, currentHp: 0 };
  let queued = 1;
  const battle = {
    allEnemies: [enemy],
    allParty: [{ name: actorName, currentHp: 30 }],
    get livingEnemies() { return []; },
    livingParty: [{}],
    isOver: false,
    get actionQueueLength() { return queued; },
    peekNextAction: () => (queued > 0 ? { actorId: 'enemy_0', actorName, actionType: 'fight', targetName, ...extra } : null),
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
  ctrl.updateAnimating(1);
  const pending = ctrl.turnListTexts.map(t => t.text);
  for (let i = 0; i < 80 && ctrl.animPhase !== 'result'; i++) ctrl.updateAnimating(1);
  expect(ctrl.animPhase).toBe('result');
  const texts = ctrl.turnListTexts;
  return Object.assign(texts.map(t => t.text), { pending, fontSize: Number(texts[0]?.style.fontSize), y: texts[0]?.y });
}

const MAX_CHARS = Math.floor(CONTENT_WIDTH / glyphWidth(TURN_FONT));

describe('T6 review / B12: turn-list lines', () => {
  it('use the 24 px UI font on a 32 px pitch (old: 16 px on 24)', () => {
    const entries = run('THIEF', 'Gr.Imp B', ['THIEF hits Gr.Imp B for 19!']);
    expect(entries.fontSize).toBeGreaterThanOrEqual(24);
    expect(TURN_FONT).toBeGreaterThanOrEqual(24);
    expect(TURN_PITCH).toBe(32);
  });

  it('pending and done share the label and its casing: "THIEF Fight" then "THIEF Fight 19" (old: "fight" vs "Fight")', () => {
    const entries = run('THIEF', 'Gr.Imp B', ['THIEF hits Gr.Imp B for 19!']);
    expect(entries.pending).toEqual(['THIEF Fight']);
    expect(entries[0]).toBe('THIEF Fight 19');
  });

  it('every sample fits the content width at 24 px without being cut', () => {
    const samples: Array<[string, string, string[], Extra?]> = [
      [LONG_HERO, 'Gr.Imp B', [`${LONG_HERO} hits Gr.Imp B for 57! (3 hits) Critical!`, 'Gr.Imp B defeated!']],
      ['Gr.Imp B', 'FGHTR', ['Gr.Imp B hits FGHTR for 12!']],
      [LONG_HERO, 'Goblin', [`${LONG_HERO} casts FIRE!`, 'Goblin A takes 30 damage!', 'Goblin B takes 28 damage!', 'Goblin A defeated!'],
        { actionType: 'magic', spellName: 'FIRE' }],
      [LONG_HERO, LONG_HERO, [`${LONG_HERO} recovers 24 HP!`], { actionType: 'item', itemName: 'Potion' }],
      [LONG_HERO, 'Goblin', [`${LONG_HERO} missed!`]],
      [LONG_HERO, 'Goblin', ['Escaped!'], { actionType: 'run' }],
    ];
    for (const [actor, target, lines, extra] of samples) {
      const [entry] = run(actor, target, lines, extra);
      expect(entry.length, entry).toBeLessThanOrEqual(MAX_CHARS);
      expect(entry.endsWith('…'), entry).toBe(false);
    }
  });

  it('compact results: kill, crit, multi-hit, miss, heal, sleep and escape', () => {
    const r = (actor: string, ...lines: string[]) => compactResult(lines.map(text => ({ text })), actor);
    expect(r('A', 'A hits Imp for 19!', 'Imp defeated!')).toBe('19*');
    expect(r('A', 'A hits Imp for 57! (3 hits) Critical!')).toBe('x3 57!');
    expect(r('A', 'A missed!')).toBe('Miss');
    expect(r('A', 'A recovers 24 HP!')).toBe('+24');
    expect(r('A', 'A is asleep!')).toBe('Asleep');
    expect(r('A', 'Escaped!')).toBe('Escaped');
    expect(r('A', 'A casts SLEP!', 'Imp is affected by sleep!')).toBe('Sleep');
    expect(r('A', 'A is silenced!')).toBe('Silenced');
    expect(actionLabel({ actionType: 'magic', spellName: 'FIRE' })).toBe('FIRE');
    expect(actionLabel({ actionType: 'item', itemName: 'Potion' })).toBe('Potion');
  });

  it('the longest names are still cut to the window, and show it', () => {
    const [entry] = run(LONG_HERO, LONG_ENEMY, [`${LONG_HERO} casts FIRE!`, `${LONG_ENEMY} takes 120 damage!`],
      { actionType: 'item', itemName: 'Phoenix Down Deluxe' });
    expect(entry.length).toBeLessThanOrEqual(MAX_CHARS);
    expect(entry.length * glyphWidth(TURN_FONT)).toBeLessThanOrEqual(CONTENT_WIDTH);
    expect(entry.endsWith('…')).toBe(true);
  });

  it('fitToWidth cuts at the glyph count and marks the cut', () => {
    expect(fitToWidth('abcdef', glyphWidth(16) * 4, 16)).toBe('abc…');
    expect(fitToWidth('abcd', glyphWidth(16) * 4, 16)).toBe('abcd');
  });
});
