import { Game } from './core/Game.js';
import { BootScene } from './scenes/BootScene.js';
import { ExplorationScene } from './scenes/ExplorationScene.js';

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
  document.body.appendChild(game.canvas);
  game.scenes.register('boot', new BootScene());
  game.scenes.register('exploration', new ExplorationScene(game));
  await game.scenes.switchTo('exploration');
  game.app.renderer.background.color = 0x102040;
})().catch((e) => {
  console.error(e);
  showError(`Init failed: ${e.message || e}`);
});
