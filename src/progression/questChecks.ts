/**
 * Proofs (b) no skip and (c) no soft-lock (docs/QUEST_PLAN.md 5.2, with docs/WORLD_PLAN.md 6.0's `milestones`).
 */
import type { QuestStage } from '../types/index.js';
import type { ProofFailure, ProofResult, QuestState } from './questTypes.js';
import { ancestorsOf, globMatch } from './questData.js';
import { stageMark, withheld, type WithheldGrants } from './questStates.js';
import type { StateGraph, StateNode } from './questSearch.js';
import { eventsGranting, saturate } from './questSaturate.js';
import { fail, grantsText, reachedStage, result, stateGraph, without, type QuestContext } from './questProofs.js';

export function proofSkips(ctx: QuestContext): ProofResult {
  const { world } = ctx;
  const failures: ProofFailure[] = [];
  let runs = 0;
  let milestoneRuns = 0;
  let notRequired = 0;
  const check = (s: QuestStage, opts: { disabled?: Set<string>; withhold?: WithheldGrants }, why: string,
    start: QuestState = ctx.start, required = true): void => {
    runs++;
    const sat = saturate(ctx, start, opts);
    const hit = reachedStage(ctx, sat, s);
    if (!hit) return;
    if (!required) { notRequired++; return; }
    failures.push(fail('b', 'SKIP', `SKIP ${s.id} ${hit} reachable without ${why}`, sat.path()));
  };
  for (const s of ctx.checked) {
    if (ctx.stage) {
      // assume mode: remove each assumed grant from the start state in turn
      const req = new Set([...s.requires.flags, ...s.requires.items, ...s.requires.vehicles]);
      const st = ctx.start;
      for (const f of [...st.flags].filter((x) => !x.startsWith('@')).sort()) {
        const flags = new Set(st.flags);
        flags.delete(f);
        check(s, { withhold: withheld({ flags: [f] }) }, f, { ...st, flags }, req.has(f));
      }
      for (const i of [...st.items].sort()) {
        const items = new Set(st.items);
        items.delete(i);
        check(s, { withhold: withheld({ items: [i] }) }, i, { ...st, items }, req.has(i));
      }
      for (const v of [...new Set(st.vehicles.map((x) => x.type))].sort()) {
        const place = st.place.mode === v ? { ...st.place, mode: 'walking' as const } : st.place;
        check(s, { withhold: withheld({ vehicles: [v] }) }, v,
          { ...st, place, vehicles: st.vehicles.filter((x) => x.type !== v) }, req.has(v));
      }
    } else {
      for (const p of [...ancestorsOf(world.stages, s.id)].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))) {
        const ps = world.stages.get(p)!;
        // a built stage that grants nothing (S3, S4, S20 once built) has nothing to withhold; (a) checks its order
        if (ps.status === 'built' && grantsText(ps) === 'no grants') continue;
        check(s, without(ctx, ps), `${p} (${grantsText(ps)})`);
      }
      const needs: Array<{ flags?: string[]; items?: string[]; vehicles?: string[] }> = [
        ...s.requires.flags.map((f) => ({ flags: [f] })), ...s.requires.items.map((i) => ({ items: [i] })),
        ...s.requires.vehicles.map((v) => ({ vehicles: [v] })),
      ];
      for (const n of needs) {
        const disabled = eventsGranting(ctx, n);
        check(s, { disabled, withhold: withheld(n) }, `its requirement ${[...(n.flags ?? []), ...(n.items ?? []), ...(n.vehicles ?? [])][0]}`);
      }
    }
    const ms = s.milestones ?? [];
    for (let i = 0; i + 1 < ms.length; i++) {
      milestoneRuns++;
      const sat = saturate(ctx, ctx.start, { disabled: eventsGranting(ctx, { flags: [ms[i]] }), withhold: withheld({ flags: [ms[i]] }) });
      const later = ms.slice(i + 1).find((m) => sat.flags.has(m));
      if (later) failures.push(fail('b', 'MILESTONE', `MILESTONE ${s.id} ${later} reachable without ${ms[i]}`, sat.path()));
    }
  }
  const extra = ctx.stage ? `, ${notRequired} not required` : '';
  return result('b', 'skips', failures,
    `(${runs} withheld runs, 0 reach a later stage${extra}; ${milestoneRuns} milestone runs)`);
}

