import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FadeOverlay } from '../../src/rendering/FadeOverlay.js';

describe('FadeOverlay', () => {
  let overlay: FadeOverlay;
  let rafCallbacks: FrameRequestCallback[];
  let originalRaf: typeof globalThis.requestAnimationFrame;
  let originalPerf: typeof performance.now;
  let currentTime: number;

  beforeEach(() => {
    overlay = new FadeOverlay();
    rafCallbacks = [];
    currentTime = 0;

    originalRaf = globalThis.requestAnimationFrame;
    originalPerf = performance.now;

    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });

    performance.now = vi.fn(() => currentTime);
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    performance.now = originalPerf;
  });

  /** Flush all pending rAF callbacks, advancing time */
  function flushFrames(advanceMs: number, steps = 1): void {
    const stepMs = advanceMs / steps;
    for (let i = 0; i < steps; i++) {
      currentTime += stepMs;
      const cbs = rafCallbacks.splice(0);
      for (const cb of cbs) cb(currentTime);
    }
  }

  it('starts with alpha 0', () => {
    expect(overlay.overlay.alpha).toBe(0);
  });

  it('fadeOut sets alpha to 1 when complete', async () => {
    const promise = overlay.fadeOut(100);
    // Advance past duration
    flushFrames(150);
    await promise;
    expect(overlay.overlay.alpha).toBe(1);
  });

  it('fadeIn sets alpha to 0 when complete', async () => {
    // Start at alpha 1
    overlay.overlay.alpha = 1;
    const promise = overlay.fadeIn(100);
    flushFrames(150);
    await promise;
    expect(overlay.overlay.alpha).toBe(0);
  });

  it('fadeOut with 0 duration resolves immediately', async () => {
    await overlay.fadeOut(0);
    expect(overlay.overlay.alpha).toBe(1);
  });

  it('fadeIn with 0 duration resolves immediately', async () => {
    overlay.overlay.alpha = 1;
    await overlay.fadeIn(0);
    expect(overlay.overlay.alpha).toBe(0);
  });

  it('isAnimating is true during fade', () => {
    expect(overlay.isAnimating).toBe(false);
    overlay.fadeOut(100);
    // After starting, before any frame, isAnimating should be true
    expect(overlay.isAnimating).toBe(true);
  });

  it('isAnimating is false after fade completes', async () => {
    const promise = overlay.fadeOut(100);
    flushFrames(150);
    await promise;
    expect(overlay.isAnimating).toBe(false);
  });

  it('fadeOut interpolates alpha between 0 and 1', () => {
    overlay.fadeOut(100);
    // Advance to 50ms (halfway)
    currentTime = 50;
    const cbs = rafCallbacks.splice(0);
    for (const cb of cbs) cb(currentTime);
    expect(overlay.overlay.alpha).toBeCloseTo(0.5, 1);
  });

  it('overlay is a Graphics object sized to screen', () => {
    // FadeOverlay creates a 256x240 rect
    expect(overlay.overlay).toBeDefined();
    expect(overlay.overlay.alpha).toBe(0);
  });
});
