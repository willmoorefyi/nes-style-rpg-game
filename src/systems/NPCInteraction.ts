import type { NPC } from '../entities/NPC.js';
import type { PlayerController } from '../entities/PlayerController.js';
import type { InputManager } from '../core/InputManager.js';

export class NPCInteractionSystem {
  private npcs: NPC[] = [];
  private player: PlayerController | null = null;
  private input: InputManager | null = null;

  setNPCs(npcs: NPC[]): void {
    this.npcs = npcs;
  }

  setPlayer(player: PlayerController): void {
    this.player = player;
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
    return this.getNPCAt(facing.x, facing.y);
  }
}
