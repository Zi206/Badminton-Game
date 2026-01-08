// 游戏常量和物理参数
export const Constants = {
    // 画布尺寸（渲染分辨率）
    CANVAS_WIDTH: 800,   // 从1200降低到800
    CANVAS_HEIGHT: 500,  // 从700降低到500

    // 地图边界
    BOUNDARY_LEFT: 0,      // 左边界
    BOUNDARY_RIGHT: 800,   // 右边界（等于画布宽度）
    BOUNDARY_TOP: 0,       // 上边界

    // 物理参数 - 玩家
    GRAVITY: 0.65,              // 玩家重力（增加落下速度）
    AIR_RESISTANCE: 0.975,      // 玩家空气阻力

    // ========== 物理参数 - 羽毛球速度控制 ==========
    // 【可调整】羽毛球重力
    // - 数值越大 = 球下落越快（更快触地）
    // - 数值越小 = 球下落越慢（飞得更远）
    // - 建议范围：0.3（慢） - 0.5（快）
    BALL_GRAVITY: 0.4,          // 当前：0.4

    // 【可调整】羽毛球空气阻力
    // - 数值越大 = 阻力越小，球飞得越快越远
    // - 数值越小 = 阻力越大，球很快减速
    // - 建议范围：0.96（慢） - 0.99（快）
    BALL_AIR_RESISTANCE: 0.98,  // 当前：0.98
    // ==============================================

    GROUND_Y: 410,       // 玩家和一般物体的地面位置
    BALL_GROUND_Y: 450,  // 球的触地判定位置（从430降到450，更低）

    // 球网参数
    NET_X: 400,      // 调整到新画布中心
    NET_HEIGHT: 100, // 增加球网高度
    NET_WIDTH: 4,
    NET_BASE_Y: 410, // 球网底部在地面

    // 发球线参数（隐形边界）
    SERVICE_LINE_OFFSET: 50,  // 发球线距离球网的距离
    SERVICE_LINE_LEFT: 350,    // 左侧发球线位置 (NET_X - OFFSET)
    SERVICE_LINE_RIGHT: 450,   // 右侧发球线位置 (NET_X + OFFSET)

    // 玩家参数
    PLAYER_HEIGHT: 90,  // 放大玩家（从60增加到90）
    PLAYER_WIDTH: 22,   // 相应增加宽度
    PLAYER_SPEED: 5,    // 稍微提升速度
    JUMP_FORCE: 15.2,   // 增加跳跃力度（补偿重力增加）
    RACKET_LENGTH: 35,  // 增加球拍长度
    HIT_RANGE: 65,      // 增加击球范围

    // 玩家初始位置
    PLAYER1_X: 170,   // 按比例调整
    PLAYER2_X: 630,

    // 球参数
    BALL_RADIUS: 9,   // 放大球（从6增加到9）
    BALL_INITIAL_Y: 200,

    // ========== 击球参数 - 控制击球后球的速度 ==========
    // 【可调整】扣杀力度
    // - 数值越大 = 球飞得越快越猛
    // - 建议范围：15（普通） - 22（超快）
    SMASH_POWER: 18,           // 当前：18
    SMASH_ANGLE: -0.7,         // 扣杀角度（负数=向下）

    // 【可调整】平抽力度
    // - 数值越大 = 球飞得越快
    // - 建议范围：12（普通） - 18（快）
    DRIVE_POWER: 14,           // 当前：14
    DRIVE_ANGLE: -0.25,        // 平抽角度

    // 【可调整】挑球力度
    // - 数值越大 = 球飞得越高越远
    // - 建议范围：10（低） - 16（高）
    LOB_POWER: 13,             // 当前：13
    LOB_ANGLE: 0.8,            // 挑球角度（正数=向上）
    // ================================================


    // 球拍碰撞参数（俯视角）
    RACKET_HEAD_WIDTH: 12,     // 拍框宽度（从24减到12，俯视角变窄）
    RACKET_HEAD_HEIGHT: 36,    // 拍框高度（从32增到36，保持长）
    RACKET_SHAFT_LENGTH: 20,   // 拍杆长度
    RACKET_SHAFT_RADIUS: 1.5,  // 拍杆碰撞半径
    RACKET_HANDLE_LENGTH: 15,  // 手柄长度（无碰撞）

    // 发球动画参数
    SERVE_ANIMATION_DURATION: 20,  // 发球挥拍持续时间（帧）
    SERVE_SWING_ANGLE_START: Math.PI / 2,   // 发球起始角度（向下）
    SERVE_SWING_ANGLE_END: -Math.PI / 3,    // 发球结束角度（向上）

    // 智能击球动画参数
    READY_STANCE_ANGLE: -Math.PI * 3 / 4,   // 准备姿势角度（左上角135度）
    SWING_UPWARD_START: -Math.PI * 3 / 4,   // 上挑起始角度（从准备姿势开始，左上）
    SWING_UPWARD_END: -Math.PI * 7 / 4,     // 上挑结束角度（逆时针到右下，-315度 = 45度）
    SWING_DOWNWARD_START: -Math.PI * 3 / 4, // 下击起始角度（从准备姿势开始，左上）
    SWING_DOWNWARD_END: 0,                  // 下击结束角度（顺时针到正右边，0度）
    SWING_UPWARD_DURATION: 16,              // 上挑动画持续时间（更快）
    SWING_DOWNWARD_DURATION: 18,            // 下击动画持续时间
    SERVING_ANIMATION_DURATION: 10,         // 发球动画持续时间（帧数）

    // AI参数
    AI_REACTION_DELAY: 150,
    AI_PREDICTION_FACTOR: 0.8,
    AI_MOVE_THRESHOLD: 15,

    // 粒子参数
    PARTICLE_COUNT: 6,      // 进一步减少
    PARTICLE_LIFETIME: 20,  // 进一步缩短

    // 游戏规则
    WINNING_SCORE: 10,

    // 动画参数
    LEG_ANIMATION_SPEED: 0.25,
    ARM_SWING_DURATION: 8,

    // 边界限制
    LEFT_BOUNDARY: 30,
    RIGHT_BOUNDARY: 770,
} as const;

// 游戏状态枚举
export enum GameState {
    LOADING,
    MENU,
    PLAYING,
    GAME_OVER,
}

// 玩家侧枚举
export enum PlayerSide {
    LEFT,
    RIGHT,
}

export enum GameMode {
    SINGLE_PLAYER,
    TWO_PLAYER,
    ONLINE,  // 联机模式
}
