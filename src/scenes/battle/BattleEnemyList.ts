import { Container, BitmapText } from 'pixi.js';
import type { Window } from '../../ui/Window.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { FONT_SIZE } from '../../core/LayoutConstants.js';
import { groupEnemies, enemyListCells } from './enemyList.js';

const DEAD_TINT = 0x888888;

/** What the list reads of each enemy (the presented state: a species greys out once its last death is shown). */
export interface ListedEnemy { data: { name: string }; currentHp: number }

/**
 * K3 / BA-8: the enemy list in the bottom-left window, one line per species ("6x Goblin"), two columns past 5 lines,
 * dead species grey (split out of BattleDisplayManager, which delegates to it).
 */
export class BattleEnemyList {
  texts: BitmapText[] = [];
  /** Base enemy name (species) -> list text index. */
  readonly nameToIndex: Map<string, number> = new Map();
  /** The list container (hidden while a spell or item list uses the window). */
  readonly container = new Container();

  constructor(private readonly enemyWindow: Window, private readonly enemies: () => readonly ListedEnemy[]) {
    this.container.position.set(enemyWindow.contentX, enemyWindow.contentY);
    enemyWindow.addChild(this.container);
  }

  update(): void {
    for (const t of this.texts) this.container.removeChild(t);
    this.texts = [];
    this.nameToIndex.clear();
    // L1: no HP display
    const entries = groupEnemies(this.enemies());
    const cells = enemyListCells(entries.length, this.enemyWindow.contentWidth);
    entries.forEach((entry, i) => {
      const text = new BitmapText({
        text: entry.label,
        style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff },
      });
      if (entry.alive === 0) text.tint = DEAD_TINT;
      text.position.set(cells[i].x, cells[i].y);
      this.container.addChild(text);
      this.texts.push(text);
      this.nameToIndex.set(entry.name, i);
    });
  }

  /** The list line of an enemy's species, if listed. */
  indexFor(enemy: { data: { name: string } }): number | undefined {
    return this.nameToIndex.get(enemy.data.name);
  }

  /** Restore the grey tint on list lines whose whole species is dead. */
  updateDeadTints(): void {
    for (const entry of groupEnemies(this.enemies())) {
      const idx = this.nameToIndex.get(entry.name);
      if (entry.alive === 0 && idx !== undefined && this.texts[idx]) this.texts[idx].tint = DEAD_TINT;
    }
  }
}
