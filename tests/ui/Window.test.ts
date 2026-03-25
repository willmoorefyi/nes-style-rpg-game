import { describe, it, expect } from 'vitest';
import { Window } from '../../src/ui/Window.js';

describe('Window', () => {
  it('creates with position and size', () => {
    const w = new Window({ x: 10, y: 20, width: 100, height: 80 });
    expect(w.position.x).toBe(10);
    expect(w.position.y).toBe(20);
  });

  it('has content area inset from borders', () => {
    const w = new Window({ x: 0, y: 0, width: 100, height: 80 });
    expect(w.contentX).toBe(24);
    expect(w.contentY).toBe(24);
    expect(w.contentWidth).toBe(52);
    expect(w.contentHeight).toBe(32);
  });

  it('renders border graphics', () => {
    const w = new Window({ x: 0, y: 0, width: 50, height: 40 });
    expect(w.children.length).toBeGreaterThan(0);
  });

  it('can resize', () => {
    const w = new Window({ x: 0, y: 0, width: 100, height: 80 });
    w.resize(200, 160);
    expect(w.contentWidth).toBe(152);
    expect(w.contentHeight).toBe(112);
  });
});
