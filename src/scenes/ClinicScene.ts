import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { ConfirmBox } from '../ui/ConfirmBox.js';
import { clinicPrompt, clinicQuote, clinicRevive } from '../systems/clinic.js';

/**
 * The clinic's question (GAP-16): a Yes / No box over the visible town (`transparent`). Yes revives every fallen
 * member for the quoted gold (`clinicRevive`); either answer closes the box and hands the lines to show to `onDone`
 * (the field shows them in its dialog box).
 */
export class ClinicScene implements Scene {
  readonly container = new Container();
  readonly transparent = true;
  private readonly box: ConfirmBox;
  private done = false;

  constructor(private readonly game: Game, private readonly price: number, private readonly onDone: (lines: string[]) => void) {
    const quote = clinicQuote(game.party.all, price);
    this.box = new ConfirmBox({
      prompt: `${clinicPrompt(quote)}\nGold: ${game.party.gold} G`,
      eventBus: game.events,
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
    const lines = yes ? clinicRevive(this.game.party, this.price).lines : ['Come back if you need us.'];
    this.game.scenes.pop().then(() => this.onDone(lines)).catch((e) => console.error('Clinic close failed:', e));
  }

  enter(): void {}
  exit(): void {}
  onPause(): void {}
  onResume(): void {}

  update(_dt: number): void {
    if (!this.done) this.box.update(this.game.input);
  }
}
