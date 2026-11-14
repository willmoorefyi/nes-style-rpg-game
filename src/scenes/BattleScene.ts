import { Container, Graphics, Sprite, Assets, type BitmapText, type Texture } from 'pixi.js';
import type { Scene, SpellData } from '../types/index.js';
import { type BattleSceneDeps, type BattleSceneConfig, type UIState } from './battle/BattleSceneTypes.js';
import { BattleDisplayManager } from './battle/BattleDisplayManager.js';
import { BattleFieldTargeting } from './battle/BattleFieldTargeting.js';
import { BattleAnimationController } from './battle/BattleAnimationController.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { TextRenderer } from '../ui/TextRenderer.js';
import { BossAI } from '../battle/BossAI.js';
import { BattleStateMachine } from '../battle/BattleStateMachine.js';
import type { BattleCommand } from '../battle/BattleCommands.js';
import { BattleListMenus, canOpenItems, canOpenSpells } from './battle/BattleListMenus.js';
import { GAME_WIDTH, GAME_HEIGHT, SCREEN_MARGIN } from '../core/LayoutConstants.js';
import { createPromptIndicator, destroyPromptIndicator } from './battle/battleMessageUtils.js';
import { ActiveHeroMarker } from './battle/ActiveHeroMarker.js';
import { BATTLE_MESSAGE_FONT, BATTLE_MESSAGE_LINE, BATTLE_MESSAGE_HEIGHT, STRIP_Y, STRIP_HEIGHT, ENEMY_WINDOW, COMMAND_WINDOW,
  FLOAT_OUTLINE } from './battle/BattleSceneTypes.js';

/** Frames after the command menu opens during which confirm is ignored, so mashing doesn't pick commands. */
export const COMMAND_CONFIRM_GUARD_FRAMES = 10;
/** Frames a one-off UI notice ("No spells available.") stays up before the menu returns. */
const NOTICE_FRAMES = 30;

export type { BattleSceneDeps, BattleSceneConfig } from './battle/BattleSceneTypes.js';

export class BattleScene implements Scene {
  readonly container = new Container();
  private deps: BattleSceneDeps;
  private battle: BattleStateMachine;
  private config: BattleSceneConfig;

  /** Bottom-left: the enemy list, or the spell / item list while one is open (BA-8). */
  private enemyWindow!: Window;
  private commandWindow!: Window;
  private messageWindow!: Window;
  private commandMenu!: Menu;
  private lists!: BattleListMenus;
  private spells: SpellData[] = [];
  private messageText!: TextRenderer;
  private display!: BattleDisplayManager;
  private targeting!: BattleFieldTargeting;
  private animation!: BattleAnimationController;

  private uiState: UIState = 'intro';
  private introTimer = 60;
  private messageTimer = 0;
  private currentMessageIndex = 0;
  private commandGuard = 0;
  private noticeTimer = 0;
  private endPrompt: BitmapText | null = null;
  private endPromptTimer = 0;
  private activeHero = new ActiveHeroMarker(this.container);
  // K4: Turn list in commandWindow during execution
  private turnListContainer = new Container();

  constructor(deps: BattleSceneDeps, config: BattleSceneConfig) {
    this.deps = deps;
    this.config = config;
    this.spells = config.spells ?? [];
    this.battle = new BattleStateMachine({ ...config, spells: this.spells, canRun: config.canRun }, config.rng);
    this.attachEnemyAi(config);
  }

  /** Debug scenarios can give enemies an action pattern (e.g. a boss that casts): BossAI per matching enemy. */
  private attachEnemyAi(config: BattleSceneConfig): void {
    if (!config.enemyAi) return;
    config.enemies.forEach((data, i) => {
      const actions = config.enemyAi?.[data.id];
      if (actions?.length) this.battle.setEnemyAI(i, new BossAI({ actions }));
    });
  }

  enter(): void {
    this.deps.audio?.playMusic(this.config.music ?? 'battle');
    // Two-tone battle background
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT / 2).fill(0x16213e);
    bg.rect(0, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT / 2).fill(0x1a1a2e);
    bg.rect(0, GAME_HEIGHT / 2 - 1, GAME_WIDTH, 2).fill(0x2a2a4e);
    this.container.addChildAt(bg, 0);

