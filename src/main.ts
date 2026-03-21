import { Game } from './core/Game.js';
import { BootScene } from './scenes/BootScene.js';

(async () => {
  const game = new Game();
  await game.init();
  document.body.appendChild(game.canvas);
  game.scenes.register('boot', new BootScene());
  await game.scenes.switchTo('boot');
  game.app.renderer.background.color = 0x102040;
})();