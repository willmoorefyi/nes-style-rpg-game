/**
 * Story/progression flag system for tracking game state.
 */
export class GameFlags {
  private flags = new Map<string, boolean | number | string>();

  set(key: string, value: boolean | number | string = true): void {
    this.flags.set(key, value);
  }

  get<T extends boolean | number | string>(key: string): T | undefined {
    return this.flags.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this.flags.has(key);
  }

  getAll(): Record<string, boolean | number | string> {
    return Object.fromEntries(this.flags);
  }

  toJSON(): Record<string, boolean | number | string> {
    return this.getAll();
  }

  static fromJSON(data: Record<string, boolean | number | string>): GameFlags {
    const flags = new GameFlags();
    for (const [k, v] of Object.entries(data)) flags.set(k, v);
    return flags;
  }
}
