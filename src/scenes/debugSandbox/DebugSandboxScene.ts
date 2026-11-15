import { BitmapText, Container, Graphics } from 'pixi.js';
import type { Scene } from '../../types/index.js';
import type { Game } from '../../core/Game.js';
import { Window } from '../../ui/Window.js';
import { Menu } from '../../ui/Menu.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { FONT_SIZE, FONT_SIZE_LG, GAME_HEIGHT, GAME_WIDTH } from '../../core/LayoutConstants.js';
import { getSettings, setMessageSpeed } from '../../core/Settings.js';
import { ClassRegistry } from '../../data/ClassRegistry.js';
import type { Kits } from '../../systems/debugParty.js';
import {
  CUSTOM, addCustom, configKey, enemiesOf, parseDeepLink, removeLastCustom, sanitizeConfig, type SandboxConfig,
  type SandboxData,
} from './sandboxModel.js';
import { ROWS, changeRow, nextSpeed, rowLabel, type RowContext, type SandboxRow } from './sandboxRows.js';
import { loadSandboxConfig, sandboxSession, saveSandboxConfig, type SandboxSession } from './sandboxSession.js';
import { startSandboxBattle } from './sandboxBattle.js';
import { CustomEnemyPicker } from './CustomEnemyPicker.js';

const FIGHT_INDEX = ROWS.indexOf('fight');

interface Loaded { data: SandboxData; kits: Kits; enemies: { id: string; name: string }[] }

/**
 * The dev-only battle sandbox (pass F item 8; docs/FEEDBACK_PLAN_2026-11-14.md §3.8): pick a level preset, four
 * classes, a kit, a formation (or a custom list), a background and the message speed, then Fight!. Every outcome comes
 * back here with the tally. Title (or X) goes back to the title screen.
 */
export class DebugSandboxScene implements Scene {
  readonly container = new Container();
  private loaded: Loaded | null = null;
  private config: SandboxConfig | null = null;
  private menu: Menu | null = null;
  private picker: CustomEnemyPicker | null = null;
  private main = new Container();
  private ready = false;
  private starting = false;
  /** The `?sandbox=` deep link starts its fight on the first frame. */
  private autoStart = false;

  constructor(private readonly game: Game, private readonly session: SandboxSession = sandboxSession) {}

  async enter(): Promise<void> {
    this.ready = false;
    this.starting = false;
    this.picker = null;
    this.container.removeChildren();
    // the battle was pushed over this scene (which hid it) and switchTo brings it back: show it again
    this.container.visible = true;
    try {
      this.loaded ??= await this.load();
    } catch (err) {
      console.error('Debug sandbox: cannot load its data', err);
      this.container.addChild(this.text('Debug sandbox: data failed to load (see the console). X: Title', 120, 120));
      this.ready = true;
      return;
    }
    const { data, enemies } = this.loaded;
    const ids = new Set(enemies.map((e) => e.id));
    const deep = this.session.deepLinkUsed ? null
      : parseDeepLink(data, typeof location === 'undefined' ? '' : location.search, ids);
    this.session.deepLinkUsed = true;
    this.config = deep ?? sanitizeConfig(data, loadSandboxConfig(), ids);
    this.autoStart = deep !== null;
    this.render(FIGHT_INDEX);
    this.ready = true;
  }

  private async load(): Promise<Loaded> {
    const data = await this.game.assets.loadYaml<SandboxData>('assets/data/debug-sandbox.yaml');
    if (!data?.levels?.length) throw new Error('debug-sandbox.yaml has no levels');
    const kits = await this.game.assets.loadYaml<Kits>('assets/data/kits.yaml');
    const list = await this.game.data.loadEnemies('assets/data/enemies.yaml');
    return { data, kits, enemies: list.map((e) => ({ id: e.id, name: e.name })) };
  }

  /** The configured setup (tests and tools). */
  get currentConfig(): SandboxConfig | null { return this.config; }
  get rowLabels(): string[] { return this.config && this.loaded ? ROWS.map((r) => rowLabel(r, this.config!, this.ctx())) : []; }
  get selectedRow(): SandboxRow | null { return this.menu ? ROWS[this.menu.selectedIndex] : null; }
  get pickerOpen(): boolean { return this.picker !== null; }

  update(_dt: number): void {
    if (!this.ready || this.starting) return;
    const input = this.game.input;
    if (!this.loaded || !this.menu) {
      if (input.isJustPressed('cancel')) this.toTitle();
      return;
    }
    if (this.autoStart) {
      this.autoStart = false;
      this.fight();
      return;
    }
    if (this.picker) {
      this.picker.update(input);
      return;
    }
    const dir = input.isJustPressed('left') ? -1 : input.isJustPressed('right') ? 1 : 0;
    if (dir !== 0) {
      this.change(ROWS[this.menu.selectedIndex], dir);
      return;
    }
    this.menu.update(input);
  }

