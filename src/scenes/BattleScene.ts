import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import type { Scene, SpellData } from '../types/index.js';
import type { Character } from '../entities/Character.js';
import type { Inventory } from '../entities/Inventory.js';
import { type BattleSceneDeps, type BattleSceneConfig, type UIState } from './battle/BattleSceneTypes.js';
import { BattleDisplayManager } from './battle/BattleDisplayManager.js';
import { BattleFieldTargeting } from './battle/BattleFieldTargeting.js';
import { BattleAnimationController } from './battle/BattleAnimationController.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { TextRenderer } from '../ui/TextRenderer.js';
import { BattleStateMachine } from '../battle/BattleStateMachine.js';
import { createItemCommand } from '../battle/BattleCommands.js';
import { SpellSelectionUI } from '../ui/SpellSelectionUI.js';
import { ItemSelectionUI } from '../ui/ItemSelectionUI.js';
import { GAME_WIDTH, GAME_HEIGHT, SCREEN_MARGIN } from '../core/LayoutConstants.js';

export type { BattleSceneDeps, BattleSceneConfig } from './battle/BattleSceneTypes.js';

export class BattleScene implements Scene {
  readonly container = new Container();
  private deps: BattleSceneDeps;
  private battle: BattleStateMachine;
  private config: BattleSceneConfig;

  private partyWindow!: Window;
  private commandWindow!: Window;
  private messageWindow!: Window;
  private commandMenu!: Menu;
  private spellUI: SpellSelectionUI | null = null;
  private itemUI: ItemSelectionUI | null = null;
  private spells: SpellData[] = [];
  private inventory: Inventory | undefined;
  private messageText!: TextRenderer;
  private display!: BattleDisplayManager;
  private targeting!: BattleFieldTargeting;
  private animation!: BattleAnimationController;

  private uiState: UIState = 'intro';
  private introTimer = 60;
  private messageTimer = 0;
  private currentMessageIndex = 0;
  private commandArrow: Graphics | null = null;
  private flashTimer: number = 0;
  // K4: Turn list in commandWindow during execution
  private turnListContainer = new Container();

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

    // Load optional background image (overlays the solid-color fallback)
    if (this.config.background) {
      Assets.load(this.config.background).then((texture) => {
        const sprite = new Sprite(texture);
        const scaleX = GAME_WIDTH / sprite.texture.width;
        const scaleY = GAME_HEIGHT / sprite.texture.height;
        const scale = Math.max(scaleX, scaleY);
        sprite.scale.set(scale);
        sprite.x = (GAME_WIDTH - sprite.texture.width * scale) / 2;
        sprite.y = (GAME_HEIGHT - sprite.texture.height * scale) / 2;
        this.container.addChildAt(sprite, 1);
      }).catch(() => console.warn('Failed to load battle background:', this.config.background));
    }

