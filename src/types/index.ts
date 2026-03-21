import { Container } from 'pixi.js';

export interface Scene {
  readonly container: Container;
  enter(): void | Promise<void>;
  update(dt: number): void;
  exit(): void | Promise<void>;
}

export interface AssetManifest {
  bundles: Array<{
    name: string;
    assets: Array<{ alias: string; src: string }>;
  }>;
}