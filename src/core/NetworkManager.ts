import Peer, { DataConnection } from 'peerjs';
import { GameMode } from '../utils/Constants';

/**
 * 网络消息类型
 */
export enum MessageType {
    INPUT_STATE = 'INPUT_STATE',       // 输入状态
    GAME_STATE = 'GAME_STATE',         // 游戏状态
    GAME_OVER = 'GAME_OVER',           // 游戏结束
    RESTART = 'RESTART',               // 重新开始
    READY = 'READY',                   // 准备就绪
    START_GAME = 'START_GAME',         // 开始游戏
    PING = 'PING',                     // 延迟测试
    PONG = 'PONG',                     // 延迟响应
}

/**
 * 输入状态数据包
 */
export interface InputPacket {
    type: MessageType.INPUT_STATE;
    timestamp: number;
    left: boolean;
    right: boolean;
    jump: boolean;
    upward: boolean;
    downward: boolean;
    hit: boolean;
}

/**
 * 游戏状态数据包
 */
export interface GameStatePacket {
    type: MessageType.GAME_STATE;
    timestamp: number;
    ball: { x: number; y: number; vx: number; vy: number };
    player1: {
        x: number;
        y: number;
        vx: number;
        vy: number;
        isSwinging: boolean;
        swingProgress: number;
        swingType: number;  // SwingType enum value
        animationTime: number;
        isOnGround: boolean;
        isServingMode: boolean;
        hitCooldown: number;
    };
    player2: {
        x: number;
        y: number;
        vx: number;
        vy: number;
        isSwinging: boolean;
        swingProgress: number;
        swingType: number;
        animationTime: number;
        isOnGround: boolean;
        isServingMode: boolean;
        hitCooldown: number;
    };
    score: { left: number; right: number };
    isServing: boolean;
    waitingForServe: boolean;
    servingSide: string;
    isGameOver: boolean;
    winner: string;  // 'LEFT' or 'RIGHT' or ''
}


/**
 * 连接状态
 */
export enum ConnectionState {
    DISCONNECTED = 'DISCONNECTED',
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED',
    ERROR = 'ERROR',
}

/**
 * 网络管理器 - 管理 WebRTC P2P 连接
 */
export class NetworkManager {
    private peer: Peer | null = null;
    private connection: DataConnection | null = null;
    private roomId: string = '';
    private isHost: boolean = false;
    private state: ConnectionState = ConnectionState.DISCONNECTED;

    // 回调函数
    private onStateChange: ((state: ConnectionState) => void) | null = null;
    private onMessage: ((data: any) => void) | null = null;
    private onRoomCreated: ((roomId: string) => void) | null = null;
    private onPeerConnected: (() => void) | null = null;
    private onPeerDisconnected: (() => void) | null = null;

    // 延迟统计
    private latency: number = 0;
    private lastPingTime: number = 0;

