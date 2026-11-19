import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { ConfirmBox } from '../ui/ConfirmBox.js';

/**
 * A trader's Yes / No over the visible field (`transparent`): "Pay 40000 G for the Bottle?" with the party's gold.
 * Either answer closes the box and calls `onAnswer` (Yes pays through the field's trade code; No leaves everything
 * as it was, so the offer stands). The cursor starts on No (P3-R2).
 */
export class PurchaseScene implements Scene {
  readonly container = new Container();
  readonly transparent = true;
  private readonly box: ConfirmBox;
  private done = false;

  constructor(private readonly game: Game, prompt: string, private readonly onAnswer: (yes: boolean) => void) {
    this.box = new ConfirmBox({
      prompt: `${prompt}\nGold: ${game.party.gold} G`,
      eventBus: game.events,
      defaultNo: true, // P3-R2: the cursor starts on No, so mashing confirm through the pitch never pays
      onAnswer: (yes) => this.answer(yes),
    });
    this.container.addChild(this.box);
  }

  /** The question as shown (for tests). */
  get prompt(): string { return this.box.prompt; }

  /** Answer the question (the menu calls this; tests may too). */
  answer(yes: boolean): void {
    if (this.done) return;
    this.done = true;
    this.game.scenes.pop().then(() => this.onAnswer(yes)).catch((e) => console.error('Purchase close failed:', e));
  }

  enter(): void {}
  exit(): void {}
  onPause(): void {}
  onResume(): void {}

  update(_dt: number): void {
    if (!this.done) this.box.update(this.game.input);
  }
}
