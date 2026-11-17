/**
 * The hero battle pose (docs/KNEEL_PLAN.md D-K2, D-K3, D-K17), pure (no PixiJS): `partyPoseOf` is the priority table,
 * `kneelCommand` what a member's KneelTrack does now, PartyKneel the per-member state BattleDisplayManager keeps.
 * Rows: 1 down | 2 stone / still: ready | 3 daze: the kneel | 4 victory (an acting kneeler stands up first) | 5 the
 * override (an acting kneeler rises in its first 6 frames) | 6 hurt (a kneeler shakes instead) | 7 acting kneel | 8 idle.
 */
import type { BattlePose } from '../../rendering/CharacterAtlas.js';
import type { StatusPosture } from '../../types/fxData.js';
import { HERO_SHAKE, KneelTrack, isWeak, kneelShake, riseFrame, type KneelFrame } from './kneelChoreography.js';

/** The hurt flash on a standing hero. */
export const HURT_FRAMES = 24;

/** What the pose is decided from (the presented snapshot). */
export interface PoseFacts { hp: number; maxHp: number; posture: StatusPosture; victory: boolean }

/** The facts plus the override (its age, and whether it began from an acting kneel: latched), the hurt flash, the
 *  KneelTrack's frame (null: standing) and the breathing idle frame. */
export interface PoseInput extends PoseFacts {
  override: BattlePose | null; overrideAge: number; rising: boolean; hurt: boolean; kneel: KneelFrame | null; idle: BattlePose;
}

/** D-K1: an acting kneel (it rises to act): poison or weak HP, and nothing stronger (stone, still, daze). */
export function actingKneel(f: Pick<PoseFacts, 'hp' | 'maxHp' | 'posture'>): boolean {
  const p = f.posture;
  return p !== 'stone' && p !== 'still' && p !== 'daze' && (p === 'kneel' || isWeak(f.hp, f.maxHp));
}

/** D-K2: the first row that matches wins. */
export function partyPoseOf(p: PoseInput): BattlePose {
  if (p.hp <= 0) return 'down';
  if (p.posture === 'stone' || p.posture === 'still') return 'ready';
  if (p.posture === 'daze') return p.kneel ?? 'ready';
  if (p.victory) return p.kneel ?? 'victory';
  if (p.override) return (p.rising && riseFrame(p.overrideAge)) || p.override;
  if (p.kneel) return p.kneel;
  return p.hurt ? 'hurt' : p.idle;
}

/** What the track does: `on` (kneel) or off, `hold` snaps (no transition), `fromHold` stands up from the hold. */
export interface KneelCommand { on: boolean; hold: boolean; fromHold?: boolean }

/**
 * Rows (a) a battle start / retry kneels in hold; (c) a revive into a trigger kneels in hold, above it stands up from
 * the crouch; (d) a standing hero's hurt flash plays before `in`; an override cuts the kneel (the rise replaces it).
 */
export function kneelCommand(p: PoseFacts & { override: boolean; hurt: boolean; kneeling: boolean },
  ctx: { first: boolean; wasDown: boolean }): KneelCommand {
  if (p.hp <= 0 || p.posture === 'stone' || p.posture === 'still') return { on: false, hold: true };
  const daze = p.posture === 'daze';
  const want = daze || (!p.victory && !p.override && actingKneel(p) && (p.kneeling || !p.hurt));
  if (ctx.first || (ctx.wasDown && want)) return { on: want, hold: true };
  if (ctx.wasDown) return { on: false, hold: false, fromHold: true };
  if (p.override && !daze) return { on: false, hold: true };
  return { on: want, hold: false };
}

/** The members who lost HP between two presented snapshots and still stand. */
export function hpLosses(before: readonly { hp: number }[], after: readonly { hp: number }[]): number[] {
  return after.flatMap((a, i) => (a.hp > 0 && a.hp < (before[i]?.hp ?? a.hp) ? [i] : []));
}

interface Member { track: KneelTrack; first: boolean; wasDown: boolean; disabled: boolean;
  override: { start: number; rising: boolean } | null; hurt: number; shake: number | null }

/** Per-member kneel state on the display's clock. */
export class PartyKneel {
  private readonly members: Member[] = [];
  private clock = 0;
  private started = false;

  /** Row (a): on the first frame the status visuals are known (they load late) every kneel snaps (no `in` at a battle
   *  start or retry). True on that frame (the enemies then snap too). */
  start(ready: boolean): boolean {
    if (this.started || !ready) return false;
    this.started = true;
    for (const m of this.members) if (m) m.first = true;
    return true;
  }

  private m(i: number): Member {
    return (this.members[i] ??= { track: new KneelTrack(i), first: true, wasDown: false, disabled: false, override: null,
      hurt: 0, shake: null });
  }

  /** Advance the clock: the flash and the shake run down. */
  tick(dt: number): void {
    this.clock += dt;
    for (const m of this.members.filter(Boolean)) {
      m.hurt = Math.max(0, m.hurt - dt);
      if (m.shake !== null) m.shake = m.shake + dt < HERO_SHAKE.frames ? m.shake + dt : null;
    }
  }

  /** D-K3: the member's action rises (its override began from an acting kneel; before it starts: it would). */
  isRising(i: number): boolean { const m = this.m(i); return m.override ? m.override.rising : this.actingNow(m); }

  /** A hit: the 24-frame hurt flash on a standing hero, the +-2 px shake on a kneeler or an override pose (D-K17). */
  hit(i: number, flash = true): void {
    const m = this.m(i);
    if (m.override || m.track.frame(this.clock) !== null) m.shake = -1;   // local 0 on the next frame shown
    else if (flash) m.hurt = HURT_FRAMES;
  }

  /** Bring the override and the track up to date with the facts, then the pose to show. An override's start latches
   *  whether it rises from an acting kneel (before the kneel is cut). */
  pose(i: number, f: PoseFacts, idle: BattlePose, override: BattlePose | null): BattlePose {
    const m = this.m(i);
    if (!override) m.override = null;
    else if (!m.override) m.override = { start: this.clock, rising: this.actingNow(m) };
    const kneeling = m.track.frame(this.clock) !== null;
    const cmd = kneelCommand({ ...f, override: !!override, hurt: m.hurt > 0, kneeling }, { first: m.first, wasDown: m.wasDown });
    if (cmd.fromHold) m.track.set(true, this.clock, { hold: true });
    m.track.set(cmd.on, this.clock, { hold: cmd.hold });
    Object.assign(m, { first: false, wasDown: f.hp <= 0, disabled: f.posture === 'daze' });
    const o = m.override;
    return partyPoseOf({ ...f, override, overrideAge: o ? this.clock - o.start : 0, rising: !!o?.rising, hurt: m.hurt > 0,
      kneel: m.track.frame(this.clock), idle });
  }

  /** The shake offset (screen px) now. */
  shakeDx(i: number): number { const s = this.members[i]?.shake; return s === null || s === undefined ? 0 : kneelShake(s, HERO_SHAKE); }

  /** The kneel phase's frames (or the override's age) for the dev pose label. */
  localT(i: number): number { const m = this.m(i); return m.override ? this.clock - m.override.start : m.track.local(this.clock); }

  private actingNow(m: Member): boolean { return !m.disabled && m.track.frame(this.clock) !== null; }
}
