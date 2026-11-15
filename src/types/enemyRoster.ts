/**
 * Roster pass R (docs/ROSTER_PLAN.md 7.2, FW-D): the enemy fields that come from the bestiary spec
 * (~/temp/ffgame-assets/Final_Fantasy_I_Complete_Bestiary.md). `EnemyData` (types/index.ts) carries them.
 */

/**
 * The spec's protection flags. D5: `status`, `poison_stone` and `death` are enforced by the status roll
 * (`battle/statusProtect.ts`); `earth` and `time` are shown only (no spell uses them yet).
 */
export const PROTECT_CATEGORIES = ['status', 'poison_stone', 'death', 'earth', 'time'] as const;
export type ProtectCategory = (typeof PROTECT_CATEGORIES)[number];

/** The on-hit statuses the spec lists ("Can inflict ..."); display only until E-F2. */
export const ATTACK_STATUSES = ['poison', 'stun', 'sleep', 'blind', 'stone', 'death'] as const;
export type AttackStatus = (typeof ATTACK_STATUSES)[number];

/** One data-driven enemy action: a spell from spells.yaml and its share of the casting turns. */
export interface EnemyAiAction {
  type: 'magic';
  spellId: string;
  weight: number;
}

/**
 * `ai`: the spec's spell-use rate (0..1, the chance a turn is a spell) and the spells it picks from, by weight. The
 * rest of the turns are Fight. Only spells that exist in spells.yaml are listed (cross-file validation).
 */
export interface EnemyAi {
  rate: number;
  actions: EnemyAiAction[];
}

/** A special ability from the spec (`gaze`, `dazzle`, `blaze`, ...) and its use rate; display only until E-F1. */
export interface EnemySpecial {
  id: string;
  rate: number;
}

/** The roster fields of an enemy entry (all optional; the act-1 data predates them). */
export interface EnemyRosterFields {
  /** The spec number 1-128: the bestiary number and order. */
  num?: number;
  /** The 14 pre-roster entries keep their tuned numbers (D4) and are exempt from the derived-stat rules. */
  tuned?: boolean;
  /** A fiend rematch (D1): the first battle's enemy id. Its name ends in " II" and it shares that sprite. */
  rematchOf?: string;
  /** One or two in-world lines for the bestiary's Info page (ASCII). */
  description?: string;
  protect?: ProtectCategory[];
  /** The spec's status weaknesses ("Poison/Stone"); shown in the Weak row. */
  statusWeak?: ProtectCategory[];
  attackStatus?: AttackStatus[];
  /** The spec's spell codes, lowercase; codes missing from spells.yaml are shown by the bestiary's `spellNames`. */
  spells?: string[];
  ai?: EnemyAi;
  specials?: EnemySpecial[];
}
