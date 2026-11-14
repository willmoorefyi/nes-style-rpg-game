// Scratch model of the T4 proposal. Patches the REAL BattleStateMachine / SpellExecutor prototypes with the
// proposed FF1 formulas (TS privacy is compile-time only), so turn order, queueing, statuses and finish() are real.
import { readFileSync } from 'fs';
import { parse } from '/Users/wlmmoor/personal/ff-game/node_modules/yaml/dist/index.js';
import { BattleStateMachine } from '/Users/wlmmoor/personal/ff-game/src/battle/BattleStateMachine.ts';
import { SpellExecutor } from '/Users/wlmmoor/personal/ff-game/src/battle/SpellExecutor.ts';
import { Character } from '/Users/wlmmoor/personal/ff-game/src/entities/Character.ts';
import type { EnemyData, ItemData, SpellData, CharacterClassData } from '/Users/wlmmoor/personal/ff-game/src/types/index.ts';

const R = '/Users/wlmmoor/personal/ff-game/assets/data/';
export const CLASSES: CharacterClassData[] = parse(readFileSync(R + 'classes.yaml', 'utf8'));
const ITEMS0: ItemData[] = parse(readFileSync(R + 'items.yaml', 'utf8'));
const SPELLS0: SpellData[] = parse(readFileSync(R + 'spells.yaml', 'utf8'));
export const OLD_ENEMIES: EnemyData[] = parse(readFileSync(R + 'enemies.yaml', 'utf8'));
export const OLD_SPELLS = SPELLS0;
export const OLD_ITEMS = ITEMS0;

export function mulberry32(a: number) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ── proposed data ──
type Ext = { hit?: number; crit?: number; weight?: number };
const ITEM_PATCH: Record<string, Partial<ItemData> & Ext & { stats?: any }> = {
  small_knife: { hit: 10, crit: 2 }, wooden_nunchaku: { hit: 0, crit: 1 }, staff: { hit: 0, crit: 3 },
  rapier: { hit: 5, crit: 4 }, hammer: { hit: 0, crit: 5 },
  cloth: { weight: 2 }, robe: { weight: 2 }, leather_armor: { weight: 8, usableBy: ['warrior', 'thief', 'monk', 'red_mage'] },
  chain_mail: { weight: 15 }, wooden_shield: { weight: 0 }, cap: { weight: 1 },
};
export const ITEMS: Record<string, ItemData & Ext> = Object.fromEntries(ITEMS0.map((i) => [i.id, { ...i, ...(ITEM_PATCH[i.id] ?? {}) }]));

const SPELL_PATCH: Record<string, any> = {
  fire: { power: 10, accuracy: 24 }, lit: { power: 10, accuracy: 24 }, harm: { power: 20, accuracy: 24 },
  cure: { power: 16 }, slep: { accuracy: 24 }, lock: { accuracy: 64, power: 20 }, ruse: { power: 80 }, fog: { power: 8 },
};
export const SPELLS: SpellData[] = SPELLS0.map((s) => ({ ...s, ...(SPELL_PATCH[s.id] ?? {}) }));

type EExt = EnemyData & { accuracy: number; evade: number; hits?: number; crit?: number };
function en(id: string, name: string, sprite: string, hp: number, atk: number, acc: number, def: number, eva: number, mdef: number, agi: number, xp: number, gold: number, extra: Partial<EExt> = {}): EExt {
  return { id, name, sprite, stats: { hp, strength: 0, agility: agi, intelligence: 1, vitality: 0, luck: 0, attack: atk, defense: def, magicDefense: mdef }, accuracy: acc, evade: eva, xpReward: xp, goldReward: gold, ...extra } as EExt;
}
export const ENEMIES: Record<string, EExt> = {
  goblin: en('goblin', 'Goblin', 'goblin', 8, 4, 2, 4, 6, 16, 6, 6, 6),
  gr_imp: en('gr_imp', 'Gr.Imp', 'gr_imp', 16, 8, 4, 6, 9, 23, 7, 18, 18),
  wolf: en('wolf', 'Wolf', 'wolf', 20, 8, 5, 0, 36, 28, 12, 24, 6, { family: 'were' }),
  gr_wolf: en('gr_wolf', 'Gr.Wolf', 'gr_wolf', 72, 14, 18, 0, 36, 46, 14, 93, 22, { family: 'were' }),
  skeleton: en('skeleton', 'Skeleton', 'skeleton', 10, 10, 9, 12, 12, 17, 6, 9, 3, { family: 'undead', weakness: 'fire' }),
  pirate: en('pirate', 'Pirate', 'pirate', 6, 8, 2, 0, 6, 15, 6, 40, 40),
  garland: en('garland', 'Garland', 'garland', 106, 15, 15, 10, 12, 15, 8, 130, 250, { size: 'large', crit: 1 }),
};

