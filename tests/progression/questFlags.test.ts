/**
 * Flag ownership (docs/QUEST_PLAN.md 2.1, docs/WORLD_PLAN.md 3.1): a map of tranche T sets only T's local flags
 * (region prefix plus its sub-letter: `ELF_T_...`, `CHEST_ELF_T_...`; `PST_...` for PST) and the milestone flags of
 * T's stages; no local flag equals a milestone flag. Act-1 maps (S0, tranche "-") keep their flags. On the shared
 * world map only O tranches build, so a local flag there carries an `_O_` sub-letter.
 */
import { describe, expect, it } from 'vitest';
import { LOCAL_FLAG_PREFIXES, STORY_FLAGS } from '../../src/core/GameFlags.js';
import { loadQuestWorld, type QuestWorld } from '../../src/progression/questData.js';
import { flagsSetByMap, stageOfMap } from '../../src/progression/questCatalog.js';
import { loadFixture } from '../fixtures/quest/loadFixture.js';

/** `ELF-T` -> `ELF_T_`, `FIR-D1` -> `FIR_D1_`, `PST` -> `PST_`. */
function tranchePrefix(tranche: string): string {
  return `${tranche.replace(/-/g, '_')}_`;
}

function localPart(flag: string): string {
  return flag.startsWith('CHEST_') ? flag.slice('CHEST_'.length) : flag;
}

function isLocal(flag: string): boolean {
  return LOCAL_FLAG_PREFIXES.some((p) => localPart(flag).startsWith(p));
}

/** Every rule violation as `<map>: <flag> (<why>)`. */
function flagViolations(world: QuestWorld): string[] {
  const out: string[] = [];
  const milestones = new Map<string, string>();
  for (const s of world.quest.stages) for (const f of s.grants.flags) milestones.set(f, s.tranche);
  for (const map of world.maps.values()) {
    const stage = stageOfMap(world, map.id);
    const tranche = stage?.tranche;
    for (const f of flagsSetByMap(world, map)) {
      if (map.id === world.worldMap) {
        if (isLocal(f) && !/^[A-Z0-9]+_O_/.test(localPart(f))) out.push(`${map.id}: ${f} (a world-map flag is an O tranche's)`);
        continue;
      }
      if (!tranche || tranche === '-') continue;
      if (milestones.has(f)) {
        if (milestones.get(f) !== tranche) out.push(`${map.id}: ${f} (milestone of ${milestones.get(f)}, map of ${tranche})`);
        continue;
      }
      if (!localPart(f).startsWith(tranchePrefix(tranche))) out.push(`${map.id}: ${f} (not ${tranchePrefix(tranche)}...)`);
    }
  }
  for (const f of milestones.keys()) if (isLocal(f)) out.push(`quest.yaml: ${f} (a milestone with a local prefix)`);
  for (const f of Object.values(STORY_FLAGS)) if (isLocal(f)) out.push(`GameFlags: ${f} (a story flag with a local prefix)`);
  return out.sort();
}

describe('questFlags: flag ownership', () => {
  it('the repository breaks no ownership rule', () => {
    expect(flagViolations(loadQuestWorld())).toEqual([]);
  });

  it('the clean fixture breaks none', () => {
    expect(flagViolations(loadFixture('clean'))).toEqual([]);
  });

  it('RED: a map setting another tranche\'s local flag, its region\'s other sub-letter, or another tranche\'s milestone', () => {
    expect(flagViolations(loadFixture('flags_red'))).toEqual([
      'elfx-hall: CANAL_OPEN (milestone of ERT-O, map of ELF-T)',
      'elfx-hall: CHEST_ERT_T_GOLD (not ELF_T_...)',
      'elfx-hall: ELF_D_BELL (not ELF_T_...)',
    ]);
  });

  it('the sub-prefix of each tranche id', () => {
    expect(tranchePrefix('ELF-T')).toBe('ELF_T_');
    expect(tranchePrefix('FIR-D1')).toBe('FIR_D1_');
    expect(tranchePrefix('PST')).toBe('PST_');
  });
});
