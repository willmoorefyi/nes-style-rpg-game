/**
 * Spell, item and ranged-attack effects (docs/FEEDBACK_PLAN_2026-11-14.md §3.4), behind F0's ActionFx hook. `play`
 * picks the action's effect by its ids (never by message text), starts it on every sprite of the target set
 * (staggered 4 frames for all-target actions) in `fx.spell`, and returns the impact frame: the controller presents the
 * number, the glow, the hurt pose and the result line then. Effects advance on the layers' update (so the dev clock
 * steps them) and remove themselves after their last frame.
 */
import type { Container } from 'pixi.js';
import type { ActionResult, NextActionInfo } from '../../../battle/BattleStateMachine.js';
import { SpellRegistry } from '../../../data/SpellRegistry.js';
import { OutlinedText } from '../../../ui/NESFont.js';
import type { BattleLayers } from '../BattleLayers.js';
import { FLOAT_OUTLINE } from '../BattleSceneTypes.js';
import { bodyBox, createEmitter, seededRng, stepAlpha, type Emitter, type FxBox } from './emitters.js';
import { effectIdFor, type FxEffect } from './fxDefs.js';
import { FxBatch, ScreenTint } from './fxRender.js';
import type { FxSource } from './fxSource.js';
import type { ActionFx, ActionFxContext, FxCueId, FxCuePoint } from './index.js';

/** Frames between the starts of an all-target effect on consecutive targets. */
export const FX_STAGGER = 4;
/** Frames from a cue to its effect: the glint shows 4 frames into the raised hold (§3.7), the dust at contact. */
export const CUE_DELAY: Record<FxCueId, number> = { glint: 4, impact_dust: 0 };
const LABEL_FRAMES = 40;
const LABEL_FONT = 32;

interface Running {
  t: number;
  delay: number;
  frames: number;
  emitter: Emitter | null;
  build: () => Emitter;
  batch: FxBatch;
  tint: ScreenTint | null;
}

interface Label { text: OutlinedText; delay: number; age: number }

export class BattleActionFx implements ActionFx {
  private readonly running: Running[] = [];
  private readonly labels: Label[] = [];
  private seed = 1;

  constructor(private readonly layers: BattleLayers, private readonly source: FxSource) {
    layers.onUpdate((dt) => this.update(dt));
  }

  /** The effect for an action, or null (melee, Run, a fizzled spell, no data). */
  effectFor(info: NextActionInfo, result: ActionResult): FxEffect | null {
    const data = this.source.data;
    if (!data || info.silenced) return null;
    const spellId = info.spellId ?? result.spellId;
    const itemId = info.itemId ?? result.itemId;
    const spell = spellId ? SpellRegistry.getSpell(spellId) : undefined;
    const attackEffect = info.actionType === 'fight' && info.actorId.startsWith('enemy_')
      ? (() => { const a = this.source.attackOf(info.actorName); return a?.attack === 'ranged' ? a.attackEffect : undefined; })()
      : undefined;
    const id = effectIdFor(data, { spellId, itemId, spell, attackEffect });
    return id ? data.effects[id] ?? null : null;
  }

  play(info: NextActionInfo, result: ActionResult, ctx: ActionFxContext): number {
    const e = this.effectFor(info, result);
    if (!e || ctx.targets.length === 0) return 0;
    const actor = ctx.actor ? this.box(ctx.actor) : null;
    ctx.targets.forEach((sprite, k) => {
      const id = ctx.targetIds[k];
      const landed = !!e.status && ctx.diff.some((d) => d.id === id && (d.added as readonly string[]).includes(e.status!));
      const delay = k * FX_STAGGER;
      this.start(e, sprite, actor, delay, { landed, flashes: k === 0 ? e.flash ?? 0 : 0 });
      if (e.label) this.addLabel(e.label, e, sprite, delay + e.impact);
    });
    return e.impact + FX_STAGGER * (ctx.targets.length - 1);
  }

  playCue(id: FxCueId, sprite: Container, at?: FxCuePoint): void {
    const e = this.source.data?.effects[id];
    if (e) this.start(e, sprite, null, CUE_DELAY[id], {}, at ? () => this.point(sprite, at) : undefined);
  }

