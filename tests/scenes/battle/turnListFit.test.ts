/**
 * T6 review and B12: the turn list's lines stay inside the 340 px command window (they used to run into the party
 * panel), at the normal 24 px UI size on a 32 px pitch. U15: every entry names its target (`THIEF>Gr.Imp B` while
 * pending, `THIEF>Gr.Imp B 19` when done; `B.MAG FIRE>Goblin 30`; `>All`), a kill reads `KO` (`19KO`), and a long
 * line shortens the target first, then the label, so the actor and the result always show.
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
import { TURN_FONT, TURN_PITCH, actionLabel, compactResult, fitEntry } from '../../../src/scenes/battle/TurnList.js';
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

interface Extra { actionType?: string; spellName?: string; itemName?: string; targetId?: string; allTargets?: boolean }

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
    peekNextAction: () => (queued > 0 ? { actorId: 'enemy_0', actorName, actionType: 'fight', targetId: 'party_0', targetName, ...extra } : null),
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

  it('U15: pending and done name the target: "THIEF>Gr.Imp B" then "THIEF>Gr.Imp B 19" (old: "THIEF Fight 19")', () => {
    const entries = run('THIEF', 'Gr.Imp B', ['THIEF hits Gr.Imp B for 19!']);
    expect(entries.pending).toEqual(['THIEF>Gr.Imp B']);
    expect(entries[0]).toBe('THIEF>Gr.Imp B 19');
  });

  it('U15: a spell or item adds its label after the actor; all-enemy spells read ">All"; self and party-wide name no target', () => {
    expect(run('B.MAG', 'Goblin', ['B.MAG casts FIRE!', 'Goblin takes 30 damage!'], { actionType: 'magic', spellName: 'FIRE' })[0])
      .toBe('B.MAG FIRE>Goblin 30');
    expect(run('B.MAG', '', ['B.MAG casts LIT2!', 'Goblin A takes 30 damage!'], { actionType: 'magic', spellName: 'LIT2', targetId: undefined, allTargets: true }).pending)
      .toEqual(['B.MAG LIT2>All']);
    expect(run('W.MAG', '', ['W.MAG casts HEAL!'], { actionType: 'magic', spellName: 'HEAL', targetId: undefined }).pending).toEqual(['W.MAG HEAL']);
    expect(run('W.MAG', 'W.MAG', ['W.MAG casts RUSE!'], { actionType: 'magic', spellName: 'RUSE', targetId: 'enemy_0' }).pending).toEqual(['W.MAG RUSE']);
    expect(run('THIEF', 'FGHTR', ['THIEF uses Potion!'], { actionType: 'item', itemName: 'Potion' }).pending).toEqual(['THIEF Potion>FGHTR']);
    expect(run('THIEF', '', ['Escaped!'], { actionType: 'run', targetId: undefined })[0]).toBe('THIEF Run Escaped');
  });

  it('U15: with 6-character names, Gr.Imp B, a crit kill and multi-hit, every sample fits at 24 px and shows its full result and actor', () => {
    const samples: Array<[string, string, string[], string, Extra?]> = [
      [LONG_HERO, 'Gr.Imp B', [`${LONG_HERO} hits Gr.Imp B for 57! (3 hits) Critical!`, 'Gr.Imp B defeated!'], 'x3 57!KO'],
      [LONG_HERO, 'Gr.Imp B', [`${LONG_HERO} hits Gr.Imp B for 157! (3 hits) Critical!`, 'Gr.Imp B defeated!'], 'x3 157!KO'],
      ['Gr.Imp B', 'FGHTR', ['Gr.Imp B hits FGHTR for 12!'], '12'],
      [LONG_HERO, 'Goblin A', [`${LONG_HERO} casts FIRE!`, 'Goblin A takes 30 damage!', 'Goblin A defeated!'], '30KO',
        { actionType: 'magic', spellName: 'FIRE' }],
      [LONG_HERO, LONG_ENEMY, [`${LONG_HERO} casts FIRE!`, `${LONG_ENEMY} takes 120 damage!`], '120', { actionType: 'item', itemName: 'Phoenix Down Deluxe' }],
      [LONG_HERO, 'WWWWWW', [`${LONG_HERO} recovers 24 HP!`], '+24', { actionType: 'item', itemName: 'Potion' }],
      [LONG_HERO, 'Goblin B', [`${LONG_HERO} missed!`], 'Miss'],
      [LONG_HERO, '', ['Escaped!'], 'Escaped', { actionType: 'run', targetId: undefined }],
    ];
    for (const [actor, target, lines, result, extra] of samples) {
      const [entry] = run(actor, target, lines, extra);
      expect(entry.length * glyphWidth(TURN_FONT), entry).toBeLessThanOrEqual(CONTENT_WIDTH);
      expect(entry.length, entry).toBeLessThanOrEqual(MAX_CHARS);
      expect(entry.endsWith(` ${result}`), `${entry} ends with ${result}`).toBe(true);
      expect(entry.startsWith(actor), entry).toBe(true);
      expect(entry).not.toContain('*');
      // revision 4: <actor><label?>><target, at least 3 characters, or 2 once the label has dropped> <result>
      const m = entry.match(/^(\S+)(?: (\S+?))?>(\S+?)(…?) /);
      if (target) {
        expect(m, entry).not.toBeNull();
        const kept = m![3];
        expect(target.startsWith(kept), `${entry}: ${kept} is the start of ${target}`).toBe(true);
        expect(kept.length, entry).toBeGreaterThanOrEqual(m![2] ? 3 : 2);
      }
    }
  });

  it('U15: fitEntry shortens the target first (to 3 characters), then the label, then the target to 2', () => {
    const W = MAX_CHARS * glyphWidth(TURN_FONT);
    expect(MAX_CHARS).toBe(20); // 292 px at 14.4 px per character
    expect(fitEntry('THIEF', '', 'Gr.Imp B', '19', W)).toBe('THIEF>Gr.Imp B 19');
    expect(fitEntry('WWWWWW', '', 'Gr.Imp B', 'x3 57!KO', W)).toBe('WWWWWW>Gr.… x3 57!KO');
    expect(fitEntry('WWWWWW', 'Potion', 'Gr.Imp B', '+24', W)).toBe('WWWWWW Pot…>Gr.… +24');
    expect(fitEntry('WWWWWW', 'Phoenix Down', 'Cockatrice B', 'x3 157!KO', W)).toBe('WWWWWW>Co… x3 157!KO');
    expect(fitEntry('Cockatrice B', '', 'WWWWWW', 'x3 157!KO', W).endsWith(' x3 157!KO')).toBe(true);
    expect(fitEntry('Cockatrice B', '', 'WWWWWW', 'x3 157!KO', W).length).toBeLessThanOrEqual(20);
  });

  it('compact results: kill (KO, never *), crit, multi-hit, miss, heal, sleep and escape', () => {
    const r = (actor: string, ...lines: string[]) => compactResult(lines.map(text => ({ text })), actor);
    expect(r('A', 'A hits Imp for 19!', 'Imp defeated!')).toBe('19KO');
    expect(r('A', 'A hits Imp for 57! (3 hits) Critical!', 'Imp defeated!')).toBe('x3 57!KO');
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

  it('the longest names are still cut to the window, and show it (U15: the target is cut, the result stays)', () => {
    const [entry] = run(LONG_HERO, LONG_ENEMY, [`${LONG_HERO} casts FIRE!`, `${LONG_ENEMY} takes 120 damage!`],
      { actionType: 'item', itemName: 'Phoenix Down Deluxe' });
    expect(entry.length).toBeLessThanOrEqual(MAX_CHARS);
    expect(entry.length * glyphWidth(TURN_FONT)).toBeLessThanOrEqual(CONTENT_WIDTH);
    expect(entry).toContain('…');
    expect(entry.endsWith(' 120')).toBe(true);
  });

  it('fitToWidth cuts at the glyph count and marks the cut', () => {
    expect(fitToWidth('abcdef', glyphWidth(16) * 4, 16)).toBe('abc…');
    expect(fitToWidth('abcd', glyphWidth(16) * 4, 16)).toBe('abcd');
  });
});
