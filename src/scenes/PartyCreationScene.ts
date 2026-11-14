import { Container, BitmapText, Graphics } from 'pixi.js';
import type { Scene, CharacterClassData } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';
import { NameEntryGrid, uniqueDefaultName } from '../ui/NameEntryGrid.js';
import { DEFAULT_NAMES, buildClassPreview, buildPartySummary, buildSlotDisplay } from './partyCreation/PartyCreationViews.js';
import { ClassRegistry } from '../data/ClassRegistry.js';
import { Character } from '../entities/Character.js';
import { STARTING_GOLD } from '../entities/PartyManager.js';
import { NES_FONT } from '../ui/NESFont.js';
import { CutsceneManager, type CutsceneScript } from '../systems/CutsceneManager.js';
import { FadeOverlay } from '../rendering/FadeOverlay.js';
import { DialogBox } from '../ui/DialogBox.js';
import { DialogManager } from '../systems/DialogManager.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_SIZE, SCREEN_MARGIN, MENU_LINE_HEIGHT } from '../core/LayoutConstants.js';

export class PartyCreationScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private baseClasses: CharacterClassData[] = [];
  private selectedClasses: CharacterClassData[] = [];
  /** Chosen names, one per entry of `selectedClasses` once that member is named. */
  private names: string[] = [];
  private currentSlot = 0;
  private classMenu!: Menu;
  private confirmMenu?: Menu;
  private nameGrid?: NameEntryGrid;
  private phase: 'select' | 'name' | 'confirm' | 'cutscene' = 'select';

  // UI containers for easy rebuild
  private slotDisplay!: Container;
  private previewDisplay!: Container;
  private menuWindow!: Window;
  private confirmWindow?: Window;
  private fadeOverlay: FadeOverlay;
  private dialogManager: DialogManager;
  private dialogBox: DialogBox;

  constructor(game: Game) {
    this.game = game;
    this.dialogBox = new DialogBox({ onComplete: () => this.dialogManager.advance() });
    this.dialogBox.visible = false;
    this.dialogManager = new DialogManager(this.dialogBox);
    this.fadeOverlay = new FadeOverlay();
    // Fade overlay first, dialog on top so it's visible during cutscenes
    this.container.addChild(this.fadeOverlay.overlay);
    this.container.addChild(this.dialogBox);
  }

  enter(): void {
    // the opening leaves the screen black for the field to fade in from; a later New Game must start visible
    this.fadeOverlay.overlay.alpha = 0;
    this.dialogManager.clear();
    this.selectedClasses = [];
    this.names = [];
    this.currentSlot = 0;
    this.phase = 'select';
    this.baseClasses = ClassRegistry.getAll().filter((c) => !c.upgradeFrom);
    this.buildUI();
  }

  private buildUI(): void {
    this.container.removeChildren();

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fill(0x000000);
    this.container.addChild(bg);

    // Header
    const header = new BitmapText({
      text: this.currentSlot >= 4 ? 'Confirm your party'
        : this.phase === 'name' ? `Name the ${this.selectedClasses[this.currentSlot].name} (slot ${this.currentSlot + 1}/4)`
        : `Choose class for slot ${this.currentSlot + 1}/4`,
      style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff },
    });
    header.position.set(SCREEN_MARGIN, SCREEN_MARGIN);
    this.container.addChild(header);

    // Slot display (top area showing the chosen names)
    this.slotDisplay = buildSlotDisplay(this.names, this.currentSlot);
    this.container.addChild(this.slotDisplay);

    if (this.phase === 'select') {
      this.buildClassSelect();
    } else if (this.phase === 'name') {
      this.buildNameEntry();
    } else {
      this.buildConfirm();
    }

    // Keep dialog and fade overlay on top — dialog ABOVE fade so it's visible during cutscenes
    this.container.addChild(this.fadeOverlay.overlay);
    this.container.addChild(this.dialogBox);
  }

  private buildClassSelect(): void {
    // Class menu (left side)
    this.menuWindow = new Window({ x: SCREEN_MARGIN, y: 120, width: 600, height: 800 });
    this.classMenu = new Menu({
      items: this.baseClasses.map((c) => ({
        label: c.name,
        value: c.id,
      })),
      x: this.menuWindow.contentX,
      y: this.menuWindow.contentY,
      lineHeight: MENU_LINE_HEIGHT,
      onSelect: (item) => this.onClassSelect(item.value),
      onCancel: () => this.onBack(),
      eventBus: this.game.events,
    });
    this.menuWindow.addChild(this.classMenu);
    this.container.addChild(this.menuWindow);

    // Preview panel (right side)
    this.previewDisplay = new Container();
    this.previewDisplay.position.set(648, 120);
    this.container.addChild(this.previewDisplay);
    this.updatePreview(0);
  }

  private buildConfirm(): void {
    this.container.addChild(buildPartySummary(this.selectedClasses, this.names));

    this.confirmWindow = new Window({ x: 660, y: 700, width: 600, height: 200 });
    this.confirmMenu = new Menu({
      items: [
        { label: 'Begin Adventure', value: 'begin' },
        { label: 'Back', value: 'back' },
      ],
      x: this.confirmWindow.contentX,
      y: this.confirmWindow.contentY,
      lineHeight: 48,
      onSelect: (item) => {
        if (item.value === 'begin') this.beginAdventure();
        else this.backToClassSelect();
      },
      onCancel: () => this.backToClassSelect(),
      eventBus: this.game.events,
    });
    this.confirmWindow.addChild(this.confirmMenu);
    this.container.addChild(this.confirmWindow);
  }

  private buildNameEntry(): void {
    const win = new Window({ x: SCREEN_MARGIN, y: 120, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: 600 });
    const cls = this.selectedClasses[this.currentSlot];
    this.nameGrid = new NameEntryGrid({
      // defaults are unique: a second Warrior is FGHTR2
      defaultName: uniqueDefaultName(DEFAULT_NAMES[cls.id] ?? cls.name.slice(0, 6), this.names),
      x: win.contentX,
      y: win.contentY,
      eventBus: this.game.events,
      onDone: (name) => this.onNamed(name),
      onExit: () => {
        // cancel on an empty name: back to class select for this slot
        this.selectedClasses.pop();
        this.phase = 'select';
        this.buildUI();
      },
    });
    win.addChild(this.nameGrid);
    this.container.addChild(win);
  }

  private onNamed(name: string): void {
    this.names.push(name);
    this.currentSlot++;
    this.phase = this.currentSlot >= 4 ? 'confirm' : 'select';
    this.buildUI();
  }

  /** Drop the last member (class and name) and pick that slot's class again. */
  private backToClassSelect(): void {
    this.selectedClasses.pop();
    this.names.pop();
    this.currentSlot = this.selectedClasses.length;
    this.phase = 'select';
    this.buildUI();
  }

  private updatePreview(classIndex: number): void {
    this.previewDisplay.removeChildren();
    const cls = this.baseClasses[classIndex];
    if (!cls) return;

    this.previewDisplay.addChild(buildClassPreview(cls));
  }

  update(_dt: number): void {
    // D2: During cutscene, advance dialog on input
    if (this.phase === 'cutscene') {
      if (this.dialogManager.isActive) {
        this.dialogManager.update(_dt, this.game.input);
        if (!this.dialogManager.isActive && this.cutsceneDialogResolve) {
          const resolve = this.cutsceneDialogResolve;
          this.cutsceneDialogResolve = null;
          resolve();
        }
      }
      return;
    }
    if (this.phase === 'name' && this.nameGrid) {
      this.nameGrid.update(this.game.input);
      return;
    }
    if (this.phase === 'confirm' && this.confirmMenu) {
      this.confirmMenu.update(this.game.input);
      return;
    }
    if (this.classMenu) {
      const prevIndex = this.classMenu.selectedIndex;
      this.classMenu.update(this.game.input);
      if (this.classMenu.selectedIndex !== prevIndex) {
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
      this.game.scenes.switchTo('title');
    }
  }

  private beginAdventure(): void {
    // a new game starts from nothing: no party, gold, items or flags left over from a previous run
    this.game.resetState();
    for (const [i, cls] of this.selectedClasses.entries()) {
      const name = this.names[i];
      const character = new Character({ name, classData: cls });
      if (!this.game.party.add(character)) console.error(`Could not add ${name} to the new party`);
    }
    // Give starting gold
    this.game.party.addGold(STARTING_GOLD);
    // D2: Play opening sequence cutscene
    this.phase = 'cutscene';
    this.playOpeningSequence();
  }

  private async playOpeningSequence(): Promise<void> {
    const script: CutsceneScript = [
      { type: 'fade_out', duration: 500 },
      { type: 'dialog', text: 'The world is veiled in darkness. The winds stop, the seas rage, and the earth decays.' },
      { type: 'dialog', text: 'The people wait, their only hope a prophecy...' },
      { type: 'dialog', text: '"When the world is in darkness, four Warriors of Light will come."' },
      { type: 'dialog', text: 'After a long journey, four young warriors arrive at the gates of Cornelia, each holding an orb.' },
      { type: 'dialog', text: 'The King awaits in the castle at the top of the high street.' },
    ];
    const cutscene = new CutsceneManager({
      showDialog: (text: string) => new Promise<void>((resolve) => {
        this.dialogManager.start([text]);
        this.cutsceneDialogResolve = resolve;
      }),
      fadeOut: (ms: number) => {
        return this.fadeOverlay.fadeOut(ms);
      },
      fadeIn: (ms: number) => {
        return this.fadeOverlay.fadeIn(ms);
      },
      flags: this.game.gameFlags,
      party: [...this.game.party.all],
    });
    await cutscene.play(script);
    // the party starts at the town's south gate; the field fades in from this black screen
    this.game.currentMapId = 'cornelia';
    this.game.pendingEntrance = 'south_gate';
    this.game.scenes.switchTo('exploration');
  }

  private cutsceneDialogResolve: (() => void) | null = null;

  onPause(): void {}
  onResume(): void {}

  exit(): void {
    this.container.removeChildren();
  }
}
