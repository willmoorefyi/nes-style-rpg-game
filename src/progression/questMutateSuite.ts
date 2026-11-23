/**
 * The mutation suite run in three steps (docs/TEST_SPEED_PLAN.md 5.1, D-TS3): **plan** (main: both variants walked
 * with a recording source, so the job list is exactly the raw runs the serial suite would compute), **compute** (a
 * pool of workers, questMutatePool.ts, or in-process for `jobs: 1`) and **derive** (main: both variants walked again
 * over the computed runs; the results come out in the serial order whatever order the jobs finished in). The
 * derivation is today's code (`runMutations`), the only code that decides a verdict; GT-18's probe runs live in it.
 *
 * A context is built from a recipe, never shipped between threads: `repo` (the CLI's and the real-world test's
 * repository load) or `module` (a module's export, the mini world's `miniContext`).
 */
import type { MutationResult, ProofFailure } from './questTypes.js';
import { createQuestContext, type QuestContext } from './questProofs.js';
import { attachLate, lateOf, loadLateData, type LateData } from './questLateData.js';
import { loadQuestWorld, type QuestStart, type QuestWorld } from './questData.js';
import { elementsById, mutatedContext, runMutations } from './questMutate.js';
import {
  baselineKey, keyOf, PrefilledSource, rawKey, RecordingSource, runCheck, serialSource, type CheckKey, type RunSource,
} from './questMutateCheck.js';
import type { MutElement } from './questMutateOps.js';
import { canonicalJson, mergeInputs, sha256 } from './questInputs.js';
import { defaultWorkers, runPool, type JobLogEntry, type PoolOptions } from './questMutatePool.js';
import { acquirePoolLock } from './questMutateLock.js';

export type ContextRecipe =
  | { kind: 'repo'; root: string; mapsDir?: string; anchors?: string; worstCanoe?: boolean; stage?: string;
    maxStates?: number; start?: QuestStart; worldMap?: string }
  | { kind: 'module'; path: string; export: string; stage?: string };

/** What a recipe loads: one world and its late data, and the base contexts' options. */
export interface LoadedBase {
  world: QuestWorld;
  late: LateData;
  stage?: string;
  maxStates?: number;
}

type Importer = (path: string) => Promise<Record<string, unknown>>;

/** The repository load of the CLI and the real-world test (`repo` recipe). */
export function repoContext(r: Extract<ContextRecipe, { kind: 'repo' }>): LoadedBase {
  const world = loadQuestWorld({ root: r.root, mapsDir: r.mapsDir, start: r.start, worldMap: r.worldMap });
  const late = loadLateData(r.root, { anchors: r.anchors, worstCanoe: r.worstCanoe });
  return { world, late, stage: r.stage, maxStates: r.maxStates };
}

export async function loadRecipe(r: ContextRecipe, load: Importer = (p) => import(/* @vite-ignore */ p)): Promise<LoadedBase> {
  if (r.kind === 'repo') return repoContext(r);
  const make = (await load(r.path))[r.export];
  if (typeof make !== 'function') throw new Error(`mutation suite: ${r.path} has no function ${r.export}`);
  const ctx = (make as (stage?: string) => QuestContext)(r.stage);
  return { world: ctx.world, late: lateOf(ctx), stage: ctx.stage, maxStates: ctx.maxStates };
}

/** A fresh base context of one variant (empty caches: no graph, no closure). */
export function baseContext(b: LoadedBase, strict: boolean): QuestContext {
  return attachLate(createQuestContext(b.world, { strict, stage: b.stage, maxStates: b.maxStates }), b.late);
}

/** The data fingerprint a worker and main must agree on (the files changed during the run otherwise). */
export function dataPrint(b: LoadedBase): string {
  return sha256(canonicalJson(mergeInputs(b.world.inputs, b.late.inputs)));
}

/** One unit of pool work: an element's keys on its mutated context, or base-context keys of one variant. */
export type Job =
  | { kind: 'element'; id: string; keys: string[] }
  | { kind: 'baseline'; id: string; strict: boolean; keys: string[] };

export const isHeavy = (j: Job): boolean => j.keys.includes('c:');

/** Step 1: the jobs, heavy ones (a (c) key) first: the two baseline (c)s, then the elements in plan order. */
export function planJobs(plain: QuestContext, strict: QuestContext): Job[] {
  const rec = new RecordingSource();
  runMutations(plain, rec);
  runMutations(strict, rec);
  const elements: Job[] = [...rec.elements].map(([id, keys]) => ({ kind: 'element', id, keys: [...keys] }));
  const all = new Set(elements.flatMap((j) => j.keys));
  const light = [...all].filter((k) => k !== 'c:').sort();
  const baselines: Job[] = [false, true].flatMap((s) => [
    ...(all.has('c:') ? [{ kind: 'baseline' as const, id: `${s ? 'strict' : 'plain'} c:`, strict: s, keys: ['c:'] }] : []),
    ...(light.length ? [{ kind: 'baseline' as const, id: `${s ? 'strict' : 'plain'} light`, strict: s, keys: light }] : []),
  ]);
  return [...baselines.filter(isHeavy), ...elements.filter(isHeavy), ...elements.filter((j) => !isHeavy(j)),
    ...baselines.filter((j) => !isHeavy(j))];
}

/** A job's outputs: key -> the failures (element) or the failure messages (baseline). */
export type JobOutput = Record<string, ProofFailure[] | string[]>;

/** The raw runs and baselines of a computed suite, keyed as RUNS and the entry are. */
export interface ComputedRuns {
  raw: Map<string, ProofFailure[]>;
  baseline: Map<string, string[]>;
}

