/**
 * The progression-gap verifier (docs/QUEST_PLAN.md 5, docs/WORLD_PLAN.md 6.0, 7):
 *
 *   npm run quest -- [--strict] [--mutate] [--stage S11] [--json /tmp/<agent>/quest.json] [--only abc] [--root DIR]
 *     [--maps DIR] [--anchors FILE] [--worst-canoe]   (NW-1: a scratch world compile, its anchors, proof (h)'s worst run)
 *     [--from-reset] [--reset-samples N]   (NW-5: proof (c) again from every stage's save-reset state, docs/NATURAL_WORLD_PLAN.md 5.3)
 *     [--jobs N] [--cache use|refresh|off] [--audit N|all]   (TS: the mutation suite's pool, 1 = in-process, the serial
 *       reference; its cache in the git common dir, docs/TEST_SPEED_PLAN.md 4, 5)
 *
 * Proofs (a)-(c) are W1-H's (src/progression/questProofs.ts). Proofs (d)-(h) come from W1-I's questProofsLate.ts,
 * loaded from the root when present. `--mutate` runs the mutation suite (both variants, questMutateSuite.ts: planned,
 * computed in the pool, derived); the variant `--strict` selects fills the report. Exit 0 with `quest-verify: OK`,
 * else 1.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadQuestWorld } from '../src/progression/questData.js';
import { createQuestContext } from '../src/progression/questProofs.js';
import { attachLate, loadLateData } from '../src/progression/questLateData.js';
import { proofFromReset } from '../src/progression/questReset.js';
import {
  buildReport, CORE_PROOFS, formatReport, isLateProofModule, LATE_PROOFS, missingProof, mutateLine, parseArgs,
  runCoreProofs,
} from '../src/progression/questReport.js';
import { mutationSuite } from '../src/progression/questMutateCache.js';
import type { MutationResult, ProofId, ProofResult } from '../src/progression/questTypes.js';

async function loadModule(root: string, name: string): Promise<unknown> {
  const path = join(root, 'src/progression', `${name}.ts`);
  if (!existsSync(path)) return null;
  return import(/* @vite-ignore */ pathToFileURL(path).href);
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root ?? process.cwd());
  const world = loadQuestWorld({ root, mapsDir: args.maps ? resolve(args.maps) : undefined });
  const ctx = attachLate(createQuestContext(world, { stage: args.stage, strict: args.strict }),
    loadLateData(root, { anchors: args.anchors ? resolve(args.anchors) : undefined, worstCanoe: args.worstCanoe }));
  const wanted = (p: ProofId): boolean => !args.only || args.only.has(p);
  const coreOnly = new Set(CORE_PROOFS.filter(wanted));
  const proofs: ProofResult[] = coreOnly.size ? runCoreProofs(ctx, coreOnly) : [];
  const lateWanted = LATE_PROOFS.filter(wanted);
  if (lateWanted.length) {
    const late = await loadModule(root, 'questProofsLate');
    if (isLateProofModule(late)) proofs.push(...late.runLateProofs(ctx, new Set(lateWanted)));
    else if (args.only) proofs.push(...lateWanted.map((p) => missingProof(p, 'questProofsLate.ts')));
  }
  if (args.fromReset) proofs.push(proofFromReset(ctx, args.resetSamples, (line) => console.error(line)).result);
  let mutations: MutationResult[] | undefined;
  let poolLine: string | undefined;
  if (args.mutate) {
    const suite = await mutationSuite({
      kind: 'repo', root, mapsDir: args.maps ? resolve(args.maps) : undefined,
      anchors: args.anchors ? resolve(args.anchors) : undefined, worstCanoe: args.worstCanoe, stage: args.stage,
    }, { jobs: args.jobs, cache: args.cache, audit: args.audit, by: 'cli' });
    mutations = args.strict ? suite.strict : suite.plain;
    const cache = suite.source === 'off' ? 'off' : `${suite.source === 'hit' ? 'hit' : suite.stored ? 'stored' : 'miss'} ${suite.fp12}`;
    poolLine = mutateLine(suite.jobs, suite.workers, suite.wallS, cache);
    const jobLog = process.env.QUEST_MUTATE_JOB_LOG;      // G1: every job's wall time and peak heap
    if (jobLog) writeFileSync(jobLog, `${JSON.stringify(suite.jobLog, null, 2)}\n`);
  }
  const report = buildReport(ctx, proofs, mutations);
  const lines = formatReport(report, args.stage);
  if (poolLine) lines.splice(lines.length - 1, 0, poolLine);
  for (const line of lines) console.log(line);
  if (world.missingMaps.length) console.log(`note: ${world.missingMaps.length} linked maps not loaded: ${world.missingMaps.join(' ')}`);
  if (args.json) {
    mkdirSync(dirname(args.json), { recursive: true });
    writeFileSync(args.json, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report.ok ? 0 : 1;
}

main().then((code) => { process.exitCode = code; }, (err: unknown) => {
  console.error(`quest-verify: error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
