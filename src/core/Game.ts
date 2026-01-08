import { Constants, GameState, GameMode, PlayerSide } from '../utils/Constants';
import { ResourceManager } from './ResourceManager';
import { Renderer } from './Renderer';
import { Input, KeyboardInput, BotInput, DummyInput } from './Input';
import { Player, SwingType } from '../entities/Player';
import { Ball } from '../entities/Ball';
import { ParticleSystem } from '../entities/ParticleSystem';
import { SoundManager } from './SoundManager';
import { MenuController } from './MenuController';
import { OnlineLobbyController } from './OnlineLobbyController';
import { NetworkInput, LocalInputSender } from './NetworkInput';
import { MessageType, GameStatePacket } from './NetworkManager';

export class Game {
    private state: GameState = GameState.LOADING;
    private gameMode: GameMode = GameMode.SINGLE_PLAYER;
    private resourceManager: ResourceManager;
    private soundManager!: SoundManager; // 使用!断言，将在init中赋值
    private renderer: Renderer;
    private player1: Player;
    private player2: Player;
    private player1Input: Input; // Changed to Interface to support Keyboard/Dummy in different modes
    private player2Input: Input; // Changed to Interface to support both Bot and Keyboard
    private ball: Ball;
    private particles: ParticleSystem;
    private menuController: MenuController;
    private onlineLobbyController: OnlineLobbyController | null = null;
    private localInputSender: LocalInputSender | null = null;
    private isOnlineHost: boolean = false;

    // 网络广播节流
    private lastBroadcastTime: number = 0;
    private readonly BROADCAST_INTERVAL: number = 1000 / 30; // 30fps广播频率（降低网络负载）

    private leftScore = 0;
    private rightScore = 0;
    private servingSide: PlayerSide = PlayerSide.LEFT;
    private isServing = true;
    private waitingForServe = false;
    private serveTimer = 0;

    private lastTime = 0;

    // FPS计数器
    private fps: number = 0;
    private frameCount: number = 0;
    private lastFpsUpdate: number = 0;

    // 固定时间步长相关
    private accumulator: number = 0;
    private fixedTimeStep: number = 1 / 60;

    // 静音按钮
    private muteButtonX: number = 5;
    private muteButtonY: number = 20;
    private muteButtonSize: number = 40;

    constructor(private canvas: HTMLCanvasElement) {
        this.resourceManager = new ResourceManager();
        this.renderer = new Renderer(canvas, this.resourceManager);
        this.player1 = new Player(Constants.PLAYER1_X, PlayerSide.LEFT);
        this.player2 = new Player(Constants.PLAYER2_X, PlayerSide.RIGHT);

        // P1 Controls: WASD
        this.player1Input = new KeyboardInput('a', 'd', 'w', 's');

        // P2 Input Initialized as Bot by default (will be reset in startGame)
        this.player2Input = new BotInput(Constants.AI_REACTION_DELAY);

        this.ball = new Ball(Constants.NET_X, Constants.BALL_INITIAL_Y);
        this.particles = new ParticleSystem();

        this.menuController = new MenuController((mode) => this.setGameMode(mode));

        // 设置联机按钮回调
        this.menuController.setOnOnlineClick(() => this.showOnlineLobby());

        this.setupSpacebarListener();
        this.setupMuteButtonListener();
    }

    /**
     * 显示联机大厅
     */
    private showOnlineLobby(): void {
        if (!this.onlineLobbyController) {
            this.onlineLobbyController = new OnlineLobbyController();

            // 游戏开始回调
            this.onlineLobbyController.setOnGameStart((isHost) => {
                this.isOnlineHost = isHost;
                this.startOnlineGame(isHost);
            });

            // 返回主菜单回调
            this.onlineLobbyController.setOnBack(() => {
                this.menuController.show();
            });
        }
        this.onlineLobbyController.show();
    }

