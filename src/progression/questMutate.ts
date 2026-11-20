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
import { ancestorsOf, globMatch, type QuestWorld } from './questData.js';
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

const pendingTowns = (ctx: QuestContext, expect: GateRow['expect']): string[] => expect.flatMap((e) =>
  /^EARLY (\S+) /.exec(e.prefix)?.[1] ?? []).filter((t) => ctx.world.quest.towns.find((x) => x.id === t)?.status !== 'built');

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

/**
 * A row a --stage run can't catch: it expects only another stage's SKIP ((b) is the stage's own: GT-23 in S17), or its
 * element is an earlier stage's whose grants the stage's assumed start already holds (GT-23 in S18).
 */
function stageBlind(ctx: QuestContext, row: GateRow, stage: string): boolean {
  const otherSkips = row.expect.length > 0 && row.expect.every((e) => e.proof === 'b' && prefixStage(e.prefix) !== stage);
  return otherSkips || (row.stages[0] !== stage && ancestorsOf(ctx.world.stages, stage).has(row.stages[0]));
}

/** `id`: the element's place in the base world's mutation list (Baseline.freshFor). */
function runRow(ctx: QuestContext, base: Baseline, row: GateRow, el: MutElement, id: string): MutationResult {
  const stages = rowStages(row);
  const keys: CheckKey[] = row.nlb ? [{ proof: 'a' }, ...stages.map((s) => ({ proof: 'b' as const, stage: s })), { proof: 'e' }]
    : keysFor(row);
  const fresh = base.freshFor(id, () => mutatedContext(ctx, el.apply(ctx.world)), keys);
  const out: MutationResult = { row: row.row, element: `${row.element}: ${el.label}`, mutation: row.mutation, caught: false, failures: fresh };
  if (row.nlb) {
    if (fresh.length) return { ...out, caught: true };
    const reason = row.nlb === 'entry' ? nonLoadBearingFor(ctx, el) : row.nlb;
    if (reason) return { ...out, nonLoadBearing: reason };
    // the entry waits for its stage's owner while that stage is pending (A1-T: GT-5 goes live with S2's ship)
    const pend = stages.filter((s) => ctx.world.stages.get(s)?.status !== 'built');
    return pend.length ? { ...out, nonLoadBearing: `pending: ${pend.join(' ')} not built` } : out;
  }
  // --stage: a (b) expectation on another stage can't fail in this stage's scope (GT-2 in S1: SKIP S2); the full run
  // checks it, so the stage run needs only the expectations its scope can see (A1-T); a row the stage can't see at
  // all is left to the full run (ORD-O)
  const scoped = ctx.stage ? row.expect.filter((e) => e.proof !== 'b' || prefixStage(e.prefix) === ctx.stage) : [];
  const expect = scoped.length ? scoped : row.expect;
  const hit = expect.filter((e) => fresh.some((f) => f.message.startsWith(e.prefix)));
  out.caught = row.anyOf ? hit.length > 0 : hit.length === expect.length;
  if (!out.caught && ctx.stage && stageBlind(ctx, row, ctx.stage)) {
    out.nonLoadBearing = `pending: the full run checks it (--stage ${ctx.stage} can't see it)`;
  } else if (!out.caught && !builtStages(ctx, stages)) {
    out.nonLoadBearing = `pending: ${stages.filter((s) => ctx.world.stages.get(s)?.status !== 'built').join(' ')} not built`;
  } else if (!out.caught && pendingTowns(ctx, expect).length) {
    // an `EARLY <town>` expectation waits for its town like a (b) one for its stage (ERT-D: GT-12 / GT-13 with S11 built)
    out.nonLoadBearing = `pending: town ${pendingTowns(ctx, expect).join(' ')} not built`;
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
  for (const [ri, row] of GATE_ROWS.entries()) {
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
    els.forEach((el, i) => out.push(runRow(ctx, base, row, el, `${ri} ${row.row}#${i} ${el.key} ${el.label}`)));
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
  for (const [i, el] of genericElements(ctx).entries()) {
    if (named.has(spot(el)) || !mine(el)) continue;
    const fresh: ProofFailure[] = base.freshFor(`G#${i} ${el.key} ${el.label}`, () => mutatedContext(ctx, el.apply(ctx.world)), keys);
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
