/* ============================================================
 * 讯飞数字人 · AI 面试官控制器（ESM）
 * 依赖：frontend/vendor/avatar-sdk（讯飞数字人 Web SDK v3.2.3）
 *
 * 配置来源：window.AVATAR_CONFIG（在 match.html 中定义，留空则降级为静态头像）
 *   appId / apiKey / apiSecret : 讯飞开放平台「超拟人数字人」应用凭据
 *   avatarId                    : 数字人形象 ID
 *   vcn                         : 音色 ID
 *   serverUrl                   : 服务地址（默认华东 1 节点）
 *   width / height              : 视频尺寸（默认 720x1280 竖屏）
 *
 * 用法：
 *   const ai = window.AvatarInterviewer;
 *   ai.onStatus = (state, err) => { ... };   // ready | unconfigured | error
 *   await ai.ensureStarted(containerDiv);     // 建立连接并拉流（可重复调用，内部复用连接）
 *   ai.speak('请介绍一下你的项目');            // 文本驱动，数字人朗读
 *   ai.stop();                                // 断开连接（下次 ensureStarted 会重连）
 *   ai.destroy();                             // 彻底销毁
 * ============================================================ */
import AvatarPlatform, { SDKEvents } from '../vendor/avatar-sdk/index.js';

const DEFAULT_SERVER_URL = 'wss://avatar.cn-huadong-1.xf-yun.com/v1/interact';

class AvatarInterviewer {
  constructor() {
    this.platform = null;
    this.ready = false;
    this.container = null;
    this.pendingText = null;
    this.onStatus = null; // (state: 'ready'|'unconfigured'|'error', err?) => void
    this._starting = null;
  }

  /** 是否已填齐凭据 */
  get configured() {
    const c = window.AVATAR_CONFIG || {};
    return !!(c.appId && c.apiKey && c.apiSecret && c.avatarId && c.vcn);
  }

  get isReady() { return this.ready; }

  /** 初始化（首次）或重连（后续），可重复调用 */
  async ensureStarted(container) {
    if (container) this.container = container;
    if (!this.container) return false;
    if (!this.configured) {
      if (this.onStatus) this.onStatus('unconfigured');
      return false;
    }

    if (this._starting) return this._starting;
    this._starting = this._doStart();
    try {
      return await this._starting;
    } finally {
      this._starting = null;
    }
  }

  async _doStart() {
    const c = window.AVATAR_CONFIG;
    try {
      if (!this.platform) {
        const platform = new AvatarPlatform({ useInlinePlayer: true, logLevel: 4 });
        platform.setApiInfo({
          appId: c.appId,
          apiKey: c.apiKey,
          apiSecret: c.apiSecret,
          serverUrl: c.serverUrl || DEFAULT_SERVER_URL,
        });
        platform.setGlobalParams({
          avatar: {
            avatar_id: c.avatarId,
            width: c.width || 720,
            height: c.height || 1280,
            audio_format: 1,
          },
          tts: { vcn: c.vcn, speed: c.speed ?? 50, pitch: c.pitch ?? 50, volume: c.volume ?? 100 },
          stream: { protocol: 'xrtc', bitrate: 1000000, fps: 25, alpha: 0 },
        });
        platform.on(SDKEvents.connected, () => {
          this.ready = true;
          if (this.onStatus) this.onStatus('ready');
          if (this.pendingText) {
            const t = this.pendingText;
            this.pendingText = null;
            this.writeText(t);
          }
        });
        platform.on(SDKEvents.error, (e) => {
          this.ready = false;
          if (this.onStatus) this.onStatus('error', e);
        });
        this.platform = platform;
      }
      await this.platform.start({ wrapper: this.container });
      return true;
    } catch (e) {
      console.error('[AvatarInterviewer] start failed:', e);
      this.ready = false;
      if (this.onStatus) this.onStatus('error', e);
      return false;
    }
  }

  /** 文本驱动朗读；连接未就绪时暂存，就绪后自动补发 */
  speak(text) {
    if (text == null || text === '') return;
    if (!this.ready) { this.pendingText = String(text); return; }
    this.writeText(String(text));
  }

  writeText(text) {
    if (!this.platform) return;
    this.platform.writeText(text, { nlp: false }).catch((e) => {
      console.error('[AvatarInterviewer] writeText failed:', e);
    });
  }

  interrupt() {
    if (this.platform && this.ready) {
      this.platform.interrupt().catch(() => {});
    }
  }

  /** 断开连接（保留 platform，下次 ensureStarted 会重连） */
  stop() {
    this.ready = false;
    this.pendingText = null;
    if (this.platform) {
      try { this.platform.stop(); } catch (e) { /* noop */ }
    }
  }

  destroy() {
    this.ready = false;
    this.pendingText = null;
    if (this.platform) {
      try { this.platform.destroy(); } catch (e) { /* noop */ }
      this.platform = null;
    }
    this.container = null;
  }
}

const instance = new AvatarInterviewer();
window.AvatarInterviewer = instance;
export default instance;
