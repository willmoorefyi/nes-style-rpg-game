import { BitmapText, Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { HelpWindow } from '../ui/HelpWindow.js';
import { NES_FONT } from '../ui/NESFont.js';
import { FONT_SIZE, GAME_WIDTH, SCREEN_MARGIN, WINDOW_PADDING, MENU_LINE_HEIGHT } from '../core/LayoutConstants.js';
import { getSettings, setAirshipView, setMessageSpeed, isMessageSpeed, type AirshipView, type MessageSpeed } from '../core/Settings.js';
import { RESULT_FRAMES, holdFrames } from './battle/battleTiming.js';
import { setSlowSession } from './exploration/mode7/mode7Toggle.js';

/** Battle-like lines the sample window cycles through, each held as long as a battle result line at the chosen speed. */
export const SAMPLE_LINES = ['FGHTR attacks Goblin!', 'Goblin takes 12 damage.', 'B.MAG casts FIRE!', 'Goblin is defeated.'];

/** "1 2 [3] 4 5": the speed row with the current value bracketed. */
export function speedRow(speed: MessageSpeed): string {
  return [1, 2, 3, 4, 5].map((n) => (n === speed ? `[${n}]` : ` ${n} `)).join('');
}

/** "[Mode 7] Top-down": the airship view row with the current value bracketed (docs/MODE7_PLAN.md 7). */
export function airshipRow(view: AirshipView): string {
  return view === 'mode7' ? '[Mode 7] Top-down ' : ' Mode 7 [Top-down]';
}

const HELP = [
  'Battle message speed: 1 slowest, 5 fastest. Left/Right to change; Z or X to close.',
  'Airship view on the world map: Mode 7 (tilted) or Top-down. Left/Right to change; Z or X to close.',
];

/**
 * Config (pass F item 6, docs/FEEDBACK_PLAN_2026-11-14.md §3.6): the battle message speed, 1 (slowest) to 5. Left /
 * right change it and save it at once (`Settings`, outside the save data); a sample line below shows how long a
 * battle line stays up. Up / down pick the row; the second row is the airship view (Mode 7 or Top-down, M7-2).
 * Confirm or cancel closes the screen.
 */
export class ConfigScene implements Scene {
  readonly container = new Container();
  private readonly speedText: BitmapText;
  private readonly airshipText: BitmapText;
  private readonly sampleText: BitmapText;
  private readonly help: HelpWindow;
  private row = 0;
  private sampleIndex = 0;
  private sampleTimer = 0;
  private closing = false;

  constructor(private readonly game: Game) {
    const width = GAME_WIDTH - 2 * SCREEN_MARGIN;
    const text = (win: Window, y = 0): BitmapText => {
      const t = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
      t.position.set(win.contentX, win.contentY + y);
      win.addChild(t);
      return t;
    };
    const height = 2 * MENU_LINE_HEIGHT + 2 * WINDOW_PADDING;
    const mainHeight = height + MENU_LINE_HEIGHT;
    const main = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width, height: mainHeight });
    text(main).text = 'Config';
    this.speedText = text(main, MENU_LINE_HEIGHT);
    this.airshipText = text(main, 2 * MENU_LINE_HEIGHT);
    this.container.addChild(main);
    const sample = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN + mainHeight + 12, width, height });
    text(sample).text = 'Sample battle text:';
    this.sampleText = text(sample, MENU_LINE_HEIGHT);
    this.container.addChild(sample);
    this.help = new HelpWindow();
    this.container.addChild(this.help);
  }

  enter(): void {
    this.closing = false;
    this.row = 0;
    this.sampleIndex = 0;
    this.sampleTimer = 0;
    this.redraw();
  }

  update(dt: number): void {
    if (this.closing) return;
    const input = this.game.input;
    if (input.isJustPressed('confirm') || input.isJustPressed('cancel')) {
      this.closing = true;
      this.game.scenes.pop().catch((e) => console.error('ConfigScene: pop failed', e));
      return;
    }
    const move = (input.isJustPressed('down') ? 1 : 0) - (input.isJustPressed('up') ? 1 : 0);
    if (move !== 0) {
      this.row = (this.row + move + 2) % 2;
      this.redraw();
      return;
    }
    const step = (input.isJustPressed('right') ? 1 : 0) - (input.isJustPressed('left') ? 1 : 0);
    if (step !== 0 && this.row === 1) {
      setAirshipView(getSettings().airshipView === 'mode7' ? 'topdown' : 'mode7');
      if (getSettings().airshipView === 'mode7') setSlowSession(false);   // re-choosing Mode 7 retries it (M7-6)
      this.redraw();
      return;
    }
    const next = getSettings().messageSpeed + step;
    if (step !== 0 && isMessageSpeed(next)) {
      setMessageSpeed(next);
      this.sampleTimer = 0;    // restart the current sample at the new speed
      this.redraw();
      return;
    }
    this.sampleTimer += dt;
    if (this.sampleTimer >= holdFrames(RESULT_FRAMES)) {
      this.sampleTimer = 0;
      this.sampleIndex = (this.sampleIndex + 1) % SAMPLE_LINES.length;
      this.redraw();
    }
  }

  /** The speed row and the sample line as they are now. */
  get speedLine(): string { return this.speedText.text; }
  get airshipLine(): string { return this.airshipText.text; }
  get helpLine(): string { return HELP[this.row]; }
  get sampleLine(): string { return this.sampleText.text; }

  private redraw(): void {
    const mark = (r: number): string => (r === this.row ? '>' : ' ');
    this.speedText.text = `${mark(0)}Message speed  ${speedRow(getSettings().messageSpeed)}`;
    this.airshipText.text = `${mark(1)}Airship view   ${airshipRow(getSettings().airshipView)}`;
    this.help.setText(HELP[this.row]);
    this.sampleText.text = SAMPLE_LINES[this.sampleIndex];
  }

  onPause(): void {}
  onResume(): void {}
  exit(): void {}
}
