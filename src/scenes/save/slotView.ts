import { BitmapText } from 'pixi.js';
import { Window } from '../../ui/Window.js';
import { TextRenderer } from '../../ui/TextRenderer.js';
import { NES_FONT } from '../../ui/NESFont.js';
import type { SlotSummary } from '../../systems/SaveManager.js';
import { ClassRegistry } from '../../data/ClassRegistry.js';
import { Character } from '../../entities/Character.js';
import { classLabel } from '../../data/classLabel.js';
import { FONT_SIZE, GAME_WIDTH, SCREEN_MARGIN } from '../../core/LayoutConstants.js';

const FULL = GAME_WIDTH - 2 * SCREEN_MARGIN;
/** The Save and Load screens (S5): a title, the slot list, and the highlighted slot's details. */
export const SLOT_RECTS = {
  title: { x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: FULL, height: 96 },
  list: { x: SCREEN_MARGIN, y: 136, width: FULL, height: 180 },
  detail: { x: SCREEN_MARGIN, y: 332, width: FULL, height: 300 },
} as const;

/** Seconds as H:MM. */
export function formatPlayTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/** `Slot 1  Cornelia Castle 2F  0:12`, or `Slot 1  Empty`. */
export function slotLabel(slot: SlotSummary | null, index: number): string {
  if (!slot) return `Slot ${index + 1}  Empty`;
  return `Slot ${index + 1}  ${slot.location}  ${formatPlayTime(slot.playTime)}`;
}

/** `2026-11-14 14:03` in local time, or '' for a missing or bad date. */
export function formatSaveDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** One line per member (`ROLF  WAR  Lv3  HP 35/40`), then the gold and the save date. */
export function slotDetail(slot: SlotSummary | null): string[] {
  if (!slot) return ['No save in this slot.'];
  const width = Math.max(0, ...slot.members.map((m) => m.name.length));
  const lines = slot.members.map((m) => {
    const cls = ClassRegistry.getClass(m.classId);
    const short = cls ? classLabel(cls) : m.classId;
    // max HP follows from class and level; it is not stored in the save
    const maxHp = cls ? new Character({ name: m.name, classData: cls, level: m.level }).maxHp : undefined;
    return `${m.name.padEnd(width)}  ${short.padEnd(3)}  Lv${m.level}  HP ${m.currentHp}${maxHp !== undefined ? `/${maxHp}` : ''}`;
  });
  const date = formatSaveDate(slot.saveDate);
  return [...lines, '', `${slot.gold} G`, ...(date ? [`Saved ${date}`] : [])];
}

/** A window with one line of title text. */
export function titleWindow(title: string): Window {
  const win = new Window({ ...SLOT_RECTS.title });
  const text = new BitmapText({ text: title, style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
  text.position.set(win.contentX, win.contentY);
  win.addChild(text);
  return win;
}

/** The detail window and a setter for the slot it shows. */
export function detailWindow(): { window: Window; show: (slot: SlotSummary | null) => void; text: () => string } {
  const win = new Window({ ...SLOT_RECTS.detail });
  const text = new TextRenderer({ width: win.contentWidth });
  text.position.set(win.contentX, win.contentY);
  win.addChild(text);
  return { window: win, show: (slot) => text.setText(slotDetail(slot).join('\n'), true), text: () => text.text };
}
