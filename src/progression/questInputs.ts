/**
 * The verifier's inputs, recorded where they are read (docs/TEST_SPEED_PLAN.md 3, D-TS2): every file a loader opens
 * (`readInput`, `[repo-relative path, sha256]`) or probes (`probeInput`, `[path, "absent"]` for a missing one) goes
 * into an `InputLog`, which the loaded objects carry (`QuestWorld.inputs`, `LateData.inputs`). The mutation cache's
 * fingerprint is built from those records, the verifier's bundled code closure (`verifierBundle`: the esbuild
 * metafile's inputs), the options, the runtime and a salt (`fingerprint`).
 *
 * This is the only module of the verifier's closure that may touch the file system for an input; the T2 guard
 * (`fsUsers`, questInputs.test.ts) fails on any other closure module importing `fs`.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { parse } from 'yaml';

/** `[repo-relative path, sha256 hex | "absent"]`. */
export type InputRecord = readonly [string, string];

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function posix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

/** The files one load read or probed, relative to its root. */
export class InputLog {
  private readonly seen = new Map<string, string>();

  constructor(readonly root: string) {}

  private key(path: string): string {
    return posix(relative(this.root, resolve(path)));
  }

  /** Reads and parses a YAML input, recording its bytes' hash. */
  read(path: string): unknown {
    const bytes = readFileSync(path);
    this.seen.set(this.key(path), sha256(bytes));
    return parse(bytes.toString('utf-8'));
  }

  /** True when the input exists; a missing one is recorded as "absent" (adding it later changes the world). */
  probe(path: string): boolean {
    const there = existsSync(path);
    if (!there) this.seen.set(this.key(path), 'absent');
    return there;
  }

  /** The records, sorted by path. */
  records(): InputRecord[] {
    return [...this.seen.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }
}

/** An existence check that is not an input (a `--maps` folder, an `--anchors` file: the run fails without it). */
export function pathExists(path: string): boolean {
  return existsSync(path);
}

/** The union of several loads' records (a file read twice has one hash), sorted by path. */
export function mergeInputs(...lists: ReadonlyArray<readonly InputRecord[] | undefined>): InputRecord[] {
  const out = new Map<string, string>();
  for (const list of lists) {
    for (const [p, h] of list ?? []) {
      const had = out.get(p);
      if (had !== undefined && had !== h) throw new Error(`inputs: ${p} read with two contents (${had.slice(0, 12)}, ${h.slice(0, 12)})`);
      out.set(p, h);
    }
  }
  return [...out.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** JSON with every object's keys sorted, so equal values give equal text. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** The five parts of the fingerprint (docs/TEST_SPEED_PLAN.md 3). */
export interface FingerprintParts {
  data: readonly InputRecord[];
  code: readonly InputRecord[];
  options: Record<string, unknown>;
  runtime: Record<string, string>;
  salt: string;
}

export function fingerprint(parts: FingerprintParts): string {
  return sha256(canonicalJson(parts));
}

/** The installed version of a package, read from its `node_modules/<pkg>/package.json` above `from`. */
export function installedVersion(pkg: string, from: string = process.cwd()): string {
  for (let d = resolve(from); ; d = dirname(d)) {
    const p = join(d, 'node_modules', pkg, 'package.json');
    if (existsSync(p)) return String((JSON.parse(readFileSync(p, 'utf-8')) as { version?: unknown }).version);
    if (dirname(d) === d) throw new Error(`inputs: ${pkg} is not installed above ${from}`);
  }
}

/** R6: the full Node version and the installed `yaml` and `esbuild`. */
export function runtimeVersions(from: string = process.cwd()): Record<string, string> {
  return { node: process.version, yaml: installedVersion('yaml', from), esbuild: installedVersion('esbuild', from) };
}

/** The verifier's entry points: the pool worker (the suite, the checks, the loaders), the pool and lock (through the
 *  suite), the cache, the report and the late and reset proofs. Their closure is the fingerprint's `code`. */
export const VERIFIER_ENTRIES: readonly string[] = [
  'src/progression/questMutateWorker.ts', 'src/progression/questMutateCache.ts', 'src/progression/questReport.ts',
  'src/progression/questReset.ts', 'src/progression/questProofsLate.ts',
];

export interface BundleResult {
  /** `[path, sha256]` of every source file in the bundle, relative to `codeRoot`. */
  code: InputRecord[];
  /** The esbuild metafile's inputs: path -> the paths (and externals) it imports. */
  imports: Record<string, string[]>;
  /** The files written (with `outdir`), else none. */
  outputs: string[];
}

export interface BundleOptions {
  /** The root the entries and the closure are read from (default: the working directory). */
  codeRoot?: string;
  /** Entry paths, or output name -> entry path. */
  entries?: readonly string[] | Readonly<Record<string, string>>;
  /** Write the bundle here (ESM `<name>.mjs` per entry, shared code split into chunks); otherwise nothing is
   *  written. */
  outdir?: string;
}

/** Bundles the verifier with esbuild (about 30 ms) and returns its code closure from the metafile. */
export async function verifierBundle(opts: BundleOptions = {}): Promise<BundleResult> {
  const codeRoot = resolve(opts.codeRoot ?? process.cwd());
  const entries = opts.entries ?? VERIFIER_ENTRIES;
  const { build } = await import('esbuild');
  const r = await build({
    absWorkingDir: codeRoot,
    entryPoints: Array.isArray(entries) ? [...entries] : { ...(entries as Record<string, string>) },
    bundle: true, platform: 'node', format: 'esm', external: ['yaml', 'esbuild'], metafile: true, logLevel: 'error',
    splitting: true, outExtension: { '.js': '.mjs' },
    ...(opts.outdir ? { outdir: opts.outdir, write: true } : { outdir: join(codeRoot, '.ff-bundle'), write: false }),
  });
  const inputs = r.metafile.inputs;
  const code: InputRecord[] = Object.keys(inputs).sort().map((p) => [p, sha256(readFileSync(join(codeRoot, p)))]);
  const imports: Record<string, string[]> = {};
  for (const [p, v] of Object.entries(inputs)) imports[p] = v.imports.map((i) => i.path);
  return { code, imports, outputs: opts.outdir ? Object.keys(r.metafile.outputs) : [] };
}

/** The modules allowed to import `fs`: the input recorder, and (TS-P / TS-C) the pool and the cache, which read and
 *  write only their own lock, bundle and store. */
export const FS_ALLOWED: readonly string[] = [
  'src/progression/questInputs.ts', 'src/progression/questMutateCache.ts', 'src/progression/questMutatePool.ts',
  'src/progression/questMutateLock.ts',
];

const FS_MODULES = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises']);

/** The T2 guard (docs/TEST_SPEED_PLAN.md 12): closure modules other than FS_ALLOWED that import `fs`. */
export function fsUsers(imports: Readonly<Record<string, string[]>>): string[] {
  return Object.entries(imports)
    .filter(([p, deps]) => !FS_ALLOWED.includes(p) && deps.some((d) => FS_MODULES.has(d)))
    .map(([p]) => p).sort();
}