const MAX_REPORTED = 5;

export function proofSoftlocks(ctx: QuestContext): ProofResult {
  const { world, cat } = ctx;
  const g = stateGraph(ctx);
  const failures: ProofFailure[] = [];
  if (g.limited) failures.push(fail('c', 'LIMIT', `LIMIT the state search stopped at ${ctx.maxStates} states`));
  if (!g.nodes.length) {
    failures.push(fail('c', 'SOFTLOCK', `SOFTLOCK the start ${ctx.start.place.map} (${ctx.start.place.x},${ctx.start.place.y}) is no place`));
    return result('c', 'soft-locks', failures, '');
  }
  const goal = world.quest.goal;
  const target = ctx.stage ? stageMark(ctx.stage) : goal;
  const reaches = canReach(g, (n) => n.state.flags.has(target));
  let reported = 0;
  for (const [i, n] of g.nodes.entries()) {
    if (reaches[i]) continue;
    if (reported++ < MAX_REPORTED) {
      const p = n.state.place;
      failures.push(fail('c', 'SOFTLOCK', `SOFTLOCK ${p.map} (${p.x},${p.y}) ${p.mode} [${[...n.state.items].sort().join(' ')}] `
        + `cannot reach ${target}`, pathTo(g, i)));
    }
  }
  if (reported > MAX_REPORTED) failures.push(fail('c', 'SOFTLOCK', `SOFTLOCK ... and ${reported - MAX_REPORTED} more states`));
  // every place reached on foot has a route back to the world map (or the built goal)
  const goalBuilt = world.goalStage !== null && world.stages.get(world.goalStage)?.status === 'built';
  const back = canReach(g, (n) => n.comp.map === world.worldMap || (goalBuilt && n.state.flags.has(goal)));
  const strandedSeen = new Set<string>();
  for (const [i, n] of g.nodes.entries()) {
    if (back[i] || n.comp.mode !== 'walking' || strandedSeen.has(n.comp.key)) continue;
    strandedSeen.add(n.comp.key);
    if (strandedSeen.size <= MAX_REPORTED) {
      const p = n.state.place;
      failures.push(fail('c', 'STRANDED', `STRANDED ${p.map} (${p.x},${p.y}) has no route back to ${world.worldMap}`, pathTo(g, i)));
    }
  }
  // dead gates: a read flag never set, a gate item never held (in --stage mode, only the stage's own maps)
  const everFlags = new Set<string>();
  const everItems = new Set<string>();
  for (const n of g.nodes) {
    n.state.flags.forEach((f) => everFlags.add(f));
    n.state.items.forEach((x) => everItems.add(x));
  }
  const own = (by: string): boolean => !ctx.stage || ctx.checked[0].maps.some((m) => globMatch(by.split(':')[0], m));
  for (const [f, by] of cat.readFlags) {
    const readers = by.filter(own);
    if (readers.length && !everFlags.has(f)) failures.push(fail('c', 'DEADGATE', `DEADGATE flag ${f} (read by ${readers.join(', ')}) is never set`));
  }
  for (const [it, by] of cat.readItems) {
    const readers = by.filter(own);
    if (readers.length && !everItems.has(it)) failures.push(fail('c', 'DEADGATE', `DEADGATE item ${it} (read by ${readers.join(', ')}) is never held`));
  }
  return result('c', 'soft-locks', failures, `(${g.nodes.length} states, every one reaches ${target})`);
}

/** The edge ids from the start to node `n` (its first-found, shortest path). */
export function pathTo(graph: StateGraph, n: number): string[] {
  const out: string[] = [];
  for (let e = graph.parent[n]; e >= 0; e = graph.parent[graph.edges[e].from]) out.push(graph.edges[e].via);
  return out.reverse();
}

/** Nodes from which some node satisfying `target` is reachable (reverse breadth-first). */
export function canReach(graph: StateGraph, target: (n: StateNode) => boolean): boolean[] {
  const rev: number[][] = graph.nodes.map(() => []);
  for (const e of graph.edges) rev[e.to].push(e.from);
  const ok = graph.nodes.map(target);
  const queue = ok.flatMap((v, i) => (v ? [i] : []));
  for (let qi = 0; qi < queue.length; qi++) {
    for (const p of rev[queue[qi]]) if (!ok[p]) { ok[p] = true; queue.push(p); }
  }
  return ok;
}
