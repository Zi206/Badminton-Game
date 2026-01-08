// 音效管理器
export class AudioManager {
    private sounds: Map<string, HTMLAudioElement> = new Map();
    private muted: boolean = false;

    /**
     * 加载音效（可选）
     */
    loadSound(name: string, url: string): void {
        const audio = new Audio(url);
        audio.volume = 0.5;
        this.sounds.set(name, audio);
    }

    /**
     * 播放音效
     */
    play(name: string): void {
        if (this.muted) return;

        const sound = this.sounds.get(name);
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(() => {
                // 忽略播放错误
            });
        }
    }

    /**
     * 切换静音状态
     */
    toggleMute(): void {
        this.muted = !this.muted;
    }

    /**
     * 设置音量
     */
    setVolume(volume: number): void {
        this.sounds.forEach(sound => {
            sound.volume = Math.max(0, Math.min(1, volume));
        });
    }
}
