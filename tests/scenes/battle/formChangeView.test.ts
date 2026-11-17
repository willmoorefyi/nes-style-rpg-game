/**
 * The form change view (docs/CHAOS_FORMS_PLAN.md 2.3, 4.4 R15, 2.2 item 7 R20) in a real battle: F1 (an atlas
 * enemy) dissolves, the swap builds the ColossusView and puts the invisible proxy at the target rect in F1's slot,
 * `battle:formChange` is emitted at the swap, every enumerated sprite consumer then gets the proxy or the colossus path,
 * and the animation controller waits for the interlude to end.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { FormChangeView, type FormChangeDeps } from '../../../src/scenes/battle/formChangeView.js';
import type { InterludeStep } from '../../../src/scenes/battle/formInterlude.js';
import { colossusAt } from '../../../src/scenes/battle/colossus/colossusProxy.js';
import { BattleFieldTargeting } from '../../../src/scenes/battle/BattleFieldTargeting.js';
import { enemyAnimPreview } from '../../../src/scenes/battle/enemyAnimPreview.js';
import { battleArt } from '../../../src/rendering/BattleArt.js';
import type { ActionResult } from '../../../src/battle/BattleStateMachine.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import type { EnemyData } from '../../../src/types/index.js';
import { colossusBattle, colossusEnemy, HORIZON, installFixtureArt } from '../../helpers/colossusFixture.js';
import { testEnemy } from '../../helpers/testUtils.js';

let uninstall: () => void = () => {};
beforeEach(async () => { uninstall = await installFixtureArt(); });
afterEach(() => { uninstall(); vi.restoreAllMocks(); });

const F1 = (): EnemyData => testEnemy({ id: 'chaos', name: 'Chaos', size: 'boss', sprite: 'chaos', stats: { hp: 6000 } });
const F3 = (): EnemyData => colossusEnemy(HORIZON, { id: 'chaos_horizon' });

const SCRIPT: InterludeStep[] = [
  { type: 'message', text: 'The rings shatter!' },
  { type: 'dissolve', frames: 24, style: 'flicker' },
  { type: 'swap' },
  { type: 'rise', frames: 30, from_dy: 30 },
  { type: 'shake', times: 1, with: 'previous' },
  { type: 'message', text: 'Chaos fills the sky!' },
];

function setup(script: InterludeStep[] = SCRIPT) {
  const s = colossusBattle([F1()]);
  const emit = vi.fn();
  const lines: string[] = [];
  const deps: FormChangeDeps = { battle: s.battle, display: s.display, setMessage: (t) => lines.push(t), events: { emit },
    input: s.input, interludes: { get: (id) => (id === 'chaos_i2' ? script : null) } };
  const view = new FormChangeView(deps);
  const change = (): ActionResult => {
    s.battle.allEnemies[0].data = F3();             // TS-B re-points the instance (bossForms.applyFormChange)
    return { done: true, messages: [], damageEvents: [], missed: false,
      formChange: { enemyIndex: 0, from: 'chaos', to: 'chaos_horizon', interlude: 'chaos_i2', message: undefined } } as ActionResult;
  };
  const frame = (confirm = false): boolean => { s.layers.update(1); s.display.update(1); return view.update(1, confirm); };
  return { ...s, view, emit, lines, change, frame };
}

describe('FormChangeView: the swap', () => {
  it('F1 is removed after the dissolve; the colossus and the proxy at the target rect exist after the swap', () => {
    const s = setup();
    const f1 = s.display.enemySprites[0];
    expect(f1.parent).toBe(s.layers.actors);
    s.view.queue(s.change());
    expect(s.view.start()).toBe(true);
    let swappedAt = -1;
    for (let f = 0; f < 400 && !s.frame(); f++) {
      if (swappedAt < 0 && s.emit.mock.calls.length > 0) swappedAt = f;
      if (f < 90 + 23) expect(f1.parent).toBe(s.layers.actors);
    }
    expect(swappedAt).toBe(90 + 24);
    expect(s.emit).toHaveBeenCalledTimes(1);
    expect(s.emit).toHaveBeenCalledWith('battle:formChange', { from: 'chaos', to: 'chaos_horizon' });
    expect(f1.parent).toBeNull();
    const proxy = s.display.enemySprites[0];
    const c = colossusAt(proxy)!;
    expect(c).not.toBeNull();
    expect(proxy.parent).toBe(s.layers.actors);
    const b = proxy.getBounds();
    expect({ x: b.x, y: b.y, w: b.width, h: b.height }).toEqual({ x: 643, y: 285, w: 360, h: 495 });
    expect(s.layers.colossus.children.length).toBe(1);
    expect(s.lines).toEqual(['The rings shatter!', 'Chaos fills the sky!']);
    expect(s.input.holdOff).toHaveBeenCalledWith(24, ['confirm']);
  });

  it('confirm advances a message step only; with no script the form still swaps at once', () => {
    const s = setup();
    s.view.queue(s.change());
    s.view.start();
    s.frame(true);                                  // skips the first line
    let f = 1;
    while (s.emit.mock.calls.length === 0 && f < 400) { s.frame(true); f++; }
    expect(f).toBeLessThan(90);                     // the dissolve was not skipped, but the 90-frame line was
    const bare = setup([]);
    bare.view.queue({ ...bare.change(), formChange: { enemyIndex: 0, from: 'chaos', to: 'chaos_horizon', interlude: 'none', message: undefined } } as ActionResult);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    bare.view.start();
    for (let i = 0; i < 5 && !bare.frame(); i++) { /* runs to its end */ }
    expect(err).toHaveBeenCalled();
    expect(colossusAt(bare.display.enemySprites[0])).not.toBeNull();
  });
});

