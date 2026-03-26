import { Container, BitmapText, Graphics } from 'pixi.js';
import type { Scene, EnemyData, SpellData } from '../types/index.js';
import type { InputManager } from '../core/InputManager.js';
import type { EventBus } from '../core/EventBus.js';
import type { AudioManager } from '../core/AudioManager.js';
import type { Character } from '../entities/Character.js';
import type { Inventory } from '../entities/Inventory.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { TextRenderer } from '../ui/TextRenderer.js';
import { BattleStateMachine, type DamageEvent } from '../battle/BattleStateMachine.js';
import { createItemCommand } from '../battle/BattleCommands.js';
import { SpellSelectionUI } from '../ui/SpellSelectionUI.js';
import { ItemSelectionUI } from '../ui/ItemSelectionUI.js';
import { NES_FONT } from '../ui/NESFont.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_SIZE, SCREEN_MARGIN } from '../core/LayoutConstants.js';

const ENEMY_COLORS: Record<string, number> = {
  goblin: 0x228b22,    // green
  wolf: 0x808080,      // gray
  skeleton: 0xd4d4d4,  // bone white
  pirate: 0x8b4513,    // brown
  garland: 0x4b0082,   // dark purple
  zombie: 0x556b2f,    // olive
  ogre: 0xb22222,      // dark red
  vampire: 0x800020,   // burgundy
  lich: 0x191970,      // midnight blue
  kraken: 0x006994,    // teal
  tiamat: 0x8b0000,    // crimson
  chaos: 0x1a1a1a,     // near-black
};
const DEFAULT_ENEMY_COLOR = 0xff4444;

export interface BattleSceneDeps {
  input: InputManager;
  events: EventBus;
  audio?: AudioManager;
}

export interface BattleSceneConfig {
  party: Character[];
  enemies: EnemyData[];
  spells?: SpellData[];
  inventory?: Inventory;
  /** Whether the party can run from this battle (default true) */
  canRun?: boolean;
}

type UIState = 'intro' | 'command' | 'target' | 'executing' | 'message' | 'end' | 'spell_ui' | 'item_ui' | 'animating';

export class BattleScene implements Scene {
  readonly container = new Container();
  private deps: BattleSceneDeps;
  private battle: BattleStateMachine;
  private config: BattleSceneConfig;

  private partyWindow!: Window;
  private commandWindow!: Window;
  private messageWindow!: Window;
  private commandMenu!: Menu;
  private targetMenu!: Menu | null;
  private spellUI: SpellSelectionUI | null = null;
  private itemUI: ItemSelectionUI | null = null;
  private spells: SpellData[] = [];
  private inventory: Inventory | undefined;
  private messageText!: TextRenderer;
  private enemySprites: Graphics[] = [];
  private partySprites: Graphics[] = [];

  private uiState: UIState = 'intro';
  private introTimer = 60;
  private messageTimer = 0;
  private currentMessageIndex = 0;
  private floatingTexts: { text: BitmapText; age: number; maxAge: number }[] = [];
  private dyingEnemies: Map<number, number> = new Map();
  private spellFlashes: { overlay: Graphics; age: number; maxAge: number }[] = [];
  private commandArrow: Graphics | null = null;
  private targetArrow: Graphics | null = null;
  private flashTimer: number = 0;
  private animPhase: 'announce' | 'step_forward' | 'execute' | 'result' | 'step_back' = 'announce';
  private animTimer: number = 0;
  private animActorSprite: Graphics | null = null;
  private animActorOrigX: number = 0;
  private animTargetX: number = 0;
  private animMessages: { text: string }[] = [];
  private animMessageIndex: number = 0;

  constructor(deps: BattleSceneDeps, config: BattleSceneConfig) {
    this.deps = deps;
    this.config = config;
    this.spells = config.spells ?? [];
    this.inventory = config.inventory;
    this.battle = new BattleStateMachine({
      ...config,
      spells: this.spells,
      inventory: this.inventory,
      canRun: config.canRun,
    });
  }

