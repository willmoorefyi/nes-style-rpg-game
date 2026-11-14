import type { NPC } from '../entities/NPC.js';
import type { PlayerController } from '../entities/PlayerController.js';
import type { InputManager } from '../core/InputManager.js';

/** What confirm reached: an NPC (in front, or across a counter), else the lines of an inspect cell in front. */
export type FieldInteraction = { kind: 'npc'; npc: NPC } | { kind: 'inspect'; lines: string[] };

export class NPCInteractionSystem {
  private npcs: NPC[] = [];
  private player: PlayerController | null = null;
  private input: InputManager | null = null;
  private isCounter: (x: number, y: number) => boolean = () => false;
  private inspect: (x: number, y: number) => string[] | null = () => null;

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
      const dx = facing.x - this.player.gridX;
      const dy = facing.y - this.player.gridY;
      npc = this.getNPCAt(facing.x + dx, facing.y + dy);
    }
    if (npc) return { kind: 'npc', npc };
    const lines = this.inspect(facing.x, facing.y);
    return lines ? { kind: 'inspect', lines } : null;
  }
}