describe('FormChangeView: every consumer after the swap (R15)', () => {
  function swapped() {
    const s = setup();
    s.view.queue(s.change());
    s.view.start();
    for (let f = 0; f < 400 && !s.frame(); f++) { /* to the end */ }
    return s;
  }

  it('actionNumbers, BattleEffects (no element box), BattleFieldTargeting, statusFx and the controller read the proxy', () => {
    const s = swapped();
    const proxy = s.display.enemySprites[0];
    const c = colossusAt(proxy)!;
    expect(s.ctrl.findActorSprite('enemy_0')?.sprite).toBe(proxy);
    s.ctrl.spawnFloatingTextsFromEvents([{ targetId: 'enemy_0', damage: 50, isHeal: false, isCrit: false, spellElement: 'fire' }]);
    expect(s.layers.fx.flash.children.filter((g) => g instanceof Graphics)).toHaveLength(0);
    expect(c.flashing).toBe(true);
    const t = new BattleFieldTargeting(s.layers.hud, s.battle, s.display, s.input as unknown as InputManager);
    t.enterFieldTargeting(false, false, () => {}, () => {});
    expect(t.getFieldTargets()[0]).toEqual({ id: 'enemy_0', spriteIndex: 0 });
    expect(t.targetArrow!.y).toBeGreaterThanOrEqual(124);
    expect(s.display.enemyListTexts.map((x) => x.text)).toEqual(['Chaos']);
  });

  it('the poses route to the colossus: a hurt flashes it, an attack plays the slam in place', () => {
    const s = swapped();
    const poses = s.display.enemyView!.poses;
    poses.playHurt(0);
    expect(poses.colossusMode(0)).toBe('hurt');
    for (let i = 0; i < 30; i++) s.frame();
    s.display.enemyView!.playAttack(0, s.display.partySprites[0]);
    expect(poses.colossusMode(0)).toBe('slam');
    expect(poses.isLunging(0)).toBe(false);
    expect(poses.isAttacking(0)).toBe(true);
  });

  it('a late atlas load never replaces the proxy (upgradeToArt guard)', async () => {
    let finish: () => void = () => {};
    vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(false);
    vi.spyOn(battleArt, 'load').mockReturnValue(new Promise<void>((r) => { finish = r; }));
    const s = swapped();
    const proxy = s.display.enemySprites[0];
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(s.display.enemySprites[0]).toBe(proxy);
  });

  it('the dev preview host sees the proxy and the routed poses', () => {
    const s = swapped();
    expect(s.display.enemySprites[0]).toBeInstanceOf(Container);
    expect(() => enemyAnimPreview.tick(s.display, ['Chaos'], s.layers.hud, 1)).not.toThrow();
  });
});