// FF1-style hit% (base, per level) by class; uncertain values noted in the plan
export const HIT: Record<string, [number, number]> = {
  warrior: [10, 3], thief: [5, 2], monk: [5, 3], red_mage: [7, 2], white_mage: [5, 1], black_mage: [5, 1],
};
// FF1-style charge table (per class), index = level-1, values L1..L3
export const CHARGES: Record<string, number[][]> = {
  white_mage: [[2], [3], [3, 1], [4, 2], [4, 2, 1], [5, 3, 2]],
  black_mage: [[2], [3], [3, 1], [4, 2], [4, 2, 1], [5, 3, 2]],
  red_mage: [[2], [2], [3], [3, 1], [4, 2], [4, 2, 1]],
};
// FF1 XP to reach level N (index N)
export const XP_TO = [0, 0, 40, 196, 547, 1171, 2146, 3550, 5461, 7957, 11116];

// ── helpers on Character ──
export function weaponOf(c: Character) { return c.getEquipped('weapon') as (ItemData & Ext) | null; }
export function charAttack(c: Character): number {
  const w = weaponOf(c);
  const str = c.baseStats.strength;
  const base = !w && c.classData.id === 'monk' ? Math.floor(str / 2) + 2 * c.level : Math.floor(str / 2) + (w?.stats.attack ?? 0);
  return base + c.getBuffAmount('attack');
}
export function charHit(c: Character): number {
  const [b, g] = HIT[c.classData.id] ?? [5, 1];
  return b + g * (c.level - 1) + (weaponOf(c)?.hit ?? 0);
}
export function charHits(c: Character): number {
  const n = 1 + Math.floor(charHit(c) / 32);
  return !weaponOf(c) && c.classData.id === 'monk' ? n * 2 : n;
}
export function charWeight(c: Character): number {
  let w = 0;
  for (const s of ['armor', 'shield', 'helmet'] as const) w += ((c.getEquipped(s) as any)?.weight ?? 0);
  return w;
}
export function charEvade(c: Character): number { return 48 + c.stats.agility - charWeight(c) + c.getBuffAmount('evade'); }
export function charAbsorb(c: Character): number {
  const d = c.stats.defense;
  return c.classData.id === 'monk' && !c.getEquipped('armor') ? Math.max(d, c.level) : d;
}
const rr = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

/** FF1 physical hit loop. Returns total damage and counts. */
export function ff1Physical(rng: () => number, A: number, hit: number, nHits: number, crit: number, evade: number, absorb: number, helpless: boolean) {
  let dmg = 0, landed = 0, crits = 0;
  const chance = Math.min(255, Math.max(0, 168 + hit - evade + (helpless ? 40 : 0)));
  for (let i = 0; i < nHits; i++) {
    if (rng() * 200 >= chance) continue;
    landed++;
    let d = Math.max(1, rr(rng, A, 2 * A) - absorb);
    if (rng() * 200 < crit) { d += rr(rng, A, 2 * A); crits++; }
    dmg += d;
  }
  return { dmg, landed, crits };
}

export const stats = { sleepTurnsLost: 0, slepCasts: 0, slepHits: 0 };

