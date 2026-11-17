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
}

/** `[--strict] [--mutate] [--stage S11] [--json FILE] [--only abc] [--root DIR]`. Throws on a bad argument. */
export function parseArgs(argv: readonly string[]): VerifyArgs {
  const out: VerifyArgs = { strict: false, mutate: false };
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
    else if (a === '--only') {
      const letters = value();
      const bad = [...letters].filter((c) => !(ALL_PROOFS as readonly string[]).includes(c));
      if (bad.length) throw new Error(`--only: unknown proof ${bad.join('')} (a-h)`);
      out.only = new Set([...letters] as ProofId[]);
    } else throw new Error(`unknown argument ${a}`);
  }
  if (out.stage && !/^S\d+$/.test(out.stage)) throw new Error(`--stage: expected S<n>, got ${out.stage}`);
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
