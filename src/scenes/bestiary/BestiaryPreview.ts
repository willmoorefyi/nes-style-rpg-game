/**
 * The bestiary's preview (docs/BESTIARY_PLAN.md 3.1, 3.6): the battle background and one enemy laid out as a lone
 * enemy in battle (AiEnemyView, i.e. computeEnemyLayoutAi), in a stage container at screen (0, 0) masked to the
 * preview window's inner rect; the actors then move so the idle figure and the backdrop are centred on the panel
 * (docs/REDESIGN_PLAN.md 1, bestiaryFit.ts). The loop (bestiaryAnim.ts) plays the real attack toward an invisible phantom target
 * placed so the furthest lunge ends REACH_MARGIN inside the panel, or further left when the attack art reaches past
 * the idle edge (ROSTER_FIX_PLAN 12d: death_eye's lunge touched the border). Frames are cached for the shown entry
 * only (FW-8).
 */
import { Container, Graphics, type Texture } from 'pixi.js';
import type { EnemyData } from '../../types/index.js';
import type { BestiaryData, BestiaryAnimLabel } from '../../types/bestiaryData.js';
import { Window } from '../../ui/Window.js';
import { OutlinedText } from '../../ui/NESFont.js';
import { monsterSpriteKey, type MonsterFrames } from '../../rendering/BattleArt.js';
import { lungeOvershoot } from '../../rendering/monsterAnchors.js';
import { AiEnemyView, type MonsterArtSource } from '../battle/AiEnemyView.js';
import type { EnemyPoseController, Posture } from '../battle/EnemyPoseController.js';
import { ENEMY_REACH_OVERLAP } from '../battle/enemyReach.js';
import { WINDOW_BORDER_INNER, WINDOW_BORDER_OUTER } from '../../core/LayoutConstants.js';
import { BestiaryLoop, type LoopPoses } from './bestiaryAnim.js';
import { fitShift, type Fit } from './bestiaryFit.js';
import { BestiaryBackdrop } from './bestiaryBackdrop.js';
import { BestiaryColossus } from './bestiaryColossus.js';
import { colossusOf } from '../battle/colossus/colossusIndex.js';

/** The preview window (screen px). */
export const PREVIEW_RECT = { x: 24, y: 120, width: 976, height: 756 } as const;
const BORDER = WINDOW_BORDER_OUTER + WINDOW_BORDER_INNER;
/** Inside the borders: the stage's mask. */
export const PREVIEW_INNER = { left: PREVIEW_RECT.x + BORDER, top: PREVIEW_RECT.y + BORDER,
  right: PREVIEW_RECT.x + PREVIEW_RECT.width - BORDER, bottom: PREVIEW_RECT.y + PREVIEW_RECT.height - BORDER } as const;
/** The furthest lunge's idle-measured edge ends this far inside the panel. The plan said 16, but a weapon drawn past
 *  the idle edge (the goblin's knife) then touched the border; 48 keeps it in view. */
const REACH_MARGIN = 48;
const PHANTOM = { w: 48, h: 160 };
/** 12d: the attack art's furthest edge (the idle edge plus the atlas `lungeRight` overshoot) ends this far inside. */
const ART_MARGIN = 12;

/**
 * R2 / BS-7, the one place the daze step touches the pose API: Fe's 'daze' posture (daze / daze_b, falling back to
 * hurt_in1 until a sheet has daze frames).
 */
const DAZE_POSTURE: Posture = 'daze';

/** What the preview shows for an entry. */
export interface PreviewEntry { enemy: EnemyData; seen: boolean; hasSpells: boolean }

/** Monster frames cached per sprite key (each holding its atlas page, FW-8); `keepOnly` and `dispose` destroy each unique
 *  texture view (not the shared page source) and release the page. A sprite whose page is not loaded yet is not
 *  cached, so it is asked again once the page arrives. */
export class CachedArt implements MonsterArtSource {
  private readonly cache = new Map<string, MonsterFrames | null>();
  private readonly releases = new Map<string, () => void>();
  constructor(private readonly source: MonsterArtSource) {}

