import { Container, BitmapText, Graphics, Sprite, Texture } from 'pixi.js';
import type { BattleStateMachine } from '../../battle/BattleStateMachine.js';
import type { BattleSceneConfig } from './BattleSceneTypes.js';
import type { Window } from '../../ui/Window.js';
import { battleArt } from '../../rendering/BattleArt.js';
import { AiEnemyView } from './AiEnemyView.js';
import { BATTLE_POSES, characterAtlas, type BattlePose } from '../../rendering/CharacterAtlas.js';
import { idlePose } from './attackChoreography.js';
import { BattlePartyPanel } from './BattlePartyPanel.js';
import { BattleEnemyList } from './BattleEnemyList.js';
import { BattleLayers } from './BattleLayers.js';
import { setTint } from './actorTint.js';
import { applyHolds, captureState, type PresentHold, type PresentedState } from './presentedState.js';
import { trembleDx, type Posture } from './enemyChoreography.js';
import { postureOf, type StatusVisuals } from './fx/statusRules.js';
import { stoneTextures } from './fx/stoneTextures.js';

const HURT_FRAMES = 24;
const PLACEHOLDER_DEAD_TINT = 0x666666;
/** Party battle art (80x80 native at 2x): feet line per slot on the background's battle plain
 *  (docs/ART_BATTLE_PLAN.md: every actor's feet at y 360-745, B13), and x per slot (a slight diagonal). */
export const PARTY_FEET_Y = [425, 530, 635, 740];
export const PARTY_X = [1380, 1425, 1470, 1515];
const PLACEHOLDER_SIZE = 64;
const PLACEHOLDER_COLORS = [0x4488ff, 0xff4444, 0x44ff44, 0xffff44];

/** Screen position (top-left) for a party battle sprite whose feet are on `art.footRow`. */
export function partySpritePosition(i: number, art: { footRow: number; scale: number }): { x: number; y: number } {
  return { x: PARTY_X[i], y: PARTY_FEET_Y[i] - (art.footRow + 1) * art.scale };
}

export class BattleDisplayManager {
  readonly enemySprites: Container[] = [];
  /** Monster sprites with poses (attack / cast / hurt), placed on the battle plain. */
  enemyView: AiEnemyView | null = null;
  readonly partySprites: Container[] = [];
  // Per-member battle pose textures; null where only the placeholder rectangle is available
  private partyFrames: (Texture[] | null)[] = [];
  /** Called after late art replaced a sprite in place (the active-hero marker moves to the new one). */
  onSpriteSwap: ((old: Container, next: Container) => void) | null = null;
  private poseOverride = new Map<number, BattlePose>();
  /** Frames elapsed, for the breathing idle (attackChoreography.idlePose). */
  private idleClock = 0;
  private hurtTimers = new Map<number, number>();
  private victory = false;
  /** BA-8: the compact party HP panel in the bottom strip (replaces the four status boxes). */
  readonly partyPanel: BattlePartyPanel;
  /** K3: the enemy list in the enemy window. */
  readonly enemyListView: BattleEnemyList;
  readonly layers: BattleLayers;
  /**
   * What the screen shows (hp and statuses, both sides). Every visual reads it, never the live state: the party `down`
   * pose, enemy postures, the dying trigger, panel HP and the list tints. It is captured only when an action is
   * presented (at its effect's impact), by statusFx.sync and at round resolution (`capturePresented`).
   */
  presented: PresentedState;
  /** Re-test A, D: the action's changes still waiting for their line (`applyHolds`); set by the animation controller. */
  holds: readonly PresentHold[] = [];
  /** status-visuals.yaml (set by createStatusFx): the postures of both sides. */
  statusVisuals: () => StatusVisuals = () => ({});

  constructor(
    mainContainer: Container,
    private readonly battle: BattleStateMachine,
    private readonly config: BattleSceneConfig,
    enemyWindow: Window,
  ) {
    this.layers = BattleLayers.of(mainContainer);
    this.presented = captureState(battle);
    this.partyPanel = new BattlePartyPanel(config.party, () => this.presented.party);
    this.enemyListView = new BattleEnemyList(enemyWindow, () => this.battle.allEnemies.map((e, i) =>
      ({ data: e.data, currentHp: this.presented.enemies[i]?.hp ?? e.currentHp })));
  }

