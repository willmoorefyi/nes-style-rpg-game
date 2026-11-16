/**
 * A colossus form on screen (docs/CHAOS_FORMS_PLAN.md 4.1-4.4; rev 4: 18.3, 18.5): its art layers in canvas order,
 * placed by the json `place`, never by the enemy layout engine. The painted forms draw at scale 1 with linear filtering
 * (ColossusArt); a frame stored at reduced resolution (`texScale`, the glow at 2) is drawn at its texScale. Each layer's
 * blend (`add` for the glow and corona) and rest alpha come from the json. The canvas moves sub-pixel (the breathing,
 * the slam, the pan, the rise, the sink; screen px); the hurt shake is whole screen px. The hurt flash is an additive
 * copy of each normal layer's own tiles (same texture, white tint, alpha 0.6): no filter, no composite render (R15).
 * The invisible proxy at the target rect stands in for "the enemy sprite" (colossusProxy.ts).
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { ColossusPoseFrame, LayerInfo } from './colossusChoreography.js';
import { canvasRect, screenAnchors, targetRectOnScreen, type ColossusFormSpec, type ColossusLayerSpec, type Offset } from './colossusIndex.js';
import { EFFECT_BOX, SLASH_BOX, registerProxy, unregisterProxy, type ColossusAnchorSource, type Rect } from './colossusProxy.js';

/** Where the view's textures come from (ColossusArt; tests a fixture). */
export interface ColossusTextureSource {
  texture(file: string): Texture | null;
}

const PLACEHOLDER_COLOR = 0x553366;
/** Frames the routed element flash keeps every layer lit. */
const FLASH_FRAMES = 4;
/** The hurt flash: an additive copy of the layer's tiles at this alpha (18.3). */
export const FLASH_ALPHA = 0.6;
/** The effect box's top row (the number band's top, NUMBER_Y). */
const EFFECT_TOP = 140;

interface LayerNode {
  spec: ColossusLayerSpec;
  node: Container;
  frames: Map<string, Container>;
  /** Each frame's additive flash copies (hidden unless the layer flashes). */
  flashes: Map<string, Sprite[]>;
  current: string;
}

export class ColossusView implements ColossusAnchorSource {
  readonly root = new Container();
  /** The form's layers, screen px (scaled by the form's scale). */
  readonly art = new Container();
  /** Never drawn; measured: its box is the target rect (R15). */
  readonly proxy = new Container();
  readonly layerInfo: LayerInfo[];
  private readonly behind = new Container();
  private readonly main = new Container();
  private readonly front = new Container();
  private readonly nodes = new Map<string, LayerNode>();
  private readonly variants: Record<string, string>;
  private pan: Offset = { x: 0, y: 0 };
  private rise = 0;
  private sink = 0;
  /** The dying timeline's own sink (screen px), on top of a dissolve's. */
  private poseSink = 0;
  private bob = 0;
  private shake: Offset = { x: 0, y: 0 };
  private flashLeft = 0;
  private whiteNow = false;
  /** The dying's white fade (ColossusSlots draws it over the battle). */
  overlay = 0;

  constructor(readonly formId: string, readonly form: ColossusFormSpec, private readonly src: ColossusTextureSource,
    variant: Record<string, string> = {}) {
    this.variants = { ...variant };
    this.root.label = `colossus.${formId}`;
    this.art.label = 'colossus.art';
    this.art.addChild(this.behind, this.main, this.front);
    this.root.addChild(this.art);
    this.art.scale.set(form.scale);
    for (const spec of form.layers) this.addLayer(spec);
    this.layerInfo = form.layers.map((l) => ({ name: l.name, kind: l.kind, frames: Object.keys(l.frames),
      ...(l.orbit ? { orbit: l.orbit } : {}), ...(l.alpha !== undefined ? { alpha: l.alpha } : {}) }));
    const r = targetRectOnScreen(form);
    const box = new Graphics().rect(0, 0, r.width, r.height).fill(0xffffff);
    box.renderable = false;
    this.proxy.label = 'colossus.proxy';
    this.proxy.addChild(box);
    registerProxy(this.proxy, this);
    this.place();
  }

  private addLayer(spec: ColossusLayerSpec): void {
    const node = new Container();
    node.label = `colossus.layer.${spec.name}`;
    const add = spec.blend === 'add';
    node.blendMode = add ? 'add' : 'normal';
    const entry: LayerNode = { spec, node, frames: new Map(), flashes: new Map(), current: '' };
    for (const [name, fr] of Object.entries(spec.frames)) {
      const c = new Container();
      c.position.set(fr.at[0], fr.at[1]);
      c.scale.set(fr.texScale ?? 1);
      const flashes: Sprite[] = [];
      for (const t of fr.tiles) {
        const tex = this.src.texture(t.file);
        if (!tex) { c.addChild(new Graphics().rect(t.x, t.y, t.w, t.h).fill(PLACEHOLDER_COLOR)); continue; }
        const s = new Sprite(tex);
        s.position.set(t.x, t.y);
        s.blendMode = add ? 'add' : 'normal';
        c.addChild(s);
        if (add) continue;
        const flash = new Sprite(tex);
        flash.label = 'colossus.flash';
        flash.position.set(t.x, t.y);
        flash.blendMode = 'add';
        flash.tint = 0xffffff;
        flash.alpha = FLASH_ALPHA;
        flash.visible = false;
        c.addChild(flash);
        flashes.push(flash);
      }
      // an empty body frame is missing art (the placeholder box); an empty variant base (the core) draws nothing
      if (fr.tiles.length === 0 && spec.kind === 'body') c.addChild(new Graphics().rect(0, 0, fr.size[0], fr.size[1]).fill(PLACEHOLDER_COLOR));
      c.visible = false;
      node.addChild(c);
      entry.frames.set(name, c);
      entry.flashes.set(name, flashes);
    }
    (spec.kind === 'moon' ? this.front : this.main).addChild(node);
    this.nodes.set(spec.name, entry);
    this.show(entry, this.variants[spec.name] ?? 'base');
  }

