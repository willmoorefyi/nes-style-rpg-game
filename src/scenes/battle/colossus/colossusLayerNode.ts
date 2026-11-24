/**
 * One colossus layer's display nodes (split from ColossusView.ts): a container per frame with its tiles (a placeholder
 * box per missing texture), and for a normal layer an additive white copy of each tile for the hurt flash (18.3). An
 * orb layer (EF-E) sits in a slot container that holds its place in the yaml order while it is on the near half of its
 * ring; ColossusView moves it into the far container (behind the body) and back.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { ColossusLayerSpec } from './colossusIndex.js';
import { isOrbLayer } from './colossusOrbits.js';

/** Where the view's textures come from (ColossusArt; tests a fixture). */
export interface ColossusTextureSource {
  texture(file: string): Texture | null;
}

const PLACEHOLDER_COLOR = 0x553366;
/** The hurt flash: an additive copy of the layer's tiles at this alpha (18.3). */
export const FLASH_ALPHA = 0.6;

export interface LayerNode {
  spec: ColossusLayerSpec;
  node: Container;
  frames: Map<string, Container>;
  /** Each frame's additive flash copies (hidden unless the layer flashes). */
  flashes: Map<string, Sprite[]>;
  current: string;
  /** An orb's place in the main container (yaml order) while it is on the near half of its ring. */
  slot?: Container;
}

/** The layer's nodes, every frame hidden (ColossusView shows one). */
export function buildLayerNode(spec: ColossusLayerSpec, src: ColossusTextureSource): LayerNode {
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
      const tex = src.texture(t.file);
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
  if (isOrbLayer(spec)) {
    entry.slot = new Container();
    entry.slot.label = `colossus.slot.${spec.name}`;
    entry.slot.addChild(node);
  }
  return entry;
}
