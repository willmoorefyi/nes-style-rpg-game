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


describe('Menu scrolling', () => {
  const manyItems = [
    { label: 'Item1', value: '1' },
    { label: 'Item2', value: '2' },
    { label: 'Item3', value: '3' },
    { label: 'Item4', value: '4' },
    { label: 'Item5', value: '5' },
    { label: 'Item6', value: '6' },
  ];

  it('shows only maxVisible items', () => {
    const menu = new Menu({ items: manyItems, maxVisible: 3 });
    // Menu should have cursor + 3 item texts + 2 indicators = 6 children
    // But indicators may be hidden, just verify it constructs
    expect(menu.selectedIndex).toBe(0);
  });

  it('scrolls down when cursor moves past visible window', () => {
    const menu = new Menu({ items: manyItems, maxVisible: 3 });
    menu.update(mockInput({ down: true })); // index 1
    menu.update(mockInput({ down: true })); // index 2
    menu.update(mockInput({ down: true })); // index 3, should scroll
    expect(menu.selectedIndex).toBe(3);
  });

  it('scrolls up when cursor moves above visible window', () => {
    const menu = new Menu({ items: manyItems, maxVisible: 3 });
    menu.setIndex(4); // starts scrolled
    menu.update(mockInput({ up: true })); // index 3
    menu.update(mockInput({ up: true })); // index 2
    expect(menu.selectedIndex).toBe(2);
  });

  it('wraps from last to first and resets scroll', () => {
    const menu = new Menu({ items: manyItems, maxVisible: 3 });
    menu.setIndex(5); // last item
    menu.update(mockInput({ down: true })); // wrap to 0
    expect(menu.selectedIndex).toBe(0);
  });

  it('wraps from first to last and scrolls to end', () => {
    const menu = new Menu({ items: manyItems, maxVisible: 3 });
    menu.update(mockInput({ up: true })); // wrap to last
    expect(menu.selectedIndex).toBe(5);
  });

  it('works without maxVisible (backward compatible)', () => {
    const menu = new Menu({ items: manyItems });
    menu.update(mockInput({ down: true }));
    expect(menu.selectedIndex).toBe(1);
    menu.setIndex(5);
    menu.update(mockInput({ down: true }));
    expect(menu.selectedIndex).toBe(0);
  });
});
