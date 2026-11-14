import { BitmapFont, BitmapText, Container } from 'pixi.js';
import { FONT_SIZE } from '../core/LayoutConstants.js';

/** NES-authentic bitmap font name for use in BitmapText styles */
export const NES_FONT = 'nes-font';

/** Character set covering ASCII printable range + common RPG symbols */
const NES_CHARS: (string | string[])[] = [
  [' ', '~'], // ASCII printable range (space through tilde)
  '▶▲▼←→♥…',
];

/**
 * Installs the NES-style bitmap font for use throughout the game.
 * Call once during game initialization before any text is created.
 */
export function installNESFont(): void {
  BitmapFont.install({
    name: NES_FONT,
    style: {
      fontFamily: 'monospace',
      fontSize: FONT_SIZE,
      fill: 0xffffff,
    },
    chars: NES_CHARS,
    resolution: 1,
    padding: 1,
    skipKerning: true,
    textureStyle: {
      scaleMode: 'nearest',
    },
  });
}

/** The 8 one-step offsets around a glyph; the outline copies sit under the main text at these offsets. */
const OUTLINE_DIRS: readonly [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

export interface OutlinedTextOptions {
  text?: string;
  fontSize?: number;
  fill?: number;
  lineHeight?: number;
  /** Outline colour; undefined draws no outline. */
  outline?: number;
  /** Outline thickness in px (default 2). */
  outlineWidth?: number;
}

/**
 * NES-font text with an optional dark outline drawn as offset shadow copies, not a stroke: the bitmap font is
 * rasterised once at FONT_SIZE, so a stroke would not scale with it, while the copies stay crisp at any size.
 */
export class OutlinedText extends Container {
  readonly main: BitmapText;
  readonly shadows: BitmapText[] = [];

  constructor(opts: OutlinedTextOptions = {}) {
    super();
    const style = (fill: number) => ({
      fontFamily: NES_FONT,
      fontSize: opts.fontSize ?? FONT_SIZE,
      fill,
      ...(opts.lineHeight !== undefined ? { lineHeight: opts.lineHeight } : {}),
    });
    if (opts.outline !== undefined) {
      const w = opts.outlineWidth ?? 2;
      for (const [dx, dy] of OUTLINE_DIRS) {
        const s = new BitmapText({ text: opts.text ?? '', style: style(opts.outline) });
        s.position.set(dx * w, dy * w);
        this.shadows.push(s);
        this.addChild(s);
      }
    }
    this.main = new BitmapText({ text: opts.text ?? '', style: style(opts.fill ?? 0xffffff) });
    this.addChild(this.main);
  }

  get text(): string { return this.main.text; }
  set text(value: string) {
    this.main.text = value;
    for (const s of this.shadows) s.text = value;
  }

  get fontSize(): number { return this.main.style.fontSize; }
}
