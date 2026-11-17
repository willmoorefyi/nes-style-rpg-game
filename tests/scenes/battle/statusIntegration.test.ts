/**
 * Pass F item 5 through the real display and controller: a SLEP's overlay attaches at the effect's impact frame (not at
 * resolve), party postures (FB-7: sleep / stun / stone hold `ready`, fear trembles without drift, stone greys), the
 * panel tags in icon priority and the enemy target line ("Goblin B SLP PSN").
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Container, Sprite, Texture, TextureSource } from 'pixi.js';
import { headOf } from '../../../src/scenes/battle/fx/texturePixels.js';
import { BattleAnimationController } from '../../../src/scenes/battle/BattleAnimationController.js';
import { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { BattleFieldTargeting, targetLine } from '../../../src/scenes/battle/BattleFieldTargeting.js';
import { enemyIconRowTop } from '../../../src/scenes/battle/fx/statusIcons.js';
import { PANEL_FONT } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { createStatusFx, type ActionFx } from '../../../src/scenes/battle/fx/index.js';
import { FxSource } from '../../../src/scenes/battle/fx/fxSource.js';
import type { BattleStatusFx } from '../../../src/scenes/battle/fx/statusFx.js';
import { stoneTextures } from '../../../src/scenes/battle/fx/stoneTextures.js';
import { StatusTracker, type StatusEffect } from '../../../src/battle/StatusEffects.js';
import { Character } from '../../../src/entities/Character.js';
import { Window } from '../../../src/ui/Window.js';
import { battleArt } from '../../../src/rendering/BattleArt.js';
import { characterAtlas } from '../../../src/rendering/CharacterAtlas.js';
import { ENEMY_WINDOW, STRIP_HEIGHT, STRIP_Y } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { createMockInput, testClass, testEnemy } from '../../helpers/testUtils.js';
import { loadStatusVisuals } from '../../helpers/statusVisuals.js';
import type { BattleStateMachine, NextActionInfo } from '../../../src/battle/BattleStateMachine.js';
import type { InputManager } from '../../../src/core/InputManager.js';

afterEach(() => { vi.restoreAllMocks(); });

const VISUALS = loadStatusVisuals();
const IMPACT = 18;
const POSES = ['ready', 'attack', 'cast', 'hurt', 'down', 'victory', 'idle_b'];

/** `poisonTick`: the action ends with the end-of-turn poison on the actor (its own line, a hold: D-K17). */
function setup(partyStatus: StatusEffect[] = [], opts: { poisonTick?: boolean } = {}) {
  vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(true);
  vi.spyOn(battleArt, 'getMonsterFrames').mockReturnValue(null);
  vi.spyOn(characterAtlas, 'hasBattleArt', 'get').mockReturnValue(true);
  const frames = POSES.map(() => new Texture());
  vi.spyOn(characterAtlas, 'getBattleFrames').mockReturnValue({ frames, footRow: 76, scale: 2 } as unknown as ReturnType<typeof characterAtlas.getBattleFrames>);
  const data = testEnemy();
  const enemies = [{ id: 'enemy_0', data, currentHp: 8, status: new StatusTracker(), displayName: 'Goblin B' }];
  const party = [new Character({ name: 'BLM', classData: testClass('black_mage') })];
  for (const s of partyStatus) party[0].statusTracker.apply(s);
  const info: NextActionInfo = { actorId: 'party_0', actorName: 'BLM', actionType: 'magic', targetId: 'enemy_0', targetName: 'Goblin B',
    spellId: 'slep', spellName: 'SLEP' };
  let queued = 1;
  const battle = {
    allEnemies: enemies, allParty: party,
    get livingEnemies() { return enemies.filter((e) => e.currentHp > 0); },
    get livingParty() { return party.filter((c) => c.currentHp > 0); },
    isOver: false,
    get actionQueueLength() { return queued; },
    peekNextAction: () => (queued > 0 ? info : null),
    isNextActorAlive: () => true,
    nextActorLosesTurn: () => false,
    executeNextAction: () => {
      queued = 0;
      enemies[0].status.apply('sleep');
      const messages = [{ text: 'Goblin B falls asleep!' }];
      if (!opts.poisonTick) return { done: true, damageEvents: [], messages, missed: false, spellId: 'slep' };
      const mid = { actorId: 'party_0', hp: party[0].currentHp, statuses: party[0].statusTracker.getAll().map((e) => e.effect) };
      party[0].currentHp -= 2;
      const line = { text: 'BLM is hurt by poison!' };
      return { done: true, damageEvents: [], messages: [...messages, line], missed: false, spellId: 'slep', holds: [{ line, ...mid }] };
    },
    skipRemainingActions: vi.fn(),
  } as unknown as BattleStateMachine;
  const main = new Container();
  const win = new Window({ x: ENEMY_WINDOW.x, y: STRIP_Y, width: ENEMY_WINDOW.width, height: STRIP_HEIGHT });
  const display = new BattleDisplayManager(main, battle, { party, enemies: [data] }, win);
  display.createEnemySprites();
  display.createPartySprites();
  display.updatePartyDisplay();
  const ctrl = new BattleAnimationController(main, battle, display, createMockInput() as unknown as InputManager,
    win, new Container(), () => {}, vi.fn());
  const play = vi.fn((..._args: Parameters<ActionFx['play']>) => IMPACT);
  ctrl.fx = { play, playCue: vi.fn() };
  const source = new FxSource();
  source.statusVisuals = VISUALS;
  const statusFx = createStatusFx(display.layers, display, battle, source) as BattleStatusFx;
  ctrl.statusFx = statusFx;
  const frame = () => { display.layers.update(1); display.update(1); ctrl.updateAnimating(1); ctrl.updateDyingEnemies(1); };
  return { ctrl, display, battle, enemies, party, play, statusFx, frame, frames };
}

