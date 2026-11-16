import { Assets, Rectangle, Texture } from 'pixi.js';
import { characterAtlas, fetchJson } from './CharacterAtlas.js';
import { MonsterPages, type MonsterAtlasPage, type PageIo } from './MonsterPages.js';
import { monsterAnchors, type MonsterAnchors } from './monsterAnchors.js';
import { measureOpaqueBox } from './measureOpaque.js';
import { BOSS_FRAMES, lungePx, resolveFrame, type MonsterFrame, type MonsterKeyframe } from '../scenes/battle/enemyChoreography.js';

const MONSTER_DIR = 'assets/sprites/';
const MONSTER_ATLAS = `${MONSTER_DIR}monsters-ai`;

/** Pixi's asset cache as the page loader. */
const PIXI_PAGES: PageIo = {
  load: (url) => Assets.load<Texture>(url),
  unload: (url) => { Assets.unload(url).catch((err: unknown) => console.warn(`Monster art: could not unload ${url}`, err)); },
};

/** assets/sprites/monsters-ai.json (build stage monsters_ai, docs/ENEMY_ANIM_PLAN.md 6.1; pages: ROSTER_PLAN 8). Rects
 *  are art px on the sheet's `page`; a page holds `texScale` PNG px per art px (1 = native atlas; an old pre-scaled
 *  atlas has none, i.e. `scale`). An index without `pages` is the single-page R0 shape (`monsters-ai.png`). */
export interface MonsterAtlasMeta {
  /** Screen px per art px. */
  scale: number;
  texScale?: number;
  /** The atlas pages (PNG files next to the JSON); missing: one page, monsters-ai.png. */
  pages?: MonsterAtlasPage[];
  /** Plus the FW-A anchors `travelTop`, `lungeRight` and `homeX` (monsterAnchors.ts). */
  sheets: Record<string, MonsterAnchors & {
    /** Index into `pages` (0 when missing). */
    page?: number;
    /** The sheet's own screen px per art px (FW-S: 3 for the rescaled sheets); missing: the atlas `scale`. */
    scale?: number;
    cell: [number, number];
    footRow: number;
    floating: boolean;
    /** idle, attack and hurt always; bosses add cast; generated in-betweens (aliased when not animated). */
    frames: Partial<Record<MonsterFrame, [number, number]>> & Record<'idle' | 'attack' | 'hurt', [number, number]>;
    anim?: boolean;
    holds?: string[];
    lungePx?: number;
    /** The idle keyframe's opaque right edge (art px from the cell's left, exclusive); measured at load when missing. */
    opaqueRight?: number;
    /** The head joint (art px in the cell), for cue effects placed on the head (the glint). */
    head?: [number, number];
    /** The weapon tip in `attack_raise` (art px in the cell): the heavy attack's glint. Sheets with a raise only. */
    tip?: [number, number];
  }>;
}

/** Everything the battle scene needs to draw and animate one monster (with the atlas anchors, monsterAnchors.ts). */
export interface MonsterFrames extends MonsterAnchors {
  /** One texture per frame name; a missing frame shows its source keyframe (a boss-less cast shows attack). */
  textures: Record<MonsterFrame, Texture>;
  idle: Texture;
  attack: Texture;
  /** Spell stance; the attack frame when the monster has none. */
  cast: Texture;
  hurt: Texture;
  /** Screen px per art px. */
  scale: number;
  /** Screen px per PNG px (the sprite's scale before the layout factor). */
  artScale: number;
  /** Art cell size (art px) and last row of the feet inside it. */
  cell: [number, number];
  footRow: number;
  floating: boolean;
  /** The approved sheet has its own cast keyframe (boss). */
  hasCast: boolean;
  /** The approved sheet has its own `attack_raise` keyframe (the heavy attack's raised hold; else it coils in
   *  `atk_wind2`). Always set by `getMonsterFrames`; optional so hand-built frames (tests) may leave it out (= false). */
  hasRaise?: boolean;
  lungePx: number;
  anim: boolean;
  /** The idle keyframe's opaque right edge in art px (the travel's reach); the cell width when unknown. */
  opaqueRight?: number;
  /** The head joint in art px, when the atlas has it. */
  head?: [number, number];
  /** The raised weapon's tip in art px (the glint), when the atlas has it. */
  tip?: [number, number];
}

