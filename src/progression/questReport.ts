/**
 * The verifier's report (docs/QUEST_PLAN.md 5.3, docs/WORLD_PLAN.md 6.0): the header, one line per proof, the
 * failure lines (`SKIP S6 astos reachable without S5 (crown): <path>`), the mutation line and the verdict, plus the
 * CLI's arguments and the contract of W1-I's late proofs (questProofsLate.ts, questMutate.ts), which the CLI loads
 * when they exist.
 */
import type { MutationResult, ProofId, ProofResult, VerifyReport } from './questTypes.js';
import { placeCount, proofOrder, type QuestContext } from './questProofs.js';
import { proofSkips, proofSoftlocks } from './questChecks.js';

export const CORE_PROOFS: readonly ProofId[] = ['a', 'b', 'c'];
export const LATE_PROOFS: readonly ProofId[] = ['d', 'e', 'f', 'g', 'h'];
const ALL_PROOFS: readonly ProofId[] = [...CORE_PROOFS, ...LATE_PROOFS];

/** `src/progression/questProofsLate.ts` (W1-I) exports this: proofs (d)-(h) on the same context. */
export interface LateProofModule {
  runLateProofs(ctx: QuestContext, only?: ReadonlySet<ProofId>): ProofResult[];
}

/** `src/progression/questMutate.ts` (W1-I) exports this: the mutation suite (QUEST 5.4, WORLD 6.3). */
export interface MutateModule {
  runMutations(ctx: QuestContext): MutationResult[];
}

export function isLateProofModule(m: unknown): m is LateProofModule {
  return !!m && typeof (m as { runLateProofs?: unknown }).runLateProofs === 'function';
}

export function isMutateModule(m: unknown): m is MutateModule {
  return !!m && typeof (m as { runMutations?: unknown }).runMutations === 'function';
}

export interface VerifyArgs {
  strict: boolean;
  mutate: boolean;
  stage?: string;
  json?: string;
  only?: Set<ProofId>;
  /** The repository root (default: the working directory). */
  root?: string;
  /** NW-1: a folder of compiled maps read before `assets/maps/ai` (a scratch world compile). */
  maps?: string;
  /** NW-1: the anchors file of proof (g) (default `assets/data/world-anchors.yaml`). */
  anchors?: string;
  /** NW-1 (docs/NATURAL_WORLD_PLAN.md 4.3): rows T0-T4 run again with the canoe, every river and lake passable. */
  worstCanoe: boolean;
  /** NW-5 (docs/NATURAL_WORLD_PLAN.md 5.3): proof (c) again from every stage's reset state and mid-stage samples. */
  fromReset: boolean;
  /** `--reset-samples N`: mid-stage samples per stage of `--from-reset` (default questReset.RESET_SAMPLES). */
  resetSamples?: number;
  /** TS-P `--jobs N`: the mutate pool's workers (1: in-process, the serial reference; default questMutatePool's). */
  jobs?: number;
}

/** `[--strict] [--mutate] [--stage S11] [--json FILE] [--only abc] [--root DIR] [--maps DIR] [--anchors FILE]
 *  [--worst-canoe] [--from-reset] [--reset-samples N] [--jobs N]`. Throws on a bad argument. */
export function parseArgs(argv: readonly string[]): VerifyArgs {
  const out: VerifyArgs = { strict: false, mutate: false, worstCanoe: false, fromReset: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = (): string => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--strict') out.strict = true;
    else if (a === '--mutate') out.mutate = true;
    else if (a === '--stage') out.stage = value();
    else if (a === '--json') out.json = value();
    else if (a === '--root') out.root = value();
    else if (a === '--maps') out.maps = value();
    else if (a === '--anchors') out.anchors = value();
    else if (a === '--worst-canoe') out.worstCanoe = true;
    else if (a === '--from-reset') out.fromReset = true;
    else if (a === '--reset-samples') out.resetSamples = Number(value());
    else if (a === '--jobs') out.jobs = Number(value());
    else if (a === '--only') {
      const letters = value();
      const bad = [...letters].filter((c) => !(ALL_PROOFS as readonly string[]).includes(c));
      if (bad.length) throw new Error(`--only: unknown proof ${bad.join('')} (a-h)`);
      out.only = new Set([...letters] as ProofId[]);
    } else throw new Error(`unknown argument ${a}`);
  }
  if (out.stage && !/^S\d+$/.test(out.stage)) throw new Error(`--stage: expected S<n>, got ${out.stage}`);
  if (out.stage && out.fromReset) throw new Error('--from-reset runs every stage: it takes no --stage');
  if (out.resetSamples !== undefined && !(Number.isInteger(out.resetSamples) && out.resetSamples >= 0)) {
    throw new Error('--reset-samples: expected a whole number');
  }
  if (out.jobs !== undefined && !(Number.isInteger(out.jobs) && out.jobs >= 1)) throw new Error('--jobs: expected a whole number >= 1');
  return out;
}