export function installNewModel(): void {
  const P: any = BattleStateMachine.prototype;
  P.executePartyAttack = function (actorId: string, targetId: string) {
    const actor: Character = this.getPartyMember(actorId);
    const t = this.enemies.find((e: any) => e.id === targetId);
    if (!actor || !t || actor.currentHp <= 0 || t.currentHp <= 0) return;
    const ed = t.data as EExt;
    const helpless = t.status.has('sleep') || t.status.has('stun');
    const r = ff1Physical(this.rng, charAttack(actor), charHit(actor), charHits(actor), weaponOf(actor)?.crit ?? 0,
      Math.max(0, ed.evade + (t.buffs.get('evade') ?? 0)), ed.stats.defense, helpless);
    if (r.landed === 0) { this.messages.push({ text: `${actor.name} missed!` }); return; }
    t.currentHp = Math.max(0, t.currentHp - r.dmg);
    this.messages.push({ text: `${actor.name} hits ${t.displayName} ${r.landed}x for ${r.dmg}` });
    if (t.currentHp <= 0) this.messages.push({ text: `${t.displayName} defeated!` });
  };
  P.executeEnemyAttack = function (enemyId: string, targetId: string) {
    const e = this.enemies.find((x: any) => x.id === enemyId);
    const t: Character = this.getPartyMember(targetId);
    if (!e || !t || e.currentHp <= 0 || t.currentHp <= 0) return;
    const ed = e.data as EExt;
    const helpless = t.statusTracker.has('sleep') || t.statusTracker.has('stun');
    const r = ff1Physical(this.rng, ed.stats.attack, ed.accuracy, (e.currentHp * 2 <= ed.stats.hp && (ed as any).hitsLow) ? (ed as any).hitsLow : (ed.hits ?? 1), ed.crit ?? 1, Math.max(0, charEvade(t)), charAbsorb(t), helpless);
    if (r.landed === 0) { this.messages.push({ text: `${e.displayName} missed!` }); return; }
    t.currentHp = t.currentHp - r.dmg;
    this.messages.push({ text: `${e.displayName} hits ${t.name} for ${r.dmg}` });
    if (t.currentHp <= 0) this.messages.push({ text: `${t.name} fell!` });
  };
  // sleep: the turn is lost, then a wake roll (FF1-style: rand(0..80) < current HP)
  const origTick = P.tickCombatantStatus;
  P.tickCombatantStatus = function (id: string, isEnemy: boolean) {
    const who: any = isEnemy ? this.enemies.find((e: any) => e.id === id) : this.getPartyMember(id);
    const tracker = isEnemy ? who?.status : who?.statusTracker;
    if (who && who.currentHp > 0 && tracker && (tracker.has('sleep') || tracker.has('stun'))) {
      const can = origTick.call(this, id, isEnemy); // posts "asleep", applies poison etc.
      if (isEnemy && who.data.id === 'garland') stats.sleepTurnsLost++;
      if (this.rng() * 81 < who.currentHp) { tracker.remove('sleep'); tracker.remove('stun'); this.messages.push({ text: 'woke up' }); }
      return can && false;
    }
    return origTick.call(this, id, isEnemy);
  };

  const S: any = SpellExecutor.prototype;
  S.executeDamageSpell = function (cmd: any, spell: any, _int: number, isEnemy: boolean) {
    const rng = this.deps.rng;
    const all = spell.targeting === 'all' ? (isEnemy ? this.deps.livingParty() : this.deps.livingEnemies())
      : (isEnemy ? this.partyFilter(cmd.targetId) : this.deps.enemies.filter((e: any) => e.id === cmd.targetId && e.currentHp > 0));
    const targets = spell.targetFamily ? all.filter((t: any) => t.data?.family === spell.targetFamily) : all;
    for (const t of targets) {
      const mdef = t.data ? t.data.stats.magicDefense : 0;
      const connect = rng() * 200 < Math.min(255, 148 + (spell.accuracy ?? 24) - mdef);
      if (spell.effect.startsWith('status_')) {
        const st = spell.effect.replace('status_', '');
        if (spell.id === 'slep') stats.slepCasts++;
        if (connect) { (t.data ? t.status : t.statusTracker).apply(st); if (spell.id === 'slep') stats.slepHits++; }
        continue;
      }
      let E = spell.power ?? 10;
      if (t.data?.weakness && t.data.weakness === spell.element) E = Math.floor(E * 1.5);
      let d = rr(rng, E, 2 * E);
      if (t.data?.resist && t.data.resist === spell.element) d = Math.floor(d / 2);
      if (connect) d *= 2;
      t.currentHp = Math.max(0, t.currentHp - d);
    }
  };
  S.executeHealSpell = function (cmd: any, spell: any, _int: number, isEnemy: boolean) {
    const rng = this.deps.rng;
    const targets = spell.targeting === 'all_allies' ? this.deps.livingParty() : this.partyFilter(cmd.targetId);
    for (const c of targets) { if (c.currentHp <= 0) continue; const E = spell.power ?? 16; c.currentHp = c.currentHp + rr(rng, E, 2 * E); }
  };
  S.executeBuffSpell = function (cmd: any, spell: any) {
    const stat = spell.effect === 'buff_evade' ? 'evade' : spell.effect === 'buff_defense' ? 'defense' : 'attack';
    const targets = spell.targeting === 'self' ? this.partyFilter(cmd.actorId) : this.partyFilter(cmd.targetId);
    for (const c of targets) c.applyBuff(stat, spell.power);
  };
  // potion: heal 30 (inventory not modelled in the machine; policy tracks counts)
  P.executeItemCommand = function (cmd: any) {
    const t: Character = this.getPartyMember(cmd.targetId);
    if (t && t.currentHp > 0) t.currentHp = t.currentHp + 30;
  };
}