    // Battle stage background (screen-ready 1920x1080; overlays the solid-color fallback)
    if (this.config.background) {
      const path = this.config.background;
      Assets.load<Texture>(path).then((texture) => {
        const sprite = new Sprite(texture);
        const scale = Math.max(GAME_WIDTH / texture.width, GAME_HEIGHT / texture.height);
        sprite.scale.set(scale);
        sprite.x = (GAME_WIDTH - texture.width * scale) / 2;
        sprite.y = (GAME_HEIGHT - texture.height * scale) / 2;
        this.container.addChildAt(sprite, 1);
      }).catch((err) => console.warn('Failed to load battle background:', path, err));
    }

    this.createUI();
    this.display = new BattleDisplayManager(this.container, this.battle, this.config, this.enemyWindow);
    // late art swaps a placeholder for the real sprite: the active-hero marker moves with it
    this.display.onSpriteSwap = (old, next) => this.activeHero.replace(old, next);
    this.display.createEnemySprites();
    this.display.createPartySprites();
    this.display.updatePartyDisplay();
    const emit = (event: 'cursorMove' | 'cursorSelect' | 'cursorCancel' | 'battleHit' | 'battleMiss' | 'spellCast') => this.deps.events.emit(event, {});
    this.targeting = new BattleFieldTargeting(this.container, this.battle, this.display, this.deps.input, emit);
    this.animation = new BattleAnimationController(
      this.container, this.battle, this.display, this.deps.input,
      this.commandWindow, this.turnListContainer,
      (text: string) => this.messageText.setText(text, true),
      () => this.resolveRound(),
      emit,
    );
    this.lists = new BattleListMenus({
      battle: this.battle, config: this.config, spells: this.spells, events: this.deps.events, listWindow: this.enemyWindow,
      showNotice: (text) => this.showNotice(text),
      enterFieldTargeting: (isParty, revive, onConfirm, onCancel, initialId) => this.enterFieldTargeting(isParty, revive, onConfirm, onCancel, initialId),
      submit: (command) => this.submitAndContinue(command),
      setState: (state) => { this.uiState = state; },
      openList: (list) => this.openListWindow(list),
      closeList: (list) => this.closeListWindow(list),
    });
    this.battle.startBattle();
    this.uiState = 'intro';
    this.showMessages();
  }

  private createUI(): void {
    // BA-8 bottom strip: enemy list (left), command window (middle); the party panel (right) is the display's
    this.enemyWindow = new Window({ x: ENEMY_WINDOW.x, y: STRIP_Y, width: ENEMY_WINDOW.width, height: STRIP_HEIGHT });
    this.container.addChild(this.enemyWindow);
    this.commandWindow = new Window({ x: COMMAND_WINDOW.x, y: STRIP_Y, width: COMMAND_WINDOW.width, height: STRIP_HEIGHT });
    this.container.addChild(this.commandWindow);
    this.createCommandMenu();
    this.turnListContainer.visible = false;
    this.commandWindow.addChild(this.turnListContainer);
    // Message window — full width, top
    this.messageWindow = new Window({ x: 0, y: 0, width: GAME_WIDTH, height: BATTLE_MESSAGE_HEIGHT });
    this.container.addChild(this.messageWindow);
    this.messageText = new TextRenderer({
      width: GAME_WIDTH - SCREEN_MARGIN * 2, revealSpeed: 2,
      fontSize: BATTLE_MESSAGE_FONT, lineHeight: BATTLE_MESSAGE_LINE, style: { outline: FLOAT_OUTLINE },
    });
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
    this.display.update(dt);
    this.animation.updateFloatingTexts(dt);
    this.animation.updateDyingEnemies(dt);
    this.animation.updateSpellFlashes(dt);
    this.activeHero.update(dt);

    switch (this.uiState) {
      case 'intro':
        this.introTimer -= dt;
        if (this.introTimer <= 0 || this.deps.input.isJustPressed('confirm')) {
          this.battle.advanceFromIntro();
          this.startCommandPhase();
        }
        break;

      case 'command':
        if (this.commandGuard > 0) {
          this.commandGuard -= dt;
          if (!this.deps.input.isJustPressed('confirm')) this.commandMenu.update(this.deps.input);
        } else {
          this.commandMenu.update(this.deps.input);
        }
        break;

      case 'target':
        this.targeting.updateFieldTargeting();
        this.targeting.updateTargetVisuals();
        break;

      case 'spell_ui':
        this.lists.updateSpells(this.deps.input);
        break;

      case 'item_ui':
        this.lists.updateItems(this.deps.input);
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

      case 'notice':
        this.noticeTimer -= dt;
        if (this.noticeTimer <= 0 || this.deps.input.isJustPressed('confirm')) this.closeNotice();
        break;

      case 'end':
        this.endPromptTimer += dt;
        if (this.endPrompt) this.endPrompt.visible = Math.floor(this.endPromptTimer / 20) % 2 === 0;
        if (this.deps.input.isJustPressed('confirm')) {
          this.endBattle();
        }
        break;
    }
  }

  private startCommandPhase(): void {
    this.clearCommandIndicator();
    this.activeHero.hide();
    // K4: Hide turn list, show command menu
    this.turnListContainer.visible = false;
    const actor = this.battle.currentCommandActor;
    if (!actor) {
      this.display.partyPanel.setActive(-1);
      this.executeRound();
      return;
    }

    // BA-8: the active hero steps forward and pulses (always opaque); its panel row gets the cursor
    const index = parseInt(this.battle.currentCommandActorId!.split('_')[1]);
    const sprite = this.display.partySprites[index];
    if (sprite) this.activeHero.show(sprite);
    this.display.partyPanel.setActive(index);

    this.messageText.setText(`${actor.name}'s turn`, true);
    this.commandMenu.visible = true;
    // U14: Magic and Item are greyed for a member with nothing to cast or use (a greyed pick does nothing)
    this.commandMenu.setItemEnabled(1, canOpenSpells(actor));
    this.commandMenu.setItemEnabled(2, canOpenItems(this.config.inventory, (id) => this.battle.reservedItems(id)));
    this.commandMenu.setIndex(0);
    this.commandGuard = COMMAND_CONFIRM_GUARD_FRAMES;
    this.uiState = 'command';
  }

  /** A one-off message from the command menu; it never touches the battle's message list. */
  private showNotice(text: string): void {
    this.messageText.setText(text, true);
    this.noticeTimer = NOTICE_FRAMES;
    this.uiState = 'notice';
  }

  /** Back to the same actor's command menu, cursor where it was. */
  private closeNotice(): void {
    const index = this.commandMenu.selectedIndex;
    this.startCommandPhase();
    this.commandMenu.setIndex(index);
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
      this.lists.showSpells(actor);
    } else if (cmd === 'item') {
      this.clearCommandIndicator();
      this.lists.showItems();
    } else if (cmd === 'run') {
      this.battle.submitCommand({ type: 'run', actorId: this.battle.currentCommandActorId! });
      this.commandMenu.visible = false;
      this.startCommandPhase();
    }
  }

  /** A command from the Magic or Item list: submit it and go on to the next member. */
  private submitAndContinue(command: BattleCommand): void {
    this.battle.submitCommand(command);
    this.startCommandPhase();
  }

  /** BA-8: spell and item lists draw in the left window at full width, over the (hidden) enemy list. */
  private openListWindow(list: Container): void {
    this.display.enemyList.visible = false;
    this.enemyWindow.addChild(list);
    this.commandMenu.visible = false;
  }

  private closeListWindow(list: Container): void {
    this.enemyWindow.removeChild(list);
    this.display.enemyList.visible = true;
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
    // Restore alphas but respect dead member dimming (the active hero keeps its step and pulse until the turn ends)
    this.display.updatePartySprites();
    this.targeting.clearTargetArrow();
  }

  /** B10: while a target is chosen the active hero's arrow hides, so only the yellow target arrow shows. */
  private enterFieldTargeting(isParty: boolean, revive: boolean, onConfirm: (targetId: string) => void, onCancel: () => void,
    initialId?: string): void {
    const done = (f: () => void) => { this.activeHero.setArrowVisible(true); f(); };
    this.activeHero.setArrowVisible(false);
    if (this.targeting.enterFieldTargeting(isParty, revive, id => done(() => onConfirm(id)), () => done(onCancel), initialId)) {
      this.uiState = 'target';
    }
  }

  private executeRound(): void {
    this.commandMenu.visible = false;
    this.battle.prepareRound();
    // K4: Clear and show turn list
    this.animation.turnList.reset();
    this.turnListContainer.visible = true;
    // Clip turn list to command window content area
    if (!this.turnListContainer.mask) {
      const mask = new Graphics();
      mask.rect(0, 0, this.commandWindow.contentWidth, this.commandWindow.contentHeight).fill(0xffffff);
      mask.position.set(this.commandWindow.contentX, this.commandWindow.contentY);
      this.commandWindow.addChild(mask);
      this.turnListContainer.mask = mask;
    }
    // ST-6: round-start lines (a boss phase change) show before the first announcement, on the message timer
    if (this.battle.currentMessages.length > 0) {
      this.showMessages();
      return;
    }
    this.startActions();
  }

  private startActions(): void {
    this.uiState = 'executing';
    this.animation.animPhase = 'announce';
    this.animation.animTimer = 0;
  }

  private showMessages(): void {
    const messages = this.battle.currentMessages;
    if (messages.length === 0) {
      if (this.battle.isOver) this.checkBattleEnd(); else this.resolveRound();
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
    } else if (this.battle.isOver) {
      this.checkBattleEnd();
    } else if (this.battle.state === 'intro') {
      this.battle.advanceFromIntro();
      this.startCommandPhase();
    } else if (this.battle.state === 'execution') {
      this.startActions();
    } else if (this.battle.state === 'resolution') {
      this.resolveRound();
    } else if (this.battle.state === 'command_select') {
      this.startCommandPhase();
    }
  }

  private resolveRound(): void {
    this.battle.resolveRound();
    this.display.updatePartyDisplay();
    this.display.updateEnemySprites(this.animation.dyingEnemies);
    this.display.updatePartySprites();

    if (this.battle.isOver) {
      if (this.battle.outcome === 'victory') {
        this.deps.events.emit('battleVictory', {});
        this.display.setVictory();
        this.deps.audio?.playMusic('victory', false);
      }
      // the escape line was already shown with the action; go straight to the end screen
      if (this.battle.outcome === 'escaped') this.checkBattleEnd(); else this.showMessages();
    } else {
      this.startCommandPhase();
    }
  }

  private checkBattleEnd(): void {
    if (!this.battle.isOver) return;
    this.uiState = 'end';
    this.endPromptTimer = 0;
    if (!this.endPrompt) this.endPrompt = createPromptIndicator(this.messageWindow);
  }

  private endBattle(): void {
    const result = this.battle.battleResult;
    if (result) {
      this.deps.events.emit('battleEnd', {
        victory: result.victory,
        escaped: this.battle.outcome === 'escaped',
        xpReward: result.xpReward,
        goldReward: result.goldReward,
      });
    }
  }

  /** Read-only views for tests and tools (no private access needed). */
  get uiPhase(): string { return this.uiState; }
  get battleState(): string { return this.battle.state; }
  get outcome(): 'victory' | 'defeat' | 'escaped' | null { return this.battle.outcome; }
  get messageLine(): string { return this.messageText.text; }
  /** The battle message text (size checks). */
  get messageRenderer(): TextRenderer { return this.messageText; }
  /** Party battle sprites, in party order. */
  get partySprites(): readonly Container[] { return this.display.partySprites; }
  get partyPanel(): BattleDisplayManager['partyPanel'] { return this.display.partyPanel; }
  get enemyListLines(): readonly string[] { return this.display.enemyListTexts.map(t => t.text); }
  /** The item ids the open battle item list offers (B5). */
  get itemListIds(): readonly string[] { return this.lists.listedItemIds; }

  onPause(): void {}
  onResume(): void {}

  exit(): void {
    destroyPromptIndicator(this.endPrompt, this.messageWindow);
    this.endPrompt = null;
    this.activeHero.hide();
    this.container.removeChildren();
    this.lists?.closeAll();
  }
}
