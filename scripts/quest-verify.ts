/**
 * The progression-gap verifier (docs/QUEST_PLAN.md 5, docs/WORLD_PLAN.md 6.0, 7):
 *
 *   npm run quest -- [--strict] [--mutate] [--stage S11] [--json /tmp/<agent>/quest.json] [--only abc] [--root DIR]
 *     [--maps DIR] [--anchors FILE] [--worst-canoe]   (NW-1: a scratch world compile, its anchors, proof (h)'s worst run)
 *
 * Proofs (a)-(c) are W1-H's (src/progression/questProofs.ts). Proofs (d)-(h) and `--mutate` come from W1-I's
 * questProofsLate.ts and questMutate.ts, loaded when present: without them the default run reports (a)-(c) only,
 * and a run that asks for them (`--only d`, `--mutate`) fails. Exit 0 with `quest-verify: OK`, else 1.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadQuestWorld } from '../src/progression/questData.js';
import { createQuestContext } from '../src/progression/questProofs.js';
import { attachLate, loadLateData } from '../src/progression/questLateData.js';
import {
  buildReport, CORE_PROOFS, formatReport, isLateProofModule, isMutateModule, LATE_PROOFS, missingProof, parseArgs,
  runCoreProofs,
} from '../src/progression/questReport.js';
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
  let mutations: MutationResult[] | undefined;
  if (args.mutate) {
    const mod = await loadModule(root, 'questMutate');
    mutations = isMutateModule(mod) ? mod.runMutations(ctx)
      : [{ row: 'MUTATE', element: 'questMutate.ts', mutation: 'not built (W1-I)', caught: false, failures: [] }];
  }
  const report = buildReport(ctx, proofs, mutations);
  for (const line of formatReport(report, args.stage)) console.log(line);
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
