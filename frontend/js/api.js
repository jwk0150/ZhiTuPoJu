(function () {
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
