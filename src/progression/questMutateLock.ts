/**
 * One mutate pool per machine (docs/TEST_SPEED_PLAN.md 5.4, R3): the lock file `/tmp/ff-game-quest-mutate.lock`
 * (shared by every worktree), created with `openSync(path, 'wx')` and holding `{pid, worktree, started}`. A pool that
 * finds it held waits, polling every 5 s, and prints once a minute who holds it. A lock whose pid is dead is stale and
 * is taken over under a second lock (`<lock>.takeover`, also `wx`), which re-reads the lock before removing it, so two
 * waiters cannot both take one stale lock; after its own create a pool reads the file back and goes on only when the
 * pid is its own. `QUEST_MUTATE_LOCK_HELD=1` (a parent holds it) skips the lock.
 */
import { closeSync, openSync, readFileSync, statSync, unlinkSync, writeSync } from 'node:fs';

export const POOL_LOCK = '/tmp/ff-game-quest-mutate.lock';

interface Owner {
  pid: number;
  worktree: string;
  started: string;
}

export interface LockOptions {
  path?: string;
  pollMs?: number;
  /** Called about once a minute while waiting. */
  onWait?: (line: string) => void;
  /** A lock file younger than this with no readable owner is being written: wait (ms). */
  freshMs?: number;
}

function owner(path: string): Owner | null {
  try {
    const o = JSON.parse(readFileSync(path, 'utf-8')) as Owner;
    return typeof o.pid === 'number' ? o : null;
  } catch {
    return null;
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function ageMs(path: string): number {
  try {
    return Date.now() - statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function create(path: string, body: string): boolean {
  try {
    const fd = openSync(path, 'wx');
    try {
      writeSync(fd, body);
    } finally {
      closeSync(fd);
    }
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw e;
  }
}

function removeIf(path: string, pid: number | null): void {
  const o = owner(path);
  if ((o?.pid ?? null) !== pid) return;
  try {
    unlinkSync(path);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
}

/** Takes the stale lock's place: under the takeover lock, removes it only while it still names the dead pid. */
function takeOver(path: string, dead: number | null, freshMs: number): void {
  const t = `${path}.takeover`;
  if (!create(t, JSON.stringify({ pid: process.pid, worktree: process.cwd(), started: new Date().toISOString() }))) {
    if (ageMs(t) > 60_000) removeIf(t, owner(t)?.pid ?? null);
    return;
  }
  try {
    const now = owner(path);
    const stillStale = now ? now.pid === dead && !alive(now.pid) : dead === null && ageMs(path) > freshMs;
    if (stillStale) removeIf(path, now?.pid ?? null);
  } finally {
    removeIf(t, process.pid);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Waits for the pool lock and returns its release. */
export async function acquirePoolLock(opts: LockOptions = {}): Promise<() => void> {
  if (process.env.QUEST_MUTATE_LOCK_HELD === '1') return () => undefined;
  const path = opts.path ?? POOL_LOCK;
  const poll = opts.pollMs ?? 5000;
  const freshMs = opts.freshMs ?? 30_000;
  const me: Owner = { pid: process.pid, worktree: process.cwd(), started: new Date().toISOString() };
  let lastNote = -Infinity;
  for (;;) {
    if (create(path, JSON.stringify(me)) && owner(path)?.pid === me.pid) break;
    const o = owner(path);
    if (o ? !alive(o.pid) : ageMs(path) > freshMs) {
      takeOver(path, o?.pid ?? null, freshMs);
      continue;
    }
    if (Date.now() - lastNote >= 60_000) {
      lastNote = Date.now();
      (opts.onWait ?? ((l: string) => console.error(l)))(
        `mutate pool: waiting for the pool lock (pid ${o?.pid ?? '?'}, ${o?.worktree ?? '?'}, since ${o?.started ?? '?'})`);
    }
    await sleep(poll);
  }
  let held = true;
  return () => {
    if (held) removeIf(path, me.pid);
    held = false;
  };
}
