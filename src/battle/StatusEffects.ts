export type StatusEffect = 'poison' | 'stun' | 'sleep' | 'blind' | 'silence' | 'death';

export class StatusTracker {
  private effects = new Set<StatusEffect>();

  apply(effect: StatusEffect): void {
    this.effects.add(effect);
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

  tick(maxHp: number): { damage: number; skipTurn: boolean } {
    const damage = this.has('poison') ? Math.floor(maxHp * 0.05) : 0;
    const skipTurn = this.has('stun') || this.has('sleep');
    return { damage, skipTurn };
  }

  onHit(): void {
    this.effects.delete('sleep');
  }
}
