import { Constants, PlayerSide } from '../utils/Constants';
import type { Input } from '../core/Input';
import { SoundManager } from '../core/SoundManager';

/**
 * 挥拍类型枚举
 */
export enum SwingType {
    UPWARD,   // 上挑（逆时针）
    DOWNWARD  // 下击（顺时针）
}

export class Player {
    x: number;
    y: number;
    vx: number = 0;
    vy: number = 0;

    width: number = Constants.PLAYER_WIDTH;
    height: number = Constants.PLAYER_HEIGHT;

    side: PlayerSide;
    color: string;

    animationTime: number = 0; // 改为public以便网络同步访问
    isSwinging: boolean = false; // 改为public以便Game访问
    swingProgress: number = 0; // 改为public以便网络同步访问
    hitCooldown: number = 0;

    isOnGround: boolean = true;
    isServingMode: boolean = false; // 发球准备状态
    isServingAnimation: boolean = false; // 是否正在执行发球动画
    servingProgress: number = 0; // 发球动画进度
    onServeReady: (() => void) | null = null; // 发球触发回调
    swingType: SwingType = SwingType.UPWARD; // 挥拍类型，改为public以便Game访问
    hasHitInThisSwing: boolean = false; // 本次挥拍是否已经击中球（公开以便Game访问）
    hasHitInReturn: boolean = false; // 回程是否已击球（公开以便Game访问）

    // 音效管理器
    private soundManager: SoundManager | null = null;
    private wasOnGround: boolean = true; // 跟踪上一帧是否在地面

    constructor(x: number, side: PlayerSide) {
        this.x = x;
        this.y = Constants.GROUND_Y;
        this.side = side;
        this.color = side === PlayerSide.LEFT ? '#000000' : '#FF0000';
    }

    /**
     * 设置音效管理器
     */
    setSoundManager(manager: SoundManager): void {
        this.soundManager = manager;
    }

