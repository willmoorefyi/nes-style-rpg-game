/**
 * The battle display's colossus slots (docs/CHAOS_FORMS_PLAN.md 4.2, 4.4, 4.5): for an enemy whose record has
 * `colossus:`, the ColossusView goes into the `colossus` layer and its invisible proxy takes the enemy's slot in
 * `enemySprites` (and its child slot in `actors`), and the enemy's poses route to its ColossusPoseController
 * (EnemyActorPoses). AiEnemyView still lays out and poses the atlas enemies only: it is handed a detached stand-in for
 * each colossus slot, and a late atlas load never replaces a proxy (the `upgradeToArt` guard). Missing colossus art
 * draws the placeholder box (warned once) and is swapped for the real art when it arrives.
 *
 * The sky dim (D-O19, B8; 18.3): while a form with `skyDim` (F3 / F4) is on screen, `bg` is multiplied by that grey.
 * It is set when the battle starts on such a form and at the end of an interlude (`settleSky`, the end of chaos_i2), and
 * reset on victory and defeat (`clearSky`); a retry or the next battle builds new layers, so its `bg` starts untinted.
 */
import { Container, Graphics } from 'pixi.js';
import type { EnemyData, SpellData } from '../../../types/index.js';
import type { NextActionInfo } from '../../../battle/BattleStateMachine.js';
import { colossusArt } from '../../../rendering/ColossusArt.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../core/LayoutConstants.js';
import type { BattleLayers } from '../BattleLayers.js';
import { ColossusView, type ColossusTextureSource } from './ColossusView.js';
import { ColossusPoseController, type ColossusCastKind } from './ColossusPoseController.js';
import { colossusOf, placeholderForm, variantOf, type ColossusFormSpec } from './colossusIndex.js';
import type { EnemyActorPoses } from './enemyActorView.js';

/** What the slots need from the art (ColossusArt). */
export interface ColossusArtLike extends ColossusTextureSource {
  form(id: string): ColossusFormSpec | null;
  isReady(id: string): boolean;
  ensure(ids: string[]): Promise<void>;
  release(ids?: string[]): void;
}

/** The beam plays for a single-target black damage spell (R9: keyed by `colossus:`, never by attackAnim). */
export function castKindFor(info: Pick<NextActionInfo, 'spellId'> | null, spells: readonly SpellData[]): ColossusCastKind {
  const s = info?.spellId ? spells.find((x) => x.id === info.spellId) : undefined;
  return s && s.type === 'black' && s.targeting === 'single' && s.effect.startsWith('damage') ? 'beam' : 'cast';
}

interface Slot { formId: string; data: EnemyData; view: ColossusView; ctl: ColossusPoseController; placeholder: boolean }

/** The multiply tint of a grey `dim` (0.6 -> 0x999999). */
export const greyTint = (dim: number): number => { const v = Math.round(255 * Math.min(1, Math.max(0, dim))); return (v << 16) | (v << 8) | v; };

export class ColossusSlots {
  private readonly slots = new Map<number, Slot>();
  private readonly standIns = new Map<number, Container>();
  private sprites: Container[] = [];
  private poses: EnemyActorPoses | null = null;
  private overlay: Graphics | null = null;
  private disposed = false;
  /** The sky dim now on `bg` (1 = none). */
  private skyNow = 1;

  constructor(private readonly layers: BattleLayers, private readonly art: ColossusArtLike = colossusArt,
    private readonly castKind: (i: number) => ColossusCastKind = () => 'cast') {}

  /** At build: every enemy whose record draws a colossus gets its view in place of the AiEnemyView sprite. */
  adopt(enemies: readonly EnemyData[], sprites: Container[], poses: EnemyActorPoses | null): void {
    this.sprites = sprites;
    this.poses = poses;
    enemies.forEach((e, i) => { if (colossusOf(e)) this.swapIn(i, e); });
    this.settleSky();
  }

  /** The sky dim the live forms on screen ask for (the lowest `skyDim`; 1 = none). */
  skyDim(): number {
    let dim = 1;
    for (const s of this.slots.values()) if (!s.ctl.gone && s.view.root.visible) dim = Math.min(dim, s.view.form.skyDim ?? 1);
    return dim;
  }

