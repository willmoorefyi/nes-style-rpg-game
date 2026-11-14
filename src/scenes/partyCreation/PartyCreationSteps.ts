import type { Container } from 'pixi.js';
import type { CharacterClassData } from '../../types/index.js';
import type { EventBus } from '../../core/EventBus.js';
import { Window } from '../../ui/Window.js';
import { Menu } from '../../ui/Menu.js';
import { NameEntryGrid, uniqueDefaultName } from '../../ui/NameEntryGrid.js';
import { DEFAULT_NAMES, buildPartySummary } from './PartyCreationViews.js';
import { GAME_WIDTH, SCREEN_MARGIN } from '../../core/LayoutConstants.js';

/** The confirm step: the party summary and Begin Adventure / Back. Returns the menu the scene updates. */
export function buildConfirmStep(
  into: Container,
  classes: readonly CharacterClassData[],
  names: readonly string[],
  opts: { onBegin: () => void; onBack: () => void; eventBus?: EventBus },
): Menu {
  into.addChild(buildPartySummary(classes, names));
  const win = new Window({ x: 660, y: 700, width: 600, height: 200 });
  const menu = new Menu({
    items: [
      { label: 'Begin Adventure', value: 'begin' },
      { label: 'Back', value: 'back' },
    ],
    x: win.contentX,
    y: win.contentY,
    lineHeight: 48,
    onSelect: (item) => (item.value === 'begin' ? opts.onBegin() : opts.onBack()),
    onCancel: () => opts.onBack(),
    eventBus: opts.eventBus,
  });
  win.addChild(menu);
  into.addChild(win);
  return menu;
}

/** The naming step for `cls`; the default name is unique among `taken` (a second Warrior is FGHTR2). */
export function buildNameStep(
  into: Container,
  cls: CharacterClassData,
  taken: readonly string[],
  opts: { onDone: (name: string) => void; onExit: () => void; eventBus?: EventBus },
): NameEntryGrid {
  const win = new Window({ x: SCREEN_MARGIN, y: 120, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: 600 });
  const grid = new NameEntryGrid({
    defaultName: uniqueDefaultName(DEFAULT_NAMES[cls.id] ?? cls.name.slice(0, 6), taken),
    x: win.contentX,
    y: win.contentY,
    eventBus: opts.eventBus,
    onDone: opts.onDone,
    onExit: opts.onExit,
  });
  win.addChild(grid);
  into.addChild(win);
  return grid;
}
