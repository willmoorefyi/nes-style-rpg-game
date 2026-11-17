/**
 * Pass K in the battle view (docs/KNEEL_PLAN.md D-K1, D-K3, D-K9, D-K20, section 6): BattleDisplayManager's weak-HP
 * kneel and `isRising`, AiEnemyView's floater sink, the ActiveHeroMarker arrow on a kneeling head, the dev kneel
 * preview and the shared pose label.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Container, Sprite, Texture } from 'pixi.js';
import { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { AiEnemyView, type MonsterArtSource } from '../../../src/scenes/battle/AiEnemyView.js';
import { ActiveHeroMarker, REST_TEXTURES } from '../../../src/scenes/battle/ActiveHeroMarker.js';
import { kneelSinkPx } from '../../../src/scenes/battle/enemyOffsets.js';
import { KNEEL_LOOP_PERIOD, KNEEL_LOOP_STAGGER, KneelPreview, kneelForced, parseKneelPreview } from '../../../src/scenes/battle/kneelPreview.js';
import { EnemyAnimPreview, poseLabelLines } from '../../../src/scenes/battle/enemyAnimPreview.js';
import { EnemyPoseController } from '../../../src/scenes/battle/EnemyPoseController.js';
import { BOSS_FRAMES, type MonsterFrame } from '../../../src/scenes/battle/enemyChoreography.js';
import { StatusTracker } from '../../../src/battle/StatusEffects.js';
import { Character } from '../../../src/entities/Character.js';
import { Window } from '../../../src/ui/Window.js';
import { battleArt, type MonsterFrames } from '../../../src/rendering/BattleArt.js';
import { BATTLE_POSES, characterAtlas } from '../../../src/rendering/CharacterAtlas.js';
import { ENEMY_WINDOW, STRIP_HEIGHT, STRIP_Y } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { testClass, testEnemy } from '../../helpers/testUtils.js';
import { loadStatusVisuals } from '../../helpers/statusVisuals.js';
import type { BattleStateMachine } from '../../../src/battle/BattleStateMachine.js';
import type { EnemyData } from '../../../src/types/index.js';

afterEach(() => { vi.restoreAllMocks(); });

const VISUALS = loadStatusVisuals();

function display(hp?: number) {
  vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(true);
  vi.spyOn(battleArt, 'getMonsterFrames').mockReturnValue(null);
  vi.spyOn(characterAtlas, 'hasBattleArt', 'get').mockReturnValue(true);
  const frames = BATTLE_POSES.map(() => new Texture());
  vi.spyOn(characterAtlas, 'getBattleFrames').mockReturnValue({ frames, footRow: 76, scale: 2 } as unknown as ReturnType<typeof characterAtlas.getBattleFrames>);
  const data = testEnemy();
  const enemies = [{ id: 'enemy_0', data, currentHp: 8, status: new StatusTracker(), displayName: 'Goblin' }];
  const party = [new Character({ name: 'WAR', classData: testClass('warrior') })];
  if (hp !== undefined) party[0].currentHp = hp;
  const battle = { allEnemies: enemies, allParty: party, peekNextAction: () => null } as unknown as BattleStateMachine;
  const win = new Window({ x: ENEMY_WINDOW.x, y: STRIP_Y, width: ENEMY_WINDOW.width, height: STRIP_HEIGHT });
  const d = new BattleDisplayManager(new Container(), battle, { party, enemies: [data] }, win);
  d.statusVisuals = () => VISUALS;
  d.createEnemySprites();
  d.createPartySprites();
  return { d, party, enemies, frames };
}

describe('BattleDisplayManager: the hero kneel', () => {
  it('D-K1: a hero at 25 % HP kneels from the battle start (in hold); healed above it, it stands up', () => {
    const max = new Character({ name: 'X', classData: testClass('warrior') }).maxHp;
    const { d, party, frames } = display(Math.floor(max / 4));
    d.update(1);
    expect(d.partyPose(0)).toMatch(/^kneel(_b)?$/);
    const sprite = d.partySprites[0] as Sprite;
    expect([frames[16], frames[17]]).toContain(sprite.texture);
    party[0].currentHp = max;
    d.updatePartySprites();
    expect(d.partyPose(0)).toBe('kneel_in2');
    for (let t = 0; t < 6; t++) d.update(1);
    expect(d.partyPose(0)).not.toMatch(/^kneel/);
  });

  it('D-K3: isRising is true for an acting kneeler (weak or poisoned), false for a standing hero, a sleeper and no sprite', () => {
    const weak = display(1);
    weak.d.update(1);
    expect(weak.d.isRising(weak.d.partySprites[0])).toBe(true);
    const ok = display();
    ok.d.update(1);
    expect(ok.d.isRising(ok.d.partySprites[0])).toBe(false);
    expect(ok.d.isRising(null)).toBe(false);
    const asleep = display();
    asleep.party[0].statusTracker.apply('sleep');
    asleep.d.updatePartySprites();
    asleep.d.update(1);
    expect(asleep.d.isRising(asleep.d.partySprites[0])).toBe(false);
  });

  it('?kneel=on forces every actor to kneel (kneelForce), on both sides', () => {
    const { d } = display();
    d.kneelForce = () => true;
    d.update(1);
    expect(d.partyPosture(0)).toBe('kneel');
    expect(d.partyPose(0)).toMatch(/^kneel/);
    expect(d.enemyView!.poses.kneeling(0)).toBe(true);
  });
});

describe('AiEnemyView: the floater sink (D-K9)', () => {
  function floater(kneelSink?: number): { view: AiEnemyView; sprites: Container[] } {
    const textures = Object.fromEntries(BOSS_FRAMES.map((n) => [n, new Texture()])) as Record<MonsterFrame, Texture>;
    const f: MonsterFrames = { textures, idle: textures.idle, attack: textures.attack, cast: textures.cast, hurt: textures.hurt,
      scale: 2, artScale: 2, cell: [80, 80], footRow: 77, floating: true, hasCast: false, lungePx: 24, anim: true,
      ...(kneelSink ? { kneelSink } : {}) };
    const art: MonsterArtSource = { getMonsterFrames: () => f };
    const view = new AiEnemyView([{ id: 'ghost', name: 'Ghost', size: 'small' } as EnemyData], art);
    return { view, sprites: view.build() };
  }

  it('a floater with kneelSink sinks by sink x scale over in, holds, and comes back up over the stand-up', () => {
    const { view, sprites } = floater(6);
    view.update(0, sprites);
    const home = sprites[0].y;
    for (let t = 0; t < 10; t++) view.update(1, sprites, ['kneel']);
    const down = sprites[0].y - home;
    expect(down).toBeGreaterThan(0);
    expect(down).toBe(kneelSinkPx(6, 1, (sprites[0] as Sprite).scale.y));   // scale x artScale = scale here (texScale 1)
    for (let t = 0; t < 8; t++) view.update(1, sprites, ['none']);
    expect(sprites[0].y).toBe(home);
  });

  it('a sheet without kneelSink droops in place; kneelSinkPx is 0 for no sink, a bad sink or standing', () => {
    const { view, sprites } = floater();
    view.update(0, sprites);
    const home = sprites[0].y;
    for (let t = 0; t < 10; t++) { view.update(1, sprites, ['kneel']); expect(sprites[0].y).toBe(home); }
    expect([kneelSinkPx(undefined, 1, 2), kneelSinkPx(-3, 1, 2), kneelSinkPx(6, 0, 2), kneelSinkPx(6, 0.5, 2)]).toEqual([0, 0, 0, 6]);
  });
});

describe('ActiveHeroMarker: the arrow follows a kneeling head (D-K20)', () => {
  it('the arrow moves down by (head(current).y - head(ready).y) x scale, and back when the hero stands', () => {
    const parent = new Container();
    const ready = new Texture();
    const kneel = new Texture();
    const sprite = new Sprite(kneel);
    sprite.scale.set(2);
    sprite.position.set(1400, 400);
    REST_TEXTURES.set(sprite, ready);
    const marker = new ActiveHeroMarker(parent);
    marker.head = (t) => (t === ready ? { y: 4 } : { y: 14 });
    marker.show(sprite);
    const arrow = parent.children[parent.children.length - 1];
    expect(arrow.y).toBe(400 - 20 + 20);
    sprite.texture = ready;
    marker.update(1);
    expect(arrow.y).toBe(380);
    expect(sprite.x).toBe(1400 - 24);                     // row (b): the step is the usual snap
  });

  it('no registered ready texture or no head: no sink', () => {
    const parent = new Container();
    const sprite = new Sprite(new Texture());
    sprite.position.set(100, 300);
    const marker = new ActiveHeroMarker(parent);
    marker.head = () => null;
    marker.show(sprite);
    expect(marker.sink()).toBe(0);
  });
});

describe('the dev kneel preview and pose label (section 6, 8)', () => {
  it('parses ?kneel=on|loop and &poseLabel=1; null when neither', () => {
    expect(parseKneelPreview('?kneel=on')).toEqual({ mode: 'on', poseLabel: false });
    expect(parseKneelPreview('?mute=1&scenario=kneel_pilot&battleStep=1&poseLabel=1')).toEqual({ mode: null, poseLabel: true });
    expect(parseKneelPreview('?kneel=loop&poseLabel=1')).toEqual({ mode: 'loop', poseLabel: true });
    expect(parseKneelPreview('?kneel=yes')).toBeNull();
  });

  it('loop: each actor toggles every 150 frames, staggered 20 per actor', () => {
    expect([KNEEL_LOOP_PERIOD, KNEEL_LOOP_STAGGER]).toEqual([150, 20]);
    expect([0, 149, 150, 300].map((c) => kneelForced('loop', c, 0))).toEqual([true, true, false, true]);
    expect([19, 20, 169, 170].map((c) => kneelForced('loop', c, 1))).toEqual([false, true, true, false]);
    expect(kneelForced('on', 999, 7)).toBe(true);
    expect(kneelForced(null, 0, 0)).toBe(false);
  });

  it('poseLabelLines: `<name>: <frame> / <t>` per actor, or the actor\'s own label; the step preview label is unchanged', () => {
    const c = new EnemyPoseController(2);
    c.playAttack(1);
    c.update(3);
    expect(poseLabelLines(c, (i) => ['Goblin A', 'Goblin B'][i], 2)).toEqual(['Goblin A: idle / 0', 'Goblin B: atk_wind1 / 3']);
    expect(poseLabelLines(c, () => 'X', 1, () => 'slam / 4')).toEqual(['X: slam / 4']);
    const preview = new EnemyAnimPreview('step', 1, { poses: c, count: 2, hasCast: () => false, name: (i) => `e${i}` });
    expect(preview.labelText()).toBe(poseLabelLines(c, (i) => `e${i}`, 2).join('\n'));
  });

  it('the kneel preview label lists the enemies, then the heroes; ?kneel=on sets the display force', () => {
    const { d } = display();
    const p = new KneelPreview({ mode: 'on', poseLabel: true }, d, { allEnemies: [{ displayName: 'Goblin' }], allParty: [{ name: 'WAR' }] });
    expect(d.kneelForce).not.toBeNull();
    d.update(1);
    const lines = p.labelLines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Goblin: kneel_in1 \/ \d+$/);
    expect(lines[1]).toMatch(/^WAR: kneel_in1 \/ \d+$/);
    const parent = new Container();
    p.showLabel(parent);
    expect(parent.children).toHaveLength(1);
    p.dispose();
    expect(d.kneelForce).toBeNull();
    expect(parent.children).toHaveLength(0);
  });
});
