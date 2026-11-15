import { Container } from 'pixi.js';
import { ScreenShake } from './screenShake.js';

/** The effects layer: overlays and icons (status) < spell effects < flashes < floating numbers. */
export class FxLayer extends Container {
  readonly status = layer('fx.status');
  readonly spell = layer('fx.spell');
  readonly flash = layer('fx.flash');
  readonly numbers = layer('fx.numbers');

  constructor() {
    super();
    this.label = 'fx';
    this.addChild(this.status, this.spell, this.flash, this.numbers);
  }
}

function layer(label: string): Container {
  const c = new Container();
  c.label = label;
  return c;
}

export type LayerUpdater = (dt: number) => void;

const registry = new WeakMap<Container, BattleLayers>();

/**
 * The battle scene's draw order (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 3), as children of the scene's main container:
 * `bg` (backdrop) < `ui` (enemy list, command window, party panel) < `actors` (enemy sprites, then party sprites) <
 * `fx` (status < spell < flash < numbers) < `hud` (the message window and end prompt), so nothing covers the text.
 *
 * `update(dt)` runs once per frame from the scene; effects and followers hook in with `onUpdate`. It also moves
 * `actors` and `fx` (never `ui` or `hud`) by the screen shake (`shake.start()`, the heavy attack's slam).
 */
export class BattleLayers {
  readonly bg = layer('bg');
  readonly ui = layer('ui');
  readonly actors = layer('actors');
  readonly fx = new FxLayer();
  readonly hud = layer('hud');
  readonly shake = new ScreenShake();
  private updaters: LayerUpdater[] = [];

  private constructor(readonly root: Container) {
    root.addChild(this.bg, this.ui, this.actors, this.fx, this.hud);
    registry.set(root, this);
  }

  /** The layers of `root`: the ones already built in it, else new ones appended to it (old callers pass a plain
   *  Container; whatever it already holds stays below the layers). */
  /** The layers whose root holds `c` (walking up its parents), or null. */
  static containing(c: Container): BattleLayers | null {
    for (let p: Container | null = c; p; p = p.parent) {
      const l = registry.get(p);
      if (l && l.bg.parent === p) return l;
    }
    return null;
  }

  static of(root: Container): BattleLayers {
    const existing = registry.get(root);
    if (existing && existing.bg.parent === root) return existing;
    return new BattleLayers(root);
  }

  /** Call `fn(dt)` every frame until the returned function is called. */
  onUpdate(fn: LayerUpdater): () => void {
    this.updaters.push(fn);
    return () => { this.updaters = this.updaters.filter((f) => f !== fn); };
  }

  update(dt: number): void {
    for (const fn of [...this.updaters]) fn(dt);
    const o = this.shake.offset();
    this.actors.position.set(o.x, o.y);
    this.fx.position.set(o.x, o.y);
    this.shake.update(dt);
  }

  /** Drop every update hook (scene exit). */
  clearUpdaters(): void {
    this.updaters = [];
  }
}
