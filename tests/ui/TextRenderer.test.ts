import { describe, it, expect } from 'vitest';
import { TextRenderer } from '../../src/ui/TextRenderer.js';

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

  it('handles newlines', () => {
    const tr = new TextRenderer({ width: 200 });
    tr.setText('line1\nline2', true);
    expect(tr.lineCount).toBe(2);
  });
});
