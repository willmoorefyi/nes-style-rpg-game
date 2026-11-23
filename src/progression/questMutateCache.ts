/**
 * The mutation cache (docs/TEST_SPEED_PLAN.md 3, 4; TS-C, D-TS1): the suite's raw check outputs and verdicts stored by
 * a fingerprint of every byte the verifier reads (`data`, recorded where read), its bundled code closure (`code`),
 * the options, the runtime (Node, the installed yaml and esbuild) and a salt, in the git common dir
 * (`<common>/ff-cache/quest-mutate/<fp>.json`, R1: shared by every worktree, untracked).
 * - **hit**: the entry's inputs must equal the recomputed ones; the verdict is re-derived by the current code from the
 *   cached raw runs and must equal the stored results; then every light job and H seeded heavy jobs are re-run live
 *   and compared exactly (R2). Any difference fails; a malformed entry is a miss.
 * - **miss**: the suite runs live (the pool) and its entry is stored, unless the inputs changed during the run.
 * Only default-option repository runs whose root is the working directory read or write (R5); the test-only
 * `QUEST_MUTATE_STORE=<dir>` (refused outside vitest) stores elsewhere and lets a fixture root be cached.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { MutationResult, ProofFailure } from './questTypes.js';
import { canonicalJson, fingerprint, mergeInputs, runtimeVersions, verifierBundle, type InputRecord } from './questInputs.js';
import {
  baseContext, collect, computeJobs, derive, isHeavy, loadRecipe, planJobs, runMutationSuite, type ContextRecipe,
  type LoadedBase, type SuiteOptions,
} from './questMutateSuite.js';
import { defaultWorkers, type JobLogEntry } from './questMutatePool.js';
import { mutationLine } from './questReport.js';

/** Bump when the entry format or the meaning of a raw run changes. */
export const QUEST_MUTATE_CACHE_VERSION = 'ts-1';
export const KEEP_ENTRIES = 32;
export type CacheMode = 'use' | 'refresh' | 'off';

export interface CacheInputs {
  data: InputRecord[];
  code: InputRecord[];
  options: Record<string, unknown>;
  runtime: Record<string, string>;
}

export interface CacheEntry {
  version: string;
  fingerprint: string;
  inputs: CacheInputs;
  raw: Record<string, ProofFailure[]>;
  baseline: Record<string, string[]>;
  results: { plain: MutationResult[]; strict: MutationResult[] };
  line: string;
  produced: { at: string; by: string; jobs: number; wallS: number; worktree: string };
}

export interface CachedSuite {
  plain: MutationResult[];
  strict: MutationResult[];
  source: 'hit' | 'miss' | 'off';
  fp: string;
  fp12: string;
  stored: boolean;
  wallS: number;
  jobs: number;
  workers: number;
  audit: { light: number; heavy: number };
  jobLog: JobLogEntry[];
}

export interface CacheOptions extends SuiteOptions {
  cache?: CacheMode;
  /** Heavy jobs the hit's audit re-runs (`all`: every one). */
  audit?: number | 'all';
  by?: string;
}

/** The store: QUEST_MUTATE_STORE (vitest only), else `<git common dir>/ff-cache/quest-mutate`. */
export function storeDir(): string {
  const over = process.env.QUEST_MUTATE_STORE;
  if (over) {
    if (!process.env.VITEST) throw new Error('QUEST_MUTATE_STORE is test-only (set by questMutateCache.test.ts under vitest)');
    return resolve(over);
  }
  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf-8' }).trim();
  return resolve(common, 'ff-cache', 'quest-mutate');
}

/** R5: only a default-option repository run whose root is the bundle's source root (the working directory); the
 *  test store lets a fixture root be cached. */
export function cacheable(r: ContextRecipe): boolean {
  if (r.kind !== 'repo' || r.mapsDir || r.anchors || r.worstCanoe || r.stage || r.maxStates !== undefined) return false;
  if (process.env.QUEST_MUTATE_STORE && process.env.VITEST) return true;
  return !r.start && !r.worldMap && resolve(r.root) === resolve(process.cwd());
}

export async function inputsOf(r: ContextRecipe, base: LoadedBase): Promise<CacheInputs> {
  const ctx = baseContext(base, false);
  const repo = r.kind === 'repo' ? r : null;
  return {
    data: mergeInputs(base.world.inputs, base.late.inputs),
    code: (await verifierBundle()).code,
    options: { stage: ctx.stage ?? null, maxStates: ctx.maxStates, mapsDir: null, anchors: null, worstCanoe: false,
      legacy: false, root: '.', start: repo?.start, worldMap: repo?.worldMap },
    runtime: runtimeVersions(),
  };
}

const fpOf = (i: CacheInputs): string => fingerprint({ ...i, salt: QUEST_MUTATE_CACHE_VERSION });

function readEntry(path: string, fp: string, inputs: CacheInputs, log: (l: string) => void): CacheEntry | null {
  if (!existsSync(path)) return null;
  let e: CacheEntry;
  try {
    e = JSON.parse(readFileSync(path, 'utf-8')) as CacheEntry;
  } catch (err) {
    log(`cache: entry ${fp.slice(0, 12)} unreadable (${String(err)}), a miss`);
    return null;
  }
  const shaped = e && typeof e === 'object' && e.raw && e.baseline && e.results?.plain && e.results?.strict && e.inputs;
  if (!shaped || e.version !== QUEST_MUTATE_CACHE_VERSION || e.fingerprint !== fp) {
    log(`cache: entry ${fp.slice(0, 12)} malformed or of another version, a miss`);
    return null;
  }
  for (const part of ['data', 'code', 'options', 'runtime'] as const) {
    if (canonicalJson(e.inputs[part]) !== canonicalJson(inputs[part])) {
      log(`cache: entry ${fp.slice(0, 12)} inputs differ (${part}), a miss`);
      return null;
    }
  }
  return e;
}

