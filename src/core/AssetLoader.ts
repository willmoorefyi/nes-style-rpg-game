import { Assets, type UnresolvedAsset } from 'pixi.js';
import { parse } from 'yaml';
import type { AssetManifest } from '../types/index.js';

export class AssetLoader {
  private initialized = false;

  async init(manifest?: AssetManifest): Promise<void> {
    if (this.initialized) return;
    if (manifest) {
      await Assets.init({ manifest });
    }
    this.initialized = true;
  }

  async loadBundle(name: string): Promise<Record<string, unknown>> {
    return Assets.loadBundle(name);
  }

  async load<T>(alias: string): Promise<T> {
    return Assets.load(alias) as Promise<T>;
  }

  get<T>(alias: string): T {
    return Assets.get(alias) as T;
  }

  addBundle(name: string, assets: UnresolvedAsset[]): void {
    Assets.addBundle(name, assets);
  }

  async loadJson<T>(path: string): Promise<T> {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return response.json() as Promise<T>;
  }

  /** Fetch and parse a YAML file at runtime */
  async loadYaml<T>(path: string): Promise<T> {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    const text = await response.text();
    return parse(text) as T;
  }
}