    /**
     * 开始联机游戏
     */
    private startOnlineGame(isHost: boolean): void {
        this.gameMode = GameMode.ONLINE;
        this.resetMatch();
        this.state = GameState.PLAYING;

        const networkManager = this.onlineLobbyController!.getNetworkManager();

        if (isHost) {
            // Host: 本地控制 P1（左边火柴人）使用 WASD+JK
            // player1Input 已经在构造函数中配置为 WASD（默认包含 JK）
            // 禁用本地的 P2 输入，改为从网络接收
            // 传入回调处理非输入消息（如 RESTART）
            this.player2Input = new NetworkInput(networkManager, (data) => {
                if (data.type === MessageType.RESTART) {
                    // Guest 发来的重启请求
                    this.reset();
                }
            });
            // NetworkInput 会自动处理接收到的输入消息
        } else {
            // Guest: 本地控制 P2（右边火柴人）使用 WASD+JK
            // 禁用本地的 P1 输入，防止 Guest 控制 P1
            this.player1Input = new DummyInput();

            // P2 使用与 P1 完全相同的按键（WASD+JK）
            this.player2Input = new KeyboardInput(
                'a',     // left
                'd',     // right
                'w',     // jump
                's',     // hit/serve
                'j',     // upward
                'k'      // downward
            );

            // Guest 发送本地 P2 输入
            this.localInputSender = new LocalInputSender(networkManager, this.player2Input);
            this.localInputSender.startSending();

            // Guest 接收游戏状态和重启消息
            networkManager.setOnMessage((data) => {
                if (data.type === MessageType.GAME_STATE) {
                    this.applyNetworkState(data as GameStatePacket);
                } else if (data.type === MessageType.RESTART) {
                    // Host 发来的重启请求
                    this.reset();
                }
            });
        }
    }

    /**
     * 应用从网络接收的游戏状态 (Guest only)
     */
    private applyNetworkState(state: GameStatePacket): void {
        // 检测击球声音 - 当球速度突然变化时播放
        const prevBallVx = this.ball.vx;
        const prevBallVy = this.ball.vy;
        const wasServing = this.isServing;
        const prevLeftScore = this.leftScore;
        const prevRightScore = this.rightScore;

        // 更新球状态
        this.ball.x = state.ball.x;
        this.ball.y = state.ball.y;
        this.ball.vx = state.ball.vx;
        this.ball.vy = state.ball.vy;

        // 更新玩家1状态（Host控制的角色）
        this.player1.x = state.player1.x;
        this.player1.y = state.player1.y;
        this.player1.vx = state.player1.vx;
        this.player1.vy = state.player1.vy;
        this.player1.isSwinging = state.player1.isSwinging;
        this.player1.swingProgress = state.player1.swingProgress;
        this.player1.swingType = state.player1.swingType as SwingType;
        this.player1.animationTime = state.player1.animationTime;
        this.player1.isOnGround = state.player1.isOnGround;
        this.player1.isServingMode = state.player1.isServingMode;
        this.player1.hitCooldown = state.player1.hitCooldown;

        // 更新玩家2状态（Guest控制的角色，但使用Host的权威位置）
        this.player2.x = state.player2.x;
        this.player2.y = state.player2.y;
        this.player2.vx = state.player2.vx;
        this.player2.vy = state.player2.vy;
        this.player2.isSwinging = state.player2.isSwinging;
        this.player2.swingProgress = state.player2.swingProgress;
        this.player2.swingType = state.player2.swingType as SwingType;
        this.player2.animationTime = state.player2.animationTime;
        this.player2.isOnGround = state.player2.isOnGround;
        this.player2.isServingMode = state.player2.isServingMode;
        this.player2.hitCooldown = state.player2.hitCooldown;

        // 更新分数
        this.leftScore = state.score.left;
        this.rightScore = state.score.right;

        // 更新发球状态
        this.isServing = state.isServing;
        this.waitingForServe = state.waitingForServe;
        this.servingSide = state.servingSide === 'LEFT' ? PlayerSide.LEFT : PlayerSide.RIGHT;

        // === Guest 声音触发逻辑 ===
        // 检测发球 - 从发球状态变为非发球状态
        if (wasServing && !state.isServing) {
            this.soundManager.play(SoundManager.SERVE);
        }

        // 检测击球 - 球速度方向突然改变（表示被击中）
        const velocityChanged = (
            (prevBallVx !== 0 || prevBallVy !== 0) &&
            (Math.sign(state.ball.vx) !== Math.sign(prevBallVx) ||
                Math.abs(state.ball.vy - prevBallVy) > 5)
        );
        if (velocityChanged && !wasServing) {
            this.soundManager.play(SoundManager.HIT);
        }

        // 检测得分
        if (state.score.left > prevLeftScore || state.score.right > prevRightScore) {
            this.soundManager.play(SoundManager.GROUND);
        }

        // === 同步游戏结束状态 ===
        const wasGameOver = this.state === GameState.GAME_OVER;
        if (state.isGameOver && !wasGameOver) {
            // 游戏刚刚结束
            this.state = GameState.GAME_OVER;

            // Guest 是 Player 2 (右边)
            // 如果 winner 是 LEFT (Player 1)，Guest 输了
            // 如果 winner 是 RIGHT (Player 2)，Guest 赢了
            if (state.winner === 'LEFT') {
                // Player 1 (Host) 赢了，Guest 输了
                this.soundManager.play(SoundManager.LOSE);
            } else if (state.winner === 'RIGHT') {
                // Player 2 (Guest) 赢了
                this.soundManager.play(SoundManager.WIN);
            }
        }
    }