/** Art id for an enemy: its `sprite` (palette-swap variants share code but not art), without a file extension. */
export function monsterSpriteKey(data: { id: string; sprite?: string }): string {
  return (data.sprite || data.id).replace(/\.png$/i, '');
}

/**
 * The monster atlas index and its pages (MonsterPages), plus the character atlas, so battles can draw art
 * synchronously: `BattleTrigger` awaits `ensure(formation sprites)` before it pushes the battle. A sprite whose page
 * is not loaded yet gets null (a placeholder box) and its page starts loading; `isLoaded` stays false until it
 * arrives, so the battle's late-art path (`load().then(upgrade)`) swaps the art in (A14/A15).
 */
export class BattleArt {
  private meta: MonsterAtlasMeta | null = null;
  private loading: Promise<void> | null = null;
  private done = false;
  readonly pages: MonsterPages;
  /** Sprites asked for before the index arrived: their pages load with it. */
  private readonly wanted = new Set<string>();
  /** Sprites already reported missing from a loaded atlas (one warning each). */
  private readonly warned = new Set<string>();
  /** Sprites already reported as waiting for their page (one warning each). */
  private readonly late = new Set<string>();
  /** Idle opaque boxes measured from the atlas image for sheets whose meta lacks `opaqueRight` or `idleBox`. */
  private readonly opaque = new Map<string, [number, number, number, number] | null>();

  constructor(io: PageIo = PIXI_PAGES) {
    this.pages = new MonsterPages(MONSTER_DIR, io);
  }

  /** True once the index load has been attempted and no page load is in flight (art may still be missing: battles
   *  then use placeholder boxes). */
  get isLoaded(): boolean {
    return this.done && !this.pages.busy;
  }

  /** The sprite's page is loaded (its frames are available now). */
  isReady(sprite: string): boolean {
    return this.pages.isReady(sprite);
  }

  /** Keep the sprite's page loaded while Textures cut from it are in use; returns the release. */
  hold(sprite: string): () => void {
    return this.pages.hold(sprite);
  }

  /** Load the index (first call) and the pages of `sprites`. Never rejects. */
  async ensure(sprites: string[]): Promise<void> {
    await this.load();
    await this.pages.ensure(sprites);
  }

