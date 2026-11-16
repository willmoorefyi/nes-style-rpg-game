/**
 * The colossus index (`assets/sprites/colossus.json`, written by the `colossus` build stage; docs/CHAOS_FORMS_PLAN.md
 * 4.2-4.6; rev 4: 18.5, the contract the Python build matches): per form its art canvas, screen scale (1 for the painted
 * forms), rest placement, anchors, target rect and layers, each layer a few named frames (variants are frames) cut into
 * tiles of <= 2048 texture px. Pure (no PixiJS): the types, a reader that refuses a bad entry, and the screen geometry
 * every colossus consumer shares (anchors, the border rules, column span, visible fraction).
 */
import type { EnemyData } from '../../../types/index.js';
import { resolveArtEntries } from './colossusEntries.js';

export type XY = [number, number];
/** [left, top, right, bottom], right / bottom exclusive. */
export type Box = [number, number, number, number];

export type ColossusLayerKind = 'body' | 'limb' | 'core' | 'glow' | 'moon' | 'eyes' | 'cloud' | 'corona';
export const LAYER_KINDS: readonly ColossusLayerKind[] = ['body', 'limb', 'core', 'glow', 'moon', 'eyes', 'cloud', 'corona'];
export type ColossusBlend = 'normal' | 'add';

/** One tile of a frame: a PNG next to the index, placed at (x, y) texture px inside its frame. */
export interface ColossusTile { file: string; x: number; y: number; w: number; h: number }
/** A frame of a layer: its top-left on the canvas and its size (art px), and its tiles. `texScale` (default 1): the
 *  PNGs hold `ceil(size / texScale)` px a side and are drawn at `texScale` (the glow is stored at half res, B3). */
export interface ColossusFrameSpec { at: XY; size: XY; tiles: ColossusTile[]; pivot?: XY; texScale?: number }
export interface ColossusLayerSpec {
  name: string;
  kind: ColossusLayerKind;
  /** `add` for the light layers (glow, corona; D-O11); default `normal`. */
  blend?: ColossusBlend;
  /** The rest alpha (default 1; the glow 1.0, RIG finding 2). */
  alpha?: number;
  /** `base` always (it may be empty: the body carries it); variants are frames (the core `crack`, `open`), a layered
   *  form's limbs add raise / slam / recoil. */
  frames: Record<string, ColossusFrameSpec>;
  /** Moons: the orbit radius in art px (default 4). */
  orbit?: number;
}
export interface ColossusAnchors { target: XY; core: XY; head: XY; hands: [XY, XY]; melee: XY; feet: XY }
export interface ColossusFormSpec {
  canvas: XY;
  /** Screen px per art px (1 for the painted forms, D-O17); linear filtering, so no integer is assumed. */
  scale: number;
  /** The canvas top-left at rest, screen px. */
  place: XY;
  anchors: ColossusAnchors;
  /** Art px [x, y, w, h]: the cursor bracket and the proxy every sprite consumer reads (R15). */
  targetRect: [number, number, number, number];
  /** Art px box the art covers with opaque or glow pixels (rev 3 coverage; rev 4: informative only). */
  coverBox?: Box;
  /** Art px box shown at rest (the bestiary's rest-view crop); missing: the canvas inside (0, 0, 1920, 780). */
  visibleBox?: Box;
  /** The backdrop's multiply while this form is on screen (D-O19: F3 / F4 0.6; missing: none), in (0, 1]. */
  skyDim?: number;
  /** The form whose art this entry draws at its own geometry (F4 on F3's, D-U13; colossusEntries.ts); missing: its own. */
  art?: string;
  /** The bestiary still (18.8), relative to the index; missing: the build's `colossus/<art>/preview.png`. */
  preview?: string;
  layers: ColossusLayerSpec[];
}
export interface ColossusIndex { forms: Record<string, ColossusFormSpec> }

/** The field (screen px): right of the screen edge to the left edge, message window to the bottom strip. */
export const FIELD = { x0: 0, x1: 1920, y0: 120, y1: 780 } as const;
/** Screen px of shake the border rules must survive (ScreenShake's 6 px). */
export const BORDER_MARGIN = 6;
/** Damage numbers and icons stay in these rows (plan 4.4). */
export const NUMBER_Y: XY = [140, 740];
/** The head anchor's rows: the icon row above it and the target label above that stay below the message window. */
export const HEAD_Y: XY = [192, 760];

