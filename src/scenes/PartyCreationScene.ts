import { Container, BitmapText, Graphics } from 'pixi.js';
import type { Scene, CharacterClassData } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';
import type { NameEntryGrid } from '../ui/NameEntryGrid.js';
import { ConfirmBox } from '../ui/ConfirmBox.js';
import { buildClassPreview, buildSlotDisplay, type SlotStrip } from './partyCreation/PartyCreationViews.js';
import { buildConfirmStep, buildNameStep } from './partyCreation/PartyCreationSteps.js';
import { OpeningSequence } from './partyCreation/OpeningSequence.js';
import { ClassRegistry } from '../data/ClassRegistry.js';
import { Character } from '../entities/Character.js';
import { STARTING_GOLD } from '../entities/PartyManager.js';
import { characterAtlas } from '../rendering/CharacterAtlas.js';
import { NES_FONT } from '../ui/NESFont.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_SIZE, SCREEN_MARGIN, MENU_LINE_HEIGHT } from '../core/LayoutConstants.js';

/** Asked before party creation goes back to the title (U7); it opens on No, and X answers No. */
export const LEAVE_PROMPT = 'Return to the title? The party so far is lost.';

export class PartyCreationScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private baseClasses: CharacterClassData[] = [];
  private selectedClasses: CharacterClassData[] = [];
  /** Chosen names, one per entry of `selectedClasses` once that member is named. */
  private names: string[] = [];
  private currentSlot = 0;
  /** Where the class menu opens: the class just backed out of, so Back keeps it (N1). */
  private classCursor = 0;
  private classMenu?: Menu;
  private confirmMenu?: Menu;
  private nameGrid?: NameEntryGrid;
  private slotStrip?: SlotStrip;
  private leaveBox?: ConfirmBox; // "Return to the title?" while it is open
  private phase: 'select' | 'name' | 'confirm' | 'cutscene' = 'select';

  private previewDisplay!: Container;
  private readonly opening = new OpeningSequence();

  constructor(game: Game) {
    this.game = game;
    this.container.addChild(this.opening.layer);
  }

  /** The class menu's cursor, or -1 when it is not shown. */
  get classIndex(): number { return this.phase === 'select' && this.classMenu ? this.classMenu.selectedIndex : -1; }
  /** The "Return to the title?" box is open. */
  get leavePromptOpen(): boolean { return this.leaveBox !== undefined; }

  enter(): void {
    this.leaveBox = undefined;
    this.opening.reset();
    this.selectedClasses = [];
    this.names = [];
    this.currentSlot = 0;
    this.classCursor = 0;
    this.phase = 'select';
    this.baseClasses = ClassRegistry.getAll().filter((c) => !c.upgradeFrom);
    this.buildUI();
    // the preview's battle pose appears once the atlas is in (text only until then, or without art)
    characterAtlas.load().then(
      () => { if (this.phase === 'select' && this.classMenu) this.updatePreview(this.classMenu.selectedIndex); },
      (e) => console.error('PartyCreationScene: character art failed to load', e),
    );
  }

  private buildUI(): void {
    this.container.removeChildren();
    this.classMenu = undefined;
    this.confirmMenu = undefined;
    this.nameGrid = undefined;

    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fill(0x000000);
    this.container.addChild(bg);

    const header = new BitmapText({
      text: this.currentSlot >= 4 ? 'Confirm your party'
        : this.phase === 'name' ? `Name the ${this.selectedClasses[this.currentSlot].name} (slot ${this.currentSlot + 1}/4)`
        : `Choose class for slot ${this.currentSlot + 1}/4`,
      style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff },
    });
    header.position.set(SCREEN_MARGIN, SCREEN_MARGIN);
    this.container.addChild(header);
    // the slots along the top: names and classes so far (N1)
    this.slotStrip = buildSlotDisplay(this.names, this.selectedClasses, this.currentSlot);
    this.container.addChild(this.slotStrip);

    const eventBus = this.game.events;
    if (this.phase === 'select') {
      this.buildClassSelect();
    } else if (this.phase === 'name') {
      this.nameGrid = buildNameStep(this.container, this.selectedClasses[this.currentSlot], this.names, {
        eventBus,
        onDone: (name) => this.onNamed(name),
        // cancel on an empty name: back to class select for this slot, on the same class
        onExit: () => {
          this.classCursor = this.indexOf(this.selectedClasses.pop());
          this.phase = 'select';
          this.buildUI();
        },
      });
      this.slotStrip?.setTyped(this.nameGrid.value);
    } else {
      this.confirmMenu = buildConfirmStep(this.container, this.selectedClasses, this.names, {
        eventBus,
        onBegin: () => this.beginAdventure(),
        onBack: () => this.backToClassSelect(),
      });
    }

    // the opening's backdrop, fade and dialog stay on top
    this.container.addChild(this.opening.layer);
  }

  private indexOf(cls: CharacterClassData | undefined): number {
    return Math.max(0, this.baseClasses.findIndex((c) => c.id === cls?.id));
  }

  private buildClassSelect(): void {
    const menuWindow = new Window({ x: SCREEN_MARGIN, y: 120, width: 600, height: 800 });
    this.classMenu = new Menu({
      items: this.baseClasses.map((c) => ({ label: c.name, value: c.id })),
      x: menuWindow.contentX,
      y: menuWindow.contentY,
      lineHeight: MENU_LINE_HEIGHT,
      initialIndex: this.classCursor,
      onSelect: (item) => this.onClassSelect(item.value),
      onCancel: () => this.onBack(),
      eventBus: this.game.events,
    });
    menuWindow.addChild(this.classMenu);
    this.container.addChild(menuWindow);

    this.previewDisplay = new Container();
    this.previewDisplay.position.set(648, 120);
    this.container.addChild(this.previewDisplay);
    this.updatePreview(this.classMenu.selectedIndex);
  }

  private onNamed(name: string): void {
    this.names.push(name);
    this.currentSlot++;
    this.classCursor = 0;
    this.phase = this.currentSlot >= 4 ? 'confirm' : 'select';
    this.buildUI();
  }

  /** Drop the last member (class and name) and pick that slot's class again, starting on the same class. */
  private backToClassSelect(): void {
    this.classCursor = this.indexOf(this.selectedClasses.pop());
    this.names.pop();
    this.currentSlot = this.selectedClasses.length;
    this.phase = 'select';
    this.buildUI();
  }

  private updatePreview(classIndex: number): void {
    this.previewDisplay.removeChildren();
    const cls = this.baseClasses[classIndex];
    if (!cls) return;
    const pose = characterAtlas.getBattleFrames(cls.id)?.frames[0] ?? null;
    this.previewDisplay.addChild(buildClassPreview(cls, pose));
  }

  update(dt: number): void {
    if (this.leaveBox) {
      this.leaveBox.update(this.game.input);
      return;
    }
    if (this.phase === 'cutscene') {
      this.opening.update(dt, this.game.input);
      return;
    }
    if (this.phase === 'name' && this.nameGrid) {
      this.nameGrid.update(this.game.input);
      if (this.phase === 'name' && this.nameGrid) this.slotStrip?.setTyped(this.nameGrid.value);
      return;
    }
    if (this.phase === 'confirm' && this.confirmMenu) {
      this.confirmMenu.update(this.game.input);
      return;
    }
    if (this.classMenu) {
      const prevIndex = this.classMenu.selectedIndex;
      this.classMenu.update(this.game.input);
      if (this.phase === 'select' && this.classMenu && this.classMenu.selectedIndex !== prevIndex) {
        this.updatePreview(this.classMenu.selectedIndex);
      }
    }
  }

  private onClassSelect(classId: string): void {
    const cls = this.baseClasses.find((c) => c.id === classId);
    if (!cls) return;
    this.selectedClasses.push(cls);
    this.phase = 'name';
    this.buildUI();
  }

  private onBack(): void {
    if (this.currentSlot > 0) {
      this.backToClassSelect();
    } else {
      this.askLeave();
    }
  }

  /** Slot 1's cancel: only a Yes goes back to the title (U7). */
  private askLeave(): void {
    const box = new ConfirmBox({
      prompt: LEAVE_PROMPT, defaultNo: true, eventBus: this.game.events,
      onAnswer: (yes) => {
        this.container.removeChild(box);
        this.leaveBox = undefined;
        if (yes) this.game.scenes.switchTo('title');
      },
    });
    this.leaveBox = box;
    this.container.addChild(box);
  }

  private async beginAdventure(): Promise<void> {
    // a new game starts from nothing: no party, gold, items or flags left over from a previous run
    this.game.resetState();
    for (const [i, cls] of this.selectedClasses.entries()) {
      const name = this.names[i];
      const character = new Character({ name, classData: cls });
      if (!this.game.party.add(character)) console.error(`Could not add ${name} to the new party`);
    }
    this.game.party.addGold(STARTING_GOLD);
    // the opening plays from data (N2), then the party starts at the town's south gate
    this.phase = 'cutscene';
    await this.opening.play(this.game.gameFlags, [...this.game.party.all]);
    this.game.currentMapId = 'cornelia';
    this.game.pendingEntrance = 'south_gate';
    this.game.scenes.switchTo('exploration');
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {
    this.container.removeChildren();
  }
}
