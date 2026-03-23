export interface GameEvents {
  sceneChange: { from: string | null; to: string };
  battleStart: { enemies: string[] };
  battleEnd: { victory: boolean; xpReward: number; goldReward: number };
  playerMove: { x: number; y: number };
  interact: { targetId: string };
  menuOpen: { menu: string };
  menuClose: { menu: string };
  // Audio events
  cursorMove: Record<string, never>;
  cursorSelect: Record<string, never>;
  cursorCancel: Record<string, never>;
  battleHit: Record<string, never>;
  battleMiss: Record<string, never>;
  battleVictory: Record<string, never>;
  spellCast: Record<string, never>;
}

type Callback<T> = (data: T) => void;

export class EventBus {
  private listeners = new Map<keyof GameEvents, Set<Callback<unknown>>>();

  on<K extends keyof GameEvents>(event: K, callback: Callback<GameEvents[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as Callback<unknown>);
  }

  off<K extends keyof GameEvents>(event: K, callback: Callback<GameEvents[K]>): void {
    this.listeners.get(event)?.delete(callback as Callback<unknown>);
  }

  emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}