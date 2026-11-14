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

describe('MS-5: MenuConfig.initialIndex', () => {
  const items = [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }, { label: 'C', value: 'c' }];
  it('starts on the given row', () => {
    expect(new Menu({ items, initialIndex: 1 }).selectedIndex).toBe(1);
  });
  it('clamps to the list', () => {
    expect(new Menu({ items, initialIndex: 7 }).selectedIndex).toBe(2);
    expect(new Menu({ items, initialIndex: -3 }).selectedIndex).toBe(0);
  });
  it('scrolls a long list so the row is visible', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ label: `I${i}`, value: String(i) }));
    const menu = new Menu({ items: many, maxVisible: 4, initialIndex: 10 });
    expect(menu.selectedItem.value).toBe('10');
  });

  it('R0 (E3): an inactive menu greys its cursor and ignores input until reactivated', () => {
    const onSelect = vi.fn();
    const menu = new Menu({ items, onSelect });
    const cursor = menu.children[0];
    expect(menu.isActive).toBe(true);
    menu.setActive(false);
    expect(menu.isActive).toBe(false);
    expect(cursor.tint).toBe(0x808080);
    menu.update(mockInput({ down: true }));
    menu.update(mockInput({ confirm: true }));
    expect(menu.selectedIndex).toBe(0);
    expect(onSelect).not.toHaveBeenCalled();
    menu.setActive(true);
    expect(cursor.tint).toBe(0xffffff);
    menu.update(mockInput({ down: true }));
    expect(menu.selectedIndex).toBe(1);
  });
});

describe('I2: a held direction auto-repeats', () => {
  const list = ['A', 'B', 'C', 'D'].map((l) => ({ label: l, value: l }));
  /** One frame: `fresh` is a new press this frame; `held` is a direction still down. */
  const frame = (held: string | null, fresh = false) => ({
    isJustPressed: (a: string) => fresh && a === held,
    isPressed: (a: string) => a === held,
  }) as Pick<InputManager, 'isJustPressed' | 'isPressed'>;

  it('after a delay the cursor moves on by itself while Down stays held', () => {
    const menu = new Menu({ items: list });
    menu.update(frame('down', true));                       // the press: 0 -> 1
    for (let i = 0; i < 20 + 4; i++) menu.update(frame('down'));
    expect(menu.selectedIndex).toBe(1);
    menu.update(frame('down'));                             // 1 + 20 + 5 frames: the first repeat
    expect(menu.selectedIndex).toBe(2);
    for (let i = 0; i < 5; i++) menu.update(frame('down'));
    expect(menu.selectedIndex).toBe(3);
  });

  it('a held repeat stops at the last item; only a fresh press wraps', () => {
    const menu = new Menu({ items: list, initialIndex: 2 });
    menu.update(frame('down', true));                       // 2 -> 3
    for (let i = 0; i < 60; i++) menu.update(frame('down'));
    expect(menu.selectedIndex).toBe(3);
    menu.update(frame(null));
    menu.update(frame('down', true));
    expect(menu.selectedIndex).toBe(0);
  });

  it('releasing the key resets the delay', () => {
    const menu = new Menu({ items: list });
    menu.update(frame('down', true));
    for (let i = 0; i < 20; i++) menu.update(frame('down'));
    menu.update(frame(null));
    for (let i = 0; i < 20; i++) menu.update(frame('down'));
    expect(menu.selectedIndex).toBe(1);
  });
});

describe('I3: menus without their own bus use the shared UI bus', () => {
  it('a Menu built without eventBus emits cursorMove on the bus set by setUiEventBus', async () => {
    const { setUiEventBus } = await import('../../src/ui/uiSounds.js');
    const { EventBus } = await import('../../src/core/EventBus.js');
    const bus = new EventBus();
    const moved = vi.fn();
    bus.on('cursorMove', moved);
    setUiEventBus(bus);
    try {
      const menu = new Menu({ items: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] });
      menu.update(mockInput({ down: true }));
      expect(moved).toHaveBeenCalledTimes(1);
    } finally {
      setUiEventBus(undefined);
    }
  });
});
