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
});
