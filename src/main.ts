import { Game } from './core/Game';
import './styles/menu.css';
import './styles/online.css';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

if (!canvas) {
    throw new Error('Canvas element not found!');
}

const game = new Game(canvas);

game.init().then(() => {
    console.log('🎮 游戏初始化完成！');
    game.start();
}).catch((error) => {
    console.error('❌ 游戏初始化失败:', error);
});