// ── party building ──
export interface MemberSpec { cls: string; level: number; gear: string[]; spells: string[] }
export function makeChar(spec: MemberSpec, i: number, newModel: boolean): Character {
  const cd = CLASSES.find((c) => c.id === spec.cls)!;
  const c = new Character({ name: `${spec.cls}${i}`, classData: cd, level: spec.level });
  for (const g of spec.gear) {
    const it = newModel ? ITEMS[g] : OLD_ITEMS.find((x) => x.id === g)!;
    const slot = it.type === 'weapon' ? 'weapon' : (it.slot ?? 'armor');
    (c as any).equipment.set(slot, it);
  }
  for (const s of spec.spells) { const sp = SPELLS.find((x) => x.id === s)!; c.learnSpell(s, sp.level); }
  if (newModel) {
    const tbl = CHARGES[spec.cls];
    for (let l = 1; l <= 8; l++) c.setSpellCharges(l, tbl ? (tbl[Math.min(spec.level, tbl.length) - 1][l - 1] ?? 0) : 0);
  }
  return c;
}

// ── policies ──
export type Policy = 'careless' | 'sensible' | 'sleep';
export function chooseCommands(bsm: BattleStateMachine, policy: Policy, potions: { n: number }, rng: () => number) {
  const party = bsm.allParty;
  const living = bsm.livingEnemies;
  // sensible: hit the weakest-HP enemy first (finish off), casters use spells
  const focus = [...living].sort((a, b) => a.currentHp - b.currentHp)[0];
  const biggest = [...living].sort((a, b) => b.currentHp - a.currentHp)[0];
  while (bsm.state === 'command_select') {
    const actor = bsm.currentCommandActor!;
    const id = bsm.currentCommandActorId!;
    const enemyTarget = policy === 'careless' ? living[Math.floor(rng() * living.length)] : focus;
    let cmd: any = { type: 'fight', actorId: id, targetId: enemyTarget.id };
    if (policy !== 'careless') {
      const known = actor.getLearnedSpells().map((s) => s.spellId);
      const hurt = party.filter((c) => c.currentHp > 0).sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
      const hurtId = bsm.getPartyId(party.indexOf(hurt));
      if (known.includes('cure') && actor.hasCharges(1) && hurt.currentHp < hurt.maxHp * 0.5) {
        cmd = { type: 'magic', actorId: id, targetId: hurtId, spellId: 'cure' };
      } else if (policy === 'sleep' && known.includes('slep') && actor.hasCharges(1) && living.length >= 1 && !living.some((e) => e.status.has('sleep')) && (living.length >= 3 || living[0].data.id === 'garland')) {
        cmd = { type: 'magic', actorId: id, spellId: 'slep' };
      } else if (known.some((s) => s === 'lit' || s === 'fire') && actor.hasCharges(1) && biggest.currentHp > 12) {
        const sp = known.includes('lit') ? 'lit' : 'fire';
        cmd = { type: 'magic', actorId: id, targetId: biggest.id, spellId: sp };
      } else if (potions.n > 0 && hurt.currentHp < hurt.maxHp * 0.35 && !party.some((c) => c.currentHp > 0 && c.getLearnedSpells().some((s) => s.spellId === 'cure') && c.hasCharges(1))) {
        potions.n--; cmd = { type: 'item', actorId: id, targetId: hurtId, itemId: 'potion' };
      }
    }
    bsm.submitCommand(cmd);
  }
}

/** FF1 front-slot weights for enemy targeting: 4/2/1/1 over the living, in party order. */
export function ff1TargetAI() {
  return {
    selectAction(self: any, party: Character[], _a: any, _t: number, rng: () => number) {
      const W = [4, 2, 1, 1];
      const alive = party.map((c, i) => ({ i, w: c.currentHp > 0 ? W[i] ?? 1 : 0 }));
      const tot = alive.reduce((s, x) => s + x.w, 0);
      let r = rng() * tot;
      for (const x of alive) { r -= x.w; if (x.w > 0 && r < 0) return { type: 'fight', actorId: self.id, targetId: `party_${x.i}` }; }
      return { type: 'fight', actorId: self.id, targetId: `party_${alive.find((x) => x.w > 0)!.i}` };
    },
  };
}

export function runBattle(party: Character[], enemies: EnemyData[], policy: Policy, rng: () => number, newModel: boolean, potions = { n: 0 }) {
  const bsm = new BattleStateMachine({ party, enemies, spells: newModel ? SPELLS : OLD_SPELLS, canRun: false }, rng);
  if (newModel) enemies.forEach((_, i) => bsm.setEnemyAI(i, ff1TargetAI() as any));
  bsm.startBattle(); bsm.advanceFromIntro();
  let rounds = 0;
  while (!bsm.isOver && rounds < 60) {
    if (bsm.state === 'command_select') chooseCommands(bsm, policy, potions, rng);
    if (bsm.state === 'execution') { bsm.executeRound(); rounds++; }
    if (bsm.state === 'resolution') bsm.resolveRound();
  }
  return { outcome: bsm.outcome ?? 'timeout', rounds, bsm };
}
