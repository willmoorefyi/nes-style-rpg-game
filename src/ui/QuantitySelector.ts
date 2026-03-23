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