/** The colossus form a record draws (`colossus:`, plan 3.6), or null for an atlas enemy. */
export function colossusOf(data: EnemyData | object | null | undefined): string | null {
  const c = data && 'colossus' in data ? data.colossus : undefined;
  return typeof c === 'string' && c.length > 0 ? c : null;
}

/** The record's `colossusVariant` (F4's `{core: open}`), or none. */
export function variantOf(data: EnemyData | object | null | undefined): Record<string, string> {
  const v = data && 'colossusVariant' in data ? data.colossusVariant : undefined;
  if (!v || typeof v !== 'object') return {};
  return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string'));
}

const isXY = (v: unknown): v is XY => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n));
const isBox = (v: unknown): v is Box => Array.isArray(v) && v.length === 4 && v.every((n) => Number.isInteger(n));
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const unit = (v: unknown, zero: boolean): boolean => typeof v === 'number' && (zero ? v >= 0 : v > 0) && v <= 1;
/** A frame's texture size: ceil(size / texScale) a side. */
export const textureSize = (fr: ColossusFrameSpec): XY => [Math.ceil(fr.size[0] / (fr.texScale ?? 1)), Math.ceil(fr.size[1] / (fr.texScale ?? 1))];

/** Problems with one form entry (empty: valid). Tiles must be <= 2048 and cover their frame's texture exactly. */
export function formProblems(id: string, f: ColossusFormSpec): string[] {
  const out: string[] = [];
  const p = (m: string): void => { out.push(`colossus ${id}: ${m}`); };
  if (!isXY(f.canvas) || f.canvas[0] <= 0 || f.canvas[1] <= 0) p('canvas must be two positive integers');
  if (!positive(f.scale)) p('scale must be a number > 0');
  if (!isXY(f.place)) p('place must be two integers');
  const a = f.anchors;
  const inCanvas = (xy: unknown): boolean => isXY(xy) && xy[0] >= 0 && xy[1] >= 0 && xy[0] <= f.canvas[0] && xy[1] <= f.canvas[1];
  if (!a || !['target', 'core', 'head', 'melee', 'feet'].every((k) => inCanvas(a[k as keyof ColossusAnchors]))
    || !Array.isArray(a.hands) || a.hands.length !== 2 || !a.hands.every(inCanvas)) p('anchors must be inside the canvas');
  const r = f.targetRect;
  if (!isBox(r) || r[0] < 0 || r[1] < 0 || r[2] <= 0 || r[3] <= 0 || r[0] + r[2] > f.canvas[0]
    || r[1] + r[3] > f.canvas[1]) p('targetRect must be inside the canvas');
  for (const key of ['coverBox', 'visibleBox'] as const) if (f[key] !== undefined && !isBox(f[key])) p(`${key} must be 4 integers`);
  if (f.skyDim !== undefined && !unit(f.skyDim, false)) p('skyDim must be in (0, 1]');
  for (const key of ['art', 'preview'] as const) if (f[key] !== undefined && (typeof f[key] !== 'string' || f[key] === '')) p(`${key} must be a name`);
  if (!Array.isArray(f.layers) || f.layers.length === 0) p('layers must be a non-empty list');
  for (const l of f.layers ?? []) {
    if (!LAYER_KINDS.includes(l.kind)) p(`layer ${l.name}: unknown kind ${String(l.kind)}`);
    if (l.blend !== undefined && l.blend !== 'normal' && l.blend !== 'add') p(`layer ${l.name}: blend must be normal or add`);
    if (l.alpha !== undefined && !unit(l.alpha, true)) p(`layer ${l.name}: alpha must be in [0, 1]`);
    if (!l.frames?.base) p(`layer ${l.name}: no base frame`);
    for (const [name, fr] of Object.entries(l.frames ?? {})) {
      if (!isXY(fr.at) || !isXY(fr.size) || fr.size[0] <= 0 || fr.size[1] <= 0) { p(`layer ${l.name}/${name}: at / size must be integers`); continue; }
      if (fr.texScale !== undefined && !positive(fr.texScale)) { p(`layer ${l.name}/${name}: texScale must be a number > 0`); continue; }
      const [tw, th] = textureSize(fr);
      for (const t of fr.tiles ?? []) {
        if (t.w > 2048 || t.h > 2048) p(`layer ${l.name}/${name}: tile ${t.file} is over 2048 px`);
        if (t.x < 0 || t.y < 0 || t.x + t.w > tw || t.y + t.h > th) p(`layer ${l.name}/${name}: tile ${t.file} leaves its frame`);
      }
      const area = (fr.tiles ?? []).reduce((s, t) => s + t.w * t.h, 0);
      if ((fr.tiles ?? []).length > 0 && area !== tw * th) p(`layer ${l.name}/${name}: tiles do not cover the frame's texture exactly`);
    }
  }
  return out;
}

