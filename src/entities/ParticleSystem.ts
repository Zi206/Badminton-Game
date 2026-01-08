import { Constants } from '../utils/Constants';

// 单个粒子
class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    color: string;
    rotation: number;
    rotationSpeed: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8 - 2;
        this.life = Constants.PARTICLE_LIFETIME;
        this.maxLife = Constants.PARTICLE_LIFETIME;
        this.size = Math.random() * 6 + 3;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.3;

        // 随机颜色（纸屑效果）
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
    }

    update(): void {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.3; // 重力
        this.vx *= 0.99; // 空气阻力
        this.rotation += this.rotationSpeed;
        this.life--;
    }

    isAlive(): boolean {
        return this.life > 0;
    }

    getAlpha(): number {
        return this.life / this.maxLife;
    }
}

// 粒子系统
export class ParticleSystem {
    private particles: Particle[] = [];

    emit(x: number, y: number, count: number = Constants.PARTICLE_COUNT): void {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y));
        }
    }

    update(): void {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (!this.particles[i].isAlive()) {
                this.particles.splice(i, 1);
            }
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        // 批量渲染粒子，减少状态切换
        for (const particle of this.particles) {
            ctx.save();
            ctx.globalAlpha = particle.getAlpha();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation);

            // 绘制矩形纸屑
            ctx.fillStyle = particle.color;
            const halfSize = particle.size / 2;
            ctx.fillRect(-halfSize, -halfSize, particle.size, particle.size);

            ctx.restore();
        }
    }

    clear(): void {
        this.particles = [];
    }
}