  getMonsterFrames(sprite: string): MonsterFrames | null {
    if (!this.cache.has(sprite)) {
      const f = this.source.getMonsterFrames(sprite);
      if (!f && this.source.isReady && !this.source.isReady(sprite)) return null;
      this.cache.set(sprite, f);
      if (f && this.source.hold) this.releases.set(sprite, this.source.hold(sprite));
    }
    return this.cache.get(sprite) ?? null;
  }

  ensure(sprites: string[]): Promise<void> { return this.source.ensure?.(sprites) ?? Promise.resolve(); }
  isReady(sprite: string): boolean { return this.cache.has(sprite) || (this.source.isReady?.(sprite) ?? true); }

  get size(): number { return this.cache.size; }

  /** Every unique texture in the cache. */
  textures(): Set<Texture> {
    return new Set([...this.cache.keys()].flatMap((s) => [...texturesOf(this.cache.get(s) ?? null)]));
  }

  /** Drop (destroy and release) every cached sprite not in `sprites`: the bestiary's entry change. */
  keepOnly(sprites: string[]): void {
    for (const s of [...this.cache.keys()]) if (!sprites.includes(s)) this.drop(s);
  }

  dispose(): void {
    for (const s of [...this.cache.keys()]) this.drop(s);
  }

  private drop(sprite: string): void {
    for (const t of texturesOf(this.cache.get(sprite) ?? null)) t.destroy(false);
    this.cache.delete(sprite);
    this.releases.get(sprite)?.();
    this.releases.delete(sprite);
  }
}

function texturesOf(f: MonsterFrames | null): Set<Texture> {
  return new Set(f ? [...Object.values(f.textures), f.idle, f.attack, f.cast, f.hurt] : []);
}

export class BestiaryPreview {
  readonly window = new Window({ ...PREVIEW_RECT });
  /** A direct child of the scene container at (0, 0), unscaled: the battle's screen space. */
  readonly stage = new Container();
  private readonly actors = new Container();
  private readonly maskShape = new Graphics();
  private readonly caption = new OutlinedText({ outline: 0x000000 });
  private readonly phantom = new Graphics();
  private readonly loop: BestiaryLoop;
  private readonly backdrop: BestiaryBackdrop;
  /** Pass C: a colossus form's preview at scale 1 (docs/CHAOS_FORMS_PLAN.md 8). */
  private readonly colossus = new BestiaryColossus(this.actors);
  private view: AiEnemyView | null = null;
  private sprite: Container | null = null;
  private posture: Posture = 'none';
  private noArt = false;
  private fit: Fit | null = null;

  constructor(parent: Container, readonly art: CachedArt, loadTexture: (path: string) => Promise<Texture>,
    private readonly data: BestiaryData) {
    this.backdrop = new BestiaryBackdrop(this.stage, loadTexture, PREVIEW_INNER);
    const inner = PREVIEW_INNER;
    this.maskShape.rect(inner.left, inner.top, inner.right - inner.left, inner.bottom - inner.top).fill(0xffffff);
    this.stage.mask = this.maskShape;
    this.phantom.rect(0, 0, PHANTOM.w, PHANTOM.h).fill(0xffffff);
    this.phantom.alpha = 0;                     // never visible = false: invisible objects have empty bounds
    this.stage.addChild(this.actors);
    this.actors.addChild(this.phantom);
    this.caption.position.set(PREVIEW_RECT.x + 30, inner.bottom - 48);
    parent.addChild(this.window, this.stage, this.maskShape, this.caption);
    this.loop = new BestiaryLoop(this.livePoses, { attack: () => this.view?.playAttack(0, this.phantom),
      setDazed: (on) => { this.posture = on ? DAZE_POSTURE : 'none'; } }, data.anim);
  }

  /** The current enemy's pose controller (read-only use: tests and the scene's debug view). */
  get poses(): EnemyPoseController | null { return this.view?.poses ?? null; }
  get enemySprite(): Container | null { return this.sprite; }
  get phantomTarget(): Container { return this.phantom; }
  get loopStep(): string { return this.loop.current; }
  /** The shown entry's centring shift and the clamps that bound it (null: no art). */
  get lastFit(): Fit | null { return this.fit; }

