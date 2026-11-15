import { BitmapText, Container, Graphics } from 'pixi.js';
import type { Character } from '../../entities/Character.js';
import { Window } from '../../ui/Window.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { PANEL_FONT, PARTY_PANEL, STRIP_HEIGHT, STRIP_Y } from './BattleSceneTypes.js';
import { byPriority, type StatusVisuals } from './fx/statusRules.js';

/** Column offsets inside a row (content px). */
const COL = { cursor: 0, name: 44, hp: 220, bar: 420, status: 800 } as const;
const BAR = { width: 340, height: 16 } as const;
const HIGHLIGHT = 0xffff88;
const DEAD = 0x888888;
/** B10: while a target is being chosen the target row's cursor is yellow and blinks; the actor's name keeps a blue tint. */
const TARGET_CURSOR = 0xffff00;
const ACTOR_WHILE_TARGETING = 0x88ccff;
/** 6b: frames the HP number and bar take to roll from the old value to the new one (not scaled by message speed). */
export const HP_ROLL_FRAMES = 20;
/** Short tags for the status column when status-visuals.yaml has none (its `tag`s win). */
const STATUS_TAGS: Record<string, string> = {
  poison: 'PSN', stun: 'STUN', sleep: 'SLP', blind: 'BLND', silence: 'MUTE', death: 'KO', stone: 'STON', fear: 'FEAR',
};

export interface PartyPanelRow {
  readonly root: Container;
  readonly cursor: BitmapText;
  readonly name: BitmapText;
  readonly hp: BitmapText;
  readonly bar: Graphics;
  readonly status: BitmapText;
}

function hpColor(ratio: number): number {
  return ratio > 0.5 ? 0x44dd44 : ratio > 0.25 ? 0xdddd44 : 0xdd4444;
}

/**
 * BA-8: the compact party HP panel in the bottom strip (x 900-1920). One row per member: a cursor, the name,
 * HP `cur/max` with a bar, and a status tag, at 32 px. The acting member's row is highlighted with the cursor; while a
 * party target is being chosen (B10) only the target row has a cursor (yellow, blinking) and the actor's row keeps a
 * blue name tint, so the two never look alike.
 */
export class BattlePartyPanel {
  readonly window: Window;
  readonly rows: PartyPanelRow[] = [];
  private active = -1;
  private targeted = -1;
  /** 6b: per member, the HP on screen and the roll toward the presented HP (`t` frames into `HP_ROLL_FRAMES`). */
  private readonly hpRoll: { from: number; to: number; t: number }[] = [];

  /** status-visuals.yaml (set by createStatusFx): the tags and their order, the same priority as the icons. */
  statusVisuals: () => StatusVisuals = () => ({});

  constructor(private readonly party: readonly Character[]) {
    this.window = new Window({ x: PARTY_PANEL.x, y: STRIP_Y, width: PARTY_PANEL.width, height: STRIP_HEIGHT });
    const rowHeight = this.rowHeight;
    party.forEach((_, i) => {
      const root = new Container();
      root.position.set(this.window.contentX, this.window.contentY + i * rowHeight + (rowHeight - PANEL_FONT) / 2);
      const text = (x: number, fill = 0xffffff) => {
        const t = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: PANEL_FONT, fill } });
        t.x = x;
        root.addChild(t);
        return t;
      };
      const cursor = text(COL.cursor);
      cursor.text = '▶';
      cursor.visible = false;
      const bar = new Graphics();
      bar.position.set(COL.bar, (PANEL_FONT - BAR.height) / 2);
      root.addChild(bar);
      this.rows.push({ root, cursor, name: text(COL.name), hp: text(COL.hp), bar, status: text(COL.status, 0xffff44) });
      this.window.addChild(root);
    });
    this.refresh();
  }

  /** Four rows share the content height. */
  get rowHeight(): number { return Math.floor(this.window.contentHeight / 4); }

  /** Redraw names and status tags from the party; a changed HP starts rolling toward the new value (6b). */
  refresh(): void {
    this.party.forEach((c, i) => {
      const row = this.rows[i];
      if (!row) return;
      row.name.text = c.name;
      const roll = this.hpRoll[i];
      if (!roll) this.hpRoll[i] = { from: c.currentHp, to: c.currentHp, t: HP_ROLL_FRAMES };
      else if (roll.to !== c.currentHp) this.hpRoll[i] = { from: this.shownHp(i), to: c.currentHp, t: 0 };
      this.drawHp(i);
      const v = this.statusVisuals();
      const tags = c.currentHp <= 0 ? ['KO'] : byPriority(c.statusTracker.getAll().map(s => s.effect), v)
        .map(s => v[s]?.tag ?? STATUS_TAGS[s] ?? s.toUpperCase());
      row.status.text = tags.slice(0, 2).join(' ');
    });
    this.applyHighlight();
  }

  /** 6b: advance the HP rolls (heals count up, damage counts down). */
  update(dt: number): void {
    this.hpRoll.forEach((roll, i) => {
      if (roll.t >= HP_ROLL_FRAMES) return;
      roll.t = Math.min(HP_ROLL_FRAMES, roll.t + dt);
      this.drawHp(i);
    });
  }

  /** The HP number on screen for member i (mid-roll it is between the old and the new value). */
  shownHp(i: number): number {
    const roll = this.hpRoll[i];
    if (!roll) return this.party[i]?.currentHp ?? 0;
    return Math.round(roll.from + (roll.to - roll.from) * Math.min(1, roll.t / HP_ROLL_FRAMES));
  }

  private drawHp(i: number): void {
    const row = this.rows[i];
    const c = this.party[i];
    if (!row || !c) return;
    const hp = this.shownHp(i);
    row.hp.text = `${hp}/${c.maxHp}`;
    const ratio = c.maxHp > 0 ? Math.max(0, Math.min(1, hp / c.maxHp)) : 0;
    row.bar.clear();
    row.bar.rect(0, 0, BAR.width, BAR.height).fill(0x202040);
    if (ratio > 0) row.bar.rect(0, 0, Math.max(2, Math.round(BAR.width * ratio)), BAR.height).fill(hpColor(ratio));
  }

  /** The member whose command is being chosen (-1 for none). */
  setActive(index: number): void {
    this.active = index;
    this.applyHighlight();
  }

  /** The party member hovered while choosing a target (-1 for none). */
  setTarget(index: number): void {
    this.targeted = index;
    this.applyHighlight();
  }

  /** B10: the blink of the target row's cursor (on / off), driven by the targeting's flash timer. */
  blinkTarget(on: boolean): void {
    const row = this.rows[this.targeted];
    if (row) row.cursor.visible = on;
  }

  get activeIndex(): number { return this.active; }
  get targetIndex(): number { return this.targeted; }

  private applyHighlight(): void {
    const targeting = this.targeted >= 0;
    this.party.forEach((c, i) => {
      const row = this.rows[i];
      if (!row) return;
      const lit = targeting ? i === this.targeted : i === this.active;
      row.cursor.visible = lit;
      row.cursor.tint = targeting ? TARGET_CURSOR : 0xffffff;
      const actorTint = targeting && i === this.active && !lit ? ACTOR_WHILE_TARGETING : null;
      const tint = c.currentHp <= 0 ? DEAD : lit ? HIGHLIGHT : actorTint ?? 0xffffff;
      row.name.tint = tint;
      row.hp.tint = c.currentHp <= 0 ? DEAD : lit ? HIGHLIGHT : 0xffffff;
    });
  }
}
