/**
 * F0 (docs/FEEDBACK_PLAN_2026-11-14.md §2 items 6-7): per-enemy attack timing, split offsets, the attack cues and their
 * hand-off to ActionFx, the frame fallback chain and the atlas `hasRaise` flag.
 */
import { describe, it, expect, vi } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { EnemyPoseController, ATTACK_FRAMES, ATTACK_OUT } from '../../../src/scenes/battle/EnemyPoseController.js';
import { AiEnemyView, type MonsterArtSource } from '../../../src/scenes/battle/AiEnemyView.js';
import { BOSS_FRAMES, FRAME_FALLBACK, LATE_FRAMES, MONSTER_FRAMES, resolveFrame, type MonsterFrame } from '../../../src/scenes/battle/enemyChoreography.js';
import { BattleAnimationController } from '../../../src/scenes/battle/BattleAnimationController.js';
import type { MonsterFrames } from '../../../src/rendering/BattleArt.js';
import type { EnemyData } from '../../../src/types/index.js';
import type { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import type { BattleStateMachine } from '../../../src/battle/BattleStateMachine.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import type { Window } from '../../../src/ui/Window.js';

describe('EnemyPoseController: per-enemy timing, split offsets, cues', () => {
  it('an attack stores its own contact and length (the in-place values in F0); attackOutDone reads them', () => {
    const c = new EnemyPoseController(2);
    c.playAttack(1);
    expect(c.attackTiming(1)).toEqual({ contactAt: ATTACK_OUT, totalFrames: ATTACK_FRAMES });
    c.update(ATTACK_OUT - 1);
    expect(c.attackOutDone(1)).toBe(false);
    c.update(1);
    expect(c.attackOutDone(1)).toBe(true);
    c.update(ATTACK_FRAMES - ATTACK_OUT - 1);
    expect(c.isAttacking(1)).toBe(true);
    c.update(1);
    expect(c.isAttacking(1)).toBe(false);
  });

  it('state() keeps the scaled lunge in dx / dy and leaves the travel out while it is 0', () => {
    const c = new EnemyPoseController(1);
    c.configure(0, { scaleFactor: 0.5 });
    c.playAttack(0);
    c.update(ATTACK_OUT + 2);              // the full lunge L = 24, at scale factor 0.5
    const st = c.state(0);
    expect(st.dx).toBe(Math.round(24 * 0.5));
    expect('travelDx' in st || 'travelDy' in st).toBe(false);
  });

  it('`contact` is raised once, on the contact frame; F0 never raises `hold`', () => {
    const c = new EnemyPoseController(2);
    const cues: [number, string, number][] = [];
    c.onCue = (i, cue) => cues.push([i, cue, c.debug(i).t]);
    c.playAttack(0);
    for (let f = 0; f < ATTACK_FRAMES + 5; f++) c.update(1);
    expect(cues).toEqual([[0, 'contact', ATTACK_OUT]]);
    c.playCast(1);
    c.playHurt(0);
    for (let f = 0; f < 40; f++) c.update(1);
    expect(cues).toHaveLength(1);
  });
});

const frames = (): MonsterFrames => {
  const textures = Object.fromEntries(BOSS_FRAMES.map((n) => [n, new Texture()])) as Record<MonsterFrame, Texture>;
  return { textures, idle: textures.idle, attack: textures.attack, cast: textures.cast, hurt: textures.hurt, scale: 2,
    artScale: 2, cell: [80, 80], footRow: 76, floating: false, hasCast: false, lungePx: 24, anim: true };
};

describe('AiEnemyView: playAttack(i, target) and the cue hand-off', () => {
  const art: MonsterArtSource = { getMonsterFrames: () => frames() };
  const goblins = [{ id: 'goblin', name: 'Goblin', size: 'small' } as EnemyData, { id: 'goblin', name: 'Goblin', size: 'small' } as EnemyData];

  it('playAttack forwards to the poses (the target is ignored in F0) and the contact cue names the sprite', () => {
    const view = new AiEnemyView(goblins, art);
    const sprites = view.build();
    const cues: [number, string, Container][] = [];
    view.onCue = (i, cue, sprite) => cues.push([i, cue, sprite]);
    view.playAttack(1, new Container());
    expect(view.poses.isLunging(1)).toBe(true);
    for (let f = 0; f < ATTACK_OUT; f++) view.update(1, sprites);
    expect(cues).toEqual([[1, 'contact', sprites[1]]]);
  });

  it('BattleAnimationController hands the cues to ActionFx.playCue (hold: glint, contact: impact_dust)', () => {
    const view = new AiEnemyView(goblins, art);
    const sprites = view.build();
    const display = { enemySprites: sprites, partySprites: [], enemyView: view } as unknown as BattleDisplayManager;
    const win = { contentX: 0, contentY: 0, contentWidth: 292, contentHeight: 400, addChild: vi.fn(), removeChild: vi.fn() } as unknown as Window;
    const ctrl = new BattleAnimationController(new Container(), {} as BattleStateMachine, display,
      { isJustPressed: () => false } as unknown as InputManager, win, new Container(), () => {}, vi.fn());
    const playCue = vi.fn();
    ctrl.fx = { play: () => 0, playCue };
    view.onCue?.(0, 'hold', sprites[0]);
    view.playAttack(0, null);
    for (let f = 0; f < ATTACK_OUT; f++) view.update(1, sprites);
    expect(playCue.mock.calls).toEqual([['glint', sprites[0], undefined], ['impact_dust', sprites[0], undefined]]);
  });
});

describe('monster frame names and the fallback chain', () => {
  it('daze / daze_b join MONSTER_FRAMES; the raise and its in-betweens join BOSS_FRAMES; all seven are LATE_FRAMES', () => {
    for (const n of ['daze', 'daze_b'] as const) expect(MONSTER_FRAMES).toContain(n);
    for (const n of ['attack_raise', 'atk_raise_in', 'atk_raise_b', 'atk_swing', 'atk_swing2'] as const) {
      expect(BOSS_FRAMES).toContain(n);
      expect(MONSTER_FRAMES).not.toContain(n);
    }
    expect([...LATE_FRAMES].sort()).toEqual(['atk_raise_b', 'atk_raise_in', 'atk_swing', 'atk_swing2', 'attack_raise', 'daze', 'daze_b']);
  });

  it('a missing frame resolves along the chain to the first frame the atlas has', () => {
    const old = new Set<MonsterFrame>(['idle', 'attack', 'hurt']);
    const rigged = new Set<MonsterFrame>([...old, 'hurt_in1', 'atk_wind1', 'atk_wind2', 'atk_mid']);
    const on = (s: Set<MonsterFrame>) => (f: MonsterFrame) => s.has(f);
    expect(resolveFrame('daze', on(rigged))).toBe('hurt_in1');
    expect(resolveFrame('daze', on(old))).toBe('idle');
    expect(resolveFrame('daze_b', on(rigged))).toBe('hurt_in1');
    expect(resolveFrame('atk_raise_in', on(rigged))).toBe('atk_wind1');
    expect(resolveFrame('attack_raise', on(rigged))).toBe('atk_wind2');
    expect(resolveFrame('atk_raise_b', on(rigged))).toBe('atk_wind2');
    expect(resolveFrame('atk_swing', on(rigged))).toBe('atk_mid');
    expect(resolveFrame('atk_swing2', on(old))).toBe('attack');
    expect(resolveFrame('cast_rise', on(old))).toBe('attack');          // a boss-less cast shows attack
    expect(resolveFrame('idle', () => false)).toBeNull();                // no loop
    for (const n of BOSS_FRAMES) expect(FRAME_FALLBACK[n], n).toBeDefined();
  });
});
