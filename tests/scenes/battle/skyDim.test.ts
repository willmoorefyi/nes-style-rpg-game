/**
 * The sky dim behind F3 / F4 (docs/CHAOS_FORMS_PLAN.md 18.3, D-O19, B8): while a form with `skyDim` (0.6) is on screen
 * `bg` is multiplied by 0x999999. It is set at the end of the interlude that brings the form in (chaos_i2), not at its
 * swap, and kept through a later interlude (an interlude's `tint` multiplies with it). It resets on victory and on
 * defeat; a retry (back to F1, D-U8) and the next battle start with an untinted `bg`.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { BattleScene, COMMAND_CONFIRM_GUARD_FRAMES } from '../../../src/scenes/BattleScene.js';
import { BattleLayers } from '../../../src/scenes/battle/BattleLayers.js';
import { FormChangeView } from '../../../src/scenes/battle/formChangeView.js';
import type { InterludeStep } from '../../../src/scenes/battle/formInterlude.js';
import { greyTint } from '../../../src/scenes/battle/colossus/colossusSprites.js';
import { battleArt } from '../../../src/rendering/BattleArt.js';
import { characterAtlas } from '../../../src/rendering/CharacterAtlas.js';
import { Character } from '../../../src/entities/Character.js';
import type { ActionResult } from '../../../src/battle/BattleStateMachine.js';
import type { EnemyData } from '../../../src/types/index.js';
import { colossusBattle, colossusEnemy, HORIZON, installFixtureArt } from '../../helpers/colossusFixture.js';
import { createMockBattleSceneDeps, createMockInput, testClass, testEnemy, type MockInput } from '../../helpers/testUtils.js';

let uninstall: () => void = () => {};
afterEach(() => { uninstall(); vi.restoreAllMocks(); });

const DIM = 0x999999;

function mockArt(): void {
  vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(true);
  vi.spyOn(characterAtlas, 'hasBattleArt', 'get').mockReturnValue(true);
  vi.spyOn(battleArt, 'getMonsterFrames').mockReturnValue(null);
}

function scene(enemies: EnemyData[], hero: Character, rng: () => number = () => 0.5): { s: BattleScene; input: MockInput; bg: () => number } {
  const input = createMockInput();
  const s = new BattleScene(createMockBattleSceneDeps(input), { party: [hero], enemies, rng });
  s.enter();
  return { s, input, bg: () => BattleLayers.of(s.container).bg.tint as number };
}

/** Fight with the one hero until the battle ends (the battle.test pattern). */
function fightToEnd(s: BattleScene, input: MockInput): void {
  const tick = (a?: 'confirm'): void => { if (a) input.press(a); s.update(1); input.clear(); };
  for (let i = 0; i < 4000 && s.outcome === null; i++) {
    if (s.uiPhase === 'command') { for (let g = 0; g < COMMAND_CONFIRM_GUARD_FRAMES; g++) tick(); tick('confirm'); }
    else tick('confirm');
  }
}

const hero = (hp?: number): Character => new Character({ name: 'WAR', classData: testClass(), ...(hp ? { currentHp: hp } : {}) });

describe('the sky dim (D-O19, B8)', () => {
  it('a battle that starts on F3 dims bg to 0.6; victory resets it', async () => {
    uninstall = await installFixtureArt();
    mockArt();
    const { s, input, bg } = scene([colossusEnemy(HORIZON, { stats: { ...testEnemy().stats, hp: 1, defense: 0 } })], hero());
    expect(bg()).toBe(DIM);
    expect(greyTint(0.6)).toBe(DIM);
    fightToEnd(s, input);
    expect(s.outcome).toBe('victory');
    expect(bg()).toBe(0xffffff);
    s.exit();
  });

  it('a battle that starts on F3 before its art has loaded dims bg once the art arrives (browser finding)', async () => {
    const { colossusArt } = await import('../../../src/rendering/ColossusArt.js');
    const { fixtureIo } = await import('../../helpers/colossusFixture.js');
    const restore = colossusArt.setIo(fixtureIo());
    uninstall = () => { colossusArt.release(); restore(); };
    mockArt();
    const { s, bg } = scene([colossusEnemy(HORIZON)], hero());
    expect(bg()).toBe(0xffffff);                      // the placeholder form has no skyDim yet
    await colossusArt.ensure([HORIZON]);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(bg()).toBe(DIM);
    s.exit();
  });

  it('defeat resets it', async () => {
    uninstall = await installFixtureArt();
    mockArt();
    const strong = colossusEnemy(HORIZON, { stats: { ...testEnemy().stats, hp: 999, attack: 999, strength: 99, agility: 99, defense: 999 } });
    const { s, input, bg } = scene([strong], hero(1), () => 0.01);
    expect(bg()).toBe(DIM);
    fightToEnd(s, input);
    expect(s.outcome).toBe('defeat');
    expect(bg()).toBe(0xffffff);
    s.exit();
  });

  it('a retry (F1, D-U8) and the next battle start untinted', async () => {
    uninstall = await installFixtureArt();
    mockArt();
    const first = scene([colossusEnemy(HORIZON)], hero());
    expect(first.bg()).toBe(DIM);
    first.s.exit();
    const retry = scene([testEnemy({ id: 'chaos', name: 'Chaos', size: 'boss', sprite: 'chaos', stats: { hp: 6000 } })], hero());
    expect(retry.bg()).toBe(0xffffff);
    retry.s.exit();
    const next = scene([testEnemy({ id: 'goblin', name: 'Goblin' })], hero());
    expect(next.bg()).toBe(0xffffff);
    next.s.exit();
  });

  it('chaos_i2 sets the dim at its end, not at the swap; a later tint multiplies with it', async () => {
    uninstall = await installFixtureArt();
    const b = colossusBattle([testEnemy({ id: 'chaos', name: 'Chaos', size: 'boss', sprite: 'chaos', stats: { hp: 6000 } })]);
    const tintStep: InterludeStep = { type: 'tint', color: '#ff0000', alpha: 1, frames: 2 };
    const scripts: Record<string, InterludeStep[]> = {
      chaos_i2: [{ type: 'swap' }, { type: 'wait', frames: 10 }],
      later: [tintStep, { type: 'wait', frames: 3 }],
    };
    const view = new FormChangeView({ battle: b.battle, display: b.display, setMessage: () => {}, events: { emit: vi.fn() },
      input: b.input, interludes: { get: (id) => scripts[id] ?? null } });
    expect(b.layers.bg.tint).toBe(0xffffff);
    b.battle.allEnemies[0].data = colossusEnemy(HORIZON, { id: 'chaos_horizon' });
    view.queue({ done: true, messages: [], damageEvents: [], missed: false,
      formChange: { enemyIndex: 0, from: 'chaos', to: 'chaos_horizon', interlude: 'chaos_i2' } } as ActionResult);
    view.start();
    const tints: number[] = [];
    for (let f = 0; f < 40 && !view.update(1, false); f++) tints.push(b.layers.bg.tint as number);
    expect(tints.every((t) => t === 0xffffff)).toBe(true);
    expect(b.layers.bg.tint).toBe(DIM);
    view.queue({ done: true, messages: [], damageEvents: [], missed: false,
      formChange: { enemyIndex: 0, from: 'chaos_horizon', to: 'chaos_horizon', interlude: 'later' } } as ActionResult);
    view.start();
    view.update(1, false);
    view.update(1, false);
    expect(b.layers.bg.tint).toBe(0x990000);
    for (let f = 0; f < 10 && !view.update(1, false); f++) { /* to its end */ }
    expect(b.layers.bg.tint).toBe(DIM);
  });
});
