/**
 * Status overlays, icons and tints on both sides (docs/FEEDBACK_PLAN_2026-11-14.md §3.5), behind F0's StatusFx hook.
 *
 * What shows is the presented snapshot (`display.presented`), never the live tracker: `sync` runs from presentAction
 * after the snapshot is taken, so a SLEP's zZz appears at the spell's impact frame and a cure starts the 12-frame fade
 * at the cleanse impact. Each actor has one FxBatch in `fx.status` (below spells, flashes and numbers). It follows the
 * sprite every frame (position from the bounds, alpha = base x sprite alpha, hidden with the sprite) and is destroyed
 * once a dead enemy's sprite is hidden. Tints go through actorTint's `status` source (multiplied, never overwriting
 * the hero pulse or the heavy-attack pulse). Overlays advance on the layers' update, so the dev step clock steps them.
 */
import { Graphics, Sprite, type Container } from 'pixi.js';
import type { BattleLayers } from '../BattleLayers.js';
import { setTint, tintOf } from '../actorTint.js';
import type { PresentedState } from '../presentedState.js';
import { stepAlpha, type FxBox, type FxDraw } from './emitterCore.js';
import type { FxAtlas } from './fxAtlas.js';
import { FxBatch } from './fxRender.js';
import { STATUS_OVERLAYS, type StatusAnchor } from './statusEmitters.js';
import { COLOSSUS_PLATE, ICON_GAP, ICON_LIFT, ICON_PX, colossusRow, iconDraws } from './statusIcons.js';
import { iconsFor, shownOn, statusTint, type StatusVisuals } from './statusRules.js';
import { stoneTextures } from './stoneTextures.js';
import { headOf } from './texturePixels.js';
import type { StatusFx } from './index.js';
import { colossusAt, colossusStatusAnchor } from '../colossus/colossusProxy.js';
import { heroBounds } from '../heroBody.js';

/** Frames an overlay takes to fade out after its status ends. */
export const STATUS_FADE_FRAMES = 12;
/** Screen px from a hero's head to its first icon (the icons sit behind the head). */
const PARTY_ICON_DX = 28;

/** What the overlays read from the battle display. */
export interface StatusFxDisplay {
  readonly enemySprites: readonly Container[];
  readonly partySprites: readonly Container[];
  readonly presented: PresentedState;
}

interface Overlay { t: number; fade: number | null }
interface ActorFx {
  side: 'party' | 'enemy';
  index: number;
  overlays: Map<string, Overlay>;
  icons: string[];
  batch: FxBatch;
  sprite: Container | null;
  /** A colossus's dark icon plate (C6-6), drawn below the batch's sprites. */
  plate: Graphics | null;
}

export class BattleStatusFx implements StatusFx {
  private readonly actors = new Map<string, ActorFx>();
  private clock = 0;

  constructor(
    private readonly layers: BattleLayers,
    private readonly display: StatusFxDisplay,
    private readonly atlas: FxAtlas,
    private readonly visuals: () => StatusVisuals,
  ) {
    layers.onUpdate((dt) => this.update(dt));
    // follow the sprites after everything moved them this frame (lunge, travel, step-in, shake), just before drawing
    layers.fx.status.onRender = () => this.draw();
  }

  sync(): void {
    this.reconcile();
    this.draw();
  }

  update(dt: number): void {
    this.clock += dt;
    for (const a of this.actors.values()) {
      for (const [name, o] of a.overlays) {
        o.t += dt;
        if (o.fade !== null) {
          o.fade -= dt;
          if (o.fade <= 0) a.overlays.delete(name);
        }
      }
    }
    this.reconcile();
    this.draw();
  }

  /** Overlays running (fading ones included) and actors with a batch (tests and the leak check). */
  get active(): { overlays: number; actors: number } {
    let overlays = 0;
    for (const a of this.actors.values()) overlays += a.overlays.size;
    return { overlays, actors: this.actors.size };
  }

  /** The overlay names on an actor (`enemy_0`), fading ones included. */
  overlaysOn(id: string): string[] {
    return [...(this.actors.get(id)?.overlays.keys() ?? [])];
  }

  /** The icons shown on an actor, in order. */
  iconsOn(id: string): string[] {
    return [...(this.actors.get(id)?.icons ?? [])];
  }

  /** The actor's overlay container (tests: alpha and visibility follow the sprite). */
  containerOf(id: string): Container | null {
    return this.actors.get(id)?.batch.container ?? null;
  }

