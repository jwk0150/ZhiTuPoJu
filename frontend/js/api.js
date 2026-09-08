(function () {
  // 共享 XSS 转义（收口 9 处散装 esc 实现，resume-library 版漏转义单引号的隐患）
  window.zhesc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function localApiBase() {
    if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
      return 'http://127.0.0.1:5000';
    }
    return location.origin;
  }
  window.API_BASE = window.API_BASE || localApiBase();
  window.resolveApiBase = window.resolveApiBase || function () {
    return window.API_BASE || localApiBase();
  };

  // ---- JWT Token 存取（Global Agent Phase 1）----
  var TOKEN_KEY = 'zhitu_token';
  window.zhituGetToken = function () {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; }
  };
  window.zhituSetToken = function (token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (_) {}
  };
  window.zhituClearToken = function () { window.zhituSetToken(''); };

  window.showToast = function (message, tone) {
    if (window.Utils && window.Utils.showToast && window.Utils.showToast !== window.showToast) {
      return window.Utils.showToast(message, tone || 'mint');
    }
    const t = String(tone || 'mint');
    const colors = {
      mint: { bg: 'rgba(16,185,129,.94)', fg: '#fff' },
      teal: { bg: 'rgba(45,212,191,.94)', fg: '#06201c' },
      cyan: { bg: 'rgba(45,212,191,.94)', fg: '#06201c' },
      amber: { bg: 'rgba(245,158,11,.96)', fg: '#1a1205' },
      pink: { bg: 'rgba(247,37,133,.94)', fg: '#fff' },
      coral: { bg: 'rgba(239,68,68,.94)', fg: '#fff' },
      success: { bg: 'rgba(16,185,129,.94)', fg: '#fff' },
      error: { bg: 'rgba(239,68,68,.94)', fg: '#fff' },
      info: { bg: 'rgba(59,130,246,.94)', fg: '#fff' }
    };
    const c = colors[t] || colors.mint;
    let el = document.getElementById('zhitu-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'zhitu-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.className = 'zhitu-toast is-show';
    el.textContent = String(message || '');
    el.style.background = c.bg;
    el.style.color = c.fg;
    clearTimeout(window.__zhituToastTimer);
    window.__zhituToastTimer = setTimeout(() => {
      el.classList.remove('is-show');
    }, 2400);
  };

  // ---- 演示模式徽标（P3-10）----
  // 页面 API 请求失败（网络/超时/5xx）时会回退到内置演示数据；
  // 徽标明示当前数据口径，避免演示与真实数据混淆。
  // 手动常显：localStorage.setItem('zhitu_demo_mode','1')；双击徽标可临时隐藏。
  window.__zhituApiFail = 0;
  var _demoBadge = null;
  function demoBadge() {
    if (_demoBadge) return _demoBadge;
    _demoBadge = document.createElement('div');
    _demoBadge.id = 'zhitu-demo-badge';
    _demoBadge.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:99999;display:none;'
      + 'align-items:center;gap:6px;padding:6px 12px;border-radius:999px;'
      + 'background:rgba(60,45,30,.88);color:#f5ead2;font:600 12px/1.4 "Microsoft YaHei",sans-serif;'
      + 'box-shadow:0 6px 18px rgba(40,30,20,.25);cursor:default;backdrop-filter:blur(4px)';
    _demoBadge.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#e8a23c;display:inline-block"></span><span id="zhitu-demo-text">演示数据</span>';
    _demoBadge.addEventListener('dblclick', function () { _demoBadge.style.display = 'none'; });
    (document.body || document.documentElement).appendChild(_demoBadge);
    return _demoBadge;
  }
  function showDemoBadge(text) {
    try {
      var b = demoBadge();
      var t = b.querySelector('#zhitu-demo-text');
      if (t && text) t.textContent = text;
      b.style.display = 'flex';
    } catch (_) {}
  }
  function isManualDemo() {
    try { return localStorage.getItem('zhitu_demo_mode') === '1'; } catch (_) { return false; }
  }
  if (isManualDemo()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { showDemoBadge('演示模式'); });
    else setTimeout(function () { showDemoBadge('演示模式'); }, 0);
  }

  // 全局 fetch 补丁：仅对 /api/ 请求做失败计数与徽标（覆盖原生 fetch / apiFetch / 各模块）
  var _origFetch = window.fetch;
  if (typeof _origFetch === 'function') {
    window.fetch = function (input, init) {
      var url = '';
      try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (_) {}
      var isApi = url.indexOf('/api/') >= 0;
      var p = _origFetch.apply(this, arguments);
      if (!isApi) return p;
      return p.then(function (res) {
        if (res && res.status >= 500) showDemoBadge('演示数据 · API 异常 ' + res.status);
        else window.__zhituApiFail = Math.max(0, window.__zhituApiFail);
        return res;
      }).catch(function (e) {
        window.__zhituApiFail += 1;
        showDemoBadge('演示数据 · API 不可达');
        throw e;
      });
    };
  }

  window.apiFetch = async function (path, options) {
    const url = path.startsWith('http') ? path : window.API_BASE + path;
    options = options || {};
    // 自动附带 Bearer Token（不覆盖调用方显式传入的 headers）
    const headers = Object.assign({}, options.headers || {});
    const token = window.zhituGetToken();
    if (token && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    if (Object.keys(headers).length) {
      options = Object.assign({}, options, { headers: headers });
    }
    const ctl = new AbortController();
    const timer = setTimeout(function () { ctl.abort(); }, 2500); // 慢查询超时回落，避免页面长时间挂起
    let res = null;
    try {
      res = await fetch(url, Object.assign({}, options, { signal: ctl.signal }));
    } finally { clearTimeout(timer); }
    if (!res) throw new Error('request timeout');
    let payload = null;
    try { payload = await res.json(); } catch (_) { payload = null; }
    if (!res.ok) {
      const msg = (payload && (payload.detail || payload.message)) || ('HTTP ' + res.status);
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return payload;
  };
})();
