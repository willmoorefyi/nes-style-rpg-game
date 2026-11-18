/**
 * The generic element list of docs/QUEST_PLAN.md 5.4 (minus J2, the floe and `wnd_calm`, WORLD 6.3): every gate cell,
 * a transition's `requiredFlag(s)`, a patch (forced on), a dock, a vehicle spawn's `requiredFlag(s)`, an NPC's
 * `showIf` / `hideIf` / `requiredItem` on a gift, trade, boss or cutscene NPC, and a scripted encounter's
 * `requiredFlag(s)`. Plus where an uncaught element is excused: a stage's `nonLoadBearing` entry, or a pending stage.
 */
import type { QuestContext } from './questProofs.js';
import { stageOfMap } from './questCatalog.js';
import {
  dropFlagAt, dropItemAt, editMap, flagsOf, forcePatch, npcDropFlag, worldAt, type MutElement,
} from './questMutateOps.js';

const STATE_KINDS = new Set(['gift', 'trade', 'battle', 'cutscene', 'chest']);

export function genericElements(ctx: QuestContext): MutElement[] {
  const out: MutElement[] = [];
  const add = (map: string, kind: MutElement['kind'], x: number, y: number, label: string, reads: string[],
    apply: MutElement['apply']): void => {
    const at = worldAt(ctx.world, map, x, y);
    out.push({ map, kind, at, label: `${map} ${label}`, key: `${map}:${kind}:${at[0]},${at[1]}:${label}`, reads, apply });
  };
  for (const m of [...ctx.world.maps.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const g of m.keyItemGates ?? []) {
      add(m.id, 'gate', g.x, g.y, `gate (${g.x},${g.y}) removed`, [...flagsOf(g), ...(g.requiredItem ? [g.requiredItem] : [])], (w) => editMap(w, m.id, (c) => {
        c.keyItemGates = (c.keyItemGates ?? []).filter((h) => h.x !== g.x || h.y !== g.y);
      }));
    }
    for (const t of m.transitions) {
      if (!flagsOf(t).length) continue;
      add(m.id, 'transition', t.x, t.y, `transition to ${t.targetMap} flags removed`, flagsOf(t), (w) => editMap(w, m.id, (c) => {
        for (const f of flagsOf(t)) dropFlagAt(c, 'transition', t.x, t.y, f);
      }));
    }
    for (const p of m.patches ?? []) add(m.id, 'patch', p.cells[0][0], p.cells[0][1], `patch ${p.id} forced on`, [p.flag], (w) => forcePatch(w, m.id, p.id));
    for (const d of m.docks ?? []) {
      add(m.id, 'dock', d.x, d.y, `dock ${d.id} removed`, [], (w) => editMap(w, m.id, (c) => { c.docks = (c.docks ?? []).filter((k) => k.id !== d.id); }));
    }
    for (const v of m.vehicles ?? []) {
      if (!flagsOf(v).length) continue;
      add(m.id, 'spawn', v.x, v.y, `${v.type} spawn flags removed`, flagsOf(v), (w) => editMap(w, m.id, (c) => {
        for (const f of flagsOf(v)) dropFlagAt(c, 'spawn', v.x, v.y, f);
      }));
    }
    for (const e of m.scriptedEncounters ?? []) {
      if (e.npc || !flagsOf(e).length) continue;
      add(m.id, 'encounter', e.x, e.y, `battle ${e.flag} flags removed`, flagsOf(e), (w) => editMap(w, m.id, (c) => {
        for (const f of flagsOf(e)) dropFlagAt(c, 'encounter', e.x, e.y, f);
      }));
    }
    for (const n of m.npcs) {
      const ev = ctx.cat.byNpc.get(`${m.id}\0${n.id}`);
      if (!ev || !STATE_KINDS.has(ev.kind)) continue;
      const enc = (m.scriptedEncounters ?? []).filter((e) => e.npc === n.id).flatMap(flagsOf);
      const conds = [...new Set([...(n.showIf ? [n.showIf] : []), ...(n.cutscene ? flagsOf(n.cutscene) : []), ...enc])];
      for (const f of conds) add(m.id, 'npc', n.x, n.y, `npc ${n.id} needs ${f} removed`, [f], (w) => editMap(w, m.id, (c) => npcDropFlag(c, n.id, f)));
      if (n.hideIf) {
        add(m.id, 'npc', n.x, n.y, `npc ${n.id} hideIf ${n.hideIf} removed`, [n.hideIf], (w) => editMap(w, m.id, (c) => {
          const x = c.npcs.find((v) => v.id === n.id);
          if (x) delete x.hideIf;
        }));
      }
      if (n.requiredItem) {
        const it = n.requiredItem;
        add(m.id, 'npc', n.x, n.y, `npc ${n.id} requiredItem ${it} removed`, [it], (w) => editMap(w, m.id, (c) => dropItemAt(c, 'npc', n.x, n.y, it, n.id)));
      }
    }
  }
  return out;
}

/** The reason of a stage's `nonLoadBearing` entry for the element (same map, kind and cell; the same label when the
 *  entry names one; a `--stage` run of the entry's `stage` when it names one), or null. */
export function nonLoadBearingFor(ctx: QuestContext, el: MutElement): string | null {
  for (const s of ctx.world.quest.stages) {
    for (const n of s.nonLoadBearing) {
      if (n.element !== undefined && n.element !== el.label) continue;
      if (n.stage !== undefined && n.stage !== ctx.stage) continue;
      if (n.map === el.map && n.kind === el.kind && n.at[0] === el.at[0] && n.at[1] === el.at[1]) return n.reason;
    }
  }
  return null;
}

/** `pending: ...` when the element sits on a pending stage's map or reads a flag or item only a pending stage gives. */
export function pendingReason(ctx: QuestContext, el: MutElement): string | null {
  const own = stageOfMap(ctx.world, el.map);
  if (own?.status === 'pending') return `pending: ${own.id} not built`;
  const reads = el.reads ?? [];
  const by = ctx.world.quest.stages.find((s) => s.status === 'pending'
    && [...s.grants.flags, ...s.grants.items, ...s.grants.vehicles].some((g) => reads.includes(g)));
  return by ? `pending: ${by.id} (which gives ${reads.join(', ')}) not built` : null;
}
