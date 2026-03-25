import { Container, BitmapText, Graphics } from 'pixi.js';
import type { Scene, CharacterClassData } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { WIDTH, HEIGHT } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';
import { ClassRegistry } from '../data/ClassRegistry.js';
import { Character } from '../entities/Character.js';
import { NES_FONT } from '../ui/NESFont.js';
import { CutsceneManager, type CutsceneScript } from '../systems/CutsceneManager.js';
import { FadeOverlay } from '../rendering/FadeOverlay.js';
import { DialogBox } from '../ui/DialogBox.js';
import { DialogManager } from '../systems/DialogManager.js';

const DEFAULT_NAMES: Record<string, string> = {
  warrior: 'FGHTR',
  thief: 'THIEF',
  monk: 'MONK',
  white_mage: 'W.MAG',
  black_mage: 'B.MAG',
  red_mage: 'R.MAG',
};

const STARTING_GOLD = 100;

export class PartyCreationScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private baseClasses: CharacterClassData[] = [];
  private selectedClasses: CharacterClassData[] = [];
  private currentSlot = 0;
  private classMenu!: Menu;
  private confirmMenu?: Menu;
  private phase: 'select' | 'confirm' | 'cutscene' = 'select';

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
    this.selectedClasses = [];
    this.currentSlot = 0;
    this.phase = 'select';
    this.baseClasses = ClassRegistry.getAll().filter((c) => !c.upgradeFrom);
    this.buildUI();
  }

  private buildUI(): void {
    this.container.removeChildren();

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, WIDTH, HEIGHT);
    bg.fill(0x000000);
    this.container.addChild(bg);

    // Header
    const header = new BitmapText({
      text: `Choose class for slot ${this.currentSlot + 1}/4`,
      style: { fontFamily: NES_FONT, fontSize: 8, fill: 0xffffff },
    });
    header.position.set(8, 8);
    this.container.addChild(header);

    // Slot display (top area showing chosen classes)
    this.slotDisplay = new Container();
    this.slotDisplay.position.set(8, 22);
    for (let i = 0; i < 4; i++) {
      const label = new BitmapText({
        text: i < this.selectedClasses.length
          ? `${i + 1}:${DEFAULT_NAMES[this.selectedClasses[i].id] ?? this.selectedClasses[i].name}`
          : `${i + 1}:----`,
        style: {
          fontFamily: NES_FONT,
          fontSize: 8,
          fill: i === this.currentSlot ? 0xffff00 : 0xffffff,
        },
      });
      label.position.set(i * 62, 0);
      this.slotDisplay.addChild(label);
    }
    this.container.addChild(this.slotDisplay);

    if (this.phase === 'select') {
      this.buildClassSelect();
    } else {
      this.buildConfirm();
    }

    // Keep dialog and fade overlay on top — dialog ABOVE fade so it's visible during cutscenes
    this.container.addChild(this.fadeOverlay.overlay);
    this.container.addChild(this.dialogBox);
  }

  private buildClassSelect(): void {
    // Class menu (left side)
    this.menuWindow = new Window({ x: 4, y: 36, width: 100, height: 92 });
    this.classMenu = new Menu({
      items: this.baseClasses.map((c) => ({
        label: c.name,
        value: c.id,
      })),
      x: this.menuWindow.contentX,
      y: this.menuWindow.contentY,
      lineHeight: 12,
      onSelect: (item) => this.onClassSelect(item.value),
      onCancel: () => this.onBack(),
      eventBus: this.game.events,
    });
    this.menuWindow.addChild(this.classMenu);
    this.container.addChild(this.menuWindow);

    // Preview panel (right side)
    this.previewDisplay = new Container();
    this.previewDisplay.position.set(110, 36);
    this.container.addChild(this.previewDisplay);
    this.updatePreview(0);
  }

  private buildConfirm(): void {
    // Show party summary
    const summaryWin = new Window({ x: 16, y: 36, width: 224, height: 100 });
    for (let i = 0; i < this.selectedClasses.length; i++) {
      const cls = this.selectedClasses[i];
      const name = DEFAULT_NAMES[cls.id] ?? cls.name;
      const text = new BitmapText({
        text: `${name}  ${cls.name}  HP:${cls.baseStats.hp}`,
        style: { fontFamily: NES_FONT, fontSize: 8, fill: 0xffffff },
      });
      text.position.set(summaryWin.contentX, summaryWin.contentY + i * 16);
      summaryWin.addChild(text);
    }
    this.container.addChild(summaryWin);

    this.confirmWindow = new Window({ x: 64, y: 150, width: 128, height: 52 });
    this.confirmMenu = new Menu({
      items: [
        { label: 'Begin Adventure', value: 'begin' },
        { label: 'Back', value: 'back' },
      ],
      x: this.confirmWindow.contentX,
      y: this.confirmWindow.contentY,
      lineHeight: 16,
      onSelect: (item) => {
        if (item.value === 'begin') this.beginAdventure();
        else {
          this.selectedClasses.pop();
          this.currentSlot = this.selectedClasses.length;
          this.phase = 'select';
          this.buildUI();
        }
      },
      onCancel: () => {
        this.selectedClasses.pop();
        this.currentSlot = this.selectedClasses.length;
        this.phase = 'select';
        this.buildUI();
      },
      eventBus: this.game.events,
    });
    this.confirmWindow.addChild(this.confirmMenu);
    this.container.addChild(this.confirmWindow);
  }

  private updatePreview(classIndex: number): void {
    this.previewDisplay.removeChildren();
    const cls = this.baseClasses[classIndex];
    if (!cls) return;

    const previewWin = new Window({ x: 0, y: 0, width: 142, height: 92 });
    const lines = [
      cls.name,
      '',
      `HP:${cls.baseStats.hp}  STR:${cls.baseStats.strength}`,
      `AGI:${cls.baseStats.agility} INT:${cls.baseStats.intelligence}`,
      `VIT:${cls.baseStats.vitality} LCK:${cls.baseStats.luck}`,
      '',
      `Magic: W${cls.spellLevels.white}/B${cls.spellLevels.black}`,
    ];
    lines.forEach((line, i) => {
      const t = new BitmapText({
        text: line,
        style: { fontFamily: NES_FONT, fontSize: 8, fill: 0xffffff },
      });
      t.position.set(previewWin.contentX, previewWin.contentY + i * 10);
      previewWin.addChild(t);
    });
    this.previewDisplay.addChild(previewWin);
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
    this.currentSlot++;
    if (this.currentSlot >= 4) {
      this.phase = 'confirm';
    }
    this.buildUI();
  }

  private onBack(): void {
    if (this.currentSlot > 0) {
      this.selectedClasses.pop();
      this.currentSlot--;
      this.buildUI();
    } else {
      this.game.scenes.switchTo('title');
    }
  }

  private beginAdventure(): void {
    // Create characters and add to party
    for (const cls of this.selectedClasses) {
      const name = DEFAULT_NAMES[cls.id] ?? cls.name;
      const character = new Character({ name, classData: cls });
      this.game.party.add(character);
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
      { type: 'dialog', text: 'The world is shrouded in darkness...' },
      { type: 'dialog', text: 'Four Warriors of Light have appeared...' },
      { type: 'fade_in', duration: 500 },
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
    this.game.scenes.switchTo('exploration');
  }

  private cutsceneDialogResolve: (() => void) | null = null;

  onPause(): void {}
  onResume(): void {}

  exit(): void {
    this.container.removeChildren();
  }
}
