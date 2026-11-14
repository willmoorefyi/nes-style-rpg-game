import { describe, it, expect } from 'vitest';
import { TextRenderer } from '../../src/ui/TextRenderer.js';
import { OutlinedText } from '../../src/ui/NESFont.js';
import { CHAR_WIDTH, FONT_SIZE } from '../../src/core/LayoutConstants.js';

describe('TextRenderer', () => {
  it('wraps text within width', () => {
    const tr = new TextRenderer({ width: 80, charWidth: 8 }); // 10 chars
    tr.setText('hello world test', true);
    expect(tr.lineCount).toBeGreaterThan(1);
  });

  it('displays instantly when revealSpeed is 0', () => {
    const tr = new TextRenderer({ width: 200, revealSpeed: 0 });
    tr.setText('test');
    expect(tr.isComplete()).toBe(true);
  });

  it('reveals characters over time', () => {
    const tr = new TextRenderer({ width: 200, revealSpeed: 2 });
    tr.setText('hello');
    expect(tr.isComplete()).toBe(false);
    tr.update(1);
    tr.update(1);
    tr.update(1);
    expect(tr.isComplete()).toBe(true);
  });

  it('can complete instantly', () => {
    const tr = new TextRenderer({ width: 200, revealSpeed: 1 });
    tr.setText('hello world');
    expect(tr.isComplete()).toBe(false);
    tr.complete();
    expect(tr.isComplete()).toBe(true);
  });

  it('a bigger fontSize wraps by the char width measured at that size (T6e)', () => {
    const width = 40 * CHAR_WIDTH;
    expect(new TextRenderer({ width }).maxChars).toBe(40);
    const big = new TextRenderer({ width, fontSize: 32 });
    expect(big.fontSize).toBe(32);
    expect(big.maxChars).toBe(Math.floor(width / (CHAR_WIDTH * 32 / FONT_SIZE)));
    expect(big.maxChars).toBeLessThan(40);
  });

  it('an outline is drawn as 8 offset shadow copies of the text (T6e)', () => {
    const tr = new TextRenderer({ width: 400, fontSize: 32, lineHeight: 36, style: { outline: 0x000000 } });
    tr.setText('Hello', true);
    const text = tr.children[0] as OutlinedText;
    expect(text).toBeInstanceOf(OutlinedText);
    expect(text.shadows).toHaveLength(8);
    expect(text.shadows.every(s => s.text === 'Hello')).toBe(true);
    expect(new Set(text.shadows.map(s => `${s.x},${s.y}`)).size).toBe(8);
    expect(text.main.style.lineHeight).toBe(36);
    expect((new TextRenderer({ width: 400 }).children[0] as OutlinedText).shadows).toHaveLength(0);
  });

  it('handles newlines', () => {
    const tr = new TextRenderer({ width: 200 });
    tr.setText('line1\nline2', true);
    expect(tr.lineCount).toBe(2);
  });
});
