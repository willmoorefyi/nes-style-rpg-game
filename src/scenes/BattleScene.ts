import { Container, Text, TextStyle, Graphics } from 'pixi.js';
import type { Scene, EnemyData } from '../types/index.js';
import type { Game } from '../core/Game.js';
import type { Character } from '../entities/Character.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { TextRenderer } from '../ui/TextRenderer.js';
import { BattleStateMachine, type BattleResult } from '../battle/BattleStateMachine.js';

export interface BattleSceneConfig {
  party: Character[];
  enemies: EnemyData[];
}

type UIState = 'intro' | 'command' | 'target' | 'executing' | 'message' | 'end';

export class BattleScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private battle: BattleStateMachine;
  private config: BattleSceneConfig;

  private partyWindow!: Window;
  private commandWindow!: Window;
  private messageWindow!: Window;
  private commandMenu!: Menu;
  private targetMenu!: Menu | null;
  private messageText!: TextRenderer;
  private enemySprites: Graphics[] = [];

  private uiState: UIState = 'intro';
  private introTimer = 60;
  private messageTimer = 0;
  private currentMessageIndex = 0;

  constructor(game: Game, config: BattleSceneConfig) {
    this.game = game;
    this.config = config;
    this.battle = new BattleStateMachine(config);
  }

  enter(): void {
    this.createUI();
    this.createEnemySprites();
    this.battle.startBattle();
    this.uiState = 'intro';
    this.showMessages();
  }

  private createUI(): void {
    // Party stats window (bottom-left)
    this.partyWindow = new Window({ x: 0, y: 160, width: 128, height: 80 });
    this.container.addChild(this.partyWindow);
    this.updatePartyDisplay();

    // Command window (bottom-right)
    this.commandWindow = new Window({ x: 128, y: 160, width: 128, height: 80 });
    this.container.addChild(this.commandWindow);
    this.createCommandMenu();

    // Message window (top)
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
    // Remove old text
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
        if (this.introTimer <= 0 || this.game.input.isJustPressed('confirm')) {
          this.battle.advanceFromIntro();
          this.startCommandPhase();
        }
        break;

      case 'command':
        this.commandMenu.update(this.game.input);
        break;

      case 'target':
        if (this.targetMenu) this.targetMenu.update(this.game.input);
        break;

      case 'message':
        this.messageTimer -= dt;
        if (this.messageTimer <= 0 || this.game.input.isJustPressed('confirm')) {
          this.advanceMessage();
        }
        break;

      case 'end':
        if (this.game.input.isJustPressed('confirm')) {
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
      this.messageText.setText('No spells available.', true);
      this.uiState = 'message';
      this.messageTimer = 30;
      this.currentMessageIndex = -1;
    } else if (cmd === 'item') {
      this.messageText.setText('No items available.', true);
      this.uiState = 'message';
      this.messageTimer = 30;
      this.currentMessageIndex = -1;
    } else if (cmd === 'run') {
      this.battle.submitCommand({ type: 'run', actorId: actor.name });
      this.commandMenu.visible = false;
      this.startCommandPhase();
    }
  }

  private showTargetMenu(actorName: string): void {
    const enemies = this.battle.livingEnemies;
    const items: MenuItem[] = enemies.map(e => ({ label: e.data.name, value: e.id }));

    if (this.targetMenu) {
      this.commandWindow.removeChild(this.targetMenu);
    }

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
      // Still in intro, wait for advance
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
      this.game.events.emit('battleEnd', {
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