    /**
     * 广播游戏状态到网络 (Host only)
     */
    private broadcastGameState(): void {
        if (this.gameMode === GameMode.ONLINE && this.isOnlineHost && this.onlineLobbyController) {
            // 节流：限制广播频率为 30fps，降低网络负载
            const now = Date.now();
            if (now - this.lastBroadcastTime < this.BROADCAST_INTERVAL) {
                return; // 跳过本次广播
            }
            this.lastBroadcastTime = now;

            this.onlineLobbyController.getNetworkManager().sendGameState({
                ball: { x: this.ball.x, y: this.ball.y, vx: this.ball.vx, vy: this.ball.vy },
                player1: {
                    x: this.player1.x,
                    y: this.player1.y,
                    vx: this.player1.vx,
                    vy: this.player1.vy,
                    isSwinging: this.player1.isSwinging,
                    swingProgress: this.player1.swingProgress,
                    swingType: this.player1.swingType as number,
                    animationTime: this.player1.animationTime,
                    isOnGround: this.player1.isOnGround,
                    isServingMode: this.player1.isServingMode,
                    hitCooldown: this.player1.hitCooldown
                },
                player2: {
                    x: this.player2.x,
                    y: this.player2.y,
                    vx: this.player2.vx,
                    vy: this.player2.vy,
                    isSwinging: this.player2.isSwinging,
                    swingProgress: this.player2.swingProgress,
                    swingType: this.player2.swingType as number,
                    animationTime: this.player2.animationTime,
                    isOnGround: this.player2.isOnGround,
                    isServingMode: this.player2.isServingMode,
                    hitCooldown: this.player2.hitCooldown
                },
                score: { left: this.leftScore, right: this.rightScore },
                isServing: this.isServing,
                waitingForServe: this.waitingForServe,
                servingSide: this.servingSide === PlayerSide.LEFT ? 'LEFT' : 'RIGHT',
                isGameOver: this.state === GameState.GAME_OVER,
                winner: this.leftScore >= Constants.WINNING_SCORE ? 'LEFT' :
                    (this.rightScore >= Constants.WINNING_SCORE ? 'RIGHT' : '')
            });
        }
    }

