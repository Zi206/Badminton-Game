import { NetworkManager, ConnectionState, MessageType } from './NetworkManager';
import { GameMode } from '../utils/Constants';
import { MenuParticleSystem } from '../ui/MenuParticleSystem';

/**
 * 联机大厅控制器 - 管理创建房间/加入房间的UI和逻辑
 */
export class OnlineLobbyController {
    private lobbyElement: HTMLElement | null = null;
    private networkManager: NetworkManager;
    private particles: MenuParticleSystem;
    private onGameStart: ((isHost: boolean) => void) | null = null;
    private onBack: (() => void) | null = null;

    // UI 面板
    private mainPanel: HTMLElement | null = null;
    private hostPanel: HTMLElement | null = null;
    private joinPanel: HTMLElement | null = null;
    private waitingPanel: HTMLElement | null = null;

    constructor() {
        this.networkManager = new NetworkManager();
        this.particles = new MenuParticleSystem('online-particles', '0, 255, 255');
        this.setupUI();
        this.setupEventListeners();
    }

    /**
     * 设置 UI 结构
     */
    private setupUI(): void {
        this.lobbyElement = document.getElementById('online-lobby');
        this.mainPanel = document.getElementById('lobby-main');
        this.hostPanel = document.getElementById('lobby-host');
        this.joinPanel = document.getElementById('lobby-join');
        this.waitingPanel = document.getElementById('lobby-waiting');
    }

    /**
     * 设置事件监听
     */
    private setupEventListeners(): void {
        // 创建房间按钮
        document.getElementById('btn-create-room')?.addEventListener('click', () => {
            this.createRoom();
        });

        // 加入房间按钮
        document.getElementById('btn-join-room')?.addEventListener('click', () => {
            this.showPanel('join');
        });

        // 返回按钮
        document.querySelectorAll('.btn-back-lobby').forEach(btn => {
            btn.addEventListener('click', () => {
                this.networkManager.disconnect();
                this.showPanel('main');
            });
        });

        // 返回主菜单
        document.getElementById('btn-back-menu')?.addEventListener('click', () => {
            this.hide();
            this.onBack?.();
        });

        // 确认加入房间
        document.getElementById('btn-confirm-join')?.addEventListener('click', () => {
            const input = document.getElementById('room-code-input') as HTMLInputElement;
            if (input && input.value.length >= 4) {
                this.joinRoom(input.value);
            }
        });

        // 房间码输入框回车确认
        document.getElementById('room-code-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const input = e.target as HTMLInputElement;
                if (input.value.length >= 4) {
                    this.joinRoom(input.value);
                }
            }
        });

        // 网络状态变化
        this.networkManager.setOnStateChange((state) => {
            this.updateStatus(state);
        });

        // 对手连接
        this.networkManager.setOnPeerConnected(() => {
            this.showPanel('waiting');
            this.setStatus('OPPONENT CONNECTED! STARTING GAME...', 'success');

            // 2秒后开始游戏
            setTimeout(() => {
                this.startGame();
            }, 2000);
        });

        // 对手断开
        this.networkManager.setOnPeerDisconnected(() => {
            this.setStatus('OPPONENT DISCONNECTED', 'error');
            setTimeout(() => {
                this.showPanel('main');
            }, 2000);
        });
    }

    /**
     * 创建房间
     */
    private async createRoom(): Promise<void> {
        this.showPanel('host');
        this.setStatus('CREATING ROOM...', '');

        try {
            const roomId = await this.networkManager.createRoom();
            const roomCodeElement = document.getElementById('room-code');
            if (roomCodeElement) {
                roomCodeElement.textContent = roomId;
            }
            this.setStatus('WAITING FOR OPPONENT...', '');
        } catch (error) {
            console.error('Create room failed:', error);
            this.setStatus('CREATE FAILED, TRY AGAIN', 'error');
        }
    }

    /**
     * 加入房间
     */
    private async joinRoom(roomId: string): Promise<void> {
        this.setStatus('CONNECTING...', '');

        try {
            await this.networkManager.joinRoom(roomId);
            this.showPanel('waiting');
            this.setStatus('CONNECTED! WAITING...', 'success');

            // 2秒后开始游戏
            setTimeout(() => {
                this.startGame();
            }, 2000);
        } catch (error) {
            console.error('Join room failed:', error);
            this.setStatus('CONNECTION FAILED, CHECK CODE', 'error');
        }
    }

    /**
     * 开始游戏
     */
    private startGame(): void {
        this.hide();
        this.onGameStart?.(this.networkManager.getIsHost());
    }

    /**
     * 显示指定面板
     */
    private showPanel(panelName: 'main' | 'host' | 'join' | 'waiting'): void {
        this.mainPanel?.classList.remove('active');
        this.hostPanel?.classList.remove('active');
        this.joinPanel?.classList.remove('active');
        this.waitingPanel?.classList.remove('active');

        switch (panelName) {
            case 'main':
                this.mainPanel?.classList.add('active');
                break;
            case 'host':
                this.hostPanel?.classList.add('active');
                break;
            case 'join':
                this.joinPanel?.classList.add('active');
                break;
            case 'waiting':
                this.waitingPanel?.classList.add('active');
                break;
        }
    }

    /**
     * 更新状态显示
     */
    private updateStatus(state: ConnectionState): void {
        switch (state) {
            case ConnectionState.CONNECTING:
                this.setStatus('CONNECTING...', '');
                break;
            case ConnectionState.CONNECTED:
                this.setStatus('CONNECTED', 'success');
                break;
            case ConnectionState.DISCONNECTED:
                this.setStatus('DISCONNECTED', '');
                break;
            case ConnectionState.ERROR:
                this.setStatus('CONNECTION ERROR', 'error');
                break;
        }
    }

    /**
     * 设置状态文字
     */
    private setStatus(text: string, type: '' | 'success' | 'error'): void {
        const statusElements = document.querySelectorAll('.lobby-status');
        statusElements.forEach(el => {
            el.textContent = text;
            el.classList.remove('success', 'error');
            if (type) {
                el.classList.add(type);
            }
        });
    }

    /**
     * 显示大厅
     */
    show(): void {
        this.lobbyElement?.classList.add('visible');
        this.showPanel('main');
        this.particles.start();
    }

    /**
     * 隐藏大厅
     */
    hide(): void {
        this.lobbyElement?.classList.remove('visible');
        this.particles.stop();
    }

    /**
     * 获取网络管理器
     */
    getNetworkManager(): NetworkManager {
        return this.networkManager;
    }

    // 回调设置
    setOnGameStart(cb: (isHost: boolean) => void): void {
        this.onGameStart = cb;
    }

    setOnBack(cb: () => void): void {
        this.onBack = cb;
    }
}
