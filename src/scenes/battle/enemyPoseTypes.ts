/** The shapes EnemyPoseController works with (moved out of it for pass K, docs/KNEEL_PLAN.md 6). Pure, no PixiJS. */
import { DEFAULT_LUNGE_PX, type MonsterFrame, type Posture } from './enemyChoreography.js';
import type { AttackKind } from './enemyAttackTables.js';
import type { KneelTrack } from './kneelChoreography.js';

export type Mode = 'idle' | 'attack' | 'cast' | 'hurt' | 'dying';

export interface EnemyAnimConfig {
  hasCast: boolean;
  /** The sheet has its own `attack_raise` keyframe (the heavy attack, pass F item 7). */
  hasRaise: boolean;
  lungePx: number;
  scaleFactor: number;
  breath: boolean;
  /** `attackAnim: heavy` (Garland, the lich): the raised-hold attack. */
  heavy: boolean;
  /** Travel hop in px at scale factor 1 (10 small, 6 large, 3 boss). */
  hopPx: number;
  /** EF-D: the atlas `idleOrbit` steps (0: no orbit frames, the plain idle). */
  orbit: number;
}

/** Where an attack goes: the travel (absolute screen px, toward the party) and the rise to the target's feet. */
export interface AttackPlan { travel: number; rise: number }

/** Animation cues: `hold` when an attack's held telegraph starts, `contact` on its contact frame. */
export type PoseCue = 'hold' | 'contact';

export interface EnemyState extends EnemyAnimConfig {
  mode: Mode;
  t: number;
  posture: Posture;
  /** D-K16: a fear-like status trembles on top of the posture (not stone or daze). */
  trembles: boolean;
  /** The kneel (daze or poison, D-K1), its rise to act (D-K3), a kneeler's hit shake (frames in, null: none). */
  track: KneelTrack;
  rising: boolean;
  shake: number | null;
  /** Unscaled offset when the lethal hit landed (dying eases from it). */
  from: { dx: number; dy: number };
  /** Where in the dying in-phase it began (E13). */
  start: number;
  /** A kneeler dies from its kneel frame (D-K2 enemy row 1), with the sink it had. */
  dyingFrame: MonsterFrame | null;
  dyingSink: number;
  /** The current attack's contact frame, held-telegraph start (null: none) and length, set when it starts. */
  contactAt: number;
  holdAt: number | null;
  totalFrames: number;
  /** Absolute screen px the current attack travels (unscaled; 0 = in place), and its table. */
  travel: { dx: number; dy: number };
  kind: AttackKind;
  /** The travel offset held while dying away from home (no ease back across the screen). */
  held: { dx: number; dy: number };
}

/** The frame to show and the screen offset: `dx` / `dy` are the lunge, recoil and shake (scaled by the layout factor,
 *  rounded once); `travelDx` / `travelDy` are the attack's travel in absolute screen px (unscaled), omitted while 0. */
export interface PoseState {
  pose: MonsterFrame;
  dx: number;
  dy: number;
  travelDx?: number;
  travelDy?: number;
}

export const DEFAULTS: EnemyAnimConfig = { hasCast: false, hasRaise: false, lungePx: DEFAULT_LUNGE_PX, scaleFactor: 1,
  breath: true, heavy: false, hopPx: 10, orbit: 0 };
export const ZERO = { dx: 0, dy: 0 };
