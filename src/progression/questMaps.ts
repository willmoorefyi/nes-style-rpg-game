/**
 * The maps the progression verifier reads (docs/QUEST_PLAN.md 5.1): the compiled `assets/maps/ai/<id>.yaml` for the
 * ids in its index, then the legacy `assets/maps/<id>.yaml` the compiled set links to. NW-1's `--maps DIR`
 * (docs/NATURAL_WORLD_PLAN.md 5.2) puts a folder of compiled maps first: a map there (a scratch compile of the new
 * world) replaces the repository's map of the same id, and the ids of its own `index.yaml` are added.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { validateMapData } from '../core/schemaValidation.js';
import type { MapData } from '../types/index.js';

function readYaml(path: string): unknown {
  return parse(readFileSync(path, 'utf-8'));
}

function indexOf(dir: string): string[] {
  const p = join(dir, 'index.yaml');
  return existsSync(p) ? (readYaml(p) as string[]) : [];
}

/** Every map id the game can load: the compiled index (`mapsDir`'s maps first), then the legacy files. */
export function loadMaps(root: string, legacy: boolean, mapsDir?: string): MapData[] {
  const out = new Map<string, MapData>();
  const aiDir = join(root, 'assets/maps/ai');
  if (mapsDir && !existsSync(mapsDir)) throw new Error(`--maps ${mapsDir}: no such folder`);
  if (!legacy) {
    const ids = [...new Set([...indexOf(aiDir), ...(mapsDir ? indexOf(mapsDir) : [])])];
    for (const id of ids) {
      const scratch = mapsDir ? join(mapsDir, `${id}.yaml`) : '';
      const path = scratch && existsSync(scratch) ? scratch : join(aiDir, `${id}.yaml`);
      out.set(id, validateMapData(readYaml(path)));
    }
  }
  const want = new Set<string>();
  const queue = [...out.values()];
  for (let i = 0; i < queue.length; i++) {
    for (const t of queue[i].transitions) want.add(t.targetMap);
    if (queue[i].exit) want.add(queue[i].exit!.map);
  }
  // legacy maps the compiled set links to (and, with `legacy`, the act-1 set from Cornelia)
  const pending = legacy ? ['cornelia', 'overworld', 'temple-of-fiends', ...want] : [...want];
  while (pending.length) {
    const id = pending.pop()!;
    if (out.has(id)) continue;
    const p = join(root, 'assets/maps', `${id}.yaml`);
    if (!existsSync(p)) continue;
    const m = validateMapData(readYaml(p));
    out.set(id, m);
    for (const t of m.transitions) pending.push(t.targetMap);
  }
  return [...out.values()];
}
