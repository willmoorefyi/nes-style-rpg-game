import { Container, Text, TextStyle } from 'pixi.js';
import type { InputManager } from '../core/InputManager.js';

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
  private qtyText: Text;

  constructor(x: number, y: number, max: number, onConfirm: (qty: number) => void, onCancel: () => void) {
    super();
    this.position.set(x, y);
    this.max = Math.max(1, max);
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;

    const style = new TextStyle({ fontFamily: 'monospace', fontSize: 8, fill: 0xffffff });
    
    const minus = new Text({ text: '-', style });
    minus.position.set(0, 0);
    this.addChild(minus);

    this.qtyText = new Text({ text: '1', style });
    this.qtyText.position.set(12, 0);
    this.addChild(this.qtyText);

    const plus = new Text({ text: '+', style });
    plus.position.set(36, 0);
    this.addChild(plus);
  }

  get quantity(): number {
    return this._quantity;
  }

  increment(amount = 1): void {
    this._quantity = Math.min(this.max, this._quantity + amount);
    this.qtyText.text = String(this._quantity);
  }

  decrement(amount = 1): void {
    this._quantity = Math.max(1, this._quantity - amount);
    this.qtyText.text = String(this._quantity);
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
