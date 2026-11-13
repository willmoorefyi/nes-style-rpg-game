import { Container, BitmapText, Graphics, Sprite, Texture } from 'pixi.js';
import type { BattleStateMachine } from '../../battle/BattleStateMachine.js';
import type { BattleSceneConfig } from './BattleSceneTypes.js';
import { Window } from '../../ui/Window.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { FONT_SIZE, FONT_SIZE_SM } from '../../core/LayoutConstants.js';
import { battleArt } from '../../rendering/BattleArt.js';
import { AiEnemyView } from './AiEnemyView.js';
import { BATTLE_POSES, characterAtlas, type BattlePose } from '../../rendering/CharacterAtlas.js';

const HURT_FRAMES = 24;
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
  private hurtTimers = new Map<number, number>();
  private victory = false;
  // K2: Character status boxes behind party sprites
  readonly statusBoxes: Window[] = [];
  // K3: Enemy list texts in partyWindow
  enemyListTexts: BitmapText[] = [];
  // L2: Deduped enemy name -> list text index
  readonly enemyNameToListIndex: Map<string, number> = new Map();

  constructor(
    private readonly mainContainer: Container,
    private readonly battle: BattleStateMachine,
    private readonly config: BattleSceneConfig,
    private readonly partyWindow: Window,
  ) {}

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
    // Status boxes: 4 boxes each 25% of battle field height (660px / 4 = 165px)
    const battleFieldTop = 120;
    const boxHeight = 165;
    const boxWidth = 200;
    const boxX = 1700;

    for (let i = 0; i < this.config.party.length; i++) {
      const char = this.config.party[i];

      // Character status box — stacked vertically on right edge
      const boxY = battleFieldTop + i * boxHeight;
      const box = new Window({ x: boxX, y: boxY, width: boxWidth, height: boxHeight });
      const nameText = new BitmapText({
        text: char.name,
        style: { fontFamily: NES_FONT, fontSize: FONT_SIZE_SM, fill: 0xffffff },
      });
      nameText.position.set(box.contentX, box.contentY);
      box.addChild(nameText);

      const statusText = new BitmapText({
        text: '',
        style: { fontFamily: NES_FONT, fontSize: FONT_SIZE_SM, fill: 0xffff44 },
      });
      statusText.position.set(box.contentX, box.contentY + 40);
      box.addChild(statusText);

      const hpText = new BitmapText({
        text: `${char.currentHp}/${char.maxHp}`,
        style: { fontFamily: NES_FONT, fontSize: FONT_SIZE_SM, fill: 0xffffff },
      });
      hpText.position.set(box.contentX, box.contentY + 100);
      box.addChild(hpText);

      this.mainContainer.addChild(box);
      this.statusBoxes.push(box);

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
    return this.hurtTimers.has(i) ? 'hurt' : 'ready';
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
    // K3: partyWindow now shows enemy list instead of party HP
    this.updateEnemyList();
  }

  updateEnemyList(): void {
    // Remove old enemy list texts
    for (const t of this.enemyListTexts) this.partyWindow.removeChild(t);
    this.enemyListTexts = [];
    this.enemyNameToListIndex.clear();

    // L2: Group enemies by displayName, preserving first-seen order
    const enemies = this.battle.allEnemies;
    const nameOrder: string[] = [];
    const counts = new Map<string, number>();
    for (const e of enemies) {
      const n = e.displayName;
      if (!counts.has(n)) nameOrder.push(n);
      counts.set(n, (counts.get(n) ?? 0) + (e.currentHp > 0 ? 1 : 0));
    }

    for (let i = 0; i < nameOrder.length; i++) {
      const name = nameOrder[i];
      const alive = counts.get(name)!;
      // L1: No HP display. L2: prefix with count if >1
      const label = alive === 0 ? name : alive > 1 ? `${alive}x ${name}` : name;
      const text = new BitmapText({
        text: label,
        style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff },
      });
      if (alive === 0) text.tint = 0x888888;
      text.position.set(this.partyWindow.contentX, this.partyWindow.contentY + i * (FONT_SIZE + 12));
      this.partyWindow.addChild(text);
      this.enemyListTexts.push(text);
      this.enemyNameToListIndex.set(name, i);
    }
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

      // K2: Update status box texts
      const box = this.statusBoxes[i];
      if (box) {
        const texts = box.children.filter(c => c instanceof BitmapText) as BitmapText[];
        // texts[0]=name, texts[1]=status, texts[2]=hp
        if (texts[1]) {
          const statuses = party[i].statusTracker.getAll().map(s => s.effect);
          texts[1].text = statuses.join(' ');
        }
        if (texts[2]) {
          texts[2].text = `${party[i].currentHp}/${party[i].maxHp}`;
        }
      }
    }
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

  /** Restore gray tint on enemy list entries where all enemies of that name are dead */
  updateEnemyListDeadTints(): void {
    const enemies = this.battle.allEnemies;
    const aliveCounts = new Map<string, number>();
    for (const e of enemies) {
      const n = e.displayName;
      aliveCounts.set(n, (aliveCounts.get(n) ?? 0) + (e.currentHp > 0 ? 1 : 0));
    }
    for (const [name, idx] of this.enemyNameToListIndex) {
      if ((aliveCounts.get(name) ?? 0) === 0 && this.enemyListTexts[idx]) {
        this.enemyListTexts[idx].tint = 0x888888;
      }
    }
  }
}