/** The index with every invalid form dropped (each logged with console.error). */
export function readColossusIndex(raw: unknown): ColossusIndex {
  const forms = (raw as { forms?: Record<string, ColossusFormSpec> } | null)?.forms;
  if (!forms || typeof forms !== 'object') {
    console.error('colossus.json: no `forms` table; no colossus art');
    return { forms: {} };
  }
  const out: Record<string, ColossusFormSpec> = {};
  for (const [id, f] of Object.entries(resolveArtEntries(forms))) {
    const problems = formProblems(id, f);
    if (problems.length) { for (const m of problems) console.error(m); continue; }
    out[id] = f;
  }
  return { forms: out };
}

/** A placeholder form (no art yet, plan C1: a box like missing atlas art): a 400 px box on the far floor. */
export function placeholderForm(): ColossusFormSpec {
  return { canvas: [400, 400], scale: 1, place: [520, 345], targetRect: [0, 0, 400, 400],
    anchors: { target: [200, 120], core: [200, 200], head: [200, 60], hands: [[40, 320], [360, 320]], melee: [400, 300], feet: [200, 400] },
    layers: [{ name: 'body', kind: 'body', frames: { base: { at: [0, 0], size: [400, 400], tiles: [] } } }] };
}

export interface Offset { x: number; y: number }
const ZERO: Offset = { x: 0, y: 0 };

/** Canvas art point -> screen px, for a canvas moved `off` screen px from its rest place. */
export function toScreen(f: ColossusFormSpec, xy: XY, off: Offset = ZERO): Offset {
  return { x: f.place[0] + off.x + xy[0] * f.scale, y: f.place[1] + off.y + xy[1] * f.scale };
}

/** The canvas (screen px x, y, w, h) at an offset. */
export function canvasRect(f: ColossusFormSpec, off: Offset = ZERO): { x: number; y: number; w: number; h: number } {
  return { x: f.place[0] + off.x, y: f.place[1] + off.y, w: f.canvas[0] * f.scale, h: f.canvas[1] * f.scale };
}

/** The target rect in screen px (the proxy's box). */
export function targetRectOnScreen(f: ColossusFormSpec, off: Offset = ZERO): { x: number; y: number; width: number; height: number } {
  const [x, y, w, h] = f.targetRect;
  const tl = toScreen(f, [x, y], off);
  return { x: tl.x, y: tl.y, width: w * f.scale, height: h * f.scale };
}

const clampY = (y: number, [lo, hi]: XY): number => Math.max(lo, Math.min(hi, y));

/** Every anchor in screen px; the number origin (core) and the head row are clamped into the field (plan 4.4). */
export function screenAnchors(f: ColossusFormSpec, off: Offset = ZERO): Record<'target' | 'core' | 'head' | 'melee' | 'feet', Offset>
  & { hands: [Offset, Offset] } {
  const s = (xy: XY): Offset => toScreen(f, xy, off);
  const core = s(f.anchors.core);
  const head = s(f.anchors.head);
  return { target: s(f.anchors.target), core: { x: core.x, y: clampY(core.y, NUMBER_Y) }, head: { x: head.x, y: clampY(head.y, HEAD_Y) },
    melee: s(f.anchors.melee), feet: s(f.anchors.feet), hands: [s(f.anchors.hands[0]), s(f.anchors.hands[1])] };
}

