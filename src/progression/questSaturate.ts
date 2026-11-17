/**
 * The saturation closure (docs/QUEST_PLAN.md 5.2 (a), (b)): flags, items and vehicle positions only grow
 * (consumption is ignored), and the party may be at any place reached so far. It over-approximates play, so a grant
 * it can't reach is truly unreachable; proofs (a) and (b) run it with events disabled and grants withheld.
 */
import type { QuestStage, VehicleState } from '../types/index.js';
import type { QuestPlace, QuestState } from './questTypes.js';
import { globMatch } from './questData.js';
import { effectsOf, type QuestEffects, type QuestEventSpec } from './questEvents.js';
import { closeMarkers, needsHeld, relevantEffects, stageMark, vehicleKey } from './questStates.js';
import type { PlaceComponent, PlaceExit } from './questPlaces.js';
import type { QuestModel, SearchOptions } from './questSearch.js';

export interface FiredEvent {
  id: string;
  /** Position in the firing sequence. */
  index: number;
  at: QuestPlace;
}

/** The saturation closure (see the module comment). Proofs drive it with `run`, or step it (walk replay). */
export class Saturator {
  readonly flags: Set<string>;
  readonly items: Set<string>;
  readonly vehicles: VehicleState[];
  readonly roots: QuestPlace[];
  readonly fired: FiredEvent[] = [];
  /** Every event that could fire at some point (proof (b): a boss "reachable"). */
  readonly availableEver = new Set<string>();
  /** Component keys reached, and the maps they are on. */
  readonly reachedComps = new Set<string>();
  readonly reachedMaps = new Set<string>();
  /** Fired-sequence index at which a flag / item / stage marker first appeared (-1: at the start). */
  readonly first = new Map<string, number>();
  /** Index at which each stage's grants first all held. */
  readonly grantsAt = new Map<string, number>();
  private comps: Array<{ comp: PlaceComponent; place: QuestPlace }> = [];
  private rootKeys = new Set<string>();

  constructor(private readonly model: QuestModel, start: QuestState, private readonly opts: SearchOptions = {}) {
    this.flags = new Set(start.flags);
    this.items = new Set(start.items);
    this.vehicles = start.vehicles.map((v) => ({ ...v }));
    this.roots = [];
    this.addRoot(start.place);
    for (const f of this.flags) this.first.set(f, -1);
    for (const i of this.items) this.first.set(`item:${i}`, -1);
    this.noteStages();
  }

  /** A state view of the facts so far, the party at `place`. */
  view(place: QuestPlace): QuestState {
    return { flags: this.flags, items: this.items, vehicles: this.vehicles, gold: 0, place, fired: [] };
  }

  addRoot(p: QuestPlace): boolean {
    const k = `${p.map}:${p.x},${p.y}:${p.mode}`;
    if (this.rootKeys.has(k)) return false;
    this.rootKeys.add(k);
    this.roots.push({ ...p });
    return true;
  }

  private addVehicle(v: VehicleState): boolean {
    if (this.vehicles.some((x) => vehicleKey(x) === vehicleKey(v))) return false;
    this.vehicles.push({ ...v });
    return true;
  }

  /** Every component reachable from the roots; parked vehicles found on the way are added. */
  reach(): void {
    const { places } = this.model;
    for (let again = true; again;) {
      again = false;
      const seen = new Set<string>();
      this.comps = [];
      const queue = [...this.roots];
      for (let qi = 0; qi < queue.length; qi++) {
        const p = queue[qi];
        const comp = places.component(p, this.view(p));
        if (!comp || seen.has(comp.key)) continue;
        seen.add(comp.key);
        this.comps.push({ comp, place: p });
        this.reachedComps.add(comp.key);
        this.reachedMaps.add(comp.map);
        for (const ex of places.exitsOf(comp, this.view(p))) {
          if (ex.park && !this.opts.withhold?.vehicles.has(ex.park.type) && this.addVehicle(ex.park)) again = true;
          queue.push(ex.to);
        }
      }
      if (this.noteStages()) again = true;
    }
  }

  /** The exits of the reached components. */
  exits(): PlaceExit[] {
    return this.comps.flatMap(({ comp, place }) => this.model.places.exitsOf(comp, this.view(place)));
  }

  /** The events that can fire now, in catalog order, with the cell each fires from. */
  available(): Array<{ ev: QuestEventSpec; at: QuestPlace; eff: QuestEffects }> {
    const { world, cat, order } = this.model;
    const out: Array<{ ev: QuestEventSpec; at: QuestPlace; eff: QuestEffects }> = [];
    const consider = (ev: QuestEventSpec, at: QuestPlace): void => {
      if (this.opts.disabled?.has(ev.id)) return;
      const raw = effectsOf(world, ev, this.view(at));
      if (!raw) return;
      this.availableEver.add(ev.id);
      out.push({ ev, at, eff: relevantEffects(world, cat, raw, this.opts.withhold) });
    };
    const start = this.roots[0];
    for (const ev of cat.auto) consider(ev, start);
    const seen = new Set<string>();
    const local: Array<{ ev: QuestEventSpec; at: QuestPlace }> = [];
    for (const { comp } of this.comps) {
      for (const [id, cell] of comp.triggers) {
        if (seen.has(id)) continue;
        seen.add(id);
        local.push({ ev: cat.byId.get(id)!, at: { map: comp.map, x: cell.x, y: cell.y, mode: comp.mode } });
      }
    }
    local.sort((a, b) => (order.get(a.ev.id) ?? 0) - (order.get(b.ev.id) ?? 0));
    for (const { ev, at } of local) consider(ev, at);
    return out;
  }

