/**
 * The bestiary (docs/BESTIARY_PLAN.md): every enemy in enemies.yaml with its stats, and beside them the enemy on a
 * battle background, looping its attack, hurt, cast and daze. Opened from the field menu (every build) and the title
 * (dev only, also `?bestiary=<id>`); X closes it (push / pop). Up/Down scroll, Left/Right page, Z plays the next
 * animation, Shift pauses. The preview rebuilds once the highlighted entry has been stable for 8 frames.
 */
import { Assets, BitmapText, Container, type Texture } from 'pixi.js';
import type { Scene } from '../../types/index.js';
import type { Game } from '../../core/Game.js';
import type { BestiaryData } from '../../types/bestiaryData.js';
import { DEFAULT_BESTIARY } from '../../core/bestiaryValidation.js';
import { Window } from '../../ui/Window.js';
import { Menu } from '../../ui/Menu.js';
import { HelpWindow } from '../../ui/HelpWindow.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { CHAR_WIDTH, FONT_SIZE } from '../../core/LayoutConstants.js';
import type { MonsterArtSource } from '../battle/AiEnemyView.js';
import { createBattleDevClock, type BattleDevClock } from '../battle/battleDevClock.js';
import { resolveMapPath } from '../../systems/MapLoader.js';
import { BestiaryPreview, CachedArt } from './BestiaryPreview.js';
import { BestiaryStatsPanel } from './BestiaryStatsPanel.js';
import { buildEntries, seenFlag, spellIdsOf, statLines, titleCount, type BestiaryEntry } from './bestiaryModel.js';
import { backgroundFor, habitatsOf, type Habitat } from './bestiaryHabitats.js';
import { takeBestiaryStartEntry } from './bestiaryLink.js';
import { neighbourSprites, showWhenReady } from './bestiaryPages.js';
import { battleArt, monsterSpriteKey } from '../../rendering/BattleArt.js';
import type { EnemyData, MapData } from '../../types/index.js';

export const BESTIARY_PATH = 'assets/data/bestiary.yaml';
export const TITLE_RECT = { x: 24, y: 24, width: 976, height: 84 } as const;
export const LIST_RECT = { x: 1024, y: 24, width: 872, height: 264 } as const;
/** Frames of raw dt the highlighted entry must stay before the preview rebuilds. */
export const PREVIEW_DEBOUNCE_FRAMES = 8;

export interface BestiaryDeps {
  art?: MonsterArtSource;
  loadTexture?: (path: string) => Promise<Texture>;
}

interface Book { data: BestiaryData; enemies: EnemyData[]; spellNames: Map<string, string>; habitats: Map<string, Habitat[]> }

interface Ui { book: Book; entries: BestiaryEntry[]; menu: Menu; preview: BestiaryPreview; stats: BestiaryStatsPanel;
  count: BitmapText; boss: BitmapText }

const text = (s = ''): BitmapText => new BitmapText({ text: s, style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });

export class BestiaryScene implements Scene {
  readonly container = new Container();
  private ui: Ui | null = null;
  private book: Book | null = null;
  private devClock: BattleDevClock | null = null;
  private statsIndex = -1;
  private previewIndex = -1;
  private stable = 0;
  private closing = false;
  private session = 0;

  constructor(private readonly game: Game, private readonly deps: BestiaryDeps = {}) {}

  async enter(): Promise<void> {
    const session = ++this.session;
    this.closing = false;
    this.container.visible = true;
    const book = this.book ?? (this.book = await this.load());
    if (session !== this.session) return;            // exited while loading
    this.devClock = createBattleDevClock();
    if (!book) { this.showNoData(); return; }
    this.build(book);
  }

  /** The current preview (tests and dev tools; read-only use). */
  get preview(): BestiaryPreview | null { return this.ui?.preview ?? null; }
  get previewPoses() { return this.ui?.preview.poses ?? null; }
  get stats(): BestiaryStatsPanel | null { return this.ui?.stats ?? null; }
  get selectedIndex(): number { return this.ui?.menu.selectedIndex ?? -1; }

  private async load(): Promise<Book | null> {
    const d = this.game.data;
    try {
      const data = await d.loadBestiary(BESTIARY_PATH);
      const [enemies, spells] = await Promise.all([d.loadEnemies('assets/data/enemies.yaml'),
        d.loadSpells('assets/data/spells.yaml').catch((err: unknown) => { console.error('Bestiary: spells.yaml failed', err); return []; })]);
      const maps: MapData[] = [];
      for (const id of data.habitats.maps) {
        try {
          maps.push(await d.loadMap(await resolveMapPath(d, id, true)));
        } catch (err) {
          console.error(`Bestiary: map "${id}" failed to load; its habitats are skipped`, err);
        }
      }
      if (!this.deps.art) await battleArt.load();
      return { data, enemies, spellNames: new Map(spells.map((s) => [s.id, s.name])), habitats: habitatsOf(maps) };
    } catch (err) {
      console.error('Bestiary: no bestiary data', err);
      return null;
    }
  }

