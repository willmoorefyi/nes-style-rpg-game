import { ValidationError } from './schemaValidation.js';

/**
 * Validators for the R0 shared contract (docs/FIX_PLAN_PENINSULA.md, R): conditional key-item gate messages,
 * scripted encounters (with the optional talk-to-fight `npc`) and boss phases.
 */

function kind(v: unknown): string {
  return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
}

function expect(path: string, value: unknown, expected: string): void {
  if (kind(value) !== expected) throw new ValidationError(`${path}: expected ${expected}, got ${kind(value)}`);
}

function optional(path: string, value: unknown, expected: string): void {
  if (value !== undefined) expect(path, value, expected);
}

/** Plain lines, or `{condition?, text: string[]}` entries (the shape `resolveNPCDialog` reads). */
function validateConditionalDialog(path: string, value: unknown): void {
  expect(path, value, 'array');
  const entries = value as unknown[];
  if (entries.length === 0) throw new ValidationError(`${path}: expected at least one entry`);
  entries.forEach((entry, i) => {
    const p = `${path}[${i}]`;
    expect(p, entry, 'object');
    const e = entry as Record<string, unknown>;
    const bad = Object.keys(e).filter((k) => k !== 'text' && k !== 'condition');
    if (bad.length) throw new ValidationError(`${p}: unknown keys ${bad.join(', ')} (use condition)`);
    optional(`${p}.condition`, e.condition, 'string');
    expect(`${p}.text`, e.text, 'array');
    (e.text as unknown[]).forEach((line, j) => expect(`${p}.text[${j}]`, line, 'string'));
  });
}

/** `keyItemGates`: cells with a `message` that is a string or a conditional dialog list (T1). */
export function validateKeyItemGates(value: unknown): void {
  expect('MapData.keyItemGates', value, 'array');
  (value as unknown[]).forEach((gate, i) => {
    const p = `MapData.keyItemGates[${i}]`;
    expect(p, gate, 'object');
    const g = gate as Record<string, unknown>;
    expect(`${p}.x`, g.x, 'number');
    expect(`${p}.y`, g.y, 'number');
    optional(`${p}.requiredItem`, g.requiredItem, 'string');
    optional(`${p}.requiredFlag`, g.requiredFlag, 'string');
    optional(`${p}.flag`, g.flag, 'string');
    expect(`${p}.permanent`, g.permanent, 'boolean');
    if (typeof g.message === 'string') return;
    if (!Array.isArray(g.message)) throw new ValidationError(`${p}.message: expected string or array, got ${kind(g.message)}`);
    validateConditionalDialog(`${p}.message`, g.message);
  });
}

/** `scriptedEncounters`: an optional `npc` must name an `npcs[].id` of the same map (B1). */
export function validateScriptedEncounters(value: unknown, npcIds: string[]): void {
  expect('MapData.scriptedEncounters', value, 'array');
  (value as unknown[]).forEach((enc, i) => {
    const p = `MapData.scriptedEncounters[${i}]`;
    expect(p, enc, 'object');
    const e = enc as Record<string, unknown>;
    expect(`${p}.x`, e.x, 'number');
    expect(`${p}.y`, e.y, 'number');
    expect(`${p}.enemyIds`, e.enemyIds, 'array');
    (e.enemyIds as unknown[]).forEach((id, j) => expect(`${p}.enemyIds[${j}]`, id, 'string'));
    expect(`${p}.flag`, e.flag, 'string');
    expect(`${p}.isBoss`, e.isBoss, 'boolean');
    optional(`${p}.requiredFlag`, e.requiredFlag, 'string');
    optional(`${p}.message`, e.message, 'string');
    optional(`${p}.postVictoryCutscene`, e.postVictoryCutscene, 'string');
    if (e.npc === undefined) return;
    expect(`${p}.npc`, e.npc, 'string');
    if (!npcIds.includes(e.npc as string)) {
      throw new ValidationError(`${p}.npc: no NPC with id '${String(e.npc)}' on this map`);
    }
  });
}

/** `bossPhases`: `hpThreshold` in (0, 1], a `patternId`, and the optional `message`, `hits`, `attack` (B1),
 * `attackAnim` (heavy from this phase on, ROSTER_PLAN 7.2), `form` (the next form's enemy id) and `interlude` (its
 * battle-interludes.yaml id; CHAOS_FORMS_PLAN 2.2 item 1, and on a non-form phase too, 18.8 row 2c). */
export function validateBossPhases(value: unknown): void {
  expect('EnemyData.bossPhases', value, 'array');
  (value as unknown[]).forEach((phase, i) => {
    const p = `EnemyData.bossPhases[${i}]`;
    expect(p, phase, 'object');
    const ph = phase as Record<string, unknown>;
    expect(`${p}.hpThreshold`, ph.hpThreshold, 'number');
    const t = ph.hpThreshold as number;
    if (!(t > 0 && t <= 1)) throw new ValidationError(`${p}.hpThreshold: expected a number in (0, 1], got ${t}`);
    expect(`${p}.patternId`, ph.patternId, 'string');
    optional(`${p}.message`, ph.message, 'string');
    optional(`${p}.hits`, ph.hits, 'number');
    optional(`${p}.attack`, ph.attack, 'number');
    if (ph.attackAnim !== undefined && ph.attackAnim !== 'heavy') {
      throw new ValidationError(`${p}.attackAnim: expected heavy, got ${String(ph.attackAnim)}`);
    }
    for (const key of ['form', 'interlude'] as const) {
      if (ph[key] !== undefined && (typeof ph[key] !== 'string' || ph[key] === '')) {
        throw new ValidationError(`${p}.${key}: expected an id, got ${JSON.stringify(ph[key])}`);
      }
    }
  });
}
