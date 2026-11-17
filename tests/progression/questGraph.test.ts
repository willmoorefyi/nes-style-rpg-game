/**
 * The progression-gap verifier's core (docs/QUEST_PLAN.md 4.5, 5; docs/WORLD_PLAN.md 5.2 W1-H, 6.0): the model,
 * places, events and searches on tiny fixtures, each proof (a)-(c) failing on its RED fixture, `optional`,
 * `milestones` and `towns:`, the CLI's arguments and report, the import rule, and the same proofs on the repository
 * (`npm run quest` inside `npm test`).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProofResult } from '../../src/progression/questTypes.js';
import { buildQuestWorld, loadQuestWorld } from '../../src/progression/questData.js';
import { townKeepers, townMapIds } from '../../src/progression/questCatalog.js';
import { closure, createQuestContext, proofOrder, stateGraph } from '../../src/progression/questProofs.js';
import { proofSkips, proofSoftlocks } from '../../src/progression/questChecks.js';
import { cellPath } from '../../src/progression/questSearch.js';
import { buildReport, formatReport, parseArgs, runCoreProofs } from '../../src/progression/questReport.js';
import { fixtureInput, loadFixture } from '../fixtures/quest/loadFixture.js';

function codes(r: ProofResult): string[] {
  return [...new Set(r.failures.map((f) => f.code))];
}

function run(name: string, stage?: string): ReturnType<typeof createQuestContext> {
  return createQuestContext(loadFixture(name), { stage });
}

describe('questGraph: the clean fixture', () => {
  const ctx = run('clean');
  const proofs = runCoreProofs(ctx);

  it('passes (a), (b) and (c)', () => {
    for (const p of proofs) expect(p.failures, p.line).toEqual([]);
    expect(proofs.map((p) => p.ok)).toEqual([true, true, true]);
  });

  it('(a) orders the stages along `after` and reports the optional ones, S4 by derivation', () => {
    expect(proofs[0].line).toMatch(/^\(a\) order: OK {2}S0 S1 S2 /);
    expect(proofs[0].line).toContain('optional: ');
    expect(proofs[0].line).toMatch(/S3/);
    expect(proofs[0].line).toMatch(/S4\*/);
    expect([...ctx.world.optional]).toEqual(expect.arrayContaining([['S3', 'declared'], ['S5', 'declared'], ['S4', 'derived']]));
  });

  it('the witness walks: the key, the ogre (its cutscene warps home), the sage', () => {
    const fired = closure(ctx).path().filter((id) => !id.startsWith('quest:'));
    expect(fired).toEqual(['town:gift:elder', 'cave:battle:boss', 'town:cutscene:sage']);
  });

  it('(b) withholds each ancestor\'s grants, each requirement, and each milestone in turn', () => {
    expect(proofs[1].line).toMatch(/\(b\) skips: OK {2}\(\d+ withheld runs, 0 reach a later stage; 1 milestone runs\)/);
  });

  it('(c) searches exact states: the orb is consumed, and every state reaches the goal', () => {
    const g = stateGraph(ctx);
    expect(g.limited).toBe(false);
    expect(proofs[2].line).toBe(`(c) soft-locks: OK  (${g.nodes.length} states, every one reaches GOAL_DONE)`);
    const end = g.nodes.find((n) => n.state.flags.has('GOAL_DONE'))!;
    expect(end.state.items.has('orb')).toBe(false);
    expect(end.state.items.has('key1')).toBe(true);
  });

  it('only key items and read flags are state: the potion chest is no event', () => {
    expect(ctx.cat.byId.has('town:chest:chest_potion')).toBe(false);
    expect(ctx.cat.byId.has('town:gift:elder')).toBe(true);
    expect(ctx.cat.relevantFlags.has('BOSS_DONE')).toBe(true);
  });

  it('towns: parses `towns:` and finds each town\'s maps and keepers', () => {
    const town = ctx.world.quest.towns[0];
    expect(town.id).toBe('hamlet');
    expect(townMapIds(ctx.world, town)).toEqual(['town']);
    expect(townKeepers(ctx.world, town)).toEqual([{ map: 'town', npc: 'merchant' }]);
    expect(ctx.cat.byId.get('town:shop:merchant')?.kind).toBe('shop');
  });

  it('a town naming an unknown stage is rejected', () => {
    const input = fixtureInput('clean');
    const quest = input.quest as { towns: Array<{ opensAfter: string[] }> };
    quest.towns[0].opensAfter = ['S99'];
    expect(() => buildQuestWorld(input)).toThrow(/unknown stage S99/);
  });

  it('cellPath (the curve model\'s hook) walks the world map to the gate cell', () => {
    const st = { ...ctx.start, items: new Set(['key1']) };
    const path = cellPath(ctx.world, { map: 'overworld', x: 2, y: 1, mode: 'walking' }, [{ x: 9, y: 1 }], st);
    expect(path?.length).toBe(8);
    expect(cellPath(ctx.world, { map: 'overworld', x: 2, y: 1, mode: 'walking' }, [{ x: 9, y: 1 }], ctx.start)).toBeNull();
  });
});