  /** Whether the effects add a fact (saturation ignores takes). */
  adds(eff: QuestEffects): boolean {
    return eff.flags.some((f) => !this.flags.has(f)) || eff.items.some((i) => !this.items.has(i))
      || eff.vehicles.some((v) => !this.vehicles.some((x) => vehicleKey(x) === vehicleKey(v)))
      || (!!eff.warp && !this.rootKeys.has(`${eff.warp.map}:${eff.warp.x},${eff.warp.y}:${eff.warp.mode}`));
  }

  /** Fire an event's effects (monotone). */
  apply(id: string, eff: QuestEffects, at: QuestPlace): void {
    const index = this.fired.length;
    this.fired.push({ id, index, at });
    for (const f of eff.flags) if (!this.flags.has(f)) { this.flags.add(f); this.first.set(f, index); }
    for (const i of eff.items) if (!this.items.has(i)) { this.items.add(i); this.first.set(`item:${i}`, index); }
    for (const v of eff.vehicles) {
      if (v.map !== '') {
        const abstract = this.vehicles.findIndex((x) => x.type === v.type && x.map === '');
        if (abstract >= 0) this.vehicles.splice(abstract, 1);
      }
      if (this.addVehicle(v) && !this.first.has(`vehicle:${v.type}`)) this.first.set(`vehicle:${v.type}`, index);
    }
    if (eff.warp) this.addRoot(eff.warp);
    this.noteStages();
  }

  /** Close the built stages' markers and note when each stage's grants first all hold. */
  private noteStages(): boolean {
    const { world } = this.model;
    const index = this.fired.length - 1;
    const view = this.view(this.roots[0]);
    const added = closeMarkers(world, view, this.flags,
      (g) => [...this.reachedMaps].some((m) => globMatch(m, g)));
    for (const m of added) this.first.set(m, index);
    for (const s of world.quest.stages) {
      if (this.grantsAt.has(s.id)) continue;
      const g = s.grants;
      if (g.flags.length + g.items.length + g.vehicles.length === 0) {
        if (this.flags.has(stageMark(s.id))) this.grantsAt.set(s.id, this.first.get(stageMark(s.id)) ?? index);
      } else if (needsHeld(view, g)) this.grantsAt.set(s.id, index);
    }
    return added.length > 0;
  }

  /** Fire one event that adds something (auto events first, then catalog order). False at the fixpoint. */
  step(): boolean {
    this.reach();
    for (const { ev, at, eff } of this.available()) {
      if (!this.adds(eff)) continue;
      this.apply(ev.id, eff, at);
      return true;
    }
    return false;
  }

  /** Run to the fixpoint, or until `stop` holds. */
  run(stop?: (s: Saturator) => boolean, maxEvents = 20000): this {
    for (let i = 0; i < maxEvents; i++) {
      if (stop?.(this)) return this;
      if (!this.step()) return this;
    }
    throw new Error('saturation did not converge');
  }

  stageDone(id: string): boolean {
    return this.flags.has(stageMark(id));
  }

  hasGoal(): boolean {
    return this.flags.has(this.model.world.quest.goal);
  }

  /** The fired event ids, without the synthetic stage grants (a witness path). */
  path(): string[] {
    return this.fired.map((f) => f.id);
  }
}

export function saturate(model: QuestModel, start: QuestState, opts: SearchOptions = {},
  stop?: (s: Saturator) => boolean): Saturator {
  return new Saturator(model, start, opts).run(stop);
}

/** The event ids whose static grants give any of `n` (and a pending stage's own grant). */
export function eventsGranting(model: QuestModel, n: { flags?: string[]; items?: string[]; vehicles?: string[] }): Set<string> {
  const f = new Set(n.flags ?? []);
  const i = new Set(n.items ?? []);
  const v = new Set(n.vehicles ?? []);
  const out = new Set<string>();
  for (const ev of model.cat.events) {
    if (ev.grants.flags.some((x) => f.has(x)) || ev.grants.items.some((x) => i.has(x))
      || ev.grants.vehicles.some((x) => v.has(x))) out.add(ev.id);
  }
  return out;
}

/** The battle events that fight one of the stage's bosses. */
export function bossEvents(model: QuestModel, stage: QuestStage): QuestEventSpec[] {
  const boss = new Set(stage.boss);
  return model.cat.events.filter((e) => e.boss.some((b) => boss.has(b)));
}