    update(input: Input, deltaTime: number = 1 / 60): void {
        if (input.left) {
            this.vx = -Constants.PLAYER_SPEED;
        } else if (input.right) {
            this.vx = Constants.PLAYER_SPEED;
        } else {
            this.vx = 0;
        }

        this.x += this.vx;

        // 球网碰撞检测：防止玩家穿过球网
        const netX = Constants.NET_X;
        const netCollisionWidth = 12; // 球网的碰撞宽度

        if (this.side === PlayerSide.LEFT) {
            // 左侧玩家不能越过球网
            if (this.x > netX - netCollisionWidth) {
                this.x = netX - netCollisionWidth;
                this.vx = 0; // 停止移动
            }
        } else {
            // 右侧玩家不能越过球网
            if (this.x < netX + netCollisionWidth) {
                this.x = netX + netCollisionWidth;
                this.vx = 0; // 停止移动
            }
        }

        // 边界限制
        if (this.x < Constants.LEFT_BOUNDARY) this.x = Constants.LEFT_BOUNDARY;
        if (this.x > Constants.RIGHT_BOUNDARY) this.x = Constants.RIGHT_BOUNDARY;

        // 发球线限制（不可见边界）
        if (this.side === PlayerSide.LEFT) {
            // 左侧玩家不能向右越过左侧发球线
            if (this.x > Constants.SERVICE_LINE_LEFT) {
                this.x = Constants.SERVICE_LINE_LEFT;
                this.vx = 0;
            }
        } else {
            // 右侧玩家不能向左越过右侧发球线
            if (this.x < Constants.SERVICE_LINE_RIGHT) {
                this.x = Constants.SERVICE_LINE_RIGHT;
                this.vx = 0;
            }
        }

        if (input.jump && this.isOnGround) {
            this.vy = -Constants.JUMP_FORCE;
            this.isOnGround = false;
        }

        if (!this.isOnGround) {
            this.vy += Constants.GRAVITY;
            this.y += this.vy;

            if (this.y >= Constants.GROUND_Y) {
                this.y = Constants.GROUND_Y;
                this.vy = 0;
                this.isOnGround = true;
                // 检测落地并播放音效
                if (!this.wasOnGround) {
                    this.soundManager?.play(SoundManager.LAND);
                    this.wasOnGround = true;
                }
            } else {
                // 在空中
                this.wasOnGround = false;
            }
        }

        // J键 - 上挑击球
        if (input.upward && this.hitCooldown === 0) {
            this.swingType = SwingType.UPWARD;
            this.isSwinging = true;
            this.swingProgress = 0;
            this.hasHitInThisSwing = false;
            this.hasHitInReturn = false;
            this.hitCooldown = Constants.SWING_UPWARD_DURATION;
        }

        // K键 - 下击击球
        if (input.downward && this.hitCooldown === 0) {
            this.swingType = SwingType.DOWNWARD;
            this.isSwinging = true;
            this.swingProgress = 0;
            this.hasHitInThisSwing = false;
            this.hasHitInReturn = false;
            this.hitCooldown = Constants.SWING_DOWNWARD_DURATION;
        }

        if (this.isSwinging) {
            this.swingProgress++;
            const duration = this.swingType === SwingType.UPWARD ?
                Constants.SWING_UPWARD_DURATION : Constants.SWING_DOWNWARD_DURATION;
            if (this.swingProgress >= duration) {
                this.isSwinging = false;
                this.swingProgress = 0;
                this.hasHitInReturn = false; // 重置回程击球标记
            }
        }

        if (this.hitCooldown > 0) {
            this.hitCooldown--;
        }

        // 发球动画处理
        if (this.isServingAnimation) {
            this.servingProgress++;

            // 动画中点触发发球
            if (this.servingProgress === Math.floor(Constants.SERVING_ANIMATION_DURATION / 2)) {
                if (this.onServeReady) {
                    this.onServeReady();
                }
            }

            // 动画结束
            if (this.servingProgress >= Constants.SERVING_ANIMATION_DURATION) {
                this.isServingAnimation = false;
                this.servingProgress = 0;
                this.isServingMode = false; // 进入接球状态
                this.onServeReady = null;
            }
        }

        if (Math.abs(this.vx) > 0.1) {
            this.animationTime += Constants.LEG_ANIMATION_SPEED;
        }
    }

    /**
     * 判断是否在挥拍回程阶段
     */
    isInReturnPhase(): boolean {
        if (!this.isSwinging) return false;
        const duration = this.swingType === SwingType.UPWARD ?
            Constants.SWING_UPWARD_DURATION : Constants.SWING_DOWNWARD_DURATION;
        // 超过动画一半时长，说明在回程
        return this.swingProgress > duration / 2;
    }