function prune(dir: string): void {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of files.slice(KEEP_ENTRIES)) unlinkSync(join(dir, f));
}

/** Picks n of the heavy jobs by a PRNG seeded from the fingerprint. */
export function pickHeavy<T>(heavy: T[], n: number, fp: string): T[] {
  const pool = [...heavy];
  const out: T[] = [];
  let s = parseInt(fp.slice(0, 8), 16) >>> 0 || 1;
  while (out.length < Math.min(n, heavy.length)) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out.push(pool.splice(s % pool.length, 1)[0]);
  }
  return out;
}

function auditCount(o: CacheOptions): number | 'all' {
  const env = process.env.QUEST_MUTATE_AUDIT;
  const v = o.audit ?? (env === 'all' ? 'all' : env !== undefined && env !== '' ? Number(env) : 1);
  if (v !== 'all' && !(Number.isInteger(v) && v >= 0)) throw new Error(`QUEST_MUTATE_AUDIT: expected a count or all, got ${String(v)}`);
  return v;
}

/** The suite with the cache (see the module comment). */
export async function mutationSuite(recipe: ContextRecipe, opts: CacheOptions = {}): Promise<CachedSuite> {
  const t0 = Date.now();
  const log = opts.log ?? ((l: string) => console.error(l));
  const mode = opts.cache ?? ((process.env.QUEST_MUTATE_CACHE || 'use') as CacheMode);
  if (!['use', 'refresh', 'off'].includes(mode)) throw new Error(`QUEST_MUTATE_CACHE: expected use, refresh or off, got ${mode}`);
  const base = await loadRecipe(recipe);
  if (mode === 'off' || !cacheable(recipe)) {
    const r = await runMutationSuite(recipe, { ...opts, base });
    return { plain: r.plain, strict: r.strict, source: 'off', fp: '', fp12: '', stored: false, wallS: r.wallS, jobs: r.jobs,
      workers: r.workers, audit: { light: 0, heavy: 0 }, jobLog: r.jobLog };
  }
  const inputs = await inputsOf(recipe, base);
  const fp = fpOf(inputs);
  const fp12 = fp.slice(0, 12);
  const dir = storeDir();
  const path = join(dir, `${fp}.json`);
  const entry = mode === 'use' ? readEntry(path, fp, inputs, log) : null;
  const plain = baseContext(base, false);
  const strict = baseContext(base, true);
  if (entry) {
    const runs = { raw: new Map(Object.entries(entry.raw)), baseline: new Map(Object.entries(entry.baseline)) };
    const got = derive(plain, strict, runs);
    if (canonicalJson(got) !== canonicalJson(entry.results)) throw new Error(`cache entry ${fp12} inconsistent: its results are not what its raw runs derive`);
    const jobs = planJobs(plain, strict);
    const n = auditCount(opts);
    const light = jobs.filter((j) => !isHeavy(j));
    const heavy = jobs.filter(isHeavy);
    const picked = n === 'all' ? heavy : pickHeavy(heavy, n, fp);
    const audited = [...light, ...picked];
    const jobLog = opts.jobLog ?? [];
    const now = collect(plain, strict, audited, await computeJobs(recipe, base, audited, { ...opts, jobLog }));
    for (const [k, v] of now.raw) {
      if (canonicalJson(v) !== canonicalJson(entry.raw[k])) throw new Error(`cache entry ${fp12}: the live audit differs on ${k}`);
    }
    for (const [k, v] of now.baseline) {
      if (k in entry.baseline && canonicalJson(v) !== canonicalJson(entry.baseline[k])) {
        throw new Error(`cache entry ${fp12}: the live audit differs on ${k}`);
      }
    }
    const t = new Date();
    utimesSync(path, t, t);                       // a hit is a use: pruning keeps the most recently used
    return { plain: got.plain, strict: got.strict, source: 'hit', fp, fp12, stored: false, wallS: (Date.now() - t0) / 1000,
      jobs: jobs.length, workers: opts.jobs ?? defaultWorkers(), audit: { light: light.length, heavy: picked.length }, jobLog };
  }
  const r = await runMutationSuite(recipe, { ...opts, base });
  const again = await inputsOf(recipe, await loadRecipe(recipe));
  let stored = false;
  if (fpOf(again) !== fp) log('cache: inputs changed during the run, not stored');
  else {
    const e: CacheEntry = {
      version: QUEST_MUTATE_CACHE_VERSION, fingerprint: fp, inputs, raw: Object.fromEntries(r.raw),
      baseline: Object.fromEntries(r.baseline), results: { plain: r.plain, strict: r.strict }, line: mutationLine(r.strict),
      produced: { at: new Date().toISOString(), by: opts.by ?? 'cli', jobs: r.workers, wallS: r.wallS, worktree: process.cwd() },
    };
    mkdirSync(dir, { recursive: true });
    const tmp = `${path}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(e));
    renameSync(tmp, path);
    prune(dir);
    stored = true;
  }
  return { plain: r.plain, strict: r.strict, source: 'miss', fp, fp12, stored, wallS: (Date.now() - t0) / 1000, jobs: r.jobs,
    workers: r.workers, audit: { light: 0, heavy: 0 }, jobLog: r.jobLog };
}