  /** Effects still playing (tests and the leak check). */
  get active(): number { return this.running.length + this.labels.length; }

  private start(e: FxEffect, sprite: Container, actor: FxBox | null, delay: number,
    opts: { landed?: boolean; flashes?: number }, place?: () => FxBox): void {
    const batch = new FxBatch(this.source.atlas);
    this.layers.fx.spell.addChild(batch.container);
    const rng = seededRng(this.seed++);
    // the target's box is measured when its effect starts (a stepping caster or a shaking enemy has settled)
    const build = (): Emitter => createEmitter(e, { geom: { target: place ? place() : this.box(sprite), actor, screenTop: this.screenTop() }, rng,
      frameCount: (k) => this.source.atlas.frameCount(k), landed: opts.landed, flashes: opts.flashes });
    const tint = opts.flashes ? new ScreenTint(this.source.atlas.color(`${e.glyph}.${e.ramp}`)) : null;
    if (tint) this.layers.fx.flash.addChild(tint.g);
    const run: Running = { t: 0, delay, frames: e.frames, emitter: null, build, batch, tint };
    this.running.push(run);
    this.draw(run);
  }

  private addLabel(label: string, e: FxEffect, sprite: Container, delay: number): void {
    const color = this.source.atlas.color(`${e.glyph}.${e.ramp}`);
    const text = new OutlinedText({ text: label, fontSize: LABEL_FONT, fill: color, outline: FLOAT_OUTLINE, outlineWidth: 2 });
    const b = this.box(sprite);
    text.position.set(Math.round(b.x + b.w / 2 - label.length * LABEL_FONT * 0.3), Math.round(b.y + b.h * 0.2));
    text.visible = false;
    this.layers.fx.numbers.addChild(text);
    this.labels.push({ text, delay, age: 0 });
  }

  private update(dt: number): void {
    for (let i = this.running.length - 1; i >= 0; i--) {
      const r = this.running[i];
      if (r.delay > 0) r.delay = Math.max(0, r.delay - dt); else r.t += dt;
      if (r.t >= r.frames) {
        r.batch.destroy();
        r.tint?.destroy();
        this.running.splice(i, 1);
      } else {
        this.draw(r);
      }
    }
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const l = this.labels[i];
      if (l.delay > 0) { l.delay = Math.max(0, l.delay - dt); if (l.delay > 0) continue; }
      l.age += dt;
      l.text.visible = true;
      l.text.y -= dt;
      l.text.alpha = stepAlpha((LABEL_FRAMES - l.age) / 12);
      if (l.age >= LABEL_FRAMES) {
        l.text.parent?.removeChild(l.text);
        l.text.destroy();
        this.labels.splice(i, 1);
      }
    }
  }

  private draw(r: Running): void {
    if (r.delay > 0) { r.batch.render([]); return; }
    r.emitter ??= r.build();
    const frame = r.emitter(Math.floor(r.t));
    r.batch.render(frame.draws);
    r.tint?.set(frame.screen);
  }

  /** The body inside a sprite's bounds (bodyBox), in the effect layer's space. */
  private box(sprite: Container): FxBox {
    const b = sprite.getBounds();
    const tl = this.layers.fx.spell.toLocal({ x: b.x, y: b.y });
    return bodyBox({ x: tl.x, y: tl.y, width: b.width, height: b.height });
  }

  /** A point of a sprite (fractions of its local bounds) as an empty box in the effect layer's space: every anchor of
   *  an empty box is the point itself. */
  private point(sprite: Container, at: FxCuePoint): FxBox {
    const b = sprite.getLocalBounds();
    const p = this.layers.fx.spell.toLocal(sprite.toGlobal({ x: b.x + b.width * at.x, y: b.y + b.height * at.y }));
    return { x: p.x, y: p.y, w: 0, h: 0 };
  }

  private screenTop(): number {
    return this.layers.fx.spell.toLocal({ x: 0, y: 0 }).y;
  }
}
