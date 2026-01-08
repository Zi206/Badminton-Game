import { Constants } from '../utils/Constants';
import { SoundManager } from '../core/SoundManager';

export class Ball {
    x: number;
    y: number;
    vx: number = 0;
    vy: number = 0;
    radius: number = Constants.BALL_RADIUS;

    // 球的拖尾效果
    private trail: Array<{ x: number; y: number; alpha: number }> = [];
    private trailLength = 8;

    // 羽毛球图片
    private ballImage: HTMLImageElement | null = null;

    // 音效管理器
    private soundManager: SoundManager | null = null;

    // 用于检测触地时刻
    private wasInAir: boolean = true;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    /**
     * 设置羽毛球图片
     */
    setBallImage(img: HTMLImageElement): void {
        this.ballImage = img;
    }

    /**
     * 设置音效管理器
     */
    setSoundManager(manager: SoundManager): void {
        this.soundManager = manager;
    }

    /**
    /**
     * 更新球的物理状态
     */
    update(deltaTime: number = 1 / 60): void {
        // 应用重力（使用球专用的重力参数）
        this.vy += Constants.BALL_GRAVITY;

        // 应用空气阻力（羽毛球特性 - 使用球专用的空气阻力）
        this.vx *= Constants.BALL_AIR_RESISTANCE;
        this.vy *= Constants.BALL_AIR_RESISTANCE;

        // 更新位置
        this.x += this.vx;
        this.y += this.vy;

        // 更新拖尾
        this.trail.unshift({ x: this.x, y: this.y, alpha: 1 });
        if (this.trail.length > this.trailLength) {
            this.trail.pop();
        }

        // 更新拖尾透明度
        this.trail.forEach((point, index) => {
            point.alpha = 1 - (index / this.trailLength);
        });

        // 地图边界检测
        // 左边界
        if (this.x - this.radius < Constants.BOUNDARY_LEFT) {
            this.x = Constants.BOUNDARY_LEFT + this.radius;
            this.vx = Math.abs(this.vx) * 0.5; // 反弹并损失能量
            this.soundManager?.play(SoundManager.WALL);
        }
        // 右边界
        if (this.x + this.radius > Constants.BOUNDARY_RIGHT) {
            this.x = Constants.BOUNDARY_RIGHT - this.radius;
            this.vx = -Math.abs(this.vx) * 0.5; // 反弹并损失能量
            this.soundManager?.play(SoundManager.WALL);
        }
        // 上边界
        if (this.y - this.radius < Constants.BOUNDARY_TOP) {
            this.y = Constants.BOUNDARY_TOP + this.radius;
            this.vy = Math.abs(this.vy) * 0.5; // 反弹并损失能量
            this.soundManager?.play(SoundManager.WALL);
        }

        // 球网碰撞检测
        this.checkNetCollision();

        // 检测触地并播放音效
        const isCurrentlyOnGround = this.y >= Constants.BALL_GROUND_Y;
        if (isCurrentlyOnGround && this.wasInAir) {
            // 球刚刚落地
            this.soundManager?.play(SoundManager.GROUND);
            this.wasInAir = false;
        } else if (!isCurrentlyOnGround) {
            // 球在空中
            this.wasInAir = true;
        }
    }

    /**
     * 检测并处理球网碰撞
     */
    private checkNetCollision(): void {
        const netX = Constants.NET_X;
        const netTopY = Constants.NET_BASE_Y - Constants.NET_HEIGHT;
        const netBottomY = Constants.NET_BASE_Y;
        const netWidth = 15; // 球网碰撞宽度

        // 检测球是否在球网的高度范围内
        const ballInNetHeight = this.y - this.radius <= netBottomY && this.y + this.radius >= netTopY;

        // 检测球是否碰到球网
        if (ballInNetHeight) {
            // 球从左侧碰到球网
            if (this.vx > 0 && this.x + this.radius >= netX - netWidth / 2 && this.x - this.radius <= netX) {
                this.x = netX - netWidth / 2 - this.radius;
                this.vx = -this.vx * 0.6; // 反弹并损失能量
                this.vy *= 0.8; // 垂直速度也减弱
                this.soundManager?.play(SoundManager.NET);
            }
            // 球从右侧碰到球网
            else if (this.vx < 0 && this.x - this.radius <= netX + netWidth / 2 && this.x + this.radius >= netX) {
                this.x = netX + netWidth / 2 + this.radius;
                this.vx = -this.vx * 0.6; // 反弹并损失能量
                this.vy *= 0.8; // 垂直速度也减弱
                this.soundManager?.play(SoundManager.NET);
            }
        }

        // 检测球网顶部碰撞（球从上往下碰到球网顶部）
        if (this.vy > 0 &&
            Math.abs(this.x - netX) <= netWidth / 2 + this.radius &&
            this.y - this.radius <= netTopY &&
            this.y + this.radius >= netTopY - 5) {
            this.y = netTopY - this.radius;
            this.vy = -this.vy * 0.5; // 反弹，损失较多能量
            this.vx *= 0.7; // 水平速度也减弱
            this.soundManager?.play(SoundManager.NET);
        }
    }