  private reconcile(): void {
    const visuals = this.visuals();
    const sides = [['enemy', this.display.enemySprites, this.display.presented.enemies],
      ['party', this.display.partySprites, this.display.presented.party]] as const;
    for (const [side, sprites, presented] of sides) {
      presented.forEach((p, index) => {
        const id = `${side}_${index}`;
        const sprite = sprites[index] ?? null;
        // a dead enemy's overlays fade with its sprite and go when it is hidden; a KO'd hero's fade out
        if (side === 'enemy' && p.hp <= 0 && sprite && !sprite.visible) { this.drop(id); return; }
        const shown = side === 'party' && p.hp <= 0 ? [] : shownOn(side, p.statuses, visuals);
        const a = this.actor(id, side, index);
        if (a.sprite !== sprite) {
          if (a.sprite) setTint(a.sprite, 'status', null);
          a.sprite = sprite;
        }
        for (const s of shown) {
          const name = visuals[s]?.overlay;
          if (!name || !STATUS_OVERLAYS[name]) continue;
          const o = a.overlays.get(name);
          if (!o) a.overlays.set(name, { t: 0, fade: null });
          else o.fade = null;
        }
        const live = new Set(shown.map((s) => visuals[s]?.overlay));
        for (const [name, o] of a.overlays) if (!live.has(name) && o.fade === null) o.fade = STATUS_FADE_FRAMES;
        a.icons = iconsFor(shown, visuals);
        if (sprite) {
          const tint = statusTint(shown, visuals, this.clock);
          if (tintOf(sprite, 'status') !== tint) setTint(sprite, 'status', tint);
        }
      });
    }
  }

  private actor(id: string, side: 'party' | 'enemy', index: number): ActorFx {
    let a = this.actors.get(id);
    if (!a) {
      const batch = new FxBatch(this.atlas);
      batch.container.label = `fx.status.${id}`;
      this.layers.fx.status.addChild(batch.container);
      a = { side, index, overlays: new Map(), icons: [], batch, sprite: null, plate: null };
      this.actors.set(id, a);
    }
    return a;
  }

  private drop(id: string): void {
    const a = this.actors.get(id);
    if (!a) return;
    if (a.sprite) setTint(a.sprite, 'status', null);
    a.batch.destroy();
    this.actors.delete(id);
  }

  private draw(): void {
    for (const a of this.actors.values()) {
      const sprite = a.sprite;
      const c = a.batch.container;
      if (!sprite || (a.overlays.size === 0 && a.icons.length === 0)) { a.batch.render([]); this.plate(a, null); continue; }
      c.visible = sprite.visible && sprite.alpha > 0;
      c.alpha = sprite.alpha;
      if (!c.visible) continue;
      const anchor = this.anchorOf(sprite, a.side);
      const draws: FxDraw[] = [];
      for (const [name, o] of a.overlays) {
        const k = o.fade === null ? 1 : stepAlpha(o.fade / STATUS_FADE_FRAMES);
        for (const d of STATUS_OVERLAYS[name](Math.floor(o.t), anchor)) draws.push({ ...d, alpha: stepAlpha(d.alpha * k) });
      }
      // enemies: a row above the head; party: a row behind the head (the slots overlap diagonally, so a row above
      // would sit on the member in front, and the active-hero arrow is above)
      const row = a.icons.length * ICON_PX + (a.icons.length - 1) * ICON_GAP;
      const plated = a.side === 'enemy' && colossusAt(sprite) && a.icons.length > 0 ? colossusRow(a.icons, anchor.head.x, anchor.head.y) : null;
      this.plate(a, plated?.plate ?? null);
      if (plated) draws.push(...plated.draws);
      else if (a.side === 'party') draws.push(...iconDraws(a.icons, anchor.head.x + PARTY_ICON_DX + row / 2, anchor.head.y + ICON_PX + ICON_LIFT));
      else draws.push(...iconDraws(a.icons, anchor.head.x, anchor.head.y - ICON_LIFT));
      a.batch.render(draws);
    }
  }

  /** Show (or hide, `r` null) the colossus icon plate under the actor's glyphs. */
  private plate(a: ActorFx, r: { x: number; y: number; w: number; h: number } | null): void {
    if (!r) { if (a.plate) a.plate.visible = false; return; }
    if (!a.plate) {
      a.plate = new Graphics();
      a.plate.label = 'fx.status.plate';
      a.batch.container.addChildAt(a.plate, 0);
    }
    a.plate.clear().rect(r.x, r.y, r.w, r.h).fill({ color: COLOSSUS_PLATE.color, alpha: COLOSSUS_PLATE.alpha });
    a.plate.visible = true;
  }

  /** The head (the frame's topmost opaque row, else the body box's top-centre) and the body box, in fx.status space. */
  private anchorOf(sprite: Container, side: 'party' | 'enemy'): StatusAnchor {
    const c = colossusAt(sprite);
    if (c) return colossusStatusAnchor(c);           // the head anchor's row, inside y 140-760 (CHAOS_FORMS_PLAN 4.4)
    const b = heroBounds(sprite);                   // pass CL: an oversize hero's body box (its head: the known head)
    const tl = this.layers.fx.status.toLocal({ x: b.x, y: b.y });
    const box: FxBox = { x: tl.x + b.width * 0.15, y: tl.y + b.height * 0.33, w: b.width * 0.7, h: b.height * 0.62 };
    const h = sprite instanceof Sprite ? headOf(stoneTextures.coloured(sprite.texture)) : null;
    const head = h ? this.toLocal(sprite, h.x, h.y) : { x: box.x + box.w / 2, y: box.y };
    return { head, box, facing: side === 'enemy' ? 1 : -1 };
  }

  private toLocal(sprite: Container, x: number, y: number): { x: number; y: number } {
    return this.layers.fx.status.toLocal(sprite.toGlobal({ x, y }));
  }
}
