/**
 * WR (docs/WORLD_WRAP_PLAN.md 10): the dev-only field probe for the browser checks. Each field frame it sets
 * `window.__field = { cell, mode, zone }`: the hero's canonical cell, the field mode and the encounter zone there.
 */
export interface FieldProbe {
  cell: { x: number; y: number };
  mode: string;
  zone: string | null;
}

export function publishFieldProbe(read: () => FieldProbe | null): void {
  if (!import.meta.env?.DEV || typeof window === 'undefined') return;
  const probe = read();
  if (probe) (window as unknown as { __field?: FieldProbe }).__field = probe;
}
