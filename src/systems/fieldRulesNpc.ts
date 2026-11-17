/**
 * The NPC half of the field rules (docs/QUEST_PLAN.md 4.2, docs/WORLD_PLAN.md 1.5; W1-B): dialog conditions on flags
 * and items, chests, gifts, trades (`requiredItem`, `takeItem`, `takeGold`, GAP-3 / GAP-15), the cutscene and the
 * fight talking starts, and the post-dialog action. `fieldRules.ts` re-exports everything here, so the game and the
 * progression verifier keep importing one module. Pure TypeScript: no PixiJS, no game objects.
 */
import { npcPresent, resolveNPCDialog } from '../types/index.js';
import type { MapNPC, ScriptedEncounter } from '../types/index.js';
import type { FieldState } from './fieldRules.js';

/** Every flag a `requiredFlag` / `requiredFlags` pair names is set. */
export function flagsMet(o: { requiredFlag?: string; requiredFlags?: string[] }, flags: ReadonlySet<string>): boolean {
  if (o.requiredFlag && !flags.has(o.requiredFlag)) return false;
  return (o.requiredFlags ?? []).every((f) => flags.has(f));
}

/** A dialog condition: `item:<id>` holds while the item is held, anything else is a story flag. */
export function conditionMet(condition: string, state: Pick<FieldState, 'flags' | 'items'>): boolean {
  return condition.startsWith('item:') ? state.items.has(condition.slice(5)) : state.flags.has(condition);
}

/** The first scripted encounter matching `where` that is still due: its flag unset (one-time), its flags met. */
export function dueEncounterWhere(encounters: readonly ScriptedEncounter[], where: (e: ScriptedEncounter) => boolean,
  state: FieldState): ScriptedEncounter | null {
  return encounters.find((e) => where(e) && !state.flags.has(e.flag) && flagsMet(e, state.flags)) ?? null;
}

/** What a trade takes from the party: `requiredItem` when `takeItem` is set, and `takeGold` gold (GAP-15). */
export interface NpcTake {
  item?: string;
  gold?: number;
}

export interface NpcOutcome {
  present: boolean;
  dialog: string[];
  /** What the trade takes, set only together with the trade's gift or flag. */
  take?: NpcTake;
  give?: string;
  setFlags: string[];
  cutscene?: string;
  /** The `flag` of the scripted encounter talking starts (`ScriptedEncounter.npc`, B1). */
  battle?: string;
  action?: string;
}

/** The cutscene an NPC plays after talking, if its flags allow it now (its `onceFlag` unset). */
export function npcCutsceneFor(npc: Pick<MapNPC, 'cutscene'>, flags: ReadonlySet<string>): string | undefined {
  const c = npc.cutscene;
  if (!c || !flagsMet(c, flags) || flags.has(c.onceFlag)) return undefined;
  return c.id;
}

/**
 * Whether the NPC's trade terms hold: its `requiredItem` is held and the party has `takeGold` gold. A state without
 * `gold` (the verifier, which counts gold itself) passes the gold term.
 */
export function tradeTermsMet(npc: Pick<MapNPC, 'requiredItem' | 'takeGold'>, state: FieldState): boolean {
  if (npc.requiredItem && !state.items.has(npc.requiredItem)) return false;
  return npc.takeGold === undefined || state.gold === undefined || state.gold >= npc.takeGold;
}

/** The take of a trade NPC, or undefined when it takes nothing. */
function takeOf(npc: MapNPC): NpcTake | undefined {
  const take: NpcTake = {};
  if (npc.takeItem && npc.requiredItem) take.item = npc.requiredItem;
  if (npc.takeGold !== undefined && npc.takeGold > 0) take.gold = npc.takeGold;
  return take.item !== undefined || take.gold !== undefined ? take : undefined;
}

/**
 * What talking to an NPC yields now. A chest gives its item once; a gift is given once with the dialog (an NPC
 * without dialog gives none). A trade NPC (`requiredItem`, `takeGold`) gives its gift and sets its flag only while
 * its terms hold, and then takes what `take` says; its cutscene needs only the required item. Dialog conditions may name items
 * (`item:<id>`). The game adds the bag limit (a full bag keeps the chest closed and the gift for later).
 */
export function npcOutcome(npc: MapNPC, state: FieldState, encounters: readonly ScriptedEncounter[]): NpcOutcome {
  const has = (f: string): boolean => state.flags.has(f);
  if (!npcPresent(npc, has)) return { present: false, dialog: [], setFlags: [] };
  const dialog = [...resolveNPCDialog(npc.dialog, (c) => conditionMet(c, state))];
  if (npc.chestItem && npc.chestFlag) {
    if (has(npc.chestFlag)) return { present: true, dialog: ['Already opened.'], setFlags: [] };
    return { present: true, dialog, give: npc.chestItem, setFlags: [npc.chestFlag] };
  }
  const out: NpcOutcome = { present: true, dialog, setFlags: [] };
  const terms = tradeTermsMet(npc, state);
  if (npc.dialog.length > 0 && npc.giftFlag && !has(npc.giftFlag) && terms && (npc.giftItem || takeOf(npc))) {
    if (npc.giftItem) out.give = npc.giftItem;
    out.setFlags.push(npc.giftFlag);
    const take = takeOf(npc);
    if (take) out.take = take;
  }
  // a cutscene behind a required item (the Mirage console and the cube) plays only while the item is held
  if (!npc.requiredItem || state.items.has(npc.requiredItem)) out.cutscene = npcCutsceneFor(npc, state.flags);
  out.battle = dueEncounterWhere(encounters, (e) => e.npc === npc.id, state)?.flag;
  out.action = npc.action;
  return out;
}
