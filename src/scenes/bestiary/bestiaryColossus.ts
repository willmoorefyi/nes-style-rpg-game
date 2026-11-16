/**
 * The bestiary preview of a colossus form (docs/CHAOS_FORMS_PLAN.md 8, R22; rev 4: 18.8, D-O21). A built form shows
 * the build's still (`colossus/<form>/preview.png`: the rest view over rim, fit into 940 x 720) centred at scale 1, with
 * no layer tiles loaded. Without a still (the synthetic fixture, or a failed load) it shows a ColossusView at scale 1 (art px = screen
 * px, an integer scale) inside the preview panel. A canvas that fits (<= 940 x 720 art px) is drawn whole with its
 * `visibleBox` centred on the panel; a larger one shows the rest-view crop (the part inside `visibleBox`, masked), and
 * if even that does not fit, a crop centred on `core` clipped by the panel. A 1/n downscale is never used. One form is
 * loaded at a time (the last one's textures are released), and the loop plays idle, then attack, hurt and cast.
 */
import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { EnemyData } from '../../types/index.js';
import { colossusArt } from '../../rendering/ColossusArt.js';
import { ColossusView } from '../battle/colossus/ColossusView.js';
import { ColossusPoseController } from '../battle/colossus/ColossusPoseController.js';
import { colossusOf, placeholderForm, variantOf, visibleBoxOf, type ColossusFormSpec } from '../battle/colossus/colossusIndex.js';
import type { ColossusArtLike } from '../battle/colossus/colossusSprites.js';
import type { ColossusTimeline } from '../battle/colossus/colossusChoreography.js';
import { panelCentre } from './bestiaryFit.js';
import { WINDOW_BORDER_INNER, WINDOW_BORDER_OUTER } from '../../core/LayoutConstants.js';

type Inner = { left: number; top: number; right: number; bottom: number };
/** BestiaryPreview's PREVIEW_INNER (the preview window inside its borders); repeated here to keep the import one-way. */
const B = WINDOW_BORDER_OUTER + WINDOW_BORDER_INNER;
const PANEL: Inner = { left: 24 + B, top: 120 + B, right: 24 + 976 - B, bottom: 120 + 756 - B };
const FIRST_WAIT = 40;
const WAIT = 30;
const LOOP = ['attack', 'hurt', 'cast'] as const;

/** What the preview needs from the art (ColossusArt). */
export type BestiaryColossusArt = ColossusArtLike & { loadedForms(): string[]; preview(id: string): Promise<Texture | null>;
  releasePreview(): void };

export class BestiaryColossus {
  view: ColossusView | null = null;
  /** The build's still, when the form has one (18.8). */
  still: Sprite | null = null;
  /** True when the canvas is cropped to the rest view (or the core) instead of drawn whole. */
  cropped = false;
  private ctl: ColossusPoseController | null = null;
  private mask: Graphics | null = null;
  private crop: { x: number; y: number; width: number; height: number } | null = null;
  private centre = { x: 0, y: 0 };
  private token = 0;
  private wait = FIRST_WAIT;
  private next = 0;

  constructor(private readonly parent: Container, private readonly art: BestiaryColossusArt = colossusArt,
    private readonly inner: Inner = PANEL) {}

  get mode(): ColossusTimeline { return this.ctl?.timeline ?? 'idle'; }

  /** Show `enemy`'s colossus form (null or an atlas enemy: nothing). Resolves once drawn. */
  async show(enemy: EnemyData | null): Promise<void> {
    this.clear();
    const token = ++this.token;
    this.art.releasePreview();
    const id = enemy && colossusOf(enemy) ? this.art.entryFor(enemy) : null;
    this.art.release(this.art.loadedForms().filter((f) => f !== id));
    if (!id || !enemy) return;
    const tex = await this.art.preview(id);
    if (token !== this.token) return;
    if (tex) { this.showStill(tex); return; }
    const entry = this.art.entryFor(enemy) ?? id;
    await this.art.ensure([entry]);
    if (token !== this.token) return;
    const spec = this.art.isReady(entry) ? this.art.form(entry) : null;
    this.build(entry, spec ?? placeholderForm(), variantOf(enemy));
  }

  private showStill(tex: Texture): void {
    const [cx, cy] = panelCentre(this.inner);
    const s = this.still = new Sprite(tex);
    s.label = 'colossus.still';
    s.position.set(Math.round(cx - tex.width / 2), Math.round(cy - tex.height / 2));
    this.centre = { x: s.x + tex.width / 2, y: s.y + tex.height / 2 };
    this.parent.addChild(s);
  }

  private build(id: string, spec: ColossusFormSpec, variant: Record<string, string>): void {
    const [cx, cy] = panelCentre(this.inner);
    const w = this.inner.right - this.inner.left;
    const h = this.inner.bottom - this.inner.top;
    const [l, t, r, b] = visibleBoxOf(spec);
    const fits = spec.canvas[0] <= w && spec.canvas[1] <= h;
    const restFits = r - l <= w && b - t <= h;
    const [ax, ay] = fits || restFits ? [(l + r) / 2, (t + b) / 2] : spec.anchors.core;
    const place: [number, number] = [Math.round(cx - ax), Math.round(cy - ay)];
    this.view = new ColossusView(id, { ...spec, scale: 1, place }, this.art, variant);
    this.centre = { x: place[0] + ax, y: place[1] + ay };
    this.cropped = !fits;
    this.crop = fits ? null : restFits ? { x: place[0] + l, y: place[1] + t, width: r - l, height: b - t }
      : { x: this.inner.left, y: this.inner.top, width: w, height: h };
    this.parent.addChild(this.view.root);
    if (this.crop) {
      this.mask = new Graphics().rect(this.crop.x, this.crop.y, this.crop.width, this.crop.height).fill(0xffffff);
      this.parent.addChild(this.mask);
      this.view.root.mask = this.mask;
    }
    this.ctl = new ColossusPoseController(this.view.layerInfo);
    this.view.apply(this.ctl.frame());
    this.wait = FIRST_WAIT;
    this.next = 0;
  }

  /** The visible box's (or the core's, for a deep crop) centre on screen. */
  visibleCentre(): { x: number; y: number } { return { ...this.centre }; }
  cropRect(): { x: number; y: number; width: number; height: number } | null { return this.crop ? { ...this.crop } : null; }

  /** One frame of the loop: idle, then attack, hurt and cast in turn, with an idle pause between. */
  update(dt: number): void {
    const ctl = this.ctl;
    if (!ctl || !this.view) return;
    ctl.update(dt);
    if (ctl.timeline === 'idle' && (this.wait -= dt) <= 0) {
      const a = LOOP[this.next++ % LOOP.length];
      if (a === 'attack') ctl.attack(); else if (a === 'hurt') ctl.hurt(); else ctl.cast('cast');
      this.wait = WAIT;
    }
    this.view.tick(dt);
    this.view.apply(ctl.frame());
  }

  /** Remove the shown form (its textures stay until the next show or dispose). */
  clear(): void {
    this.still?.destroy();
    this.still = null;
    this.view?.destroy();
    this.view = null;
    this.ctl = null;
    this.mask?.destroy();
    this.mask = null;
    this.crop = null;
    this.cropped = false;
  }

  /** The bestiary's exit: destroy the view and release every colossus texture (R27). */
  dispose(): void {
    this.token++;
    this.clear();
    this.art.release();
  }
}
