import type { NPC } from '../entities/NPC.js';
import type { PlayerController } from '../entities/PlayerController.js';
import type { InputManager } from '../core/InputManager.js';

export class NPCInteractionSystem {
  private npcs: NPC[] = [];
  private player: PlayerController | null = null;
  private input: InputManager | null = null;
  private isCounter: (x: number, y: number) => boolean = () => false;

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

  setInput(input: InputManager): void {
    this.input = input;
  }

  getNPCAt(x: number, y: number): NPC | null {
    return this.npcs.find(n => n.tileX === x && n.tileY === y) ?? null;
  }

  checkInteraction(): NPC | null {
    if (!this.player || !this.input) return null;
    if (this.player.isMoving) return null;
    if (!this.input.isJustPressed('confirm')) return null;

    const facing = this.player.facingTile;
    const npc = this.getNPCAt(facing.x, facing.y);
    if (npc || !this.isCounter(facing.x, facing.y)) return npc;
    // across a counter: the NPC one tile further in the same direction
    const dx = facing.x - this.player.gridX;
    const dy = facing.y - this.player.gridY;
    return this.getNPCAt(facing.x + dx, facing.y + dy);
  }
}