    public setGameMode(mode: GameMode): void {
        this.gameMode = mode;
        this.resetMatch();
        this.state = GameState.PLAYING;

        // Setup P2 Input
        if (mode === GameMode.SINGLE_PLAYER) {
            this.player2Input = new BotInput(Constants.AI_REACTION_DELAY);
        } else if (mode === GameMode.TWO_PLAYER) {
            // P2 Keys: Arrows + Numpad
            this.player2Input = new KeyboardInput(
                'ArrowLeft',
                'ArrowRight',
                'ArrowUp',
                'ArrowDown', // Serve/Hit
                ['2', ','],  // Upward (Numpad 2 or comma)
                ['3', '.']   // Downward (Numpad 3 or period)
            );
        }
        // ONLINE mode is handled by startOnlineGame()
    }

    private resetMatch(): void {
        this.leftScore = 0;
        this.rightScore = 0;
        this.servingSide = PlayerSide.LEFT;
        this.isServing = true;
        this.waitingForServe = false;

        this.player1.x = Constants.PLAYER1_X;
        this.player1.y = Constants.GROUND_Y;
        this.player1.vx = 0;
        this.player1.vy = 0;
        this.player1.isSwinging = false;

        this.player2.x = Constants.PLAYER2_X;
        this.player2.y = Constants.GROUND_Y;
        this.player2.vx = 0;
        this.player2.vy = 0;
        this.player2.isSwinging = false;

        this.ball.x = Constants.NET_X;
        this.ball.y = Constants.BALL_INITIAL_Y;
        this.ball.vx = 0;
        this.ball.vy = 0;

        if (this.player1Input && this.player1Input.reset) {
            this.player1Input.reset();
        }
        if (this.player2Input && this.player2Input.reset) {
            this.player2Input.reset();
        }
    }

    async init(): Promise<void> {
        this.resourceManager.loadImage('background', 'assets/bg.jpg');
        this.resourceManager.loadImage('score_bg', 'assets/score_bg.png');
        this.resourceManager.loadImage('ball', 'assets/ymq.png');
        this.resourceManager.loadImage('label_bg', 'assets/bq.png');
        await this.resourceManager.waitForAll();

        // 获取音效管理器
        this.soundManager = this.resourceManager.getSoundManager();

        // 将音效管理器传递给Ball和Player
        this.ball.setSoundManager(this.soundManager);
        this.player1.setSoundManager(this.soundManager);
        this.player2.setSoundManager(this.soundManager);

        // 将羽毛球图片传递给Ball对象
        const ballImage = this.resourceManager.getImage('ball');
        if (ballImage) {
            this.ball.setBallImage(ballImage);
        }

        this.state = GameState.PLAYING;
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';

        // 计算静音按钮位置（右上角）
        this.muteButtonX = this.canvas.width - this.muteButtonSize - 20;

        // 设置静音按钮点击监听
        this.setupMuteButtonListener();
    }

