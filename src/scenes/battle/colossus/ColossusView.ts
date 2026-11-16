/**
 * A colossus form on screen (docs/CHAOS_FORMS_PLAN.md 4.1-4.4): its art layers (native art px, scaled by the form's
 * integer scale on the GPU, nearest), the rim's floor front over them, then the `over` layers (the hand gripping the
 * rim). Placed by the json `place`, never by the enemy layout engine. Every move is whole art px (layers, pan, rise,
 * sink, bob) or whole screen px (the hurt shake). The invisible proxy at the target rect stands in for "the enemy
 * sprite" (colossusProxy.ts); the hurt flash swaps each tile to its white silhouette (no composite render, R15).
 */
import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { ColossusPoseFrame, LayerInfo } from './colossusChoreography.js';
import { canvasRect, screenAnchors, targetRectOnScreen, type ColossusFormSpec, type ColossusLayerSpec, type Offset } from './colossusIndex.js';
import { EFFECT_BOX, SLASH_BOX, registerProxy, unregisterProxy, type ColossusAnchorSource, type Rect } from './colossusProxy.js';

/** Where the view's textures come from (ColossusArt; tests a fixture). */
export interface ColossusTextureSource {
  texture(file: string): Texture | null;
  whiteOf(t: Texture): Texture;
}

const PLACEHOLDER_COLOR = 0x553366;
/** Frames the routed element flash keeps every layer white. */
const FLASH_FRAMES = 4;

interface LayerNode {
  spec: ColossusLayerSpec;
  node: Container;
  frames: Map<string, Container>;
  /** Each frame's tile sprites and their own textures (the white flash swaps and restores them). */
  tiles: Map<string, { sprite: Sprite; base: Texture }[]>;
  current: string;
}

export class ColossusView implements ColossusAnchorSource {
  readonly root = new Container();
  /** The form's layers below the floor (scaled), then the floor front (screen px), then the `over` layers. */
  readonly art = new Container();
  readonly floorFront = new Container();
  readonly over = new Container();
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
  /** The dying timeline's own sink (art px), on top of a dissolve's. */
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
    this.floorFront.label = 'colossus.floorFront';
    this.over.label = 'colossus.over';
    this.art.addChild(this.behind, this.main, this.front);
    this.root.addChild(this.art, this.floorFront, this.over);
    for (const c of [this.art, this.over]) c.scale.set(form.scale);
    for (const spec of form.layers) this.addLayer(spec);
    this.layerInfo = form.layers.map((l) => ({ name: l.name, kind: l.kind, frames: Object.keys(l.frames), ...(l.orbit ? { orbit: l.orbit } : {}) }));
    this.buildFloor();
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
    const entry: LayerNode = { spec, node, frames: new Map(), tiles: new Map(), current: '' };
    for (const [name, fr] of Object.entries(spec.frames)) {
      const c = new Container();
      c.position.set(fr.at[0], fr.at[1]);
      const tiles: { sprite: Sprite; base: Texture }[] = [];
      for (const t of fr.tiles) {
        const tex = this.src.texture(t.file);
        if (tex) {
          const s = new Sprite(tex);
          s.position.set(t.x, t.y);
          c.addChild(s);
          tiles.push({ sprite: s, base: tex });
        } else {
          c.addChild(new Graphics().rect(t.x, t.y, t.w, t.h).fill(PLACEHOLDER_COLOR));
        }
      }
      if (fr.tiles.length === 0) c.addChild(new Graphics().rect(0, 0, fr.size[0], fr.size[1]).fill(PLACEHOLDER_COLOR));
      c.visible = false;
      node.addChild(c);
      entry.frames.set(name, c);
      entry.tiles.set(name, tiles);
    }
    (spec.over ? this.over : spec.kind === 'moon' ? this.front : this.main).addChild(node);
    this.nodes.set(spec.name, entry);
    this.show(entry, this.variants[spec.name] ?? 'base');
  }

  private buildFloor(): void {
    const f = this.form.floor;
    const tex = f ? this.src.texture(f.file) : null;
    if (!f || !tex) return;
    const s = new Sprite(tex);
    s.position.set(f.x, f.y);
    this.floorFront.addChild(s);
  }

  private show(e: LayerNode, frame: string): void {
    const name = e.frames.has(frame) ? frame : 'base';
    if (name === e.current) return;
    const old = e.frames.get(e.current);
    if (old) old.visible = false;
    e.frames.get(name)!.visible = true;
    e.current = name;
  }

  /** The canvas offset from rest without the shake or bob (pan, rise, sink), screen px. */
  private restOffset(): Offset {
    const s = this.form.scale;
    return { x: this.pan.x * s, y: (this.pan.y + this.rise + this.sink + this.poseSink) * s };
  }

  /** Where the art canvas is now relative to its rest place, screen px (shake and bob included). */
  canvasOffset(): Offset {
    const r = this.restOffset();
    return { x: r.x + this.shake.x, y: r.y + this.bob * this.form.scale + this.shake.y };
  }

  private place(): void {
    const r = this.restOffset();
    const [px, py] = this.form.place;
    this.art.position.set(px + r.x + this.shake.x, py + r.y + this.bob * this.form.scale + this.shake.y);
    this.over.position.set(px + r.x + this.shake.x, py + r.y + this.shake.y);
    const t = targetRectOnScreen(this.form, r);
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
      const white = p.white || this.flashLeft > 0;
      this.whiteNow ||= white;
      for (const { sprite, base } of e.tiles.get(e.current) ?? []) sprite.texture = white ? this.src.whiteOf(base) : base;
      if (spec.kind === 'moon' && !spec.over) {
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

  /** The reveal pan's offset from rest (art px). */
  setPan(x: number, y: number): void { this.pan = { x: Math.round(x), y: Math.round(y) }; this.place(); }
  /** Below its rest by `dy` art px (the rise from behind the horizon). */
  setRise(dy: number): void { this.rise = Math.round(dy); this.place(); }
  /** Sunk by `dy` art px (a dissolve `sink`). */
  setSink(dy: number): void { this.sink = Math.round(dy); this.place(); }
  /** The `variant` step: one layer shows a named frame from now on (F4's open core). */
  setVariant(layer: string, frame: string): void {
    this.variants[layer] = frame;
    const e = this.nodes.get(layer);
    if (e) this.show(e, frame);
  }

  frameOf(layer: string): string | null { return this.nodes.get(layer)?.current ?? null; }
  layerNode(name: string): Container | null { return this.nodes.get(name)?.node ?? null; }

  /** The screen row the gripping hand meets the rim on (`rimRow`), now. */
  rimY(): number {
    return this.form.place[1] + this.restOffset().y + (this.form.rimRow ?? 0) * this.form.scale;
  }

  anchors(): ReturnType<ColossusAnchorSource['anchors']> { return screenAnchors(this.form, this.restOffset()); }
  targetBox(): Rect { return targetRectOnScreen(this.form, this.restOffset()); }

  effectBox(): Rect {
    const c = this.anchors().core;
    return { x: c.x - EFFECT_BOX.w / 2, y: c.y - EFFECT_BOX.h / 2, width: EFFECT_BOX.w, height: EFFECT_BOX.h };
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
