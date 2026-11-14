import { Container, BitmapText, Graphics } from 'pixi.js';
import type { Scene, ShopData } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';
import { NES_FONT } from '../ui/NESFont.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_SIZE, CHAR_WIDTH } from '../core/LayoutConstants.js';

type InnState = 'confirm' | 'notice' | 'fade_in' | 'hold' | 'fade_out' | 'done';

/** Frames the "not enough gold" notice stays up before closing on its own. */
export const INN_NOTICE_FRAMES = 90;
/** Frames for each half of the rest fade (to black, and back). */
export const INN_FADE_FRAMES = 20;
/** Frames the black screen holds "Your party rests..." before fading back. */
export const INN_HOLD_FRAMES = 60;

const textStyle = { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff };

/**
 * The inn: a Yes/No box over the visible town (`transparent`), the party's gold, a notice when the
 * party can't pay, and a fade to black while the party rests (HP, charges and status restored).
 */
export class InnScene implements Scene {
  readonly container = new Container();
  readonly transparent = true;
  private game: Game;
  private price: number;
  private state: InnState = 'confirm';
  private window: Window;
  private menu?: Menu;
  private goldText?: BitmapText;
  private overlay?: Graphics;
  private messageText?: BitmapText;
  private timer = 0;

  constructor(game: Game, shopData: ShopData) {
    this.game = game;
    this.price = shopData.innPrice ?? 100;
    this.window = new Window({ x: (GAME_WIDTH - 600) / 2, y: (GAME_HEIGHT - 300) / 2, width: 600, height: 300 });
    this.container.addChild(this.window);
    this.showConfirm();
  }

  /** The current state, for tests and debugging. */
  get phase(): InnState { return this.state; }

  /** The gold line shown under the question. */
  get goldLabel(): string { return this.goldText?.text ?? ''; }

  /** The notice or rest message currently shown, or ''. */
  get message(): string { return this.messageText?.text ?? ''; }

  private showConfirm(): void {
    const label = new BitmapText({ text: `Stay for ${this.price} G?`, style: textStyle });
    label.position.set(this.window.contentX, this.window.contentY);
    this.window.addChild(label);

    this.goldText = new BitmapText({ text: `Gold: ${this.game.party.gold} G`, style: textStyle });
    this.goldText.position.set(this.window.contentX, this.window.contentY + 40);
    this.window.addChild(this.goldText);

    this.menu = new Menu({
      items: [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ],
      x: this.window.contentX,
      y: this.window.contentY + 100,
      onSelect: (item) => this.onSelect(item.value),
      onCancel: () => this.game.scenes.pop(),
      eventBus: this.game.events,
    });
    this.window.addChild(this.menu);
  }

  private onSelect(value: string): void {
    if (value === 'no') {
      this.game.scenes.pop();
      return;
    }
    if (!this.game.party.spendGold(this.price)) {
      this.showWindowMessage("You don't have enough gold.");
      this.state = 'notice';
      return;
    }
    // The inn restores everyone, the fallen included (T5 decision 2): status first, then HP.
    for (const member of this.game.party.all) {
      member.statusTracker.clear();
      member.currentHp = member.maxHp;
      member.restoreAllCharges();
    }
    this.startRest();
  }

  /** Replace the window's contents (question, gold, menu) with one line. */
  private showWindowMessage(text: string): void {
    if (this.menu) {
      this.window.removeChild(this.menu);
      this.menu = undefined;
    }
    while (this.window.children.length > 1) {
      this.window.removeChildAt(1);
    }
    this.messageText = new BitmapText({ text, style: textStyle });
    this.messageText.position.set(this.window.contentX, this.window.contentY + 48);
    this.window.addChild(this.messageText);
    this.timer = 0;
  }

  private startRest(): void {
    this.showWindowMessage('Your party rests...');
    this.overlay = new Graphics().rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(0x000000);
    this.overlay.alpha = 0;
    this.container.addChild(this.overlay);
    this.state = 'fade_in';
  }

  enter(): void {}

  update(dt: number): void {
    switch (this.state) {
      case 'confirm':
        this.menu?.update(this.game.input);
        return;
      case 'notice':
        this.timer += dt;
        if (this.timer > INN_NOTICE_FRAMES || this.game.input.isJustPressed('confirm')) {
          this.close();
        }
        return;
      case 'fade_in':
        this.timer += dt;
        this.setOverlayAlpha(this.timer / INN_FADE_FRAMES);
        if (this.timer >= INN_FADE_FRAMES) {
          // Black screen: show the message on top, hide the box so the fade back reveals the town.
          this.window.visible = false;
          if (this.messageText) {
            this.window.removeChild(this.messageText);
            this.messageText.position.set((GAME_WIDTH - this.messageText.text.length * CHAR_WIDTH) / 2, GAME_HEIGHT / 2 - FONT_SIZE / 2);
            this.container.addChild(this.messageText);
          }
          this.state = 'hold';
          this.timer = 0;
        }
        return;
      case 'hold':
        this.timer += dt;
        if (this.timer >= INN_HOLD_FRAMES || this.game.input.isJustPressed('confirm')) {
          if (this.messageText) this.messageText.visible = false;
          this.state = 'fade_out';
          this.timer = 0;
        }
        return;
      case 'fade_out':
        this.timer += dt;
        this.setOverlayAlpha(1 - this.timer / INN_FADE_FRAMES);
        if (this.timer >= INN_FADE_FRAMES) {
          this.close();
        }
        return;
      case 'done':
        return;
    }
  }

  private close(): void {
    this.state = 'done';
    this.game.scenes.pop();
  }

  private setOverlayAlpha(a: number): void {
    if (this.overlay) this.overlay.alpha = Math.max(0, Math.min(1, a));
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {}
}
