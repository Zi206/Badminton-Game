// 输入接口
export interface Input {
    left: boolean;
    right: boolean;
    jump: boolean;
    hit: boolean;  // S键 - 发球
    upward: boolean;  // J键 - 上挑击球
    downward: boolean;  // K键 - 下击击球
    reset?(): void; // Optional reset method
}

// 键盘输入控制器
export class KeyboardInput implements Input {
    left = false;
    right = false;
    jump = false;
    hit = false;
    upward = false;
    downward = false;

    private keys: Set<string> = new Set();

    constructor(
        private leftKeys: string | string[],
        private rightKeys: string | string[],
        private jumpKeys: string | string[],
        private hitKeys: string | string[],
        private upwardKeys: string | string[] = 'j',
        private downwardKeys: string | string[] = 'k'
    ) {
        this.setupListeners();
    }

    private setupListeners(): void {
        window.addEventListener('keydown', (e) => {
            this.keys.add(e.key.toLowerCase());
            this.updateInputs();
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.key.toLowerCase());
            this.updateInputs();
        });
    }

    private isKeyActive(keyConfig: string | string[]): boolean {
        if (Array.isArray(keyConfig)) {
            return keyConfig.some(k => this.keys.has(k.toLowerCase()));
        }
        return this.keys.has(keyConfig.toLowerCase());
    }

    private updateInputs(): void {
        this.left = this.isKeyActive(this.leftKeys);
        this.right = this.isKeyActive(this.rightKeys);
        this.jump = this.isKeyActive(this.jumpKeys);
        this.hit = this.isKeyActive(this.hitKeys);
        this.upward = this.isKeyActive(this.upwardKeys);
        this.downward = this.isKeyActive(this.downwardKeys);
    }

    reset(): void {
        this.left = false;
        this.right = false;
        this.jump = false;
        this.hit = false;
        this.upward = false;
        this.downward = false;
    }
}

/**
 * 空输入类 - 用于联机模式禁用某一侧玩家的本地输入
 */
export class DummyInput implements Input {
    left = false;
    right = false;
    jump = false;
    hit = false;
    upward = false;
    downward = false;

    reset(): void {
        // 空实现，始终返回 false
    }
}


// AI输入控制器
export class BotInput implements Input {
    left = false;
    right = false;
    jump = false;
    hit = false;
    upward = false;
    downward = false;

    private lastActionTime = 0;
    private reactionDelay: number;

    constructor(reactionDelay: number = 100) {  // 减少反应延迟
        this.reactionDelay = reactionDelay;
    }

    /**
     * 预测球的轨迹落点
     */
    private predictBallTrajectory(
        ballX: number, ballY: number,
        ballVx: number, ballVy: number,
        playerX: number
    ): { x: number; y: number; time: number } | null {
        let x = ballX, y = ballY;
        let vx = ballVx, vy = ballVy;
        const gravity = 0.4;  // Constants.BALL_GRAVITY
        const airResistance = 0.98;  // Constants.BALL_AIR_RESISTANCE
        const groundY = 450;  // Constants.BALL_GROUND_Y

        for (let t = 0; t < 300; t++) {
            // 模拟物理
            vy += gravity;
            vx *= airResistance;
            vy *= airResistance;
            x += vx;
            y += vy;

            // 检测是否到达AI击球范围（x > 450且在合理高度）
            if (x >= 450 && y >= 200 && y <= 420) {
                return { x, y, time: t };
            }

            // 检测触地
            if (y >= groundY) {
                return { x, y: groundY, time: t };
            }
        }
        return null;
    }