  private show(e: LayerNode, frame: string): void {
    const name = e.frames.has(frame) ? frame : 'base';
    if (name === e.current) return;
    const old = e.frames.get(e.current);
    if (old) old.visible = false;
    e.frames.get(name)!.visible = true;
    e.current = name;
  }

  /** The canvas offset from rest without the shake or the breathing (pan, rise, sink), screen px. */
  private restOffset(): Offset {
    return { x: this.pan.x, y: this.pan.y + this.rise + this.sink + this.poseSink };
  }

  /** Where the art canvas is now relative to its rest place, screen px (shake and breathing included). */
  canvasOffset(): Offset {
    const r = this.restOffset();
    return { x: r.x + this.shake.x, y: r.y + this.bob + this.shake.y };
  }

  private place(): void {
    const o = this.canvasOffset();
    this.art.position.set(this.form.place[0] + o.x, this.form.place[1] + o.y);
    const t = targetRectOnScreen(this.form, this.restOffset());
    this.proxy.position.set(t.x, t.y);
  }

  /** Apply one timeline frame (ColossusPoseController.frame). */
  apply(f: ColossusPoseFrame): void {
    this.bob = f.bob;
    this.poseSink = f.sink;
    this.shake = { x: f.dx, y: f.dy };
    this.overlay = f.overlay;
    this.whiteNow = false;
    this.form.layers.forEach((spec, i) => {
      const e = this.nodes.get(spec.name)!;
      const p = f.layers[i];
      if (!p) return;
      this.show(e, p.frame === 'base' ? this.variants[spec.name] ?? 'base' : p.frame);
      e.node.position.set(p.dx, p.dy);
      e.node.alpha = p.alpha;
      const white = (p.white || this.flashLeft > 0) && spec.blend !== 'add';
      this.whiteNow ||= white;
      for (const [name, list] of e.flashes) for (const s of list) s.visible = white && name === e.current;
      if (spec.kind === 'moon') {
        const want = p.behind ? this.behind : this.front;
        if (e.node.parent !== want) want.addChild(e.node);
      }
    });
    this.place();
  }

  /** Advance the view's own clocks (the routed element flash). */
  tick(dt: number): void {
    if (this.flashLeft > 0) this.flashLeft = Math.max(0, this.flashLeft - dt);
  }

  flashWhite(): void { this.flashLeft = FLASH_FRAMES; }
  get flashing(): boolean { return this.flashLeft > 0 || this.whiteNow; }

  /** The reveal pan's offset from rest (screen px). */
  setPan(x: number, y: number): void { this.pan = { x, y }; this.place(); }
  /** Below its rest (or the pan's offset) by `dy` screen px (the rise). */
  setRise(dy: number): void { this.rise = dy; this.place(); }
  /** Sunk by `dy` screen px (a dissolve `sink`). */
  setSink(dy: number): void { this.sink = dy; this.place(); }
  /** The `variant` step: one layer shows a named frame from now on (F3's crack, F4's open core). */
  setVariant(layer: string, frame: string): void {
    this.variants[layer] = frame;
    const e = this.nodes.get(layer);
    if (e) this.show(e, frame);
  }

  frameOf(layer: string): string | null { return this.nodes.get(layer)?.current ?? null; }
  layerNode(name: string): Container | null { return this.nodes.get(name)?.node ?? null; }

  anchors(): ReturnType<ColossusAnchorSource['anchors']> { return screenAnchors(this.form, this.restOffset()); }
  targetBox(): Rect { return targetRectOnScreen(this.form, this.restOffset()); }

  /** The spell-effect box, centred on `core` and kept below the message window (y >= 140; F3's core is at y 300). */
  effectBox(): Rect {
    const c = this.anchors().core;
    return { x: c.x - EFFECT_BOX.w / 2, y: Math.max(EFFECT_TOP, c.y - EFFECT_BOX.h / 2), width: EFFECT_BOX.w, height: EFFECT_BOX.h };
  }

  slashBox(): Rect {
    const m = this.anchors().melee;
    return { x: m.x - SLASH_BOX / 2, y: m.y - SLASH_BOX / 2, width: SLASH_BOX, height: SLASH_BOX };
  }

  /** The canvas rect on screen now (tests, the bestiary crop). */
  canvas(): { x: number; y: number; w: number; h: number } { return canvasRect(this.form, this.canvasOffset()); }

  /** Remove and destroy the containers (the textures belong to ColossusArt). */
  destroy(): void {
    unregisterProxy(this.proxy);
    this.proxy.parent?.removeChild(this.proxy);
    this.proxy.destroy({ children: true });
    this.root.parent?.removeChild(this.root);
    this.root.destroy({ children: true });
  }
}
