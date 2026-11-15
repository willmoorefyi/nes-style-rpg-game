/**
 * Pass F item 5 through the real display and controller: a SLEP's overlay attaches at the effect's impact frame (not at
 * resolve), party postures (FB-7: sleep / stun / stone hold `ready`, fear trembles without drift, stone greys), the
 * panel tags in icon priority and the enemy target line ("Goblin B SLP PSN").
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Container, Sprite, Texture } from 'pixi.js';
import { BattleAnimationController } from '../../../src/scenes/battle/BattleAnimationController.js';
import { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { BattleFieldTargeting, targetLine } from '../../../src/scenes/battle/BattleFieldTargeting.js';
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

function setup(partyStatus: StatusEffect[] = []) {
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
      return { done: true, damageEvents: [], messages: [{ text: 'Goblin B falls asleep!' }], missed: false, spellId: 'slep' };
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
      expect(s.display.enemyView!.poses.state(0).pose, `frame ${k}`).not.toMatch(/^daze/);
    }
    s.frame();
    expect(s.statusFx.overlaysOn('enemy_0')).toEqual(['zzz']);
    expect(s.statusFx.iconsOn('enemy_0')).toEqual(['icon_sleep']);
    s.frame();
    expect(['daze', 'daze_b']).toContain(s.display.enemyView!.poses.state(0).pose);
  });

  it('FB-7: a sleeping or stunned hero holds `ready` with no breathing (old: idle_b), and still flinches', () => {
    for (const st of ['sleep', 'stun'] as const) {
      const s = setup([st]);
      const seen = new Set<string>();
      for (let t = 0; t < 120; t++) { s.frame(); seen.add(s.display.partyPose(0)); }
      expect([...seen]).toEqual(['ready']);
      expect(s.statusFx.iconsOn('party_0')).toEqual([VISUALS[st].icon]);
      s.display.flashHurt(0);
      expect(s.display.partyPose(0)).toBe('hurt');
    }
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
});
