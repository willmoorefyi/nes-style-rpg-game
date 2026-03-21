export interface Attacker {
  attack: number;
  level: number;
  hitPercent?: number;
}

export interface Defender {
  defense: number;
  evadePercent?: number;
}

export interface DamageResult {
  damage: number;
  hit: boolean;
  critical: boolean;
}

export function calculateDamage(
  attacker: Attacker,
  defender: Defender,
  rng: () => number = Math.random
): DamageResult {
  const hitChance = (attacker.hitPercent ?? 80) - (defender.evadePercent ?? 0);
  const hit = rng() * 100 < hitChance;
  if (!hit) return { damage: 0, hit: false, critical: false };

  const critical = rng() < 1 / 32;
  const variance = Math.floor(rng() * attacker.level) + 1;
  let damage = attacker.attack - defender.defense + variance;
  if (critical) damage *= 2;
  damage = Math.max(1, damage);

  return { damage, hit: true, critical };
}
