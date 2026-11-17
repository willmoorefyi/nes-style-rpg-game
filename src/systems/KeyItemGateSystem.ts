import type { KeyItemGate } from '../types/index.js';
import type { Inventory } from '../entities/Inventory.js';
import type { GameFlags } from '../core/GameFlags.js';
import { gateCheck } from './fieldRules.js';

export interface GateCheckResult {
  blocked: boolean;
  message?: string;
}

/**
 * Checks key item gates on the map to determine if the player can pass. The rule itself is fieldRules.gateCheck
 * (shared with the field step and the verifier); this applies it to the live inventory and flags.
 */
export class KeyItemGateSystem {
  private gates: KeyItemGate[] = [];
  private inventory: Inventory;
  private flags: GameFlags;

  constructor(inventory: Inventory, flags: GameFlags) {
    this.inventory = inventory;
    this.flags = flags;
  }

  setGates(gates: KeyItemGate[]): void {
    this.gates = gates;
  }

  /** Check if movement to (x, y) is blocked by a key item gate; passing a permanent gate sets its flag. */
  check(x: number, y: number): GateCheckResult {
    const gate = this.gates.find(g => g.x === x && g.y === y);
    if (!gate) return { blocked: false };
    const state = {
      flags: new Set(Object.keys(this.flags.getAll())),
      items: new Set(this.inventory.getAll().map((i) => i.itemId)),
      mode: 'walking' as const,
      vehicles: [],
    };
    const result = gateCheck(gate, state);
    if (!result.open) return { blocked: true, message: result.message };
    for (const f of result.setFlags) this.flags.set(f);
    return { blocked: false };
  }
}
