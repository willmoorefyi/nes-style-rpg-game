/**
 * The form change on screen (docs/CHAOS_FORMS_PLAN.md 2.3, 2.2 item 7): BattleAnimationController queues an action's
 * `formChange` (TS-B's FormChangeResult on ActionResult) when it presents the action, and when that action completes it
 * waits in `interlude` while this view plays the script from battle-interludes.yaml: messages, flashes, shake, the
 * backdrop tint and fade, the old form's dissolve, the swap (the ColossusView and its proxy, ColossusSlots), the rise,
 * poses, variants and the reveal pan. `battle:formChange {from, to}` is emitted at the swap (BattleTrigger sets
 * SEEN:<to>). A missing script swaps at once. Confirm advances message lines only; a 24-frame confirm hold-off follows.
 *
 * B5 (18.8 row 2c): a round-start line that names an interlude (a non-form phase: chaos_crack on F3's 0.25) plays that
 * script in place of the line (`startLine`, from BattleScene.showMessages); without the script the line's text shows.
 * At an interlude's end the backdrop takes the forms' sky dim (D-O19: set at the end of chaos_i2), and a `tint` step
 * multiplies with the dim in force.
 */
import { Graphics } from 'pixi.js';
import type { ActionResult } from '../../battle/BattleStateMachine.js';
import type { EnemyData } from '../../types/index.js';
import type { InputAction } from '../../core/InputManager.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../../core/LayoutConstants.js';
import { colossusArt } from '../../rendering/ColossusArt.js';
import { interludes as sharedInterludes, type InterludeSource } from '../../data/InterludeRegistry.js';
import type { BattleDisplayManager } from './BattleDisplayManager.js';
import { BATTLE_MESSAGE_FRAMES, holdFrames } from './battleTiming.js';
import { colossusOf, variantOf } from './colossus/colossusIndex.js';
import { greyTint } from './colossus/colossusSprites.js';
import { END_HOLDOFF, type DissolveStyle, type InterludePose, type InterludeStep } from './formInterlude.js';
import { FormInterludePlayer, type InterludeHost } from './FormInterludePlayer.js';

/** TS-B's FormChangeResult (src/battle/bossForms.ts), read structurally. */
export interface FormChange { enemyIndex: number; from: string; to: string; interlude?: string | null; message?: string | null }

export function formChangeOf(result: ActionResult | null | undefined): FormChange | null {
  const fc = result && 'formChange' in result ? (result as { formChange?: unknown }).formChange : null;
  if (!fc || typeof fc !== 'object') return null;
  const f = fc as Partial<FormChange>;
  return typeof f.enemyIndex === 'number' && typeof f.from === 'string' && typeof f.to === 'string' ? (f as FormChange) : null;
}

/** BattleAnimationController's hook (the no-op when a scene has none). */
export interface FormChangeHook {
  /** Note the action's form change (presentAction). */
  queue(result: ActionResult): void;
  /** Start the next queued interlude; false when none is queued. */
  start(): boolean;
  /** One frame of the running interlude; true once it has ended. */
  update(dt: number, confirm: boolean): boolean;
  /** B5: start the script a round-start line names, in place of the line; false (show the text) when it names none or
   *  the script is missing. */
  startLine(line: { text: string }): boolean;
}
export const noopFormChange: FormChangeHook = { queue: () => {}, start: () => false, update: () => true, startLine: () => false };