    /**
     * 被击球
     * @param playerX 玩家X坐标
     * @param playerY 玩家Y坐标
     * @param playerHeight 玩家高度
     * @param direction 击球方向（1为向右，-1为向左）
     * @param racketAngle 球拍角度（弧度）
     * @param isUpward 是否是上挑击球（可选，默认为false）
     */
    hit(playerX: number, playerY: number, playerHeight: number, direction: number, racketAngle: number, isUpward: boolean = false): void {
        // 基础力量
        const basePower = 25;
        // 速度缩放因子（降低整体速度但保持弧线）
        const speedScale = 1.00;

        // 上挑击球特殊处理：固定往右上或左上45度飞
        // 直接使用传入的标志判断
        if (isUpward) {
            console.log('上挑击球！(IsUpward flag)', 'direction:', direction);
            // 播放击球音效
            this.soundManager?.play(SoundManager.HIT);
            const upwardAngle = -Math.PI / 4;  // -45度（右上）
            const speed = basePower * speedScale;

            if (direction === 1) {
                // 左侧玩家：往右上飞
                this.vx = Math.cos(upwardAngle) * speed;
                this.vy = Math.sin(upwardAngle) * speed;
            } else {
                // 右侧玩家：往左上飞
                this.vx = -Math.cos(upwardAngle) * speed;
                this.vy = Math.sin(upwardAngle) * speed;
            }

            // 清空拖尾
            this.trail = [];
            return; // 直接返回，不执行后面的下击逻辑
        }

        // 下击击球逻辑
        // 根据球拍角度计算击球方向
        let hitAngle = racketAngle;

        // 右侧玩家角度镜像处理
        if (direction === -1) {
            // 判断是上挑还是下击
            // 上挑：racketAngle通常在-135度到-315度之间（负值，逆时针）
            // 下击：racketAngle通常在-135度到0度之间（顺时针）

            // 下击：使用负号镜像
            hitAngle = -racketAngle;
        }

        // 提高击球角度，让球飞得更高（向上偏移30度 = 0.524弧度）
        const angleBoost = -0.424; // 负值表示向上
        hitAngle += angleBoost;

        // 设置速度（根据球拍角度，乘以缩放因子）
        this.vx = Math.cos(hitAngle) * basePower * direction * speedScale;
        this.vy = Math.sin(hitAngle) * basePower * speedScale;

        // 播放击球音效（下击）
        this.soundManager?.play(SoundManager.HIT);

        // 清空拖尾
        this.trail = [];
    }

    /**
 * 发球
 * @param direction 发球方向（1为向右，-1为向左）
 */
    serve(x: number, y: number, direction: number): void {
        this.x = x;
        this.y = y;
        // 优化发球轨迹 - 羽毛球发球特点：高抛物线，增强力度
        this.vx = 11 * direction;  // 水平速度（从13减小到11）
        this.vy = -18;             // 向上速度（从-16增加到-18）- 更高的弧线
        this.trail = [];
    }

    /**
     * 检测是否触地
     */
    isOnGround(): boolean {
        return this.y >= Constants.BALL_GROUND_Y;
    }

    /**
     * 重置球的位置
     */
    reset(x: number, y: number): void {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.trail = [];
    }