    /**
     * 判断是否应该击球及击球方式
     */
    private shouldHit(
        playerX: number, playerY: number,
        ballX: number, ballY: number,
        ballVx: number, ballVy: number
    ): { hit: boolean; type: 'upward' | 'downward' | null } {
        // 球必须在AI一侧
        if (ballX < 420) return { hit: false, type: null };

        // 计算距离
        const distX = Math.abs(ballX - playerX);
        const distY = Math.abs(ballY - playerY);
        const hitRange = 70;  // 从55增加到70，包括球拍+球杆+握柄

        // 球必须在击球范围内
        if (distX > hitRange || distY > hitRange * 2) {  // Y轴放宽到2倍
            return { hit: false, type: null };
        }

        // 选择击球方式
        const neckY = playerY - 58;  // 脖子位置

        // 策略1：被动防守（后场）优先上挑，打高远球解围
        if (playerX > 750) {
            return { hit: true, type: 'upward' };
        }

        // 策略2：只要球不是特别高（低于"脖子上方10px"），都优先尝试上挑
        // 之前的条件是 neckY + 15 (胸口)，现在放宽到 neckY - 10 (头部附近)
        // 这样AI会更多地使用上挑，不再总是无脑扣杀
        if (ballY > neckY - 10) {
            return { hit: true, type: 'upward' };
        }

        // 策略3：高球（扣杀机会），但引入20%概率上挑（打变化/假动作）
        // 或者是球虽然高但正在快速下落，也可能选择上挑
        if (Math.random() < 0.2 || ballVy > 8) {
            return { hit: true, type: 'upward' };
        }

        // 其他情况（高球且无随机事件）：下击（扣杀）
        return { hit: true, type: 'downward' };

    }

    /**
     * 更新AI决策
     */
    update(
        playerX: number,
        playerY: number,
        ballX: number,
        ballY: number,
        ballVx: number,
        ballVy: number,
        netX: number,
        currentTime: number
    ): void {
        // 重置输入
        this.left = false;
        this.right = false;
        this.jump = false;
        this.hit = false;
        this.upward = false;
        this.downward = false;

        // 检查反应延迟
        if (currentTime - this.lastActionTime < this.reactionDelay) {
            return;
        }

        // 只在球朝向AI这一侧时才行动
        const ballOnAISide = ballX > netX;
        const ballMovingTowardsAI = ballVx > 0;

        if (ballOnAISide || ballMovingTowardsAI) {
            // 预测球的落点
            const prediction = this.predictBallTrajectory(ballX, ballY, ballVx, ballVy, playerX);

            // ========== 智能跳跃决策 ==========
            // 简化方案：20%概率跳跃接球

            const playerIsOnGround = playerY >= 390;  // AI在地面上

            if (prediction) {
                // 根据预测位置移动（留出击球空间）
                const hitOffset = 25;  // 击球偏移，不要站在球正下方
                const targetX = prediction.x - hitOffset;
                const distance = targetX - playerX;

                if (Math.abs(distance) > 15) {
                    if (distance > 0) {
                        this.right = true;
                    } else {
                        this.left = true;
                    }
                }

                // 跳跃决策：25%概率 + 基本条件
                // 条件：在地面上、时间合适、位置接近
                const shouldConsiderJump = playerIsOnGround &&
                    prediction.time > 10 &&
                    prediction.time < 40 &&
                    Math.abs(targetX - playerX) < 60;

                // 25%概率跳跃
                if (shouldConsiderJump && Math.random() < 0.25) {
                    this.jump = true;
                    this.lastActionTime = currentTime;
                }
            } else {
                // 简单追踪
                const predictedX = ballX + ballVx * 15;
                const dist = predictedX - playerX;

                if (Math.abs(dist) > 20) {
                    if (dist > 0) {
                        this.right = true;
                    } else {
                        this.left = true;
                    }
                }
            }

            // 判断是否应该击球
            const hitDecision = this.shouldHit(playerX, playerY, ballX, ballY, ballVx, ballVy);

            if (hitDecision.hit) {
                if (hitDecision.type === 'upward') {
                    this.upward = true;
                } else if (hitDecision.type === 'downward') {
                    this.downward = true;
                }
                this.lastActionTime = currentTime;
            }
        }
    }

    reset(): void {
        this.left = false;
        this.right = false;
        this.jump = false;
        this.hit = false;
        this.upward = false;
        this.downward = false;
    }
}
