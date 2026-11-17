/**
 * CHAOS_FIX_PLAN rev 3, 2.4 (M4 and the round-start state path), 5.3: a form change made at `prepareRound`
 * (`BattleStateMachine.roundFormChange`) plays its interlude before the round's first announcement. No message index is
 * consumed: the round-start lines follow, then the actions. An arrival turn (`arrivalTurn`, M6) walks through announce
 * and result like any action. (b) The incoming form's colossus tiles are not loaded when `queue` and `start` run in
 * the same frame: the interlude still ends, the swap draws the placeholder, and the real art replaces it on load.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { Container } from 'pixi.js';
import { BattleScene, COMMAND_CONFIRM_GUARD_FRAMES } from '../../../src/scenes/BattleScene.js';
import { BattleStateMachine } from '../../../src/battle/BattleStateMachine.js';
import type { InterludeStep } from '../../../src/scenes/battle/formInterlude.js';
import { interludes } from '../../../src/data/InterludeRegistry.js';
import { colossusAt } from '../../../src/scenes/battle/colossus/colossusProxy.js';
import type { ColossusView } from '../../../src/scenes/battle/colossus/ColossusView.js';
import { placeholderForm } from '../../../src/scenes/battle/colossus/colossusIndex.js';
import { BattleLayers } from '../../../src/scenes/battle/BattleLayers.js';
import { battleArt } from '../../../src/rendering/BattleArt.js';
import { characterAtlas } from '../../../src/rendering/CharacterAtlas.js';
import { Character } from '../../../src/entities/Character.js';
import type { EnemyData } from '../../../src/types/index.js';
import { descendants } from '../../helpers/battleLayers.js';
import { colossusEnemy, fixtureIo, HORIZON, installFixtureArt, ORRERY } from '../../helpers/colossusFixture.js';
import { createMockBattleSceneDeps, createMockInput, testClass, testEnemy, type MockInput } from '../../helpers/testUtils.js';

let uninstall: () => void = () => {};
afterEach(() => { uninstall(); vi.restoreAllMocks(); });

const POOL = 6000;
const I1: InterludeStep[] = [{ type: 'message', text: 'I1 LINE' }, { type: 'swap' }];
const I2: InterludeStep[] = [{ type: 'message', text: 'I2 LINE' }, { type: 'swap' }];
const stats = { ...testEnemy().stats, hp: POOL, agility: 1, attack: 1, defense: 0, magicDefense: 0, evade: 0, accuracy: 0, hits: 1 };
const F1: EnemyData = testEnemy({ id: 'chaos', name: 'Chaos', size: 'boss', sprite: 'chaos', stats,
  bossPhases: [{ hpThreshold: 0.7, patternId: '', form: 'chaos_orrery', interlude: 'chaos_i1' }] });
const F2 = colossusEnemy(ORRERY, { id: 'chaos_orrery', formOf: 'chaos', stats, bossPhases: [
  { hpThreshold: 0.9, patternId: '', message: 'F2 LINE' },
  { hpThreshold: 0.4, patternId: '', form: 'chaos_horizon', interlude: 'chaos_i2', arrivalTurn: true },
] });
const F3 = colossusEnemy(HORIZON, { id: 'chaos_horizon', formOf: 'chaos', stats });

async function scene(): Promise<{ s: BattleScene; input: MockInput; actors: string[]; tick: (a?: 'confirm') => void }> {
  await interludes.load({ loadYaml: <T,>() => Promise.resolve({ interludes: [{ id: 'chaos_i1', steps: I1 }, { id: 'chaos_i2', steps: I2 }] } as T) });
  vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(true);
  vi.spyOn(characterAtlas, 'hasBattleArt', 'get').mockReturnValue(true);
  vi.spyOn(battleArt, 'getMonsterFrames').mockReturnValue(null);
  const actors: string[] = [];
  const exec = BattleStateMachine.prototype.executeNextAction;
  vi.spyOn(BattleStateMachine.prototype, 'executeNextAction').mockImplementation(function (this: BattleStateMachine) {
    actors.push(this.peekNextAction()?.actorId ?? '?');
    return exec.call(this);
  });
  const input = createMockInput();
  const hero = new Character({ name: 'WAR', classData: testClass('warrior', { baseStats: { hp: 999, strength: 99, agility: 99, intelligence: 1, vitality: 99, luck: 5 } }) });
  const s = new BattleScene(createMockBattleSceneDeps(input), { party: [hero], enemies: [F1], forms: [F2, F3], rng: () => 0.5 });
  s.enter();
  const tick = (a?: 'confirm'): void => { if (a) input.press(a); s.update(1); input.clear(); };
  return { s, input, actors, tick };
}

/** From the command phase: Fight on the boss, so the round starts. */
function fightRound(tick: (a?: 'confirm') => void): void {
  for (let g = 0; g < COMMAND_CONFIRM_GUARD_FRAMES; g++) tick();
  tick('confirm');
  tick('confirm');
}

