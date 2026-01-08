export class MenuParticleSystem {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private particles: Particle[] = [];
    private mouse = { x: -1000, y: -1000, vx: 0, vy: 0 };
    private lastMouse = { x: -1000, y: -1000 };
    private isRunning: boolean = false;
    private mouseTrail: { x: number, y: number, alpha: number }[] = [];

    private color: string;

    constructor(canvasId: string, color: string = '255, 215, 0') {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) throw new Error(`Canvas #${canvasId} not found`);
        this.canvas = canvas;
        this.color = color;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2D context');
        this.ctx = ctx;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Use document for mouse move to capture it over the UI overlay
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    }

    private resize(): void {
        const parent = this.canvas.parentElement;
        if (parent) {
            this.canvas.width = parent.clientWidth;
            this.canvas.height = parent.clientHeight;
        }
    }

    private handleMouseMove(e: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.mouse.vx = x - this.mouse.x;
        this.mouse.vy = y - this.mouse.y;
        this.mouse.x = x;
        this.mouse.y = y;

        // Add to trail
        const speed = Math.sqrt(this.mouse.vx ** 2 + this.mouse.vy ** 2);
        if (speed > 5) {
            this.mouseTrail.push({ x, y, alpha: 1.0 });
        }
    }

    start(): void {
        this.isRunning = true;
        this.initParticles();
        this.animate();
    }

    stop(): void {
        this.isRunning = false;
    }

    private initParticles(): void {
        this.particles = [];
        const count = 100;
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(this.canvas.width, this.canvas.height, this.color));
        }
    }

    private animate(): void {
        if (!this.isRunning) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw mouse trail
        for (let i = this.mouseTrail.length - 1; i >= 0; i--) {
            const p = this.mouseTrail[i];
            p.alpha -= 0.05;
            if (p.alpha <= 0) {
                this.mouseTrail.splice(i, 1);
                continue;
            }
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 2 + p.alpha * 5, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${this.color}, ${p.alpha})`;
            this.ctx.fill();
        }

        // Update and draw particles
        this.particles.forEach(p => {
            p.update(this.mouse.x, this.mouse.y, this.canvas.width, this.canvas.height);
            p.draw(this.ctx);
        });

        requestAnimationFrame(() => this.animate());
    }
}

class Particle {
    x: number;
    y: number;
    size: number;
    vx: number;
    vy: number;
    baseColor: string;

    constructor(w: number, h: number, color: string) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.size = Math.random() * 3 + 1;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = -Math.random() * 1 - 0.2; // Float upwards
        this.baseColor = `rgba(${color}, ${Math.random() * 0.5 + 0.2})`;
    }

    update(mx: number, my: number, w: number, h: number): void {
        this.x += this.vx;
        this.y += this.vy;

        // Mouse repulsion
        const dx = this.x - mx;
        const dy = this.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const forceDist = 100;

        if (dist < forceDist) {
            const angle = Math.atan2(dy, dx);
            const force = (forceDist - dist) / forceDist;
            const push = force * 5;
            this.x += Math.cos(angle) * push;
            this.y += Math.sin(angle) * push;
        }

        // Wrap around
        if (this.y < -10) this.y = h + 10;
        if (this.x < -10) this.x = w + 10;
        if (this.x > w + 10) this.x = -10;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.baseColor;
        ctx.fill();
    }
}
