/**
 * The no-skip mutation suite (docs/WORLD_PLAN.md 6.3, docs/QUEST_PLAN.md 5.4), loaded by the CLI (`--mutate`,
 * `MutateModule` in questReport.ts). Two parts:
 * - the gate table GT-1 to GT-37 (questMutateRows.ts): each element is changed alone and its expected catch must
 *   appear (a failure the unmutated world lacks, with the row's message prefix);
 * - the generic element list of QUEST 5.4 (questMutateGeneric.ts) for everything the table does not name: any new
 *   failure catches it.
 * An element that is not caught must be listed in a stage's `nonLoadBearing` (or be one of the table's
 * non-load-bearing rows). A row whose stages are still pending, or whose element is not built yet, is reported as
 * `pending: ...` in `nonLoadBearing` (a failure with --strict): INT runs those rows on the real world.
 */
import type { MutationResult, ProofFailure } from './questTypes.js';
import { createQuestContext, type QuestContext } from './questProofs.js';
import { attachLate, lateOf } from './questLateData.js';
import { globMatch, type QuestWorld } from './questData.js';
import { Baseline, prefixStage, stageSkips, type CheckKey } from './questMutateCheck.js';
import { GATE_ROWS, type GateRow } from './questMutateRows.js';
import type { MutElement } from './questMutateOps.js';
import { genericElements, nonLoadBearingFor, pendingReason } from './questMutateGeneric.js';

/** A context on a mutated world, with the base context's options and late data. */
export function mutatedContext(ctx: QuestContext, w: QuestWorld): QuestContext {
  return attachLate(createQuestContext(w, { stage: ctx.stage, maxStates: ctx.maxStates }), lateOf(ctx));
}

/** An element's place (map, kind, cell): a generic element the gate table already runs is skipped. */
const spot = (el: MutElement): string => `${el.map}:${el.kind}:${el.at[0]},${el.at[1]}`;

function keysFor(row: GateRow): CheckKey[] {
  return row.expect.map((e) => (e.proof === 'b' ? { proof: 'b', stage: prefixStage(e.prefix) } : { proof: e.proof }));
}

function builtStages(ctx: QuestContext, ids: string[]): boolean {
  return ids.every((id) => ctx.world.stages.get(id)?.status === 'built');
}

function rowStages(row: GateRow): string[] {
  return [...new Set([...row.stages, ...row.expect.flatMap((e) => prefixStage(e.prefix) ?? [])])];
}

function probe(ctx: QuestContext, row: GateRow): MutationResult {
  const s = ctx.world.stages.get(row.probe!.stage);
  const base = { row: row.row, element: row.element, mutation: row.mutation };
  if (!s || s.status !== 'built' || (s.milestones ?? []).length < 2) {
    return { ...base, caught: false, nonLoadBearing: `pending: ${row.probe!.stage} not built`, failures: [] };
  }
  const failures = stageSkips(ctx, s).filter((f) => f.code === 'MILESTONE' && f.message.endsWith(`without ${s.milestones![0]}`));
  if (!failures.length) return { ...base, caught: true, failures: [] };
  return { ...base, caught: false, failures };
}

function runRow(ctx: QuestContext, base: Baseline, row: GateRow, el: MutElement): MutationResult {
  const mctx = mutatedContext(ctx, el.apply(ctx.world));
  const stages = rowStages(row);
  const keys: CheckKey[] = row.nlb ? [{ proof: 'a' }, ...stages.map((s) => ({ proof: 'b' as const, stage: s })), { proof: 'e' }]
    : keysFor(row);
  const fresh = base.fresh(mctx, keys);
  const out: MutationResult = { row: row.row, element: `${row.element}: ${el.label}`, mutation: row.mutation, caught: false, failures: fresh };
  if (row.nlb) {
    if (fresh.length) return { ...out, caught: true };
    const reason = row.nlb === 'entry' ? nonLoadBearingFor(ctx, el) : row.nlb;
    return reason ? { ...out, nonLoadBearing: reason } : out;
  }
  const hit = row.expect.filter((e) => fresh.some((f) => f.message.startsWith(e.prefix)));
  out.caught = row.anyOf ? hit.length > 0 : hit.length === row.expect.length;
  if (!out.caught && !builtStages(ctx, stages)) {
    out.nonLoadBearing = `pending: ${stages.filter((s) => ctx.world.stages.get(s)?.status !== 'built').join(' ')} not built`;
  } else if (!out.caught) {
    const reason = nonLoadBearingFor(ctx, el);
    if (reason) out.nonLoadBearing = reason;
  }
  return out;
}

