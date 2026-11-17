/**
 * Travelling enemy attacks (docs/FEEDBACK_PLAN_2026-11-14.md items 3 and 7): pure frame tables, no PixiJS, beside the
 * in-place tables in enemyChoreography.ts (the in-place ATTACK stays the ranged / no-target table).
 */
import { ATTACK_CONTACT, ATTACK_FRAMES, attackAt, ease, type Ease, type FrameAt, type MonsterFrame } from './enemyChoreography.js';
import { riseEnd, riseTime } from './kneelChoreography.js';

/**
 * Travelling attacks (pass F item 3, item 7). A frame gives the lunge part in fractions of L (`lunge`), the travel
 * progress `k` (0 home, 1 at the target: travelDx = travel x k, travelDy = rise x k) and a hop in px at scale 1.
 * MELEE_ATTACK: wind, travel N, strike (contact = 14 + N), follow, return; 47 + N frames.
 * HEAVY_ATTACK (`attackAnim: heavy`): travel N, raise, an 18-frame held telegraph (`hold` cue), swing, slam (contact =
 * N + 29, `contact` cue), follow, return; N + 69 frames. Without an `attack_raise` keyframe it coils in `atk_wind2`.
 */
export type AttackKind = 'inplace' | 'melee' | 'heavy';
export interface TravelFrameAt extends FrameAt { k: number }
interface Phase { len: number; frame: (local: number) => MonsterFrame; lunge: [number, number, Ease?]; k: (p: number) => number;
  hop?: (local: number, p: number) => number }
const easeIn = (p: number) => p * p;
const at = (v: number) => () => v;
const alt = (a: MonsterFrame, b: MonsterFrame) => (local: number): MonsterFrame => (Math.floor(local / 4) % 2 === 0 ? a : b);
const one = (f: MonsterFrame) => () => f;
/** Hops over the travel: about one per 8 frames, each an arc of `h` px. */
const hops = (n: number, h: number) => (_: number, p: number) => -h * Math.abs(Math.sin(Math.PI * Math.max(1, Math.round(n / 8)) * p));
const RETURN_LEN = 16;
/** Return progress, reaching 1 on the return's last frame (so that frame is home). */
const q = (p: number) => Math.min(1, (p * RETURN_LEN) / (RETURN_LEN - 1));
const returnHop = (h: number) => (_: number, p: number) => -h * Math.sin(Math.PI * q(p));
/** The return eases out: travel progress 1 → 0. */
const back = (p: number) => (1 - q(p)) * (1 - q(p));
export const HEAVY_HOLD_FRAMES = 18;

/** Travel frames for a travel of `px` screen px: clamp(round(8 + px / 60), 10, 24). */
export function travelFrames(px: number): number {
  return Math.max(10, Math.min(24, Math.round(8 + px / 60)));
}

function meleePhases(n: number, hop: number): Phase[] {
  return [
    { len: 5, frame: one('atk_wind1'), lunge: [0, -1 / 6, 'out'], k: at(0) },
    { len: 6, frame: one('atk_wind2'), lunge: [-1 / 6, -1 / 4], k: at(0) },
    { len: n, frame: alt('atk_wind2', 'atk_mid'), lunge: [-1 / 4, -1 / 4], k: easeIn, hop: hops(n, hop) },
    { len: 3, frame: one('atk_mid'), lunge: [-1 / 4, 0.75, 'in'], k: at(1) },
    { len: 2, frame: one('attack'), lunge: [0.75, 1], k: at(1) },
    { len: 6, frame: one('attack'), lunge: [1, 1], k: at(1) },
    { len: 4, frame: one('atk_follow'), lunge: [1, 0.58], k: at(1) },
    { len: 5, frame: one('atk_recover'), lunge: [0.58, 0], k: at(1) },
    { len: RETURN_LEN, frame: (l) => (l < 5 ? 'atk_recover' : 'idle'), lunge: [0, 0], k: back, hop: returnHop(8) },
  ];
}

