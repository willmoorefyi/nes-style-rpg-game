export interface AITarget {
  id: string;
  isAlive: boolean;
}

/** FF1 enemy targeting: slot weights 4/2/1/1 (50 / 25 / 12.5 / 12.5 %), over the living, in party order. */
export const FRONT_WEIGHTS: readonly number[] = [4, 2, 1, 1];

/** Weighted pick over the living targets; each keeps the weight of its slot (`weights[i]`, 1 past the end). */
export function selectTarget(
  targets: AITarget[],
  rng: () => number = Math.random,
  weights: readonly number[] = FRONT_WEIGHTS,
): AITarget | null {
  const living = targets
    .map((t, i) => ({ t, w: t.isAlive ? weights[i] ?? 1 : 0 }))
    .filter((x) => x.w > 0);
  if (living.length === 0) return null;
  const total = living.reduce((s, x) => s + x.w, 0);
  let r = rng() * total;
  for (const x of living) {
    r -= x.w;
    if (r < 0) return x.t;
  }
  return living[living.length - 1].t;
}

/**
 * A new party target for an enemy whose target died: weighted by the original party slots (`slots` in
 * party order), so the front slots stay favoured. Party retargeting stays uniform (`retargetIfDead`).
 */
export function retargetEnemyTarget(
  slots: readonly string[],
  isAlive: (id: string) => boolean,
  rng: () => number = Math.random,
): string | undefined {
  return selectTarget(slots.map((id) => ({ id, isAlive: isAlive(id) })), rng)?.id;
}
