/**
 * MonsterFrames stubs built from the committed atlas index (`monsters-ai.json`: cell, foot row, lunge and the FW-A
 * anchors through the real `monsterAnchors` parser), plus per-frame opaque boxes read from the page PNGs, so tests
 * measure what each displayed frame really draws instead of trusting the anchors (docs/ROSTER_FIX_PLAN.md R-1 to R-3).
 */
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { Texture, TextureSource } from 'pixi.js';
import { headOf } from '../../src/scenes/battle/fx/texturePixels.js';
import { BOSS_FRAMES, resolveFrame, type MonsterFrame } from '../../src/scenes/battle/enemyChoreography.js';
import { enemyBoxInput, layoutSizeOfArt, monsterAnchors, type MonsterAnchors } from '../../src/rendering/monsterAnchors.js';
import { monsterSpriteKey, type MonsterFrames } from '../../src/rendering/BattleArt.js';
import type { EnemyBoxInput } from '../../src/scenes/battle/EnemyLayoutAi.js';
import type { MonsterArtSource } from '../../src/scenes/battle/AiEnemyView.js';
import type { EnemyData } from '../../src/types/index.js';
import { opaqueBounds } from './pngAlpha.js';
import { monsterSheetPng, readMonsterAtlas } from './monsterAtlas.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export interface AtlasSheet extends MonsterAnchors {
  page?: number; cell: [number, number]; footRow: number; floating: boolean; lungePx?: number; opaqueRight?: number;
  /** FW-S per-sheet screen scale (gen/monster_scale.yaml; absent: the atlas scale). */
  scale?: number;
  frames: Record<string, [number, number]>;
}
export const atlas = readMonsterAtlas<{ scale: number; texScale?: number; sheets: Record<string, AtlasSheet> }>();
/** Every record of enemies.yaml, the boss form records included (`enemyById` looks them up here). */
const allEnemyData = parse(readFileSync(join(root, 'assets/data/enemies.yaml'), 'utf-8')) as EnemyData[];
/**
 * The enemies drawn through the monster atlas, which the sprite-iterating tests walk. CHAOS_FORMS_PLAN R11: the boss
 * form records (`formOf`: chaos_orrery, chaos_horizon, chaos_horizon_core) are colossus forms drawn by ColossusView,
 * never laid out or animated as atlas sheets (their `sprite: chaos` is only the art fallback), so they are filtered.
 */
export const enemyData = allEnemyData.filter((e) => !e.formOf);
export const formRecords = allEnemyData.filter((e) => e.formOf);
export const enemyById = (id: string): EnemyData => {
  const e = allEnemyData.find((x) => x.id === id);
  if (!e) throw new Error(`no enemy ${id}`);
  return e;
};

const ts = atlas.texScale ?? atlas.scale;

/** The atlas key a frame name shows (BattleArt's resolution: the fallback chain, then `attack`). */
export function shownFrame(sheet: string, name: MonsterFrame): string {
  const s = atlas.sheets[sheet];
  return resolveFrame(name, (f) => !!s.frames[f]) ?? 'attack';
}

const boxes = new Map<string, [number, number, number, number]>();
/** A frame's opaque box in art px [l, t, r, b) relative to the cell, read from the page PNG (cached per frame). */
export function frameBox(sheet: string, name: MonsterFrame): [number, number, number, number] {
  const key = `${sheet}/${shownFrame(sheet, name)}`;
  let b = boxes.get(key);
  if (!b) {
    const s = atlas.sheets[sheet];
    const [x, y] = s.frames[shownFrame(sheet, name)];
    const px = opaqueBounds(monsterSheetPng(sheet), x * ts, y * ts, s.cell[0] * ts, s.cell[1] * ts);
    if (!px) throw new Error(`${key} is empty`);
    b = px.map((v) => v / ts) as [number, number, number, number];
    boxes.set(key, b);
  }
  return b;
}

