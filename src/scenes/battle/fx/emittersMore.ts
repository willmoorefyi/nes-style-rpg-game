/**
 * The remaining emitter kinds (see emitters.ts): `burst` (a central glyph sequence with converging or scattering
 * accents and a status mark), `beam` (a column of light from the sky), `cone` (breath), `projectile` and `chevrons`.
 */
import { anchor, fadeTail, lerp, stepAlpha, type FxDraw, type Kind } from './emitterCore.js';

/** The central glyph plays its frames around the impact (the last one at about impact + 1 step); `hold` keeps a frame
 *  up afterwards. Accents converge on it before the impact, or scatter from it when the impact is 0 (cues). The mark
 *  pops over the head where the status landed. */
export const burst: Kind = (e, o, key) => {
  const b = o.geom.target;
  const c = anchor(b, e.at ?? 'center');
  const main = key(e.glyph);
  const nf = o.frameCount(main);
  const step = Math.min(4, Math.max(2, Math.round((e.frames - e.impact) / nf)));
  const start = Math.max(0, e.impact - 2 * step);
  const big = e.glyph === 'burst' ? 2 : 1;
  const accent = e.accent ? key(e.accent, e.accentRamp) : null;
  const n = e.count ?? 0;
  const out = e.impact === 0;
  const ps = Array.from({ length: n }, (_, i) => ({
    a: out ? (i % 2 ? 0 : Math.PI) + (o.rng() - 0.5) * 0.5 : (i / n) * Math.PI * 2 + o.rng() * 0.5,
    r: out ? 0 : b.w * (0.55 + o.rng() * 0.25), birth: out ? 0 : Math.floor(o.rng() * 4),
  }));
  const mark = e.mark && o.landed ? key(e.mark, e.markRamp) : null;
  const head = anchor(b, 'head');
  return (t) => {
    const draws: FxDraw[] = [];
    if (accent) {
      for (const p of ps) {
        if (out) { // scatter sideways along the ground (dust) or outward
          const u = t / e.frames;
          draws.push({ key: accent, frame: Math.min(o.frameCount(accent) - 1, Math.floor(u * o.frameCount(accent))),
            x: c.x + Math.cos(p.a) * (8 + u * b.w * 0.45), y: c.y - u * 6, scale: 1, alpha: fadeTail(t, e.frames, 4), flipX: p.a > 1 });
        } else if (t >= p.birth && t < e.impact) { // gather in a spiral
          const u = (t - p.birth) / (e.impact - p.birth);
          const a = p.a + u * 1.2;
          draws.push({ key: accent, frame: Math.floor(t / 4) % o.frameCount(accent), x: c.x + Math.cos(a) * p.r * (1 - u),
            y: c.y + Math.sin(a) * p.r * 0.8 * (1 - u), scale: 1, alpha: 1, flipX: false });
        }
      }
    }
    const f = Math.floor((t - start) / step);
    if (t >= start && f < nf) {
      draws.push({ key: main, frame: f, x: c.x, y: c.y, scale: big, alpha: 1, flipX: false });
    } else if (t >= start && e.hold !== undefined) {
      draws.push({ key: main, frame: Math.min(e.hold, nf - 1), x: c.x, y: c.y, scale: big, alpha: fadeTail(t, e.frames, 6), flipX: false });
    }
    if (mark && t >= e.impact) {
      const age = t - e.impact;
      draws.push({ key: mark, frame: Math.floor(age / 6) % o.frameCount(mark), x: head.x, y: head.y - 10 - Math.min(age, 8) * 2,
        scale: 2, alpha: fadeTail(t, e.frames, 6), flipX: false });
    }
    return { draws, screen: 0 };
  };
};

/** A column of light descending from the top of the screen to the target's feet, then withdrawing; feathers spiral
 *  down around the target (LIFE, Phoenix Down). */
export const beam: Kind = (e, o, key) => {
  const b = o.geom.target;
  const feet = anchor(b, 'feet');
  const main = key(e.glyph);
  const tile = 128; // a 32-px tile at scale 2 (x4)
  const tiles = Math.max(1, Math.ceil((feet.y - o.geom.screenTop) / tile));
  const grow = Math.max(1, Math.round(e.impact * 0.6));
  const accent = e.accent ? key(e.accent, e.accentRamp) : null;
  const n = e.count ?? 4;
  const fs = Array.from({ length: n }, (_, i) => ({ birth: Math.round(e.impact * 0.3 + i * 4), phase: (i / n) * Math.PI * 2 }));
  return (t) => {
    const draws: FxDraw[] = [];
    const shown = t < e.impact + 6 ? Math.min(tiles, Math.ceil((t + 1) / grow * tiles))
      : Math.max(0, tiles - Math.floor(((t - e.impact - 6) / Math.max(1, e.frames - e.impact - 10)) * tiles));
    const fromTop = t < e.impact + 6; // grows down from the sky, then withdraws upward
    for (let i = 0; i < shown; i++) {
      const k = fromTop ? i : tiles - shown + i;
      const y = feet.y - tile / 2 - (tiles - 1 - k) * tile;
      draws.push({ key: main, frame: Math.floor(t / 4) % o.frameCount(main), x: feet.x, y, scale: 2,
        alpha: t >= e.impact - 2 && t < e.impact + 2 ? 1 : 0.75, flipX: false });
    }
    if (accent) {
      for (const p of fs) {
        const age = t - p.birth;
        if (age < 0 || t >= e.frames) continue;
        const life = e.frames - p.birth;
        const u = age / life;
        const s = Math.sin(p.phase + u * Math.PI * 3);
        draws.push({ key: accent, frame: Math.cos(p.phase + u * Math.PI * 3) > 0 ? 0 : 1 % o.frameCount(accent),
          x: feet.x + s * b.w * 0.32, y: lerp(b.y - 20, feet.y - b.h * 0.2, u), scale: 1, alpha: fadeTail(age, life, 6), flipX: false });
      }
    }
    return { draws, screen: 0 };
  };
};

