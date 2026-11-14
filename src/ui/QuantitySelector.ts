import { Container, BitmapText } from 'pixi.js';
import type { InputManager } from '../core/InputManager.js';
import { NES_FONT } from './NESFont.js';
import { FONT_SIZE } from '../core/LayoutConstants.js';

/**
 * QuantitySelector interface for future buy/sell quantity UI.
 * Defines contract for quantity selection in shop menus.
 */
export interface QuantitySelector {
  /** Increment quantity by 1 (or amount) */
  increment(amount?: number): void;
  /** Decrement quantity by 1 (or amount) */
  decrement(amount?: number): void;
  /** Confirm selection and return quantity */
  confirm(): number;
  /** Cancel selection */
  cancel(): void;
  /** Get current quantity */
  readonly quantity: number;
}

export class QuantitySelectorUI extends Container implements QuantitySelector {
  private _quantity = 1;
  private max: number;
  private onConfirm: (qty: number) => void;
  private onCancel: () => void;
  private qtyText: BitmapText;
  private unitPrice?: number;
  private totalText?: BitmapText;

  /**
   * `unitPrice` (optional): when given, the picker reads `Qty - N +   Total: X G` and the total
   * follows the quantity.
   */
  constructor(
    x: number, y: number, max: number,
    onConfirm: (qty: number) => void, onCancel: () => void,
    unitPrice?: number,
  ) {
    super();
    this.position.set(x, y);
    this.max = Math.max(1, max);
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
    this.unitPrice = unitPrice;

    const style = { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff };
    // With a price the picker gets a "Qty" label in front, so the -/N/+ group shifts right.
    const x0 = unitPrice !== undefined ? 84 : 0;

    if (unitPrice !== undefined) {
      const label = new BitmapText({ text: 'Qty', style });
      label.position.set(0, 0);
      this.addChild(label);
    }

    const minus = new BitmapText({ text: '-', style });
    minus.position.set(x0, 0);
    this.addChild(minus);

    this.qtyText = new BitmapText({ text: '1', style });
    this.qtyText.position.set(x0 + 36, 0);
    this.addChild(this.qtyText);

    const plus = new BitmapText({ text: '+', style });
    plus.position.set(x0 + 96, 0);
    this.addChild(plus);

    if (unitPrice !== undefined) {
      this.totalText = new BitmapText({ text: '', style });
      this.totalText.position.set(x0 + 180, 0);
      this.addChild(this.totalText);
    }
    this.refresh();
  }

  get quantity(): number {
    return this._quantity;
  }

  /** The total shown next to the quantity (`Total: X G`), or '' when there is no unit price. */
  get totalLabel(): string {
    return this.totalText?.text ?? '';
  }

  increment(amount = 1): void {
    this._quantity = Math.min(this.max, this._quantity + amount);
    this.refresh();
  }

  decrement(amount = 1): void {
    this._quantity = Math.max(1, this._quantity - amount);
    this.refresh();
  }

  private refresh(): void {
    this.qtyText.text = String(this._quantity);
    if (this.totalText && this.unitPrice !== undefined) {
      this.totalText.text = `Total: ${this.unitPrice * this._quantity} G`;
    }
  }

  confirm(): number {
    this.onConfirm(this._quantity);
    return this._quantity;
  }

  cancel(): void {
    this.onCancel();
  }

  update(input: InputManager): void {
    if (input.isJustPressed('right') || input.isJustPressed('up')) {
      this.increment();
    } else if (input.isJustPressed('left') || input.isJustPressed('down')) {
      this.decrement();
    } else if (input.isJustPressed('confirm')) {
      this.confirm();
    } else if (input.isJustPressed('cancel')) {
      this.cancel();
    }
  }
}
