/**
 * The `fighter` policy (FX-B, docs/BALANCE_REPORT_FXB.md): what a competent player does with the upgraded party from S24
 * on. The `sensible` policy only knows CURE / LIT / FIRE, so it makes the Knight and the Ninja cast FIRE (a few points of
 * damage) instead of swinging a Diamond / Vorpal blade, and the Black Wizard cast LIT instead of LIT2 / FIR2 / ICE2;
 * Fight-only play (`careless`) beat it by 30-40 points on every upgraded-party boss. `fighter`:
 * - Knight, Ninja, Warrior, Thief, Monk: Fight the weakest enemy;
 * - a caster with a healing spell heals the most hurt member below 50 % with the highest-level cure it has charges for;
 * - a caster with a damage spell casts the strongest one it has charges for (all-enemy spells count 1.5 x) at the
 *   biggest enemy;
 * - otherwise a potion below 35 % HP when no one can cure, else Fight the weakest enemy.
 */
import type { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import type { BattleCommand } from '../../src/battle/BattleCommands.js';
import type { SpellData } from '../../src/types/index.js';

const MARTIAL = new Set(['warrior', 'thief', 'monk', 'knight', 'ninja']);

export function fighterCommands(bsm: BattleStateMachine, potions: { n: number }, spells: SpellData[]): void {
  const byId = new Map(spells.map((s) => [s.id, s]));
  const party = bsm.allParty;
  const living = bsm.livingEnemies;
  const focus = [...living].sort((a, b) => a.currentHp - b.currentHp)[0];
  const biggest = [...living].sort((a, b) => b.currentHp - a.currentHp)[0];
  while (bsm.state === 'command_select') {
    const actor = bsm.currentCommandActor;
    const id = bsm.currentCommandActorId;
    if (!actor || !id) return;
    let cmd: BattleCommand = { type: 'fight', actorId: id, targetId: focus.id };
    const hurt = party.filter((c) => c.currentHp > 0).sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
    const hurtId = bsm.getPartyId(party.indexOf(hurt));
    const ready = actor.getLearnedSpells()
      .map((l) => ({ spell: byId.get(l.spellId), level: l.level }))
      .filter((x): x is { spell: SpellData; level: number } => !!x.spell && actor.hasCharges(x.level));
    const cures = ready.filter((x) => x.spell.effect === 'heal' || x.spell.effect === 'heal_full')
      .sort((a, b) => b.spell.level - a.spell.level);
    const weight = (s: SpellData): number => (s.power ?? 0) * (s.targeting === 'all' ? 1.5 : 1);
    const attacks = ready.filter((x) => x.spell.effect === 'damage').sort((a, b) => weight(b.spell) - weight(a.spell));
    const martial = MARTIAL.has(actor.classData.id);
    const noCure = !party.some((c) => c.currentHp > 0 && c.getLearnedSpells().some((l) => {
      const s = byId.get(l.spellId);
      return !!s && (s.effect === 'heal' || s.effect === 'heal_full') && c.hasCharges(l.level);
    }));
    if (!martial && cures.length && hurt.currentHp < hurt.maxHp * 0.5) {
      cmd = { type: 'magic', actorId: id, targetId: hurtId, spellId: cures[0].spell.id };
    } else if (!martial && attacks.length) {
      const s = attacks[0].spell;
      cmd = { type: 'magic', actorId: id, spellId: s.id, ...(s.targeting === 'all' ? {} : { targetId: biggest.id }) };
    } else if (potions.n > 0 && noCure && hurt.currentHp < hurt.maxHp * 0.35) {
      potions.n--;
      cmd = { type: 'item', actorId: id, targetId: hurtId, itemId: 'potion' };
    }
    bsm.submitCommand(cmd);
  }
}