describe('the animation controller waits for the interlude', () => {
  it('after the action that changed the form it stays in `interlude` until the player ends', () => {
    const s = setup();
    s.ctrl.formView = s.view;
    s.battle.startBattle();
    s.battle.advanceFromIntro();
    for (const id of ['party_0', 'party_1']) s.battle.submitCommand({ type: 'fight', actorId: id, targetId: 'enemy_0' });
    s.battle.prepareRound();
    const real = s.battle.executeNextAction.bind(s.battle);
    let changed = false;
    vi.spyOn(s.battle, 'executeNextAction').mockImplementation(() => {
      const r = real();
      if (changed) return r;
      changed = true;
      return { ...r, ...s.change() , damageEvents: r.damageEvents, messages: r.messages };
    });
    s.ctrl.animPhase = 'announce';
    s.ctrl.animTimer = 0;
    let interludeFrames = 0;
    const phase = (): string => s.ctrl.animPhase;
    for (let f = 0; f < 2000 && phase() !== 'round_end'; f++) {
      s.layers.update(1); s.display.update(1); s.ctrl.updateAnimating(1);
      if (phase() === 'interlude') interludeFrames++;
    }
    expect(changed).toBe(true);
    expect(interludeFrames).toBeGreaterThanOrEqual(90 + 24 + 30 + 90 - 2);
    expect(colossusAt(s.display.enemySprites[0])).not.toBeNull();
  });
});

describe('the i2 fade covers the field only (C6-10, 5.9)', () => {
  const FADE: InterludeStep[] = [
    { type: 'fade', alpha: 0.6, frames: 20 },
    { type: 'shake', times: 3 },
    { type: 'wait', frames: 4 },
  ];
  const fadeG = (main: Container): Graphics | undefined =>
    (function find(c: Container): Graphics | undefined {
      for (const k of c.children) {
        if (k instanceof Graphics && k.label === 'interlude.fade') return k;
        const f = find(k);
        if (f) return f;
      }
      return undefined;
    })(main);

  it('the fade lies in the field rect (y 120..780, between the message window and the bottom windows) on every frame, shake included', () => {
    const s = setup(FADE);
    s.view.queue(s.change());
    s.view.start();
    let seen = 0;
    for (let f = 0; f < 60 && !s.frame(); f++) {
      const g = fadeG(s.main);
      if (!g || g.getBounds().height === 0) continue;
      seen++;
      const b = g.getBounds();
      expect(b.y, `frame ${f}`).toBeGreaterThanOrEqual(120);
      expect(b.y + b.height, `frame ${f}`).toBeLessThanOrEqual(780);
      expect(b.x).toBeLessThanOrEqual(0);
      expect(b.x + b.width).toBeGreaterThanOrEqual(1920);
      expect(b.height).toBeGreaterThanOrEqual(780 - 120 - 6);
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('the flash stays full screen', () => {
    const s = setup([{ type: 'flash', color: '#ffffff', frames: 6, alpha: 1 }]);
    s.view.queue(s.change());
    s.view.start();
    s.frame();
    const flash = (function find(c: Container): Graphics | undefined {
      for (const k of c.children) {
        if (k instanceof Graphics && k.label === 'interlude.flash') return k;
        const f = find(k);
        if (f) return f;
      }
      return undefined;
    })(s.main)!;
    const b = flash.getBounds();
    expect(b.height).toBeGreaterThanOrEqual(1080);
    expect(b.width).toBeGreaterThanOrEqual(1920);
  });
});
