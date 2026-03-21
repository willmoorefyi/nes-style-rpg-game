import { Character } from './Character.js';

export class PartyManager {
  private members: Character[] = [];
  private _gold = 0;
  readonly maxSize = 4;

  add(character: Character): boolean {
    if (this.members.length >= this.maxSize) return false;
    this.members.push(character);
    return true;
  }

  remove(index: number): Character | null {
    if (index < 0 || index >= this.members.length) return null;
    return this.members.splice(index, 1)[0];
  }

  get(index: number): Character | null {
    return this.members[index] ?? null;
  }

  get size(): number { return this.members.length; }
  get all(): readonly Character[] { return this.members; }

  swap(i: number, j: number): boolean {
    if (i < 0 || j < 0 || i >= this.members.length || j >= this.members.length) return false;
    [this.members[i], this.members[j]] = [this.members[j], this.members[i]];
    return true;
  }

  get gold(): number { return this._gold; }
  addGold(amount: number): void { this._gold += amount; }

  distributeXp(amount: number): boolean[] {
    const living = this.members.filter(m => m.currentHp > 0);
    if (living.length === 0) return [];
    const share = Math.floor(amount / living.length);
    return living.map(m => m.addXp(share));
  }

  toJSON(): object {
    return { members: this.members.map(m => m.toJSON()), gold: this._gold };
  }
}