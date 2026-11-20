import { Game } from './core/Game.js';
import { TitleScene } from './scenes/TitleScene.js';
import { domOverlay, traceWindow, watchContext } from './core/diagnostics.js';

function showError(msg: string): void {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:1em;background:#800;color:#fff;font-family:monospace;z-index:9999';
  el.textContent = msg;
  document.body.appendChild(el);
}

window.onerror = (msg) => showError(`Error: ${msg}`);
window.onunhandledrejection = (e) => showError(`Unhandled: ${e.reason}`);

(async () => {
  const game = new Game();
  await game.init();
  // Expose game object in dev mode for debugging/testing
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__game = game;
  }
  document.body.appendChild(game.canvas);
  // a lost WebGL context or a halted loop says so over the page instead of leaving it black or frozen (P3-07)
  const overlay = domOverlay(document);
  game.fatalOverlay = overlay;
  watchContext(game.canvas, overlay, game.trace);
  if (game.trace) {
    traceWindow(window, game.trace);
    (window as unknown as Record<string, unknown>).__trace = game.trace.lines;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    game.trace.log('page start', `navigation ${nav?.type ?? 'unknown'}`);
    // dev server: the file that made Vite reload the whole page, if that is what happened
    import.meta.hot?.on('vite:beforeFullReload', (p: { path?: string }) => game.trace?.log('vite full reload', String(p?.path)));
  }
  game.focusCanvas();
  // Click anywhere on the page to ensure canvas gets focus
  document.addEventListener('click', () => game.focusCanvas());
  game.scenes.register('title', new TitleScene(game));
  game.scenes.registerLazy('partyCreation', async () => {
    const { PartyCreationScene } = await import('./scenes/PartyCreationScene.js');
    return new PartyCreationScene(game);
  });
  game.scenes.registerLazy('exploration', async () => {
    const { ExplorationScene } = await import('./scenes/ExplorationScene.js');
    return new ExplorationScene(game);
  });
  game.scenes.registerLazy('status', async () => {
    const { StatusScene } = await import('./scenes/StatusScene.js');
    return new StatusScene(game);
  });
  game.scenes.registerLazy('fieldMenu', async () => {
    const { FieldMenuScene } = await import('./scenes/FieldMenuScene.js');
    return new FieldMenuScene(game);
  });
  game.scenes.registerLazy('itemMenu', async () => {
    const { ItemMenuScene } = await import('./scenes/ItemMenuScene.js');
    return new ItemMenuScene(game);
  });
  game.scenes.registerLazy('equip', async () => {
    const { EquipScene } = await import('./scenes/EquipScene.js');
    return new EquipScene(game);
  });
  game.scenes.registerLazy('fieldMagic', async () => {
    const { FieldMagicScene } = await import('./scenes/FieldMagicScene.js');
    return new FieldMagicScene(game);
  });
  game.scenes.registerLazy('fieldOrder', async () => {
    const { FieldOrderScene } = await import('./scenes/FieldOrderScene.js');
    return new FieldOrderScene(game);
  });
  game.scenes.registerLazy('saveMenu', async () => {
    const { SaveScene } = await import('./scenes/SaveScene.js');
    return new SaveScene(game);
  });
  game.scenes.registerLazy('loadMenu', async () => {
    const { LoadScene } = await import('./scenes/LoadScene.js');
    return new LoadScene(game);
  });
  game.scenes.registerLazy('boosts', async () => {
    const { BoostsScene } = await import('./scenes/BoostsScene.js');
    return new BoostsScene(game);
  });
  game.scenes.registerLazy('config', async () => {
    const { ConfigScene } = await import('./scenes/ConfigScene.js');
    return new ConfigScene(game);
  });
  game.scenes.registerLazy('bestiary', async () => {
    const { BestiaryScene } = await import('./scenes/bestiary/BestiaryScene.js');
    return new BestiaryScene(game);
  });
  if (import.meta.env.DEV) {
    game.scenes.registerLazy('debugSandbox', async () => {
      const { DebugSandboxScene } = await import('./scenes/debugSandbox/DebugSandboxScene.js');
      return new DebugSandboxScene(game);
    });
  }
  await game.scenes.switchTo('title');
  game.app.renderer.background.color = 0x102040;
})().catch((e) => {
  console.error(e);
  showError(`Init failed: ${e.message || e}`);
});
