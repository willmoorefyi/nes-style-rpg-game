/**
 * Battle effect and status-visual data (assets/data/spell-effects.yaml, assets/data/status-visuals.yaml;
 * docs/FEEDBACK_PLAN_2026-11-14.md §3.4, §3.5). Loaded by DataLoader, validated by core/schemaValidationFx.ts.
 */

/** Particle and sprite kinds the effect engine draws. */
export const EFFECT_KINDS = ['rise', 'fall', 'bolt', 'ring', 'orbit', 'burst', 'beam', 'cone', 'projectile', 'chevrons'] as const;
export type EffectKind = typeof EFFECT_KINDS[number];

/** One effect: its emitter kind, length and impact frame (the number and the result land on it). */
export interface EffectDef {
  kind: EffectKind;
  /** Frames the effect lasts (60 fps). */
  frames: number;
  /** Frame of the hit: 0 <= impact < frames. */
  impact: number;
  /** Glyph name in the fx atlas (battle-fx.json). */
  glyph?: string;
  /** Palette ramp name (assets-src/snes_palette.py). */
  ramp?: string;
  /** Particles per target. */
  count?: number;
}

export interface SpellEffectsData {
  effects: Record<string, EffectDef>;
  /** Spell id -> effect id. */
  spells: Record<string, string>;
  /** Battle item id -> effect id. */
  items: Record<string, string>;
  /** A ranged enemy attack's `attackEffect` -> effect id. */
  attacks: Record<string, string>;
  /** Spell `effect` (damage, heal, ...) -> effect id, for spells without their own entry. */
  byEffect?: Record<string, string>;
}

/** An actor's pose while a status lasts: `daze` (sleep, stun: a disabled kneel), `kneel` (poison: an acting kneel, it
 *  rises to act; docs/KNEEL_PLAN.md D-K16), `stone` (grey, no breathing, no recoil), `tremble` (fear: ±1 px, additive),
 *  `still` (no breathing; the reserved frozen). */
export const STATUS_POSTURES = ['none', 'daze', 'kneel', 'stone', 'tremble', 'still'] as const;
export type StatusPosture = typeof STATUS_POSTURES[number];

/** How one status shows on an actor (assets/data/status-visuals.yaml). */
export interface StatusVisual {
  /** An enemy's pose while the status lasts. */
  posture?: StatusPosture;
  /** Looping overlay effect id (an `effects` entry or an emitter kind). */
  overlay?: string;
  /** Multiplying tint 0xRRGGBB (actorTint source `status`). */
  tint?: number;
  /** The tint shows `on` frames out of every `period` (no pulse: always on). */
  pulse?: [number, number];
  /** Icon glyph in the fx atlas. */
  icon?: string;
  /** Short label (the party panel, the enemy target line). */
  tag?: string;
  /** A hook for a status the battle does not have yet (frozen, confuse). */
  reserved?: boolean;
  /** Whether party members show it too (default true). */
  party?: boolean;
}

export interface StatusVisualsData {
  statuses: Record<string, StatusVisual>;
}
