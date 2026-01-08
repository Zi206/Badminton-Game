/**
 * 音效管理器
 * 负责加载、管理和播放所有游戏音效
 */
export class SoundManager {
    private sounds: Map<string, HTMLAudioElement> = new Map();
    private volume: number = 0.5; // 默认音量50%
    private muted: boolean = false;

    // 音效起始时间配置（秒），用于跳过开头的静音部分
    private soundStartTimes: Map<string, number> = new Map();

    // 音效独立音量配置（0-1），用于调整特定音效的音量
    private soundVolumes: Map<string, number> = new Map();

    /**
     * 音效名称常量
     */
    static readonly HIT = 'hit';           // 击球音效
    static readonly SERVE = 'serve';       // 发球音效
    static readonly LAND = 'land';         // 落地音效
    static readonly WALL = 'wall';         // 墙体碰撞音效
    static readonly GROUND = 'ground';     // 地板音效
    static readonly NET = 'net';           // 球网音效
    static readonly WIN = 'win';           // 胜利音效
    static readonly LOSE = 'lose';         // 失败音效

    /**
     * 加载所有音效文件
     */
    async loadSounds(): Promise<void> {
        // 音效配置：path为文件路径，startTime为起始播放时间（秒），volume为音量倍数（默认1.0）
        // startTime用于跳过音效开头的静音部分，让声音立即响起
        const soundFiles = [
            // 击球音效 (1.mp3) - 玩家按J键上挑或K键下击时播放
            { name: SoundManager.HIT, path: 'assets/sounds/hit.mp3', startTime: 0.35, volume: 1.0 },

            // 发球音效 (2.mp3) - 玩家或AI发球动画中点触发时播放 [音量加倍]
            { name: SoundManager.SERVE, path: 'assets/sounds/serve.mp3', startTime: 0.35, volume: 1.0 },

            // 落地音效 (3.mp3) - 玩家跳跃后落地时播放
            { name: SoundManager.LAND, path: 'assets/sounds/land.mp3', startTime: 0.85, volume: 1.0 },

            // 墙体碰撞音效 (4.mp3) - 羽毛球碰到左右边界或天花板时播放
            { name: SoundManager.WALL, path: 'assets/sounds/wall.mp3', startTime: 0.3, volume: 1.0 },

            // 触地音效 (5.mp3) - 羽毛球落到地面时播放（木地板材质）
            { name: SoundManager.GROUND, path: 'assets/sounds/ground.mp3', startTime: 0.3, volume: 1.0 },

            // 球网碰撞音效 (6.mp3) - 羽毛球碰到球网时播放
            { name: SoundManager.NET, path: 'assets/sounds/net.mp3', startTime: 0.3, volume: 1.0 },

            // 胜利音效 (7.mp3) - 玩家得分达到10分时播放
            { name: SoundManager.WIN, path: 'assets/sounds/win.mp3', startTime: 1.00, volume: 1.0 },

            // 失败音效 (8.mp3) - AI得分达到10分时播放
            { name: SoundManager.LOSE, path: 'assets/sounds/lose.mp3', startTime: 1.00, volume: 1.0 },
        ];

        const loadPromises = soundFiles.map(({ name, path, startTime, volume }) => {
            return new Promise<void>((resolve, reject) => {
                const audio = new Audio(path);
                audio.preload = 'auto';
                audio.volume = this.volume;

                audio.addEventListener('canplaythrough', () => {
                    this.sounds.set(name, audio);
                    this.soundStartTimes.set(name, startTime); // 保存起始时间
                    this.soundVolumes.set(name, volume); // 保存音量倍数
                    resolve();
                }, { once: true });

                audio.addEventListener('error', (e) => {
                    console.error(`Failed to load sound: ${path}`, e);
                    reject(e);
                });

                // 开始加载
                audio.load();
            });
        });

        await Promise.all(loadPromises);
        console.log('All sounds loaded successfully');
    }

    /**
     * 播放指定音效
     * @param soundName 音效名称
     */
    play(soundName: string): void {
        if (this.muted) return;

        const sound = this.sounds.get(soundName);
        if (!sound) {
            console.warn(`Sound not found: ${soundName}`);
            return;
        }

        // 克隆音频节点以支持同时播放多个相同音效
        const clone = sound.cloneNode() as HTMLAudioElement;

        // 获取该音效的音量倍数，应用到基础音量上
        const volumeMultiplier = this.soundVolumes.get(soundName) || 1.0;
        clone.volume = Math.min(1.0, this.volume * volumeMultiplier); // 确保不超过1.0

        // 获取配置的起始时间，跳过静音部分
        const startTime = this.soundStartTimes.get(soundName) || 0;
        clone.currentTime = startTime;

        clone.play().catch(err => {
            console.warn(`Failed to play sound: ${soundName}`, err);
        });
    }

    /**
     * 设置音量
     * @param volume 音量值 (0-1)
     */
    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
        this.sounds.forEach(sound => {
            sound.volume = this.volume;
        });
    }

    /**
     * 切换静音状态
     */
    toggleMute(): void {
        console.log('toggleMute called, before:', this.muted);
        this.muted = !this.muted;
        console.log('toggleMute called, after:', this.muted);
    }

    /**
     * 设置静音状态
     */
    setMuted(muted: boolean): void {
        this.muted = muted;
    }

    /**
     * 获取静音状态
     */
    isMuted(): boolean {
        return this.muted;
    }
}
