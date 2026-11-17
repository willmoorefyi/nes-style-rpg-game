import { Container, BitmapText, Sprite, Texture } from 'pixi.js';
import type { BattleStateMachine } from '../../battle/BattleStateMachine.js';
import type { BattleSceneConfig } from './BattleSceneTypes.js';
import type { Window } from '../../ui/Window.js';
import { battleArt } from '../../rendering/BattleArt.js';
import { AiEnemyView } from './AiEnemyView.js';
import { BATTLE_POSES, characterAtlas, type BattlePose } from '../../rendering/CharacterAtlas.js';
import { colossusArt } from '../../rendering/ColossusArt.js';
import { ColossusSlots, castKindFor } from './colossus/colossusSprites.js';
import { buildPartySprite } from './partySprites.js';
import { idlePose } from './attackChoreography.js';
import { BattlePartyPanel } from './BattlePartyPanel.js';
import { BattleEnemyList } from './BattleEnemyList.js';
import { BattleLayers } from './BattleLayers.js';
import { setTint } from './actorTint.js';
import { applyHolds, captureState, type PresentHold, type PresentedState } from './presentedState.js';
import { trembleDx, type Posture } from './enemyChoreography.js';
import { postureOf, trembleOn, trembles, withKneel, type StatusVisuals } from './fx/statusRules.js';
import { stoneTextures } from './fx/stoneTextures.js';
import { PartyKneel, hpLosses } from './partyPose.js';
import { REST_TEXTURES } from './ActiveHeroMarker.js';

const PLACEHOLDER_DEAD_TINT = 0x666666;
export { PARTY_FEET_Y, PARTY_X, partySpritePosition } from './partySprites.js';

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
  /** Pass K (docs/KNEEL_PLAN.md D-K2): the kneel tracks, the override's rise, the hurt flash and the kneeler's shake. */
  private readonly kneel = new PartyKneel();
  /** The dev `?kneel=` preview: true forces a kneel on that actor (kneelPreview.ts). */
  kneelForce: ((side: 'party' | 'enemy', i: number) => boolean) | null = null;
  private victory = false;
  /** BA-8: the compact party HP panel in the bottom strip (replaces the four status boxes). */
  readonly partyPanel: BattlePartyPanel;
  /** K3: the enemy list in the enemy window. */
  readonly enemyListView: BattleEnemyList;
  readonly layers: BattleLayers;
  /** Pass C: enemies drawn as battlefield-scale colossus forms (their proxies sit in `enemySprites`). */
  readonly colossus: ColossusSlots;
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
    this.colossus = new ColossusSlots(this.layers, colossusArt, () => castKindFor(battle.peekNextAction(), config.spells ?? []));
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
    const before = this.presented;
    this.presented = applyHolds(captureState(this.battle), this.holds);
    // D-K17: an HP loss presented with no hit (the end-of-turn poison line) shakes a kneeler or an override pose
    for (const i of hpLosses(before.party, this.presented.party)) this.kneel.hit(i, false);
    const poses = this.enemyView?.poses;
    for (const i of hpLosses(before.enemies, this.presented.enemies)) if (!this.colossus.has(i) && poses?.kneeling(i)) poses.playHurt(i);
  }

  createEnemySprites(): void {
    this.enemyView = new AiEnemyView(this.battle.allEnemies.map(e => e.data));
    for (const sprite of this.enemyView.build()) {
      this.layers.actors.addChild(sprite);
      this.enemySprites.push(sprite);
    }
    this.colossus.adopt(this.battle.allEnemies.map((e) => e.data), this.enemySprites, this.enemyView.poses);
    if (!battleArt.isLoaded) void battleArt.load().then(() => this.upgradeToArt());
  }

  /** Art finished loading after the placeholders were created (e.g. debug battles): swap them in place. */
  private upgradeToArt(): void {
    if (this.enemyView) {
      const rebuilt = this.enemyView.build();
      rebuilt.forEach((sprite, i) => { if (!this.colossus.has(i)) this.swapSprite(this.enemySprites, i, sprite); });   // never the proxy
    }
    for (let i = 0; i < this.partySprites.length; i++) {
      if (this.partyFrames[i]) continue;
      const built = buildPartySprite(this.config.party[i], i);
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
      const built = buildPartySprite(this.config.party[i], i);
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

  /** D-K3: the member's current action rises from an acting kneel (the choreography holds its motion for 6 frames). */
  isRising(sprite: Container | null): boolean {
    const i = sprite ? this.partySprites.indexOf(sprite) : -1;
    return i >= 0 && this.kneel.isRising(i);
  }

  /** Brief recoil when a party member takes damage (a kneeler shakes instead). */
  flashHurt(partyIndex: number): void {
    this.kneel.hit(partyIndex);
    this.refreshPoses();
  }

  setVictory(): void {
    this.victory = true;
    this.refreshPoses();
  }

  update(dt: number): void {
    const visuals = this.statusVisuals();
    const st = this.battle.allEnemies.map((_, i) => this.presented.enemies[i]?.statuses ?? []);
    this.enemyView?.update(dt, this.colossus.atlasSprites(this.enemySprites), st.map((s, i) => this.forced('enemy', i, postureOf(s, visuals))),
      st.map((s) => trembles(s, visuals)));
    this.colossus.update(dt);
    this.idleClock += dt;
    this.kneel.tick(dt);
    // fear (D-K16) plus a kneeler's shake, one sum through the pivot: the position (lunge, active step) never drifts
    this.partySprites.forEach((sp, i) => {
      const tremble = trembleOn(this.partyPosture(i), this.presented.party[i]?.statuses ?? [], visuals) ? trembleDx(this.idleClock) : 0;
      sp.pivot.x = -(tremble + this.kneel.shakeDx(i)) / (sp.scale.x || 1) || 0;
    });
    this.refreshPoses();
  }

  /** The pose party member i shows now (the presented state, D-K2 in partyPose.ts: `down` only at the impact). */
  partyPose(i: number): BattlePose {
    const hp = this.presented.party[i]?.hp ?? this.battle.allParty[i]?.currentHp ?? 0;
    const facts = { hp, maxHp: this.battle.allParty[i]?.maxHp ?? hp, posture: this.partyPosture(i), victory: this.victory };
    return this.kneel.pose(i, facts, idlePose(this.idleClock, i), this.poseOverride.get(i) ?? null);
  }

  partyPoseT(i: number): number { return this.kneel.localT(i); }   // the kneel phase's (or override's) frames: dev label

  private refreshPoses(): void {
    if (this.kneel.start(Object.keys(this.statusVisuals()).length > 0)) this.enemyView?.poses.snapKneel();   // D-K2 row (a)
    for (let i = 0; i < this.partySprites.length; i++) {
      const frames = this.partyFrames[i];
      const sprite = this.partySprites[i];
      if (!frames || !(sprite instanceof Sprite)) continue;
      const tex = frames[BATTLE_POSES.indexOf(this.partyPose(i))] ?? frames[0];
      REST_TEXTURES.set(sprite, frames[0]);
      sprite.texture = this.partyPosture(i) === 'stone' ? stoneTextures.of(tex) : tex;
    }
  }

  /** Party member i's status posture, from the presented snapshot. */
  partyPosture(i: number): Posture {
    return this.forced('party', i, postureOf(this.presented.party[i]?.statuses ?? [], this.statusVisuals()));
  }

  private forced(side: 'party' | 'enemy', i: number, p: Posture): Posture {
    return this.kneelForce?.(side, i) ? withKneel(p) : p;
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