export type Side = 'left' | 'right' | 'top' | 'bottom';
/** The canvas borders some layer frame reaches (its cut edge: opaque body on the sides and bottom, the glow on top). */
export function touchedSides(f: ColossusFormSpec): Side[] {
  const frames = f.layers.flatMap((l) => Object.values(l.frames).filter((fr) => fr.tiles.length > 0));
  const out: Side[] = [];
  if (frames.some((fr) => fr.at[0] <= 0)) out.push('left');
  if (frames.some((fr) => fr.at[0] + fr.size[0] >= f.canvas[0])) out.push('right');
  if (frames.some((fr) => fr.at[1] <= 0)) out.push('top');
  if (frames.some((fr) => fr.at[1] + fr.size[1] >= f.canvas[1])) out.push('bottom');
  return out;
}

/**
 * The border rules (18.4, RIG finding 3) at a canvas offset `off` (screen px from rest, shake included): every cut edge
 * the art reaches stays off-screen by `margin`: left <= -margin, right >= 1920 + margin, the bottom behind the strip
 * (>= 780 + margin) and the top behind the message window (<= 120 - margin; the rise and the dying are exempt, so the
 * caller leaves `top` out there). Returns the broken rules (empty: all hold).
 */
export function borderProblems(f: ColossusFormSpec, off: Offset = ZERO, margin = 0, sides: readonly Side[] = touchedSides(f)): string[] {
  const c = canvasRect(f, off);
  const rule: Record<Side, [boolean, string]> = {
    left: [c.x <= FIELD.x0 - margin, `left ${c.x} > ${FIELD.x0 - margin}`],
    right: [c.x + c.w >= FIELD.x1 + margin, `right ${c.x + c.w} < ${FIELD.x1 + margin}`],
    top: [c.y <= FIELD.y0 - margin, `top ${c.y} > ${FIELD.y0 - margin}`],
    bottom: [c.y + c.h >= FIELD.y1 + margin, `bottom ${c.y + c.h} < ${FIELD.y1 + margin}`],
  };
  return sides.filter((s) => !rule[s][0]).map((s) => rule[s][1]);
}

/** The body spans every screen column (x 0..1920) at `off`: the arms reach past both edges (18.4). */
export function spansColumns(f: ColossusFormSpec, off: Offset = ZERO): boolean {
  const body = f.layers.filter((l) => l.kind === 'body').map((l) => l.frames.base).filter((fr) => fr.tiles.length > 0);
  return body.some((fr) => toScreen(f, fr.at, off).x <= FIELD.x0 && toScreen(f, [fr.at[0] + fr.size[0], 0], off).x >= FIELD.x1);
}

/** The canvas's intersection with (0, 0, 1920, 780) over the canvas area (R12). */
export function visibleFraction(f: ColossusFormSpec, off: Offset = ZERO): number {
  const c = canvasRect(f, off);
  const w = Math.max(0, Math.min(c.x + c.w, FIELD.x1) - Math.max(c.x, 0));
  const h = Math.max(0, Math.min(c.y + c.h, FIELD.y1) - Math.max(c.y, 0));
  return (w * h) / (c.w * c.h);
}

/** The art px box shown at rest (the json's, else the canvas clipped to (0, 0, 1920, 780)). */
export function visibleBoxOf(f: ColossusFormSpec): Box {
  if (f.visibleBox) return f.visibleBox;
  const s = f.scale;
  const [px, py] = f.place;
  const clip = (v: number, hi: number): number => Math.max(0, Math.min(hi, v));
  return [clip(Math.floor(-px / s), f.canvas[0]), clip(Math.floor(-py / s), f.canvas[1]),
    clip(Math.ceil((FIELD.x1 - px) / s), f.canvas[0]), clip(Math.ceil((FIELD.y1 - py) / s), f.canvas[1])];
}

/** Every tile of a form (its texture set), one per file. */
export function tilesOf(f: ColossusFormSpec): ColossusTile[] {
  const all = f.layers.flatMap((l) => Object.values(l.frames).flatMap((fr) => fr.tiles));
  return [...new Map(all.map((t) => [t.file, t])).values()];
}

export const filesOf = (f: ColossusFormSpec): string[] => tilesOf(f).map((t) => t.file);