describe('questGraph: each proof fails on its RED fixture', () => {
  it('(a) RED goal: the orb is never given, so the goal is unreachable', () => {
    const r = proofOrder(run('red_a_goal'));
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('ORDER');
    expect(r.failures[0].message).toMatch(/^ORDER goal GOAL_DONE unreachable; never completed: S1 S2/);
  });

  it('(a) RED order: S1\'s grants hold before S0 completes', () => {
    const r = proofOrder(run('red_a_order'));
    expect(r.failures.map((f) => f.message)).toContain('ORDER S1 (orb, BOSS_DONE, CAVE_LIT) holds before S0 completes');
  });

  it('(a) RED optional: the goal needs the optional S3', () => {
    const r = proofOrder(run('red_a_optional'));
    expect(r.failures.map((f) => f.message)).toContain('OPTIONAL S3 is required: the goal is unreachable without SIDE_DONE');
  });

  it('(a) RED walk: a walk step that is not there', () => {
    const r = proofOrder(run('red_a_walk'));
    expect(r.failures.map((f) => f.message)).toEqual(['WALK S1 step 3 cave:npc:hermit: not available']);
  });

  it('(b) RED skip: the ogre is reachable without S0\'s key', () => {
    const r = proofSkips(run('red_b_skip'));
    expect(codes(r)).toEqual(['SKIP']);
    expect(r.failures[0].message).toBe('SKIP S1 ogre reachable without S0 (key1)');
    expect(r.failures[0].path).toContain('cave:battle:boss');
  });

  it('(b) RED skip in --stage mode: removing the assumed key still reaches the ogre', () => {
    expect(proofSkips(run('clean', 'S1')).ok).toBe(true);
    const r = proofSkips(run('red_b_skip', 'S1'));
    expect(r.failures.map((f) => f.message)).toContain('SKIP S1 ogre reachable without key1');
  });

  it('(b) RED milestone: CAVE_LIT without BOSS_DONE', () => {
    const r = proofSkips(run('red_b_milestone'));
    expect(r.failures.map((f) => f.message)).toContain('MILESTONE S1 CAVE_LIT reachable without BOSS_DONE');
  });

  it('(b) RED require: a declared requirement the content does not need', () => {
    const r = proofSkips(run('red_b_require'));
    expect(r.failures.map((f) => f.message)).toContain('SKIP S1 ogre reachable without its requirement BLESSED');
  });

  it('(c) RED soft-lock: trading the key away strands the quest', () => {
    const ctx = run('red_c_softlock');
    expect(proofOrder(ctx).ok).toBe(true); // saturation alone does not see it
    const r = proofSoftlocks(ctx);
    expect(codes(r)).toEqual(['SOFTLOCK']);
    expect(r.failures[0].message).toMatch(/^SOFTLOCK .* \[trinket\] cannot reach GOAL_DONE$/);
    expect(r.failures[0].path).toContain('town:trade:thief');
  });

  it('(c) RED stranded: a pit with no way back to the world map', () => {
    const r = proofSoftlocks(run('red_c_stranded'));
    expect(codes(r)).toContain('STRANDED');
    expect(r.failures.find((f) => f.code === 'STRANDED')?.message).toBe('STRANDED pit (2,1) has no route back to overworld');
  });

  it('(c) RED dead gate: a flag read but never set', () => {
    const r = proofSoftlocks(run('red_c_deadgate'));
    expect(r.failures.map((f) => f.message)).toEqual(['DEADGATE flag NEVER_SET (read by cave:gate:1,2) is never set']);
  });
});

