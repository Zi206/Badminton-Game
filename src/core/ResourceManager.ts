// 资源管理器 - 负责异步加载图片资源和音效
import { SoundManager } from './SoundManager';

export class ResourceManager {
    private resources: Map<string, HTMLImageElement> = new Map();
    private loadingPromises: Promise<void>[] = [];
    private soundManager: SoundManager = new SoundManager();

    /**
     * 加载单个图片资源
     */
    loadImage(name: string, url: string): void {
        const img = new Image();
        const promise = new Promise<void>((resolve, reject) => {
            img.onload = () => {
                this.resources.set(name, img);
                console.log(`✓ 资源加载成功: ${name}`);
                resolve();
            };
            img.onerror = () => {
                console.warn(`✗ 资源加载失败: ${name}，使用占位符`);
                // 创建占位符图片
                const canvas = document.createElement('canvas');
                canvas.width = 100;
                canvas.height = 100;
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = '#D2691E';
                ctx.fillRect(0, 0, 100, 100);
                ctx.strokeStyle = '#8B4513';
                ctx.lineWidth = 2;
                ctx.strokeRect(0, 0, 100, 100);

                const placeholderImg = new Image();
                placeholderImg.src = canvas.toDataURL();
                placeholderImg.onload = () => {
                    this.resources.set(name, placeholderImg);
                    resolve();
                };
            };
            img.src = url;
        });
        this.loadingPromises.push(promise);
    }

    /**
     * 等待所有资源加载完成
     */
    async waitForAll(): Promise<void> {
        await Promise.all(this.loadingPromises);
        console.log(`所有图片资源加载完成 (${this.resources.size}个)`);

        // 加载音效
        await this.soundManager.loadSounds();
        console.log('所有音效加载完成');
    }

    /**
     * 获取已加载的图片资源
     */
    getImage(name: string): HTMLImageElement | null {
        return this.resources.get(name) || null;
    }

    /**
     * 检查资源是否已加载
     */
    hasImage(name: string): boolean {
        return this.resources.has(name);
    }

    /**
     * 获取音效管理器
     */
    getSoundManager(): SoundManager {
        return this.soundManager;
    }
}
