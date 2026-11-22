import type { Direction } from '../../rendering/SpriteAnimation.js';

/**
 * The airship's heading (docs/AIRSHIP_VIEWS_PLAN.md 3, D-AV4/5/10): pure, shared by the top-down field and the Mode 7
 * flight view so both draw the same frame. Up shows the back 3/4 view, down the front 3/4 view, left and right the side
 * view b_7; the end views lean toward the last horizontal facing (mirrored for left). Between the side and an end view
 * that lean the same way the turn frame shows for TURN_MS; every other change is instant.
 */
export type HeadingEnd = 'side' | 'back' | 'front';

export interface AirshipHeading {
  end: HeadingEnd;
  side: 'left' | 'right';
  /** The end the current turn started from (null: no turn frame), and when it started (ms, the sprites' clock). */
  turnFrom: HeadingEnd | null;
  turnAt: number;
  /** D-AV10: the hero's direction and moving flag seen last frame. */
  seenDir: Direction;
  seenMoving: boolean;
}

export type AirshipFrame = 'airship' | 'airship_back' | 'airship_front' | 'airship_back_turn' | 'airship_front_turn';

export const SIDE_RIGHT: Omit<AirshipHeading, 'seenDir' | 'seenMoving'> = Object.freeze({
  end: 'side', side: 'right', turnFrom: null, turnAt: 0,
});

/** The turn in-between's time (R2: 0 turns it off). */
export const TURN_MS = 100;

/** Start riding: keep the parked heading, and seed what was seen from the hero (boarding changes nothing). */
export function boardHeading(parked: AirshipHeading | null, dir: Direction, moving: boolean): AirshipHeading {
  return { ...(parked ?? SIDE_RIGHT), seenDir: dir, seenMoving: moving };
}

/** The heading `dir` asks for, from `h`. */
function take(h: AirshipHeading, dir: Direction, nowMs: number): AirshipHeading {
  const side = dir === 'left' || dir === 'right' ? dir : h.side;
  const end: HeadingEnd = dir === 'up' ? 'back' : dir === 'down' ? 'front' : 'side';
  if (end === h.end && side === h.side) return h;
  const turns = side === h.side && (end === 'side') !== (h.end === 'side');
  return { ...h, end, side, turnFrom: turns ? h.end : null, turnAt: turns ? nowMs : h.turnAt };
}

/** One frame: take `dir` only if it differs from `seenDir`, or a step starts (`moving && !seenMoving`). */
export function nextHeading(h: AirshipHeading, dir: Direction, moving: boolean, nowMs: number): AirshipHeading {
  const taken = dir !== h.seenDir || (moving && !h.seenMoving) ? take(h, dir, nowMs) : h;
  if (taken === h && dir === h.seenDir && moving === h.seenMoving) return h;
  return { ...taken, seenDir: dir, seenMoving: moving };
}

/** The frame to draw and its mirror. `has` says which frames the sheet holds (a missing one falls back). */
export function headingFrame(h: AirshipHeading, nowMs: number, has: (f: string) => boolean):
  { frame: AirshipFrame; flip: boolean; turning: boolean } {
  const flip = h.side === 'left';
  const endOf = (e: HeadingEnd): AirshipFrame => (e === 'side' ? 'airship' : `airship_${e}`);
  const turning = h.turnFrom !== null && nowMs - h.turnAt < TURN_MS;
  if (turning) {
    const end = h.end === 'side' ? h.turnFrom! : h.end;
    const turn = `airship_${end}_turn` as AirshipFrame;
    if (end !== 'side' && has(turn)) return { frame: turn, flip, turning: true };
  }
  const target = endOf(h.end);
  return { frame: has(target) ? target : 'airship', flip, turning: false };
}