  private build(book: Book): void {
    const { data } = book;
    const entries = buildEntries(book.enemies, data, book.habitats, (id) => this.game.gameFlags.has(seenFlag(id)));
    const titleWin = new Window({ ...TITLE_RECT });
    const title = text(data.labels.title);
    const count = text();
    const boss = text();
    title.position.set(titleWin.contentX, titleWin.contentY - 6);
    count.position.set(titleWin.contentX + (data.labels.title.length + 3) * CHAR_WIDTH, titleWin.contentY - 6);
    boss.position.set(titleWin.contentX + titleWin.contentWidth, titleWin.contentY - 6);
    boss.anchor.set(1, 0);
    titleWin.addChild(title, count, boss);
    this.container.addChild(titleWin);

    const preview = new BestiaryPreview(this.container, new CachedArt(this.deps.art ?? battleArt),
      this.deps.loadTexture ?? ((path) => Assets.load<Texture>(path)), data);

    const start = takeBestiaryStartEntry();
    let initialIndex = start ? entries.findIndex((e) => e.id === start) : 0;
    if (initialIndex < 0) {
      console.warn(`Bestiary: no enemy "${start}"; opening on 001`);
      initialIndex = 0;
    }
    const listWin = new Window({ ...LIST_RECT });
    const menu = new Menu({ items: entries.map((e) => ({ label: e.label, value: e.id, enabled: e.seen })),
      x: listWin.contentX, y: listWin.contentY, maxVisible: data.listRows, initialIndex,
      onSelect: () => preview.skip(), onCancel: () => this.close() });
    listWin.addChild(menu);
    this.container.addChild(listWin);

    const stats = new BestiaryStatsPanel(this.container);
    const help = new HelpWindow();
    help.setText(data.help);
    this.container.addChild(help);

    this.ui = { book, entries, menu, preview, stats, count, boss };
    this.statsIndex = -1;
    this.previewIndex = -1;
    this.showStats(menu.selectedIndex);
    this.showPreview(menu.selectedIndex);
  }

  private showNoData(): void {
    const stats = new BestiaryStatsPanel(this.container);
    stats.setMessage(DEFAULT_BESTIARY.labels.noData);
  }

  update(dt: number): void {
    const ui = this.ui;
    const input = this.game.input;
    if (!ui) {
      if (input.isJustPressed('cancel')) this.close();
      return;
    }
    const rows = ui.book.data.listRows;
    if (input.isJustPressed('right') || input.isJustPressed('left')) {
      const to = ui.menu.selectedIndex + (input.isJustPressed('right') ? rows : -rows);
      ui.menu.setIndex(Math.max(0, Math.min(ui.entries.length - 1, to)));
    } else if (input.isJustPressed('select')) {
      ui.preview.togglePause();
    }
    ui.menu.update(input);
    if (this.closing || this.ui !== ui) return;
    const i = ui.menu.selectedIndex;
    if (i !== this.statsIndex) {
      this.showStats(i);
      this.stable = 0;
    } else {
      this.stable += dt;
    }
    if (i !== this.previewIndex && this.stable >= PREVIEW_DEBOUNCE_FRAMES) this.showPreview(i);
    ui.preview.update(this.devClock ? this.devClock.frameDt(dt) : dt);
  }

  private showStats(i: number): void {
    const ui = this.ui;
    const entry = ui?.entries[i];
    if (!ui || !entry) return;
    this.statsIndex = i;
    const { data, spellNames } = ui.book;
    ui.stats.setLines(statLines(entry, data, (id) => spellNames.get(id) ?? id));
    ui.count.text = titleCount(entry, ui.entries.length, data);
    ui.boss.text = entry.boss ? data.labels.boss : '';
  }

  private showPreview(i: number): void {
    const ui = this.ui;
    const entry = ui?.entries[i];
    if (!ui || !entry) return;
    this.previewIndex = i;
    const data = ui.book.data;
    const bg = entry.seen ? backgroundFor(entry.id, entry.habitats, data) : data.backgrounds.default;
    const show = (): void => ui.preview.show({ enemy: entry.enemy, seen: entry.seen, hasSpells: spellIdsOf(entry.enemy).length > 0 }, bg);
    showWhenReady(this.deps.art ?? battleArt, entry.seen ? monsterSpriteKey(entry.enemy) : null, neighbourSprites(ui.entries, i),
      show, () => this.ui === ui && this.previewIndex === i);
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    Promise.resolve(this.game.scenes.pop()).catch((err: unknown) => {
      console.error('Bestiary: failed to close', err);
      this.closing = false;
    });
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {
    this.session++;
    this.ui?.preview.destroy();
    this.ui = null;
    this.devClock?.dispose();
    this.devClock = null;
    for (const child of this.container.removeChildren()) child.destroy({ children: true });
  }
}