describe('questGraph: the CLI', () => {
  it('parses its arguments', () => {
    expect(parseArgs(['--strict', '--mutate', '--stage', 'S11', '--json', '/tmp/q.json', '--only', 'ab']))
      .toEqual({ strict: true, mutate: true, stage: 'S11', json: '/tmp/q.json', only: new Set(['a', 'b']) });
    expect(() => parseArgs(['--only', 'z'])).toThrow(/unknown proof z/);
    expect(() => parseArgs(['--stage', 'X1'])).toThrow(/S<n>/);
    expect(() => parseArgs(['--bogus'])).toThrow(/unknown argument/);
  });

  it('prints the QUEST 5.3 form, failures indented, and the verdict', () => {
    const ctx = run('red_b_skip');
    const report = buildReport(ctx, runCoreProofs(ctx, new Set(['b'])));
    const lines = formatReport(report);
    expect(lines[0]).toMatch(/^quest-verify: 6 stages \(2 built, 4 pending\), \d+ places, \d+ events$/);
    expect(lines[1]).toMatch(/^\(b\) skips: FAIL/);
    expect(lines[2]).toMatch(/^ {2}SKIP S1 ogre reachable without S0 \(key1\): /);
    expect(lines[lines.length - 1]).toBe('quest-verify: FAIL');
    const ok = run('clean');
    expect(formatReport(buildReport(ok, runCoreProofs(ok))).pop()).toBe('quest-verify: OK');
  });
});

describe('questGraph: the import rule', () => {
  // QUEST 4.5: field semantics come only from fieldRules.ts (plus the data types, validators and ExperienceTable)
  const ALLOWED = [/^\.\/quest\w+\.js$/, /^\.\.\/systems\/fieldRules\.js$/, /^\.\.\/types\/index\.js$/,
    /^\.\.\/entities\/ExperienceTable\.js$/, /^\.\.\/core\/schemaValidation(Quest)?\.js$/, /^node:/, /^yaml$/];

  it('src/progression imports nothing else', () => {
    const dir = 'src/progression';
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
      const text = readFileSync(join(dir, f), 'utf-8');
      for (const m of text.matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+'([^']+)'/gm)) {
        expect(ALLOWED.some((re) => re.test(m[1])), `${f} imports ${m[1]}`).toBe(true);
      }
    }
  });
});

describe('questGraph: the repository (npm run quest)', () => {
  const ctx = createQuestContext(loadQuestWorld());
  const proofs = runCoreProofs(ctx);

  it('passes (a), (b) and (c) on the W1 head', () => {
    for (const p of proofs) expect(p.failures, p.line).toEqual([]);
  });

  it('S18 is optional by derivation (only the optional S19 depends on it); S19 and S31 are declared', () => {
    expect(ctx.world.optional.get('S18')).toBe('derived');
    expect(ctx.world.optional.get('S19')).toBe('declared');
    expect(ctx.world.optional.get('S31')).toBe('declared');
    expect(proofs[0].line).toContain('S18*');
  });

  it('act 1 is played, not assumed: Garland, the King, then the princess\'s lute', () => {
    // act 1's own events (the pass W regions' built stages fire later, on their own maps)
    const act1 = /^(cornelia|temple-of-fiends)/;
    const fired = closure(ctx).path().filter((id) => !id.startsWith('quest:') && !id.includes(':vehicle:') && act1.test(id));
    expect(fired).toEqual(['temple-of-fiends:battle:garland', 'cornelia-castle-2f:cutscene:king',
      'cornelia-castle-2f:gift:princess']);
  });

  it('S31 waits for its adamant, which no stage grants yet (an error under --strict)', () => {
    expect(proofs[0].line).toContain('S31 waits for adamant');
    const strict = proofOrder(createQuestContext(ctx.world, { strict: true }));
    expect(strict.failures.map((f) => f.code)).toContain('OPTIONAL');
    const pending = ctx.world.quest.stages.filter((s) => s.status === 'pending').length;
    expect(strict.failures.filter((f) => f.code === 'PENDING')).toHaveLength(pending);
  });
});
