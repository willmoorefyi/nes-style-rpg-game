export type StatusEffect = 'poison' | 'stun' | 'sleep' | 'blind' | 'silence' | 'death';

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
    const skipTurn = this.has('stun') || this.has('sleep');
    
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

  onHit(): void {
    this.effects.delete('sleep');
  }
}
