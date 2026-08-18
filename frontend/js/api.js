(function () {
  window.API_BASE = window.API_BASE || ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') ? 'http://127.0.0.1:5000' : location.origin);

  window.showToast = function (message, tone) {
    let el = document.getElementById('app-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-toast';
      el.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9999;padding:12px 16px;border-radius:10px;background:#0B1220;color:#fff;font:500 13px var(--font-body);box-shadow:0 8px 24px rgba(0,0,0,.25);opacity:0;transition:opacity .2s';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.borderLeft = tone === 'amber' ? '3px solid #F59E0B' : '3px solid #2DD4BF';
    el.style.opacity = '1';
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2800);
  };

  window.apiFetch = async function (path, options) {
    const url = path.startsWith('http') ? path : window.API_BASE + path;
    const res = await fetch(url, options);
    let payload = null;
    try { payload = await res.json(); } catch (_) { payload = null; }
    if (!res.ok) {
      const msg = (payload && (payload.detail || payload.message)) || ('HTTP ' + res.status);
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return payload;
  };
})();