  /** The dim on `bg` now (an interlude's tint multiplies with it). */
  get sky(): number { return this.skyNow; }

  /** Put the forms' sky dim on `bg` (battle start, an interlude's end); returns the tint. */
  settleSky(): number {
    this.skyNow = this.skyDim();
    const tint = greyTint(this.skyNow);
    this.layers.bg.tint = tint;
    return tint;
  }

  /** Victory or defeat: the backdrop is shown undimmed again (B8). */
  clearSky(): void {
    this.skyNow = 1;
    this.layers.bg.tint = 0xffffff;
  }

  has(i: number): boolean { return this.slots.has(i); }
  view(i: number): ColossusView | null { return this.slots.get(i)?.view ?? null; }
  controller(i: number): ColossusPoseController | null { return this.slots.get(i)?.ctl ?? null; }

  /** The swap: enemy i draws `data`'s colossus form from now on (its old sprite or view is destroyed). `riseFrom`:
   *  the view starts that many art px below its rest (the interlude's `rise` brings it up). */
  swapIn(i: number, data: EnemyData, riseFrom = 0): ColossusView {
    const formId = colossusOf(data);
    if (!formId) throw new Error(`ColossusSlots.swapIn: ${data.id} has no colossus form`);
    const old = this.slots.get(i);
    const ready = this.art.isReady(formId);
    const form = ready ? this.art.form(formId) : null;
    if (!ready) void this.art.ensure([formId]).then(() => this.upgrade(i, formId));
    const view = new ColossusView(formId, form ?? placeholderForm(), this.art, variantOf(data));
    const ctl = old && old.formId === formId && !old.placeholder && form ? old.ctl : new ColossusPoseController(view.layerInfo);
    if (old) this.layers.colossus.addChildAt(view.root, this.layers.colossus.getChildIndex(old.view.root));
    else this.layers.colossus.addChild(view.root);
    const prev = this.sprites[i];
    if (prev?.parent) prev.parent.addChildAt(view.proxy, prev.parent.getChildIndex(prev));
    else this.layers.actors.addChild(view.proxy);
    if (old) old.view.destroy(); else prev?.destroy({ children: true });
    this.sprites[i] = view.proxy;
    view.setRise(riseFrom);
    this.slots.set(i, { formId, data, view, ctl, placeholder: !form });
    this.poses?.attach(i, ctl, () => this.castKind(i));
    view.apply(ctl.frame());
    return view;
  }

  /** The form's art arrived after a placeholder was drawn: rebuild the view in place (its rise kept). */
  private upgrade(i: number, formId: string): void {
    const s = this.slots.get(i);
    if (this.disposed || !s || s.formId !== formId || !s.placeholder || !this.art.isReady(formId)) return;
    this.swapIn(i, s.data);
  }

  /** The sprites AiEnemyView may pose: a detached stand-in replaces each colossus proxy. */
  atlasSprites(sprites: Container[]): Container[] {
    if (this.slots.size === 0) return sprites;
    return sprites.map((s, i) => {
      if (!this.slots.has(i)) return s;
      let d = this.standIns.get(i);
      if (!d) { d = new Container(); this.standIns.set(i, d); }
      return d;
    });
  }

  /** Apply each colossus's pose (its controller was advanced by the enemy view's poses) and the dying's white fade. */
  update(dt: number): void {
    let overlay = 0;
    for (const s of this.slots.values()) {
      s.view.tick(dt);
      s.view.apply(s.ctl.frame());
      if (s.ctl.gone) s.view.root.visible = false;
      else overlay = Math.max(overlay, s.view.overlay);
    }
    if (overlay > 0 && !this.overlay) {
      this.overlay = new Graphics().rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(0xffffff);
      this.overlay.label = 'colossus.whiteout';
      this.layers.fx.flash.addChild(this.overlay);
    }
    if (this.overlay) {
      this.overlay.alpha = overlay;
      this.overlay.visible = overlay > 0;
    }
  }

  /** The battle's end: destroy every view and release the colossus textures (R27). */
  dispose(): void {
    this.disposed = true;
    for (const [i, s] of this.slots) { this.poses?.detach(i); s.view.destroy(); }
    this.slots.clear();
    this.overlay?.destroy();
    this.overlay = null;
    this.art.release();
  }
}
