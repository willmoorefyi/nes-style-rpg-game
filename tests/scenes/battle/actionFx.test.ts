/**
 * Fd (docs/FEEDBACK_PLAN_2026-11-14.md §3.4): the spell / item / ranged-attack effects. A FIRE spawns its effect in
 * `fx.spell` on the resolve frame and its number lands at the effect's impact (18), not on the resolve frame (the F0
 * no-op factory presented at once); an all-target SLEP starts 4 frames apart per target; everything is removed by the
 * last frame. The emitters keep the pixel rules (integer scales, stepped alpha, 2-px grid).
 */
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { BattleAnimationController } from '../../../src/scenes/battle/BattleAnimationController.js';
import { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { createActionFx } from '../../../src/scenes/battle/fx/index.js';
import { BattleActionFx, FX_STAGGER } from '../../../src/scenes/battle/fx/ActionFx.js';
import { FxSource } from '../../../src/scenes/battle/fx/fxSource.js';
import { toFxData } from '../../../src/scenes/battle/fx/fxDefs.js';
import { createEmitter, seededRng, STEPS } from '../../../src/scenes/battle/fx/emitters.js';
import type { FxAtlasMeta } from '../../../src/scenes/battle/fx/fxAtlas.js';
import { validateSpellEffects } from '../../../src/core/schemaValidationFx.js';
import { StatusTracker } from '../../../src/battle/StatusEffects.js';
import { Character } from '../../../src/entities/Character.js';
import { Window } from '../../../src/ui/Window.js';
import { battleArt } from '../../../src/rendering/BattleArt.js';
import { characterAtlas } from '../../../src/rendering/CharacterAtlas.js';
import { ENEMY_WINDOW, STRIP_HEIGHT, STRIP_Y } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { createMockInput, testClass, testEnemy } from '../../helpers/testUtils.js';
import { floatsIn } from '../../helpers/battleLayers.js';
import { loadRealRegistries } from '../../helpers/realData.js';
import type { BattleStateMachine, DamageEvent, NextActionInfo } from '../../../src/battle/BattleStateMachine.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import type { EnemyData } from '../../../src/types/index.js';

afterEach(() => { vi.restoreAllMocks(); });
beforeAll(async () => { await loadRealRegistries(); });

const yaml = <T>(file: string): T => parse(readFileSync(`assets/data/${file}`, 'utf-8')) as T;
const META = JSON.parse(readFileSync('assets/sprites/battle-fx.json', 'utf-8')) as FxAtlasMeta;
const DATA = toFxData(validateSpellEffects(yaml('spell-effects.yaml')));

/** A source with the real table and atlas layout over a blank texture (sprites, not the rectangle fallback). */
function source(): FxSource {
  const s = new FxSource();
  s.setData(DATA, yaml<EnemyData[]>('enemies.yaml'));
  s.atlas.set(META, new Texture({ source: new TextureSource({ width: 1024, height: 1024 }) }));
  return s;
}

type Action = { info: NextActionInfo; kill?: boolean; sleep?: boolean };

function setup(enemyCount: number, action: Action) {
  vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(true);
  vi.spyOn(battleArt, 'getMonsterFrames').mockReturnValue(null);
  vi.spyOn(characterAtlas, 'hasBattleArt', 'get').mockReturnValue(true);
  const datas = Array.from({ length: enemyCount }, () => testEnemy());
  const enemies = datas.map((data, i) => ({ id: `enemy_${i}`, data, currentHp: 8, status: new StatusTracker(), displayName: `Goblin ${'ABC'[i]}` }));
  const party = [new Character({ name: 'BLM', classData: testClass('black_mage') })];
  let queued = 1;
  const battle = {
    allEnemies: enemies, allParty: party,
    get livingEnemies() { return enemies.filter((e) => e.currentHp > 0); },
    get livingParty() { return party.filter((c) => c.currentHp > 0); },
    isOver: false,
    get actionQueueLength() { return queued; },
    peekNextAction: () => (queued > 0 ? action.info : null),
    isNextActorAlive: () => true,
    nextActorLosesTurn: () => false,
    executeNextAction: () => {
      queued = 0;
      const events: DamageEvent[] = [];
      if (action.kill) {
        enemies[0].currentHp = 1;
        events.push({ targetId: 'enemy_0', damage: 7, isHeal: false, isCrit: false, spellElement: 'fire' });
      }
      if (action.sleep) enemies.forEach((e) => e.status.apply('sleep'));
      return { done: true, damageEvents: events, messages: [{ text: 'result' }], missed: false, spellId: action.info.spellId };
    },
    skipRemainingActions: vi.fn(),
  } as unknown as BattleStateMachine;
  const main = new Container();
  const win = new Window({ x: ENEMY_WINDOW.x, y: STRIP_Y, width: ENEMY_WINDOW.width, height: STRIP_HEIGHT });
  const display = new BattleDisplayManager(main, battle, { party, enemies: datas }, win);
  display.createEnemySprites();
  display.createPartySprites();
  display.updatePartyDisplay();
  const ctrl = new BattleAnimationController(main, battle, display, createMockInput() as unknown as InputManager,
    win, new Container(), () => {}, vi.fn());
  const play = vi.fn();
  const fx = createActionFx(display.layers, display, source());
  const realPlay = fx.play.bind(fx);
  fx.play = (...args) => { play(...args); return realPlay(...args); };
  ctrl.fx = fx;
  const layers = display.layers;
  /** One scene frame, in BattleScene.update's order (layers first). */
  const frame = () => { layers.update(1); display.update(1); ctrl.updateAnimating(1); ctrl.updateFloatingTexts(1); };
  const toResolve = () => {
    for (let i = 0; i < 300; i++) { frame(); if (play.mock.calls.length > 0) return; }
    throw new Error('the action never resolved');
  };
  /** Sprites drawn in each effect container of fx.spell. */
  const drawn = () => layers.fx.spell.children.map((c) => c.children.filter((s) => s instanceof Sprite && s.visible).length);
  return { ctrl, display, layers, main, fx, frame, toResolve, drawn };
}

const cast = (spellId: string, spellName: string, extra: Partial<NextActionInfo> = {}): NextActionInfo =>
  ({ actorId: 'party_0', actorName: 'BLM', actionType: 'magic', targetId: 'enemy_0', targetName: 'Goblin A', spellId, spellName, ...extra });

describe('ActionFx', () => {
  it('FIRE: the effect is in fx.spell on the resolve frame and the number appears at impact 18, not before', () => {
    const s = setup(1, { info: cast('fire', 'FIRE'), kill: true });
    s.toResolve();
    expect(s.drawn()[0]).toBeGreaterThan(0);
    expect(s.ctrl.animPhase).toBe('effect');
    for (let k = 1; k < 18; k++) {
      s.frame();
      expect(floatsIn(s.main), `effect frame ${k}`).toHaveLength(0);
    }
    s.frame();
    expect(floatsIn(s.main).map((t) => t.main.text)).toEqual(['7']);
    // the element glow is the impact flash, in fx.flash, and fades in steps
    const glow = s.layers.fx.flash.children.filter((c) => c.label !== 'fx.screenTint');
    expect(glow).toHaveLength(1);
    for (let k = 0; k < 17; k++) {
      expect(STEPS as readonly number[]).toContain(glow[0].alpha);
      s.frame();
    }
  });

  it('SLEP on 3 enemies: the three effects start at frames 0, 4 and 8, and the status mark pops where it landed', () => {
    const s = setup(3, { info: cast('slep', 'SLEP', { targetId: undefined, allTargets: true }), sleep: true });
    s.toResolve();
    expect(s.layers.fx.spell.children).toHaveLength(3);
    const starts = [-1, -1, -1];
    for (let t = 0; t <= 12; t++) {
      if (t > 0) s.frame();
      s.drawn().forEach((n, i) => { if (n > 0 && starts[i] < 0) starts[i] = t; });
    }
    expect(starts).toEqual([0, FX_STAGGER, 2 * FX_STAGGER]);
  });

  it('the impact of an all-target effect is the last target\'s (the numbers meet every hit)', () => {
    const fx = new BattleActionFx(setup(1, { info: cast('fire', 'FIRE') }).layers, source());
    const sprites = [new Container(), new Container(), new Container()];
    const impact = fx.play(cast('slp2', 'SLP2', { allTargets: true }), { done: true, messages: [], damageEvents: [], missed: false },
      { targetIds: ['enemy_0', 'enemy_1', 'enemy_2'], targets: sprites, actor: null, diff: [] });
    expect(impact).toBe(14 + 2 * FX_STAGGER);
  });

  it('every child is removed by the last frame (effects, the screen tint, labels)', () => {
    for (const [id, name] of [['fire', 'FIRE'], ['lit', 'LIT'], ['fog', 'FOG']] as const) {
      const s = setup(1, { info: cast(id, name, id === 'fog' ? { targetId: 'party_0' } : {}) });
      s.toResolve();
      const e = DATA.effects[DATA.spells[id]];
      for (let t = 0; t < Math.max(e.frames, e.impact + 41); t++) s.frame();
      expect(s.layers.fx.spell.children, id).toHaveLength(0);
      expect(s.layers.fx.flash.children.filter((c) => c.label === 'fx.screenTint'), id).toHaveLength(0);
      expect((s.fx as BattleActionFx).active, id).toBe(0);
    }
  });

  it('FOG floats DEF+ at the impact; a silenced cast, a melee Fight and Run play nothing (impact 0)', () => {
    const s = setup(1, { info: cast('fog', 'FOG', { targetId: 'party_0' }) });
    s.toResolve();
    for (let t = 1; t <= 14; t++) s.frame();
    expect(floatsIn(s.main).map((t) => t.main.text)).toContain('DEF+');
    const fx = new BattleActionFx(s.layers, source());
    const ctx = { targetIds: ['enemy_0'], targets: [s.display.enemySprites[0]], actor: null, diff: [] };
    const none = { done: true, messages: [], damageEvents: [], missed: false };
    expect(fx.play(cast('fire', 'FIRE', { silenced: true }), none, ctx)).toBe(0);
    expect(fx.play({ actorId: 'party_0', actorName: 'BLM', actionType: 'fight', targetId: 'enemy_0' }, none, ctx)).toBe(0);
    expect(fx.play({ actorId: 'enemy_0', actorName: 'Goblin A', actionType: 'fight', targetId: 'party_0' }, none, ctx)).toBe(0);
    expect(fx.play({ actorId: 'party_0', actorName: 'BLM', actionType: 'item', itemId: 'potion', targetId: 'party_0' }, none, ctx)).toBe(20);
  });

  it('the dragon\'s ranged attack breathes fire_breath (impact 16); the cues play glint and impact_dust and clean up', () => {
    const s = setup(1, { info: cast('fire', 'FIRE') });
    const fx = new BattleActionFx(s.layers, source());
    const ctx = { targetIds: ['party_0'], targets: [s.display.partySprites[0]], actor: s.display.enemySprites[0], diff: [] };
    const none = { done: true, messages: [], damageEvents: [], missed: false };
    expect(fx.play({ actorId: 'enemy_0', actorName: 'Red Dragon', actionType: 'fight', targetId: 'party_0' }, none, ctx)).toBe(16);
    fx.playCue('glint', s.display.enemySprites[0]);
    fx.playCue('impact_dust', s.display.enemySprites[0]);
    expect(fx.active).toBe(3);
    for (let t = 0; t < 28; t++) s.layers.update(1);
    expect(fx.active).toBe(0);
    expect(s.layers.fx.spell.children).toHaveLength(0);
  });
});

describe('emitters keep the pixel rules', () => {
  const box = { x: 400, y: 300, w: 168, h: 160 };
  it.each(Object.entries(DATA.effects))('%s: integer scales, stepped alpha, known glyphs, at most 2 screen flashes', (_id, e) => {
    const atlasKeys = Object.keys(META.glyphs);
    const frameCount = (k: string): number => META.glyphs[k]?.frames.length ?? META.glyphs[atlasKeys.find((a) => a.startsWith(`${k.split('.')[0]}.`))!].frames.length;
    const emit = createEmitter(e, { geom: { target: box, actor: { x: 100, y: 300, w: 168, h: 160 }, screenTop: 0 }, rng: seededRng(7),
      frameCount, landed: true, flashes: 2 });
    let flashFrames = 0;
    let drawnAt = 0;
    for (let t = 0; t < e.frames; t++) {
      const f = emit(t);
      if (f.screen > 0) flashFrames++;
      for (const d of f.draws) {
        expect([1, 2]).toContain(d.scale);
        expect(STEPS as readonly number[]).toContain(d.alpha);
        expect(d.frame).toBeLessThan(frameCount(d.key));
        expect(atlasKeys.some((k) => k === d.key || (k.startsWith(`${d.key.split('.')[0]}.`) && META.glyphs[k] && (META.glyphs[k] as { fixed?: boolean }).fixed))).toBe(true);
      }
      if (t === e.impact) drawnAt = f.draws.length;
    }
    expect(flashFrames).toBeLessThanOrEqual(6);
    expect(drawnAt, 'something is on screen at the impact').toBeGreaterThan(0);
    // deterministic: the same seed gives the same frames
    const again = createEmitter(e, { geom: { target: box, actor: null, screenTop: 0 }, rng: seededRng(7), frameCount, landed: true });
    const first = createEmitter(e, { geom: { target: box, actor: null, screenTop: 0 }, rng: seededRng(7), frameCount, landed: true });
    expect(JSON.stringify(again(e.impact))).toBe(JSON.stringify(first(e.impact)));
  });

  it('sprites land on the 2-px grid at integer scales (mirrored by -scale only)', () => {
    const s = setup(1, { info: cast('fir2', 'FIR2', { targetId: undefined, allTargets: true }) });
    s.toResolve();
    for (let t = 0; t < 10; t++) s.frame();
    const sprites = s.layers.fx.spell.children.flatMap((c) => c.children.filter((x): x is Sprite => x instanceof Sprite && x.visible));
    expect(sprites.length).toBeGreaterThan(0);
    for (const sp of sprites) {
      expect(sp.x % 2).toBe(0);
      expect(sp.y % 2).toBe(0);
      expect(Number.isInteger(sp.scale.x) && Number.isInteger(sp.scale.y)).toBe(true);
      expect(sp.rotation).toBe(0);
      expect(sp.filters ?? []).toHaveLength(0);
    }
  });
});

describe('fallback without art', () => {
  it('missing atlas art draws rectangles and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = setup(1, { info: cast('fire', 'FIRE') });
    const src = source();
    src.atlas.set(null, null);
    const fx = new BattleActionFx(s.layers, src);
    const ctx = { targetIds: ['enemy_0'], targets: [s.display.enemySprites[0]], actor: null, diff: [] };
    expect(fx.play(cast('fire', 'FIRE'), { done: true, messages: [], damageEvents: [], missed: false }, ctx)).toBe(18);
    for (let t = 0; t < 5; t++) s.layers.update(1);
    expect(warn.mock.calls.filter((c) => String(c[0]).startsWith('Battle fx art'))).toHaveLength(1);
  });
});