  private ctx(): RowContext {
    const enemies = this.loaded?.enemies ?? [];
    return {
      data: this.loaded!.data,
      kits: this.loaded!.kits,
      className: (id) => ClassRegistry.getClass(id)?.name ?? id,
      enemyName: (id) => enemies.find((e) => e.id === id)?.name ?? id,
      speed: getSettings().messageSpeed,
    };
  }

  private setConfig(config: SandboxConfig): void {
    this.config = config;
    saveSandboxConfig(config);
  }

  private change(row: SandboxRow, dir: number): void {
    if (!this.loaded || !this.config) return;
    if (row === 'speed') setMessageSpeed(nextSpeed(getSettings().messageSpeed, dir));
    else {
      const next = changeRow(row, this.config, this.loaded.data, dir);
      if (!next) return;
      this.setConfig(next);
    }
    this.game.events.emit('cursorMove', {});
    this.render(this.menu?.selectedIndex ?? FIGHT_INDEX);
  }

  private select(row: SandboxRow): void {
    if (row === 'fight') this.fight();
    else if (row === 'title') this.toTitle();
    else if (row === 'enemies') this.openPicker();
    else this.change(row, 1);
  }

  private fight(): void {
    if (!this.loaded || !this.config || this.starting) return;
    this.starting = true;
    saveSandboxConfig(this.config);
    startSandboxBattle(this.game, this.loaded.data, this.config, this.loaded.kits, this.session)
      .then((ok) => { if (!ok) this.starting = false; })
      .catch((err: unknown) => {
        console.error('Debug sandbox: the battle failed to start', err);
        this.starting = false;
      });
  }

  private toTitle(): void {
    if (this.starting) return;
    this.starting = true;
    Promise.resolve(this.game.scenes.switchTo('title')).catch((err: unknown) => {
      console.error('Debug sandbox: cannot open the title', err);
      this.starting = false;
    });
  }

  private openPicker(index = 0): void {
    if (!this.loaded || !this.config) return;
    const { data } = this.loaded;
    if (this.config.formation !== CUSTOM) {
      this.setConfig({ ...this.config, formation: CUSTOM, custom: enemiesOf(data, this.config) });
    }
    const edit = (next: SandboxConfig, keep: number): void => {
      this.setConfig(next);
      this.render(this.menu?.selectedIndex ?? FIGHT_INDEX);
      this.openPicker(keep);
    };
    const picker = new CustomEnemyPicker(this.loaded.enemies, {
      add: (id) => {
        const { config, added } = addCustom(this.config!, id);
        if (!added) console.warn(`Debug sandbox: the custom list is full (${config.custom.length})`);
        edit(config, picker.selectedIndex);
      },
      removeLast: () => edit(removeLastCustom(this.config!), picker.selectedIndex),
      clear: () => edit({ ...this.config!, custom: [] }, picker.selectedIndex),
      close: () => {
        this.container.removeChild(picker);
        this.picker = null;
        this.menu?.setActive(true);
      },
    }, this.game.events, 1240, 120, index);
    if (this.picker) this.container.removeChild(this.picker);
    picker.setCurrent(this.config.custom);
    this.picker = picker;
    this.menu?.setActive(false);
    this.container.addChild(picker);
  }

  private text(s: string, x: number, y: number, size = FONT_SIZE, fill = 0xffffff): BitmapText {
    const t = new BitmapText({ text: s, style: { fontFamily: NES_FONT, fontSize: size, fill } });
    t.position.set(x, y);
    return t;
  }

  private render(index: number): void {
    if (!this.loaded || !this.config) return;
    this.container.removeChild(this.main);
    this.main.destroy({ children: true });
    this.main = new Container();
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fill(0x000000);
    this.main.addChild(bg, this.text('BATTLE SANDBOX (dev)', 80, 50, FONT_SIZE_LG));
    const ctx = this.ctx();
    const win = new Window({ x: 60, y: 120, width: 1160, height: ROWS.length * 56 + 48 });
    this.menu = new Menu({
      items: ROWS.map((r) => ({ label: rowLabel(r, this.config!, ctx), value: r })),
      x: win.contentX,
      y: win.contentY,
      lineHeight: 56,
      initialIndex: index,
      eventBus: this.game.events,
      onSelect: (_item, i) => this.select(ROWS[i]),
      onCancel: () => this.toTitle(),
    });
    win.addChild(this.menu);
    this.main.addChild(win);
    const results = this.session.summary(configKey(this.loaded.data, this.config));
    this.main.addChild(this.text(results, 80, 880, FONT_SIZE, 0xffff80));
    this.main.addChild(this.text('Up/Down: row   Left/Right: change   Z: select / Fight!   X: Title', 80, 940, FONT_SIZE,
      0xaaaaaa));
    this.container.addChildAt(this.main, 0);
    if (this.picker) this.menu.setActive(false);
  }

  onPause(): void {}

  onResume(): void {
    this.starting = false;
  }

  exit(): void {
    this.picker = null;
    this.menu = null;
    this.container.removeChildren();
  }
}
