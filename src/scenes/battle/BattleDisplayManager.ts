import { Container, BitmapText, Graphics } from 'pixi.js';
import type { BattleStateMachine } from '../../battle/BattleStateMachine.js';
import type { BattleSceneConfig } from './BattleSceneTypes.js';
import { computeEnemyLayout, ENEMY_COLORS, DEFAULT_ENEMY_COLOR } from './BattleLayoutEngine.js';
import { Window } from '../../ui/Window.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { FONT_SIZE, FONT_SIZE_SM } from '../../core/LayoutConstants.js';

export class BattleDisplayManager {
  readonly enemySprites: Graphics[] = [];
  readonly partySprites: Graphics[] = [];
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
    const enemies = this.battle.allEnemies;
    const positions = computeEnemyLayout(enemies.map(e => e.data));
    for (let i = 0; i < enemies.length; i++) {
      const { x, y, w, h } = positions[i];
      const color = ENEMY_COLORS[enemies[i].data.name.toLowerCase()] ?? DEFAULT_ENEMY_COLOR;
      const g = new Graphics();
      g.rect(0, 0, w, h).fill(color);
      g.position.set(x - w / 2, y - h / 2);
      this.mainContainer.addChild(g);
      this.enemySprites.push(g);
    }
  }

  createPartySprites(): void {
    const colors = [0x4488ff, 0xff4444, 0x44ff44, 0xffff44];
    // N1: Right-aligned diagonal party sprite layout
    const xPositions = [1450, 1475, 1500, 1525];
    const yPositions = [280, 380, 480, 580];
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
      const g = new Graphics();
      g.rect(0, 0, 64, 64).fill(colors[i % colors.length]);
      g.position.set(xPositions[i], yPositions[i]);
      this.mainContainer.addChild(g);
      this.partySprites.push(g);
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
      if (party[i].currentHp <= 0) {
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
