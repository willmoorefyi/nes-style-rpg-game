/** assets/data/bestiary.yaml (docs/BESTIARY_PLAN.md 3.4): the bestiary's mode, layout numbers, loop timing and text. */

/** The preview loop's steps, in their default order. */
export const BESTIARY_STEPS = ['attack', 'hurt', 'cast', 'daze'] as const;
export type BestiaryStep = (typeof BESTIARY_STEPS)[number];

/** Caption keys: the attack is named by its kind (heavy, ranged) or plain `attack`. */
export type BestiaryAnimLabel = 'attack' | 'heavy' | 'ranged' | 'hurt' | 'cast' | 'daze';
export type BestiaryAttackKind = 'melee' | 'heavy' | 'ranged';

export const BESTIARY_LABEL_KEYS = ['title', 'boss', 'hp', 'attack', 'hits', 'damage', 'defense', 'magicDefense',
  'strength', 'agility', 'intelligence', 'vitality', 'luck', 'accuracy', 'evade', 'family', 'size', 'attacks', 'xp', 'gold',
  'weak', 'resist', 'immune', 'absorb', 'statusHit', 'actions', 'spells', 'habitat', 'none', 'unknown', 'blank', 'paused',
  'noArt', 'noData', 'info', 'specials', 'onHit', 'noDescription'] as const;
export type BestiaryLabelKey = (typeof BESTIARY_LABEL_KEYS)[number];

export type BestiaryLabels = Record<BestiaryLabelKey, string> & {
  sizes: Record<'small' | 'large' | 'huge' | 'boss' | 'titan', string>;
  attackKinds: Record<BestiaryAttackKind, string>;
  anim: Record<BestiaryAnimLabel, string>;
};

/** Every template and the `{placeholders}` it may use (test 5 and the validator check them). */
export const TEMPLATE_PLACEHOLDERS = {
  entry: ['num', 'name'],
  titleCount: ['entry', 'index', 'total'],
  damage: ['min', 'max'],
  hits: ['hits'],
  fight: ['hits'],
  statusHit: ['pct', 'acc'],
  phase: ['pct'],
  phaseHits: ['hits'],
  phaseAttack: ['attack'],
  phaseMessage: ['message'],
  habitatMain: ['map'],
  habitatZone: ['map', 'zones'],
  habitatBoss: ['map'],
  notPlaced: [],
  list: [],
  special: ['name', 'pct'],
  loreTitle: ['page', 'pages'],
} as const satisfies Record<string, readonly string[]>;
export type BestiaryTemplateKey = keyof typeof TEMPLATE_PLACEHOLDERS;
export type BestiaryTemplates = Record<BestiaryTemplateKey, string>;

export interface BestiaryData {
  /** all: every enemy; seen: enemies not yet met list as "???". */
  mode: 'all' | 'seen';
  /** data: enemies.yaml order (a hook for name / level later). */
  order: 'data';
  listRows: number;
  habitats: {
    /** Compiled map ids scanned for encounter tables. */
    maps: string[];
    /** Display names of encounterZones ids. */
    zones: Record<string, string>;
  };
  backgrounds: {
    default: string;
    /** Per-enemy background ids (assets/backgrounds/<id>.webp). */
    enemies: Record<string, string>;
  };
  anim: {
    order: BestiaryStep[];
    /** Frames before the first step of an entry. */
    firstBreak: number;
    /** Idle frames after each step, on the bestiary's own clock (not the battle message speed). */
    idleBreak: number;
    dazeHold: number;
  };
  labels: BestiaryLabels;
  templates: BestiaryTemplates;
  /** Element id -> label, in display order. */
  elements: Record<string, string>;
  families: Record<string, string>;
  /** Protection category (`protect`, `statusWeak`) -> label, in display order (ROSTER_PLAN 7.3). */
  protections: Record<string, string>;
  /** Status id (`attackStatus`) -> label. */
  statuses: Record<string, string>;
  /** Spell codes not in spells.yaml (the spec glossary) -> display name. */
  spellNames: Record<string, string>;
  /** Special ability id -> display name (missing: the id, capitalised). */
  specialNames: Record<string, string>;
  /** Enemy id -> lore pages (ASCII; a rematch shows its first battle's). */
  lore: Record<string, string[]>;
  help: string;
}
