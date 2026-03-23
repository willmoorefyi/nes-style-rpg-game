import { Container } from 'pixi.js';
import type { SpellData } from '../types/index.js';
import type { Character } from '../entities/Character.js';
import type { EventBus } from '../core/EventBus.js';
import type { InputManager } from '../core/InputManager.js';
import { Menu, type MenuItem } from './Menu.js';

export interface SpellSelectionResult {
  spellId: string;
  targetId: string | undefined;
}

export interface SpellSelectionConfig {
  character: Character;
  spells: SpellData[];
  enemies: Array<{ id: string; name: string }>;
  partyMembers: Array<{ name: string }>;
  contentX: number;
  contentY: number;
  eventBus?: EventBus;
  onSelect: (result: SpellSelectionResult) => void;
  onCancel: () => void;
}

type SpellUIState = 'level' | 'spell' | 'target';

export class SpellSelectionUI extends Container {
  private config: SpellSelectionConfig;
  private state: SpellUIState = 'level';
  private levelMenu: Menu | null = null;
  private spellMenu: Menu | null = null;
  private targetMenu: Menu | null = null;
  private currentLevel = 0;
  private selectedSpellId: string | null = null;

  constructor(config: SpellSelectionConfig) {
    super();
    this.config = config;
    this.showLevelMenu();
  }

  private showLevelMenu(): void {
    const { character, contentX, contentY, eventBus, onCancel } = this.config;
    const levels: number[] = [];
    for (let lvl = 1; lvl <= 8; lvl++) {
      if (character.hasCharges(lvl) && character.getSpellsAtLevel(lvl).length > 0) {
        levels.push(lvl);
      }
    }

    if (levels.length === 0) {
      onCancel();
      return;
    }

    const items: MenuItem[] = levels.map(lvl => ({
      label: `Lv${lvl} (${character.getSpellCharges(lvl)})`,
      value: String(lvl),
    }));

    this.levelMenu = new Menu({
      items,
      x: contentX,
      y: contentY,
      onSelect: (item) => {
        this.currentLevel = parseInt(item.value);
        this.showSpellMenu();
      },
      onCancel: () => {
        this.cleanup();
        onCancel();
      },
      eventBus,
    });
    this.addChild(this.levelMenu);
    this.state = 'level';
  }

  private showSpellMenu(): void {
    const { character, spells, contentX, contentY, eventBus } = this.config;
    const spellIds = character.getSpellsAtLevel(this.currentLevel);
    const items: MenuItem[] = spellIds.map(id => {
      const spell = spells.find(s => s.id === id);
      return { label: spell?.name ?? id, value: id };
    });

    this.spellMenu = new Menu({
      items,
      x: contentX,
      y: contentY,
      onSelect: (item) => {
        this.selectedSpellId = item.value;
        const spell = spells.find(s => s.id === item.value);
        if (spell?.targeting === 'all') {
          this.submitResult(undefined);
        } else if (spell?.targeting === 'self') {
          this.submitResult(character.name);
        } else if (spell?.type === 'white' && spell?.effect === 'heal') {
          this.showPartyTargetMenu();
        } else {
          this.showEnemyTargetMenu();
        }
      },
      onCancel: () => {
        this.hideSpellMenu();
        this.state = 'level';
      },
      eventBus,
    });
    this.addChild(this.spellMenu);
    if (this.levelMenu) this.levelMenu.visible = false;
    this.state = 'spell';
  }

  private hideSpellMenu(): void {
    if (this.spellMenu) {
      this.removeChild(this.spellMenu);
      this.spellMenu = null;
    }
    if (this.levelMenu) this.levelMenu.visible = true;
  }

  private showEnemyTargetMenu(): void {
    const { enemies, contentX, contentY, eventBus } = this.config;
    const items: MenuItem[] = enemies.map(e => ({ label: e.name, value: e.id }));
    this.createTargetMenu(items, contentX, contentY, eventBus);
  }

  private showPartyTargetMenu(): void {
    const { partyMembers, contentX, contentY, eventBus } = this.config;
    const items: MenuItem[] = partyMembers.map(c => ({ label: c.name, value: c.name }));
    this.createTargetMenu(items, contentX, contentY, eventBus);
  }

  private createTargetMenu(items: MenuItem[], x: number, y: number, eventBus?: EventBus): void {
    this.targetMenu = new Menu({
      items,
      x,
      y,
      onSelect: (item) => this.submitResult(item.value),
      onCancel: () => {
        this.hideTargetMenu();
        this.state = 'spell';
      },
      eventBus,
    });
    this.addChild(this.targetMenu);
    if (this.spellMenu) this.spellMenu.visible = false;
    this.state = 'target';
  }

  private hideTargetMenu(): void {
    if (this.targetMenu) {
      this.removeChild(this.targetMenu);
      this.targetMenu = null;
    }
    if (this.spellMenu) this.spellMenu.visible = true;
  }

  private submitResult(targetId: string | undefined): void {
    if (this.selectedSpellId) {
      this.config.onSelect({ spellId: this.selectedSpellId, targetId });
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.targetMenu) this.removeChild(this.targetMenu);
    if (this.spellMenu) this.removeChild(this.spellMenu);
    if (this.levelMenu) this.removeChild(this.levelMenu);
    this.targetMenu = null;
    this.spellMenu = null;
    this.levelMenu = null;
  }

  update(input: InputManager): void {
    switch (this.state) {
      case 'level':
        this.levelMenu?.update(input);
        break;
      case 'spell':
        this.spellMenu?.update(input);
        break;
      case 'target':
        this.targetMenu?.update(input);
        break;
    }
  }

  hasNoSpells(): boolean {
    const { character } = this.config;
    for (let lvl = 1; lvl <= 8; lvl++) {
      if (character.hasCharges(lvl) && character.getSpellsAtLevel(lvl).length > 0) {
        return false;
      }
    }
    return true;
  }
}
