import { Container, BitmapText, Graphics } from 'pixi.js';
import { NES_FONT } from './NESFont.js';
import { Window } from './Window.js';
import { NAME_MAX_LENGTH } from './NameEntryGrid.js';
import type { Character } from '../entities/Character.js';
import { MAX_LEVEL } from '../entities/ExperienceTable.js';
import { SPELL_LEVELS } from '../entities/SpellCharges.js';
import { FONT_SIZE, CHAR_WIDTH } from '../core/LayoutConstants.js';

const WHITE = 0xffffff;
export const FALLEN_GREY = 0x808080;
const LINE_GAP = 40;
const BAR_HEIGHT = 16;
/** The boost indicator's colour (src/core/Boosts.ts `boostSummary`). */
export const BOOST_TAG_COLOUR = 0xf8d878;

/** What one party row shows (MS-7). Strings are complete labels, ready to draw. */
export interface PartyRowData {
  name: string;
  className: string;
  level: string;
  next: string;
  hp: string;
  /** Fraction of max HP left, 0..1. */
  hpRatio: number;
  status: string;
  /** Per-level spell charges, e.g. "L1 2/2 L2 1/1"; empty for members with no spell levels. */
  charges: string;
  fallen: boolean;
}

/** The row data for one member: full name, class, Lv, HP, charges (levels with max > 0), status and XP to next. */
export function partyRowData(member: Character): PartyRowData {
  const fallen = member.currentHp <= 0;
  const statuses = member.statusTracker.getAll().map((s) => s.effect.toUpperCase());
  if (fallen && statuses.length === 0) statuses.push('FALLEN');
  const charges: string[] = [];
  for (let lv = 1; lv <= SPELL_LEVELS; lv++) {
    const max = member.getMaxCharges(lv);
    if (max > 0) charges.push(`L${lv} ${member.getSpellCharges(lv)}/${max}`);
  }
  return {
    name: member.name.slice(0, NAME_MAX_LENGTH),
    className: member.classData.name,
    level: `Lv ${member.level}`,
    next: member.level >= MAX_LEVEL ? 'Next: MAX' : `Next: ${Math.max(0, member.xpForNextLevel() - member.xp)}`,
    hp: `HP ${member.currentHp}/${member.maxHp}`,
    hpRatio: member.maxHp > 0 ? Math.max(0, Math.min(1, member.currentHp / member.maxHp)) : 0,
    status: statuses.join(' '),
    charges: charges.join(' '),
    fallen,
  };
}

export interface PartyPanelConfig {
  x: number;
  y: number;
  width: number;
  rowHeight: number;
  rows: number;
}

/** The field menu's party pane: one row per member, fallen members greyed out. */
export class PartyPanel extends Window {
  private readonly rowsContainer = new Container();
  private readonly rowHeight: number;
  private data: PartyRowData[] = [];
  private readonly boostTag: BitmapText;

  constructor(config: PartyPanelConfig) {
    super({ x: config.x, y: config.y, width: config.width, height: config.rows * config.rowHeight + 48 });
    this.rowHeight = config.rowHeight;
    this.rowsContainer.position.set(this.contentX, this.contentY);
    this.addChild(this.rowsContainer);
    this.boostTag = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: BOOST_TAG_COLOUR } });
    this.boostTag.anchor.set(1, 0);   // right-aligned at the content's bottom-right corner
    this.boostTag.position.set(this.contentX + this.contentWidth, this.contentY + this.contentHeight - FONT_SIZE);
    this.addChild(this.boostTag);
  }

  /** The bottom-right indicator of the boosts off their defaults ('' hides it): `BOOST G x4 ENC Off`. */
  setBoostTag(summary: string): void {
    this.boostTag.text = summary ? `BOOST ${summary}` : '';
  }

  /** The indicator as drawn now ('' when every boost is at its default). */
  get boostText(): string { return this.boostTag.text; }

  /** The rows drawn by the last refresh. */
  get rows(): readonly PartyRowData[] { return this.data; }

  refresh(members: readonly Character[]): void {
    for (const child of this.rowsContainer.removeChildren()) child.destroy();
    this.data = members.map(partyRowData);
    this.data.forEach((row, i) => this.rowsContainer.addChild(this.drawRow(row, i * this.rowHeight)));
  }

  private drawRow(row: PartyRowData, y: number): Container {
    const c = new Container();
    c.y = y;
    const fill = row.fallen ? FALLEN_GREY : WHITE;
    const col = (n: number) => n * CHAR_WIDTH;
    const text = (s: string, x: number, line: number) => {
      const t = new BitmapText({ text: s, style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill } });
      t.position.set(x, line * LINE_GAP);
      c.addChild(t);
    };
    text(row.name, 0, 0);
    text(row.className, col(NAME_MAX_LENGTH + 2), 0);
    text(row.level, col(24), 0);
    text(row.next, col(32), 0);
    text(row.hp, 0, 1);
    text(row.status, col(32), 1);
    if (row.charges) text(row.charges, 0, 2);
    const barX = col(14), barW = col(16), barY = LINE_GAP + (FONT_SIZE - BAR_HEIGHT) / 2;
    const bar = new Graphics().rect(barX, barY, barW, BAR_HEIGHT).fill(0x000040);
    if (row.hpRatio > 0) {
      const colour = row.fallen ? FALLEN_GREY : row.hpRatio <= 0.25 ? 0xe04040 : 0x40c040;
      bar.rect(barX, barY, Math.round(barW * row.hpRatio), BAR_HEIGHT).fill(colour);
    }
    c.addChild(bar);
    return c;
  }
}
