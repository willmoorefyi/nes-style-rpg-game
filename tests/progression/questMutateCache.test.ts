/**
 * The mutation cache (docs/TEST_SPEED_PLAN.md 4, 8; TS-C) on the clean fixture written in the repository's layout
 * (tests/helpers/questRepoFixture.ts), with the test-only store QUEST_MUTATE_STORE=<temp dir>: a miss stores, a hit
 * gives the same results; the fixture's bytes are in the fingerprint; an edited verdict fails the re-derivation, an
 * edited light raw run fails the live audit, an edited fingerprint or inputs list and a malformed file are misses;
 * `refresh` and `off`; which runs may use the cache (R5); the store override is refused outside vitest; the writes are
 * atomic, a hit touches its mtime, pruning keeps the 32 most recently used; an input edited mid-run is not stored; no
 * stored failure holds an absolute path.
 */
import { appendFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  cacheable, KEEP_ENTRIES, mutationSuite, pickHeavy, storeDir, type CacheEntry, type CacheOptions,
} from '../../src/progression/questMutateCache.js';
import { baseContext, derive, loadRecipe, type ContextRecipe } from '../../src/progression/questMutateSuite.js';
import { writeRepoFixture } from '../helpers/questRepoFixture.js';

const temps: string[] = [];
const temp = (p: string): string => { const d = mkdtempSync(join(tmpdir(), p)); temps.push(d); return d; };
const store = temp('qstore-');
const saved = process.env.QUEST_MUTATE_STORE;
process.env.QUEST_MUTATE_STORE = store;            // before the collect-time runs below
afterAll(() => {
  if (saved === undefined) delete process.env.QUEST_MUTATE_STORE; else process.env.QUEST_MUTATE_STORE = saved;
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

const fx = writeRepoFixture(temp('qcache-'), 'clean');
const recipe: ContextRecipe = { kind: 'repo', root: fx.root, start: fx.start, worldMap: fx.worldMap };
const lines: string[] = [];
const opts = (o: CacheOptions = {}): CacheOptions => ({ jobs: 2, log: (l) => lines.push(l), by: 'test', ...o });
const entryPath = (fp: string): string => join(store, `${fp}.json`);
const readEntry = (fp: string): CacheEntry => JSON.parse(readFileSync(entryPath(fp), 'utf-8')) as CacheEntry;
const writeEntry = (fp: string, e: CacheEntry): void => writeFileSync(entryPath(fp), JSON.stringify(e));

describe('miss, store, hit', async () => {
  const miss = await mutationSuite(recipe, opts());
  const hit = await mutationSuite(recipe, opts());
  const serialHit = await mutationSuite(recipe, opts({ jobs: 1 }));

  it('a miss stores its entry; a hit (pool or in-process audit) gives the same results', () => {
    expect(miss.source).toBe('miss');
    expect(miss.stored).toBe(true);
    expect(hit.source).toBe('hit');
    expect(hit.fp).toBe(miss.fp);
    expect(hit.plain).toEqual(JSON.parse(JSON.stringify(miss.plain)));
    expect(hit.strict).toEqual(JSON.parse(JSON.stringify(miss.strict)));
    expect(serialHit.source).toBe('hit');
    expect(serialHit.strict).toEqual(hit.strict);
    expect(hit.audit.light).toBeGreaterThan(0);
    expect(hit.audit.heavy).toBe(1);
  });
  it('the entry: version, fingerprint, the fixture\'s bytes in its data, no tmp file left (atomic rename)', () => {
    const e = readEntry(miss.fp);
    expect(e.version).toBe('ts-1');
    expect(e.fingerprint).toBe(miss.fp);
    expect(e.inputs.data.map(([p]) => p)).toContain('assets/data/quest.yaml');
    expect(e.inputs.code.map(([p]) => p)).toContain('src/progression/questMutateCache.ts');
    expect(e.line).toMatch(/^mutations: /);
    expect(readdirSync(store).filter((f) => f.includes('.tmp-'))).toEqual([]);
  });
  it('no stored failure holds an absolute path', () => {
    const text = readFileSync(entryPath(miss.fp), 'utf-8');
    const raw = JSON.stringify(readEntry(miss.fp).raw) + JSON.stringify(readEntry(miss.fp).results);
    expect(raw.includes(fx.root)).toBe(false);
    expect(raw.includes(process.cwd())).toBe(false);
    expect(text.length).toBeGreaterThan(100);
  });
  it('a hit touches the entry\'s mtime', async () => {
    const old = new Date(Date.now() - 3_600_000);
    utimesSync(entryPath(miss.fp), old, old);
    await mutationSuite(recipe, opts());
    expect(statSync(entryPath(miss.fp)).mtimeMs).toBeGreaterThan(old.getTime() + 1000);
  });
  it('an edited verdict fails the re-derivation', async () => {
    const e = readEntry(miss.fp);
    const bad = { ...e, results: { ...e.results, strict: e.results.strict.map((m, i) => (i ? m : { ...m, caught: !m.caught })) } };
    writeEntry(miss.fp, bad);
    await expect(mutationSuite(recipe, opts())).rejects.toThrow(`cache entry ${miss.fp12} inconsistent`);
    writeEntry(miss.fp, e);
  });
  it('an edited raw run (consistent with its results) fails the live audit', async () => {
    const e = readEntry(miss.fp);
    const key = Object.keys(e.raw).find((k) => !k.endsWith('|c:'))!;
    const raw = { ...e.raw, [key]: [...e.raw[key], { proof: 'a' as const, code: 'X', message: 'forged' }] };
    const base = await loadRecipe(recipe);
    const results = derive(baseContext(base, false), baseContext(base, true),
      { raw: new Map(Object.entries(raw)), baseline: new Map(Object.entries(e.baseline)) });
    writeEntry(miss.fp, JSON.parse(JSON.stringify({ ...e, raw, results })) as CacheEntry);
    // the clean fixture's element jobs all hold a (c) key (heavy): audit them all (QUEST_MUTATE_AUDIT=all)
    await expect(mutationSuite(recipe, opts({ audit: 'all' }))).rejects.toThrow(`cache entry ${miss.fp12}: the live audit differs on ${key}`);
    const light = Object.keys(e.baseline).find((k) => !k.endsWith('|c:'))!;
    writeEntry(miss.fp, { ...e, baseline: { ...e.baseline, [light]: [...e.baseline[light], 'forged'] } });
    await expect(mutationSuite(recipe, opts())).rejects.toThrow(`the live audit differs on ${light}`);
    writeEntry(miss.fp, e);
  });
  it('an edited fingerprint or inputs list, or a malformed file, is a miss (with a message)', async () => {
    const e = readEntry(miss.fp);
    for (const [bad, msg] of [
      [{ ...e, fingerprint: '0'.repeat(64) }, 'malformed or of another version'],
      [{ ...e, inputs: { ...e.inputs, data: e.inputs.data.slice(1) } }, 'inputs differ (data)'],
    ] as const) {
      writeEntry(miss.fp, bad as CacheEntry);
      lines.length = 0;
      expect((await mutationSuite(recipe, opts())).source).toBe('miss');
      expect(lines.some((l) => l.includes(msg))).toBe(true);
    }
    writeFileSync(entryPath(miss.fp), '{not json');
    lines.length = 0;
    expect((await mutationSuite(recipe, opts())).source).toBe('miss');
    expect(lines.some((l) => l.includes('unreadable'))).toBe(true);
    expect((await mutationSuite(recipe, opts())).source).toBe('hit');
  });
  it('refresh runs live and overwrites; off neither reads nor writes', async () => {
    const r = await mutationSuite(recipe, opts({ cache: 'refresh' }));
    expect(r.source).toBe('miss');
    expect(r.stored).toBe(true);
    const before = readdirSync(store).length;
    const off = await mutationSuite(recipe, opts({ cache: 'off' }));
    expect(off.source).toBe('off');
    expect(readdirSync(store).length).toBe(before);
    expect(off.strict).toEqual(miss.strict);
  });
  it('one byte more in a fixture file is another fingerprint (a miss)', async () => {
    appendFileSync(join(fx.root, 'assets/data/items.yaml'), '#');
    try {
      const r = await mutationSuite(recipe, opts());
      expect(r.source).toBe('miss');
      expect(r.fp).not.toBe(miss.fp);
    } finally {
      writeFileSync(join(fx.root, 'assets/data/items.yaml'), readFileSync(join(fx.root, 'assets/data/items.yaml'), 'utf-8').replace(/#$/, ''));
    }
    expect((await mutationSuite(recipe, opts())).source).toBe('hit');
  });
  it('an input edited during the run is not stored', async () => {
    const quest = join(fx.root, 'assets/data/quest.yaml');
    const text = readFileSync(quest, 'utf-8');
    lines.length = 0;
    let edited = false;
    const r = await mutationSuite(recipe, opts({ cache: 'refresh', log: (l) => {
      lines.push(l);
      if (!edited && l.startsWith('mutate 1/')) { edited = true; appendFileSync(quest, '#'); }
    } }));
    writeFileSync(quest, text);
    expect(r.stored).toBe(false);
    expect(lines).toContain('cache: inputs changed during the run, not stored');
  });
});

describe('who may use the cache (R5) and the store', () => {
  it('only default-option runs of the working directory; the test store admits a fixture root', () => {
    const cwd = { kind: 'repo' as const, root: process.cwd() };
    expect(cacheable(cwd)).toBe(true);
    for (const bad of [{ mapsDir: '/tmp/x' }, { anchors: '/tmp/a.yaml' }, { worstCanoe: true }, { stage: 'S4' }, { maxStates: 10 }]) {
      expect(cacheable({ ...cwd, ...bad })).toBe(false);
    }
    expect(cacheable({ kind: 'module', path: 'x', export: 'y' })).toBe(false);
    expect(cacheable(recipe)).toBe(true);
    delete process.env.QUEST_MUTATE_STORE;
    try {
      expect(cacheable(recipe)).toBe(false);
      expect(cacheable({ kind: 'repo', root: fx.root })).toBe(false);
      expect(storeDir()).toMatch(/ff-cache\/quest-mutate$/);
    } finally {
      process.env.QUEST_MUTATE_STORE = store;
    }
  });
  it('QUEST_MUTATE_STORE is refused outside vitest', () => {
    const v = process.env.VITEST;
    delete process.env.VITEST;
    try {
      expect(() => storeDir()).toThrow('QUEST_MUTATE_STORE is test-only');
    } finally {
      process.env.VITEST = v;
    }
  });
  it(`pruning keeps the ${KEEP_ENTRIES} most recently used`, async () => {
    const dir = temp('qprune-');
    process.env.QUEST_MUTATE_STORE = dir;
    try {
      for (let i = 0; i < KEEP_ENTRIES + 3; i++) {
        writeFileSync(join(dir, `old${i}.json`), '{}');
        const t = new Date(Date.now() - (100 - i) * 60_000);
        utimesSync(join(dir, `old${i}.json`), t, t);
      }
      await mutationSuite(recipe, opts());
      const left = readdirSync(dir);
      expect(left.length).toBe(KEEP_ENTRIES);
      for (const i of [0, 1, 2, 3]) expect(left).not.toContain(`old${i}.json`);
    } finally {
      process.env.QUEST_MUTATE_STORE = store;
    }
  });
  it('the audit\'s heavy pick is seeded by the fingerprint', () => {
    const xs = [...Array(45).keys()];
    expect(pickHeavy(xs, 1, 'abcdef0123')).toEqual(pickHeavy(xs, 1, 'abcdef0123'));
    expect(new Set(pickHeavy(xs, 45, '12345678')).size).toBe(45);
  });
});
