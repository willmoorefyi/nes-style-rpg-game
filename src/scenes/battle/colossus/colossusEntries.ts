/**
 * Per-form entries of colossus.json (docs/CHAOS_FORMS_PLAN.md 18.4, 18.5, 18.8; D-U13). The `forms` table is keyed by
 * the form record's id. A form that draws another form's art at its own geometry (F4 `chaos_horizon_core`: F3's art
 * with the core's `open` frame, at its own rest (-527, -285)) is an entry with `art: <form>`: it shares that form's
 * layers and tiles and inherits every field it does not set (the build may also write the entry in full). A record
 * draws its own entry when the index has one sharing the record's art (`colossus:`), else its art's entry. Pure.
 */
import type { EnemyData } from '../../../types/index.js';
import { colossusOf, type ColossusFormSpec, type ColossusIndex } from './colossusIndex.js';

/** The form whose art (layers, tiles, textures) an entry draws: its `art`, else its own id. */
export const artIdOf = (id: string, f: Pick<ColossusFormSpec, 'art'>): string => f.art ?? id;

/**
 * Resolve the `art` entries of a raw `forms` table: an entry with `art` inherits that form's fields (its own win). An
 * `art` naming a missing form or another `art` entry is refused (logged; the entry is dropped).
 */
export function resolveArtEntries(forms: Record<string, ColossusFormSpec>): Record<string, ColossusFormSpec> {
  const out: Record<string, ColossusFormSpec> = {};
  for (const [id, f] of Object.entries(forms)) {
    const art = f?.art;
    if (art === undefined) { out[id] = f; continue; }
    const base = typeof art === 'string' && art !== id ? forms[art] : undefined;
    if (!base || base.art !== undefined) {
      console.error(`colossus ${id}: art ${String(art)} must name a form entry without its own art`);
      continue;
    }
    out[id] = { ...base, ...f };
  }
  return out;
}

/** The index entry a record draws: its own (keyed by the record id, sharing its art), else its art's; null: no colossus. */
export function entryIdFor(index: ColossusIndex | null, data: EnemyData | null | undefined): string | null {
  const art = colossusOf(data);
  if (!art || !data) return null;
  const own = index?.forms[data.id];
  return own && artIdOf(data.id, own) === art ? data.id : art;
}

/**
 * The bestiary still of a form (18.8, D-O21): the entry's `preview` when it names one, else the file the build writes
 * next to a built form's tiles, `colossus/<art>/preview.png`; null when the form's tiles are not the build's (a fixture).
 */
export function previewFileOf(id: string, f: ColossusFormSpec): string | null {
  if (f.preview) return f.preview;
  const art = artIdOf(id, f);
  const dir = `colossus/${art}/`;
  const files = f.layers.flatMap((l) => Object.values(l.frames).flatMap((fr) => fr.tiles.map((t) => t.file)));
  return files.length > 0 && files.every((file) => file.startsWith(dir)) ? `${dir}preview.png` : null;
}