  // the enemy list moved to BattleEnemyList; these delegate to it
  get enemyListTexts(): BitmapText[] { return this.enemyListView.texts; }
  get enemyNameToListIndex(): Map<string, number> { return this.enemyListView.nameToIndex; }
  get enemyList(): Container { return this.enemyListView.container; }
  updateEnemyList(): void { this.enemyListView.update(); }
  listIndexFor(enemy: { data: { name: string } }): number | undefined { return this.enemyListView.indexFor(enemy); }
  updateEnemyListDeadTints(): void { this.enemyListView.updateDeadTints(); }

  /** Take the live hp and statuses as the presented state (an action's impact, statusFx.sync, round resolution). */
  capturePresented(): void {
    this.presented = applyHolds(captureState(this.battle), this.holds);
  }

  createEnemySprites(): void {
    this.enemyView = new AiEnemyView(this.battle.allEnemies.map(e => e.data));
    for (const sprite of this.enemyView.build()) {
      this.layers.actors.addChild(sprite);
      this.enemySprites.push(sprite);
    }
    if (!battleArt.isLoaded) void battleArt.load().then(() => this.upgradeToArt());
  }

  private buildPartySprite(i: number): { sprite: Container; frames: Texture[] | null } {
    const char = this.config.party[i];
    const art = characterAtlas.getBattleFrames(char.classData.id);
    if (art) {
      const sprite = new Sprite(art.frames[0]);
      const pos = partySpritePosition(i, art);
      sprite.position.set(pos.x, pos.y);
      return { sprite, frames: art.frames };
    }
    const g = new Graphics();
    g.rect(0, 0, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE).fill(PLACEHOLDER_COLORS[i % PLACEHOLDER_COLORS.length]);
    g.position.set(PARTY_X[i] + (160 - PLACEHOLDER_SIZE) / 2, PARTY_FEET_Y[i] - PLACEHOLDER_SIZE);
    return { sprite: g, frames: null };
  }

  /** Art finished loading after the placeholders were created (e.g. debug battles): swap them in place. */
  private upgradeToArt(): void {
    if (this.enemyView) {
      const rebuilt = this.enemyView.build();
      rebuilt.forEach((sprite, i) => this.swapSprite(this.enemySprites, i, sprite));
    }
    for (let i = 0; i < this.partySprites.length; i++) {
      if (this.partyFrames[i]) continue;
      const built = this.buildPartySprite(i);
      if (!built.frames) continue;
      this.partyFrames[i] = built.frames;
      this.swapSprite(this.partySprites, i, built.sprite);
    }
    this.refreshPoses();
  }

  private swapSprite(list: Container[], i: number, next: Container): void {
    const old = list[i];
    const parent = old.parent;
    if (parent) {
      parent.addChildAt(next, parent.getChildIndex(old));
      parent.removeChild(old);
    }
    next.alpha = old.alpha;
    next.visible = old.visible;
    list[i] = next;
    this.onSpriteSwap?.(old, next);
  }

  createPartySprites(): void {
    this.layers.ui.addChild(this.partyPanel.window);
    for (let i = 0; i < this.config.party.length; i++) {
      // M2: Party sprite at diagonal position
      const built = this.buildPartySprite(i);
      this.layers.actors.addChild(built.sprite);
      this.partySprites.push(built.sprite);
      this.partyFrames.push(built.frames);
    }
    this.refreshPoses();
    if (!characterAtlas.hasBattleArt) void battleArt.load().then(() => this.upgradeToArt());
  }

  /** Force a temporary pose (e.g. 'attack') for a party sprite; null clears it. No-op for placeholders. */
  setActorPose(sprite: Container, pose: BattlePose | null): void {
    const i = this.partySprites.indexOf(sprite);
    if (i < 0) return;
    if (pose) this.poseOverride.set(i, pose); else this.poseOverride.delete(i);
    this.refreshPoses();
  }

