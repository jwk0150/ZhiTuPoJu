/* ============================================================
 * 讯飞数字人 · AI 面试官控制器（ESM）
 * 依赖：frontend/vendor/avatar-sdk（讯飞数字人 Web SDK v3.2.3）
 *
 * 正确自动播放策略（官方推荐）：
 *   player.defaultMuted = true  → 画面自动出现（无需再点）
 *   任意用户交互时 player.resume() → 恢复声音
 *   writeText 在 connected 后自动发送，驱动口型/动作（静音也可动）
 * ============================================================ */
import AvatarPlatform, { SDKEvents, PlayerEvents } from '../vendor/avatar-sdk/index.js';

const DEFAULT_SERVER_URL = 'wss://avatar.cn-huadong-1.xf-yun.com/v1/interact';

function errDetail(e) {
  if (!e) return '';
  if (typeof e === 'string') return e;
  const code = e.code || e.errorCode || e.ret || e.err_code || e.name || '';
  const msg = e.message || e.msg || e.error || e.desc || '';
  const bits = [code, msg].filter(Boolean).map(String);
  try {
    if (!bits.length) bits.push(JSON.stringify(e).slice(0, 160));
  } catch (_) { /* noop */ }
  return bits.join(' · ');
}

function isAutoplayBlock(e) {
  const code = e && (e.code || e.errorCode || e.ret || e.err_code);
  const s = String(code == null ? '' : code);
  const msg = String((e && (e.message || e.msg || e.name)) || '').toLowerCase();
  return s === '0x4043' || Number(code) === 0x4043 || Number(code) === 16451
    || msg.includes('not allowed') || msg.includes('not-allowed') || msg.includes('playnotallowed');
}

class AvatarInterviewer {
  constructor() {
    this.platform = null;
    this.player = null;
    this.ready = false;
    this.container = null;
    this.pendingText = null;
    this.onStatus = null; // (state, err?) => void
    this._starting = null;
    this._muted = true; // 与 defaultMuted 对齐；resume 后改为 false
    this._gestureBound = false;
  }

  get configured() {
    const c = window.AVATAR_CONFIG || {};
    return !!(c.appId && c.apiKey && c.apiSecret && c.avatarId && c.vcn);
  }

  get isReady() { return this.ready; }
  get isUnlocked() { return !this._muted; }

  _bindGestureResume() {
    if (this._gestureBound) return;
    this._gestureBound = true;
    const resume = () => { this.resumeAudio(); };
    // 任意交互即可恢复声音（进入面试本身就是一次点击）
    document.addEventListener('click', resume, true);
    document.addEventListener('keydown', resume, true);
    document.addEventListener('touchstart', resume, true);
    this._resumeHandler = resume;
  }

