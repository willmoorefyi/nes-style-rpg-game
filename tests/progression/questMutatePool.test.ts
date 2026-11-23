/**
 * The mutate pool (docs/TEST_SPEED_PLAN.md 5, 8; TS-P): the pool changes only where raw runs are computed, never the
 * derivation or its order (D-TS3). On the mini world (through the `module` recipe), `jobs: 1` (today's serial path)
 * deep-equals the pool at 4 workers with a shuffled queue, for both variants, with the same raw-run keys and
 * mutation line; on the clean fixture, 2 workers in order, two more shuffles and a worker killed mid-job. The failure rules on stub jobs:
 * an out of memory on the first cap is retried at the big cap and succeeds; a job that crashes twice, or times out
 * twice, rejects with its id; a check that throws fails at once. The planner and the prefilled source; the derivation
 * contexts never run a check (no graph, no closure); the machine's pool lock waits for a live holder and takes over a
 * dead one.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runMutationSuite, type ContextRecipe, type SuiteResult } from '../../src/progression/questMutateSuite.js';
import { runPool, type JobLogEntry } from '../../src/progression/questMutatePool.js';
import { acquirePoolLock } from '../../src/progression/questMutateLock.js';
import { PrefilledSource } from '../../src/progression/questMutateCheck.js';
import { mutationLine } from '../../src/progression/questReport.js';
import type { StubJob } from '../../src/progression/questMutateWorker.js';
import { miniContext } from './miniWorld.js';

const here = (f: string): string => new URL(f, import.meta.url).pathname;
const MINI: ContextRecipe = { kind: 'module', path: here('./miniWorld.ts'), export: 'miniContext' };
const CLEAN: ContextRecipe = { kind: 'module', path: here('./miniWorld.ts'), export: 'cleanContext' };
const quiet = { log: (): void => undefined };

function same(a: SuiteResult, b: SuiteResult): void {
  expect(b.plain).toEqual(a.plain);
  expect(b.strict).toEqual(a.strict);
  expect([...b.raw.keys()].sort()).toEqual([...a.raw.keys()].sort());
  for (const [k, v] of a.raw) expect(b.raw.get(k), k).toEqual(v);
  expect(mutationLine(b.strict)).toBe(mutationLine(a.strict));
}

describe('the mini world: serial == pool', async () => {
  const serial = await runMutationSuite(MINI, { jobs: 1 });
  const log: JobLogEntry[] = [];
  const four = await runMutationSuite(MINI, { jobs: 4, shuffleSeed: 7, jobLog: log, ...quiet });

  it('the suite is the mini world\'s', () => {
    expect(serial.plain.length).toBeGreaterThan(60);
    expect(four.workers).toBe(4);
    expect(log.map((e) => e.id).sort()).toEqual([...new Set(log.map((e) => e.id))].sort());
    expect(log.length).toBe(four.jobs);
  });
  it('jobs 4 with a shuffled queue deep-equals jobs 1', () => same(serial, four));
  it('fix 1: no worker\'s factory context ran a check (the worker fails a job after which it holds a graph or a '
    + 'closure), and the loaded base holds neither', () => {
    expect(four.jobs).toBeGreaterThan(0);
  });
});

describe('the clean fixture: shuffles and a killed worker', async () => {
  const serial = await runMutationSuite(CLEAN, { jobs: 1 });
  const inOrder = await runMutationSuite(CLEAN, { jobs: 2, ...quiet });
  const a = await runMutationSuite(CLEAN, { jobs: 3, shuffleSeed: 1, ...quiet });
  const b = await runMutationSuite(CLEAN, { jobs: 3, shuffleSeed: 2, ...quiet });
  const lines: string[] = [];
  const log: JobLogEntry[] = [];
  const killed = await runMutationSuite(CLEAN, { jobs: 2, killOnce: 'plain c:', jobLog: log, log: (l) => lines.push(l) });
  it('jobs 2 in order and two shuffles at 3 deep-equal jobs 1', () => { same(serial, inOrder); same(serial, a); same(serial, b); });
  it('a worker killed mid-job: its job is retried once and the result is equal', () => {
    same(serial, killed);
    expect(lines.some((l) => l.includes('plain c:: killed (test), retrying once'))).toBe(true);
    expect(log.find((e) => e.id === 'plain c:')?.retried).toBe(true);
  });
});

describe('failures (stub jobs)', () => {
  const stub = (id: string, act: StubJob['act'], mb?: number): StubJob => ({ kind: 'stub', id, keys: ['ok:'], act, mb });

  it('an out of memory on the first cap is retried at the big cap and succeeds', async () => {
    const log: JobLogEntry[] = [];
    const lines: string[] = [];
    const out = await runPool(CLEAN, [stub('big', 'alloc', 160), stub('small', 'ok')],
      { workers: 2, capMb: 48, retryCapMb: 1024, jobLog: log, log: (l) => lines.push(l) });
    expect(out.get('big')).toEqual({ 'ok:': [expect.stringMatching(/^held \d+/)] });
    expect(lines.some((l) => l.includes('big: out of memory at 48 MB, retrying at 1024 MB'))).toBe(true);
    expect(log.find((e) => e.id === 'big')?.retried).toBe(true);
  }, 60_000);
  it('out of memory at the big cap fails the run', async () => {
    await expect(runPool(CLEAN, [stub('huge', 'alloc', 400)], { workers: 1, capMb: 48, retryCapMb: 96, ...quiet }))
      .rejects.toThrow('job huge out of memory at 96 MB (the serial heap)');
  }, 60_000);
  it('a crash on the first try is retried; a job crashing twice rejects with its id', async () => {
    const out = await runPool(CLEAN, [stub('once', 'crashOnce')], { workers: 1, ...quiet });
    expect(out.get('once')).toBeDefined();
    await expect(runPool(CLEAN, [stub('twice', 'crash'), stub('fine', 'ok')], { workers: 2, ...quiet }))
      .rejects.toThrow('mutation pool: job twice failed twice: exit 1; exit 1');
  }, 60_000);
  it('a job past its timeout twice rejects', async () => {
    await expect(runPool(CLEAN, [stub('hang', 'hang')], { workers: 1, timeoutS: 0.5, ...quiet }))
      .rejects.toThrow('job hang failed twice: timeout after 0.5 s; timeout after 0.5 s');
  }, 60_000);
  it('a check that throws fails the run at once', async () => {
    await expect(runPool(CLEAN, [stub('bug', 'throw')], { workers: 1, ...quiet })).rejects.toThrow('job bug threw: stub bug throws');
  }, 60_000);
  it('a worker on other data aborts the run', async () => {
    await expect(runPool(CLEAN, [stub('x', 'ok')], { workers: 1, data: 'other', ...quiet }))
      .rejects.toThrow('a worker read other data');
  }, 60_000);
});

describe('plan and derive', () => {
  it('the prefilled source throws on a run it lacks (fail-closed)', () => {
    const src = new PrefilledSource(new Map(), new Map());
    const ctx = miniContext();
    expect(() => src.element(ctx, 'G#0 x', { proof: 'c' })).toThrow('no raw run |3000000|G#0 x|c:');
    expect(() => src.baseline(ctx, { proof: 'b', stage: 'S4' })).toThrow('no baseline run plain|b:S4');
  });
});

describe('the pool lock', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qlock-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('waits while a live pid holds it, and goes on once the holder is gone', async () => {
    const path = join(dir, 'live.lock');
    const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
    writeFileSync(path, JSON.stringify({ pid: holder.pid, worktree: 'elsewhere', started: 'then' }));
    const notes: string[] = [];
    let got = false;
    const p = acquirePoolLock({ path, pollMs: 20, onWait: (l) => notes.push(l) }).then((release) => { got = true; return release; });
    await new Promise((r) => setTimeout(r, 200));
    expect(got).toBe(false);
    expect(notes[0]).toBe(`mutate pool: waiting for the pool lock (pid ${holder.pid}, elsewhere, since then)`);
    holder.kill();
    await new Promise((r) => holder.once('exit', r));
    const release = await p;
    expect(JSON.parse(readFileSync(path, 'utf-8')).pid).toBe(process.pid);
    release();
    await expect(acquirePoolLock({ path, pollMs: 20 }).then((r) => r())).resolves.toBeUndefined();
  }, 20_000);
  it('takes over a stale lock (a dead pid), and two waiters do not both take it', async () => {
    const path = join(dir, 'stale.lock');
    writeFileSync(path, JSON.stringify({ pid: 2 ** 22 + 12345, worktree: 'gone', started: 'then' }));
    const first = await acquirePoolLock({ path, pollMs: 20 });
    expect(JSON.parse(readFileSync(path, 'utf-8')).pid).toBe(process.pid);
    let second = false;
    const p = acquirePoolLock({ path, pollMs: 20 }).then((r) => { second = true; return r; });
    await new Promise((r) => setTimeout(r, 150));
    expect(second).toBe(false);
    first();
    (await p)();
  }, 20_000);
});
