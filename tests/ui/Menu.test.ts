import { describe, it, expect, vi } from 'vitest';
import { Menu } from '../../src/ui/Menu.js';
import { InputManager } from '../../src/core/InputManager.js';

function mockInput(actions: Record<string, boolean>): InputManager {
  return {
    isJustPressed: (action: string) => actions[action] ?? false,
  } as InputManager;
}

describe('Menu', () => {
  const items = [
    { label: 'Fight', value: 'fight' },
    { label: 'Magic', value: 'magic' },
    { label: 'Item', value: 'item', enabled: false },
    { label: 'Run', value: 'run' },
  ];

  it('starts with cursor at index 0', () => {
    const menu = new Menu({ items });
    expect(menu.selectedIndex).toBe(0);
  });

  it('moves cursor down', () => {
    const menu = new Menu({ items });
    menu.update(mockInput({ down: true }));
    expect(menu.selectedIndex).toBe(1);
  });

  it('moves cursor up', () => {
    const menu = new Menu({ items });
    menu.setIndex(2);
    menu.update(mockInput({ up: true }));
    expect(menu.selectedIndex).toBe(1);
  });

  it('wraps cursor from bottom to top', () => {
    const menu = new Menu({ items });
    menu.setIndex(3);
    menu.update(mockInput({ down: true }));
    expect(menu.selectedIndex).toBe(0);
  });

  it('wraps cursor from top to bottom', () => {
    const menu = new Menu({ items });
    menu.update(mockInput({ up: true }));
    expect(menu.selectedIndex).toBe(3);
  });

  it('calls onSelect for enabled items', () => {
    const onSelect = vi.fn();
    const menu = new Menu({ items, onSelect });
    menu.update(mockInput({ confirm: true }));
    expect(onSelect).toHaveBeenCalledWith(items[0], 0);
  });

  it('does not call onSelect for disabled items', () => {
    const onSelect = vi.fn();
    const menu = new Menu({ items, onSelect });
    menu.setIndex(2); // disabled item
    menu.update(mockInput({ confirm: true }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onCancel', () => {
    const onCancel = vi.fn();
    const menu = new Menu({ items, onCancel });
    menu.update(mockInput({ cancel: true }));
    expect(onCancel).toHaveBeenCalled();
  });
});
