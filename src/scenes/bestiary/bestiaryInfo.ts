/**
 * The bestiary's Info pages (docs/ROSTER_PLAN.md 7.3): the stats panel already uses its 17 lines, so a key cycles the
 * same 17-line, 56-column box through Stats -> Info (the description, specials and on-hit statuses) -> each lore page
 * -> Stats. Pure text, ASCII only. A rematch shows its first battle's lore.
 */
import type { BestiaryData } from '../../types/bestiaryData.js';
import { FULL_CHARS, STAT_LINES, fill, labelList, type BestiaryEntry, type StatLine } from './bestiaryModel.js';

const LABEL_CHARS = 11;

/** `text` in lines of at most `width` characters (words kept whole; a "\n" starts a new line). */
export function wrapText(text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ').filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > width && line) { out.push(line); line = word; } else line = next;
    }
    out.push(line.slice(0, width));
  }
  return out;
}

/** The lore pages an entry shows (its own, else its first battle's for a rematch); none while unseen. */
export function lorePages(entry: BestiaryEntry, data: BestiaryData): string[] {
  if (!entry.seen) return [];
  return data.lore[entry.enemy.id] ?? (entry.enemy.rematchOf ? data.lore[entry.enemy.rematchOf] : undefined) ?? [];
}

/** Stats, Info, then one page per lore page. */
export const pageCount = (entry: BestiaryEntry, data: BestiaryData): number => 2 + lorePages(entry, data).length;

const row = (label: string, value: string): StatLine[] =>
  wrapText(value, FULL_CHARS - LABEL_CHARS).map((l, i) => ({ left: `${(i === 0 ? label : '').padEnd(LABEL_CHARS)}${l}` }));

const capitalised = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);

/** The Info page (page 1): title, description, then specials and on-hit statuses when the enemy has any. */
export function infoLines(entry: BestiaryEntry, data: BestiaryData): StatLine[] {
  const L = data.labels;
  const e = entry.enemy;
  const lines: StatLine[] = [{ left: L.info }, { left: '' }];
  if (!entry.seen) return [...lines, { left: L.blank }];
  lines.push(...wrapText(e.description ?? L.noDescription, FULL_CHARS).map((l) => ({ left: l })));
  const specials = (e.specials ?? []).map((s) =>
    fill(data, 'special', { name: data.specialNames[s.id] ?? capitalised(s.id), pct: Math.round(s.rate * 100) }));
  const onHit = labelList(e.attackStatus ?? [], data.statuses, 'status');
  if (specials.length || onHit.length) lines.push({ left: '' });
  if (specials.length) lines.push(...row(L.specials, specials.join(data.templates.list)));
  if (onHit.length) lines.push(...row(L.onHit, onHit.join(data.templates.list)));
  return lines.slice(0, STAT_LINES);
}

/** Lore page `n` (0-based): its title ("Lore 1/3"), then the text wrapped at 56. */
export function loreLines(entry: BestiaryEntry, data: BestiaryData, n: number): StatLine[] {
  const pages = lorePages(entry, data);
  const title = fill(data, 'loreTitle', { page: n + 1, pages: pages.length });
  return [{ left: title }, { left: '' }, ...wrapText(pages[n] ?? '', FULL_CHARS).map((l) => ({ left: l }))].slice(0, STAT_LINES);
}

/** The lines of panel page `page` (0 = the stats, from `stats()`). */
export function pageLines(entry: BestiaryEntry, data: BestiaryData, page: number, stats: () => StatLine[]): StatLine[] {
  if (page <= 0) return stats();
  if (page === 1) return infoLines(entry, data);
  return loreLines(entry, data, page - 2);
}
