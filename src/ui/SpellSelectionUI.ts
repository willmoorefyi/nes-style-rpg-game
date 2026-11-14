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
  /** Unique battle ID for the casting character (e.g., 'party_0') */
  actorId: string;
  spells: SpellData[];
  enemies: Array<{ id: string; name: string }>;
  partyMembers: Array<{ name: string; id: string; hp: number }>;
  contentX: number;
  contentY: number;
  eventBus?: EventBus;
  onSelect: (result: SpellSelectionResult) => void;
  onCancel: () => void;
  onNeedTarget?: (spellId: string, targetType: 'single' | 'single_ally' | 'all' | 'all_allies' | 'self') => void;
}

type SpellUIState = 'level' | 'spell';

export class SpellSelectionUI extends Container {
  private config: SpellSelectionConfig;
  private state: SpellUIState = 'level';
  private levelMenu: Menu | null = null;
  private spellMenu: Menu | null = null;
  private currentLevel = 0;
  private selectedSpellId: string | null = null;
  /** U13: only one level was usable, so there is no level menu to go back to. */
  private singleLevel = false;

  constructor(config: SpellSelectionConfig) {
    super();
    this.config = config;
    const levels = this.usableLevels();
    // U13: with one usable level the level step is skipped; the spell menu opens at once and its cancel leaves
    if (levels.length === 1) {
      this.currentLevel = levels[0];
      this.singleLevel = true;
      this.showSpellMenu();
    } else {
      this.showLevelMenu(levels);
    }
  }

  /** Spell levels with charges left and at least one learned spell. */
  private usableLevels(): number[] {
    const { character } = this.config;
    const levels: number[] = [];
    for (let lvl = 1; lvl <= 8; lvl++) {
      if (character.hasCharges(lvl) && character.getSpellsAtLevel(lvl).length > 0) levels.push(lvl);
    }
    return levels;
  }

  private showLevelMenu(levels: number[]): void {
    const { character, contentX, contentY, eventBus, onCancel } = this.config;
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
    // U13: with no level step the rows carry the level's charges after the name ("CURE  2")
    const charges = this.singleLevel ? `  ${character.getSpellCharges(this.currentLevel)}` : '';
    const items: MenuItem[] = spellIds.map(id => {
      const spell = spells.find(s => s.id === id);
      return { label: `${spell?.name ?? id}${charges}`, value: id };
    });

    this.spellMenu = new Menu({
      items,
      x: contentX,
      y: contentY,
      onSelect: (item) => {
        this.selectedSpellId = item.value;
        const spell = spells.find(s => s.id === item.value);
        const targeting = spell?.targeting ?? 'single';

        if (targeting === 'all' || targeting === 'all_allies') {
          this.submitResult(undefined);
        } else if (targeting === 'self') {
          this.submitResult(this.config.actorId);
        } else if (this.config.onNeedTarget) {
          // Delegate target selection to the caller (field targeting)
          this.config.onNeedTarget(item.value, targeting);
        } else {
          // Fallback: auto-submit without target
          this.submitResult(undefined);
        }
      },
      onCancel: () => {
        if (this.singleLevel) {
          this.cleanup();
          this.config.onCancel();
          return;
        }
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

  private submitResult(targetId: string | undefined): void {
    if (this.selectedSpellId) {
      this.config.onSelect({ spellId: this.selectedSpellId, targetId });
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.spellMenu) this.removeChild(this.spellMenu);
    if (this.levelMenu) this.removeChild(this.levelMenu);
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
    }
  }

  hasNoSpells(): boolean {
    return this.usableLevels().length === 0;
  }
}
