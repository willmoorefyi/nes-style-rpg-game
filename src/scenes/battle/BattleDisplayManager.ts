import { Container, BitmapText, Graphics, Sprite, Texture } from 'pixi.js';
import type { BattleStateMachine } from '../../battle/BattleStateMachine.js';
import type { BattleSceneConfig } from './BattleSceneTypes.js';
import type { Window } from '../../ui/Window.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { FONT_SIZE } from '../../core/LayoutConstants.js';
import { battleArt } from '../../rendering/BattleArt.js';
import { AiEnemyView } from './AiEnemyView.js';
import { BATTLE_POSES, characterAtlas, type BattlePose } from '../../rendering/CharacterAtlas.js';
import { idlePose } from './attackChoreography.js';
import { BattlePartyPanel } from './BattlePartyPanel.js';
import { groupEnemies, enemyListCells } from './enemyList.js';

const HURT_FRAMES = 24;
const DEAD_TINT = 0x888888;
/** Party battle art (80x80 native at 2x): feet line per slot on the background's battle plain
 *  (docs/ART_BATTLE_PLAN.md: every actor's feet at y 360-770), and x per slot (a slight diagonal). */
export const PARTY_FEET_Y = [440, 550, 660, 770];
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
  private poseOverride = new Map<number, BattlePose>();
  /** Frames elapsed, for the breathing idle (attackChoreography.idlePose). */
  private idleClock = 0;
  private hurtTimers = new Map<number, number>();
  private victory = false;
  /** BA-8: the compact party HP panel in the bottom strip (replaces the four status boxes). */
  readonly partyPanel: BattlePartyPanel;
  // K3: Enemy list texts in the enemy window
  enemyListTexts: BitmapText[] = [];
  /** Base enemy name (species) -> list text index. */
  readonly enemyNameToListIndex: Map<string, number> = new Map();
  /** The enemy list container (hidden while a spell or item list uses the window). */
  readonly enemyList = new Container();

  constructor(
    private readonly mainContainer: Container,
    private readonly battle: BattleStateMachine,
    private readonly config: BattleSceneConfig,
    private readonly enemyWindow: Window,
  ) {
    this.partyPanel = new BattlePartyPanel(config.party);
    this.enemyList.position.set(enemyWindow.contentX, enemyWindow.contentY);
    enemyWindow.addChild(this.enemyList);
  }

  createEnemySprites(): void {
    this.enemyView = new AiEnemyView(this.battle.allEnemies.map(e => e.data));
    for (const sprite of this.enemyView.build()) {
      this.mainContainer.addChild(sprite);
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
  }

  createPartySprites(): void {
    this.mainContainer.addChild(this.partyPanel.window);
    for (let i = 0; i < this.config.party.length; i++) {
      // M2: Party sprite at diagonal position
      const built = this.buildPartySprite(i);
      this.mainContainer.addChild(built.sprite);
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
    this.enemyView?.update(dt, this.enemySprites);
    const before = this.idleClock;
    this.idleClock += dt;
    if (this.partySprites.some((_, i) => idlePose(before, i) !== idlePose(this.idleClock, i))) this.refreshPoses();
    if (this.hurtTimers.size === 0) return;
    for (const [i, t] of this.hurtTimers) {
      if (t - dt <= 0) this.hurtTimers.delete(i); else this.hurtTimers.set(i, t - dt);
    }
    this.refreshPoses();
  }

  private poseFor(i: number): BattlePose {
    if (this.battle.allParty[i]?.currentHp <= 0) return 'down';
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
      sprite.texture = frames[BATTLE_POSES.indexOf(this.poseFor(i))];
    }
  }

  updatePartyDisplay(): void {
    // the left window lists the enemies; party HP is in the party panel
    this.partyPanel.refresh();
    this.updateEnemyList();
  }

  updateEnemyList(): void {
    for (const t of this.enemyListTexts) this.enemyList.removeChild(t);
    this.enemyListTexts = [];
    this.enemyNameToListIndex.clear();
    // BA-8: one line per species ("6x Goblin"), two columns past 5 lines; dead species grey. L1: no HP display.
    const entries = groupEnemies(this.battle.allEnemies);
    const cells = enemyListCells(entries.length, this.enemyWindow.contentWidth);
    entries.forEach((entry, i) => {
      const text = new BitmapText({
        text: entry.label,
        style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff },
      });
      if (entry.alive === 0) text.tint = DEAD_TINT;
      text.position.set(cells[i].x, cells[i].y);
      this.enemyList.addChild(text);
      this.enemyListTexts.push(text);
      this.enemyNameToListIndex.set(entry.name, i);
    });
  }

  /** The list line of an enemy's species, if listed. */
  listIndexFor(enemy: { data: { name: string } }): number | undefined {
    return this.enemyNameToListIndex.get(enemy.data.name);
  }

  updatePartySprites(): void {
    const party = this.battle.allParty;
    for (let i = 0; i < party.length; i++) {
      const sprite = this.partySprites[i];
      if (!sprite) continue;
      if (!this.partyFrames[i] && party[i].currentHp <= 0) {
        sprite.alpha = 0.3;
        sprite.tint = 0x666666;
      } else {
        sprite.alpha = 1.0;
        sprite.tint = 0xffffff;
      }
    }
    this.partyPanel.refresh();
    this.refreshPoses();
    this.updateEnemyList();
  }

  updateEnemySprites(dyingEnemies: Map<number, number>): void {
    const enemies = this.battle.allEnemies;
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i].currentHp <= 0 && this.enemySprites[i].visible && !dyingEnemies.has(i)) {
        dyingEnemies.set(i, 30);
      }
    }
  }

  /** Restore the grey tint on list lines whose whole species is dead. */
  updateEnemyListDeadTints(): void {
    for (const entry of groupEnemies(this.battle.allEnemies)) {
      const idx = this.enemyNameToListIndex.get(entry.name);
      if (entry.alive === 0 && idx !== undefined && this.enemyListTexts[idx]) this.enemyListTexts[idx].tint = DEAD_TINT;
    }
  }
}
