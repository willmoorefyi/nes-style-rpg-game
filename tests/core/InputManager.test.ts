/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputManager } from '../../src/core/InputManager.js';

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager();
    input.attach();
  });

  afterEach(() => {
    input.detach();
  });

  function pressKey(code: string): void {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  }

  function releaseKey(code: string): void {
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  }

  it('should detect pressed keys via isPressed', () => {
    pressKey('ArrowUp');
    expect(input.isPressed('up')).toBe(true);
  });

  it('should track isJustPressed for one frame only', () => {
    pressKey('KeyZ');
    expect(input.isJustPressed('confirm')).toBe(true);
    expect(input.isPressed('confirm')).toBe(true);

    input.update();
    expect(input.isJustPressed('confirm')).toBe(false);
    expect(input.isPressed('confirm')).toBe(true);
  });

  it('should track isJustReleased for one frame only', () => {
    pressKey('KeyX');
    input.update();

    releaseKey('KeyX');
    expect(input.isJustReleased('cancel')).toBe(true);
    expect(input.isPressed('cancel')).toBe(false);

    input.update();
    expect(input.isJustReleased('cancel')).toBe(false);
  });

  it('should allow configurable mappings via setMapping', () => {
    input.setMapping('Space', 'confirm');
    pressKey('Space');
    expect(input.isPressed('confirm')).toBe(true);
  });

  it('should support custom mappings in constructor', () => {
    input.detach();
    const custom = new InputManager({ KeyW: 'up', KeyS: 'down' });
    custom.attach();

    pressKey('KeyW');
    expect(custom.isPressed('up')).toBe(true);
    expect(custom.isPressed('down')).toBe(false);

    custom.detach();
  });

  it('should clear key state on detach', () => {
    pressKey('ArrowUp');
    expect(input.isPressed('up')).toBe(true);

    input.detach();
    input.attach();
    expect(input.isPressed('up')).toBe(false);
  });

  describe('NG-9: taps shorter than a frame', () => {
    it('registers a keydown and keyup that arrive between two updates', () => {
      pressKey('Enter');
      releaseKey('Enter');
      expect(input.isJustPressed('confirm')).toBe(true);
      expect(input.isPressed('confirm')).toBe(true);

      input.update();
      expect(input.isJustPressed('confirm')).toBe(false);
      expect(input.isPressed('confirm')).toBe(false);
    });

    it('does not re-trigger on a repeat keydown while held', () => {
      pressKey('Enter');
      input.update();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', repeat: true }));
      expect(input.isJustPressed('confirm')).toBe(false);
      expect(input.isPressed('confirm')).toBe(true);
    });

    it('detach empties the per-frame presses', () => {
      pressKey('ArrowDown');
      releaseKey('ArrowDown');
      input.detach();
      expect(input.isJustPressed('down')).toBe(false);
      expect(input.isPressed('down')).toBe(false);
      input.attach();
    });
  });

  describe('I1: focus loss releases held keys', () => {
    it('a key held while the window loses focus is released', () => {
      pressKey('ArrowRight');
      input.update();
      expect(input.isPressed('right')).toBe(true);
      window.dispatchEvent(new Event('blur'));
      expect(input.isPressed('right')).toBe(false);
      expect(input.isJustPressed('right')).toBe(false);
    });

    it('the page being hidden releases held keys', () => {
      pressKey('ArrowRight');
      input.update();
      const hidden = Object.getOwnPropertyDescriptor(document, 'hidden');
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      try {
        document.dispatchEvent(new Event('visibilitychange'));
      } finally {
        if (hidden) Object.defineProperty(document, 'hidden', hidden);
        else delete (document as { hidden?: boolean }).hidden;
      }
      expect(input.isPressed('right')).toBe(false);
    });

    it('a visibilitychange to visible keeps held keys', () => {
      pressKey('ArrowRight');
      document.dispatchEvent(new Event('visibilitychange'));
      expect(input.isPressed('right')).toBe(true);
    });
  });

  describe('holdOff (U2)', () => {
    it('after holdOff(8) a fresh press is not just-pressed for 8 updates, and is afterwards', () => {
      input.holdOff(8);
      for (let i = 0; i < 8; i++) {
        pressKey('KeyZ');
        expect(input.isJustPressed('confirm')).toBe(false);
        expect(input.isPressed('confirm')).toBe(true);
        releaseKey('KeyZ');
        input.update();
      }
      pressKey('KeyZ');
      expect(input.isJustPressed('confirm')).toBe(true);
    });

    it('holds a press for exactly the given number of update() calls', () => {
      input.holdOff(8);
      for (let i = 0; i < 7; i++) input.update();
      pressKey('KeyZ');
      expect(input.isJustPressed('confirm')).toBe(false);
      input.update();
      releaseKey('KeyZ');
      input.update();
      pressKey('KeyZ');
      expect(input.isJustPressed('confirm')).toBe(true);
    });

    it('spends a press already waiting when it is called', () => {
      pressKey('KeyZ');
      releaseKey('KeyZ');
      input.holdOff(1);
      input.update();
      expect(input.isJustPressed('confirm')).toBe(false);
    });

    it('a key held through the hold-off is not just-pressed afterwards', () => {
      pressKey('KeyZ');
      input.holdOff(8);
      for (let i = 0; i < 8; i++) input.update();
      expect(input.isPressed('confirm')).toBe(true);
      expect(input.isJustPressed('confirm')).toBe(false);
    });

    it('holds only the listed actions', () => {
      input.holdOff(5, ['confirm']);
      pressKey('KeyZ');
      pressKey('KeyX');
      expect(input.isJustPressed('confirm')).toBe(false);
      expect(input.isJustPressed('cancel')).toBe(true);
    });

    it('a second call keeps the larger remaining count', () => {
      input.holdOff(10);
      input.update();
      input.holdOff(2);
      for (let i = 0; i < 8; i++) input.update();
      pressKey('KeyZ');
      expect(input.isJustPressed('confirm')).toBe(false);
      input.update();
      releaseKey('KeyZ');
      pressKey('KeyZ');
      expect(input.isJustPressed('confirm')).toBe(true);
    });

    it('keeps the count per action: a later holdOff(8) does not widen a confirm-only holdOff(24) to every action', () => {
      input.holdOff(24, ['confirm']);
      input.holdOff(8);
      for (let i = 0; i < 8; i++) input.update();
      pressKey('KeyX');
      pressKey('KeyZ');
      expect(input.isJustPressed('cancel')).toBe(true);
      expect(input.isJustPressed('confirm')).toBe(false);
      releaseKey('KeyX');
      releaseKey('KeyZ');
      for (let i = 8; i < 23; i++) input.update();
      pressKey('KeyZ');
      expect(input.isJustPressed('confirm')).toBe(false);
      input.update();
      releaseKey('KeyZ');
      input.update();
      pressKey('KeyZ');
      expect(input.isJustPressed('confirm')).toBe(true);
    });
  });
});
