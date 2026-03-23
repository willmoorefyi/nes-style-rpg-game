import { Container, Text, TextStyle, Graphics } from 'pixi.js';
import type { Scene, EnemyData, SpellData } from '../types/index.js';
import type { InputManager } from '../core/InputManager.js';
import type { EventBus } from '../core/EventBus.js';
import type { AudioManager } from '../core/AudioManager.js';
import type { Character } from '../entities/Character.js';
import type { Inventory } from '../entities/Inventory.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { TextRenderer } from '../ui/TextRenderer.js';
import { BattleStateMachine } from '../battle/BattleStateMachine.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { createItemCommand } from '../battle/BattleCommands.js';

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
}

type UIState = 'intro' | 'command' | 'target' | 'executing' | 'message' | 'end' | 'spell_level' | 'spell_select' | 'item_select' | 'item_target';

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
  private spellLevelMenu: Menu | null = null;
  private spellSelectMenu: Menu | null = null;
  private itemMenu: Menu | null = null;
  private currentSpellLevel = 0;
  private selectedSpellId: string | null = null;
  private selectedItemId: string | null = null;
  private spells: SpellData[] = [];
  private inventory: Inventory | undefined;
  private messageText!: TextRenderer;
  private enemySprites: Graphics[] = [];

  private uiState: UIState = 'intro';
  private introTimer = 60;
  private messageTimer = 0;
  private currentMessageIndex = 0;

  constructor(deps: BattleSceneDeps, config: BattleSceneConfig) {
    this.deps = deps;
    this.config = config;
    this.spells = config.spells ?? [];
    this.inventory = config.inventory;
    this.battle = new BattleStateMachine({ ...config, spells: this.spells, inventory: this.inventory });
  }

  enter(): void {
    this.deps.audio?.playMusic('battle');
    this.createUI();
    this.createEnemySprites();
    this.battle.startBattle();
    this.uiState = 'intro';
    this.showMessages();
  }

  private createUI(): void {
    this.partyWindow = new Window({ x: 0, y: 160, width: 128, height: 80 });
    this.container.addChild(this.partyWindow);
    this.updatePartyDisplay();

    this.commandWindow = new Window({ x: 128, y: 160, width: 128, height: 80 });
    this.container.addChild(this.commandWindow);
    this.createCommandMenu();

    this.messageWindow = new Window({ x: 0, y: 0, width: 256, height: 40 });
    this.container.addChild(this.messageWindow);
    this.messageText = new TextRenderer({ width: 240, revealSpeed: 2 });
    this.messageText.position.set(this.messageWindow.contentX, this.messageWindow.contentY);
    this.messageWindow.addChild(this.messageText);
  }

  private createCommandMenu(): void {
    const items: MenuItem[] = [
      { label: 'Fight', value: 'fight' },
      { label: 'Magic', value: 'magic' },
      { label: 'Item', value: 'item' },
      { label: 'Run', value: 'run' },
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
    const startX = 128 - (enemies.length * 20);
    for (let i = 0; i < enemies.length; i++) {
      const g = new Graphics();
      g.rect(0, 0, 32, 32).fill(0xff0000 + i * 0x003300);
      g.position.set(startX + i * 40, 60);
      this.container.addChild(g);
      this.enemySprites.push(g);
    }
  }

  private updatePartyDisplay(): void {
    const toRemove = this.partyWindow.children.filter(c => c instanceof Text);
    toRemove.forEach(c => this.partyWindow.removeChild(c));

    const style = new TextStyle({ fontFamily: 'monospace', fontSize: 8, fill: 0xffffff });
    this.config.party.forEach((char, i) => {
      const text = new Text({
        text: `${char.name.slice(0, 6).padEnd(6)} ${char.currentHp}/${char.maxHp}`,
        style,
      });
      text.position.set(this.partyWindow.contentX, this.partyWindow.contentY + i * 12);
      this.partyWindow.addChild(text);
    });
  }

  private updateEnemySprites(): void {
    const enemies = this.battle.allEnemies;
    for (let i = 0; i < enemies.length; i++) {
      this.enemySprites[i].visible = enemies[i].currentHp > 0;
    }
  }

  update(dt: number): void {
    this.messageText.update(dt);

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
        break;

      case 'target':
        if (this.targetMenu) this.targetMenu.update(this.deps.input);
        break;

      case 'spell_level':
        if (this.spellLevelMenu) this.spellLevelMenu.update(this.deps.input);
        break;

      case 'spell_select':
        if (this.spellSelectMenu) this.spellSelectMenu.update(this.deps.input);
        break;

      case 'item_select':
        if (this.itemMenu) this.itemMenu.update(this.deps.input);
        break;

      case 'item_target':
        if (this.targetMenu) this.targetMenu.update(this.deps.input);
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
    const actor = this.battle.currentCommandActor;
    if (!actor) {
      this.executeRound();
      return;
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
      this.showTargetMenu(actor.name);
    } else if (cmd === 'magic') {
      this.showSpellLevelMenu(actor);
    } else if (cmd === 'item') {
      this.showItemMenu();
    } else if (cmd === 'run') {
      this.battle.submitCommand({ type: 'run', actorId: actor.name });
      this.commandMenu.visible = false;
      this.startCommandPhase();
    }
  }

  private showSpellLevelMenu(actor: Character): void {
    const levelsWithCharges: number[] = [];
    for (let lvl = 1; lvl <= 8; lvl++) {
      if (actor.hasCharges(lvl) && actor.getSpellsAtLevel(lvl).length > 0) {
        levelsWithCharges.push(lvl);
      }
    }

    if (levelsWithCharges.length === 0) {
      this.messageText.setText('No spells available.', true);
      this.uiState = 'message';
      this.messageTimer = 30;
      this.currentMessageIndex = -1;
      return;
    }

    const items: MenuItem[] = levelsWithCharges.map(lvl => ({
      label: `Lv${lvl} (${actor.getSpellCharges(lvl)})`,
      value: String(lvl),
    }));

    if (this.spellLevelMenu) this.commandWindow.removeChild(this.spellLevelMenu);

    this.spellLevelMenu = new Menu({
      items,
      x: this.commandWindow.contentX,
      y: this.commandWindow.contentY,
      onSelect: (item) => {
        this.currentSpellLevel = parseInt(item.value);
        this.showSpellSelectMenu(actor);
      },
      onCancel: () => {
        this.hideSpellLevelMenu();
        this.uiState = 'command';
      },
      eventBus: this.deps.events,
    });
    this.commandWindow.addChild(this.spellLevelMenu);
    this.commandMenu.visible = false;
    this.uiState = 'spell_level';
  }

  private hideSpellLevelMenu(): void {
    if (this.spellLevelMenu) {
      this.commandWindow.removeChild(this.spellLevelMenu);
      this.spellLevelMenu = null;
    }
    this.commandMenu.visible = true;
  }

  private showSpellSelectMenu(actor: Character): void {
    const spellIds = actor.getSpellsAtLevel(this.currentSpellLevel);
    const items: MenuItem[] = spellIds.map(id => {
      const spell = this.spells.find(s => s.id === id);
      return { label: spell?.name ?? id, value: id };
    });

    if (this.spellSelectMenu) this.commandWindow.removeChild(this.spellSelectMenu);

    this.spellSelectMenu = new Menu({
      items,
      x: this.commandWindow.contentX,
      y: this.commandWindow.contentY,
      onSelect: (item) => {
        this.selectedSpellId = item.value;
        const spell = this.spells.find(s => s.id === item.value);
        if (spell?.targeting === 'all') {
          this.submitSpellCommand(actor.name, undefined);
        } else if (spell?.targeting === 'self') {
          this.submitSpellCommand(actor.name, actor.name);
        } else if (spell?.type === 'white' && spell?.effect === 'heal') {
          this.showPartyTargetMenu(actor.name);
        } else {
          this.showSpellTargetMenu(actor.name);
        }
      },
      onCancel: () => {
        this.hideSpellSelectMenu();
        this.uiState = 'spell_level';
      },
      eventBus: this.deps.events,
    });
    this.commandWindow.addChild(this.spellSelectMenu);
    if (this.spellLevelMenu) this.spellLevelMenu.visible = false;
    this.uiState = 'spell_select';
  }

  private hideSpellSelectMenu(): void {
    if (this.spellSelectMenu) {
      this.commandWindow.removeChild(this.spellSelectMenu);
      this.spellSelectMenu = null;
    }
    if (this.spellLevelMenu) this.spellLevelMenu.visible = true;
  }

  private showSpellTargetMenu(actorName: string): void {
    const enemies = this.battle.livingEnemies;
    const items: MenuItem[] = enemies.map(e => ({ label: e.data.name, value: e.id }));

    if (this.targetMenu) this.commandWindow.removeChild(this.targetMenu);

    this.targetMenu = new Menu({
      items,
      x: this.commandWindow.contentX,
      y: this.commandWindow.contentY,
      onSelect: (item) => this.submitSpellCommand(actorName, item.value),
      onCancel: () => {
        this.hideTargetMenu();
        this.uiState = 'spell_select';
      },
      eventBus: this.deps.events,
    });
    this.commandWindow.addChild(this.targetMenu);
    if (this.spellSelectMenu) this.spellSelectMenu.visible = false;
    this.uiState = 'target';
  }

  private showPartyTargetMenu(actorName: string): void {
    const items: MenuItem[] = this.config.party.map(c => ({ label: c.name, value: c.name }));

    if (this.targetMenu) this.commandWindow.removeChild(this.targetMenu);

    this.targetMenu = new Menu({
      items,
      x: this.commandWindow.contentX,
      y: this.commandWindow.contentY,
      onSelect: (item) => this.submitSpellCommand(actorName, item.value),
      onCancel: () => {
        this.hideTargetMenu();
        this.uiState = 'spell_select';
      },
      eventBus: this.deps.events,
    });
    this.commandWindow.addChild(this.targetMenu);
    if (this.spellSelectMenu) this.spellSelectMenu.visible = false;
    this.uiState = 'target';
  }

  private submitSpellCommand(actorName: string, targetId: string | undefined): void {
    if (this.selectedSpellId) {
      this.deps.events.emit('spellCast', {});
      this.battle.submitCommand({
        type: 'magic',
        actorId: actorName,
        targetId,
        spellId: this.selectedSpellId,
      });
    }
    this.cleanupSpellMenus();
    this.startCommandPhase();
  }

  private cleanupSpellMenus(): void {
    if (this.targetMenu) {
      this.commandWindow.removeChild(this.targetMenu);
      this.targetMenu = null;
    }
    if (this.spellSelectMenu) {
      this.commandWindow.removeChild(this.spellSelectMenu);
      this.spellSelectMenu = null;
    }
    if (this.spellLevelMenu) {
      this.commandWindow.removeChild(this.spellLevelMenu);
      this.spellLevelMenu = null;
    }
    this.selectedSpellId = null;
    this.commandMenu.visible = true;
  }

  private showItemMenu(): void {
    if (!this.inventory) {
      this.messageText.setText('No items available.', true);
      this.uiState = 'message';
      this.messageTimer = 30;
      this.currentMessageIndex = -1;
      return;
    }

    const consumables = this.inventory.getAll().filter(entry => {
      const item = ItemRegistry.getItem(entry.itemId);
      return item?.type === 'consumable';
    });

    if (consumables.length === 0) {
      this.messageText.setText('No items available.', true);
      this.uiState = 'message';
      this.messageTimer = 30;
      this.currentMessageIndex = -1;
      return;
    }

    const items: MenuItem[] = consumables.map(entry => {
      const item = ItemRegistry.getItem(entry.itemId);
      return { label: `${item?.name ?? entry.itemId} x${entry.quantity}`, value: entry.itemId };
    });

    if (this.itemMenu) {
      this.commandWindow.removeChild(this.itemMenu);
    }

    this.itemMenu = new Menu({
      items,
      x: this.commandWindow.contentX,
      y: this.commandWindow.contentY,
      maxVisible: 4,
      onSelect: (item) => {
        this.selectedItemId = item.value;
        this.showItemTargetMenu();
      },
      onCancel: () => {
        this.hideItemMenu();
        this.uiState = 'command';
      },
    });
    this.commandWindow.addChild(this.itemMenu);
    this.commandMenu.visible = false;
    this.uiState = 'item_select';
  }

  private hideItemMenu(): void {
    if (this.itemMenu) {
      this.commandWindow.removeChild(this.itemMenu);
      this.itemMenu = null;
    }
    this.commandMenu.visible = true;
  }

  private showItemTargetMenu(): void {
    const actor = this.battle.currentCommandActor;
    if (!actor) return;

    const items: MenuItem[] = this.config.party.map(c => ({ label: c.name, value: c.name }));

    if (this.targetMenu) {
      this.commandWindow.removeChild(this.targetMenu);
    }

    this.targetMenu = new Menu({
      items,
      x: this.commandWindow.contentX,
      y: this.commandWindow.contentY,
      onSelect: (item) => {
        this.submitItemCommand(actor.name, item.value);
      },
      onCancel: () => {
        this.hideTargetMenu();
        this.uiState = 'item_select';
        if (this.itemMenu) this.itemMenu.visible = true;
      },
    });
    this.commandWindow.addChild(this.targetMenu);
    if (this.itemMenu) this.itemMenu.visible = false;
    this.uiState = 'item_target';
  }

  private submitItemCommand(actorName: string, targetName: string): void {
    if (this.selectedItemId) {
      this.battle.submitCommand(createItemCommand(actorName, targetName, this.selectedItemId));
    }
    this.cleanupItemMenus();
    this.startCommandPhase();
  }

  private cleanupItemMenus(): void {
    if (this.targetMenu) {
      this.commandWindow.removeChild(this.targetMenu);
      this.targetMenu = null;
    }
    if (this.itemMenu) {
      this.commandWindow.removeChild(this.itemMenu);
      this.itemMenu = null;
    }
    this.selectedItemId = null;
    this.commandMenu.visible = true;
  }

  private showTargetMenu(actorName: string): void {
    const enemies = this.battle.livingEnemies;
    const items: MenuItem[] = enemies.map(e => ({ label: e.data.name, value: e.id }));

    if (this.targetMenu) this.commandWindow.removeChild(this.targetMenu);

    this.targetMenu = new Menu({
      items,
      x: this.commandWindow.contentX,
      y: this.commandWindow.contentY,
      onSelect: (item) => {
        this.battle.submitCommand({ type: 'fight', actorId: actorName, targetId: item.value });
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

  private executeRound(): void {
    this.uiState = 'executing';
    this.commandMenu.visible = false;
    this.battle.executeRound();
    this.updatePartyDisplay();
    this.updateEnemySprites();
    this.showMessages();
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

  exit(): void {
    this.container.removeChildren();
  }
}