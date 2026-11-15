/**
 * Particle emitters for the battle effects (docs/FEEDBACK_PLAN_2026-11-14.md §3.4). Pure: an emitter is a function of
 * the effect's local frame that lists the glyphs to draw; no PixiJS. Randomness comes from a seeded RNG drawn once at
 * creation, so the same seed gives the same frames.
 *
 * Pixel rules: glyph scales are integers (1 = the atlas's x2, 2 = x4), there is no rotation (frames are baked),
 * alpha is stepped (0, .25, .5, .75, 1) and every position is snapped to the 2-px grid by the renderer.
 */
import type { FxEffect } from './fxDefs.js';
import { anchor, fadeTail, lerp, stepAlpha, type EmitterOptions, type Emitter, type FxDraw, type Kind } from './emitterCore.js';
import { burst, beam, cone, projectile, chevrons } from './emittersMore.js';

export * from './emitterCore.js';

/** Particles rising from the feet (flames, sparkles), with the accent (heat shimmer, healing halo) over them. */
const rise: Kind = (e, o, key) => {
  const { target: b } = o.geom;
  const n = e.count ?? 5;
  const main = key(e.glyph);
  const nf = o.frameCount(main);
  const feet = anchor(b, 'feet');
  const ps = Array.from({ length: n }, (_, i) => {
    const birth = i === 0 ? 0 : Math.round((i / n) * e.impact * 0.6 + o.rng() * 2);
    return {
      birth, life: Math.max(8, e.impact - birth + 6 + Math.round(o.rng() * 6)),
      x: feet.x + (o.rng() - 0.5) * b.w * 0.6, y: feet.y - o.rng() * b.h * 0.12,
      dist: b.h * (0.35 + o.rng() * 0.35), phase: Math.floor(o.rng() * 8), big: e.scale === 2 && i % 2 === 0,
    };
  });
  const accent = e.accent ? key(e.accent, e.accentRamp) : null;
  const center = anchor(b, 'center');
  return (t) => {
    const draws: FxDraw[] = [];
    if (accent && e.accent === 'glow' && t >= e.impact - 14) {
      const age = t - (e.impact - 14);
      draws.push({ key: accent, frame: Math.floor(age / 5) % o.frameCount(accent), x: center.x, y: center.y, scale: 1,
        alpha: stepAlpha(Math.min(age / 8, 1, (e.frames - t) / 8)), flipX: false });
    }
    for (const p of ps) {
      const age = t - p.birth;
      if (age < 0 || age >= p.life) continue;
      const u = age / p.life;
      const sway = e.glyph === 'flame' ? 0 : [0, 2, 4, 2, 0, -2, -4, -2][(Math.floor(age / 3) + p.phase) % 8];
      draws.push({ key: main, frame: (Math.floor(age / 4) + p.phase) % nf, x: p.x + sway, y: p.y - p.dist * u,
        scale: p.big ? 2 : 1, alpha: fadeTail(age, p.life), flipX: p.phase % 2 === 1 });
    }
    if (accent && e.accent === 'shimmer' && t >= 4 && t < e.frames - 4) {
      for (let k = 0; k < 2; k++) {
        draws.push({ key: accent, frame: Math.floor(t / 4) % o.frameCount(accent), x: center.x + (k ? 20 : -20),
          y: center.y + b.h * 0.1, scale: 2, alpha: 0.5, flipX: k === 1 });
      }
    }
    return { draws, screen: 0 };
  };
};

/** Shards falling and converging on the target, then the accent burst (frost) at the impact. */
const fall: Kind = (e, o, key) => {
  const b = o.geom.target;
  const c = anchor(b, 'center');
  const n = e.count ?? 5;
  const main = key(e.glyph);
  const ps = Array.from({ length: n }, (_, i) => {
    const side = (i / Math.max(1, n - 1)) * 2 - 1;
    return { x0: c.x + side * b.w * 0.7, y0: c.y - b.h * (0.9 + o.rng() * 0.4), birth: Math.round(i * 2 + o.rng() * 3),
      x1: c.x + side * b.w * 0.12, y1: c.y + (o.rng() - 0.5) * b.h * 0.2, big: e.scale === 2 && i % 2 === 1 };
  });
  const arrive = e.impact - 1;
  const burst = e.accent ? key(e.accent, e.accentRamp) : null;
  return (t) => {
    const draws: FxDraw[] = [];
    for (const p of ps) {
      if (t < p.birth || t >= arrive) continue;
      const u = (t - p.birth) / (arrive - p.birth);
      draws.push({ key: main, frame: Math.floor(t / 4) % o.frameCount(main), x: lerp(p.x0, p.x1, u * u),
        y: lerp(p.y0, p.y1, u * u), scale: p.big ? 2 : 1, alpha: 1, flipX: p.x0 > c.x });
    }
    if (burst && t >= arrive) {
      const age = t - arrive;
      const nf = o.frameCount(burst);
      const f = Math.floor(age / 3);
      if (f < nf) draws.push({ key: burst, frame: f, x: c.x, y: c.y, scale: 2, alpha: 1, flipX: false });
    }
    return { draws, screen: 0 };
  };
};

