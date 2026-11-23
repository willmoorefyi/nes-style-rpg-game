/**
 * A mutate pool worker (docs/TEST_SPEED_PLAN.md 5.2): bundled by questMutatePool.ts with esbuild and run as a
 * `worker_threads` worker. It loads its recipe's world and late data once, builds one **factory** base context (only
 * for the element list, `el.apply` and `mutatedContext`: it never runs a check key, so it never holds a state graph),
 * posts its data fingerprint, then runs the jobs main sends:
 * - an element job: the element's mutated context (built once), each key with `runCheck`, then dropped;
 * - a baseline job: a throwaway base context of the variant (fresh caches), its keys, then dropped.
 * A check that throws is posted as an error (a bug: the pool fails at once). Test-only stub jobs exercise the pool.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { elementsById } from './questMutate.js';
import { baseContext, dataPrint, loadRecipe, runJob, type ContextRecipe, type Job, type JobOutput } from './questMutateSuite.js';

export interface WorkerData {
  recipe: ContextRecipe;
  /** recipe module path -> the bundled module's file URL */
  modules: Record<string, string>;
}

/** Test-only jobs (questMutatePool.test.ts): allocate past a small heap cap, crash, crash on the first try, hang. */
export type StubJob = { kind: 'stub'; id: string; keys: string[]; act: 'ok' | 'alloc' | 'crash' | 'crashOnce' | 'hang' | 'throw'; mb?: number };

export type ToWorker = { type: 'job'; job: Job | StubJob; attempt: number };
export type FromWorker =
  | { type: 'ready'; data: string }
  | { type: 'done'; id: string; out: JobOutput; ms: number }
  | { type: 'error'; id: string | null; message: string };

function stub(job: StubJob, attempt: number): JobOutput {
  if (job.act === 'crash' || (job.act === 'crashOnce' && attempt === 0)) process.exit(1);
  if (job.act === 'throw') throw new Error(`stub ${job.id} throws`);
  if (job.act === 'hang') for (;;) { /* until the pool's timeout terminates this worker */ }
  const hold: number[][] = [];
  if (job.act === 'alloc') for (let i = 0; i < (job.mb ?? 64) * 16; i++) hold.push(new Array(8192).fill(i));
  return { [job.keys[0] ?? 'ok:']: [`held ${hold.length}`] };
}

async function main(): Promise<void> {
  const port = parentPort;
  if (!port) throw new Error('questMutateWorker: not in a worker thread');
  const data = workerData as WorkerData;
  const base = await loadRecipe(data.recipe, (p) => import(/* @vite-ignore */ data.modules[p] ?? p));
  const factory = baseContext(base, false);
  const els = elementsById(factory);
  const post = (m: FromWorker): void => port.postMessage(m);
  port.on('message', (m: ToWorker) => {
    const t0 = Date.now();
    const { job } = m;
    try {
      const out = job.kind === 'stub' ? stub(job, m.attempt) : runJob(base, factory, els, job);
      post({ type: 'done', id: job.id, out, ms: Date.now() - t0 });
    } catch (e) {
      post({ type: 'error', id: job.id, message: e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e) });
    }
  });
  post({ type: 'ready', data: dataPrint(base) });
}

main().catch((e: unknown) => {
  parentPort?.postMessage({ type: 'error', id: null, message: e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e) });
});
