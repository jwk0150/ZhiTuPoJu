/* 登录 → 简历：短暂光晕过渡（仅光 + 执图破局） */
(function (global) {
  'use strict';

  var FLAG = 'zhitu_auth_transit';
  var REDUCE = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var busy = false;

  function cleanupDom() {
    busy = false;
    var root = document.getElementById('zhitu-transit');
    if (root) {
      try { root.remove(); } catch (_) {}
    }
    var html = document.documentElement;
    html.classList.remove(
      'zhitu-transit-pending',
      'zhitu-transit-exit',
      'zhitu-transit-enter',
      'is-leaving',
      'is-revealed'
    );
    try { sessionStorage.removeItem(FLAG); } catch (_) {}
  }

  function ensureOverlay() {
    var el = document.getElementById('zhitu-transit');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'zhitu-transit';
    el.className = 'zhitu-transit';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="zhitu-transit__veil"></div>' +
      '<div class="zhitu-transit__glow" aria-hidden="true"></div>' +
      '<div class="zhitu-transit__brand">' +
        '<p class="zhitu-transit__title">执图破局</p>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function animate(el, props, ms) {
    return new Promise(function (resolve) {
      if (!el) {
        resolve();
        return;
      }
      if (REDUCE) {
        Object.keys(props).forEach(function (k) { el.style[k] = props[k]; });
        resolve();
        return;
      }
      el.style.transition = Object.keys(props)
        .map(function (k) {
          var cssKey = k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
          return cssKey + ' ' + (ms / 1000) + 's cubic-bezier(.22,1,.36,1)';
        })
        .join(', ');
      requestAnimationFrame(function () {
        Object.keys(props).forEach(function (k) { el.style[k] = props[k]; });
      });
      setTimeout(resolve, ms + 20);
    });
  }

  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, REDUCE ? Math.min(ms, 80) : ms); });
  }

  async function playExit() {
    var root = ensureOverlay();
    var veil = root.querySelector('.zhitu-transit__veil');
    var glow = root.querySelector('.zhitu-transit__glow');
    var brand = root.querySelector('.zhitu-transit__brand');
    root.classList.add('is-active');

    await Promise.all([
      animate(veil, { opacity: '1' }, REDUCE ? 120 : 320),
      animate(glow, { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' }, REDUCE ? 120 : 380),
      animate(brand, { opacity: '1', transform: 'translateY(0) scale(1)' }, REDUCE ? 120 : 380)
    ]);
    await wait(REDUCE ? 40 : 160);
  }

  async function go(url) {
    if (!url || busy) return;
    busy = true;
    try {
      sessionStorage.setItem(FLAG, '1');
    } catch (_) {}
    try {
      await playExit();
    } catch (_) {}
    // 用 href 保留历史，浏览器返回可回到登录页；残留丝幕靠 pageshow 清理
    try {
      global.location.href = url;
    } catch (_) {
      busy = false;
    }
    // bfcache 返回后仍停在本页时，允许再次点击登录/开发者入口
    global.setTimeout(function () { busy = false; }, 1200);
  }

  async function playEnterIfNeeded() {
    var pending = false;
    try {
      pending = sessionStorage.getItem(FLAG) === '1';
      sessionStorage.removeItem(FLAG);
    } catch (_) {}

    if (!pending) {
      cleanupDom();
      return;
    }

    document.documentElement.classList.remove('zhitu-transit-pending');
    document.documentElement.classList.add('zhitu-transit-enter');

    var root = ensureOverlay();
    var veil = root.querySelector('.zhitu-transit__veil');
    var glow = root.querySelector('.zhitu-transit__glow');
    var brand = root.querySelector('.zhitu-transit__brand');

    root.classList.add('is-active');
    if (veil) { veil.style.opacity = '1'; }
    if (glow) {
      glow.style.opacity = '1';
      glow.style.transform = 'translate(-50%, -50%) scale(1)';
    }
    if (brand) {
      brand.style.opacity = '1';
      brand.style.transform = 'translateY(0) scale(1)';
    }

    await wait(REDUCE ? 40 : 120);
    document.documentElement.classList.add('is-revealed');

    await Promise.all([
      animate(brand, { opacity: '0', transform: 'translateY(-6px) scale(1.03)' }, REDUCE ? 100 : 280),
      animate(glow, { opacity: '0', transform: 'translate(-50%, -50%) scale(1.08)' }, REDUCE ? 100 : 320),
      animate(veil, { opacity: '0' }, REDUCE ? 100 : 340)
    ]);

    cleanupDom();
  }

  // 返回/前进（含 bfcache）时清掉残留丝幕，避免卡在过渡层
  global.addEventListener('pageshow', function () {
    var path = (global.location.pathname || '').toLowerCase();
    var onAuth = /\/(login\.html|index\.html)?$/i.test(path) || /\/frontend\/?$/i.test(path);
    if (onAuth) {
      cleanupDom();
      return;
    }
    var root = document.getElementById('zhitu-transit');
    if (root && !document.documentElement.classList.contains('zhitu-transit-enter')) {
      cleanupDom();
    }
  });

  // 普通进入登录页时也清一次残留
  if (/\/(login\.html|index\.html)?$/i.test(global.location.pathname) ||
      /\/frontend\/?$/i.test(global.location.pathname)) {
    cleanupDom();
  }

  global.ZhituAuthTransit = {
    go: go,
    playEnterIfNeeded: playEnterIfNeeded,
    cleanup: cleanupDom,
    FLAG: FLAG
  };
})(window);