export function buildReport(ctx: QuestContext, proofs: ProofResult[], mutations?: MutationResult[]): VerifyReport {
  const built = ctx.world.quest.stages.filter((s) => s.status === 'built').length;
  const total = ctx.world.quest.stages.length;
  const mutOk = !mutations || mutations.every((m) => m.caught || m.nonLoadBearing !== undefined);
  return {
    stages: { total, built, pending: total - built },
    places: placeCount(ctx),
    events: ctx.cat.events.length,
    proofs,
    ...(mutations ? { mutations } : {}),
    ok: proofs.every((p) => p.ok) && mutOk,
  };
}

/** A proof line for a missing module (fail-closed: a requested proof that can't run is a failure). */
export function missingProof(proof: ProofId, what: string): ProofResult {
  return { proof, ok: false, line: `(${proof}) ${what}: FAIL  (not built: ${what} is W1-I's)`, failures: [] };
}

function pathText(path: string[] | undefined): string {
  if (!path?.length) return '';
  const shown = path.length > 12 ? [...path.slice(0, 4), '...', ...path.slice(-7)] : path;
  return `: ${shown.join(' > ')}`;
}

export function mutationLine(mutations: MutationResult[]): string {
  const missed = mutations.filter((m) => !m.caught && m.nonLoadBearing === undefined);
  const rows = new Set(mutations.map((m) => m.row)).size;
  return missed.length
    ? `mutations: FAIL  (${missed.length} of ${mutations.length} elements not caught)`
    : `mutations: OK  (${rows} gate rows; ${mutations.length} elements, each removal reported)`;
}

/** TS-P: the pool's line after the mutation line (`cache` added by TS-C). */
export function mutateLine(jobs: number, workers: number, wallS: number, cache?: string): string {
  return `mutate: ${jobs} jobs on ${workers} worker${workers === 1 ? '' : 's'}, wall ${Math.round(wallS)} s${cache ? `, cache ${cache}` : ''}`;
}

/** The CLI's lines, in QUEST 5.3's form. */
export function formatReport(report: VerifyReport, stage?: string): string[] {
  const { stages } = report;
  const scope = stage ? ` [--stage ${stage}]` : '';
  const lines = [`quest-verify: ${stages.total} stages (${stages.built} built, ${stages.pending} pending), `
    + `${report.places} places, ${report.events} events${scope}`];
  for (const p of report.proofs) {
    lines.push(p.line);
    for (const f of p.failures) lines.push(`  ${f.message}${pathText(f.path)}`);
  }
  if (report.mutations) {
    lines.push(mutationLine(report.mutations));
    for (const m of report.mutations) {
      if (!m.caught && m.nonLoadBearing === undefined) lines.push(`  UNCAUGHT ${m.row} ${m.element} (${m.mutation})`);
    }
  }
  lines.push(`quest-verify: ${report.ok ? 'OK' : 'FAIL'}`);
  return lines;
}

/** Proofs (a)-(c), or the subset named by `only`. */
export function runCoreProofs(ctx: QuestContext, only?: ReadonlySet<ProofId>): ProofResult[] {
  const out: ProofResult[] = [];
  if (!only || only.has('a')) out.push(proofOrder(ctx));
  if (!only || only.has('b')) out.push(proofSkips(ctx));
  if (!only || only.has('c')) out.push(proofSoftlocks(ctx));
  return out;
}
