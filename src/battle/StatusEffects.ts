export type StatusEffect = 'poison' | 'stun' | 'sleep' | 'blind' | 'silence' | 'death' | 'stone' | 'fear';

export class StatusTracker {
  private effects = new Map<StatusEffect, number>();

  apply(effect: StatusEffect, duration: number = Infinity): void {
    this.effects.set(effect, duration);
  }

  remove(effect: StatusEffect): void {
    this.effects.delete(effect);
  }

  has(effect: StatusEffect): boolean {
    return this.effects.has(effect);
  }

  /** Asleep or paralysed (stun): loses its turn, and physical attacks get +40 to hit. */
  isHelpless(): boolean {
    return this.has('sleep') || this.has('stun');
  }

  clear(): void {
    this.effects.clear();
  }

  getAll(): Array<{ effect: StatusEffect; remainingTurns: number }> {
    return Array.from(this.effects.entries()).map(([effect, remainingTurns]) => ({
      effect,
      remainingTurns,
    }));
  }

  tick(maxHp: number): { damage: number; skipTurn: boolean; expired: StatusEffect[] } {
    const damage = this.has('poison') ? Math.floor(maxHp * 0.05) : 0;
    const skipTurn = this.has('stun') || this.has('sleep') || this.has('stone');
    
    const expired: StatusEffect[] = [];
    for (const [effect, turns] of this.effects) {
      if (turns === Infinity) continue;
      const newTurns = turns - 1;
      if (newTurns <= 0) {
        expired.push(effect);
        this.effects.delete(effect);
      } else {
        this.effects.set(effect, newTurns);
      }
    }
    
    return { damage, skipTurn, expired };
  }

  /**
   * Not called by the battle: as in FF1, damage does not wake a sleeper. Sleepers wake by the HP roll in
   * `rollWake` (StatusTick) after losing a turn. Kept for callers that want the wake-on-hit rule.
   */
  onHit(): void {
    this.effects.delete('sleep');
  }

  toJSON(): Array<{ effect: string; duration: number }> {
    return Array.from(this.effects.entries()).map(([effect, duration]) => ({ effect, duration }));
  }

  static fromJSON(data: Array<{ effect: string; duration: number }>): StatusTracker {
    const tracker = new StatusTracker();
    for (const { effect, duration } of data) {
      tracker.apply(effect as StatusEffect, duration);
    }
    return tracker;
  }
}