/** A bolt from the top of the screen, in two flickers (the second at the impact), sparks and one screen tint. */
const bolt: Kind = (e, o, key) => {
  const b = o.geom.target;
  const c = anchor(b, 'center');
  const seg = key(e.glyph);
  const segH = 64; // a 16-px glyph at scale 2 (x4)
  const count = Math.max(1, Math.ceil((c.y - o.geom.screenTop) / segH));
  const looks = [0, 1].map(() => Array.from({ length: count }, () => ({ f: Math.floor(o.rng() * 3), flip: o.rng() < 0.5 })));
  const spark = e.accent ? key(e.accent, e.accentRamp) : null;
  const sparks = Array.from({ length: e.count ?? 4 }, (_, i) => ({ a: (i / (e.count ?? 4)) * Math.PI * 2 + o.rng() * 0.6 }));
  const flashes = Math.min(2, o.flashes ?? 0, e.flash ?? 0);
  return (t) => {
    const draws: FxDraw[] = [];
    const w = t >= e.impact - 6 && t < e.impact - 3 ? 0 : t >= e.impact && t < e.impact + 6 ? 1 : -1;
    if (w >= 0) {
      looks[w].forEach((l, i) => draws.push({ key: seg, frame: l.f % o.frameCount(seg), x: c.x,
        y: c.y - segH / 2 - i * segH, scale: 2, alpha: 1, flipX: l.flip }));
    }
    if (spark && t >= e.impact && t < e.impact + 10) {
      const age = t - e.impact;
      for (const s of sparks) {
        draws.push({ key: spark, frame: Math.floor(age / 3) % o.frameCount(spark), x: c.x + Math.cos(s.a) * age * 5,
          y: c.y + Math.sin(s.a) * age * 4, scale: 1, alpha: fadeTail(age, 10), flipX: false });
      }
    }
    let screen = 0;
    for (let k = 0; k < flashes; k++) if (t >= e.impact + k * 8 && t < e.impact + k * 8 + 3) screen = 0.25;
    return { draws, screen };
  };
};

/** Rings expanding from the target, then sparkles (holy). */
const ring: Kind = (e, o, key) => {
  const b = o.geom.target;
  const c = anchor(b, 'center');
  const main = key(e.glyph);
  const nf = o.frameCount(main);
  const n = e.count ?? 3;
  const spark = e.accent ? key(e.accent, e.accentRamp) : null;
  const twinkles = Array.from({ length: 6 }, () => ({ x: b.x + b.w * (0.15 + o.rng() * 0.7), y: b.y + b.h * (0.2 + o.rng() * 0.7),
    birth: e.impact - 4 + Math.floor(o.rng() * 8) }));
  const step = 3;
  const first = Math.max(0, e.impact - (n - 1) * 5 - nf * step + step);
  return (t) => {
    const draws: FxDraw[] = [];
    for (let k = 0; k < n; k++) {
      const age = t - (first + k * 5);
      const f = Math.floor(age / step);
      if (age >= 0 && f < nf) draws.push({ key: main, frame: f, x: c.x, y: c.y, scale: 2, alpha: f === nf - 1 ? 0.5 : 1, flipX: false });
    }
    if (spark) {
      for (const s of twinkles) {
        const age = t - s.birth;
        if (age >= 0 && age < 12) draws.push({ key: spark, frame: Math.floor(age / 4) % o.frameCount(spark), x: s.x, y: s.y,
          scale: 1, alpha: fadeTail(age, 12), flipX: false });
      }
    }
    return { draws, screen: 0 };
  };
};

/** Glyphs circling the head (stars); for overlays and future effects. */
const orbit: Kind = (e, o, key) => {
  const b = o.geom.target;
  const h = anchor(b, 'head');
  const main = key(e.glyph);
  const n = e.count ?? 3;
  return (t) => ({
    screen: 0,
    draws: Array.from({ length: n }, (_, i) => {
      const a = (t / 24 + i / n) * Math.PI * 2;
      return { key: main, frame: Math.floor(t / 6) % o.frameCount(main), x: h.x + Math.cos(a) * b.w * 0.25,
        y: h.y + Math.sin(a) * b.w * 0.08, scale: 1 as const, alpha: fadeTail(t, e.frames, 6), flipX: false };
    }),
  });
};

const KINDS: Record<FxEffect['kind'], Kind> = { rise, fall, bolt, ring, orbit, burst, beam, cone, projectile, chevrons };

/** The emitter for one target of an effect. */
export function createEmitter(e: FxEffect, o: EmitterOptions): Emitter {
  const key = (glyph: string | undefined, ramp?: string): string => `${glyph ?? 'spark'}.${ramp ?? e.ramp ?? 'holy'}`;
  return KINDS[e.kind](e, o, key);
}