    render(ctx: CanvasRenderingContext2D): void {
        // 阴影 (固定在地面，随高度缩放)
        const groundY = Constants.GROUND_Y;
        const heightFromGround = Math.max(0, groundY - this.y);
        const shadowScale = Math.max(0.4, 1 - heightFromGround / 150); // 高度越高阴影越小

        ctx.fillStyle = `rgba(0,0,0,${0.2 * shadowScale})`;
        ctx.beginPath();
        ctx.ellipse(this.x, groundY, 15 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4; // 加粗线条
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 尺寸定义
        const headRadius = 14;
        const bodyLength = 32;
        const legLength = 32;
        const armLen = 24;

        // 从脚部位置向上构建（确保脚在this.y位置）
        const footY = this.y;
        const hipY = footY - legLength;
        const neckY = hipY - bodyLength;
        const headCenterY = neckY - headRadius;
        const headCenterX = this.x;

        // 1. 身体 (主体)
        ctx.beginPath();
        ctx.moveTo(this.x, neckY);
        ctx.lineTo(this.x, hipY);
        ctx.stroke();

        // 2. 腿部 (动态 - 交替前后摆动)
        const legSwing = Math.sin(this.animationTime) * 18; // 增加摆动幅度

        // 左腿 - 前后摆动
        ctx.beginPath();
        ctx.moveTo(this.x, hipY);
        const kneeLX = this.x + legSwing * 0.4; // 膝盖跟随摆动
        const kneeLY = hipY + legLength * 0.5;
        const footLX = this.x + legSwing; // 脚的前后位置
        const footLY = footY;
        ctx.quadraticCurveTo(kneeLX, kneeLY, footLX, footLY);
        ctx.stroke();

        // 右腿 - 与左腿相反方向摆动
        ctx.beginPath();
        ctx.moveTo(this.x, hipY);
        const kneeRX = this.x - legSwing * 0.4; // 反向摆动
        const kneeRY = hipY + legLength * 0.5;
        const footRX = this.x - legSwing; // 反向位置
        const footRY = footY;
        ctx.quadraticCurveTo(kneeRX, kneeRY, footRX, footRY);
        ctx.stroke();

        // 3. 手臂和球拍 (调用独立方法)
        const shoulderY = neckY + 5;
        this.renderArms(ctx, shoulderY, armLen);

        // 4. 头部 (最后绘制，避免被身体遮挡) - 参考图风格：白底黑框
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3; // 头部轮廓略细于身体
        ctx.stroke();

        // 5. 绅士礼帽 (Top Hat) - 参考图
        ctx.fillStyle = '#000000';
        const hatBrimWidth = headRadius * 2.4;
        const hatBrimHeight = 6;
        const hatBodyWidth = headRadius * 1.6;
        const hatBodyHeight = headRadius * 1.8;
        const hatY = headCenterY - headRadius; // 戴在头顶

        // 帽檐
        ctx.save();
        ctx.translate(headCenterX, hatY);
        ctx.rotate(-0.1 * (this.side === PlayerSide.LEFT ? 1 : -1)); // 稍微倾斜

        ctx.beginPath(); // 帽筒
        ctx.rect(-hatBodyWidth / 2, -hatBodyHeight, hatBodyWidth, hatBodyHeight);
        ctx.fill();

        ctx.beginPath(); // 帽檐
        ctx.rect(-hatBrimWidth / 2, -2, hatBrimWidth, hatBrimHeight);
        ctx.fill();

        ctx.restore();
    }

    private renderArms(ctx: CanvasRenderingContext2D, shoulderY: number, armLength: number): void {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;

        // 发球准备姿势：球拍在后，球在前
        if (this.isServingMode) {
            if (this.side === PlayerSide.LEFT) {
                // ===== 玩家发球姿势（LEFT） =====
                // 持球手：在身体右前下方（延长手臂）
                const ballHandAngle = Math.PI / 6; // 30度，右前下方
                const ballHandX = this.x + Math.cos(ballHandAngle) * armLength * 1.3;
                const ballHandY = shoulderY + Math.sin(ballHandAngle) * armLength * 1.3;

                ctx.beginPath();
                ctx.moveTo(this.x, shoulderY);
                ctx.lineTo(ballHandX, ballHandY);
                ctx.stroke();

                // 在持球手上绘制羽毛球
                this.renderHandBall(ctx, ballHandX, ballHandY);

                // 球拍手角度计算
                let racketHandAngle: number;
                if (this.isServingAnimation) {
                    // 发球动画：从135度逆时针旋转到30度
                    const progress = this.servingProgress / Constants.SERVING_ANIMATION_DURATION;
                    const startAngle = Math.PI - Math.PI / 4; // 135度
                    const endAngle = Math.PI / 6; // 30度
                    racketHandAngle = startAngle - (startAngle - endAngle) * progress;
                } else {
                    // 准备姿势：球拍在身体左后方（135度）
                    racketHandAngle = Math.PI - Math.PI / 4; // 135度，左后方
                }

                const racketHandX = this.x + Math.cos(racketHandAngle) * armLength;
                const racketHandY = shoulderY + Math.sin(racketHandAngle) * armLength;

                // 绘制手臂
                ctx.beginPath();
                ctx.moveTo(this.x, shoulderY);
                ctx.lineTo(racketHandX, racketHandY);
                ctx.stroke();

                // 绘制球拍
                this.renderRacket(ctx, racketHandX, racketHandY, racketHandAngle);
            } else {
                // ===== AI发球姿势（RIGHT） =====
                // 持球手：在身体左前下方
                const ballHandAngle = Math.PI - Math.PI / 6; // 150度，左前下方
                const ballHandX = this.x + Math.cos(ballHandAngle) * armLength * 1.3;
                const ballHandY = shoulderY + Math.sin(ballHandAngle) * armLength * 1.3;

                ctx.beginPath();
                ctx.moveTo(this.x, shoulderY);
                ctx.lineTo(ballHandX, ballHandY);
                ctx.stroke();

                // 在持球手上绘制羽毛球
                this.renderHandBall(ctx, ballHandX, ballHandY);

                // 球拍手角度计算
                let racketHandAngle: number;
                if (this.isServingAnimation) {
                    // 发球动画：从45度顺时针旋转到150度
                    const progress = this.servingProgress / Constants.SERVING_ANIMATION_DURATION;
                    const startAngle = Math.PI / 4; // 45度
                    const endAngle = Math.PI - Math.PI / 6; // 150度
                    racketHandAngle = startAngle + (endAngle - startAngle) * progress;
                } else {
                    // 准备姿势：球拍在身体右后方（45度）
                    racketHandAngle = Math.PI / 4; // 45度，右后方
                }

                const racketHandX = this.x + Math.cos(racketHandAngle) * armLength;
                const racketHandY = shoulderY + Math.sin(racketHandAngle) * armLength;

                // 绘制手臂
                ctx.beginPath();
                ctx.moveTo(this.x, shoulderY);
                ctx.lineTo(racketHandX, racketHandY);
                ctx.stroke();

                // 绘制球拍
                this.renderRacket(ctx, racketHandX, racketHandY, racketHandAngle);
            }
            return; // 发球姿势渲染完成
        }
        // 普通姿势：非持拍手（右上方，上偏右60度）
        const idleArmAngle = -Math.PI / 6; // -30度，右上方
        const idleHandX = this.x + Math.cos(idleArmAngle) * armLength * (this.side === PlayerSide.LEFT ? 1 : -1);
        const idleHandY = shoulderY + Math.sin(idleArmAngle) * armLength;

        ctx.beginPath();
        ctx.moveTo(this.x, shoulderY);
        ctx.lineTo(idleHandX, idleHandY);
        ctx.stroke();

        // 持拍手 (智能挥拍逻辑)
        let swingAngle: number;

        if (this.isSwinging) {
            // 挥拍动画
            const duration = this.swingType === SwingType.UPWARD ?
                Constants.SWING_UPWARD_DURATION : Constants.SWING_DOWNWARD_DURATION;
            const progress = this.swingProgress / duration;

            if (this.swingType === SwingType.UPWARD) {
                // 上挑：逆时针挥拍
                const startAngle = Constants.SWING_UPWARD_START;
                const endAngle = Constants.SWING_UPWARD_END;
                swingAngle = startAngle + (endAngle - startAngle) * progress;
            } else {
                // 下击：顺时针挥拍
                const startAngle = Constants.SWING_DOWNWARD_START;
                const endAngle = Constants.SWING_DOWNWARD_END;
                swingAngle = startAngle + (endAngle - startAngle) * progress;
            }

            // 右边玩家需要镜像角度
            if (this.side === PlayerSide.RIGHT) {
                swingAngle = Math.PI - swingAngle;
            }
        } else {
            // 准备姿势：球拍在身体后上方45度
            if (this.side === PlayerSide.LEFT) {
                // LEFT玩家：左上方（身体后方）
                swingAngle = -Math.PI * 3 / 4; // -135度，左上方
            } else {
                // RIGHT玩家：右上方（身体后方）
                swingAngle = -Math.PI / 4; // -45度，右上方
            }
        }

        const elbowX = this.x + Math.cos(swingAngle) * (armLength * 0.6);
        const elbowY = shoulderY + Math.sin(swingAngle) * (armLength * 0.6);
        const handX = this.x + Math.cos(swingAngle) * armLength;
        const handY = shoulderY + Math.sin(swingAngle) * armLength;

        // 绘制手臂
        ctx.beginPath();
        ctx.moveTo(this.x, shoulderY);
        ctx.quadraticCurveTo(elbowX, elbowY, handX, handY); // 使用曲线模拟关节
        ctx.stroke();

        // 绘制实体感球拍
        this.renderRacket(ctx, handX, handY, swingAngle);

        // 【调试】绘制碰撞检测区域（已禁用以提升性能）
        /*
        const collisionData = this.getRacketCollisionData();

        // 红色椭圆 - 拍框碰撞区
        ctx.save();
        ctx.translate(collisionData.frame.centerX, collisionData.frame.centerY);
        ctx.rotate(collisionData.frame.angle);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, collisionData.frame.width / 2, collisionData.frame.height / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 蓝色线 - 拍杆碰撞区
        ctx.save();
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = collisionData.shaft.radius * 2;
        ctx.beginPath();
        ctx.moveTo(collisionData.shaft.startX, collisionData.shaft.startY);
        ctx.lineTo(collisionData.shaft.endX, collisionData.shaft.endY);
        ctx.stroke();
        ctx.restore();

        // 绿色线 - 握柄碰撞区
        ctx.save();
        ctx.strokeStyle = 'green';
        ctx.lineWidth = collisionData.handle.radius * 2;
        ctx.beginPath();
        ctx.moveTo(collisionData.handle.startX, collisionData.handle.startY);
        ctx.lineTo(collisionData.handle.endX, collisionData.handle.endY);
        ctx.stroke();
        ctx.restore();
        */
    }

    private renderRacket(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + Math.PI / 2); // 球拍垂直于手臂延伸

        // 球拍配置（俯视角）
        const handleLen = 15;
        const shaftLen = 20;
        const headWidth = 12;   // 减小宽度（俯视角变窄）
        const headHeight = 36;  // 增加高度（保持纵向长）

        // 1. 手柄 (Handle) - 黑色加粗
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -handleLen);
        ctx.stroke();