    this.createUI();
    this.display = new BattleDisplayManager(this.container, this.battle, this.config, this.partyWindow);
    this.display.createEnemySprites();
    this.display.createPartySprites();
    this.display.updatePartyDisplay();
    this.targeting = new BattleFieldTargeting(this.container, this.battle, this.display, this.deps.input);
    this.animation = new BattleAnimationController(
      this.container, this.battle, this.config, this.display, this.deps.input,
      this.commandWindow, this.messageWindow, this.turnListContainer,
      (text: string) => this.messageText.setText(text, true),
      () => this.resolveRound(),
    );
    this.battle.startBattle();
    this.uiState = 'intro';
    this.showMessages();
  }

  private createUI(): void {
    // Party HP window — bottom-left
    this.partyWindow = new Window({ x: 0, y: GAME_HEIGHT - 300, width: GAME_WIDTH / 2, height: 300 });
    this.container.addChild(this.partyWindow);
    // Command window — bottom-right
    this.commandWindow = new Window({ x: GAME_WIDTH / 2, y: GAME_HEIGHT - 300, width: GAME_WIDTH / 2, height: 300 });
    this.container.addChild(this.commandWindow);
    this.createCommandMenu();
    this.turnListContainer.visible = false;
    this.commandWindow.addChild(this.turnListContainer);
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
      onCancel: () => this.undoPreviousCommand(),
      eventBus: this.deps.events,
    });
    this.commandWindow.addChild(this.commandMenu);
    this.commandMenu.visible = false;
  }

  update(dt: number): void {
    this.messageText.update(dt);
    this.animation.updateFloatingTexts(dt);
    this.animation.updateDyingEnemies(dt);
    this.animation.updateSpellFlashes(dt);

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
            const sprite = this.display.partySprites[idx];
            if (sprite) sprite.alpha = 0.5 + 0.5 * Math.sin(this.flashTimer * 0.15);
          }
        }
        break;

      case 'target':
        this.targeting.updateFieldTargeting();
        this.targeting.updateTargetVisuals();
        break;

      case 'spell_ui':
        if (this.spellUI) {
          this.spellUI.update(this.deps.input);
        }
        break;

      case 'item_ui':
        if (this.itemUI) {
          this.itemUI.update(this.deps.input);
        }
        break;

      case 'executing':
        this.animation.updateAnimating(dt);
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
    // K4: Hide turn list, show command menu
    this.turnListContainer.visible = false;
    const actor = this.battle.currentCommandActor;
    if (!actor) {
      this.executeRound();
      return;
    }

    // Create arrow indicator above the current actor's sprite
    const id = this.battle.currentCommandActorId!;
    const index = parseInt(id.split('_')[1]);
    const sprite = this.display.partySprites[index];
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

  /** Undo the previous character's command and go back to their turn. */
  private undoPreviousCommand(): void {
    if (this.battle.undoCommand()) {
      this.startCommandPhase();
    }
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
      onNeedTarget: (spellId, targetType) => {
        const isParty = targetType === 'single_ally';
        const spell = this.spells.find(s => s.id === spellId);
        const revive = spell?.effect === 'revive';
        this.enterFieldTargeting(isParty, revive, (targetId) => {
          this.deps.events.emit('spellCast', {});
          this.battle.submitCommand({
            type: 'magic',
            actorId,
            targetId,
            spellId,
          });
          this.cleanupSpellUI();
          this.startCommandPhase();
        }, () => {
          // Return to spell UI
          this.uiState = 'spell_ui';
        });
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
      onNeedTarget: (itemId) => {
        this.enterFieldTargeting(true, false, (targetId) => {
          this.battle.submitCommand(createItemCommand(actorId, targetId, itemId));
          this.cleanupItemUI();
          this.startCommandPhase();
        }, () => {
          // Return to item UI
          this.uiState = 'item_ui';
        });
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
    this.enterFieldTargeting(false, false, (targetId) => {
      this.battle.submitCommand({ type: 'fight', actorId, targetId });
      this.commandMenu.visible = true;
      this.startCommandPhase();
    }, () => {
      this.commandMenu.visible = true;
      this.uiState = 'command';
    });
    this.commandMenu.visible = false;
  }

  private clearCommandIndicator(): void {
    if (this.commandArrow) {
      this.container.removeChild(this.commandArrow);
      this.commandArrow = null;
    }
    this.flashTimer = 0;
    // Restore alphas but respect dead member dimming
    this.display.updatePartySprites();
    this.targeting.clearTargetArrow();
  }

  private enterFieldTargeting(isParty: boolean, revive: boolean, onConfirm: (targetId: string) => void, onCancel: () => void): void {
    if (this.targeting.enterFieldTargeting(isParty, revive, onConfirm, onCancel)) {
      this.uiState = 'target';
    }
  }

  private executeRound(): void {
    this.commandMenu.visible = false;
    this.battle.prepareRound();
    // K4: Clear and show turn list
    this.turnListContainer.removeChildren();
    this.turnListContainer.y = 0;
    this.animation.turnListTexts = [];
    this.animation.turnActionIndex = 0;
    this.turnListContainer.visible = true;
    // Clip turn list to command window content area
    if (!this.turnListContainer.mask) {
      const mask = new Graphics();
      mask.rect(0, 0, this.commandWindow.contentWidth, this.commandWindow.contentHeight).fill(0xffffff);
      mask.position.set(this.commandWindow.contentX, this.commandWindow.contentY);
      this.commandWindow.addChild(mask);
      this.turnListContainer.mask = mask;
    }
    this.uiState = 'executing';
    this.animation.animPhase = 'announce';
    this.animation.animTimer = 0;
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
    this.display.updatePartyDisplay();
    this.display.updateEnemySprites(this.animation.dyingEnemies);
    this.display.updatePartySprites();

    if (this.battle.state === 'victory' || this.battle.state === 'defeat') {
      if (this.battle.state === 'victory') {
        this.deps.events.emit('battleVictory', {});
        this.deps.audio?.playMusic('victory', false);
      }
      this.showMessages();
    } else {
      this.startCommandPhase();
    }
  }

  private checkBattleEnd(): void {
    if (this.battle.state === 'victory' || this.battle.state === 'defeat') {
      this.uiState = 'end';
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
    this.spellUI = null;
    this.itemUI = null;
    this.commandArrow = null;
  }
}