    private setupSpacebarListener(): void {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.state === GameState.GAME_OVER) {
                // 在联机模式下，发送重启消息给对方
                if (this.gameMode === GameMode.ONLINE && this.onlineLobbyController) {
                    this.onlineLobbyController.getNetworkManager().send({
                        type: MessageType.RESTART,
                        timestamp: Date.now()
                    });
                }
                this.reset();
            }
        });
    }

    private lastMuteToggle: number = 0;

    private setupMuteButtonListener(): void {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();

            // 考虑canvas的缩放比例
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;

            // 转换到canvas内部坐标
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;

            console.log('Click:', {
                clientX: e.clientX - rect.left,
                clientY: e.clientY - rect.top,
                canvasX: x,
                canvasY: y,
                buttonX: this.muteButtonX,
                buttonY: this.muteButtonY,
                buttonSize: this.muteButtonSize,
                scaleX,
                scaleY
            });

            // 检测是否点击了静音按钮区域
            if (x >= this.muteButtonX && x <= this.muteButtonX + this.muteButtonSize &&
                y >= this.muteButtonY && y <= this.muteButtonY + this.muteButtonSize) {

                // 防抖：如果距离上次切换不到 300ms，则忽略
                const now = Date.now();
                if (now - this.lastMuteToggle < 300) {
                    console.log('Debounced: ignoring rapid click');
                    return;
                }
                this.lastMuteToggle = now;

                console.log('Mute button clicked! Current muted:', this.soundManager.isMuted());
                this.soundManager.toggleMute();
                console.log('After toggle, muted:', this.soundManager.isMuted());

                // 阻止事件传播
                e.stopPropagation();
                e.preventDefault();
            }
        });
    }

    start(): void {
        this.lastTime = performance.now();
        this.state = GameState.MENU;
        this.menuController.show();
        this.gameLoop(this.lastTime);
    }

    private gameLoop(currentTime: number): void {
        requestAnimationFrame((time) => this.gameLoop(time));

        if (this.state !== GameState.PLAYING) {
            if (this.state === GameState.GAME_OVER) {
                const winner = this.leftScore >= Constants.WINNING_SCORE ? '玩家 1' : (this.gameMode === GameMode.SINGLE_PLAYER ? 'AI' : '玩家 2');
                const player2Name = this.gameMode === GameMode.SINGLE_PLAYER ? 'AI' : '玩家 2';
                this.renderer.renderScene(this.player1, this.player2, this.ball, this.particles, this.leftScore, this.rightScore, false, player2Name);
                this.renderer.renderGameOver(winner);

                // 联机模式下，Host 继续广播状态给 Guest，使 Guest 也能看到游戏结束
                this.broadcastGameState();
            } else if (this.state === GameState.MENU) {
                const player2Name = this.gameMode === GameMode.SINGLE_PLAYER ? 'AI' : '玩家 2';
                this.renderer.renderScene(this.player1, this.player2, this.ball, this.particles, this.leftScore, this.rightScore, false, player2Name);
            }
            return;
        }

        // ========== 固定时间步长游戏循环 ==========
        // 目标：让游戏逻辑严格按 60 FPS 运行，无论显示器刷新率是多少

        // 计算deltaTime（以秒为单位）
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // 计算FPS（实际渲染帧率）
        this.frameCount++;
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
        }

        // 限制最大deltaTime，防止"死亡螺旋"（标签页切换回来时时间差过大）
        const clampedDeltaTime = Math.min(deltaTime, 0.1);  // 最大0.1秒

        // 累积时间差
        this.accumulator += clampedDeltaTime;

        // 当累积时间 >= 固定步长时，执行游戏逻辑更新
        // 这确保了游戏逻辑严格按 60 次/秒 执行，无论实际帧率如何
        while (this.accumulator >= this.fixedTimeStep) {
            this.update(this.fixedTimeStep);  // 每次更新使用固定的 1/60 秒
            this.accumulator -= this.fixedTimeStep;
        }

        // 每帧都渲染（渲染帧率可以是 60、100、144 等任意值）
        this.render();
        // ========== 固定时间步长游戏循环结束 ==========
    }

    private update(deltaTime: number): void {
        // Guest 端：不运行物理模拟，只接收 Host 的状态并渲染
        if (this.gameMode === GameMode.ONLINE && !this.isOnlineHost) {
            // Guest 只更新粒子系统（视觉效果）
            this.particles.update();
            return;
        }

        // Host 端或本地模式：运行完整的游戏逻辑
        // 处理发球状态
        if (this.isServing) {
            this.handleServe();
            // 发球期间仍然允许玩家移动
            this.player1.update(this.player1Input, deltaTime);
            this.player2.update(this.player2Input, deltaTime);
            // 重要：发球期间也要更新粒子系统，否则得分粒子会延迟显示
            this.particles.update();
            // 关键：发球期间也要广播状态给 Guest！
            this.broadcastGameState();
            return;
        }

        if (this.player2Input instanceof BotInput) {
            this.player2Input.update(
                this.player2.x, this.player2.y, this.ball.x, this.ball.y,
                this.ball.vx, this.ball.vy, Constants.NET_X, this.lastTime
            );
        }

        // 在玩家准备挥拍时，根据球的高度设置挥拍类型
        if (this.player1Input.hit && this.player1.hitCooldown === 0) {
            this.player1.setSwingType(this.ball.y);
        }
        if (this.player2Input.hit && this.player2.hitCooldown === 0) {
            this.player2.setSwingType(this.ball.y);
        }

        this.player1.update(this.player1Input, deltaTime);
        this.player2.update(this.player2Input, deltaTime);
        this.ball.update(deltaTime);
        this.particles.update();

        this.checkHit();
        this.checkScoring();

        // Host 广播游戏状态给 Guest
        this.broadcastGameState();
    }

    private handleServe(): void {
        const isPlayer1Serving = this.servingSide === PlayerSide.LEFT;

        // 如果是玩家1发球，等待手动触发
        if (isPlayer1Serving) {
            if (!this.waitingForServe) {
                this.waitingForServe = true;
                // 球放在玩家脚下地面
                this.ball.reset(this.player1.x, Constants.GROUND_Y - this.ball.radius);
            }

            // 设置发球准备姿势
            this.player1.isServingMode = true;
            this.player2.isServingMode = false;

            // 球跟随持球手位置
            const ballHandPos = this.player1.getBallHandPosition();
            this.ball.x = ballHandPos.x;
            this.ball.y = ballHandPos.y;
            this.ball.vx = 0;
            this.ball.vy = 0;

            // 检测发球按键 (S键)
            if (this.player1Input.hit && !this.player1.isServingAnimation) {
                this.player1.isServingAnimation = true;
                this.player1.servingProgress = 0;
                this.player1.onServeReady = () => {
                    // 动画中点触发发球
                    this.ball.serve(this.ball.x, this.ball.y, 1);
                    // 播放发球音效
                    this.soundManager.play(SoundManager.SERVE);
                    this.isServing = false;
                    this.waitingForServe = false;
                };
            }
        } else {
            // 玩家2 (或AI) 发球
            if (!this.waitingForServe) {
                this.waitingForServe = true;
                this.serveTimer = 0;
                // 球放在AI/P2脚下地面
                this.ball.reset(this.player2.x, Constants.GROUND_Y - this.ball.radius);
            }

            // 设置P2发球准备姿势
            this.player1.isServingMode = false;
            this.player2.isServingMode = true;

            // 球跟随P2的持球手位置
            const ballHandPos = this.player2.getBallHandPosition();
            this.ball.x = ballHandPos.x;
            this.ball.y = ballHandPos.y;
            this.ball.vx = 0;
            this.ball.vy = 0;

            if (this.gameMode === GameMode.SINGLE_PLAYER) {
                // AI自动发球逻辑
                this.serveTimer++;
                if (this.serveTimer > 60) {
                    // 60帧=1秒后，启动AI发球动画
                    if (!this.player2.isServingAnimation) {
                        this.player2.isServingAnimation = true;
                        this.player2.servingProgress = 0;
                        this.player2.onServeReady = () => {
                            // 动画中点触发发球
                            this.ball.serve(this.ball.x, this.ball.y, -1);
                            // 播放发球音效
                            this.soundManager.play(SoundManager.SERVE);
                            this.isServing = false;
                            this.waitingForServe = false;
                        };
                    }
                }
            } else {
                // 玩家2手动发球 (Down Arrow)
                if (this.player2Input.hit && !this.player2.isServingAnimation) {
                    this.player2.isServingAnimation = true;
                    this.player2.servingProgress = 0;
                    this.player2.onServeReady = () => {
                        this.ball.serve(this.ball.x, this.ball.y, -1);
                        this.soundManager.play(SoundManager.SERVE);
                        this.isServing = false;
                        this.waitingForServe = false;
                    };
                }
            }
        }
    }

    private checkHit(): void {
        // 玩家1击球检测（在挥拍动画期间检测碰撞）
        if (this.player1.isSwinging) {
            const racketData = this.player1.getRacketCollisionData();
            const isUpward = this.player1.swingType === SwingType.UPWARD;
            if (this.ball.checkRacketCollision(racketData, isUpward)) {
                const isReturn = this.player1.isInReturnPhase();

                if (!isReturn && !this.player1.hasHitInThisSwing) {
                    // 前进阶段：正常击球
                    const racketAngle = racketData.frame.angle;
                    // isUpward已在上文定义
                    this.ball.hit(this.player1.x, this.player1.y, this.player1.height, 1, racketAngle, isUpward);
                    if (this.ball.getSpeed() > 14) {
                        this.particles.emit(this.ball.x, this.ball.y, 6);
                    }
                    this.player1.hasHitInThisSwing = true;
                } else if (isReturn && !this.player1.hasHitInReturn) {
                    // 回程阶段：使用普通击球
                    const racketAngle = racketData.frame.angle;
                    // isUpward已在上文定义
                    this.ball.hit(this.player1.x, this.player1.y, this.player1.height, 1, racketAngle, isUpward);
                    if (this.ball.getSpeed() > 14) {
                        this.particles.emit(this.ball.x, this.ball.y, 6);
                    }
                    this.player1.hasHitInReturn = true;
                }
            }
        }

        // 玩家2击球检测（在挥拍动画期间检测碰撞）
        if (this.player2.isSwinging) {
            const racketData = this.player2.getRacketCollisionData();
            const isUpward = this.player2.swingType === SwingType.UPWARD;
            if (this.ball.checkRacketCollision(racketData, isUpward)) {
                const isReturn = this.player2.isInReturnPhase();

                if (!isReturn && !this.player2.hasHitInThisSwing) {
                    // 前进阶段：正常击球
                    const racketAngle = racketData.frame.angle;
                    // isUpward已在上文定义
                    this.ball.hit(this.player2.x, this.player2.y, this.player2.height, -1, racketAngle, isUpward);
                    if (this.ball.getSpeed() > 14) {
                        this.particles.emit(this.ball.x, this.ball.y, 6);
                    }
                    this.player2.hasHitInThisSwing = true;
                } else if (isReturn && !this.player2.hasHitInReturn) {
                    // 回程阶段：使用普通击球
                    const racketAngle = racketData.frame.angle;
                    // isUpward已在上文定义
                    this.ball.hit(this.player2.x, this.player2.y, this.player2.height, -1, racketAngle, isUpward);
                    if (this.ball.getSpeed() > 14) {
                        this.particles.emit(this.ball.x, this.ball.y, 6);
                    }
                    this.player2.hasHitInReturn = true;
                }
            }
        }
    }

    private checkScoring(): void {
        if (this.ball.isOnGround()) {
            if (this.ball.x < Constants.NET_X) {
                this.rightScore++;
                this.servingSide = PlayerSide.RIGHT;
            } else {
                this.leftScore++;
                this.servingSide = PlayerSide.LEFT;
            }

            this.particles.emit(this.ball.x, this.ball.y, Constants.PARTICLE_COUNT);

            if (this.leftScore >= Constants.WINNING_SCORE || this.rightScore >= Constants.WINNING_SCORE) {
                this.state = GameState.GAME_OVER;
                // 播放胜利或失败音效
                if (this.gameMode === GameMode.TWO_PLAYER) {
                    // 双人模式：不管谁赢都播放胜利音效
                    this.soundManager.play(SoundManager.WIN);
                } else if (this.leftScore >= Constants.WINNING_SCORE) {
                    // 单人模式或联机模式：P1（Host）赢播放胜利
                    this.soundManager.play(SoundManager.WIN);
                } else {
                    // 单人模式或联机模式：P2（AI/Guest）赢播放失败
                    this.soundManager.play(SoundManager.LOSE);
                }
            } else {
                this.prepareServe();
            }
        }
    }

    private prepareServe(): void {
        this.isServing = true;
        this.waitingForServe = false;
        this.ball.reset(Constants.NET_X, Constants.BALL_INITIAL_Y);
    }

    private render(): void {
        // 在发球等待时显示提示
        const showServeHint = this.isServing && this.servingSide === PlayerSide.LEFT;
        const player2Name = this.gameMode === GameMode.SINGLE_PLAYER ? 'AI' : '玩家 2';
        this.renderer.renderScene(
            this.player1,
            this.player2,
            this.ball,
            this.particles,
            this.leftScore,
            this.rightScore,
            showServeHint,
            player2Name
        );

        // 显示FPS（游戏画面左上角，绿色，小字体）
        const ctx = this.renderer.getContext();
        ctx.save();
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#00FF00';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeText(`FPS: ${this.fps}`, 40, 20);
        ctx.fillText(`FPS: ${this.fps}`, 40, 20);
        ctx.restore();

        // 绘制静音按钮（右上角）
        this.renderMuteButton(ctx);
    }

    /**
     * 绘制静音按钮
     */
    private renderMuteButton(ctx: CanvasRenderingContext2D): void {
        const x = this.muteButtonX;
        const y = this.muteButtonY;
        const size = this.muteButtonSize;
        const isMuted = this.soundManager.isMuted();

        ctx.save();

        // 绘制背景圆形
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 绘制扬声器图标
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const iconSize = size * 0.5;

        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // 扬声器主体（梯形）- 向左移动使其居中
        const speakerHeight = iconSize * 0.5;
        const speakerOffsetX = -iconSize * 0.33; // 向左偏移
        ctx.beginPath();
        ctx.moveTo(centerX - iconSize * 0.15 + speakerOffsetX, centerY - speakerHeight / 2);
        ctx.lineTo(centerX + iconSize * 0.05 + speakerOffsetX, centerY - speakerHeight / 2);
        ctx.lineTo(centerX + iconSize * 0.15 + speakerOffsetX, centerY - iconSize * 0.3);
        ctx.lineTo(centerX + iconSize * 0.15 + speakerOffsetX, centerY + iconSize * 0.3);
        ctx.lineTo(centerX + iconSize * 0.05 + speakerOffsetX, centerY + speakerHeight / 2);
        ctx.lineTo(centerX - iconSize * 0.15 + speakerOffsetX, centerY + speakerHeight / 2);
        ctx.closePath();
        ctx.fill();

        if (!isMuted) {
            // 未静音：绘制声波（3条弧线）- 与扬声器同步向左偏移
            const waveCenterX = centerX - iconSize * 0.23;

            ctx.beginPath();
            ctx.arc(waveCenterX, centerY, iconSize * 0.4, -Math.PI / 4, Math.PI / 4, false);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(waveCenterX, centerY, iconSize * 0.6, -Math.PI / 4, Math.PI / 4, false);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(waveCenterX, centerY, iconSize * 0.8, -Math.PI / 4, Math.PI / 4, false);
            ctx.stroke();
        } else {
            // 静音：绘制斜线
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#FF4444';
            ctx.beginPath();
            ctx.moveTo(x + size * 0.2, y + size * 0.2);
            ctx.lineTo(x + size * 0.8, y + size * 0.8);
            ctx.stroke();
        }

        ctx.restore();
    }

    private reset(): void {
        this.leftScore = 0;
        this.rightScore = 0;
        this.servingSide = PlayerSide.LEFT;
        this.prepareServe();
        this.particles.clear();
        this.state = GameState.PLAYING;
    }
}
