/**
 * The progression verifier's input (docs/QUEST_PLAN.md 5.1, docs/WORLD_PLAN.md 3.4, 5.2 W1-H): `quest.yaml` (stages,
 * `optional`, `milestones`, `towns:`), the maps the game plays (compiled `assets/maps/ai/<id>.yaml` for the ids in its
 * index, else the legacy `assets/maps/<id>.yaml`), `cutscenes.yaml` and the key items of `items.yaml`.
 * `buildQuestWorld` is pure (the fixtures use it); `loadQuestWorld` reads the repository from disk.
 */
import { join } from 'node:path';
import { validateQuestData } from '../core/schemaValidationQuest.js';
import type { MapData, QuestData, QuestStage } from '../types/index.js';
import type { QuestPlace } from './questTypes.js';
import { loadMaps } from './questMaps.js';
import { InputLog, type InputRecord } from './questInputs.js';
import { resolveQuestPlaces } from './questSpots.js';

/** The cutscene step fields the model reads (CutsceneManager's step, as plain data). */
export interface QuestCutStep {
  type: string;
  flag?: string;
  item?: string;
  vehicle?: string;
  map?: string;
  entrance?: string;
  x?: number;
  y?: number;
  /** `set_vehicle`: a spot of `map` (NW-1), instead of x / y. */
  at?: string;
}

export interface QuestItemRecord {
  id: string;
  type?: string;
  /** A key item a trade or a stage's `requires` uses up (WORLD 3.1's "Consumed" column). */
  consumed?: boolean;
}

/** Where a new game starts: a map and a named entrance, or a cell. */
export interface QuestStart {
  map: string;
  entrance?: string;
  x?: number;
  y?: number;
  flags?: string[];
  items?: string[];
}

export interface QuestWorldInput {
  quest: unknown;
  maps: MapData[];
  cutscenes: Array<{ id: string; steps: QuestCutStep[] }>;
  items: QuestItemRecord[];
  start?: QuestStart;
  /** The world map's id: a place there counts as "back on the world map" for proof (c). */
  worldMap?: string;
}

/** Why a stage is optional: declared in quest.yaml, or derived (off the goal's `after` closure, only optional stages
 *  depend on it: S18, whose only dependant is the optional class change S19). */
export type OptionalReason = 'declared' | 'derived';

export interface QuestWorld {
  quest: QuestData;
  maps: ReadonlyMap<string, MapData>;
  cutscenes: ReadonlyMap<string, QuestCutStep[]>;
  keyItems: ReadonlySet<string>;
  consumed: ReadonlySet<string>;
  start: QuestPlace;
  startFlags: string[];
  startItems: string[];
  worldMap: string;
  stages: ReadonlyMap<string, QuestStage>;
  /** The stage whose grants hold the goal flag (S30). */
  goalStage: string | null;
  optional: ReadonlyMap<string, OptionalReason>;
  /** Map ids a transition, exit or warp names that are not loaded (stubs not compiled yet). */
  missingMaps: string[];
  /** The files `loadQuestWorld` read or probed (docs/TEST_SPEED_PLAN.md 3); absent for a world built in memory. */
  inputs?: readonly InputRecord[];
}

/**
 * WORLD 3.1's "Consumed" column, used when a pending stage's synthetic grant fires (QUEST 5.1's consumption rule).
 * An `items.yaml` record's `consumed` field overrides it (W1-F may move the column into the item records).
 */
export const CONSUMED_KEY_ITEMS: readonly string[] = [
  'crown', 'crystal_eye', 'herb', 'tnt', 'ruby', 'levistone', 'ordeal_seal', 'fairy_bottle', 'slab', 'adamant',
];

/** The new game's start (PartyCreationScene.beginAdventure: Cornelia's south gate, after the opening). */
export const NEW_GAME_START: QuestStart = { map: 'cornelia', entrance: 'south_gate' };