  /** Show an entry (null or unseen: no sprite) on the background `backgroundId`. */
  show(entry: PreviewEntry | null, backgroundId: string | null): void {
    this.clearEnemy();
    this.art.keepOnly(entry?.seen ? [monsterSpriteKey(entry.enemy)] : []);   // FW-8: release the last entry's page
    if (backgroundId) this.backdrop.set(backgroundId);
    void this.colossus.show(entry?.seen ? entry.enemy : null);   // releases a shown colossus; draws a colossus form
    this.actors.position.set(0, 0);                             // a colossus (still or live) is placed in panel space
    if (!entry || !entry.seen || colossusOf(entry.enemy)) { this.caption.text = ''; return; }
    const e = entry.enemy;
    this.view = new AiEnemyView([e], this.art);
    const [sprite] = this.view.build();
    this.sprite = sprite;
    this.actors.addChildAt(sprite, 0);
    const f = this.art.getMonsterFrames(monsterSpriteKey(e));
    this.noArt = !f;
    this.fit = null;
    if (f) {
      const feetY = sprite.y + (f.footRow + 1) * f.scale;
      const past = (lungeOvershoot(f) + 1) * f.scale;     // the attack art's right edge past the idle edge column
      const margin = Math.max(REACH_MARGIN, ART_MARGIN + past);
      this.phantom.position.set(PREVIEW_INNER.right - margin - ENEMY_REACH_OVERLAP - 0.25 * f.lungePx, feetY - PHANTOM.h);
      // in local space; an enemy too wide to travel (warmech) lunges in place: that bounds the centring shift right
      const inPlace = sprite.x + (f.opaqueRight ?? f.cell[0]) * f.scale + f.lungePx + past;
      this.fit = fitShift(f, PREVIEW_INNER, { x: sprite.x, y: sprite.y, scale: sprite.scale.x / f.artScale * f.scale,
        inPlaceRight: inPlace, limitRight: PREVIEW_INNER.right - ART_MARGIN });
      this.actors.position.set(this.fit.dx, this.fit.dy);
    }
    const label: BestiaryAnimLabel = e.attack === 'ranged' ? 'ranged' : e.attackAnim === 'heavy' ? 'heavy' : 'attack';
    this.loop.start({ hasCast: this.view.hasCast(0), hasDaze: !!f && f.textures.daze !== f.textures.hurt_in1,
      hasSpells: entry.hasSpells }, label);
    this.view.update(0, [sprite], [this.posture]);
    this.refreshCaption();
  }

  /** One frame of the bestiary clock (dt 0 in step mode). */
  update(dt: number): void {
    this.colossus.update(dt);
    if (!this.view || !this.sprite) return;
    this.loop.update(dt);
    this.view.update(dt, [this.sprite], [this.posture]);
    this.refreshCaption();
  }

  /** Z: the next animation now (queued during an attack, hurt or cast). */
  skip(): void { if (this.view) this.loop.skip(); }

  /** Shift: pause or resume the loop. */
  togglePause(): void {
    this.loop.togglePause();
    this.refreshCaption();
  }

  get paused(): boolean { return this.loop.paused; }

  private refreshCaption(): void {
    const L = this.data.labels;
    const step = this.loop.currentLabel();
    const parts = [this.noArt ? L.noArt : '', this.loop.paused ? L.paused : step ? L.anim[step] : ''].filter((s) => s);
    const text = this.view ? parts.join('   ') : '';
    if (this.caption.text !== text) this.caption.text = text;
  }

  private get livePoses(): LoopPoses {
    return {
      playHurt: (i) => this.view?.poses.playHurt(i),
      playCast: (i) => this.view?.poses.playCast(i),
      isAttacking: (i) => this.view?.poses.isAttacking(i) ?? false,
      debug: (i) => this.view?.poses.debug(i) ?? { mode: 'idle' },
    };
  }

  private clearEnemy(): void {
    this.posture = 'none';
    this.sprite?.destroy({ children: true, texture: false });
    this.sprite = null;
    this.view = null;
    this.noArt = false;
  }

  /** Destroy the sprites and the stage (not the cached background textures), then the frames cache. */
  destroy(): void {
    this.clearEnemy();
    this.colossus.dispose();
    this.backdrop.destroy();
    this.stage.destroy({ children: true });
    this.maskShape.destroy();
    this.caption.destroy({ children: true });
    this.window.destroy({ children: true });
    this.art.dispose();
  }
}
