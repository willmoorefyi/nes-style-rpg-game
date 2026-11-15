/**
 * The looping status overlays (docs/FEEDBACK_PLAN_2026-11-14.md §3.5), named by `overlay` in status-visuals.yaml:
 * pure functions of the overlay's age and the actor's head and body box, returning glyph draws for fxRender's FxBatch
 * (integer scale 1, 2-px grid, stepped alpha, mirrored only; no rotation, no filters). No PixiJS.
 */
import { fadeTail, stepAlpha, type FxBox, type FxDraw } from './emitterCore.js';

/** Where an overlay plays: the head (topmost opaque row's centre), the body box, and which way the actor faces
 *  (1: right, the enemies; -1: left, the party). */
export interface StatusAnchor { head: { x: number; y: number }; box: FxBox; facing: 1 | -1 }

export type StatusOverlay = (t: number, a: StatusAnchor) => FxDraw[];

const draw = (key: string, frame: number, x: number, y: number, alpha = 1, flipX = false): FxDraw =>
  ({ key, frame, x: Math.round(x), y: Math.round(y), scale: 1, alpha: stepAlpha(alpha), flipX });

/** Ages of the particles spawned every `every` frames that are younger than `life` (oldest first). */
function ages(t: number, every: number, life: number): number[] {
  const out: number[] = [];
  for (let s = Math.max(0, Math.floor((t - life + 1) / every) * every); s <= t; s += every) if (t - s < life) out.push(t - s);
  return out;
}

/** k points evenly on an ellipse round the head, `period` frames per turn. */
function orbit(t: number, a: StatusAnchor, k: number, n: number, period: number, rx: number, ry: number) {
  const ang = 2 * Math.PI * (t / period + k / n);
  return { x: a.head.x + Math.cos(ang) * rx, y: a.head.y + Math.sin(ang) * ry };
}

/** SLEEP: Z glyphs rising from the head, small -> large, one every 40 frames (each lives 80). */
const zzz: StatusOverlay = (t, a) => ages(t, 40, 80).map((age) => {
  const frame = age < 26 ? 0 : age < 52 ? 1 : 2;
  const x = a.head.x + a.facing * (12 + age * 0.35) + (Math.floor(age / 12) % 2) * 2;
  return draw('z.sleep', frame, x, a.head.y - 10 - age * 0.75, Math.min(age < 4 ? 0.5 : 1, fadeTail(age, 80, 12)));
});

/** STUN: 3 stars orbiting the head, 48 frames per turn. */
const stars: StatusOverlay = (t, a) => [0, 1, 2].map((k) => {
  const p = orbit(t, a, k, 3, 48, Math.max(20, a.box.w * 0.3), 6);
  return draw('star.stun', (Math.floor(t / 6) + k) % 2, p.x, p.y + 2);
});

/** POISON: 3 green bubbles rising from the body, each popping after 30 frames (60-frame cycle, staggered 20). */
const bubbles: StatusOverlay = (t, a) => [0, 1, 2].flatMap((k) => {
  if (t < k * 20) return [];
  const age = (t - k * 20) % 60;
  if (age >= 36) return [];
  const x = a.box.x + a.box.w * (0.3 + 0.2 * k) + (Math.floor(age / 8) % 2) * 2;
  const y = a.box.y + a.box.h * 0.6 - Math.min(age, 30) * 1.5;
  return [draw('bubble.poison', age < 30 ? 0 : 1, x, y)];
});

/** BLIND: 2 dark ink puffs drifting slowly round the head. */
const ink: StatusOverlay = (t, a) => [0, 1].map((k) => {
  const p = orbit(t, a, k, 2, 120, Math.max(18, a.box.w * 0.3), 6);
  return draw('ink.blind', Math.floor(t / 20 + k) % 2, p.x, p.y + 4, 0.75);
});

/** SILENCE: a speech bubble with "..." struck through in red, bobbing 2 px in front of the face. */
const mute: StatusOverlay = (t, a) => [draw('ellipsis.icon', 0, a.head.x + a.facing * (Math.max(20, a.box.w * 0.3) + 10),
  a.head.y - 12 - (Math.floor(t / 20) % 2) * 2, 1, a.facing < 0)];

/** FEAR: blue sweat drops falling from the head, one every 18 frames on alternate sides. */
const sweat: StatusOverlay = (t, a) => ages(t, 18, 24).map((age) => {
  const side = Math.floor((t - age) / 18) % 2 === 0 ? 1 : -1;
  return draw('sweat.ether', 0, a.head.x + side * Math.max(14, a.box.w * 0.2), a.head.y + 6 + age, fadeTail(age, 24, 8));
});

/** FROZEN (reserved): frost crystals twinkling at the body box's corners. */
const frost: StatusOverlay = (t, a) => [[0.1, 0.1], [0.9, 0.15], [0.12, 0.85], [0.88, 0.9]].map(([u, v], k) =>
  draw('sparkle.ice', Math.floor((t + k * 7) / 8) % 3, a.box.x + a.box.w * u, a.box.y + a.box.h * v));

/** CONFUSE (reserved): 2 question marks circling the head. */
const confuse: StatusOverlay = (t, a) => [0, 1].map((k) => {
  const p = orbit(t, a, k, 2, 64, Math.max(20, a.box.w * 0.3), 6);
  return draw('question.icon', 0, p.x, p.y - 10);
});

export const STATUS_OVERLAYS: Readonly<Record<string, StatusOverlay>> = { zzz, stars, bubbles, ink, mute, sweat, frost, confuse };

/** Every atlas key each overlay draws (the data test checks them against battle-fx.json). */
export const OVERLAY_GLYPHS: Readonly<Record<string, readonly string[]>> = {
  zzz: ['z.sleep'], stars: ['star.stun'], bubbles: ['bubble.poison'], ink: ['ink.blind'], mute: ['ellipsis.icon'],
  sweat: ['sweat.ether'], frost: ['sparkle.ice'], confuse: ['question.icon'],
};
