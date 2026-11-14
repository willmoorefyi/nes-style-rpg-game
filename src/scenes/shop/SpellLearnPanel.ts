import { BitmapText } from 'pixi.js';
import type { SpellData } from '../../types/index.js';
import type { Character } from '../../entities/Character.js';
import type { MenuItem } from '../../ui/Menu.js';
import { Window } from '../../ui/Window.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { FONT_SIZE } from '../../core/LayoutConstants.js';
import { spellPrice } from '../../systems/SpellPurchase.js';
import { canLearn, learnersLine } from './spellLearners.js';
import { DETAIL_RECT, columns } from './shopLayout.js';

/** Spells per spell level (FF1: filled in order, no slot choice). */
export const SPELLS_PER_LEVEL = 3;
const GREY = 0x808080;
const LINE_STEP = FONT_SIZE + 8;

export type LearnStatus = 'can learn' | 'knows' | 'full' | 'n/a';

/** Whether `c` can learn `spell` now, already knows it, has no room at its level, or is of the wrong class. */
export function learnStatus(c: Character, spell: SpellData): LearnStatus {
  if (!canLearn(c, spell)) return 'n/a';
  if (c.getLearnedSpells().some((s) => s.spellId === spell.id)) return 'knows';
  return c.getSpellsAtLevel(spell.level).length >= SPELLS_PER_LEVEL ? 'full' : 'can learn';
}

/** Every member who could learn `spell` knows it already (and there is at least one). */
export function knownByAll(spell: SpellData, party: readonly Character[]): boolean {
  const learners = party.filter((c) => canLearn(c, spell));
  return learners.length > 0 && learners.every((c) => learnStatus(c, spell) === 'knows');
}

/** The spell list: `Name  L1  100G` columns, plus `Known` when every possible learner knows it (E2, E4). */
export function spellRows(spells: readonly SpellData[], party: readonly Character[], gold: number): MenuItem[] {
  const labels = columns(spells.map((s) => [s.name, `L${s.level}`, `${spellPrice(s)}G`, knownByAll(s, party) ? 'Known' : '']),
    ['left', 'left', 'right', 'left']);
  return spells.map((s, i) => ({ label: labels[i], value: s.id, enabled: gold >= spellPrice(s) }));
}

/** The members who could learn `spell`, as `NAME  L1 2/3`; `(knows)` and `(full)` rows are disabled (E4). */
export function memberRows(spell: SpellData, members: readonly Character[]): MenuItem[] {
  const labels = columns(members.map((c) => {
    const status = learnStatus(c, spell);
    const tag = status === 'knows' ? '(knows)' : status === 'full' ? '(full)' : '';
    return [c.name, `L${spell.level} ${c.getSpellsAtLevel(spell.level).length}/${SPELLS_PER_LEVEL}`, tag];
  }));
  return members.map((c, i) => ({ label: labels[i], value: c.name, enabled: learnStatus(c, spell) === 'can learn' }));
}

/** The magic shop's right-hand panel: who can learn the highlighted spell, then one line per member. */
export class SpellLearnPanel {
  readonly window = new Window({ ...DETAIL_RECT });
  private readonly header: BitmapText;
  private texts: BitmapText[] = [];

  constructor() {
    this.header = this.text(this.window.contentY);
    this.window.addChild(this.header);
  }

  /** The "Learn: WHM RDM" line and whether it is greyed (nobody in the party can learn the spell). */
  get learners(): { text: string; greyed: boolean } {
    return { text: this.header.text, greyed: this.header.tint === GREY };
  }

  /** The per-member lines (`W.MAG  knows`). */
  get lines(): string[] { return this.texts.map((t) => t.text); }

  /** Show `spell` against `party`; `withMembers` false leaves room for the member menu below the header. */
  show(spell: SpellData | undefined, party: readonly Character[], withMembers = true): void {
    for (const t of this.texts) this.window.removeChild(t);
    this.texts = [];
    this.header.text = spell ? learnersLine(spell, party) : '';
    this.header.tint = spell && party.some((c) => canLearn(c, spell)) ? 0xffffff : GREY;
    if (!spell || !withMembers) return;
    const rows = columns(party.map((c) => [c.name, learnStatus(c, spell)]));
    rows.forEach((row, i) => {
      const t = this.text(this.memberY + i * LINE_STEP);
      t.text = row;
      t.tint = learnStatus(party[i], spell) === 'can learn' ? 0xffffff : GREY;
      this.texts.push(this.window.addChild(t));
    });
  }

  /** Where the member lines (or the member menu) start, inside the window. */
  get memberY(): number { return this.window.contentY + LINE_STEP + 8; }

  private text(y: number): BitmapText {
    const t = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    t.position.set(this.window.contentX, y);
    return t;
  }
}