/** The heavy attack's travel hop (a boss stalks in; px at scale factor 1). */
const HEAVY_HOP = 3;

function heavyPhases(n: number, raise: boolean): Phase[] {
  const hop = HEAVY_HOP;
  return [
    { len: n, frame: alt('atk_wind1', 'atk_wind2'), lunge: [0, 0], k: easeIn, hop: hops(n, hop) },
    { len: 6, frame: one(raise ? 'atk_raise_in' : 'atk_wind1'), lunge: [0, -1 / 6, 'out'], k: at(1) },
    { len: HEAVY_HOLD_FRAMES, frame: raise ? alt('attack_raise', 'atk_raise_b') : one('atk_wind2'), lunge: [-1 / 6, -1 / 4], k: at(1) },
    { len: 3, frame: one(raise ? 'atk_swing' : 'atk_mid'), lunge: [-1 / 4, 0.3, 'in'], k: at(1) },
    { len: 2, frame: one(raise ? 'atk_swing2' : 'atk_mid'), lunge: [0.3, 0.75], k: at(1) },
    { len: 2, frame: one('attack'), lunge: [0.75, 1], k: at(1) },
    { len: 10, frame: one('attack'), lunge: [1, 1], k: at(1) },
    { len: 6, frame: one('atk_follow'), lunge: [1, 0.58], k: at(1) },
    { len: 6, frame: one('atk_recover'), lunge: [0.58, 0], k: at(1) },
    { len: RETURN_LEN, frame: one('idle'), lunge: [0, 0], k: back, hop: n > 0 ? returnHop(hop) : undefined },
  ];
}

/** Contact frame, held-telegraph start (null: none) and length of an attack of `kind` travelling `travel` px. */
export function attackTable(kind: AttackKind, travel: number): { n: number; contactAt: number; holdAt: number | null; total: number } {
  if (kind === 'inplace') return { n: 0, contactAt: ATTACK_CONTACT, holdAt: null, total: ATTACK_FRAMES };
  const n = travel > 0 ? travelFrames(travel) : 0;
  return kind === 'melee' ? { n, contactAt: 14 + n, holdAt: null, total: 47 + n } : { n, contactAt: n + 29, holdAt: n + 6, total: n + 69 };
}

/** Frame, lunge (dx in px of L, unscaled), hop (dy, unscaled) and travel progress t frames into an attack. `rise`
 *  (D-K3): a kneeler rising to act; dx, dy and k hold their frame-0 value for t < 6 and are compressed into the window
 *  [6, E) (E: the first phase boundary at or after frame 12); frame names and every boundary run on raw t. */
export function travelAttackAt(kind: AttackKind, t: number,
  o: { lunge: number; travel: number; hop: number; hasRaise: boolean; rise?: boolean }): TravelFrameAt {
  if (kind === 'inplace') return { ...attackAt(t, o.lunge, { rise: o.rise }), k: 0 };
  const { n } = attackTable(kind, o.travel);
  const phases = kind === 'melee' ? meleePhases(n, o.hop) : heavyPhases(n, o.hasRaise);
  const f = phaseAt(phases, t, o.lunge);
  return o.rise ? { ...phaseAt(phases, riseTime(t, riseEnd(phases.map((p) => p.len))), o.lunge), frame: f.frame } : f;
}

function phaseAt(phases: Phase[], t: number, lunge: number): TravelFrameAt {
  let start = 0;
  for (const ph of phases) {
    if (ph.len > 0 && t < start + ph.len) {
      const local = Math.max(0, t - start);
      const p = local / ph.len;
      const [a, b, e] = ph.lunge;
      return { frame: ph.frame(local), dx: (a + (b - a) * ease(p, e)) * lunge, dy: ph.hop?.(local, p) ?? 0, k: ph.k(p) };
    }
    start += ph.len;
  }
  return { frame: 'idle', dx: 0, dy: 0, k: 0 };
}