  /** Brief recoil when a party member takes damage. */
  flashHurt(partyIndex: number): void {
    this.hurtTimers.set(partyIndex, HURT_FRAMES);
    this.refreshPoses();
  }

  setVictory(): void {
    this.victory = true;
    this.refreshPoses();
  }

  update(dt: number): void {
    const visuals = this.statusVisuals();
    this.enemyView?.update(dt, this.enemySprites, this.battle.allEnemies.map((_, i) => postureOf(this.presented.enemies[i]?.statuses ?? [], visuals)));
    const before = this.idleClock;
    this.idleClock += dt;
    // fear: ±1 px through the pivot, so the position (lunge step, active step) is never touched and nothing drifts
    this.partySprites.forEach((sp, i) => { sp.pivot.x = this.partyPosture(i) === 'tremble' ? -trembleDx(this.idleClock) / (sp.scale.x || 1) || 0 : 0; });
    if (this.partySprites.some((_, i) => idlePose(before, i) !== idlePose(this.idleClock, i))) this.refreshPoses();
    if (this.hurtTimers.size === 0) return;
    for (const [i, t] of this.hurtTimers) {
      if (t - dt <= 0) this.hurtTimers.delete(i); else this.hurtTimers.set(i, t - dt);
    }
    this.refreshPoses();
  }

  /** The pose party member i shows now (from the presented state: a KO'd member goes `down` only at the impact). */
  partyPose(i: number): BattlePose {
    if ((this.presented.party[i]?.hp ?? this.battle.allParty[i]?.currentHp) <= 0) return 'down';
    // FB-7: sleep and stun hold `ready` with no breathing (and still flinch); stone holds it through hits
    const posture = this.partyPosture(i);
    if (posture === 'stone' || posture === 'still') return 'ready';
    if (posture === 'daze') return this.hurtTimers.has(i) ? 'hurt' : 'ready';
    if (this.victory) return 'victory';
    const forced = this.poseOverride.get(i);
    if (forced) return forced;
    return this.hurtTimers.has(i) ? 'hurt' : idlePose(this.idleClock, i);
  }

  private refreshPoses(): void {
    for (let i = 0; i < this.partySprites.length; i++) {
      const frames = this.partyFrames[i];
      const sprite = this.partySprites[i];
      if (!frames || !(sprite instanceof Sprite)) continue;
      const tex = frames[BATTLE_POSES.indexOf(this.partyPose(i))];
      sprite.texture = this.partyPosture(i) === 'stone' ? stoneTextures.of(tex) : tex;
    }
  }

  /** Party member i's status posture, from the presented snapshot. */
  partyPosture(i: number): Posture {
    return postureOf(this.presented.party[i]?.statuses ?? [], this.statusVisuals());
  }

  updatePartyDisplay(): void {
    this.capturePresented();
    // the left window lists the enemies; party HP is in the party panel
    this.partyPanel.refresh();
    this.updateEnemyList();
  }

  updatePartySprites(): void {
    this.capturePresented();
    for (let i = 0; i < this.partySprites.length; i++) {
      const sprite = this.partySprites[i];
      if (!sprite || !this.config.party[i]) continue;
      const down = !this.partyFrames[i] && (this.presented.party[i]?.hp ?? 1) <= 0;
      sprite.alpha = down ? 0.3 : 1.0;
      setTint(sprite, 'dead', down ? PLACEHOLDER_DEAD_TINT : null);
    }
    this.partyPanel.refresh();
    this.refreshPoses();
    this.updateEnemyList();
  }

  updateEnemySprites(dyingEnemies: Map<number, number>): void {
    this.capturePresented();
    const enemies = this.presented.enemies;
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i].hp <= 0 && this.enemySprites[i]?.visible && !dyingEnemies.has(i)) {
        dyingEnemies.set(i, 30);
        // E17: a death with no damage event (poison, instant death) holds the dying pose too (a no-op after a hit)
        this.enemyView?.poses.freezeDying(i);
      }
    }
  }
}
