import { Game } from './core/Game.js';
import { BootScene } from './scenes/BootScene.js';
import { ExplorationScene } from './scenes/ExplorationScene.js';

(async () => {
  const game = new Game();
  await game.init();
  document.body.appendChild(game.canvas);
  game.scenes.register('boot', new BootScene());
  game.scenes.register('exploration', new ExplorationScene(game));
  await game.scenes.switchTo('exploration');
  game.app.renderer.background.color = 0x102040;
})();