    /**
     * 生成随机房间码
     */
    private generateRoomId(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 避免混淆字符
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * 创建房间（作为 Host）
     */
    createRoom(): Promise<string> {
        return new Promise((resolve, reject) => {
            this.roomId = this.generateRoomId();
            this.isHost = true;
            this.setState(ConnectionState.CONNECTING);

            // 使用房间码作为 Peer ID - 使用 PeerJS 默认云服务器
            this.peer = new Peer(this.roomId, {
                debug: 2,
            });

            this.peer.on('open', (id) => {
                console.log('✅ 房间创建成功:', id);
                this.setState(ConnectionState.CONNECTED);
                this.onRoomCreated?.(id);
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                console.log('🎮 玩家加入房间');
                this.connection = conn;
                this.setupConnectionHandlers(conn);
            });

            this.peer.on('error', (err) => {
                console.error('❌ Peer 错误:', err);
                this.setState(ConnectionState.ERROR);
                reject(err);
            });
        });
    }

    /**
     * 加入房间（作为 Guest）
     */
    joinRoom(roomId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.roomId = roomId.toUpperCase();
            this.isHost = false;
            this.setState(ConnectionState.CONNECTING);

            // 使用 PeerJS 默认云服务器
            this.peer = new Peer({
                debug: 2,
            });

            this.peer.on('open', () => {
                console.log('🔗 正在连接到房间:', this.roomId);

                const conn = this.peer!.connect(this.roomId, {
                    reliable: true,
                });

                conn.on('open', () => {
                    console.log('✅ 成功加入房间');
                    this.connection = conn;
                    this.setupConnectionHandlers(conn);
                    this.setState(ConnectionState.CONNECTED);
                    this.onPeerConnected?.();
                    resolve();
                });

                conn.on('error', (err) => {
                    console.error('❌ 连接错误:', err);
                    this.setState(ConnectionState.ERROR);
                    reject(err);
                });
            });

            this.peer.on('error', (err) => {
                console.error('❌ Peer 错误:', err);
                this.setState(ConnectionState.ERROR);
                reject(err);
            });

            // 超时处理 - 增加到30秒以适应网络慢的情况
            setTimeout(() => {
                if (this.state === ConnectionState.CONNECTING) {
                    this.setState(ConnectionState.ERROR);
                    reject(new Error('连接超时'));
                }
            }, 30000);
        });
    }

    /**
     * 设置连接事件处理
     */
    private setupConnectionHandlers(conn: DataConnection): void {
        conn.on('data', (data: any) => {
            this.handleMessage(data);
        });

        conn.on('close', () => {
            console.log('⚠️ 对手断开连接');
            this.setState(ConnectionState.DISCONNECTED);
            this.onPeerDisconnected?.();
        });

        conn.on('error', (err) => {
            console.error('❌ 连接错误:', err);
        });

        // Host 收到 Guest 连接
        if (this.isHost) {
            this.onPeerConnected?.();
        }
    }

    /**
     * 处理收到的消息
     */
    private handleMessage(data: any): void {
        if (data.type === MessageType.PING) {
            // 回复 PONG
            this.send({ type: MessageType.PONG, timestamp: data.timestamp });
        } else if (data.type === MessageType.PONG) {
            // 计算延迟
            this.latency = Date.now() - data.timestamp;
        } else {
            // 其他消息传递给回调
            this.onMessage?.(data);
        }
    }

    /**
     * 发送数据
     */
    send(data: any): void {
        if (this.connection && this.connection.open) {
            this.connection.send(data);
        }
    }

    /**
     * 发送输入状态
     */
    sendInput(input: Omit<InputPacket, 'type' | 'timestamp'>): void {
        this.send({
            type: MessageType.INPUT_STATE,
            timestamp: Date.now(),
            ...input,
        });
    }

    /**
     * 发送游戏状态（仅 Host 使用）
     */
    sendGameState(state: Omit<GameStatePacket, 'type' | 'timestamp'>): void {
        if (this.isHost) {
            this.send({
                type: MessageType.GAME_STATE,
                timestamp: Date.now(),
                ...state,
            });
        }
    }

    /**
     * 测量延迟
     */
    ping(): void {
        this.lastPingTime = Date.now();
        this.send({ type: MessageType.PING, timestamp: this.lastPingTime });
    }

    /**
     * 断开连接
     */
    disconnect(): void {
        this.connection?.close();
        this.peer?.destroy();
        this.connection = null;
        this.peer = null;
        this.setState(ConnectionState.DISCONNECTED);
    }

    /**
     * 设置状态并触发回调
     */
    private setState(state: ConnectionState): void {
        this.state = state;
        this.onStateChange?.(state);
    }

    // Getters
    getState(): ConnectionState { return this.state; }
    getRoomId(): string { return this.roomId; }
    getIsHost(): boolean { return this.isHost; }
    getLatency(): number { return this.latency; }
    isConnected(): boolean { return this.state === ConnectionState.CONNECTED && this.connection?.open === true; }

    // Setters for callbacks
    setOnStateChange(cb: (state: ConnectionState) => void): void { this.onStateChange = cb; }
    setOnMessage(cb: (data: any) => void): void { this.onMessage = cb; }
    setOnRoomCreated(cb: (roomId: string) => void): void { this.onRoomCreated = cb; }
    setOnPeerConnected(cb: () => void): void { this.onPeerConnected = cb; }
    setOnPeerDisconnected(cb: () => void): void { this.onPeerDisconnected = cb; }
}
