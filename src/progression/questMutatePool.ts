/**
 * The mutate pool (docs/TEST_SPEED_PLAN.md 5.2-5.5, R3, R4): `worker_threads` workers running the esbuild bundle of
 * questMutateWorker.ts (in `node_modules/.cache/ff-quest/`), a pull queue in the plan's order (heavy jobs first), and
 * the failure rules: a worker out of memory on its first-try cap (3,584 MB) has its job retried at once on a fresh
 * worker at the serial run's 8,192 MB heap (one such retry at a time, and no new heavy job meanwhile), so the pool
 * never fails where the serial run passes; any other crash, or a job past its timeout, is retried once on a fresh
 * worker; a second failure, a check that throws, or an out of memory at 8,192 MB fails the run. Every job's wall time
 * and peak heap (sampled from main every 250 ms) goes to `jobLog`. Nothing here decides a verdict.
 */
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import type { ContextRecipe, Job, JobOutput } from './questMutateSuite.js';
import type { FromWorker, StubJob, ToWorker, WorkerData } from './questMutateWorker.js';
import { canonicalJson, sha256, verifierBundle } from './questInputs.js';

export const FIRST_CAP_MB = 3584;
export const SERIAL_HEAP_MB = 8192;
export const DEFAULT_TIMEOUT_S = 1200;

/**
 * The process heap flag (`--max-old-space-size`, which `npm run quest` and the test:full / test:world scripts set to
 * 8,192 through NODE_OPTIONS) is a V8 process flag: it overrides a worker's `resourceLimits`, so every worker is
 * capped at that heap (the serial run's) from the start and the first-try cap and its retry do not apply. Null when
 * no flag is set.
 */
export function processHeapFlagMb(): number | null {
  const all = [...process.execArgv, ...(process.env.NODE_OPTIONS ?? '').split(/\s+/)];
  const f = all.find((a) => a.startsWith('--max-old-space-size='));
  return f ? Number(f.split('=')[1]) : null;
}

/** R3: CLI min(6, cores - 2), inside vitest 4; `QUEST_MUTATE_JOBS` overrides both. */
export function defaultWorkers(): number {
  const env = Number(process.env.QUEST_MUTATE_JOBS);
  if (Number.isInteger(env) && env > 0) return env;
  return process.env.VITEST ? 4 : Math.max(1, Math.min(6, availableParallelism() - 2));
}

export interface JobLogEntry {
  id: string;
  ms: number;
  peakHeapMb: number;
  retried: boolean;
  worker: number;
}

export interface PoolOptions {
  workers: number;
  /** Tests: a seeded shuffle of the queue (nothing from completion order may reach the result). */
  shuffleSeed?: number;
  capMb?: number;
  retryCapMb?: number;
  timeoutS?: number;
  log?: (line: string) => void;
  jobLog?: JobLogEntry[];
  /** Tests: terminate the worker of this job once, mid-job. */
  killOnce?: string;
  /** Tests: the main side's data fingerprint (a worker on other data aborts the run). */
  data?: string;
}

/** The worker bundle (with each `module` recipe's file as its own entry, sharing chunks), written once per content. */
export async function workerBundle(modules: string[] = []): Promise<{ worker: string; modules: Record<string, string> }> {
  const entries = ['src/progression/questMutateWorker.ts', ...modules];
  const probe = await verifierBundle({ entries });
  const dir = resolve('node_modules/.cache/ff-quest', `w-${sha256(canonicalJson([probe.code, entries])).slice(0, 12)}`);
  const names: Record<string, string> = { questMutateWorker: entries[0] };
  modules.forEach((m, i) => { names[`m${i}`] = m; });
  if (!existsSync(join(dir, 'questMutateWorker.mjs'))) {
    const tmp = `${dir}.tmp-${process.pid}`;
    mkdirSync(tmp, { recursive: true });
    await verifierBundle({ entries: names, outdir: tmp });
    try {
      renameSync(tmp, dir);
    } catch (e) {
      if (!existsSync(join(dir, 'questMutateWorker.mjs'))) throw e;     // another process wrote the same bundle
    }
  }
  const url = (n: string): string => pathToFileURL(join(dir, `${n}.mjs`)).href;
  return { worker: join(dir, 'questMutateWorker.mjs'), modules: Object.fromEntries(modules.map((m, i) => [m, url(`m${i}`)])) };
}