export function collect(plain: QuestContext, strict: QuestContext, jobs: Job[], outputs: Map<string, JobOutput>): ComputedRuns {
  const out: ComputedRuns = { raw: new Map(), baseline: new Map() };
  for (const j of jobs) {
    const got = outputs.get(j.id);
    if (!got) throw new Error(`mutation suite: job ${j.id} has no result`);
    for (const k of j.keys) {
      if (!(k in got)) throw new Error(`mutation suite: job ${j.id} has no run of ${k}`);
      const key: CheckKey = keyOf(k);
      if (j.kind === 'element') out.raw.set(rawKey(plain, j.id, key), got[k] as ProofFailure[]);
      else out.baseline.set(baselineKey(j.strict ? strict : plain, key), got[k] as string[]);
    }
  }
  return out;
}

/** Step 3: both variants derived from the computed runs (a request they lack throws). */
export function derive(plain: QuestContext, strict: QuestContext, runs: ComputedRuns): { plain: MutationResult[]; strict: MutationResult[] } {
  const src = new PrefilledSource(runs.raw, runs.baseline);
  return { plain: runMutations(plain, src), strict: runMutations(strict, src) };
}

/** `jobs: 1`: today's serial code path (the serial source), with its raw runs captured for the cache entry. */
export function runSerial(plain: QuestContext, strict: QuestContext): ComputedRuns & { plain: MutationResult[]; strict: MutationResult[] } {
  const runs: ComputedRuns = { raw: new Map(), baseline: new Map() };
  const capture: RunSource = {
    element(ctx, id, k, make) {
      const got = serialSource.element(ctx, id, k, make);
      runs.raw.set(rawKey(ctx, id, k), got);
      return got;
    },
    baseline(ctx, k) {
      const got = serialSource.baseline(ctx, k);
      runs.baseline.set(baselineKey(ctx, k), got);
      return got;
    },
  };
  return { ...runs, plain: runMutations(plain, capture), strict: runMutations(strict, capture) };
}

/** A job's outputs on one loaded base (the worker's and the in-process audit's code): an element's keys on its
 *  mutated context (built once from the factory), a baseline's on a throwaway base context of the variant. */
export function runJob(base: LoadedBase, factory: QuestContext, els: ReadonlyMap<string, MutElement>, job: Job): JobOutput {
  const out: JobOutput = {};
  if (job.kind === 'element') {
    const el = els.get(job.id);
    if (!el) throw new Error(`no element ${job.id} in this world`);
    let mctx: QuestContext | undefined;
    for (const k of job.keys) out[k] = runCheck(mctx ??= mutatedContext(factory, el.apply(factory.world)), keyOf(k));
  } else {
    const ctx = baseContext(base, job.strict);
    for (const k of job.keys) out[k] = runCheck(ctx, keyOf(k)).map((f) => f.message);
  }
  // fix 1 (docs/TEST_SPEED_PLAN.md 5.2): the factory never holds a graph or a closure
  if (factory.graph || factory.sat) throw new Error('the factory context ran a check');
  return out;
}

export interface SuiteOptions extends Partial<PoolOptions> {
  /** 1: in-process, today's serial path (no lock); default `defaultWorkers()`. */
  jobs?: number;
  /** The recipe's world, already loaded (the cache loads it for the fingerprint). */
  base?: LoadedBase;
  /** false: no machine pool lock (the fast tier's fixture pools, a few MB each, must not wait behind a real-world
   *  pool in the same `test:full`). */
  lock?: boolean;
}

/** Computes jobs: in-process for `jobs: 1`, else in the pool under the machine's pool lock. */
export async function computeJobs(recipe: ContextRecipe, base: LoadedBase, jobs: Job[], opts: SuiteOptions): Promise<Map<string, JobOutput>> {
  const workers = opts.jobs ?? defaultWorkers();
  if (workers <= 1) {
    const factory = baseContext(base, false);
    const els = elementsById(factory);
    return new Map(jobs.map((j) => [j.id, runJob(base, factory, els, j)]));
  }
  const release = opts.lock === false ? (): void => undefined : await acquirePoolLock({ onWait: opts.log });
  try {
    return await runPool(recipe, jobs, { ...opts, workers, data: dataPrint(base) });
  } finally {
    release();
  }
}

export interface SuiteResult extends ComputedRuns {
  plain: MutationResult[];
  strict: MutationResult[];
  jobs: number;
  workers: number;
  wallS: number;
  jobLog: JobLogEntry[];
  base: LoadedBase;
}

/** The whole suite, both variants: plan, compute, derive (`jobs: 1`: today's serial path, its runs captured). */
export async function runMutationSuite(recipe: ContextRecipe, opts: SuiteOptions = {}): Promise<SuiteResult> {
  const t0 = Date.now();
  const base = opts.base ?? await loadRecipe(recipe);
  const plain = baseContext(base, false);
  const strict = baseContext(base, true);
  const workers = opts.jobs ?? defaultWorkers();
  const jobLog = opts.jobLog ?? [];
  if (workers <= 1) {
    const r = runSerial(plain, strict);
    return { ...r, jobs: r.raw.size, workers: 1, wallS: (Date.now() - t0) / 1000, jobLog, base };
  }
  const jobs = planJobs(plain, strict);
  const runs = collect(plain, strict, jobs, await computeJobs(recipe, base, jobs, { ...opts, jobs: workers, jobLog }));
  return { ...runs, ...derive(plain, strict, runs), jobs: jobs.length, workers, wallS: (Date.now() - t0) / 1000, jobLog, base };
}