describe('status visuals in the battle', () => {
  it('a landed SLEP: no zZz at resolve or before the impact; the zZz and the Z icon appear on the impact frame', () => {
    const s = setup();
    for (let i = 0; i < 200 && s.play.mock.calls.length === 0; i++) s.frame();
    expect(s.play).toHaveBeenCalled();
    expect(s.enemies[0].status.has('sleep')).toBe(true);     // the live state has it from the resolve frame
    for (let k = 1; k < IMPACT; k++) {
      s.frame();
      expect(s.statusFx.overlaysOn('enemy_0'), `frame ${k}`).toEqual([]);
      expect(s.display.enemyView!.poses.state(0).pose, `frame ${k}`).not.toMatch(/^kneel/);
    }
    s.frame();
    expect(s.statusFx.overlaysOn('enemy_0')).toEqual(['zzz']);
    expect(s.statusFx.iconsOn('enemy_0')).toEqual(['icon_sleep']);
    s.frame();
    expect(s.display.enemyView!.poses.state(0).pose).toBe('kneel_in1');   // pass K: the kneel's `in` (old: the daze sway)
  });

  it('pass K (old FB-7: held `ready`): a sleeping or stunned hero kneels in hold from the battle start; a hit shakes it +-2 px', () => {
    for (const st of ['sleep', 'stun'] as const) {
      const s = setup([st]);
      const seen = new Set<string>();
      for (let t = 0; t < 120; t++) { s.frame(); seen.add(s.display.partyPose(0)); }
      expect([...seen].sort()).toEqual(['kneel', 'kneel_b']);              // row (a): no `in` at the start
      expect(s.statusFx.iconsOn('party_0')).toEqual([VISUALS[st].icon]);
      s.display.flashHurt(0);
      expect(s.display.partyPose(0)).toMatch(/^kneel/);                    // no `hurt` on a kneeler
      const sp = s.display.partySprites[0];
      s.frame();
      expect(Math.abs(sp.pivot.x * sp.scale.x)).toBe(2);
    }
  });

  it('D-K17: a poisoned hero acts (its turn is not lost): it rises, then holds the override while the poison line shakes it; `in` starts after completeAction', () => {
    const s = setup(['poison'], { poisonTick: true });
    s.display.updatePartySprites();
    expect(s.display.partyPose(0)).toMatch(/^kneel(_b)?$/);                // poison kneels (row a: in hold)
    const log: { phase: string; pose: string; dx: number }[] = [];
    const sp = s.display.partySprites[0];
    for (let t = 0; t < 400 && s.ctrl.animPhase !== 'round_end'; t++) {
      s.frame();
      log.push({ phase: s.ctrl.animPhase, pose: s.display.partyPose(0), dx: Math.round(-sp.pivot.x * sp.scale.x) });
    }
    expect(s.play).toHaveBeenCalled();                                     // the action ran
    // the override starts at the announce (cast_gather): the rise is its first 6 frames, then the override pose
    expect(log.slice(0, 7).map((f) => f.pose)).toEqual(['kneel_in2', 'kneel_in2', 'kneel_in2', 'kneel_in1', 'kneel_in1', 'kneel_in1',
      'cast_gather']);
    const shaken = log.filter((f) => f.phase === 'result' && f.dx !== 0);
    expect(shaken.length).toBe(12);                                        // the poison line: 12 frames of +-2 px
    expect(shaken.every((f) => Math.abs(f.dx) === 2 && !/^kneel|hurt/.test(f.pose))).toBe(true);
    expect(log.some((f) => f.pose === 'hurt')).toBe(false);
    expect(log.filter((f) => f.phase === 'step_back').every((f) => !f.pose.startsWith('kneel'))).toBe(true);
    const back = log.findIndex((f) => f.phase !== 'step_back' && log[log.indexOf(f) - 1]?.phase === 'step_back');
    expect(log[back].pose).toBe('kneel_in1');                              // `in` on the first frame after completeAction
  });

  it('row (e): a status-only poison (no damage, no flash) starts `in` on the frame it is presented, for a hero and an enemy', () => {
    const s = setup();
    s.display.update(1);
    expect(s.display.partyPose(0)).not.toMatch(/^kneel|hurt/);
    s.party[0].statusTracker.apply('poison');
    s.display.updatePartySprites();
    expect(s.display.partyPose(0)).toBe('kneel_in1');
    s.enemies[0].status.apply('poison');
    s.display.updateEnemySprites(new Map());
    s.display.update(1);
    expect(s.display.enemyView!.poses.state(0).pose).toBe('kneel_in1');
    expect(s.display.enemyView!.poses.state(0).dx).toBe(0);               // no shake
  });

  it('D-K17: a poison line for an enemy whose attack has ended shakes its kneel frame (no hurt frames, `in` not restarted)', () => {
    const s = setup();
    s.enemies[0].status.apply('poison');
    s.display.capturePresented();
    for (let t = 0; t < 20; t++) s.display.update(1);
    const poses = s.display.enemyView!.poses;
    expect(poses.state(0).pose).toMatch(/^kneel(_b)?$/);
    s.enemies[0].currentHp -= 2;
    s.display.updateEnemySprites(new Map());
    s.display.update(1);
    expect(poses.state(0).pose).toMatch(/^kneel(_b)?$/);
    expect(Math.abs(poses.state(0).dx)).toBe(3);
  });

  it('poison plus fear: the hero kneels and trembles (D-K16); sleep plus poison is a disabled kneel with no tremble', () => {
    const s = setup(['poison', 'fear']);
    const sp = s.display.partySprites[0];
    const seen = new Set<number>();
    for (let t = 0; t < 40; t++) { s.display.update(1); seen.add(Math.round(-sp.pivot.x * sp.scale.x)); }
    expect(s.display.partyPose(0)).toMatch(/^kneel/);
    expect([...seen].sort()).toEqual([-1, 0, 1]);
    const z = setup(['poison', 'sleep', 'fear']);
    for (let t = 0; t < 40; t++) z.display.update(1);
    expect(z.display.partyPosture(0)).toBe('daze');
    expect(z.display.partySprites[0].pivot.x).toBe(0);
  });

  it('a stoned hero holds `ready`, through hits, as its grey copy', () => {
    const grey = new Map<Texture, Texture>();
    stoneTextures.setBuilder((t) => { const g = new Texture(); grey.set(t, g); return g; });
    const s = setup(['stone']);
    s.frame();
    s.display.flashHurt(0);
    s.display.updatePartySprites();
    expect(s.display.partyPose(0)).toBe('ready');
    const sprite = s.display.partySprites[0] as Sprite;
    expect(sprite.texture).toBe(grey.get(s.frames[0]));
    expect(stoneTextures.coloured(sprite.texture)).toBe(s.frames[0]);
  });

  it('a feared hero trembles ±1 px through its pivot; its position never drifts', () => {
    const s = setup(['fear']);
    const sprite = s.display.partySprites[0];
    const home = { x: sprite.x, y: sprite.y };
    const seen = new Set<number>();
    for (let t = 0; t < 400; t++) { s.frame(); seen.add(-sprite.pivot.x * sprite.scale.x); }
    expect([...seen].sort()).toEqual([-1, 0, 1]);
    expect({ x: sprite.x, y: sprite.y }).toEqual(home);
    s.party[0].statusTracker.remove('fear');
    s.display.updatePartySprites();
    s.frame();
    expect(sprite.pivot.x).toBe(0);
  });

  it('the party panel tags follow the icon priority (sleep before poison; old: in the order applied)', () => {
    const s = setup(['poison', 'sleep']);
    s.display.partyPanel.refresh();
    s.frame();
    expect(s.display.partyPanel.rows[0].status.text).toBe('SLP PSN');
    expect(s.statusFx.iconsOn('party_0')).toEqual(['icon_sleep', 'icon_poison']);
  });

  it('the enemy target line shows the name and the presented tags', () => {
    expect(targetLine('Goblin B', ['poison', 'sleep'], VISUALS)).toBe('Goblin B SLP PSN');
    const s = setup();
    s.enemies[0].status.apply('poison');
    s.enemies[0].status.apply('sleep');
    s.display.capturePresented();
    const targeting = new BattleFieldTargeting(s.display.layers.hud, s.battle, s.display, createMockInput() as unknown as InputManager);
    targeting.enterFieldTargeting(false, false, () => {}, () => {});
    expect(targeting.targetLabel?.text).toBe('Goblin B SLP PSN');
    targeting.clearTargetArrow();
    expect(targeting.targetLabel).toBeNull();
  });

  // final play test, pass F item 5: the yellow label sat on the status icons above the head (Garland: head 8 px
  // below his cell's top, so the icon row reaches above the cell, where the label was)
  it('with status icons the target label and arrow sit above the icon row; without, where they were', () => {
    const s = setup();
    const tex = new Texture({ source: new TextureSource({ width: 100, height: 100 }) });
    const data = new Uint8ClampedArray(100 * 100 * 4);
    for (let x = 40; x < 60; x++) data[(4 * 100 + x) * 4 + 3] = 255; // the head: row 4
    headOf(tex, () => ({ data, w: 100, h: 100 }));
    const sprite = new Sprite(tex);
    sprite.position.set(600, 200);
    sprite.scale.set(2);
    s.display.layers.actors.addChild(sprite);
    s.display.enemySprites[0] = sprite;
    const targeting = new BattleFieldTargeting(s.display.layers.hud, s.battle, s.display, createMockInput() as unknown as InputManager);
    targeting.enterFieldTargeting(false, false, () => {}, () => {});
    const plain = { label: targeting.targetLabel!.y, arrow: targeting.targetArrow!.y };
    expect(plain.arrow).toBe(sprite.y - 20);
    targeting.clearTargetArrow();
    s.enemies[0].status.apply('sleep');
    s.enemies[0].status.apply('poison');
    s.display.capturePresented();
    targeting.enterFieldTargeting(false, false, () => {}, () => {});
    const iconTop = enemyIconRowTop(200 + 4 * 2); // the head row, at x2
    const label = targeting.targetLabel!;
    expect(plain.label + PANEL_FONT).toBeGreaterThan(iconTop); // the old placement overlapped the row
    expect(label.y + PANEL_FONT).toBeLessThanOrEqual(iconTop - 2);
    expect(targeting.targetArrow!.y + 12).toBeLessThanOrEqual(iconTop);
    expect(label.y).toBeGreaterThanOrEqual(0);
  });
});