  /** 恢复有声播放；可在用户手势回调里调用 */
  resumeAudio() {
    try {
      this._muted = false;
      if (this.player) {
        try { this.player.muted = false; } catch (_) { /* noop */ }
        const p = this.player.resume && this.player.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
      this._forceDomPlay(false);
      if (this.onStatus) this.onStatus('unlocked');
    } catch (_) { /* noop */ }
  }

  _wirePlayer(player) {
    if (!player || player === this.player) return;
    this.player = player;
    try { player.defaultMuted = true; } catch (_) { /* noop */ }
    try { player.muted = true; } catch (_) { /* noop */ }
    player.on(PlayerEvents.play, () => {
      if (this.onStatus) this.onStatus('playing');
    });
    player.on(PlayerEvents.playNotAllowed, () => {
      // 画面仍可静音播放；不把整段判失败
      this._forceDomPlay(true);
      if (this.onStatus) this.onStatus('needs_gesture', { message: '画面已就绪，交互后自动开声' });
    });
    player.on(PlayerEvents.error, (e) => {
      console.warn('[AvatarInterviewer] player error:', e);
      if (isAutoplayBlock(e)) {
        this._forceDomPlay(true);
        if (this.onStatus) this.onStatus('needs_gesture', e);
        return;
      }
      if (this.onStatus) this.onStatus('error', e);
    });
  }

  _forceDomPlay(muted) {
    try {
      const root = this.container;
      if (!root) return;
      root.querySelectorAll('video, audio').forEach((el) => {
        try {
          el.setAttribute('playsinline', 'true');
          el.setAttribute('webkit-playsinline', 'true');
          el.playsInline = true;
          el.muted = muted !== false;
          const p = el.play && el.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (_) { /* noop */ }
      });
    } catch (_) { /* noop */ }
  }

  _moveVideo(toContainer) {
    try {
      if (!this.container || this.container === toContainer) return;
      while (toContainer.firstChild) toContainer.removeChild(toContainer.firstChild);
      while (this.container.firstChild) toContainer.appendChild(this.container.firstChild);
      if (this.container.id === 'avatar-preload-holder' && this.container.parentElement) {
        this.container.parentElement.removeChild(this.container);
      }
      this.container = toContainer;
      this._forceDomPlay(true);
    } catch (e) {
      console.warn('[AvatarInterviewer] moveVideo failed, will restart:', e);
      this.stop();
    }
  }

  async ensureStarted(container) {
    if (container) this.container = container;
    if (!this.container) return false;
    if (!this.configured) {
      if (this.onStatus) this.onStatus('unconfigured');
      return false;
    }
    this._bindGestureResume();

    if (this.ready && this.container && container && this.container !== container) {
      this._moveVideo(container);
      return true;
    }
    if (this.ready) {
      this._forceDomPlay(this._muted);
      return true;
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
        const platform = new AvatarPlatform({ useInlinePlayer: true, logLevel: 3 });
        platform.setApiInfo({
          appId: c.appId,
          apiKey: c.apiKey,
          apiSecret: c.apiSecret,
          serverUrl: c.serverUrl || DEFAULT_SERVER_URL,
          sceneId: c.sceneId || '',
        });
        // 与 IGlobalConfig 一致；分辨率用偶数竖屏；fps 必须 15|20|25
        platform.setGlobalParams({
          avatar: {
            avatar_id: c.avatarId,
            width: c.width || 720,
            height: c.height || 1280,
            audio_format: c.audioFormat != null ? c.audioFormat : 1,
            scale: c.scale != null ? c.scale : 1,
            move_h: c.moveH || 0,
            move_v: c.moveV || 0,
          },
          tts: {
            vcn: c.vcn,
            speed: c.speed ?? 50,
            pitch: c.pitch ?? 50,
            volume: c.volume ?? 100,
          },
          stream: {
            protocol: c.protocol || 'xrtc',
            bitrate: c.bitrate || 1000000,
            fps: c.fps || 20,
            alpha: c.alpha != null ? c.alpha : 0,
          },
          avatar_dispatch: { interactive_mode: 0 },
        });

        platform.on(SDKEvents.connected, () => {
          this.ready = true;
          this._retryCount = 0;
          this._wirePlayer(platform.player || this.player);
          this._forceDomPlay(true);
          if (this.onStatus) this.onStatus('ready');
          // 静音也可驱动口型/动作 — 自动播报
          if (this.pendingText) {
            const t = this.pendingText;
            this.pendingText = null;
            this.writeText(t);
          }
        });
        platform.on(SDKEvents.stream_start, () => {
          this._forceDomPlay(true);
          if (this.onStatus) this.onStatus('stream');
        });
        platform.on(SDKEvents.frame_start, () => {
          this._forceDomPlay(true);
          if (this.onStatus) this.onStatus('playing');
        });
        platform.on(SDKEvents.error, (e) => {
          console.warn('[AvatarInterviewer] sdk error:', e);
          if (isAutoplayBlock(e)) {
            this._forceDomPlay(true);
            if (this.onStatus) this.onStatus('needs_gesture', e);
            return;
          }
          this.ready = false;
          if (this.onStatus) this.onStatus('error', Object.assign({ message: errDetail(e) }, e || {}));
        });
        platform.on(SDKEvents.disconnected, () => {
          this.ready = false;
          if (this.onStatus) this.onStatus('error', { message: '数字人连接已断开' });
        });

        this.platform = platform;
        // 先拿 player 并 defaultMuted，再 start（官方防自动播放限制做法）
        try {
          const player = platform.player || platform.createPlayer();
          this._wirePlayer(player);
        } catch (pe) {
          console.warn('[AvatarInterviewer] createPlayer:', pe);
        }
      }

      await this.platform.start({ wrapper: this.container });
      this._wirePlayer(this.platform.player || this.player);
      this._forceDomPlay(true);
      // start resolve 时有时尚未 fire connected；短暂后若已有 video 也标 ready
      if (!this.ready) {
        const hasVideo = !!(this.container && this.container.querySelector('video'));
        if (hasVideo) {
          this.ready = true;
          if (this.onStatus) this.onStatus('ready');
          if (this.pendingText) {
            const t = this.pendingText;
            this.pendingText = null;
            this.writeText(t);
          }
        }
      }
      return true;
    } catch (e) {
      console.error('[AvatarInterviewer] start failed:', e);
      this.ready = false;
      this._retryCount = (this._retryCount || 0) + 1;
      if (this._retryCount <= 1) {
        try { if (this.platform) this.platform.stop(); } catch (_) {}
        await new Promise((r) => setTimeout(r, 600));
        try {
          await this.platform.start({ wrapper: this.container });
          this._forceDomPlay(true);
          return true;
        } catch (e2) {
          console.error('[AvatarInterviewer] retry failed:', e2);
          if (this.onStatus) this.onStatus('error', Object.assign({ message: errDetail(e2) }, e2 || {}));
          return false;
        }
      }
      if (this.onStatus) this.onStatus('error', Object.assign({ message: errDetail(e) }, e || {}));
      return false;
    }
  }

  /** 兼容旧调用：等同 resumeAudio */
  unlock() { return this.resumeAudio(); }

  speak(text) {
    if (text == null || text === '') return;
    const s = String(text);
    if (!this.ready) { this.pendingText = s; return; }
    this.writeText(s);
  }

  writeText(text) {
    if (!this.platform) return;
    this.platform.writeText(text, { nlp: false }).then(() => {
      this._forceDomPlay(this._muted);
    }).catch((e) => {
      console.error('[AvatarInterviewer] writeText failed:', e);
      if (this.onStatus) this.onStatus('error', Object.assign({ message: '播报失败 · ' + errDetail(e) }, e || {}));
    });
  }

  setMuted(muted) {
    this._muted = !!muted;
    if (this.player) {
      try { this.player.muted = this._muted; } catch (_) { /* noop */ }
    }
    this._forceDomPlay(this._muted);
    if (!muted) this.resumeAudio();
  }

  interrupt() {
    if (this.platform && this.ready) {
      this.platform.interrupt().catch(() => {});
    }
  }

  stop() {
    this.ready = false;
    this.pendingText = null;
    this._muted = true;
    if (this.platform) {
      try { this.platform.stop(); } catch (e) { /* noop */ }
    }
  }

  destroy() {
    this.ready = false;
    this.pendingText = null;
    this._muted = true;
    if (this._resumeHandler) {
      document.removeEventListener('click', this._resumeHandler, true);
      document.removeEventListener('keydown', this._resumeHandler, true);
      document.removeEventListener('touchstart', this._resumeHandler, true);
      this._resumeHandler = null;
      this._gestureBound = false;
    }
    if (this.platform) {
      try { this.platform.destroy(); } catch (e) { /* noop */ }
      this.platform = null;
    }
    this.player = null;
    this.container = null;
  }
}

const instance = new AvatarInterviewer();
window.AvatarInterviewer = instance;
export default instance;
