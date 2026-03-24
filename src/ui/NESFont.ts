import { BitmapFont } from 'pixi.js';

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
      fontSize: 8,
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
