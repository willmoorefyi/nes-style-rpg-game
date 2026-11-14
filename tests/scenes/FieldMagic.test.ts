import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { SpellRegistry } from '../../src/data/SpellRegistry.js';
import { healAmount } from '../../src/battle/DamageFormula.js';
import { SpellExecutor } from '../../src/battle/SpellExecutor.js';
import { castFieldSpell } from '../../src/systems/FieldSpellEffects.js';
import { ItemEffects } from '../../src/systems/ItemEffects.js';
import { FieldMagicScene } from '../../src/scenes/FieldMagicScene.js';
import type { Game } from '../../src/core/Game.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';
import { targetLabel } from '../../src/ui/partyTargetLabel.js';

beforeAll(loadRealRegistries);

let mage: Character;
let fighter: Character;
let thief: Character;

beforeEach(() => {
  mage = new Character({ name: 'W.MAG', classData: ClassRegistry.getClass('white_mage')!, level: 5 });
  mage.learnSpell('cure', 1);
  mage.learnSpell('heal', 3);
  fighter = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! });
  thief = new Character({ name: 'THIEF', classData: ClassRegistry.getClass('thief')! });
});

function openScene(party: Character[]) {
  const input = tapInput();
  const game = { input, party: { all: party, get: (i: number) => party[i] }, scenes: { pop: vi.fn() } };
  const scene = new FieldMagicScene(game as unknown as Game);
  scene.enter();
  const tap = (...actions: Array<'up' | 'down' | 'confirm' | 'cancel'>) => {
    for (const a of actions) input.tap(a, () => scene.update(1));
  };
  return { scene, tap };
}

describe('MS-3: field magic', () => {
  it('field CURE heals what battle CURE heals (one shared formula)', () => {
    const cure = SpellRegistry.getSpell('cure')!;
    fighter.currentHp = 1;
    const result = castFieldSpell(cure, mage, [fighter], () => 0.5);
    const expected = Math.min(fighter.maxHp - 1, healAmount(cure, () => 0.5));
    expect(fighter.currentHp).toBe(1 + expected);
    expect(result.messages).toEqual([`FGHTR recovers ${expected} HP`]);

    // and battle CURE, same caster and rng, heals the same amount
    const target = new Character({ name: 'T', classData: ClassRegistry.getClass('warrior')!, level: 30 });
    target.currentHp = 1;
    const party = [mage, target];
    const exec = new SpellExecutor({
      party, enemies: [], rng: () => 0.5, addMessage: vi.fn(), livingParty: () => party, livingEnemies: () => [],
      partyById: new Map([['party_0', mage], ['party_1', target]]), addDamageEvent: vi.fn(),
    }, [cure]);
    exec.execute({ type: 'magic', actorId: 'party_0', spellId: 'cure', targetId: 'party_1' }, false);
    expect(target.currentHp - 1).toBe(healAmount(cure, () => 0.5));
  });

  it('CURE (power 16) heals 16–32 in the field and in battle, whatever the caster’s INT (FF1)', () => {
    const cure16 = { ...SpellRegistry.getSpell('cure')!, power: 16 };
    const big = () => {
      const t = new Character({ name: 'BIG', classData: ClassRegistry.getClass('warrior')!, level: 30 });
      t.currentHp = 1;
      return t;
    };
    for (const [roll, want] of [[0, 16], [0.999, 32]] as const) {
      const field = big();
      castFieldSpell(cure16, mage, [field], () => roll);
      expect(field.currentHp - 1).toBe(want);

      const target = big();
      const party = [mage, target];
      mage.setSpellCharges(1, 9);
      const exec = new SpellExecutor({
        party, enemies: [], rng: () => roll, addMessage: vi.fn(), livingParty: () => party, livingEnemies: () => [],
        partyById: new Map([['party_0', mage], ['party_1', target]]), addDamageEvent: vi.fn(),
      }, [cure16]);
      exec.execute({ type: 'magic', actorId: 'party_0', spellId: 'cure', targetId: 'party_1' }, false);
      expect(target.currentHp - 1).toBe(want);
    }
  });

  it('CURE does not revive the fallen', () => {
    fighter.currentHp = 0;
    const result = castFieldSpell(SpellRegistry.getSpell('cure')!, mage, [fighter]);
    expect(fighter.currentHp).toBe(0);
    expect(result).toEqual({ used: false, messages: ['No effect.'] });
  });

  it('CURE on a full-HP target says "No effect." and uses no charge', () => {
    const { scene, tap } = openScene([mage, fighter]);
    const before = mage.getSpellCharges(1);
    tap('confirm', 'confirm', 'down', 'confirm'); // caster, CURE, target FGHTR
    expect(scene.message).toBe('No effect.');
    expect(mage.getSpellCharges(1)).toBe(before);
  });

  it('CURE on a hurt target reports the heal, spends one charge and refreshes the target label', () => {
    fighter.currentHp = 5;
    const { scene, tap } = openScene([mage, fighter]);
    const before = mage.getSpellCharges(1);
    tap('confirm', 'confirm', 'confirm'); // caster, CURE, target FGHTR (the cursor starts on the most hurt, U8)
    expect(scene.message).toMatch(/^FGHTR recovers \d+ HP$/);
    expect(mage.getSpellCharges(1)).toBe(before - 1);
    expect(visibleLabels(scene.container)).toContain(targetLabel(fighter, 5));
  });

  it('an all_allies heal (HEAL) heals every living member, not one, and skips the fallen', () => {
    fighter.currentHp = 5;
    thief.currentHp = 0;
    mage.currentHp = mage.maxHp - 3;
    const { scene, tap } = openScene([mage, fighter, thief]);
    tap('confirm', 'down', 'confirm'); // caster, HEAL (no target pick)
    expect(fighter.currentHp).toBeGreaterThan(5);
    expect(mage.currentHp).toBe(mage.maxHp);
    expect(thief.currentHp).toBe(0);
    expect(scene.message.split('\n')).toHaveLength(2);
  });

  it('a fallen member cannot cast', () => {
    mage.currentHp = 0;
    fighter.currentHp = 5;
    const charges = mage.getSpellCharges(1);
    const { scene, tap } = openScene([mage, fighter]);
    tap('confirm', 'confirm', 'down', 'confirm');
    expect(fighter.currentHp).toBe(5);
    expect(mage.getSpellCharges(1)).toBe(charges);
    expect(visibleLabels(scene.container)).not.toContain('CURE (' + charges + ')');
  });

  it('a member with no field spells is told so', () => {
    const { scene, tap } = openScene([fighter, mage]);
    tap('confirm');
    expect(scene.message).toBe('FGHTR has no field spells.');
    expect(visibleLabels(scene.container)).toContain('FGHTR has no field spells.');
  });
});