/** Run frames until `until` holds; returns the message lines seen in order (each once). */
function runUntil(scene: BattleScene, tick: (a?: 'confirm') => void, until: () => boolean, max = 2000): string[] {
  const lines: string[] = [];
  for (let f = 0; f < max && !until(); f++) {
    tick();
    const l = scene.messageLine;
    if (l && lines[lines.length - 1] !== l) lines.push(l);
  }
  return lines;
}

const proxyView = (s: BattleScene): ColossusView | null => {
  const p = descendants(BattleLayers.of(s.container).actors, (x): x is Container => x.label === 'colossus.proxy')[0];
  return p ? (colossusAt(p) as ColossusView) : null;
};

describe('the round-start form change (M4, 5.3)', () => {
  it('(a) the interlude plays before the first announcement, then the round-start lines, then the actions; an arrival walks through', async () => {
    uninstall = await installFixtureArt();
    const err = vi.spyOn(console, 'error');
    const { s, actors, tick } = await scene();
    tick('confirm');                                        // the intro
    s.enemyInstances[0].currentHp = Math.ceil(0.7 * POOL);  // at the F1 floor: the change comes at the round start
    fightRound(tick);
    expect(s.uiPhase).toBe('message');
    expect(actors).toEqual([]);                             // nothing is announced before the interlude
    const lines = runUntil(s, tick, () => s.uiPhase === 'executing');
    expect(lines.slice(0, 2)).toEqual(['I1 LINE', 'F2 LINE']);
    expect(proxyView(s)?.formId).toBe(ORRERY);
    runUntil(s, tick, () => s.uiPhase === 'command');
    expect(actors).toEqual(['party_0', 'enemy_0']);         // one Chaos command: no arrival at the round start

    // the hero's hit reaches the F2 floor: i2 plays, then the arrival is announced and resolved before the queued slot
    actors.length = 0;
    s.enemyInstances[0].currentHp = Math.ceil(0.4 * POOL) + 1;
    fightRound(tick);
    const after = runUntil(s, tick, () => s.uiPhase === 'command');
    expect(after).toContain('I2 LINE');
    expect(actors).toEqual(['party_0', 'enemy_0', 'enemy_0']);
    expect(s.enemyInstances[0].data.id).toBe('chaos_horizon');
    expect(err).not.toHaveBeenCalled();
    s.exit();
  });

  it('(b) the incoming tiles are not loaded at queue / start: no stall, no error; the placeholder at the swap, the art on load', async () => {
    const { colossusArt } = await import('../../../src/rendering/ColossusArt.js');
    const restore = colossusArt.setIo(fixtureIo());
    uninstall = () => { colossusArt.release(); restore(); };
    const err = vi.spyOn(console, 'error');
    const { s, tick } = await scene();
    tick('confirm');
    s.enemyInstances[0].currentHp = Math.ceil(0.7 * POOL);
    fightRound(tick);
    expect(colossusArt.isReady(ORRERY)).toBe(false);
    const lines = runUntil(s, tick, () => s.uiPhase === 'executing', 600);
    expect(s.uiPhase).toBe('executing');
    expect(lines[0]).toBe('I1 LINE');
    expect(JSON.stringify(proxyView(s)?.form)).toBe(JSON.stringify(placeholderForm()));
    await colossusArt.ensure([ORRERY]);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(proxyView(s)?.formId).toBe(ORRERY);
    expect(JSON.stringify(proxyView(s)?.form)).not.toBe(JSON.stringify(placeholderForm()));
    expect(err).not.toHaveBeenCalled();
    s.exit();
  });
});
