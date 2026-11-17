/**
 * Shared pieces of the effect emitters (emitters.ts, emittersMore.ts): the types, stepped alpha, the 2-px snap, a
 * seeded RNG, anchor points on a sprite box and small easing helpers. Pure (no PixiJS).
 */
import type { FxEffect } from './fxDefs.js';

/** A screen-space box (the sprite's bounds in the fx layer). */
export interface FxBox { x: number; y: number; w: number; h: number }

export interface FxGeom {
  target: FxBox;
  /** The acting sprite (cone and projectile kinds), or null. */
  actor: FxBox | null;
  /** The top of the screen in the same space (bolts and beams start there). */
  screenTop: number;
}

/** One glyph to draw: its atlas key (`glyph.ramp`), frame, centre, integer scale, stepped alpha and mirror. */
/** `scale` 1.5 only for a colossus's status icons (3x native, C6-6). */
export interface FxDraw { key: string; frame: number; x: number; y: number; scale: 1 | 1.5 | 2; alpha: number; flipX: boolean }

export interface FxFrame {
  draws: FxDraw[];
  /** A full-screen tint this frame (0 = none), in the effect's colour. */
  screen: number;
}

export type Emitter = (t: number) => FxFrame;

/** What an emitter is given besides the effect: where it plays and whether its status landed. */
export interface EmitterOptions {
  geom: FxGeom;
  rng: () => number;
  /** Frames per glyph (from the atlas); unknown glyphs count as 1. */
  frameCount: (key: string) => number;
  /** The effect's status landed on this target (inflict_*: the mark pops). */
  landed?: boolean;
  /** Screen flashes allowed for this target (only the first target of a cast flashes). */
  flashes?: number;
}

export const STEPS = [0, 0.25, 0.5, 0.75, 1] as const;
export const stepAlpha = (a: number): number => Math.round(Math.min(1, Math.max(0, a)) * 4) / 4;
export const snap2 = (v: number): number => Math.round(v / 2) * 2;

/** A small deterministic RNG (mulberry32). */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The body inside a sprite's bounds: battle art stands on the bottom of a square cell with empty space above and
 *  beside it, so the body is the cell's lower 62 % and middle 70 % (ActionFx's target box). */
export function bodyBox(b: { x: number; y: number; width: number; height: number }): FxBox {
  return { x: b.x + b.width * 0.15, y: b.y + b.height * 0.33, w: b.width * 0.7, h: b.height * 0.62 };
}

/** Anchor points on a box: the art sits in the lower part of its cell, feet near the bottom. */
export function anchor(b: FxBox, at: string | undefined): { x: number; y: number } {
  const cx = b.x + b.w / 2;
  switch (at) {
    case 'top': return { x: b.x + b.w * 0.55, y: b.y + b.h * 0.12 };
    case 'head': return { x: cx, y: b.y + b.h * 0.25 };
    case 'feet': return { x: cx, y: b.y + b.h * 0.92 };
    case 'front': return { x: b.x + b.w * 0.85, y: b.y + b.h * 0.92 };
    default: return { x: cx, y: b.y + b.h * 0.55 };
  }
}

/** Fades out over the last `tail` frames of a life of `life` frames (u = age). */
export function fadeTail(age: number, life: number, tail = 4): number {
  return stepAlpha(Math.min(1, (life - age) / tail));
}

export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

/** The highest an effect point may be drawn, below the screen top: 4 px under the message window (TRAVEL_CLEAR_Y).
 *  A tall box (tier H 384 px, the titan's 600) would put shard starts and spiral accents above it (REDESIGN_PLAN 2.5). */
export const FX_CLEAR_TOP = 124;
/** `y` kept at or below the clear top of the geometry's screen. */
export const clampTop = (y: number, o: Pick<EmitterOptions, 'geom'>): number => Math.max(o.geom.screenTop + FX_CLEAR_TOP, y);


export type Kind = (e: FxEffect, o: EmitterOptions, key: (glyph: string | undefined, ramp?: string) => string) => Emitter;