  /** Pose frames for a monster sprite, or null when it has no approved art or its page is not loaded yet. */
  getMonsterFrames(sprite: string): MonsterFrames | null {
    if (!this.meta) {
      if (!this.done) this.wanted.add(sprite);         // the index is still loading: its page loads with it
      return null;
    }
    const entry = this.meta.sheets[sprite];
    // E16: the atlas is loaded but lacks this sheet: say so once (before the load this is the late-load path, A15)
    if (!entry) {
      if (!this.warned.has(sprite)) {
        this.warned.add(sprite);
        console.warn(`Monster art: no sheet for "${sprite}" in ${MONSTER_ATLAS}.json; using a placeholder box`);
      }
      return null;
    }
    const tex = this.pages.texture(entry.page ?? 0);
    if (!tex) {
      if (!this.pages.hasFailed(sprite)) {
        if (!this.late.has(sprite)) {
          this.late.add(sprite);
          console.warn(`Monster art: page ${entry.page ?? 0} of "${sprite}" is not loaded yet; a placeholder until it arrives`);
        }
        void this.pages.ensure([sprite]);
      }
      return null;
    }
    const source = tex.source;
    const ts = this.meta.texScale ?? this.meta.scale;
    const [w, h] = entry.cell;
    const cache = new Map<string, Texture>();
    const slice = (name: MonsterFrame): Texture => {
      // the FRAME_FALLBACK chain (e.g. daze → hurt_in1 → idle), then attack
      const found = resolveFrame(name, (f) => !!entry.frames[f]);
      const [x, y] = (found && entry.frames[found]) || entry.frames.attack;
      const key = `${x},${y}`;
      let t = cache.get(key);
      if (!t) {
        t = new Texture({ source, frame: new Rectangle(x * ts, y * ts, w * ts, h * ts) });
        cache.set(key, t);
      }
      return t;
    };
    const textures = Object.fromEntries(BOSS_FRAMES.map((n) => [n, slice(n)])) as Record<MonsterFrame, Texture>;
    const key = (k: MonsterKeyframe): Texture => textures[k];
    const anchors = monsterAnchors(entry);
    const measured = entry.opaqueRight === undefined || !anchors.idleBox
      ? this.measureIdle(sprite, tex, entry.frames.idle, entry.cell, ts) : null;
    const idleBox = anchors.idleBox ?? measured ?? undefined;
    // TS-2: the sheet's own screen scale (FW-S `scale: 3`, docs/REDESIGN_PLAN.md 2.4); its lunge (screen px at the
    // atlas scale) is scaled here once, so the attack plan, the pose controller and the bestiary read the same value
    const s = entry.scale ?? this.meta.scale;
    return { textures, idle: key('idle'), attack: key('attack'), cast: key('cast'), hurt: key('hurt'), scale: s,
      artScale: s / ts, cell: [w, h], footRow: entry.footRow, floating: entry.floating, hasCast: !!entry.frames.cast,
      hasRaise: !!entry.frames.attack_raise, lungePx: (lungePx(entry) * s) / this.meta.scale, anim: !!entry.anim,
      opaqueRight: entry.opaqueRight ?? (measured ? measured[2] + 1 : w),
      ...(entry.head ? { head: entry.head } : {}), ...(entry.tip ? { tip: entry.tip } : {}), ...anchors,
      ...(idleBox ? { idleBox } : {}) };
  }

  /** The idle frame's opaque box (art px, inclusive), read once from the atlas image; null outside a browser. */
  private measureIdle(sprite: string, tex: Texture, frame: [number, number], cell: [number, number], ts: number):
    [number, number, number, number] | null {
    if (!this.opaque.has(sprite)) this.opaque.set(sprite, measureOpaqueBox(sprite, tex, frame, cell, ts));
    return this.opaque.get(sprite) ?? null;
  }

  /** The character atlas, the monster index and page 0 (act 1) on the first call, plus the pages of sprites asked
   *  for meanwhile; later calls resolve once no page load is in flight. */
  load(): Promise<void> {
    if (!this.loading) this.loading = this.fetchAll();
    return this.loading.then(() => this.pages.settled());
  }

  private async fetchAll(): Promise<void> {
    await characterAtlas.load();
    try {
      const meta = await fetchJson<MonsterAtlasMeta>(`${MONSTER_ATLAS}.json`);
      const pages = meta.pages ?? [{ file: 'monsters-ai.png', w: 0, h: 0 }];
      this.pages.setIndex(pages, (s) => (meta.sheets[s] ? meta.sheets[s].page ?? 0 : undefined));
      await this.pages.ensurePages([0, ...this.takeWanted()]);
      this.meta = meta;
      const more = this.takeWanted();                  // asked for while page 0 loaded (started before `done`)
      if (more.length) void this.pages.ensurePages([0, ...more]);
    } catch (err) {
      console.warn('Monster art unavailable; using placeholder enemy sprites', err);
    }
    this.done = true;
  }

  private takeWanted(): number[] {
    const pages = [...this.wanted].map((s) => this.pages.pageOf(s)).filter((p): p is number => p !== undefined);
    this.wanted.clear();
    return pages;
  }
}

export const battleArt = new BattleArt();
