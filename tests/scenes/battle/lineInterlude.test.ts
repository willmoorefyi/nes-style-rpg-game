/**
 * B5 (docs/CHAOS_FORMS_PLAN.md 18.8 row 2c): a non-form phase may name an interlude. Its round-start line arrives as a
 * BattleMessage with `interlude` (TS-B, ActionResolution.checkBossPhases), and BattleScene.showMessages plays that
 * script in place of the line: chaos_crack shakes, flashes, shows the core's `crack` frame and then the phase's message.
 * A plain line, or a missing script (logged), shows the line's text as before.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { BattleScene, COMMAND_CONFIRM_GUARD_FRAMES } from '../../../src/scenes/BattleScene.js';
import { FormChangeView, lineInterlude } from '../../../src/scenes/battle/formChangeView.js';
import type { InterludeStep } from '../../../src/scenes/battle/formInterlude.js';
import { interludes } from '../../../src/data/InterludeRegistry.js';
import { colossusAt } from '../../../src/scenes/battle/colossus/colossusProxy.js';
import type { ColossusView } from '../../../src/scenes/battle/colossus/ColossusView.js';
import { battleArt } from '../../../src/rendering/BattleArt.js';
import { characterAtlas } from '../../../src/rendering/CharacterAtlas.js';
import { Character } from '../../../src/entities/Character.js';
import { BattleLayers } from '../../../src/scenes/battle/BattleLayers.js';
import type { Container } from 'pixi.js';
import { descendants } from '../../helpers/battleLayers.js';
import { colossusBattle, colossusEnemy, HORIZON, installFixtureArt } from '../../helpers/colossusFixture.js';
import { createMockBattleSceneDeps, createMockInput, testClass } from '../../helpers/testUtils.js';

let uninstall: () => void = () => {};
afterEach(() => { uninstall(); vi.restoreAllMocks(); });

const LINE = 'The horizon groans; core revealed!';
const CRACK: InterludeStep[] = [
  { type: 'shake', times: 1 },
  { type: 'flash', color: '#ffffff', frames: 4, alpha: 1 },
  { type: 'variant', layer: 'core', frame: 'crack' },
  { type: 'message', text: LINE },
];
const F3 = () => colossusEnemy(HORIZON, { id: 'chaos_horizon', bossPhases: [{ hpThreshold: 0.25, patternId: '', interlude: 'chaos_crack', message: LINE }] });

describe('lineInterlude / FormChangeView.startLine', () => {
  it('reads `interlude` from a line; a plain line names none', () => {
    expect(lineInterlude({ text: 'x', interlude: 'chaos_crack' } as { text: string })).toBe('chaos_crack');
    expect(lineInterlude({ text: 'x' })).toBeNull();
  });

  it('plays the named script on the boss whose phase names it: shake, flash, the crack frame, then the message', async () => {
    uninstall = await installFixtureArt();
    const b = colossusBattle([F3()]);
    const lines: string[] = [];
    const view = new FormChangeView({ battle: b.battle, display: b.display, setMessage: (t) => lines.push(t), events: { emit: vi.fn() },
      input: b.input, interludes: { get: (id) => (id === 'chaos_crack' ? CRACK : null) } });
    const shake = vi.spyOn(b.layers.shake, 'start');
    expect(view.startLine({ text: 'plain' })).toBe(false);
    expect(view.startLine({ text: LINE, interlude: 'chaos_crack' } as { text: string })).toBe(true);
    const c = colossusAt(b.display.enemySprites[0]) as ColossusView;
    expect(c.frameOf('core')).toBe('base');
    let frames = 0;
    while (!view.update(1, false) && frames < 400) { b.layers.update(1); frames++; }
    expect(shake).toHaveBeenCalled();
    expect(c.frameOf('core')).toBe('crack');
    expect(lines).toEqual([LINE]);
    expect(frames).toBeGreaterThanOrEqual(8 + 4 + 90 - 2);
  });

  it('a missing script shows the line (false) and logs', async () => {
    uninstall = await installFixtureArt();
    const b = colossusBattle([F3()]);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = new FormChangeView({ battle: b.battle, display: b.display, setMessage: () => {}, events: { emit: vi.fn() },
      input: b.input, interludes: { get: () => null } });
    expect(view.startLine({ text: LINE, interlude: 'chaos_crack' } as { text: string })).toBe(false);
    expect(err).toHaveBeenCalled();
  });
});

describe('BattleScene plays a round-start line interlude (B5)', () => {
  it('F3 below its 0.25 phase: the round opens with chaos_crack (the crack frame, then the line), then the actions', async () => {
    uninstall = await installFixtureArt();
    await interludes.load({ loadYaml: <T,>() => Promise.resolve({ interludes: [{ id: 'chaos_crack', steps: CRACK }] } as T) });
    vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(true);
    vi.spyOn(characterAtlas, 'hasBattleArt', 'get').mockReturnValue(true);
    vi.spyOn(battleArt, 'getMonsterFrames').mockReturnValue(null);
    const input = createMockInput();
    const s = new BattleScene(createMockBattleSceneDeps(input), { party: [new Character({ name: 'WAR', classData: testClass() })],
      enemies: [F3()], rng: () => 0.5 });
    s.enter();
    s.enemyInstances[0].currentHp = 1000;                 // below 0.25 of 6000: the phase fires at the round start
    const tick = (a?: 'confirm'): void => { if (a) input.press(a); s.update(1); input.clear(); };
    tick('confirm');                                       // the intro
    for (let g = 0; g < COMMAND_CONFIRM_GUARD_FRAMES; g++) tick();
    tick('confirm');                                       // Fight
    tick('confirm');                                       // the target: the round starts
    expect(s.uiPhase).toBe('message');
    const proxy = descendants(BattleLayers.of(s.container).actors, (x): x is Container => x.label === 'colossus.proxy')[0];
    const c = colossusAt(proxy) as ColossusView;
    expect(c.frameOf('core')).toBe('base');
    let sawCrackLine = false;
    for (let f = 0; f < 300 && s.uiPhase === 'message'; f++) { tick(); sawCrackLine ||= s.messageLine === LINE; }
    expect(sawCrackLine).toBe(true);
    expect(c.frameOf('core')).toBe('crack');
    expect(s.uiPhase).toBe('executing');
    s.exit();
  });
});
