import { describe, it, expect, beforeEach } from 'vitest';
import { KeyItemGateSystem } from '../../src/systems/KeyItemGateSystem.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import type { KeyItemGate } from '../../src/types/index.js';

describe('KeyItemGateSystem', () => {
  let inventory: Inventory;
  let flags: GameFlags;
  let system: KeyItemGateSystem;

  beforeEach(() => {
    inventory = new Inventory();
    flags = new GameFlags();
    system = new KeyItemGateSystem(inventory, flags);
  });

  it('returns not blocked when no gates are set', () => {
    const result = system.check(5, 5);
    expect(result.blocked).toBe(false);
  });

  it('returns not blocked for positions without a gate', () => {
    system.setGates([{
      x: 3, y: 3, requiredItem: 'mystic_key',
      message: 'Locked!', permanent: false,
    }]);
    const result = system.check(5, 5);
    expect(result.blocked).toBe(false);
  });

  it('blocks when player lacks the required item', () => {
    system.setGates([{
      x: 3, y: 3, requiredItem: 'mystic_key',
      message: 'You need the Mystic Key!', permanent: false,
    }]);
    const result = system.check(3, 3);
    expect(result.blocked).toBe(true);
    expect(result.message).toBe('You need the Mystic Key!');
  });

  it('allows passage when player has the required item', () => {
    system.setGates([{
      x: 3, y: 3, requiredItem: 'mystic_key',
      message: 'Locked!', permanent: false,
    }]);
    inventory.add('mystic_key');
    const result = system.check(3, 3);
    expect(result.blocked).toBe(false);
  });

  it('sets flag for permanent gates when opened', () => {
    system.setGates([{
      x: 3, y: 3, requiredItem: 'mystic_key',
      flag: 'MYSTIC_GATE_OPEN', message: 'Locked!', permanent: true,
    }]);
    inventory.add('mystic_key');
    system.check(3, 3);
    expect(flags.has('MYSTIC_GATE_OPEN')).toBe(true);
  });

  it('permanent gate stays open after flag is set', () => {
    const gate: KeyItemGate = {
      x: 3, y: 3, requiredItem: 'mystic_key',
      flag: 'MYSTIC_GATE_OPEN', message: 'Locked!', permanent: true,
    };
    system.setGates([gate]);

    // Open the gate
    inventory.add('mystic_key');
    system.check(3, 3);

    // Remove the item — gate should still be open because flag is set
    inventory.remove('mystic_key');
    const result = system.check(3, 3);
    expect(result.blocked).toBe(false);
  });

  it('non-permanent gate blocks again without item', () => {
    system.setGates([{
      x: 3, y: 3, requiredItem: 'mystic_key',
      message: 'Locked!', permanent: false,
    }]);

    // First pass with item
    inventory.add('mystic_key');
    expect(system.check(3, 3).blocked).toBe(false);

    // Remove item — should block again
    inventory.remove('mystic_key');
    expect(system.check(3, 3).blocked).toBe(true);
  });
});
