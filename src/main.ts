import { Game } from './core/Game.js';
import { ExplorationScene } from './scenes/ExplorationScene.js';
import { StatusScene } from './scenes/StatusScene.js';
import { FieldMenuScene } from './scenes/FieldMenuScene.js';
import { ItemMenuScene } from './scenes/ItemMenuScene.js';
import { EquipScene } from './scenes/EquipScene.js';

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
  game.scenes.register('exploration', new ExplorationScene(game));
  game.scenes.register('status', new StatusScene(game));
  game.scenes.register('fieldMenu', new FieldMenuScene(game));
  game.scenes.register('itemMenu', new ItemMenuScene(game));
  game.scenes.register('equip', new EquipScene(game));
  await game.scenes.switchTo('exploration');
  game.app.renderer.background.color = 0x102040;
})().catch((e) => {
  console.error(e);
  showError(`Init failed: ${e.message || e}`);
});
