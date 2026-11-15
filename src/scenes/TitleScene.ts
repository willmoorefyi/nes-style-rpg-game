import { Container, BitmapText, Graphics } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import type { LoadScene } from './LoadScene.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';
import { SaveManager } from '../systems/SaveManager.js';
import { NES_FONT } from '../ui/NESFont.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_SIZE, WINDOW_PADDING } from '../core/LayoutConstants.js';
import { takeBestiaryDeepLink } from './bestiary/bestiaryLink.js';
import { takeSandboxDeepLink } from './debugSandbox/sandboxLink.js';

export class TitleScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private menu!: Menu;
  /** A choice was confirmed and its scene is on the way: further confirms are ignored (S3). */
  private starting = false;

  constructor(game: Game) {
    this.game = game;
  }

  enter(): void {
    this.starting = false;
    this.playTitleMusic();
    this.container.removeChildren();
    // a scene pushed over the title (the debug sandbox) hid it; switchTo('title') brings it back without showing it
    this.container.visible = true;

    // Black background
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fill(0x000000);
    this.container.addChild(bg);

    // Title text
    const title = new BitmapText({
      text: 'FINAL FANTASY',
      style: { fontFamily: NES_FONT, fontSize: 48, fill: 0xffffff },
    });
    title.anchor.set(0.5);
    title.position.set(GAME_WIDTH / 2, 300);
    this.container.addChild(title);

    // Subtitle
    const subtitle = new BitmapText({
      text: 'Warriors of Light',
      style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xaaaaaa },
    });
    subtitle.anchor.set(0.5);
    subtitle.position.set(GAME_WIDTH / 2, 400);
    this.container.addChild(subtitle);

    // Menu window
    const hasSaves = SaveManager.getSaveSlots().some((s) => s !== null);
    const menuItems = [
        { label: 'New Game', value: 'new' },
        { label: 'Continue', value: 'continue', enabled: hasSaves },
        ...(import.meta.env.DEV ? [{ label: 'Debug', value: 'debug' }, { label: 'Bestiary', value: 'bestiary' }] : []),
      ];
    const menuWindow = new Window({ x: 760, y: 550, width: 400, height: menuItems.length * 48 + 2 * WINDOW_PADDING });
    this.menu = new Menu({
      items: menuItems,
      x: menuWindow.contentX,
      y: menuWindow.contentY,
      lineHeight: 48,
      onSelect: (item) => this.onSelect(item.value),
      eventBus: this.game.events,
    });
    menuWindow.addChild(this.menu);
    this.container.addChild(menuWindow);
    if (takeBestiaryDeepLink()) this.onSelect('bestiary');   // ?bestiary=<id> (dev), once per page load
    else if (takeSandboxDeepLink()) this.onSelect('debug');   // ?sandbox=<level> (dev): the sandbox starts its fight
  }

  update(_dt: number): void {
    if (this.menu) {
      this.menu.update(this.game.input);
    }
  }

  private onSelect(value: string): void {
    if (this.starting) return;
    this.starting = true;
    const failed = (what: string) => (err: unknown) => {
      console.error(what, err);
      this.starting = false;
    };
    if (value === 'new') {
      Promise.resolve(this.game.scenes.switchTo('partyCreation')).catch(failed('Failed to open party creation:'));
    } else if (value === 'continue') {
      // U6: from the title nothing unsaved can be lost, so the Load prompt neither warns nor defaults to No
      Promise.resolve(this.game.scenes.push('loadMenu'))
        .then(() => this.game.scenes.get<LoadScene>('loadMenu')?.openedFromTitle())
        .catch(failed('Failed to open the load menu:'));
    } else if (value === 'bestiary') {
      Promise.resolve(this.game.scenes.push('bestiary')).catch(failed('Failed to open the bestiary:'));
    } else if (import.meta.env.DEV && value === 'debug') {
      // dev only (the gate lets Vite drop the debug chunks from production): ?scenario=<id> runs that scenario as
      // before; otherwise Debug opens the battle sandbox (docs/FEEDBACK_PLAN_2026-11-14.md §3.8)
      const search = typeof location === 'undefined' ? '' : location.search;
      if (!new URLSearchParams(search).has('scenario')) {
        Promise.resolve(this.game.scenes.push('debugSandbox')).catch(failed('Failed to open the debug sandbox:'));
        return;
      }
      import('../systems/DebugScenarioLoader.js').then(({ DebugScenarioLoader, pickScenario }) => {
        const loader = new DebugScenarioLoader(this.game);
        return loader.loadScenarios().then((scenarios) => {
          const scenario = pickScenario(scenarios, search);
          if (scenario) return loader.run(scenario);
          console.error('No debug scenario to run');
          this.starting = false;
        });
      }).catch(failed('Failed to start the debug scenario:'));
    } else {
      this.starting = false;
    }
  }

  /** The title track (I3); playMusic keeps a track that is already playing, so a resume doesn't restart it. */
  private playTitleMusic(): void {
    this.game.audio.playMusic('title').catch((e) => console.error('Title music failed:', e));
  }

  onPause(): void {}

  /** Back on the title (a debug battle ended, the load menu was closed): the menu takes choices again. */
  onResume(): void {
    this.starting = false;
    this.playTitleMusic();
  }

  exit(): void {
    this.container.removeChildren();
  }
}
