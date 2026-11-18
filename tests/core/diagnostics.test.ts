import { describe, it, expect, vi } from 'vitest';
import { Container } from 'pixi.js';
import {
  CONTEXT_LOST_TEXT, CONTEXT_STUCK_TEXT, TraceLog, traceEnabled, traceWindow, watchContext, type Overlay,
} from '../../src/core/diagnostics.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import type { Scene } from '../../src/types/index.js';

class Target {
  private handlers = new Map<string, Array<(e: unknown) => void>>();
  addEventListener(type: string, fn: (e: never) => void): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn as (e: unknown) => void]);
  }
  fire(type: string, e: unknown = {}): void { for (const h of this.handlers.get(type) ?? []) h(e); }
}

function overlay(): Overlay & { shown: string[]; hidden: number } {
  const o = { shown: [] as string[], hidden: 0, show(m: string) { o.shown.push(m); }, hide() { o.hidden++; } };
  return o;
}

describe('trace flag', () => {
  it('is off by default and on only with ?trace=1 or the storage key', () => {
    expect(traceEnabled('', null)).toBe(false);
    expect(traceEnabled('?mute=1', { getItem: () => null })).toBe(false);
    expect(traceEnabled('?mute=1&trace=1', null)).toBe(true);
    expect(traceEnabled('?trace=1', null)).toBe(true);
    expect(traceEnabled('?trace=10', null)).toBe(false);
    expect(traceEnabled('', { getItem: (k) => (k === 'ff1_trace' ? '1' : null) })).toBe(true);
  });

  it('a storage that throws is reported, not swallowed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(traceEnabled('', { getItem: () => { throw new Error('denied'); } })).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('TraceLog', () => {
  it('keeps the last lines and sends each to the sink', () => {
    const sink = vi.fn();
    const log = new TraceLog(sink, () => 0, 3);
    for (let i = 0; i < 5; i++) log.log('k', String(i));
    expect(log.lines).toHaveLength(3);
    expect(log.lines[2]).toContain('k 4');
    expect(sink).toHaveBeenCalledTimes(5);
  });

  it('records errors, rejections and the page unloading', () => {
    const win = new Target();
    const log = new TraceLog(() => {}, () => 0);
    traceWindow(win as unknown as Window, log);
    win.fire('error', { message: 'boom' });
    win.fire('unhandledrejection', { reason: 'nope' });
    win.fire('pagehide');
    expect(log.lines.map((l) => l.replace(/^\[trace [^\]]+\] /, ''))).toEqual([
      'window.error boom', 'unhandledrejection nope', 'pagehide the page is unloading (a reload or a close)']);
  });
});

describe('WebGL context loss', () => {
  it('says so, then asks for a reload when the context is not restored, and clears when it is', () => {
    const canvas = new Target();
    const o = overlay();
    let fire: (() => void) | null = null;
    const timers = { setTimeout: (fn: () => void) => { fire = fn; return 1; }, clearTimeout: vi.fn() };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    watchContext(canvas, o, null, timers, 8000);
    canvas.fire('webglcontextlost');
    expect(o.shown).toEqual([CONTEXT_LOST_TEXT]);
    fire?.();
    expect(o.shown).toEqual([CONTEXT_LOST_TEXT, CONTEXT_STUCK_TEXT]);
    canvas.fire('webglcontextrestored');
    expect(o.hidden).toBe(1);
    err.mockRestore();
  });

  it('a restore before the timeout cancels the reload message', () => {
    const canvas = new Target();
    const o = overlay();
    const timers = { setTimeout: vi.fn(() => 7), clearTimeout: vi.fn() };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    watchContext(canvas, o, null, timers);
    canvas.fire('webglcontextlost');
    canvas.fire('webglcontextrestored');
    expect(timers.clearTimeout).toHaveBeenCalledWith(7);
    expect(o.shown).toEqual([CONTEXT_LOST_TEXT]);
    err.mockRestore();
  });
});

describe('SceneManager trace', () => {
  const scene = (): Scene => ({ container: new Container(), enter: async () => {}, exit: async () => {}, update: () => {} });

  it('is silent without a trace and reports each switch, push, pop and failure with one', async () => {
    const quiet = new SceneManager(new Container());
    quiet.register('a', scene());
    await quiet.switchTo('a');

    const lines: string[] = [];
    const sm = new SceneManager(new Container(), { onTrace: (l) => lines.push(l) });
    sm.register('title', scene());
    sm.register('field', scene());
    await sm.switchTo('title');
    await sm.push('field');
    await sm.pop();
    await expect(sm.switchTo('missing')).rejects.toThrow();
    expect(lines[0]).toBe('scene switchTo title (now none, stack 0)');
    expect(lines).toContain('scene push field (now title, stack 0)');
    expect(lines).toContain('scene pop (now field, stack 1)');
    expect(lines.some((l) => l.includes('failed') && l.includes("Scene 'missing' not found"))).toBe(true);
  });
});
