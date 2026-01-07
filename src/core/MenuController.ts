import { GameMode } from '../utils/Constants';
import { MenuParticleSystem } from '../ui/MenuParticleSystem';

export class MenuController {
    private overlay: HTMLElement;
    private particles: MenuParticleSystem;
    private onStart: (mode: GameMode) => void;

    constructor(onStart: (mode: GameMode) => void) {
        this.onStart = onStart;

        const overlay = document.getElementById('menu-overlay');
        if (!overlay) throw new Error('Menu overlay not found');
        this.overlay = overlay;

        this.particles = new MenuParticleSystem('menu-particles');
        this.setupListeners();
    }

    private setupListeners(): void {
        const btnSingle = document.getElementById('btn-single');
        const btnMulti = document.getElementById('btn-multi');

        if (btnSingle) {
            btnSingle.addEventListener('click', () => {
                console.log('Single Player Selected');
                this.startGame(GameMode.SINGLE_PLAYER);
            });
        }

        if (btnMulti) {
            btnMulti.addEventListener('click', () => {
                console.log('Two Players Selected');
                this.startGame(GameMode.TWO_PLAYER);
            });
        }
    }

    private startGame(mode: GameMode): void {
        this.hide();
        this.particles.stop();
        this.onStart(mode);
    }

    show(): void {
        this.overlay.classList.remove('hidden');
        this.particles.start();
    }

    hide(): void {
        this.overlay.classList.add('hidden');
    }
}
