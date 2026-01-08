import { Constants } from '../utils/Constants';
import type { ResourceManager } from './ResourceManager';
import type { Player } from '../entities/Player';
import type { Ball } from '../entities/Ball';
import type { ParticleSystem } from '../entities/ParticleSystem';

export class Renderer {
    private ctx: CanvasRenderingContext2D;
    private backgroundCache: HTMLCanvasElement | null = null;

    constructor(
        private canvas: HTMLCanvasElement,
        private resourceManager: ResourceManager
    ) {
        this.ctx = canvas.getContext('2d')!;
        this.canvas.width = Constants.CANVAS_WIDTH;
        this.canvas.height = Constants.CANVAS_HEIGHT;

        // 禁用图像平滑以提升性能
        this.ctx.imageSmoothingEnabled = false;
    }

    getContext(): CanvasRenderingContext2D {
        return this.ctx;
    }

    private cacheBackground(): void {
        if (this.backgroundCache) return;

        this.backgroundCache = document.createElement('canvas');
        this.backgroundCache.width = this.canvas.width;
        this.backgroundCache.height = this.canvas.height;
        const ctx = this.backgroundCache.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;

        const bg = this.resourceManager.getImage('background');
        if (bg) {
            ctx.drawImage(bg, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            ctx.fillStyle = '#D2691E';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)';
            ctx.lineWidth = 2;
            for (let i = 0; i < this.canvas.width; i += 30) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, this.canvas.height);
                ctx.stroke();
            }
        }
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, Constants.GROUND_Y);
        ctx.lineTo(this.canvas.width, Constants.GROUND_Y);
        ctx.stroke();
    }

    clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    renderBackground(): void {
        if (!this.backgroundCache) {
            this.cacheBackground();
        }
        if (this.backgroundCache) {
            this.ctx.drawImage(this.backgroundCache, 0, 0);
        }
    }

    renderScoreboard(leftScore: number, rightScore: number): void {
        const scoreBg = this.resourceManager.getImage('score_bg');
        const centerX = this.canvas.width / 2;
        const bgWidth = 260;  // 从200增加到260
        const bgHeight = 90;  // 从70增加到90

        if (scoreBg) {
            this.ctx.drawImage(scoreBg, centerX - bgWidth / 2, 15, bgWidth, bgHeight);
        } else {
            this.ctx.fillStyle = '#FFFACD';
            this.ctx.strokeStyle = '#DAA520';
            this.ctx.lineWidth = 2;
            this.ctx.save();
            this.ctx.translate(centerX, 50);
            this.ctx.rotate(-0.02);
            this.ctx.fillRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight);
            this.ctx.strokeRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight);
            this.ctx.restore();
        }

        this.ctx.font = 'bold 32px "Permanent Marker", cursive';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        this.ctx.fillStyle = '#000000ff';
        this.ctx.fillText(leftScore.toString(), centerX - 50, 60);  // 从50调整到60
        this.ctx.strokeStyle = '#ffffffff';
        this.ctx.lineWidth = 1;  // 从3减小到1.5，让描边更细
        this.ctx.strokeText(leftScore.toString(), centerX - 50, 60);  // 从50调整到60

        this.ctx.fillText('-', centerX, 60);  // 从50调整到60
        this.ctx.strokeText('-', centerX, 60);  // 从50调整到60

        this.ctx.fillText(rightScore.toString(), centerX + 50, 60);  // 从50调整到60
        this.ctx.strokeText(rightScore.toString(), centerX + 50, 60);  // 从50调整到60
    }

    renderPlayerNames(player2Name: string = 'AI'): void {
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';

        // 绘制名字背景
        const labelBg = this.resourceManager.getImage('label_bg');
        if (labelBg) {
            const bgWidth = 100;
            const bgHeight = 40;
            // 玩家1背景
            this.ctx.drawImage(labelBg, 130 - bgWidth / 2, 90, bgWidth, bgHeight);

            // 玩家2/AI背景（镜像翻转）
            this.ctx.save();
            this.ctx.translate(670, 90 + bgHeight / 2); // 移动到图片中心
            this.ctx.scale(-1, 1); // 水平翻转
            this.ctx.drawImage(labelBg, -bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight);
            this.ctx.restore();
        }

        this.ctx.font = '14px "Permanent Marker", cursive';
        this.ctx.fillStyle = '#000000ff'; // 改为黑色以在背景上更清晰（假设背景较深）
        this.ctx.fillText('玩家 1', 130, 103);

        this.ctx.font = '14px "Permanent Marker", cursive';
        this.ctx.fillStyle = '#000000ff'; // 改为白色
        this.ctx.fillText(player2Name, 670, 103);
    }

    renderServeHint(): void {
        this.ctx.font = '16px "Permanent Marker", cursive';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#FFD700';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 3;
        const text = '按S键发球';
        this.ctx.strokeText(text, 130, 180);
        this.ctx.fillText(text, 130, 180);
    }

    renderGameOver(winner: string): void {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = 'bold 48px "Permanent Marker", cursive';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#FFD700';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 4;
        const centerY = this.canvas.height / 2;
        this.ctx.strokeText(`${winner} 获胜!`, this.canvas.width / 2, centerY - 30);
        this.ctx.fillText(`${winner} 获胜!`, this.canvas.width / 2, centerY - 30);
        this.ctx.font = '16px "Permanent Marker", cursive';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillText('按空格键重新开始', this.canvas.width / 2, centerY + 30);
    }

    renderScene(
        player1: Player,
        player2: Player,
        ball: Ball,
        particles: ParticleSystem,
        leftScore: number,
        rightScore: number,
        showServeHint: boolean = false,
        player2Name: string = 'AI'
    ): void {
        this.clear();
        this.renderBackground();
        // 已删除 this.renderNet() - 球网现在在背景图中
        player1.render(this.ctx);
        player2.render(this.ctx);
        ball.render(this.ctx);
        particles.render(this.ctx);
        this.renderScoreboard(leftScore, rightScore);
        this.renderPlayerNames(player2Name);

        if (showServeHint) {
            this.renderServeHint();
        }
    }
}
