import { Window } from './Window.js';
import { Menu } from './Menu.js';
import { TextRenderer } from './TextRenderer.js';
import type { InputManager } from '../core/InputManager.js';
import type { EventBus } from '../core/EventBus.js';
import { GAME_WIDTH, LINE_HEIGHT, MENU_LINE_HEIGHT, WINDOW_PADDING } from '../core/LayoutConstants.js';

export interface ConfirmBoxConfig {
  prompt: string;
  /** Called once with the answer; cancel answers No. */
  onAnswer: (yes: boolean) => void;
  width?: number;
  y?: number;
  eventBus?: EventBus;
  /** Start on No (e.g. before an overwrite). Default Yes. */
  defaultNo?: boolean;
}

/**
 * A centred prompt with Yes / No (E6, S5): the Tent and Cabin, the Save screen's overwrite and the Load screen's
 * "progress is lost" use it. The owner calls `update(input)` while it is open.
 */
export class ConfirmBox extends Window {
  private readonly menu: Menu;
  private readonly text: TextRenderer;
  private answered = false;

  constructor(config: ConfirmBoxConfig) {
    const width = config.width ?? 900;
    const probe = new TextRenderer({ width: width - 2 * WINDOW_PADDING });
    probe.setText(config.prompt, true);
    const lines = probe.text.split('\n').length;
    const height = 2 * WINDOW_PADDING + lines * LINE_HEIGHT + 16 + 2 * MENU_LINE_HEIGHT;
    super({ x: (GAME_WIDTH - width) / 2, y: config.y ?? 380, width, height });
    this.text = probe;
    this.text.position.set(this.contentX, this.contentY);
    this.addChild(this.text);
    const answer = (yes: boolean): void => {
      if (this.answered) return;
      this.answered = true;
      config.onAnswer(yes);
    };
    this.menu = new Menu({
      items: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }],
      x: this.contentX,
      y: this.contentY + lines * LINE_HEIGHT + 16,
      initialIndex: config.defaultNo ? 1 : 0,
      eventBus: config.eventBus,
      onSelect: (item) => answer(item.value === 'yes'),
      onCancel: () => answer(false),
    });
    this.addChild(this.menu);
  }

  /** The prompt as shown (wrapped). */
  get prompt(): string { return this.text.text; }

  update(input: InputManager): void {
    if (!this.answered) this.menu.update(input);
  }
}