    /**
     * 渲染球
     */
    render(ctx: CanvasRenderingContext2D): void {
        // 渲染拖尾
        this.trail.forEach((point, index) => {
            if (index === 0) return; // 跳过当前位置

            ctx.beginPath();
            ctx.arc(point.x, point.y, this.radius * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${point.alpha * 0.2})`; // 减弱拖尾
            ctx.fill();
        });

        ctx.save();
        ctx.translate(this.x, this.y);

        // 根据速度方向旋转羽毛球
        let angle = 0;
        if (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1) {
            angle = Math.atan2(this.vy, this.vx);
        } else {
            // 静止时默认垂直向下
            angle = Math.PI / 2;
        }

        // 图片初始朝向是左下角（-225度），需要旋转补偿
        // 使羽毛球头部与飞行方向一致
        const imageOffset = Math.PI * 5 / 4; // 225度补偿
        ctx.rotate(angle + imageOffset);

        if (this.ballImage) {
            // ========== 羽毛球大小设置 ==========
            // 使用图片渲染羽毛球
            // 图片大小调整：保持与原canvas绘制大小一致（约32像素）

            // 【可调整】羽毛球显示大小
            // - this.radius * 3 = 很小
            // - this.radius * 4 = 较小
            // - this.radius * 5 = 当前大小（默认）
            // - this.radius * 6 = 较大
            // - this.radius * 7 = 很大
            // 或者直接设置固定像素：const targetSize = 40;
            const targetSize = this.radius * 5;
            // ========================================

            const scale = targetSize / this.ballImage.width;
            const w = this.ballImage.width * scale;
            const h = this.ballImage.height * scale;

            // 图片中心对齐，头朝向运动方向（右侧=0度）
            ctx.drawImage(this.ballImage, -w / 2, -h / 2, w, h);
        } else {
            // 降级方案：使用原canvas绘制
            const corkRadius = this.radius * 0.8;
            ctx.beginPath();
            ctx.arc(0, 0, corkRadius, -Math.PI / 2, Math.PI / 2);
            ctx.fillStyle = '#8B0000';
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.stroke();

            const skirtLen = this.radius * 1.8;
            const skirtWidthFront = corkRadius * 1.8;
            const skirtWidthBack = this.radius * 2.2;

            ctx.beginPath();
            ctx.moveTo(0, -skirtWidthFront / 2);
            ctx.lineTo(-skirtLen, -skirtWidthBack / 2);
            ctx.ellipse(-skirtLen, 0, skirtLen * 0.1, skirtWidthBack / 2, 0, Math.PI / 2, 3 * Math.PI / 2);
            ctx.lineTo(0, skirtWidthFront / 2);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fill();
            ctx.strokeStyle = '#DDD';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * 获取球的速度大小
     */
    getSpeed(): number {
        return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    }

    /**
     * 检测球与球拍的碰撞
     * @param racketData 球拍碰撞数据（拍框和拍杆）
     * @returns 是否发生碰撞
     */
    checkRacketCollision(racketData: {
        frame: { centerX: number; centerY: number; width: number; height: number; angle: number };
        shaft: { startX: number; startY: number; endX: number; endY: number; radius: number };
        handle: { startX: number; startY: number; endX: number; endY: number; radius: number };
    }, isUpward: boolean = false): boolean {
        // 如果是上挑击球，增加判定宽容度（让球更容易被击中）
        const extraMargin = isUpward ? 20 : 0;

        // 1. 检测与拍框（椭圆）的碰撞
        const frameCollision = this.checkEllipseCollision(
            racketData.frame.centerX,
            racketData.frame.centerY,
            racketData.frame.width / 2,
            racketData.frame.height / 2,
            racketData.frame.angle,
            extraMargin
        );


        if (frameCollision) return true;

        // 2. 检测与拍杆（线段）的碰撞
        const shaftCollision = this.checkLineSegmentCollision(
            racketData.shaft.startX,
            racketData.shaft.startY,
            racketData.shaft.endX,
            racketData.shaft.endY,
            racketData.shaft.radius
        );

        if (shaftCollision) return true;

        // 3. 检测与握柄（线段）的碰撞
        const handleCollision = this.checkLineSegmentCollision(
            racketData.handle.startX,
            racketData.handle.startY,
            racketData.handle.endX,
            racketData.handle.endY,
            racketData.handle.radius
        );

        return handleCollision;
    }

    /**
     * 检测球与旋转椭圆的碰撞
     * @param centerX 椭圆中心X
     * @param centerY 椭圆中心Y
     * @param semiMajorAxis 椭圆半长轴
     * @param semiMinorAxis 椭圆半短轴
     * @param angle 椭圆旋转角度
     */
    private checkEllipseCollision(
        centerX: number,
        centerY: number,
        semiMajorAxis: number,
        semiMinorAxis: number,
        angle: number,
        extraMargin: number = 0
    ): boolean {
        // 将球心坐标转换到椭圆的局部坐标系
        const dx = this.x - centerX;
        const dy = this.y - centerY;

        // 旋转变换（逆时针旋转-angle，相当于将椭圆旋转到水平）
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        // 椭圆方程：(x/a)² + (y/b)² <= 1
        // 考虑球的半径和额外宽容度
        const effectiveRadius = this.radius + extraMargin;
        const a = semiMajorAxis + effectiveRadius;  // 椭圆半长轴 + 有效半径
        const b = semiMinorAxis + effectiveRadius;  // 椭圆半短轴 + 有效半径

        const normalizedDist = (localX * localX) / (a * a) + (localY * localY) / (b * b);

        return normalizedDist <= 1;
    }

    /**
     * 检测球与线段的碰撞
     */
    private checkLineSegmentCollision(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        radius: number
    ): boolean {
        // 计算点到线段的最短距离
        const dx = endX - startX;
        const dy = endY - startY;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) {
            // 线段退化为点
            const distSquared = Math.pow(this.x - startX, 2) + Math.pow(this.y - startY, 2);
            return distSquared <= Math.pow(this.radius + radius, 2);
        }

        // 计算投影参数 t (0 <= t <= 1 表示在线段上)
        let t = ((this.x - startX) * dx + (this.y - startY) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));

        // 计算线段上最近的点
        const closestX = startX + t * dx;
        const closestY = startY + t * dy;

        // 计算球心到最近点的距离
        const distSquared = Math.pow(this.x - closestX, 2) + Math.pow(this.y - closestY, 2);

        return distSquared <= Math.pow(this.radius + radius, 2);
    }
}
