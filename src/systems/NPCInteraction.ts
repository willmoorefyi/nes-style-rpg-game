import type { NPC } from '../entities/NPC.js';
import type { PlayerController } from '../entities/PlayerController.js';
import type { InputManager } from '../core/InputManager.js';
import { stepTo, wrapDelta, type MapLike } from './worldWrap.js';

/** What confirm reached: an NPC (in front, or across a counter), else the lines of an inspect cell in front. */
export type FieldInteraction = { kind: 'npc'; npc: NPC } | { kind: 'inspect'; lines: string[] };

export class NPCInteractionSystem {
  private npcs: NPC[] = [];
  private player: PlayerController | null = null;
  private input: InputManager | null = null;
  private isCounter: (x: number, y: number) => boolean = () => false;
  private inspect: (x: number, y: number) => string[] | null = () => null;
  /** WR: the map, for the seam (null: plain differences, as on a flat map). */
  private map: MapLike | null = null;

  setMap(map: MapLike | null): void {
    this.map = map;
  }

  setNPCs(npcs: NPC[]): void {
    this.npcs = npcs;
  }

  setPlayer(player: PlayerController): void {
    this.player = player;
  }

  /** Lets the player talk to an NPC standing behind a counter tile. */
  setCounterCheck(isCounter: (x: number, y: number) => boolean): void {
    this.isCounter = isCounter;
  }

  /** Text of an inspect cell (FieldInspect.inspectAt), asked only when confirm reaches no NPC. */
  setInspectCheck(inspect: (x: number, y: number) => string[] | null): void {
    this.inspect = inspect;
  }

  setInput(input: InputManager): void {
    this.input = input;
  }

  getNPCAt(x: number, y: number): NPC | null {
    return this.npcs.find(n => n.tileX === x && n.tileY === y) ?? null;
  }

  checkInteraction(): NPC | null {
    const hit = this.interact();
    return hit?.kind === 'npc' ? hit.npc : null;
  }

  /** On confirm (standing still): the NPC faced, else across a counter, else the faced inspect cell. */
  interact(): FieldInteraction | null {
    if (!this.player || !this.input) return null;
    if (this.player.isMoving) return null;
    if (!this.input.isJustPressed('confirm')) return null;

    const facing = this.player.facingTile;
    let npc = this.getNPCAt(facing.x, facing.y);
    if (!npc && this.isCounter(facing.x, facing.y)) {
      // across a counter: the NPC one tile further in the same direction
      const m = this.map ?? { width: 0, height: 0 };
      const dx = wrapDelta(this.player.gridX, facing.x, m.wrap ? m.width : 0);
      const dy = wrapDelta(this.player.gridY, facing.y, m.wrap ? m.height : 0);
      const far = this.map ? stepTo(this.map, facing, dx, dy) : { x: facing.x + dx, y: facing.y + dy };
      npc = far ? this.getNPCAt(far.x, far.y) : null;
    }
    if (npc) return { kind: 'npc', npc };
    const lines = this.inspect(facing.x, facing.y);
    return lines ? { kind: 'inspect', lines } : null;
  }
}
