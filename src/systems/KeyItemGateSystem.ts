import { resolveNPCDialog, type KeyItemGate } from '../types/index.js';
import type { Inventory } from '../entities/Inventory.js';
import type { GameFlags } from '../core/GameFlags.js';

export interface GateCheckResult {
  blocked: boolean;
  message?: string;
}

/**
 * The gate's message as one line. Conditional entries (R0, T1) show their default entry here; resolving them on
 * the story flags is R1's (docs/FIX_PLAN_PENINSULA.md, R1 T1).
 */
function gateText(gate: KeyItemGate): string {
  return typeof gate.message === 'string' ? gate.message : resolveNPCDialog(gate.message, () => false).join(' ');
}

/**
 * Checks key item gates on the map to determine if the player can pass.
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

  /** Check if movement to (x, y) is blocked by a key item gate */
  check(x: number, y: number): GateCheckResult {
    const gate = this.gates.find(g => g.x === x && g.y === y);
    if (!gate) return { blocked: false };

    // Permanent gate already opened
    if (gate.permanent && gate.flag && this.flags.has(gate.flag)) {
      return { blocked: false };
    }

    // Story-flag gate (e.g. a bridge that opens once BRIDGE_BUILT is set)
    if (gate.requiredFlag && !this.flags.has(gate.requiredFlag)) {
      return { blocked: true, message: gateText(gate) };
    }
    // Check if player has the required item
    if (gate.requiredItem && !this.inventory.has(gate.requiredItem)) {
      return { blocked: true, message: gateText(gate) };
    }

    // Player has the item — open the gate
    if (gate.permanent && gate.flag) {
      this.flags.set(gate.flag);
    }
    return { blocked: false };
  }
}
