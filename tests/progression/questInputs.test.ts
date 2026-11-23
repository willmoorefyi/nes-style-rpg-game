/**
 * The verifier's recorded inputs and the mutation cache's fingerprint (docs/TEST_SPEED_PLAN.md 3, 8; TS-0), on the
 * repository-layout fixture (tests/helpers/questRepoFixture.ts) so every load goes through the input recorder:
 * - data: one byte changed in any file the loaders read flips the fingerprint, a probed-absent linked map appearing
 *   flips it, a file no loader reads does not;
 * - options, runtime and salt flip it;
 * - code: the bundle's metafile closure holds the field rules, the save reset and revalidation and the schema
 *   validators, and a comment-only edit of a closure file (in a temp copy) flips its code part;
 * - the T2 guard (plan 12): no module of the closure but the recorder (and the pool and cache) imports `fs`.
 */
import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../src/progression/questData.js';
import { loadLateData } from '../../src/progression/questLateData.js';
import {
  canonicalJson, fingerprint, fsUsers, mergeInputs, runtimeVersions, verifierBundle, type FingerprintParts,
} from '../../src/progression/questInputs.js';
import { LEGACY_MISSING, writeRepoFixture, type RepoFixture } from '../helpers/questRepoFixture.js';

const temps: string[] = [];
function temp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  temps.push(d);
  return d;
}
afterAll(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }); });

function dataOf(fx: RepoFixture): ReturnType<typeof mergeInputs> {
  const world = loadQuestWorld({ root: fx.root, start: fx.start, worldMap: fx.worldMap });
  return mergeInputs(world.inputs, loadLateData(fx.root).inputs);
}

const BASE: Omit<FingerprintParts, 'data'> = {
  code: [['src/progression/questData.ts', 'c0de']], options: { stage: null, maxStates: 3_000_000 },
  runtime: { node: 'v0' }, salt: 'ts-1',
};
const fpData = (fx: RepoFixture): string => fingerprint({ ...BASE, data: dataOf(fx) });

describe('data: every file the loaders read or probe', () => {
  const fx = writeRepoFixture(temp('qin-'));
  const base = fpData(fx);
  const read = dataOf(fx).filter(([, h]) => h !== 'absent').map(([p]) => p);

  it('records every written file, with the linked legacy map and the probed-absent one', () => {
    expect(read.sort()).toEqual([...fx.files].sort());
    expect(dataOf(fx)).toContainEqual([`assets/maps/${LEGACY_MISSING}.yaml`, 'absent']);
    expect(fpData(fx)).toBe(base);
  });

  for (const rel of fx.files) {
    it(`one byte more in ${rel} flips the fingerprint`, () => {
      const p = join(fx.root, rel);
      const before = readFileSync(p);
      appendFileSync(p, '#');
      try {
        expect(fpData(fx)).not.toBe(base);
      } finally {
        writeFileSync(p, before);
      }
      expect(fpData(fx)).toBe(base);
    });
  }

  it('a probed-absent linked legacy map appearing flips it', () => {
    const p = join(fx.root, `assets/maps/${LEGACY_MISSING}.yaml`);
    writeFileSync(p, 'id: legacy-missing\nwidth: 1\nheight: 1\nlayers: []\ntilesets: []\ncollision: [0]\nnpcs: []\ntransitions: []\n');
    try {
      expect(fpData(fx)).not.toBe(base);
    } finally {
      rmSync(p);
    }
    expect(fpData(fx)).toBe(base);
  });

  it('a file no loader reads does not', () => {
    writeFileSync(join(fx.root, 'assets/data/x.yaml'), 'stray: true\n');
    writeFileSync(join(fx.root, 'assets/maps/ai/unlisted.yaml'), 'id: unlisted\n');
    expect(fpData(fx)).toBe(base);
  });

  it('a file read twice with two contents throws (the loaders read one tree)', () => {
    expect(() => mergeInputs([['a', '1']], [['a', '2']])).toThrow(/two contents/);
    expect(mergeInputs([['b', '1'], ['a', '2']], [['a', '2']])).toEqual([['a', '2'], ['b', '1']]);
  });
});