/** The interlude a battle line names (`BattleMessage.interlude`, TS-B), or null. */
export function lineInterlude(line: { text: string } | null | undefined): string | null {
  const id = line && 'interlude' in line ? (line as { interlude?: unknown }).interlude : null;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export interface FormChangeDeps {
  battle: { readonly allEnemies: readonly { data: EnemyData }[] };
  display: BattleDisplayManager;
  setMessage: (text: string) => void;
  events: { emit(event: 'battle:formChange', data: { from: string; to: string }): void };
  input: { holdOff(frames: number, actions?: readonly InputAction[]): void };
  interludes?: InterludeSource;
  music?: (id: string) => void;
}

const step4 = (a: number): number => Math.round(Math.min(1, Math.max(0, a)) * 4) / 4;
const mix = (color: number, a: number): number => {
  const ch = (shift: number): number => Math.round(255 + (((color >> shift) & 255) - 255) * a) << shift;
  return ch(16) | ch(8) | ch(0);
};
/** Two multiply tints in one (per channel a * b / 255). */
const multiply = (a: number, b: number): number => {
  const ch = (shift: number): number => Math.round((((a >> shift) & 255) * ((b >> shift) & 255)) / 255) << shift;
  return ch(16) | ch(8) | ch(0);
};

export class FormChangeView implements FormChangeHook {
  private readonly pending: FormChange[] = [];
  private player: FormInterludePlayer | null = null;
  private flashG: Graphics | null = null;
  private fadeG: Graphics | null = null;
  private readonly source: InterludeSource;

  constructor(private readonly deps: FormChangeDeps) {
    this.source = deps.interludes ?? sharedInterludes;
    // a battle whose boss names an interlude on a non-form phase (B5) needs the scripts before its first form change
    const named = deps.battle.allEnemies.some((e) => e.data.bossPhases?.some((p) => p.interlude && !p.form));
    if (named && !deps.interludes && typeof document !== 'undefined') void sharedInterludes.load();
  }

  queue(result: ActionResult): void {
    const fc = formChangeOf(result);
    if (!fc) return;
    this.pending.push(fc);
    // the scripts load on the first form change (its result lines cover it); ordinary battles never fetch them
    if (!this.deps.interludes && typeof document !== 'undefined') void sharedInterludes.load();
    // the next form's tiles load during the lines before the swap
    const data = this.deps.battle.allEnemies[fc.enemyIndex]?.data;
    if (data && colossusOf(data)) void colossusArt.ensureFor(data);
  }

  start(): boolean {
    if (this.player) return true;
    const fc = this.pending.shift();
    if (!fc) return false;
    let steps: InterludeStep[] | null = fc.interlude ? this.source.get(fc.interlude) : null;
    if (!steps) {
      if (fc.interlude) console.error(`Form change ${fc.from} -> ${fc.to}: no interlude "${fc.interlude}"; swapping at once`);
      steps = [...(fc.message ? [{ type: 'message', text: fc.message } as const] : []), { type: 'swap' }];
    }
    // a change that keeps the art (F3 -> F4, no swap): the view takes the new form's own rest where it stands (D-U13;
    // the script's pan heaves it there), and the form change is announced now, as no swap will
    if (fc.from !== fc.to && !steps.some((s) => s.type === 'swap')) {
      const data = this.deps.battle.allEnemies[fc.enemyIndex]?.data;
      if (data) this.deps.display.colossus.rest(fc.enemyIndex, data);
      this.deps.events.emit('battle:formChange', { from: fc.from, to: fc.to });
    }
    this.player = new FormInterludePlayer(steps, this.host(fc), holdFrames(BATTLE_MESSAGE_FRAMES));
    return true;
  }

  startLine(line: { text: string }): boolean {
    const id = lineInterlude(line);
    if (!id || this.player) return false;
    const steps = this.source.get(id);
    if (!steps) { console.error(`Battle line "${line.text}": no interlude "${id}"; showing the line`); return false; }
    // the enemy whose phase names it (else the first colossus): its view takes the variant and pose steps
    const enemies = this.deps.battle.allEnemies;
    const named = enemies.findIndex((e) => e.data.bossPhases?.some((p) => p.interlude === id));
    const i = named >= 0 ? named : Math.max(0, enemies.findIndex((e) => colossusOf(e.data)));
    const data = enemies[i]?.data.id ?? '?';
    this.player = new FormInterludePlayer(steps, this.host({ enemyIndex: i, from: data, to: data, interlude: id }), holdFrames(BATTLE_MESSAGE_FRAMES));
    return true;
  }

  update(dt: number, confirm: boolean): boolean {
    if (!this.player) return true;
    if (dt <= 0) return false;
    if (!this.player.update(dt, confirm)) return false;
    this.player = null;
    return true;
  }

  private overlay(which: 'flashG' | 'fadeG', color: number, alpha: number): void {
    let g = this[which];
    if (!g && alpha <= 0) return;
    if (!g) {
      g = this[which] = new Graphics();
      g.label = `interlude.${which === 'flashG' ? 'flash' : 'fade'}`;
      this.deps.display.layers.fx.flash.addChild(g);
    }
    g.clear();
    if (alpha > 0) g.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color, alpha });
  }

  private host(fc: FormChange): InterludeHost {
    const d = this.deps.display;
    const i = fc.enemyIndex;
    const layers = d.layers;
    return {
      message: (text) => this.deps.setMessage(text),
      flash: (color, alpha) => this.overlay('flashG', color, alpha),
      shake: () => layers.shake.start(),
      tint: (color, alpha) => { layers.bg.tint = multiply(alpha > 0 ? mix(color, alpha) : 0xffffff, greyTint(d.colossus.sky)); },
      fade: (alpha) => this.overlay('fadeG', 0x000000, alpha),
      dissolve: (style, u, t) => this.dissolve(style, u, t, i),
      swap: (riseFrom) => {
        const data = this.deps.battle.allEnemies[i]?.data;
        const view = d.colossus.view(i);
        if (data && colossusOf(data) && view && view.artId === colossusOf(data)) {
          d.colossus.rest(i, data);
          for (const [layer, frame] of Object.entries(variantOf(data))) view.setVariant(layer, frame);
        } else if (data && colossusOf(data)) d.colossus.swapIn(i, data, riseFrom);
        else console.error(`Form change ${fc.from} -> ${fc.to}: ${data?.id ?? '?'} has no colossus form; the sprite stays`);
        this.deps.events.emit('battle:formChange', { from: fc.from, to: fc.to });
      },
      rise: (dy) => d.colossus.view(i)?.setRise(dy),
      pose: (name: InterludePose) => {
        const ctl = d.colossus.controller(i);
        if (ctl) ctl.pose(name);
        else if (name === 'hurt') d.enemyView?.poses.playHurt(i);
        else d.enemyView?.poses.playCast(i);
      },
      variant: (layer, frame) => d.colossus.view(i)?.setVariant(layer, frame),
      pan: (x, y) => d.colossus.view(i)?.setPan(x, y),
      music: (id) => this.deps.music?.(id),
      end: () => {
        this.overlay('flashG', 0, 0);
        this.overlay('fadeG', 0, 0);
        d.colossus.settleSky();
        this.deps.input.holdOff(END_HOLDOFF, ['confirm']);
      },
    };
  }

  /** The outgoing form leaves: a colossus view, or the atlas sprite (its pivot sinks it; alpha flickers or fades). */
  private dissolve(style: DissolveStyle, u: number, t: number, i: number): void {
    const view = this.deps.display.colossus.view(i);
    const target = view ? view.root : this.deps.display.enemySprites[i];
    if (!target) return;
    if (style === 'flicker') target.alpha = u >= 1 ? 1 : Math.floor(t / 2) % 2 === 0 ? 0.25 : 1;
    else if (style === 'fade') target.alpha = step4(1 - u);
    else if (view) view.setSink(Math.round(u * 600));   // screen px (rev 3: 200 art px at scale 3)
    else { target.pivot.y = -Math.round(u * target.height); target.alpha = u >= 1 ? 0 : 1; }
  }
}
