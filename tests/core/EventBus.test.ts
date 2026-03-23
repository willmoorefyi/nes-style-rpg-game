import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';

describe('EventBus', () => {
  it('should call listener when event is emitted', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    
    bus.on('sceneChange', callback);
    bus.emit('sceneChange', { from: null, to: 'boot' });
    
    expect(callback).toHaveBeenCalledWith({ from: null, to: 'boot' });
  });

  it('should support multiple listeners', () => {
    const bus = new EventBus();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    
    bus.on('battleStart', cb1);
    bus.on('battleStart', cb2);
    bus.emit('battleStart', { enemies: ['goblin'] });
    
    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  it('should remove listener with off', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    
    bus.on('menuOpen', callback);
    bus.off('menuOpen', callback);
    bus.emit('menuOpen', { menu: 'inventory' });
    
    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle emit with no listeners', () => {
    const bus = new EventBus();
    expect(() => bus.emit('battleEnd', { victory: true, xpReward: 0, goldReward: 0 })).not.toThrow();
  });
});