function shuffled<T>(xs: T[], seed: number): T[] {
  const out = [...xs];
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type AnyJob = Job | StubJob;
type Queued = { job: AnyJob; attempt: number; big: boolean };
interface Slot { w: Worker; n: number; big: boolean; job: AnyJob | null; ready: boolean; peak: number; timer?: NodeJS.Timeout; sampler?: NodeJS.Timeout; dead: boolean }

/** Step 2: computes every job in the pool; resolves with each job's outputs by job id. */
export async function runPool(recipe: ContextRecipe, jobs: AnyJob[], opts: PoolOptions): Promise<Map<string, JobOutput>> {
  const bundle = await workerBundle(recipe.kind === 'module' ? [recipe.path] : []);
  const cap = opts.capMb ?? FIRST_CAP_MB;
  const bigCap = opts.retryCapMb ?? SERIAL_HEAP_MB;
  const timeoutS = opts.timeoutS ?? (Number(process.env.QUEST_MUTATE_JOB_TIMEOUT_S) || DEFAULT_TIMEOUT_S);
  const log = opts.log ?? ((l: string) => console.error(l));
  const flag = processHeapFlagMb();
  if (flag !== null) log(`mutate pool: the process heap flag caps every worker at ${flag} MB (the first-try cap does not apply)`);
  const heavy = (j: AnyJob): boolean => j.keys.includes('c:') || (j.kind === 'stub' && j.act === 'alloc');
  const queue: Queued[] = (opts.shuffleSeed === undefined ? jobs : shuffled(jobs, opts.shuffleSeed))
    .map((job) => ({ job, attempt: 0, big: false }));
  const out = new Map<string, JobOutput>();
  const failed = new Map<string, string>();
  const attempt = new Map<string, number>();
  const slots: Slot[] = [];
  let seq = 0;
  let killed = false;
  if (!jobs.length) return out;
  return new Promise<Map<string, JobOutput>>((resolveAll, reject) => {
    let over = false;
    const live = (): Slot[] => slots.filter((x) => !x.dead);
    const bigBusy = (): boolean => live().some((x) => x.big) || queue.some((q) => q.big);
    const stop = (s: Slot): void => { s.dead = true; clearTimeout(s.timer); clearInterval(s.sampler); void s.w.terminate(); };
    const finish = (err?: Error): void => {
      if (over) return;
      over = true;
      for (const s of slots) stop(s);
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      if (err) reject(err); else resolveAll(out);
    };
    const onSignal = (): void => finish(new Error('mutation pool: interrupted'));
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    const spawn = (big: boolean): void => {
      const data: WorkerData = { recipe, modules: bundle.modules };
      const w = new Worker(bundle.worker, { workerData: data, resourceLimits: { maxOldGenerationSizeMb: big ? bigCap : cap } });
      const s: Slot = { w, n: ++seq, big, job: null, ready: false, peak: 0, dead: false };
      slots.push(s);
      w.on('message', (m: FromWorker) => onMessage(s, m));
      w.on('error', (e: Error & { code?: string }) => onDeath(s, e.code === 'ERR_WORKER_OUT_OF_MEMORY' ? 'oom' : e.message));
      w.on('exit', (code) => { if (!s.dead) onDeath(s, `exit ${code}`); });
    };
    /** Hands every idle worker its next job; the 8 GB worker takes only the retry, the others no heavy job while
     *  a retry runs; a worker with nothing left to take ends. */
    const pump = (): void => {
      for (const s of [...live().filter((x) => x.big), ...live().filter((x) => !x.big)]) {
        if (over || !s.ready || s.job) continue;
        const i = s.big ? queue.findIndex((q) => q.big) : queue.findIndex((q) => !q.big && !(bigBusy() && heavy(q.job)));
        if (i < 0) {
          if (s.big || !queue.some((q) => !q.big)) stop(s);
          continue;
        }
        const [q] = queue.splice(i, 1);
        s.job = q.job;
        s.peak = 0;
        attempt.set(q.job.id, q.attempt);
        s.timer = setTimeout(() => { void s.w.terminate(); onDeath(s, `timeout after ${timeoutS} s`); }, timeoutS * 1000);
        s.sampler = setInterval(() => {
          s.w.getHeapStatistics?.().then((h) => { s.peak = Math.max(s.peak, h.used_heap_size / 2 ** 20); },
            (e: unknown) => { if (!s.dead) log(`mutate: heap sample of w${s.n} failed: ${String(e)}`); });
        }, 250);
        s.w.postMessage({ type: 'job', job: q.job, attempt: q.attempt } satisfies ToWorker);
        if (opts.killOnce === q.job.id && !killed) {          // tests: the worker dies holding the job
          killed = true;
          void s.w.terminate();
          onDeath(s, 'killed (test)');
        }
      }
      if (!over && out.size === jobs.length) finish();
    };
    const onMessage = (s: Slot, m: FromWorker): void => {
      if (over || s.dead) return;
      if (m.type === 'ready') {
        if (opts.data !== undefined && m.data !== opts.data) {
          finish(new Error('mutation pool: a worker read other data (the inputs changed during the run)'));
          return;
        }
        s.ready = true;
      } else if (m.type === 'error') {
        finish(new Error(`mutation pool: ${m.id ? `job ${m.id}` : 'worker start'} threw: ${m.message}`));
        return;
      } else if (s.job && m.id === s.job.id) {
        const job = s.job;
        clearTimeout(s.timer);
        clearInterval(s.sampler);
        s.job = null;
        out.set(job.id, m.out);
        opts.jobLog?.push({ id: job.id, ms: m.ms, peakHeapMb: Math.round(s.peak), retried: (attempt.get(job.id) ?? 0) > 0, worker: s.n });
        log(`mutate ${out.size}/${jobs.length} ${job.id}: ${(m.ms / 1000).toFixed(1)} s (w${s.n}${s.big ? `, ${bigCap} MB` : ''})`);
      }
      pump();
    };
    const onDeath = (s: Slot, why: string): void => {
      if (over || s.dead) return;
      stop(s);
      const job = s.job;
      s.job = null;
      if (job) {
        const next = (attempt.get(job.id) ?? 0) + 1;
        if (why === 'oom' && !s.big) {
          log(`mutate ${job.id}: out of memory at ${cap} MB, retrying at ${bigCap} MB (the serial heap)`);
          queue.unshift({ job, attempt: next, big: true });
          spawn(true);
        } else if (why === 'oom') {
          finish(new Error(`mutation pool: job ${job.id} out of memory at ${bigCap} MB (the serial heap)`));
          return;
        } else if (failed.has(job.id)) {
          finish(new Error(`mutation pool: job ${job.id} failed twice: ${failed.get(job.id)}; ${why}`));
          return;
        } else {
          failed.set(job.id, why);
          log(`mutate ${job.id}: ${why}, retrying once on a fresh worker`);
          queue.unshift({ job, attempt: next, big: s.big });
          if (s.big) spawn(true);
        }
      }
      if (!s.big && queue.some((q) => !q.big)) spawn(false);
      if (!live().length && queue.length === 0 && out.size < jobs.length) finish(new Error('mutation pool: every worker ended early'));
      pump();
    };
    for (let i = 0; i < Math.max(1, Math.min(opts.workers, queue.length)); i++) spawn(false);
  });
}
