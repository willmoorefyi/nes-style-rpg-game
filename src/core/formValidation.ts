import type { EnemyData } from '../types/index.js';

/**
 * The cross-file boss-form rules (docs/CHAOS_FORMS_PLAN.md 2.2 item 1), checked by tests/data/chaosForms.test.ts:
 * every `form` names an enemy and every `interlude` a script; a form record carries `formOf` (its chain's root) and no
 * `num`; each record of a chain has the root's `stats.hp` (the shared pool); a chain has no cycle; the form thresholds
 * strictly descend along it. Returns the problems (empty when the data is good).
 */
export function formChainErrors(enemies: readonly EnemyData[], interludes: ReadonlySet<string>): string[] {
  const byId = new Map(enemies.map((e) => [e.id, e]));
  const errors: string[] = [];
  const formPhases = (e: EnemyData) => (e.bossPhases ?? []).filter((p) => p.form !== undefined);
  for (const e of enemies) {
    for (const p of e.bossPhases ?? []) {
      if (p.form !== undefined && !byId.has(p.form)) errors.push(`${e.id}: form "${p.form}" is not an enemy`);
      if (p.interlude !== undefined && !interludes.has(p.interlude)) errors.push(`${e.id}: interlude "${p.interlude}" is not in battle-interludes.yaml`);
    }
    if (e.formOf !== undefined && e.num !== undefined) errors.push(`${e.id}: a form record (formOf) has no num`);
    if (e.formOf !== undefined && !byId.has(e.formOf)) errors.push(`${e.id}: formOf "${e.formOf}" is not an enemy`);
  }
  // walk every chain from its root (an enemy with form phases and no formOf)
  for (const root of enemies.filter((e) => e.formOf === undefined && formPhases(e).length > 0)) {
    const seen = new Set([root.id]);
    let last = Infinity;
    for (let e: EnemyData | undefined = root; e;) {
      const phases = formPhases(e);
      if (phases.length > 1) errors.push(`${e.id}: more than one form phase`);
      const p = phases[0];
      if (!p) break;
      if (!(p.hpThreshold < last)) errors.push(`${e.id}: form thresholds must be strictly descending along the chain (${p.hpThreshold} after ${last})`);
      last = p.hpThreshold;
      const next = byId.get(p.form!);
      if (!next) break;
      if (seen.has(next.id)) { errors.push(`${root.id}: the form chain has a cycle at ${next.id}`); break; }
      seen.add(next.id);
      if (next.formOf !== root.id) errors.push(`${next.id}: formOf must be "${root.id}" (got ${String(next.formOf)})`);
      if (next.stats.hp !== root.stats.hp) errors.push(`${next.id}: stats.hp ${next.stats.hp} differs from the pool ${root.stats.hp} of ${root.id}`);
      e = next;
    }
  }
  return errors;
}
