import { Input } from './Input';
import { NetworkManager, MessageType, InputPacket } from './NetworkManager';

/**
 * 网络输入 - 从网络接收对手的输入状态
 * 用于 Guest 端接收 Host 的状态，或 Host 端接收 Guest 的输入
 */
export class NetworkInput implements Input {
    left: boolean = false;
    right: boolean = false;
    jump: boolean = false;
    upward: boolean = false;
    downward: boolean = false;
    hit: boolean = false;

    private networkManager: NetworkManager;
    private lastUpdateTime: number = 0;
    private onOtherMessage: ((data: any) => void) | null = null;

    // 输入缓冲（用于平滑网络抖动）
    private inputBuffer: InputPacket[] = [];
    private readonly BUFFER_SIZE = 3;

    constructor(networkManager: NetworkManager, onOtherMessage?: (data: any) => void) {
        this.networkManager = networkManager;
        this.onOtherMessage = onOtherMessage || null;

        // 监听网络消息
        networkManager.setOnMessage((data) => {
            if (data.type === MessageType.INPUT_STATE) {
                this.handleInputPacket(data as InputPacket);
            } else if (this.onOtherMessage) {
                // 转发其他类型的消息（如 RESTART）
                this.onOtherMessage(data);
            }
        });
    }

    /**
     * 处理收到的输入数据包
     */
    private handleInputPacket(packet: InputPacket): void {
        // 添加到缓冲区
        this.inputBuffer.push(packet);

        // 保持缓冲区大小
        while (this.inputBuffer.length > this.BUFFER_SIZE) {
            this.inputBuffer.shift();
        }

        // 应用最新的输入
        this.applyInput(packet);
    }

    /**
     * 应用输入状态
     */
    private applyInput(packet: InputPacket): void {
        this.left = packet.left;
        this.right = packet.right;
        this.jump = packet.jump;
        this.upward = packet.upward;
        this.downward = packet.downward;
        this.hit = packet.hit;
        this.lastUpdateTime = packet.timestamp;
    }

    /**
     * 获取输入的延迟（ms）
     */
    getInputAge(): number {
        return Date.now() - this.lastUpdateTime;
    }

    /**
     * 重置输入状态
     */
    reset(): void {
        this.left = false;
        this.right = false;
        this.jump = false;
        this.upward = false;
        this.downward = false;
        this.hit = false;
        this.inputBuffer = [];
    }

    /**
     * 空实现 - NetworkInput 不需要 update
     * 输入通过 handleInputPacket 异步更新
     */
    update(): void {
        // 检测输入超时（超过 500ms 没有收到新输入，重置为空闲状态）
        if (this.getInputAge() > 500) {
            this.left = false;
            this.right = false;
            this.jump = false;
            // 保持 upward/downward/hit，因为这些是瞬时输入
        }
    }
}

/**
 * 本地输入发送器 - 将本地输入发送到网络
 */
export class LocalInputSender {
    private networkManager: NetworkManager;
    private localInput: Input;
    private lastSentState: string = '';
    private sendInterval: number | null = null;

    constructor(networkManager: NetworkManager, localInput: Input) {
        this.networkManager = networkManager;
        this.localInput = localInput;
    }

    /**
     * 开始定时发送输入
     */
    startSending(intervalMs: number = 16): void { // 约 60fps
        this.sendInterval = window.setInterval(() => {
            this.sendCurrentInput();
        }, intervalMs);
    }

    /**
     * 停止发送
     */
    stopSending(): void {
        if (this.sendInterval !== null) {
            clearInterval(this.sendInterval);
            this.sendInterval = null;
        }
    }

    /**
     * 发送当前输入状态
     */
    private sendCurrentInput(): void {
        const state = JSON.stringify({
            left: this.localInput.left,
            right: this.localInput.right,
            jump: this.localInput.jump,
            upward: this.localInput.upward,
            downward: this.localInput.downward,
            hit: this.localInput.hit,
        });

        // 只在状态变化时发送（减少带宽）
        // 但每隔一段时间强制发送一次（防止丢包）
        if (state !== this.lastSentState) {
            this.networkManager.sendInput({
                left: this.localInput.left,
                right: this.localInput.right,
                jump: this.localInput.jump,
                upward: this.localInput.upward,
                downward: this.localInput.downward,
                hit: this.localInput.hit,
            });
            this.lastSentState = state;
        }
    }
}