/** `*` matches any run of characters; everything else is literal (quest.yaml `maps` globs). */
export function globMatch(id: string, glob: string): boolean {
  const re = new RegExp(`^${glob.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return re.test(id);
}

/** Every stage that `id` depends on through `after`, transitively (not `id` itself). */
export function ancestorsOf(stages: ReadonlyMap<string, QuestStage>, id: string): Set<string> {
  const out = new Set<string>();
  const visit = (s: string): void => {
    for (const a of stages.get(s)?.after ?? []) {
      if (out.has(a)) continue;
      out.add(a);
      visit(a);
    }
  };
  visit(id);
  return out;
}

/** The stage ids in a topological order of `after` (ties by stage number). */
export function stageOrder(quest: QuestData): string[] {
  const num = (id: string): number => Number(id.slice(1));
  const ids = quest.stages.map((s) => s.id).sort((a, b) => num(a) - num(b));
  const byId = new Map(quest.stages.map((s) => [s.id, s]));
  const done = new Set<string>();
  const out: string[] = [];
  const visit = (id: string): void => {
    if (done.has(id)) return;
    done.add(id);
    for (const a of [...(byId.get(id)?.after ?? [])].sort((x, y) => num(x) - num(y))) visit(a);
    out.push(id);
  };
  ids.forEach(visit);
  return out;
}

function optionalStages(stages: ReadonlyMap<string, QuestStage>, goalStage: string | null): Map<string, OptionalReason> {
  const out = new Map<string, OptionalReason>();
  for (const s of stages.values()) if (s.optional) out.set(s.id, 'declared');
  if (!goalStage) return out;
  const closure = ancestorsOf(stages, goalStage);
  closure.add(goalStage);
  // a stage off the goal's closure whose dependants are all optional is optional too (fixpoint, WORLD 3.3: S18)
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of stages.values()) {
      if (out.has(s.id) || closure.has(s.id)) continue;
      const dependants = [...stages.values()].filter((d) => d.after.includes(s.id));
      if (dependants.every((d) => out.has(d.id))) {
        out.set(s.id, 'derived');
        changed = true;
      }
    }
  }
  return out;
}

function resolveStart(start: QuestStart, maps: ReadonlyMap<string, MapData>): QuestPlace {
  if (start.entrance !== undefined) {
    const e = maps.get(start.map)?.entrances?.[start.entrance];
    if (!e) throw new Error(`quest start: map ${start.map} has no entrance ${start.entrance}`);
    return { map: start.map, x: e[0], y: e[1], mode: 'walking' };
  }
  if (start.x === undefined || start.y === undefined) throw new Error('quest start: an entrance or x and y');
  return { map: start.map, x: start.x, y: start.y, mode: 'walking' };
}

function referencedMaps(maps: ReadonlyMap<string, MapData>, cutscenes: ReadonlyMap<string, QuestCutStep[]>): Set<string> {
  const out = new Set<string>();
  for (const m of maps.values()) {
    for (const t of m.transitions) out.add(t.targetMap);
    if (m.exit) out.add(m.exit.map);
  }
  for (const steps of cutscenes.values()) for (const s of steps) if (s.type === 'warp' && s.map) out.add(s.map);
  return out;
}

/** The verifier's world from parsed data (pure). */
export function buildQuestWorld(input: QuestWorldInput): QuestWorld {
  const maps = new Map(input.maps.map((m) => [m.id, m]));
  const quest = resolveQuestPlaces(validateQuestData(input.quest), maps);
  const cutscenes = new Map(input.cutscenes.map((c) => [c.id, c.steps ?? []]));
  const keyItems = new Set(input.items.filter((i) => i.type === 'key').map((i) => i.id));
  const consumed = new Set(CONSUMED_KEY_ITEMS);
  for (const i of input.items) {
    if (i.consumed === true) consumed.add(i.id);
    if (i.consumed === false) consumed.delete(i.id);
  }
  // stage grants are key items by definition (W1-F creates the records; until then the stage says so)
  for (const s of quest.stages) for (const it of [...s.grants.items, ...s.requires.items]) keyItems.add(it);
  const stages = new Map(quest.stages.map((s) => [s.id, s]));
  const goalStage = quest.stages.find((s) => s.grants.flags.includes(quest.goal))?.id ?? null;
  const start = input.start ?? NEW_GAME_START;
  const missingMaps = [...referencedMaps(maps, cutscenes)].filter((id) => !maps.has(id)).sort();
  return {
    quest, maps, cutscenes, keyItems, consumed,
    start: resolveStart(start, maps),
    startFlags: start.flags ?? [],
    startItems: start.items ?? [],
    worldMap: input.worldMap ?? 'overworld',
    stages, goalStage,
    optional: optionalStages(stages, goalStage),
    missingMaps,
  };
}

export interface LoadOptions {
  /** The repository root (default: the working directory). */
  root?: string;
  /** Read only the legacy maps (`assets/maps/*.yaml`), not the compiled ones. */
  legacy?: boolean;
  /** NW-1 `--maps DIR`: a folder of compiled maps (a scratch world compile) read before `assets/maps/ai`. */
  mapsDir?: string;
  /** Test only (the repository-layout fixture, tests/helpers/questRepoFixture.ts): the new game's start. */
  start?: QuestStart;
  /** Test only: the world map's id. */
  worldMap?: string;
}

/** The repository's world: quest.yaml, the playable maps, cutscenes.yaml and items.yaml. */
export function loadQuestWorld(opts: LoadOptions = {}): QuestWorld {
  const root = opts.root ?? process.cwd();
  const data = join(root, 'assets/data');
  const log = new InputLog(root);
  const world = buildQuestWorld({
    quest: log.read(join(data, 'quest.yaml')),
    maps: loadMaps(root, opts.legacy ?? false, opts.mapsDir, log),
    cutscenes: (log.read(join(data, 'cutscenes.yaml')) as Array<{ id: string; steps: QuestCutStep[] }>) ?? [],
    items: (log.read(join(data, 'items.yaml')) as QuestItemRecord[]) ?? [],
    start: opts.start,
    worldMap: opts.worldMap,
  });
  return { ...world, inputs: log.records() };
}
