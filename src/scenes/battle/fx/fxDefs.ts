/**
 * The effect table as the fx engine reads it (assets/data/spell-effects.yaml): F0's EffectDef plus the optional
 * look fields of §3.4, and the choice of an effect for an action. Pure (no PixiJS).
 */
import type { EffectDef, SpellEffectsData } from '../../../types/fxData.js';

export const ANCHORS = ['top', 'head', 'center', 'feet', 'front'] as const;

export interface FxEffect extends EffectDef {
  /** A second glyph: heat shimmer, the healing halo, a frost burst, feathers, sparkles. */
  accent?: string;
  accentRamp?: string;
  /** A glyph popped over a target where `status` landed (inflict_*). */
  mark?: string;
  markRamp?: string;
  status?: string;
  /** A word floated at the impact (DEF+). */
  label?: string;
  /** Screen tints per cast (3 frames each, at most 2). */
  flash?: number;
  /** Where a burst centres. */
  at?: typeof ANCHORS[number];
  /** 2: every other particle at x4. */
  scale?: 1 | 2;
  /** A burst's central glyph keeps this frame up after its sequence. */
  hold?: number;
}

export interface FxData {
  effects: Record<string, FxEffect>;
  spells: Record<string, string>;
  items: Record<string, string>;
  attacks: Record<string, string>;
  byEffect: Record<string, string>;
}

const STRINGS = ['accent', 'accentRamp', 'mark', 'markRamp', 'status', 'label'] as const;

/** The reason an effect's look fields are unusable, or null (F0's validator has checked kind, frames and impact). */
export function lookProblem(e: Record<string, unknown>): string | null {
  for (const k of STRINGS) if (e[k] !== undefined && typeof e[k] !== 'string') return `${k} must be a string`;
  if (e.flash !== undefined && (typeof e.flash !== 'number' || e.flash < 0 || e.flash > 2)) return 'flash must be 0-2';
  if (e.at !== undefined && !(ANCHORS as readonly unknown[]).includes(e.at)) return `unknown anchor ${String(e.at)}`;
  if (e.scale !== undefined && e.scale !== 1 && e.scale !== 2) return 'scale must be 1 or 2';
  if (e.hold !== undefined && (typeof e.hold !== 'number' || !Number.isInteger(e.hold) || e.hold < 0)) return 'hold must be a frame index';
  if (e.mark !== undefined && e.status === undefined) return 'a mark needs its status';
  return null;
}

/** The validated table with every effect's look fields checked (bad effects are logged and dropped, with the
 *  references to them). */
export function toFxData(raw: SpellEffectsData, path = 'spell-effects.yaml'): FxData {
  const effects: Record<string, FxEffect> = {};
  for (const [id, e] of Object.entries(raw.effects)) {
    const problem = lookProblem(e as unknown as Record<string, unknown>);
    if (problem) console.error(`${path} effects.${id}: ${problem}; dropped`);
    else effects[id] = e as FxEffect;
  }
  const keep = (table: Record<string, string> | undefined): Record<string, string> =>
    Object.fromEntries(Object.entries(table ?? {}).filter(([, ref]) => effects[ref]));
  return { effects, spells: keep(raw.spells), items: keep(raw.items), attacks: keep(raw.attacks), byEffect: keep(raw.byEffect) };
}

/** What picks an action's effect. */
export interface FxChoice {
  spellId?: string;
  itemId?: string;
  /** The spell's `effect` and `element` (spells.yaml), for spells without their own entry. */
  spell?: { effect: string; element?: string };
  /** A ranged enemy attack's `attackEffect`. */
  attackEffect?: string;
}

/** The effect id for an action: the spell's entry, else its `effect.element` / `effect` in byEffect; the item's
 *  entry; the ranged attack's entry; else null (no effect: melee, run, a fizzled spell). */
export function effectIdFor(data: FxData, c: FxChoice): string | null {
  if (c.spellId) {
    const own = data.spells[c.spellId];
    if (own) return own;
    if (c.spell) return data.byEffect[`${c.spell.effect}.${c.spell.element ?? 'none'}`] ?? data.byEffect[c.spell.effect] ?? null;
    return null;
  }
  if (c.itemId) return data.items[c.itemId] ?? null;
  if (c.attackEffect) return data.attacks[c.attackEffect] ?? null;
  return null;
}