describe('MS-3: Tent and Cabin skip the fallen', () => {
  it.each(['tent', 'cabin'])('%s restores the living but leaves a fallen member at 0 HP with no charges', (id) => {
    const inv = new Inventory();
    inv.add(id);
    mage.currentHp = 0;
    mage.useCharge(1);
    fighter.currentHp = 1;
    const result = ItemEffects.applyPartyItemEffect(id, [mage, fighter], inv);
    expect(result.success).toBe(true);
    expect(mage.currentHp).toBe(0);
    expect(mage.getSpellCharges(1)).toBe(mage.getMaxCharges(1) - 1);
    expect(fighter.currentHp).toBeGreaterThan(1);
  });
});

describe('MS-7: field magic shows the spell description in the help bar', () => {
  it('hidden while choosing a caster; the highlighted spell\'s description while choosing a spell', () => {
    const { scene, tap } = openScene([mage, fighter]);
    expect(scene.helpText).toBe('');
    tap('confirm'); // W.MAG: CURE, HEAL
    expect(scene.helpText).toBe(SpellRegistry.getSpell('cure')!.description);
    tap('down');
    expect(scene.helpText).toBe(SpellRegistry.getSpell('heal')!.description);
    tap('cancel');
    expect(scene.helpText).toBe('');
  });
});

describe('U8: the field spell target cursor starts on who needs the spell', () => {
  it('CURE starts on the most hurt member (index 1 of full / 8 / full / KO)', () => {
    const bmag = new Character({ name: 'B.MAG', classData: ClassRegistry.getClass('black_mage')! });
    thief.currentHp = 8;
    bmag.currentHp = 0;
    const { scene, tap } = openScene([fighter, thief, mage, bmag]);
    tap('down', 'down'); // W.MAG
    tap('confirm');      // her spells
    tap('confirm');      // CURE
    expect(scene.targetIndex).toBe(1);
  });
});

describe('the field magic target list marks the fallen as the Items target list does', () => {
  it('rows are `NAME  HP cur/max  STATUS`, with KO on the fallen', () => {
    thief.currentHp = 0;
    fighter.currentHp = 5;
    const { scene, tap } = openScene([mage, fighter, thief]);
    tap('confirm', 'confirm'); // caster, CURE
    const labels = visibleLabels(scene.container);
    const hp = (c: Character) => `HP ${String(c.currentHp).padStart(3)}/${String(c.maxHp).padStart(3)}`;
    expect(labels).toContain(`THIEF  ${hp(thief)}  KO`);
    expect(labels).toContain(`FGHTR  ${hp(fighter)}`);
  });
});