describe('options, runtime and salt', () => {
  const data: FingerprintParts['data'] = [['assets/data/quest.yaml', 'q']];
  const base = fingerprint({ ...BASE, data });
  const flips: Array<[string, Partial<FingerprintParts>]> = [
    ['maxStates', { options: { ...BASE.options, maxStates: 1000 } }],
    ['stage', { options: { ...BASE.options, stage: 'S11' } }],
    ['worstCanoe', { options: { ...BASE.options, worstCanoe: true } }],
    ['start', { options: { ...BASE.options, start: { map: 'overworld', x: 2, y: 2 } } }],
    ['runtime', { runtime: { node: 'v1' } }],
    ['salt', { salt: 'ts-2' }],
  ];
  for (const [name, over] of flips) {
    it(`${name} flips it`, () => expect(fingerprint({ ...BASE, data, ...over })).not.toBe(base));
  }
  it('key order does not matter (canonical JSON)', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
    expect(fingerprint({ salt: BASE.salt, runtime: BASE.runtime, options: { maxStates: 3_000_000, stage: null },
      code: BASE.code, data })).toBe(base);
  });
  it('runtime: the installed yaml and esbuild (R6, R15)', () => {
    const r = runtimeVersions();
    expect(r.node).toBe(process.version);
    expect(r.yaml).toMatch(/^\d+\.\d+\.\d+/);
    expect(r.esbuild).toBe('0.21.5');
  });
});

describe('code: the bundle closure', async () => {
  const bundle = await verifierBundle();
  const paths = bundle.code.map(([p]) => p);

  it('holds the verifier and the modules it runs', () => {
    for (const p of ['src/progression/questMutate.ts', 'src/progression/questProofs.ts', 'src/progression/questInputs.ts',
      'src/systems/fieldRules.ts', 'src/systems/worldReset.ts', 'src/systems/worldRevalidate.ts',
      'src/core/schemaValidation.ts', 'src/entities/ExperienceTable.ts',
      // WR (docs/TEST_SPEED_PLAN.md 11): the wrapped world's step and the verifier's wrap
      'src/systems/worldWrap.ts', 'src/progression/questWrap.ts',
      // TS-P / TS-C: the pool, its lock and worker, the cache (the salt's file)
      'src/progression/questMutatePool.ts', 'src/progression/questMutateLock.ts', 'src/progression/questMutateWorker.ts',
      'src/progression/questMutateCache.ts']) expect(paths).toContain(p);
    expect(paths.every((p) => p.startsWith('src/'))).toBe(true);
  });

  it('a comment-only edit of a closure file flips the code part', async () => {
    const root = temp('qcode-');
    for (const p of paths) {
      mkdirSync(dirname(join(root, p)), { recursive: true });
      copyFileSync(p, join(root, p));
    }
    const same = await verifierBundle({ codeRoot: root });
    expect(same.code).toEqual(bundle.code);
    appendFileSync(join(root, 'src/systems/fieldRules.ts'), '\n// a comment\n');
    const edited = await verifierBundle({ codeRoot: root });
    expect(edited.code).not.toEqual(bundle.code);
    expect(edited.code.filter(([p, h]) => bundle.code.find(([q]) => q === p)?.[1] !== h).map(([p]) => p))
      .toEqual(['src/systems/fieldRules.ts']);
  });

  it('T2: no closure module but the recorder, the pool and the cache imports fs', () => {
    expect(fsUsers(bundle.imports)).toEqual([]);
    expect(bundle.imports['src/progression/questInputs.ts']).toContain('node:fs');
    expect(fsUsers({ 'src/systems/x.ts': ['node:fs/promises'], 'src/progression/questInputs.ts': ['node:fs'] }))
      .toEqual(['src/systems/x.ts']);
  });
});