/** Breath: fireballs from the actor's mouth (its front, a third of the way down) to the target, widening into a cone
 *  and growing as they fly; the accent bursts on the target at the impact. */
export const cone: Kind = (e, o, key) => {
  const b = o.geom.target;
  const a = o.geom.actor ?? { x: b.x - 400, y: b.y, w: b.w, h: b.h };
  const facesRight = a.x + a.w / 2 < b.x + b.w / 2;
  const mouth = { x: facesRight ? a.x + a.w * 0.85 : a.x + a.w * 0.15, y: a.y + a.h * 0.4 };
  const c = anchor(b, 'center');
  const main = key(e.glyph);
  const nf = o.frameCount(main);
  const n = e.count ?? 6;
  const travel = 10;
  const ps = Array.from({ length: n }, (_, i) => ({ birth: Math.round((i / n) * (e.impact - travel + 4)),
    spread: (o.rng() - 0.5) * b.h * 0.5 }));
  const accent = e.accent ? key(e.accent, e.accentRamp) : null;
  return (t) => {
    const draws: FxDraw[] = [];
    for (const p of ps) {
      const age = t - p.birth;
      if (age < 0 || age >= travel) continue;
      const u = age / travel;
      const f = Math.min(nf - 1, Math.floor(u * nf));
      draws.push({ key: main, frame: f, x: lerp(mouth.x, c.x, u), y: lerp(mouth.y, c.y + p.spread, u),
        scale: u > 0.66 ? 2 : 1, alpha: 1, flipX: !facesRight });
    }
    if (accent && t >= e.impact - 2) {
      const f = Math.floor((t - e.impact + 2) / 3);
      if (f < o.frameCount(accent)) draws.push({ key: accent, frame: f, x: c.x, y: c.y, scale: 2, alpha: 1, flipX: false });
    }
    return { draws, screen: 0 };
  };
};

/** Orbs drawn from the target to the actor along a low arc (a drain). */
export const projectile: Kind = (e, o, key) => {
  const b = o.geom.target;
  const from = anchor(b, 'center');
  const to = o.geom.actor ? anchor(o.geom.actor, 'center') : { x: from.x, y: from.y - 120 };
  const main = key(e.glyph);
  const n = e.count ?? 4;
  const travel = Math.max(6, e.impact - (n - 1) * 3 + 2); // the last orb reaches the caster just after the impact
  return (t) => {
    const draws: FxDraw[] = [];
    for (let i = 0; i < n; i++) {
      const age = t - i * 3;
      if (age < 0 || age >= travel) continue;
      const u = age / travel;
      draws.push({ key: main, frame: Math.floor(t / 4) % o.frameCount(main), x: lerp(from.x, to.x, u),
        y: lerp(from.y, to.y, u) - Math.sin(u * Math.PI) * 40, scale: 1, alpha: 1, flipX: false });
    }
    return { draws, screen: 0 };
  };
};

/** Columns of chevrons streaming up the body (a buff) or down it (`chevron_down`, skulls: a debuff). */
export const chevrons: Kind = (e, o, key) => {
  const b = o.geom.target;
  const c = anchor(b, 'center');
  const main = key(e.glyph);
  const down = e.glyph === 'chevron_down' || e.glyph === 'skull';
  const n = e.count ?? 3;
  const life = 12;
  const every = 6;
  return (t) => {
    const draws: FxDraw[] = [];
    for (let col = 0; col < n; col++) {
      const x = c.x + (col - (n - 1) / 2) * Math.max(20, b.w * 0.18);
      for (let birth = (col % 2) * 3; birth <= e.impact + 4; birth += every) {
        const age = t - birth;
        if (age < 0 || age >= life) continue;
        const u = age / life;
        const y = down ? lerp(c.y - b.h * 0.3, c.y + b.h * 0.15, u) : lerp(c.y + b.h * 0.2, c.y - b.h * 0.3, u);
        draws.push({ key: main, frame: Math.floor(age / 4) % o.frameCount(main), x, y, scale: 1,
          alpha: stepAlpha(Math.min(age / 2, (life - age) / 4)), flipX: false });
      }
    }
    return { draws, screen: 0 };
  };
};