        // 2. 中杆 (Shaft) - 细灰线
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -handleLen);
        ctx.lineTo(0, -(handleLen + shaftLen));
        ctx.stroke();

        // 3. 拍框 (Frame) - 俯视角扁平椭圆
        ctx.translate(0, -(handleLen + shaftLen + headHeight / 2));

        // 拍框外圈（俯视角：宽扁）
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, headWidth / 2, headHeight / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 4. 网线 (Strings) - 细白线交叉
        ctx.save();

        // 使用椭圆裁剪路径，确保网线不超出拍框
        ctx.beginPath();
        ctx.ellipse(0, 0, headWidth / 2 - 1.5, headHeight / 2 - 1.5, 0, 0, Math.PI * 2);
        ctx.clip();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;

        // 竖线
        for (let i = -headWidth / 2; i <= headWidth / 2; i += 3) {
            ctx.beginPath();
            ctx.moveTo(i, -headHeight / 2);
            ctx.lineTo(i, headHeight / 2);
            ctx.stroke();
        }

        // 横线
        for (let j = -headHeight / 2; j <= headHeight / 2; j += 3) {
            ctx.beginPath();
            ctx.moveTo(-headWidth / 2, j);
            ctx.lineTo(headWidth / 2, j);
            ctx.stroke();
        }

        ctx.restore();  // 恢复裁剪前的状态
        ctx.restore();  // 恢复球拍坐标系前的状态
    }

    /**
     * 在手上渲染小羽毛球（发球准备状态）
     */
    private renderHandBall(ctx: CanvasRenderingContext2D, handX: number, handY: number): void {
        // 不再显示手持球，保留空函数以避免调用错误
    }

    canHit(ballX: number, ballY: number): boolean {
        const distance = Math.sqrt(
            Math.pow(ballX - this.x, 2) + Math.pow(ballY - (this.y - this.height / 2), 2)
        );
        return distance < Constants.HIT_RANGE && this.hitCooldown === 0;
    }

    getRacketPosition(): { x: number; y: number } {
        const headRadius = 14;
        const bodyLength = 32;
        const legLength = 32;

        // 从脚部位置向上构建（与render保持一致）
        const footY = this.y;
        const hipY = footY - legLength;
        const neckY = hipY - bodyLength;
        const shoulderY = neckY + 5;
        const armLength = 24;

        let swingAngle: number;

        if (this.isSwinging) {
            // 挥拍动画 - 与renderArms一致
            const duration = this.swingType === SwingType.UPWARD
                ? Constants.SWING_UPWARD_DURATION
                : Constants.SWING_DOWNWARD_DURATION;
            const progress = this.swingProgress / duration;

            if (this.swingType === SwingType.UPWARD) {
                // 上挑：逆时针挥拍
                const startAngle = Constants.SWING_UPWARD_START;
                const endAngle = Constants.SWING_UPWARD_END;
                swingAngle = startAngle + (endAngle - startAngle) * progress;
            } else {
                // 下击：顺时针挥拍
                const startAngle = Constants.SWING_DOWNWARD_START;
                const endAngle = Constants.SWING_DOWNWARD_END;
                swingAngle = startAngle + (endAngle - startAngle) * progress;
            }

            // 右边玩家需要镜像角度
            if (this.side === PlayerSide.RIGHT) {
                swingAngle = Math.PI - swingAngle;
            }
        } else {
            // 准备姿势 - 与renderArms一致
            if (this.side === PlayerSide.LEFT) {
                swingAngle = -Math.PI * 3 / 4; // -135度，左上方
            } else {
                swingAngle = -Math.PI / 4; // -45度，右上方
            }
        }

        // 计算手的位置
        const handX = this.x + Math.cos(swingAngle) * armLength;
        const handY = shoulderY + Math.sin(swingAngle) * armLength;

        // 计算球拍中心（甜区）的位置
        // 球拍沿手臂延伸：手柄15 + 中杆20 + 拍框中心16 = 51
        const racketLength = 51;
        const racketCenterX = handX + Math.cos(swingAngle) * racketLength;
        const racketCenterY = handY + Math.sin(swingAngle) * racketLength;

        return {
            x: racketCenterX,
            y: racketCenterY
        };
    }

    /**
     * 获取球拍碰撞数据
     * 返回拍框（椭圆）和拍杆（线段）的位置和参数
     */
    getRacketCollisionData(): {
        frame: {
            centerX: number;
            centerY: number;
            width: number;
            height: number;
            angle: number;
        };
        shaft: {
            startX: number;
            startY: number;
            endX: number;
            endY: number;
            radius: number;
        };
        handle: {
            startX: number;
            startY: number;
            endX: number;
            endY: number;
            radius: number;
        };
    } {
        const headRadius = 14;
        const bodyLength = 32;
        const legLength = 32;

        // 从脚部位置向上构建（与render保持一致）
        const footY = this.y;
        const hipY = footY - legLength;
        const neckY = hipY - bodyLength;
        const shoulderY = neckY + 5;
        const armLength = 24;

        let swingAngle: number;

        if (this.isSwinging) {
            // 挥拍动画 - 与renderArms一致
            const duration = this.swingType === SwingType.UPWARD ?
                Constants.SWING_UPWARD_DURATION : Constants.SWING_DOWNWARD_DURATION;
            const progress = this.swingProgress / duration;

            if (this.swingType === SwingType.UPWARD) {
                // 上挑：逆时针挥拍
                const startAngle = Constants.SWING_UPWARD_START;
                const endAngle = Constants.SWING_UPWARD_END;
                swingAngle = startAngle + (endAngle - startAngle) * progress;
            } else {
                // 下击：顺时针挥拍
                const startAngle = Constants.SWING_DOWNWARD_START;
                const endAngle = Constants.SWING_DOWNWARD_END;
                swingAngle = startAngle + (endAngle - startAngle) * progress;
            }

            // 右边玩家需要镜像角度
            if (this.side === PlayerSide.RIGHT) {
                swingAngle = Math.PI - swingAngle;
            }
        } else {
            // 准备姿势 - 与renderArms一致
            if (this.side === PlayerSide.LEFT) {
                swingAngle = -Math.PI * 3 / 4; // -135度，左上方
            } else {
                swingAngle = -Math.PI / 4; // -45度，右上方
            }
        }

        // 计算手的位置
        const handX = this.x + Math.cos(swingAngle) * armLength;
        const handY = shoulderY + Math.sin(swingAngle) * armLength;

        // 球拍角度（垂直于手臂）
        const racketAngle = swingAngle + Math.PI / 2;

        // 拍杆起点（手的位置）到拍杆终点
        const handleLen = Constants.RACKET_HANDLE_LENGTH;
        const shaftLen = Constants.RACKET_SHAFT_LENGTH;

        const shaftStartX = handX + Math.cos(swingAngle) * handleLen;
        const shaftStartY = handY + Math.sin(swingAngle) * handleLen;
        const shaftEndX = handX + Math.cos(swingAngle) * (handleLen + shaftLen);
        const shaftEndY = handY + Math.sin(swingAngle) * (handleLen + shaftLen);

        // 拍框中心（在拍杆末端之后）
        const headCenterOffset = handleLen + shaftLen + Constants.RACKET_HEAD_HEIGHT / 2;
        const frameCenterX = handX + Math.cos(swingAngle) * headCenterOffset;
        const frameCenterY = handY + Math.sin(swingAngle) * headCenterOffset;

        return {
            frame: {
                centerX: frameCenterX,
                centerY: frameCenterY,
                width: Constants.RACKET_HEAD_WIDTH,
                height: Constants.RACKET_HEAD_HEIGHT,
                angle: racketAngle
            },
            shaft: {
                startX: shaftStartX,
                startY: shaftStartY,
                endX: shaftEndX,
                endY: shaftEndY,
                radius: Constants.RACKET_SHAFT_RADIUS
            },
            handle: {
                startX: handX,
                startY: handY,
                endX: shaftStartX,
                endY: shaftStartY,
                radius: 3  // 握柄半径，比拍杆粗
            }
        };
    }

    /**
     * 获取持球手的位置（用于发球时球跟随手的位置）
     */
    getBallHandPosition(): { x: number; y: number } {
        const headRadius = 14;
        const bodyLength = 32;
        const legLength = 32;
        const armLength = 24;

        const footY = this.y;
        const hipY = footY - legLength;
        const neckY = hipY - bodyLength;
        const shoulderY = neckY + 5;

        const direction = this.side === PlayerSide.LEFT ? 1 : -1;
        const ballHandAngle = Math.PI / 6; // 30度，与renderArms中的角度一致
        const ballHandX = this.x + Math.cos(ballHandAngle) * armLength * 1.3 * direction;
        const ballHandY = shoulderY + Math.sin(ballHandAngle) * armLength * 1.3;

        return { x: ballHandX, y: ballHandY };
    }

    /**
     * 获取球的高度相对于玩家（判断是低球还是高球）
     * @param ballY 球的Y坐标
     * @returns 'low'表示低球（需要上挑），'high'表示高球（需要下击）
     */
    getBallHeightRelativeToPlayer(ballY: number): 'low' | 'high' {
        const headRadius = 14;
        const bodyLength = 32;
        const legLength = 32;

        const footY = this.y;
        const hipY = footY - legLength;
        const neckY = hipY - bodyLength;

        // 注意：Y坐标越大越低，所以球的Y > 脖子Y表示球在脖子下方
        return ballY > neckY ? 'low' : 'high';
    }

    /**
     * 根据球的高度设置挥拍类型
     * @param ballY 球的Y坐标
     */
    setSwingType(ballY: number): void {
        const ballHeight = this.getBallHeightRelativeToPlayer(ballY);
        this.swingType = ballHeight === 'low' ? SwingType.UPWARD : SwingType.DOWNWARD;
    }
}
