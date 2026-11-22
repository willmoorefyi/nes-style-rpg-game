/**
 * Boosts (pass CHT): the player-side "cheats" of the Pixel Remaster, one set per playthrough. Pure data and rules, no
 * PixiJS: the values, their steps, the save-file parse and the arithmetic each hook point applies.
 *
 * - `gold`, `xp`: battle reward multipliers (BattleStateMachine.finish, through `BattleBoosts`); `scaleReward` rounds
 *   down, so x0.5 of 7 G is 3 G.
 * - `encounters`: the random-encounter rate multiplier (0 = Off; ExplorationScene feeds it to EncounterSystem beside
 *   the vehicle's own multiplier). Scripted and boss battles never roll, so Off leaves them in place.
 * - `battleSpeed`: one time scale for the whole battle scene (messages, waits and animations; BattleScene.update).
 * - `walkSpeed`: the field step speed on foot, by ship and by canoe; the airship keeps its own speed
 *   (PlayerController.speedBoost, AirshipMode.AIRSHIP_SPEED).
 * - `alwaysEscape`: Run always succeeds, except where the battle forbids it (`canRun` false: bosses, the form chain).
 *
 * Stored in the save (v3, SaveManager); a new game and an older save start from `DEFAULT_BOOSTS`. The progression
 * verifier and the curve model (src/progression/) assume the defaults and never read these.
 */

export const REWARD_STEPS = [0, 0.5, 1, 2, 3, 4] as const;
export const ENCOUNTER_STEPS = [0, 0.5, 1, 2] as const;
export const BATTLE_SPEED_STEPS = [1, 2, 4] as const;
export const WALK_SPEED_STEPS = [1, 2] as const;
export const ESCAPE_STEPS = [false, true] as const;

export type RewardMultiplier = (typeof REWARD_STEPS)[number];
export type EncounterMultiplier = (typeof ENCOUNTER_STEPS)[number];
export type BattleSpeed = (typeof BATTLE_SPEED_STEPS)[number];
export type WalkSpeed = (typeof WALK_SPEED_STEPS)[number];

export interface Boosts {
  gold: RewardMultiplier;
  xp: RewardMultiplier;
  encounters: EncounterMultiplier;
  battleSpeed: BattleSpeed;
  walkSpeed: WalkSpeed;
  alwaysEscape: boolean;
}

export type BoostKey = keyof Boosts;

export const DEFAULT_BOOSTS: Readonly<Boosts> = Object.freeze({
  gold: 1, xp: 1, encounters: 1, battleSpeed: 1, walkSpeed: 1, alwaysEscape: false,
});

/** A fresh, mutable copy of the defaults. */
export function defaultBoosts(): Boosts {
  return { ...DEFAULT_BOOSTS };
}

/** What the battle logic and scene read (BattleConfig / BattleSceneConfig `boosts`). */
export interface BattleBoosts {
  gold: number;
  xp: number;
  alwaysEscape: boolean;
  /** The battle scene's time scale (1 = normal). */
  speed: number;
}

export function battleBoosts(b: Readonly<Boosts>): BattleBoosts {
  return { gold: b.gold, xp: b.xp, alwaysEscape: b.alwaysEscape, speed: b.battleSpeed };
}

/** A reward after its multiplier, rounded down (odd gold at x0.5 loses the half). */
export function scaleReward(amount: number, multiplier: number): number {
  return Math.max(0, Math.floor(amount * multiplier + 1e-9));
}

/** `x0.5`, `x2`; the encounter row's 0 is `Off`, the escape row is `Off` / `On`. */
export function formatMultiplier(n: number): string {
  return `x${n}`;
}

type StepValue = number | boolean;

/** One row of the Boosts screen: its label, help line, steps and how a value reads. */
export interface BoostRow {
  key: BoostKey;
  label: string;
  help: string;
  steps: readonly StepValue[];
  format(v: StepValue): string;
}

const mult = (v: StepValue): string => formatMultiplier(Number(v));
const offOr = (v: StepValue): string => (v === 0 ? 'Off' : mult(v));
const onOff = (v: StepValue): string => (v ? 'On' : 'Off');

export const BOOST_ROWS: readonly BoostRow[] = [
  { key: 'gold', label: 'Gold multiplier', steps: REWARD_STEPS, format: mult,
    help: 'Gold won in battle. x0 gives none, x4 four times as much.' },
  { key: 'xp', label: 'XP multiplier', steps: REWARD_STEPS, format: mult,
    help: 'Experience (XP) won in battle. x0 gives none, x4 four times as much.' },
  { key: 'encounters', label: 'Encounters', steps: ENCOUNTER_STEPS, format: offOr,
    help: 'Random battles. Off stops them; story and boss battles still happen.' },
  { key: 'battleSpeed', label: 'Battle speed', steps: BATTLE_SPEED_STEPS, format: mult,
    help: 'Speeds up battle messages, waits and animations.' },
  { key: 'walkSpeed', label: 'Walk speed', steps: WALK_SPEED_STEPS, format: mult,
    help: 'Field movement speed: on foot, ship and canoe (not the airship).' },
  { key: 'alwaysEscape', label: 'Escape', steps: ESCAPE_STEPS, format: onOff,
    help: 'On: Run always works, except in battles that cannot be fled (bosses).' },
];

export function boostRow(key: BoostKey): BoostRow {
  const row = BOOST_ROWS.find((r) => r.key === key);
  if (!row) throw new Error(`Boosts: no row ${key}`);
  return row;
}

/** The value one step left (-1) or right (+1) of the current one; the ends clamp (no wrap). */
export function stepBoost(b: Readonly<Boosts>, key: BoostKey, dir: -1 | 1): Boosts {
  const { steps } = boostRow(key);
  const i = steps.indexOf(b[key]);
  const next = steps[Math.max(0, Math.min(steps.length - 1, (i < 0 ? steps.indexOf(DEFAULT_BOOSTS[key]) : i) + dir))];
  return { ...b, [key]: next } as Boosts;
}

export function isDefaultBoosts(b: Readonly<Boosts>): boolean {
  return BOOST_ROWS.every((r) => b[r.key] === DEFAULT_BOOSTS[r.key]);
}

/** Short tags, e.g. `G x4 XP x0 ENC Off`; empty when every value is the default (the party panel's indicator). */
export function boostSummary(b: Readonly<Boosts>): string {
  const tags: Array<[BoostKey, string]> = [['gold', 'G'], ['xp', 'XP'], ['encounters', 'ENC'], ['battleSpeed', 'BTL'],
    ['walkSpeed', 'WALK'], ['alwaysEscape', 'RUN']];
  return tags.filter(([k]) => b[k] !== DEFAULT_BOOSTS[k])
    .map(([k, tag]) => `${tag} ${boostRow(k).format(b[k])}`).join(' ');
}

/**
 * The boosts of a save: a missing value (a save before v3) is the default; a malformed one is logged and the default.
 */
export function parseBoosts(raw: unknown): Boosts {
  const out = defaultBoosts();
  if (raw === undefined) return out;
  if (typeof raw !== 'object' || raw === null) {
    console.error('Boosts: the saved boosts are not an object; using the defaults', raw);
    return out;
  }
  const rec = raw as Record<string, unknown>;
  for (const row of BOOST_ROWS) {
    const v = rec[row.key];
    if (v === undefined) continue;
    if ((row.steps as readonly unknown[]).includes(v)) (out as Record<BoostKey, StepValue>)[row.key] = v as StepValue;
    else console.error(`Boosts: invalid saved ${row.key} ${String(v)}; using the default`);
  }
  return out;
}
