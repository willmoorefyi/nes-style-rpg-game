/**
 * The committed paged monster atlas for tests (docs/ROSTER_PLAN.md 8, FW-8): `assets/sprites/monsters-ai.json` and the
 * page PNGs it lists (`pages[].file`, next to the JSON); each sheet's rects are on its `page`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRgbaPng, type RgbaImage } from './pngAlpha.js';

export const MONSTER_ATLAS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/sprites');

export interface MonsterAtlasIndex {
  pages: { file: string; w: number; h: number }[];
  sheets: Record<string, { page?: number }>;
}

/** The parsed `monsters-ai.json`, typed as the caller needs it. */
export function readMonsterAtlas<T extends object>(): T & MonsterAtlasIndex {
  return JSON.parse(readFileSync(join(MONSTER_ATLAS_DIR, 'monsters-ai.json'), 'utf-8')) as T & MonsterAtlasIndex;
}

/** The path of atlas page i. */
export function monsterPagePath(page: number): string {
  return join(MONSTER_ATLAS_DIR, readMonsterAtlas<object>().pages[page].file);
}

const decoded = new Map<number, RgbaImage>();

/** The decoded page a sheet lives on (cached per page). */
export function monsterSheetPng(sheet: string): RgbaImage {
  const meta = readMonsterAtlas<object>();
  const page = meta.sheets[sheet]?.page ?? 0;
  let img = decoded.get(page);
  if (!img) {
    img = readRgbaPng(monsterPagePath(page));
    decoded.set(page, img);
  }
  return img;
}
