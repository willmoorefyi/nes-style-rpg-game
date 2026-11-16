/**
 * Bestiary hooks for multi-form enemies (docs/CHAOS_FORMS_PLAN.md 8, D-O7, R11). A form record (`formOf: <root>`) is
 * never a top-level entry; its root lists the art forms as sub-entries in chain order ("Chaos (Orrery)"), and a data
 * form that reuses the art of the form before it (F4 on F3's colossus) is a second page of that entry. An unseen form
 * shows the unknown label under `mode: seen`. Pure (no PixiJS).
 */
import type { EnemyData } from '../../types/index.js';
import type { BestiaryData } from '../../types/bestiaryData.js';
import { colossusOf } from '../battle/colossus/colossusIndex.js';
import { bossTag, fill, type BestiaryEntry } from './bestiaryModel.js';

/** The record's root id (`formOf`), or null for an ordinary enemy or a root. */
export function formOfId(e: EnemyData | object): string | null {
  const v = 'formOf' in e ? e.formOf : undefined;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** The enemies that are top-level bestiary entries (form records filtered out, R11). */
export function topLevel(enemies: readonly EnemyData[]): EnemyData[] {
  return enemies.filter((e) => formOfId(e) === null);
}

/** The form chain from `rootId`, following each record's form-bearing boss phase (in threshold order). */
export function formChain(rootId: string, enemies: readonly EnemyData[]): EnemyData[] {
  const byId = new Map(enemies.map((e) => [e.id, e]));
  const out: EnemyData[] = [];
  for (let e = byId.get(rootId); e && !out.includes(e);) {
    out.push(e);
    const next = [...(e.bossPhases ?? [])].sort((a, b) => b.hpThreshold - a.hpThreshold)
      .map((p) => ('form' in p && typeof p.form === 'string' ? p.form : null)).find((f) => f !== null);
    e = next ? byId.get(next) : undefined;
  }
  return out;
}

/** The art a record draws: its colossus form, else its atlas sprite. */
const artOf = (e: EnemyData): string => colossusOf(e) ?? e.sprite ?? e.id;

/** The forms shown on one entry's pages: the form and the data forms right after it that reuse its art. */
export function formPages(formId: string, enemies: readonly EnemyData[]): EnemyData[] {
  const e = enemies.find((x) => x.id === formId);
  const root = e ? formOfId(e) ?? e.id : formId;
  const chain = formChain(root, enemies);
  const at = chain.findIndex((x) => x.id === formId);
  if (at < 0) return [];
  const out = [chain[at]];
  for (let k = at + 1; k < chain.length && artOf(chain[k]) === artOf(chain[at]); k++) out.push(chain[k]);
  return out;
}

/** The sub-entries under a root entry: one per art form after the root, labelled "<num> <name> (<title>)". */
export function formSubEntries(root: BestiaryEntry, enemies: readonly EnemyData[], data: BestiaryData,
  isSeen: (id: string) => boolean, title: (id: string) => string): BestiaryEntry[] {
  const chain = formChain(root.id, enemies);
  const num = root.label.split(' ')[0];
  const out: BestiaryEntry[] = [];
  chain.forEach((enemy, k) => {
    if (k === 0 || artOf(enemy) === artOf(chain[k - 1])) return;
    const seen = data.mode === 'all' || isSeen(enemy.id);
    const name = seen ? `${enemy.name} (${title(enemy.id)})` : data.labels.unknown;
    out.push({ id: enemy.id, enemy, index: root.index, seen, boss: seen && bossTag(enemy), habitats: root.habitats,
      label: fill(data, 'entry', { num, name }) });
  });
  return out;
}