/** The idle frame's opaque right edge (exclusive), as BattleArt measures it when the index has none. */
export const idleRight = (sheet: string): number => frameBox(sheet, 'idle')[2];

/** The idle frame's opaque box, inclusive art px [l, t, r, b]: the atlas `idleBox` (FW-A2), else read from the PNG. */
export function idleBoxOf(sheet: string): [number, number, number, number] {
  const a = monsterAnchors(atlas.sheets[sheet]);
  if (a.idleBox) return a.idleBox;
  const [l, t, r, b] = frameBox(sheet, 'idle');
  return [l, t, r - 1, b - 1];
}

/** A sheet's screen px per art px: its FW-S `scale` (3 for the rescaled sheets), else the atlas scale (2). */
export const sheetScale = (sheet: string): number => atlas.sheets[sheet].scale ?? atlas.scale;

/** A stub with one blank texture per frame and the atlas facts of `sheet` (null: no such sheet). */
export function atlasFrames(sheet: string): MonsterFrames | null {
  const s = atlas.sheets[sheet];
  if (!s) return null;
  const textures = Object.fromEntries(BOSS_FRAMES.map((n) => [n, new Texture()])) as Record<MonsterFrame, Texture>;
  // as BattleArt.getMonsterFrames: the sheet's own screen scale (FW-S), its lunge scaled once by scale / atlas scale
  const sc = sheetScale(sheet);
  return { textures, idle: textures.idle, attack: textures.attack, cast: textures.cast, hurt: textures.hurt, scale: sc,
    artScale: sc / ts, cell: s.cell, footRow: s.footRow, floating: s.floating, hasCast: !!s.frames.cast,
    hasRaise: !!s.frames.attack_raise, lungePx: ((s.lungePx ?? 24) * sc) / atlas.scale, anim: true,
    opaqueRight: s.opaqueRight ?? idleRight(sheet),
    ...monsterAnchors(s), idleBox: idleBoxOf(sheet) };
}

export const atlasArt: MonsterArtSource = { getMonsterFrames: atlasFrames };

/** The layout input AiEnemyView builds for an enemy id (enemyBoxInput: its size, its sheet's cell, home extent and scale). */
export function layoutInput(id: string): EnemyBoxInput {
  const e = enemyById(id);
  const s = atlas.sheets[monsterSpriteKey(e)];
  const sc = sheetScale(monsterSpriteKey(e));
  // as AiEnemyView (boxInputOf): a boss sheet at scale 3 is the titan class unless its art fits ENEMY_AREA (chaos is a
  // titan, hollow_seraph a boss, V8 N-1); a scale-3 boss box carries its art top `oy0`
  const f = { ...monsterAnchors(s), cell: s.cell, scale: sc };
  return enemyBoxInput(layoutSizeOfArt(e.size, f), f);
}

/** atlasFrames with one cell-sized texture for every frame (so a sprite's bounds are its cell at its scale); `head`
 *  also primes headOf with the idle box's top row as the topmost opaque row (the head statusFx anchors icons on). */
export function sizedAtlasFrames(sheet: string, head = false): MonsterFrames | null {
  const f = atlasFrames(sheet);
  if (!f) return null;
  const [w, h] = [f.cell[0] * ts, f.cell[1] * ts];
  const tex = new Texture({ source: new TextureSource({ width: w, height: h }) });
  if (head) {
    const [l, t, r] = idleBoxOf(sheet);
    const data = new Uint8ClampedArray(w * h * 4);
    for (let x = l * ts; x <= r * ts; x++) data[(t * ts * w + x) * 4 + 3] = 255;
    headOf(tex, () => ({ data, w, h }));
  }
  const textures = Object.fromEntries(Object.keys(f.textures).map((k) => [k, tex])) as Record<MonsterFrame, Texture>;
  return { ...f, textures, idle: tex, attack: tex, cast: tex, hurt: tex };
}
