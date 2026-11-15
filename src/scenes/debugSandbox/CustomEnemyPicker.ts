import { BitmapText, Container } from 'pixi.js';
import { Window } from '../../ui/Window.js';
import { Menu, type MenuInput } from '../../ui/Menu.js';
import type { EventBus } from '../../core/EventBus.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { FONT_SIZE } from '../../core/LayoutConstants.js';
import { MAX_CUSTOM } from './sandboxModel.js';
import { describeEnemies } from './sandboxRows.js';

export interface PickerCallbacks {
  add: (enemyId: string) => void;
  removeLast: () => void;
  clear: () => void;
  close: () => void;
}

const DONE = '__done';
const REMOVE = '__remove';
const CLEAR = '__clear';

/**
 * The sandbox's "Custom" enemy list: Z on an enemy adds it (up to MAX_CUSTOM), plus Remove last, Clear and Done.
 * X closes it too.
 */
export class CustomEnemyPicker extends Container {
  private menu: Menu;
  private readonly current: BitmapText;

  constructor(private readonly enemies: readonly { id: string; name: string }[], private readonly cb: PickerCallbacks,
              eventBus: EventBus | undefined, x: number, y: number, initialIndex = 0) {
    super();
    const win = new Window({ x, y, width: 560, height: 820 });
    this.addChild(win);
    this.current = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffff80 } });
    this.current.position.set(win.contentX, win.contentY);
    win.addChild(this.current);
    this.menu = new Menu({
      items: [
        { label: 'Done', value: DONE },
        { label: 'Remove last', value: REMOVE },
        { label: 'Clear', value: CLEAR },
        ...enemies.map((e) => ({ label: `+ ${e.name}`, value: e.id })),
      ],
      x: win.contentX,
      y: win.contentY + 96,
      lineHeight: 40,
      maxVisible: 16,
      initialIndex,
      eventBus,
      onSelect: (item) => this.select(item.value),
      onCancel: () => this.cb.close(),
    });
    win.addChild(this.menu);
  }

  get selectedIndex(): number { return this.menu.selectedIndex; }

  /** Show the current custom list (wrapped onto two lines). */
  setCurrent(ids: readonly string[]): void {
    const name = (id: string): string => this.enemies.find((e) => e.id === id)?.name ?? id;
    const text = describeEnemies(ids, name);
    const cut = text.length > 30 ? text.lastIndexOf(', ', 30) : -1;
    this.current.text = `${ids.length}/${MAX_CUSTOM}: ${cut > 0 ? `${text.slice(0, cut + 1)}\n${text.slice(cut + 2)}` : text}`;
  }

  update(input: MenuInput): void {
    this.menu.update(input);
  }

  private select(value: string): void {
    if (value === DONE) this.cb.close();
    else if (value === REMOVE) this.cb.removeLast();
    else if (value === CLEAR) this.cb.clear();
    else this.cb.add(value);
  }
}