/** The gate-table rows only (questMutate.test.ts asserts each by name). */
export function runGateRows(ctx: QuestContext, only?: ReadonlySet<string>): MutationResult[] {
  const base = new Baseline(ctx);
  const out: MutationResult[] = [];
  for (const row of GATE_ROWS) {
    if (only && !only.has(row.row)) continue;
    if (ctx.stage && !row.stages.includes(ctx.stage)) continue;
    if (row.probe) { out.push(probe(ctx, row)); continue; }
    const els = row.find(ctx);
    if (!els.length) {
      const pend = rowStages(row).filter((s) => ctx.world.stages.get(s)?.status !== 'built');
      out.push({ row: row.row, element: row.element, mutation: row.mutation, caught: false, failures: [],
        ...(pend.length ? { nonLoadBearing: `pending: not built yet (${pend.join(' ')} pending)` }
          : { failures: [{ proof: 'b', code: 'MISSING', message: `MISSING ${row.row} ${row.element}: not found` }] }) });
      continue;
    }
    for (const el of els) out.push(runRow(ctx, base, row, el));
  }
  return out;
}

/** The generic elements (QUEST 5.4) the gate table does not name. */
export function runGeneric(ctx: QuestContext, named: ReadonlySet<string>): MutationResult[] {
  const base = new Baseline(ctx);
  // (b) for the built stages and the stages right after one (a pending stage's grant waits for its `after` markers)
  const built = new Set(ctx.checked.filter((s) => s.status === 'built').map((s) => s.id));
  const scope = ctx.checked.filter((s) => built.has(s.id) || s.after.some((a) => built.has(a)));
  const keys: CheckKey[] = [{ proof: 'a' }, ...scope.map((s) => ({ proof: 'b' as const, stage: s.id })), { proof: 'c' }, { proof: 'e' }];
  const out: MutationResult[] = [];
  // --stage: only the stage's own elements (its maps, and world-map elements that read its grants)
  const own = ctx.stage ? ctx.world.stages.get(ctx.stage)! : null;
  const mine = (el: MutElement): boolean => !own || own.maps.some((g) => globMatch(el.map, g))
    || (el.map === ctx.world.worldMap && (el.reads ?? []).some((r) => [...own.grants.flags, ...own.grants.items].includes(r)));
  for (const el of genericElements(ctx)) {
    if (named.has(spot(el)) || !mine(el)) continue;
    const fresh: ProofFailure[] = base.fresh(mutatedContext(ctx, el.apply(ctx.world)), keys);
    const r: MutationResult = { row: `G ${el.map}`, element: el.label, mutation: 'remove', caught: fresh.length > 0, failures: fresh };
    if (!r.caught) {
      const reason = nonLoadBearingFor(ctx, el) ?? pendingReason(ctx, el);
      if (reason) r.nonLoadBearing = reason;
    }
    out.push(r);
  }
  return out;
}

export function runMutations(ctx: QuestContext): MutationResult[] {
  const rows = runGateRows(ctx);
  const named = new Set<string>();
  for (const row of GATE_ROWS) if (!row.probe) for (const el of row.find(ctx)) named.add(spot(el));
  const out = [...rows, ...runGeneric(ctx, named)];
  if (ctx.strict) {
    for (const m of out) {
      if (m.nonLoadBearing?.startsWith('pending')) { m.failures = [...m.failures]; delete m.nonLoadBearing; }
    }
  }
  return out;
}
