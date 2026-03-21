import { describe, it, expect, beforeEach } from 'vitest';
import { InputManager } from '../../src/core/InputManager.js';

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager();
  });

  it('should use default mappings', () => {
    // Simulate keydown by accessing private state via type assertion
    const im = input as unknown as { currentKeys: Set<string>; mappings: Record<string, string> };
    im.currentKeys.add('ArrowUp');
    expect(input.isPressed('up')).toBe(true);
  });

  it('should track isJustPressed for one frame only', () => {
    const im = input as unknown as { currentKeys: Set<string> };
    
    // Frame 1: key pressed
    im.currentKeys.add('KeyZ');
    expect(input.isJustPressed('confirm')).toBe(true);
    expect(input.isPressed('confirm')).toBe(true);
    
    // Frame 2: after update, no longer justPressed
    input.update();
    expect(input.isJustPressed('confirm')).toBe(false);
    expect(input.isPressed('confirm')).toBe(true);
  });

  it('should track isJustReleased for one frame only', () => {
    const im = input as unknown as { currentKeys: Set<string> };
    
    // Press key
    im.currentKeys.add('KeyX');
    input.update();
    
    // Release key
    im.currentKeys.delete('KeyX');
    expect(input.isJustReleased('cancel')).toBe(true);
    expect(input.isPressed('cancel')).toBe(false);
    
    // After update, no longer justReleased
    input.update();
    expect(input.isJustReleased('cancel')).toBe(false);
  });

  it('should allow configurable mappings', () => {
    const im = input as unknown as { currentKeys: Set<string> };
    
    input.setMapping('Space', 'confirm');
    im.currentKeys.add('Space');
    expect(input.isPressed('confirm')).toBe(true);
  });

  it('should support custom mappings in constructor', () => {
    const custom = new InputManager({ KeyW: 'up', KeyS: 'down' });
    const im = custom as unknown as { currentKeys: Set<string> };
    
    im.currentKeys.add('KeyW');
    expect(custom.isPressed('up')).toBe(true);
    expect(custom.isPressed('down')).toBe(false);
  });
});