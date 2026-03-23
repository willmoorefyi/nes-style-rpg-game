import { describe, it, expect, vi } from 'vitest';
import { QuantitySelectorUI } from '../../src/ui/QuantitySelector.js';

function createMockInput() {
  let pressed: string | null = null;
  return {
    isJustPressed: vi.fn((action: string) => action === pressed),
    press(action: string) { pressed = action; },
    clear() { pressed = null; },
  };
}

describe('QuantitySelectorUI', () => {
  it('starts at quantity 1', () => {
    const selector = new QuantitySelectorUI(0, 0, 10, vi.fn(), vi.fn());
    expect(selector.quantity).toBe(1);
  });

  describe('increment/decrement', () => {
    it('increments quantity', () => {
      const selector = new QuantitySelectorUI(0, 0, 10, vi.fn(), vi.fn());
      selector.increment();
      expect(selector.quantity).toBe(2);
    });

    it('decrements quantity', () => {
      const selector = new QuantitySelectorUI(0, 0, 10, vi.fn(), vi.fn());
      selector.increment();
      selector.increment();
      selector.decrement();
      expect(selector.quantity).toBe(2);
    });

    it('clamps quantity to min 1', () => {
      const selector = new QuantitySelectorUI(0, 0, 10, vi.fn(), vi.fn());
      selector.decrement();
      selector.decrement();
      expect(selector.quantity).toBe(1);
    });

    it('clamps quantity to max', () => {
      const selector = new QuantitySelectorUI(0, 0, 5, vi.fn(), vi.fn());
      for (let i = 0; i < 10; i++) selector.increment();
      expect(selector.quantity).toBe(5);
    });
  });

  describe('confirm/cancel', () => {
    it('confirm returns selected quantity and calls callback', () => {
      const onConfirm = vi.fn();
      const selector = new QuantitySelectorUI(0, 0, 10, onConfirm, vi.fn());
      selector.increment();
      selector.increment();
      const result = selector.confirm();
      expect(result).toBe(3);
      expect(onConfirm).toHaveBeenCalledWith(3);
    });

    it('cancel calls cancel callback', () => {
      const onCancel = vi.fn();
      const selector = new QuantitySelectorUI(0, 0, 10, vi.fn(), onCancel);
      selector.cancel();
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('update with input', () => {
    it('increments on right press', () => {
      const selector = new QuantitySelectorUI(0, 0, 10, vi.fn(), vi.fn());
      const input = createMockInput();
      input.press('right');
      selector.update(input as any);
      expect(selector.quantity).toBe(2);
    });

    it('decrements on left press', () => {
      const selector = new QuantitySelectorUI(0, 0, 10, vi.fn(), vi.fn());
      selector.increment();
      selector.increment();
      const input = createMockInput();
      input.press('left');
      selector.update(input as any);
      expect(selector.quantity).toBe(2);
    });

    it('confirms on confirm press', () => {
      const onConfirm = vi.fn();
      const selector = new QuantitySelectorUI(0, 0, 10, onConfirm, vi.fn());
      const input = createMockInput();
      input.press('confirm');
      selector.update(input as any);
      expect(onConfirm).toHaveBeenCalledWith(1);
    });

    it('cancels on cancel press', () => {
      const onCancel = vi.fn();
      const selector = new QuantitySelectorUI(0, 0, 10, vi.fn(), onCancel);
      const input = createMockInput();
      input.press('cancel');
      selector.update(input as any);
      expect(onCancel).toHaveBeenCalled();
    });
  });
});
