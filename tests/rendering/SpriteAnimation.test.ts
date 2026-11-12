import { describe, it, expect, beforeEach } from 'vitest';
import { Texture } from 'pixi.js';
import { SpriteAnimation, type AnimationConfig } from '../../src/rendering/SpriteAnimation.js';

// Mock texture with dimensions
function createMockTexture(): Texture {
  const texture = {
    source: { width: 64, height: 64 },
    width: 64,
    height: 64,
  } as unknown as Texture;
  return texture;
}

function createConfig(): AnimationConfig {
  return {
    frameWidth: 16,
    frameHeight: 16,
    frameCount: 4,
    frameDuration: 100,
    directions: { down: 0, up: 1, left: 2, right: 3 },
  };
}

describe('SpriteAnimation', () => {
  let animation: SpriteAnimation;

  beforeEach(() => {
    animation = new SpriteAnimation(createMockTexture(), createConfig());
  });

  it('initializes with default direction and state', () => {
    expect(animation.direction).toBe('down');
    expect(animation.state).toBe('idle');
    expect(animation.frame).toBe(0);
  });

  it('creates a sprite', () => {
    expect(animation.sprite).toBeDefined();
  });

  it('changes direction and resets frame', () => {
    animation.setDirection('up');
    expect(animation.direction).toBe('up');
    expect(animation.frame).toBe(0);
  });

  it('changes state', () => {
    animation.setState('walking');
    expect(animation.state).toBe('walking');
  });

  it('does not animate when idle', () => {
    animation.setState('idle');
    animation.update(200);
    expect(animation.frame).toBe(0);
  });

  it('cycles frames when walking', () => {
    animation.setState('walking');
    expect(animation.frame).toBe(0);

    animation.update(100);
    expect(animation.frame).toBe(1);

    animation.update(100);
    expect(animation.frame).toBe(2);

    animation.update(100);
    expect(animation.frame).toBe(3);

    animation.update(100);
    expect(animation.frame).toBe(0); // wraps
  });

  it('accumulates partial frame time', () => {
    animation.setState('walking');
    animation.update(50);
    expect(animation.frame).toBe(0);

    animation.update(50);
    expect(animation.frame).toBe(1);
  });

  it('resets frame when changing direction while walking', () => {
    animation.setState('walking');
    animation.update(100);
    animation.update(100);
    expect(animation.frame).toBe(2);

    animation.setDirection('left');
    expect(animation.frame).toBe(0);
  });
});

describe('SpriteAnimation - atlas origin and walk sequence', () => {
  function atlasTexture(): Texture {
    return { source: { width: 400, height: 400 }, width: 400, height: 400 } as unknown as Texture;
  }

  it('slices frames relative to the block origin', () => {
    const anim = new SpriteAnimation(atlasTexture(), {
      frameWidth: 48, frameHeight: 96, frameCount: 3, frameDuration: 100,
      directions: { down: 0, up: 1, left: 2, right: 3 }, originX: 96, originY: 192,
    });
    anim.setDirection('left');
    const frame = anim.sprite.texture.frame;
    expect(frame.x).toBe(96);
    expect(frame.y).toBe(192 + 2 * 96);
    expect(frame.width).toBe(48);
    expect(frame.height).toBe(96);
  });

  it('plays frames in the configured walk order and rests on column 0 when idle', () => {
    const anim = new SpriteAnimation(atlasTexture(), {
      frameWidth: 48, frameHeight: 96, frameCount: 3, frameDuration: 100,
      directions: { down: 0, up: 1, left: 2, right: 3 }, walkSequence: [1, 0, 2, 0],
    });
    const columns: number[] = [];
    anim.setState('walking');
    columns.push(anim.sprite.texture.frame.x / 48);
    for (let i = 0; i < 5; i++) {
      anim.update(100);
      columns.push(anim.sprite.texture.frame.x / 48);
    }
    expect(columns).toEqual([1, 0, 2, 0, 1, 0]);
    anim.setState('idle');
    expect(anim.sprite.texture.frame.x).toBe(0);
  });
});
