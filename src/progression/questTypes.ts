/**
 * The progression verifier's shared types (docs/WORLD_PLAN.md 5.1 W1-0a, 6; docs/QUEST_PLAN.md 5), declared before
 * the verifier exists so W1-H (model, search, proofs (a)-(c)) and W1-I (proofs (d)-(h), mutations) can work in
 * parallel. Read only for every tranche; a needed change goes to the integrator. Pure types: no PixiJS, no game
 * objects. Field semantics come only from src/systems/fieldRules.ts.
 */
import type { FieldMode, QuestNeeds, VehicleState } from '../types/index.js';

/** A field position the search can stand on: a map cell in a mode (QUEST 5.1). */
export interface QuestPlace {
  map: string;
  x: number;
  y: number;
  mode: FieldMode;
}

/** `<map>:<x>,<y>:<mode>`: the search's key for a place. */
export type PlaceKey = string;

/** What an event is (the middle part of its id, e.g. `overworld:dock:a1_pravoka`, WORLD 6.4). */
export type QuestEventKind =
  | 'npc' | 'chest' | 'gift' | 'trade' | 'battle' | 'cutscene' | 'gate' | 'dock' | 'warp' | 'transition'
  | 'vehicle' | 'patch' | 'shop' | 'clinic';

/**
 * One event the model can fire: where it happens, what it needs and what it changes. `id` is
 * `<map>:<kind>:<name>` (the `walk` lists of quest.yaml name these ids).
 */
export interface QuestEvent {
  id: string;
  kind: QuestEventKind;
  map: string;
  /** The cells from which the event fires (beside an NPC, on a trigger cell). */
  at: Array<{ x: number; y: number }>;
  requires: QuestNeeds;
  grants: QuestNeeds;
  /** Items the event consumes (`takeItem`, `take_item`) and gold it takes (`takeGold`, GAP-15). */
  takes: { items: string[]; gold: number };
  /** Vehicles it places (`set_vehicle`, a spawn whose flag it sets). */
  places?: VehicleState[];
  /** The stage whose grants it carries, when it carries one. */
  stage?: string;
  /** A one-time event (a chest, a boss) does not fire twice. */
  once: boolean;
}

/** A search state: the flags, items, vehicles and gold so far, and where the party stands. */
export interface QuestState {
  flags: ReadonlySet<string>;
  items: ReadonlySet<string>;
  vehicles: readonly VehicleState[];
  gold: number;
  place: QuestPlace;
  /** The event ids fired so far, in order (the witness path). */
  fired: readonly string[];
}

/** A proof's letter (QUEST 5.2, WORLD 6.0): (a) order to (h) the travel matrix. */
export type ProofId = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';

/** One failure, with the message prefix the gate table names (`SKIP S4`, `EARLY melmond`, `GEO place ...`). */
export interface ProofFailure {
  proof: ProofId;
  /** `SKIP`, `SOFTLOCK`, `EARLY`, `PRICEWALL`, `GEO`, `TRAVEL`, `BAND`, `ORDER`, `MILESTONE`. */
  code: string;
  message: string;
  /** The event ids that lead to the failure, when there is a path. */
  path?: string[];
}

/** One proof's result: its CLI line (`(b) skips: OK  (...)`) and its failures. */
export interface ProofResult {
  proof: ProofId;
  ok: boolean;
  line: string;
  failures: ProofFailure[];
}

/** One mutation row (WORLD 6.3): the element changed and whether the named proof caught it. */
export interface MutationResult {
  row: string;
  element: string;
  mutation: string;
  caught: boolean;
  /** Set when the row is non-load-bearing by its stage's `nonLoadBearing`. */
  nonLoadBearing?: string;
  failures: ProofFailure[];
}

/** The whole run: the header counts, each proof, the mutations, and the final verdict. */
export interface VerifyReport {
  stages: { total: number; built: number; pending: number };
  places: number;
  events: number;
  proofs: ProofResult[];
  mutations?: MutationResult[];
  ok: boolean;
}