  enter(): void {
    this.deps.audio?.playMusic('battle');

    // Two-tone battle background
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT / 2).fill(0x16213e);
    bg.rect(0, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT / 2).fill(0x1a1a2e);
    bg.rect(0, GAME_HEIGHT / 2 - 1, GAME_WIDTH, 2).fill(0x2a2a4e);
    this.container.addChildAt(bg, 0);

    this.createUI();
    this.createEnemySprites();
    this.createPartySprites();
    this.battle.startBattle();
    this.uiState = 'intro';
    this.showMessages();
  }

  private createUI(): void {
    // Party HP window — bottom-left
    this.partyWindow = new Window({ x: 0, y: GAME_HEIGHT - 300, width: GAME_WIDTH / 2, height: 300 });
    this.container.addChild(this.partyWindow);
    this.updatePartyDisplay();

    // Command window — bottom-right
    this.commandWindow = new Window({ x: GAME_WIDTH / 2, y: GAME_HEIGHT - 300, width: GAME_WIDTH / 2, height: 300 });
    this.container.addChild(this.commandWindow);
    this.createCommandMenu();

    // Message window — full width, top
    this.messageWindow = new Window({ x: 0, y: 0, width: GAME_WIDTH, height: 120 });
    this.container.addChild(this.messageWindow);
    this.messageText = new TextRenderer({ width: GAME_WIDTH - SCREEN_MARGIN * 2, revealSpeed: 2 });
    this.messageText.position.set(this.messageWindow.contentX, this.messageWindow.contentY);
    this.messageWindow.addChild(this.messageText);
  }

  private createCommandMenu(): void {
    const canRun = this.config.canRun ?? true;
    const items: MenuItem[] = [
      { label: 'Fight', value: 'fight' },
      { label: 'Magic', value: 'magic' },
      { label: 'Item', value: 'item' },
      { label: 'Run', value: 'run', enabled: canRun },
    ];
    this.commandMenu = new Menu({
      items,
      x: this.commandWindow.contentX,
      y: this.commandWindow.contentY,
      onSelect: (item) => this.onCommandSelect(item.value),
      eventBus: this.deps.events,
    });
    this.commandWindow.addChild(this.commandMenu);
    this.commandMenu.visible = false;
  }

  private createEnemySprites(): void {
    const enemies = this.battle.allEnemies;
    const isBossBattle = this.config.canRun === false;
    // Center enemies horizontally around x=350, vertically around y=450
    const totalHeight = (enemies.length - 1) * 120;
    const startY = 450 - totalHeight / 2;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const color = ENEMY_COLORS[enemy.data.name.toLowerCase()] ?? DEFAULT_ENEMY_COLOR;
      const isBoss = isBossBattle || !!enemy.data.bossPhases;
      const size = isBoss ? 128 : 96;
      const g = new Graphics();
      g.rect(0, 0, size, size).fill(color);
      g.position.set(350 - size / 2, startY + i * 120);
      this.container.addChild(g);
      this.enemySprites.push(g);
    }
  }

  private createPartySprites(): void {
    const colors = [0x4488ff, 0xff4444, 0x44ff44, 0xffff44];
    const yPositions = [250, 380, 510, 640];
    for (let i = 0; i < this.config.party.length; i++) {
      const g = new Graphics();
      g.rect(0, 0, 64, 64).fill(colors[i % colors.length]);
      g.position.set(1500, yPositions[i]);
      this.container.addChild(g);
      this.partySprites.push(g);
    }
  }

  private updatePartyDisplay(): void {
    const toRemove = this.partyWindow.children.filter(c => c instanceof BitmapText);
    toRemove.forEach(c => this.partyWindow.removeChild(c));

    this.config.party.forEach((char, i) => {
      const text = new BitmapText({
        text: `${char.name.slice(0, 6).padEnd(6)} ${char.currentHp}/${char.maxHp}`,
        style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff },
      });
      text.position.set(this.partyWindow.contentX, this.partyWindow.contentY + i * (FONT_SIZE + 12));
      this.partyWindow.addChild(text);
    });
  }

  private updatePartySprites(): void {
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
    }
  }

  private updateEnemySprites(): void {
    const enemies = this.battle.allEnemies;
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i].currentHp <= 0 && this.enemySprites[i].visible && !this.dyingEnemies.has(i)) {
        this.dyingEnemies.set(i, 30);
      }
    }
  }

  update(dt: number): void {
    this.messageText.update(dt);
    this.updateFloatingTexts(dt);
    this.updateDyingEnemies(dt);
    this.updateSpellFlashes(dt);

    switch (this.uiState) {
      case 'intro':
        this.introTimer -= dt;
        if (this.introTimer <= 0 || this.deps.input.isJustPressed('confirm')) {
          this.battle.advanceFromIntro();
          this.startCommandPhase();
        }
        break;

      case 'command':
        this.commandMenu.update(this.deps.input);
        this.flashTimer++;
        {
          const id = this.battle.currentCommandActorId;
          if (id) {
            const idx = parseInt(id.split('_')[1]);
            const sprite = this.partySprites[idx];
            if (sprite) sprite.alpha = 0.5 + 0.5 * Math.sin(this.flashTimer * 0.15);
          }
        }
        break;

      case 'target':
        if (this.targetMenu) {
          const idx = this.targetMenu.selectedIndex;
          this.targetMenu.update(this.deps.input);
          if (this.targetMenu) {
            this.updateTargetArrow([], false, idx);
          } else {
            this.clearTargetArrow();
          }
        }
        break;

      case 'spell_ui':
        if (this.spellUI) {
          const wasTargeting = this.spellUI.isTargeting;
          const tgtParty = this.spellUI.isTargetingParty;
          const tgtIdx = this.spellUI.targetIndex;
          this.spellUI.update(this.deps.input);
          if (this.spellUI && wasTargeting && this.spellUI.isTargeting) {
            this.updateTargetArrow([], tgtParty, tgtIdx);
          } else {
            this.clearTargetArrow();
          }
        }
        break;

      case 'item_ui':
        if (this.itemUI) {
          const wasTargeting = this.itemUI.isTargeting;
          const tgtIdx = this.itemUI.targetIndex;
          this.itemUI.update(this.deps.input);
          if (this.itemUI && wasTargeting && this.itemUI.isTargeting) {
            this.updateTargetArrow([], true, tgtIdx);
          } else {
            this.clearTargetArrow();
          }
        }
        break;

      case 'executing':
        this.updateAnimating(dt);
        break;

      case 'message':
        this.messageTimer -= dt;
        if (this.messageTimer <= 0 || this.deps.input.isJustPressed('confirm')) {
          this.advanceMessage();
        }
        break;

      case 'end':
        if (this.deps.input.isJustPressed('confirm')) {
          this.endBattle();
        }
        break;
    }
  }

  private startCommandPhase(): void {
    this.clearCommandIndicator();
    const actor = this.battle.currentCommandActor;
    if (!actor) {
      this.executeRound();
      return;
    }

    // Create arrow indicator above the current actor's sprite
    const id = this.battle.currentCommandActorId!;
    const index = parseInt(id.split('_')[1]);
    const sprite = this.partySprites[index];
    if (sprite) {
      const arrow = new Graphics();
      arrow.moveTo(0, 0).lineTo(16, 0).lineTo(8, 16).lineTo(0, 0).fill(0xffffff);
      arrow.position.set(sprite.x + (sprite.width - 16) / 2, sprite.y - 20);
      this.container.addChild(arrow);
      this.commandArrow = arrow;
    }

    this.messageText.setText(`${actor.name}'s turn`, true);
    this.commandMenu.visible = true;
    this.commandMenu.setIndex(0);
    this.uiState = 'command';
  }

  private onCommandSelect(cmd: string): void {
    const actor = this.battle.currentCommandActor;
    if (!actor) return;

    if (cmd === 'fight') {
      this.clearCommandIndicator();
      this.showTargetMenu();
    } else if (cmd === 'magic') {
      this.clearCommandIndicator();
      this.showSpellUI(actor);
    } else if (cmd === 'item') {
      this.clearCommandIndicator();
      this.showItemUI(actor);
    } else if (cmd === 'run') {
      this.battle.submitCommand({ type: 'run', actorId: this.battle.currentCommandActorId! });
      this.commandMenu.visible = false;
      this.startCommandPhase();
    }
  }

  private showSpellUI(actor: Character): void {
    const actorId = this.battle.currentCommandActorId!;
    const enemies = this.battle.livingEnemies.map(e => ({ id: e.id, name: e.displayName }));
    const partyMembers = this.config.party.map((c, i) => ({ name: c.name, id: `party_${i}`, hp: c.currentHp }));
    let hasSpells = false;
    for (let lvl = 1; lvl <= 8; lvl++) {
      if (actor.hasCharges(lvl) && actor.getSpellsAtLevel(lvl).length > 0) {
        hasSpells = true;
        break;
      }
    }

    if (!hasSpells) {
      this.messageText.setText('No spells available.', true);
      this.uiState = 'message';
      this.messageTimer = 30;
      this.currentMessageIndex = -1;
      return;
    }

    this.spellUI = new SpellSelectionUI({
      character: actor,
      actorId,
      spells: this.spells,
      enemies,
      partyMembers,
      contentX: this.commandWindow.contentX,
      contentY: this.commandWindow.contentY,
      eventBus: this.deps.events,
      onSelect: (result) => {
        this.deps.events.emit('spellCast', {});
        this.battle.submitCommand({
          type: 'magic',
          actorId,
          targetId: result.targetId,
          spellId: result.spellId,
        });
        this.cleanupSpellUI();
        this.startCommandPhase();
      },
      onCancel: () => {
        this.cleanupSpellUI();
        this.uiState = 'command';
      },
    });
    this.commandWindow.addChild(this.spellUI);
    this.commandMenu.visible = false;
    this.uiState = 'spell_ui';
  }

  private cleanupSpellUI(): void {
    if (this.spellUI) {
      this.commandWindow.removeChild(this.spellUI);
      this.spellUI = null;
    }
    this.commandMenu.visible = true;
  }

  private showItemUI(_actor: Character): void {
    if (!this.inventory) {
      this.messageText.setText('No items available.', true);
      this.uiState = 'message';
      this.messageTimer = 30;
      this.currentMessageIndex = -1;
      return;
    }

    const actorId = this.battle.currentCommandActorId!;
    const partyMembers = this.config.party.map((c, i) => ({ name: c.name, id: `party_${i}` }));

    this.itemUI = new ItemSelectionUI({
      inventory: this.inventory,
      partyMembers,
      contentX: this.commandWindow.contentX,
      contentY: this.commandWindow.contentY,
      eventBus: this.deps.events,
      onSelect: (result) => {
        this.battle.submitCommand(createItemCommand(actorId, result.targetName, result.itemId));
        this.cleanupItemUI();
        this.startCommandPhase();
      },
      onCancel: () => {
        this.cleanupItemUI();
        this.uiState = 'command';
      },
    });

    // Check if there are no consumables
    if (this.itemUI.hasNoItems()) {
      this.cleanupItemUI();
      this.messageText.setText('No items available.', true);
      this.uiState = 'message';
      this.messageTimer = 30;
      this.currentMessageIndex = -1;
      return;
    }

    this.commandWindow.addChild(this.itemUI);
    this.commandMenu.visible = false;
    this.uiState = 'item_ui';
  }

  private cleanupItemUI(): void {
    if (this.itemUI) {
      this.commandWindow.removeChild(this.itemUI);
      this.itemUI = null;
    }
    this.commandMenu.visible = true;
  }

  private showTargetMenu(): void {
    const actorId = this.battle.currentCommandActorId!;
    const enemies = this.battle.livingEnemies;
    const items: MenuItem[] = enemies.map(e => ({ label: e.displayName, value: e.id }));

    if (this.targetMenu) this.commandWindow.removeChild(this.targetMenu);

    this.targetMenu = new Menu({
      items,
      x: this.commandWindow.contentX,
      y: this.commandWindow.contentY,
      onSelect: (item) => {
        this.battle.submitCommand({ type: 'fight', actorId, targetId: item.value });
        this.hideTargetMenu();
        this.startCommandPhase();
      },
      onCancel: () => {
        this.hideTargetMenu();
        this.uiState = 'command';
      },
      eventBus: this.deps.events,
    });
    this.commandWindow.addChild(this.targetMenu);
    this.commandMenu.visible = false;
    this.uiState = 'target';
  }

  private hideTargetMenu(): void {
    if (this.targetMenu) {
      this.commandWindow.removeChild(this.targetMenu);
      this.targetMenu = null;
    }
    this.commandMenu.visible = true;
  }

  private clearCommandIndicator(): void {
    if (this.commandArrow) {
      this.container.removeChild(this.commandArrow);
      this.commandArrow = null;
    }
    this.flashTimer = 0;
    // Restore alphas but respect dead member dimming
    this.updatePartySprites();
    this.clearTargetArrow();
  }

  /** Show/update an arrow above the currently highlighted target sprite */
  private updateTargetArrow(_ids: string[], isParty: boolean, selectedIndex: number): void {
    this.clearTargetArrow();
    if (selectedIndex < 0) return;
    const sprites = isParty ? this.partySprites : this.enemySprites;
    // Map the menu index to the sprite index
    if (isParty) {
      // Party menu items are living party members; sprites are indexed by party position
      const living = this.battle.allParty.filter(c => c.currentHp > 0);
      const char = living[selectedIndex];
      if (!char) return;
      const spriteIdx = this.battle.allParty.indexOf(char);
      if (spriteIdx < 0 || spriteIdx >= sprites.length) return;
      const sprite = sprites[spriteIdx];
      const arrow = new Graphics();
      arrow.poly([0, 0, 16, 0, 8, 12]).fill(0xffffff);
      arrow.position.set(sprite.x + 24, sprite.y - 20);
      this.container.addChild(arrow);
      this.targetArrow = arrow;
    } else {
      // Enemy menu items map to living enemies
      const living = this.battle.livingEnemies;
      const enemy = living[selectedIndex];
      if (!enemy) return;
      const spriteIdx = this.battle.allEnemies.indexOf(enemy);
      if (spriteIdx < 0 || spriteIdx >= sprites.length) return;
      const sprite = sprites[spriteIdx];
      const arrow = new Graphics();
      arrow.poly([0, 0, 16, 0, 8, 12]).fill(0xffffff);
      arrow.position.set(sprite.x + 40, sprite.y - 20);
      this.container.addChild(arrow);
      this.targetArrow = arrow;
    }
  }

  private clearTargetArrow(): void {
    if (this.targetArrow) {
      this.container.removeChild(this.targetArrow);
      this.targetArrow = null;
    }
  }

  private executeRound(): void {
    this.commandMenu.visible = false;
    this.battle.prepareRound();
    this.uiState = 'executing';
    this.animPhase = 'announce';
    this.animTimer = 0;
  }

  private findActorSprite(actorName: string): { sprite: Graphics; isEnemy: boolean } | null {
    for (let i = 0; i < this.config.party.length; i++) {
      if (this.config.party[i].name === actorName) return { sprite: this.partySprites[i], isEnemy: false };
    }
    const enemies = this.battle.allEnemies;
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i].displayName === actorName && enemies[i].currentHp > 0) return { sprite: this.enemySprites[i], isEnemy: true };
    }
    return null;
  }

  private formatAnnouncement(info: { actorName: string; actionType: string; targetName?: string; spellName?: string }): string {
    switch (info.actionType) {
      case 'fight': return `${info.actorName} attacks ${info.targetName ?? 'enemy'}!`;
      case 'magic': return `${info.actorName} casts ${info.spellName ?? 'spell'}!`;
      case 'item': return `${info.actorName} uses item!`;
      case 'run': return `${info.actorName} tries to run!`;
      default: return `${info.actorName} acts!`;
    }
  }

  private updateAnimating(dt: number): void {
    const confirmSkip = this.deps.input.isJustPressed('confirm');
    switch (this.animPhase) {
      case 'announce': {
        if (this.animTimer === 0) {
          const info = this.battle.peekNextAction();
          if (!info) {
            this.resolveRound();
            return;
          }
          this.messageText.setText(this.formatAnnouncement(info), true);
          const found = this.findActorSprite(info.actorName);
          this.animActorSprite = found?.sprite ?? null;
          if (this.animActorSprite) {
            this.animActorOrigX = this.animActorSprite.x;
            this.animTargetX = found!.isEnemy ? 700 : 900;
          }
        }
        this.animTimer += dt;
        if (this.animTimer >= 30 || confirmSkip) {
          this.animTimer = 0;
          this.animPhase = 'step_forward';
        }
        break;
      }

      case 'step_forward': {
        this.animTimer += dt;
        if (confirmSkip) this.animTimer = 15;
        const progress = Math.min(this.animTimer / 15, 1);
        if (this.animActorSprite) {
          this.animActorSprite.x = this.animActorOrigX + (this.animTargetX - this.animActorOrigX) * progress;
        }
        if (this.animTimer >= 15) {
          this.animTimer = 0;
          this.animPhase = 'execute';
        }
        break;
      }

      case 'execute': {
        const result = this.battle.executeNextAction();
        this.spawnFloatingTextsFromEvents(result.damageEvents);
        this.updatePartyDisplay();
        this.updateEnemySprites();
        this.updatePartySprites();
        this.animMessages = result.messages;
        this.animMessageIndex = 0;
        this.animTimer = 0;
        this.animPhase = 'result';
        break;
      }

      case 'result': {
        if (this.animMessages.length > 0 && this.animMessageIndex < this.animMessages.length) {
          if (this.animTimer === 0) {
            this.messageText.setText(this.animMessages[this.animMessageIndex].text, true);
          }
          this.animTimer += dt;
          if (this.animTimer >= 45 || confirmSkip) {
            this.animMessageIndex++;
            this.animTimer = 0;
            if (this.animMessageIndex >= this.animMessages.length) {
              this.animPhase = 'step_back';
            }
          }
        } else {
          this.animPhase = 'step_back';
          this.animTimer = 0;
        }
        break;
      }

      case 'step_back': {
        this.animTimer += dt;
        if (confirmSkip) this.animTimer = 15;
        const progress = Math.min(this.animTimer / 15, 1);
        if (this.animActorSprite) {
          this.animActorSprite.x = this.animTargetX + (this.animActorOrigX - this.animTargetX) * progress;
        }
        if (this.animTimer >= 15) {
          if (this.animActorSprite) this.animActorSprite.x = this.animActorOrigX;
          this.animTimer = 0;
          this.animActorSprite = null;
          if (this.battle.actionQueueLength > 0) {
            this.animPhase = 'announce';
          } else {
            this.resolveRound();
          }
        }
        break;
      }
    }
  }

  private spawnFloatingTextsFromEvents(damageEvents: DamageEvent[]): void {
    for (const evt of damageEvents) {
      let sprite: Graphics | undefined;
      if (evt.targetId.startsWith('enemy_')) {
        const idx = parseInt(evt.targetId.split('_')[1], 10);
        sprite = this.enemySprites[idx];
      } else {
        const idx = parseInt(evt.targetId.split('_')[1], 10);
        sprite = this.partySprites[idx];
      }
      if (!sprite) continue;

      // Spell flash overlay
      if (evt.spellElement) {
        const color = BattleScene.ELEMENT_COLORS[evt.spellElement] ?? 0xffffff;
        const overlay = new Graphics();
        overlay.rect(0, 0, sprite.width, sprite.height).fill(color);
        overlay.position.set(sprite.x, sprite.y);
        overlay.alpha = 0.6;
        this.container.addChild(overlay);
        this.spellFlashes.push({ overlay, age: 0, maxAge: 18 });
      }

      const fill = evt.isHeal ? 0x44ff44 : evt.isCrit ? 0xff4444 : 0xffffff;
      const label = evt.isHeal ? `+${evt.damage}` : `${evt.damage}`;
      const bt = new BitmapText({
        text: label,
        style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill },
      });
      bt.position.set(sprite.x, sprite.y);
      this.container.addChild(bt);
      this.floatingTexts.push({ text: bt, age: 0, maxAge: 48 });
    }
  }

  private showMessages(): void {
    const messages = this.battle.currentMessages;
    if (messages.length === 0) {
      this.resolveRound();
      return;
    }
    this.currentMessageIndex = 0;
    this.messageText.setText(messages[0].text, true);
    this.messageTimer = 45;
    this.uiState = 'message';
  }

  private advanceMessage(): void {
    const messages = this.battle.currentMessages;
    this.currentMessageIndex++;
    if (this.currentMessageIndex < messages.length) {
      this.messageText.setText(messages[this.currentMessageIndex].text, true);
      this.messageTimer = 45;
    } else if (this.battle.state === 'intro') {
      this.battle.advanceFromIntro();
      this.startCommandPhase();
    } else if (this.battle.state === 'resolution') {
      this.resolveRound();
    } else if (this.battle.state === 'command_select') {
      this.startCommandPhase();
    } else {
      this.checkBattleEnd();
    }
  }

  private resolveRound(): void {
    this.battle.resolveRound();
    this.updatePartyDisplay();
    this.updateEnemySprites();
    this.updatePartySprites();

    if (this.battle.state === 'victory' || this.battle.state === 'defeat') {
      if (this.battle.state === 'victory') {
        this.deps.events.emit('battleVictory', {});
        this.deps.audio?.playMusic('victory', false);
      }
      this.showMessages();
      this.uiState = 'end';
    } else {
      this.startCommandPhase();
    }
  }

  private checkBattleEnd(): void {
    if (this.battle.state === 'victory' || this.battle.state === 'defeat') {
      this.uiState = 'end';
    }
  }


  private static readonly ELEMENT_COLORS: Record<string, number> = {
    fire: 0xff4400, ice: 0x4488ff, lightning: 0xffff00, holy: 0xffffff,
    dark: 0x660066, water: 0x0066ff, earth: 0x886622, wind: 0x88ff88, heal: 0x44ff44,
  };

  private updateFloatingTexts(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.age += dt;
      ft.text.y -= 1 * dt;
      ft.text.alpha = 1 - ft.age / ft.maxAge;
      if (ft.age >= ft.maxAge) {
        this.container.removeChild(ft.text);
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private updateDyingEnemies(dt: number): void {
    for (const [idx, remaining] of this.dyingEnemies) {
      const next = remaining - dt;
      if (next <= 0) {
        this.enemySprites[idx].alpha = 0;
        this.enemySprites[idx].visible = false;
        this.dyingEnemies.delete(idx);
      } else {
        this.enemySprites[idx].alpha = next / 30;
        this.dyingEnemies.set(idx, next);
      }
    }
  }

  private updateSpellFlashes(dt: number): void {
    for (let i = this.spellFlashes.length - 1; i >= 0; i--) {
      const sf = this.spellFlashes[i];
      sf.age += dt;
      sf.overlay.alpha = 0.6 * (1 - sf.age / sf.maxAge);
      if (sf.age >= sf.maxAge) {
        this.container.removeChild(sf.overlay);
        this.spellFlashes.splice(i, 1);
      }
    }
  }

  private endBattle(): void {
    const result = this.battle.battleResult;
    if (result) {
      this.deps.events.emit('battleEnd', {
        victory: result.victory,
        xpReward: result.xpReward,
        goldReward: result.goldReward,
      });
    }
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {
    this.container.removeChildren();
    // Null out UI references for GC
    this.targetMenu = null;
    this.spellUI = null;
    this.itemUI = null;
    this.commandArrow = null;
  }
}
