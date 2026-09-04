(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var STORE_KEY = 'zhitu_admin_prefs_v1';
  var MATRIX_KEY = 'zhitu_perm_matrix_v2';
  var defaults = {
    density: 'comfortable',
    autoRefresh: 60,
    notify: true,
    shortcuts: true
  };
  var prefs = load();

  // —— 角色 × 权限默认矩阵（与权限矩阵页对齐） ——
  var ROLE_DEFAULTS = {
    admin: { 'crawler.view': 1, 'crawler.run': 1, 'crawler.config': 1, 'crawler.delete': 1, 'jobs.view': 1, 'jobs.edit': 1, 'jobs.export': 1, 'jobs.delete': 1, 'graph.view': 1, 'graph.edit': 1, 'graph.merge': 1, 'knowledge.upload': 1, 'quality.view': 1, 'quality.gate': 1, 'audit.export': 1, 'user.view': 1, 'user.toggle': 1, 'user.role': 1, 'user.invite': 1, 'notice.view': 1, 'notice.publish': 1, 'notice.schedule': 1, 'report.export': 1, 'cleaning.view': 1, 'cleaning.run': 1 },
    operator: { 'crawler.view': 1, 'crawler.run': 1, 'jobs.view': 1, 'jobs.edit': 1, 'jobs.export': 1, 'graph.view': 1, 'graph.edit': 1, 'knowledge.upload': 1, 'quality.view': 1, 'user.view': 1, 'notice.view': 1, 'notice.publish': 1, 'notice.schedule': 1, 'report.export': 1, 'cleaning.view': 1, 'cleaning.run': 1 },
    analyst: { 'crawler.view': 1, 'jobs.view': 1, 'jobs.export': 1, 'graph.view': 1, 'quality.view': 1, 'audit.export': 1, 'notice.view': 1, 'report.export': 1, 'cleaning.view': 1 }
  };

  // 页面 → 所需权限（null = 任何内部登录者；'__admin__' = 仅管理员）
  var PAGE_PERMS = {
    'admin.html': null,
    'pipeline.html': 'crawler.view',
    'knowledge.html': 'graph.view',
    'quality.html': 'quality.view',
    'jobs-pool.html': 'jobs.view',
    'crawler.html': 'crawler.view',
    'cleaning.html': 'cleaning.view',
    'permissions.html': '__admin__',
    'users.html': 'user.view',
    'notice.html': 'notice.view',
    'report.html': 'report.export'
  };

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (raw && typeof raw === 'object') return Object.assign({}, defaults, raw);
    } catch (_) {}
    return Object.assign({}, defaults);
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(prefs)); } catch (_) {}
    apply();
  }
  function apply() {
    document.documentElement.dataset.density = prefs.density;
    document.documentElement.dataset.notify = prefs.notify ? 'on' : 'off';
  }
  apply();

  // —— 当前用户与其权限集合 ——
  function currentUser() {
    try { return JSON.parse(localStorage.getItem('zhitu_user') || 'null'); } catch (_) { return null; }
  }
  function currentRole() {
    var u = currentUser();
    var r = String((u && u.role) || '').toLowerCase();
    return ROLE_DEFAULTS[r] ? r : null; // user 等非内部角色返回 null
  }
  function matrixFor(role) {
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(MATRIX_KEY) || 'null'); } catch (_) {}
    if (stored && stored[role]) {
      var out = {};
      Object.keys(stored[role]).forEach(function (k) { out[k] = stored[role][k] ? 1 : 0; });
      return out;
    }
    return ROLE_DEFAULTS[role] || {};
  }
  function can(perm) {
    var role = currentRole();
    if (!role) return false;
    if (role === 'admin') return true;
    return !!matrixFor(role)[perm];
  }

  // —— 侧栏按权限显隐 ——
  function applyNavPerms() {
    $$('.admin-nav a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var file = href.split('#')[0].split('/').pop();
      var perm = PAGE_PERMS[file];
      if (perm === undefined) return;
      if (perm === null) { a.style.display = ''; return; }
      if (perm === '__admin__') {
        a.style.display = currentRole() === 'admin' ? '' : 'none';
        return;
      }
      a.style.display = can(perm) ? '' : 'none';
    });
  }

  // —— 403 面板（保留顶栏） ——
  function render403(title, desc) {
    var main = document.querySelector('.admin-main');
    window.__admin403 = true;
    if (main) {
      Array.prototype.slice.call(main.children).forEach(function (child) {
        if (!child.classList.contains('admin-topbar')) child.remove();
      });
      var wrap = document.createElement('section');
      wrap.className = 'workspace section-block';
      wrap.innerHTML = '<article class="panel" style="padding:48px 32px;text-align:center">'
        + '<span class="eyebrow">403 · FORBIDDEN</span>'
        + '<h2 style="margin:12px 0 8px;font:600 24px var(--font-serif)">' + title + '</h2>'
        + '<p style="margin:0 0 18px;color:var(--admin-muted);font-size:13px">' + desc + '</p>'
        + '<a class="ghost-btn" href="admin.html" style="display:inline-flex;align-items:center">返回指挥台</a>'
        + '</article>';
      main.appendChild(wrap);
    }
    return false;
  }

  // —— 页面守卫 ——
  function guardPage() {
    var file = location.pathname.split('/').pop() || 'admin.html';
    // 整个内部端仅限内部角色（管理员/运营/分析师）
    if (!currentRole()) {
      return render403('该页面仅限内部用户访问', '请使用内部端账号（管理员 / 运营 / 分析师）登录。');
    }
    var perm = PAGE_PERMS[file];
    if (perm === undefined || perm === null) return true;
    if (perm === '__admin__') {
      if (currentRole() === 'admin') return true;
      return render403('当前身份无权访问此页面', '此页面仅管理员可用。');
    }
    if (can(perm)) return true;
    return render403('当前身份无权访问此页面', '如需开通，请联系管理员在「权限矩阵」中调整。');
  }

  // —— 注入 DOM：侧栏齿轮 + 退出 + 设置抽屉 + 快捷键覆盖层 ——
  function injectSidebarButtons() {
    var sidebar = $('#adminSidebar');
    if (!sidebar || $('#adminSettingsBtn')) return;

    var foot = sidebar.querySelector('.sidebar-foot');

    // 设置按钮
    var btn = document.createElement('button');
    btn.id = 'adminSettingsBtn';
    btn.className = 'admin-settings-btn';
    btn.type = 'button';
    btn.title = '设置';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    btn.addEventListener('click', openDrawer);

    // 退出按钮
    var logout = document.createElement('button');
    logout.id = 'adminLogoutBtn';
    logout.className = 'admin-settings-btn admin-logout-btn';
    logout.type = 'button';
    logout.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span>退出登录</span>';
    logout.addEventListener('click', function () {
      try { localStorage.removeItem('zhitu_user'); localStorage.removeItem('zhitu_token'); } catch (_) {}
      window.location.href = '../index.html';
    });

    if (foot) {
      foot.parentNode.insertBefore(btn, foot.nextSibling);
      btn.parentNode.insertBefore(logout, btn.nextSibling);
    } else {
      sidebar.appendChild(btn);
      sidebar.appendChild(logout);
    }
  }

  function injectDrawer() {
    if ($('#adminSettingsDrawer')) return;
    var scrim = document.createElement('div');
    scrim.id = 'adminSettingsScrim';
    scrim.className = 'admin-scrim';
    scrim.addEventListener('click', closeDrawer);

    var drawer = document.createElement('aside');
    drawer.id = 'adminSettingsDrawer';
    drawer.className = 'admin-settings-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML =
      '<header class="asd-head"><div><span class="eyebrow">ADMIN / PREFERENCES</span><h3>设置</h3></div><button class="asd-close" type="button" aria-label="关闭">×</button></header>'
      + '<div class="asd-body">'
      + '<section class="asd-group"><span class="eyebrow">APPEARANCE</span>'
      + '<div class="asd-row"><span class="asd-label">密度</span><div class="seg" data-pref="density"><button type="button" data-val="comfortable" class="seg-btn">舒适</button><button type="button" data-val="compact" class="seg-btn">紧凑</button></div></div>'
      + '</section>'
      + '<section class="asd-group"><span class="eyebrow">DATA</span>'
      + '<div class="asd-row"><span class="asd-label">自动刷新</span><div class="seg" data-pref="autoRefresh"><button type="button" data-val="30" class="seg-btn">30 秒</button><button type="button" data-val="60" class="seg-btn">60 秒</button><button type="button" data-val="0" class="seg-btn">关闭</button></div></div>'
      + '<div class="asd-row asd-toggle"><span class="asd-label">桌面通知</span><label class="switch"><input type="checkbox" data-pref-toggle="notify" /><span class="switch-track"></span></label></div>'
      + '</section>'
      + '<section class="asd-group"><span class="eyebrow">SHORTCUTS</span>'
      + '<div class="kbd-grid">'
      + '<div><kbd>?</kbd><span>查看快捷键</span></div>'
      + '<div><kbd>R</kbd><span>刷新数据</span></div>'
      + '<div><kbd>/</kbd><span>聚焦搜索</span></div>'
      + '<div><kbd>Esc</kbd><span>关闭弹层</span></div>'
      + '</div></section>'
      + '<section class="asd-group asd-foot">'
      + '<button type="button" class="asd-reset" id="adminSettingsReset">恢复默认</button>'
      + '</section>'
      + '</div>';
    drawer.querySelector('.asd-close').addEventListener('click', closeDrawer);
    document.body.appendChild(scrim);
    document.body.appendChild(drawer);

    drawer.querySelectorAll('.seg').forEach(function (seg) {
      var key = seg.getAttribute('data-pref');
      seg.querySelectorAll('.seg-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.getAttribute('data-val');
          prefs[key] = isNaN(Number(v)) ? v : Number(v);
          save();
          syncDrawer();
        });
      });
    });
    drawer.querySelectorAll('[data-pref-toggle]').forEach(function (input) {
      input.checked = !!prefs[input.getAttribute('data-pref-toggle')];
      input.addEventListener('change', function () {
        prefs[input.getAttribute('data-pref-toggle')] = input.checked;
        save();
      });
    });
    drawer.querySelector('#adminSettingsReset').addEventListener('click', function () {
      prefs = Object.assign({}, defaults);
      save();
      syncDrawer();
    });
    syncDrawer();
  }

  function syncDrawer() {
    var drawer = $('#adminSettingsDrawer');
    if (!drawer) return;
    drawer.querySelectorAll('.seg').forEach(function (seg) {
      var key = seg.getAttribute('data-pref');
      seg.querySelectorAll('.seg-btn').forEach(function (b) {
        b.classList.toggle('is-on', String(prefs[key]) === b.getAttribute('data-val'));
      });
    });
    drawer.querySelectorAll('[data-pref-toggle]').forEach(function (input) {
      input.checked = !!prefs[input.getAttribute('data-pref-toggle')];
    });
  }

  function openDrawer() {
    injectDrawer();
    $('#adminSettingsDrawer').classList.add('is-open');
    $('#adminSettingsDrawer').setAttribute('aria-hidden', 'false');
    $('#adminSettingsScrim').classList.add('is-open');
  }
  function closeDrawer() {
    var d = $('#adminSettingsDrawer'); if (d) { d.classList.remove('is-open'); d.setAttribute('aria-hidden', 'true'); }
    var s = $('#adminSettingsScrim'); if (s) s.classList.remove('is-open');
  }

  // —— 快捷键覆盖层 ——
  function injectShortcuts() {
    if ($('#shortcutsOverlay')) return;
    var scrim = document.createElement('div');
    scrim.id = 'shortcutsScrim';
    scrim.className = 'admin-scrim';
    scrim.addEventListener('click', closeShortcuts);
    var rows = [
      { keys: ['?'], desc: '显示 / 隐藏本面板' },
      { keys: ['Esc'], desc: '关闭任意弹层' },
      { keys: ['R'], desc: '刷新当前页数据' },
      { keys: ['/'], desc: '聚焦搜索框' }
    ];
    var overlay = document.createElement('div');
    overlay.id = 'shortcutsOverlay';
    overlay.className = 'shortcuts-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="shortcuts-card"><header><span class="eyebrow">KEYBOARD SHORTCUTS</span><h3>快捷键</h3><button class="asd-close" type="button" aria-label="关闭">×</button></header>'
      + '<div class="shortcuts-grid">'
      + rows.map(function (row) {
        return '<div class="sc-row"><div class="sc-keys">' + row.keys.map(function (k) { return '<kbd>' + k + '</kbd>'; }).join(' ') + '</div><div class="sc-desc">' + row.desc + '</div></div>';
      }).join('')
      + '</div></div>';
    overlay.querySelector('.asd-close').addEventListener('click', closeShortcuts);
    document.body.appendChild(scrim);
    document.body.appendChild(overlay);
  }
  function openShortcuts() {
    injectShortcuts();
    $('#shortcutsOverlay').classList.add('is-open');
    $('#shortcutsOverlay').setAttribute('aria-hidden', 'false');
    $('#shortcutsScrim').classList.add('is-open');
  }
  function closeShortcuts() {
    var o = $('#shortcutsOverlay'); if (o) { o.classList.remove('is-open'); o.setAttribute('aria-hidden', 'true'); }
    var s = $('#shortcutsScrim'); if (s) s.classList.remove('is-open');
  }

  // —— 键盘绑定 ——
  document.addEventListener('keydown', function (e) {
    if (!prefs.shortcuts) return;
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) {
      if (e.key === 'Escape') { closeDrawer(); closeShortcuts(); }
      return;
    }
    if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); openShortcuts(); return; }
    if (e.key === 'Escape') { closeDrawer(); closeShortcuts(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); var btn = $('#refreshBtn'); if (btn) btn.click(); return; }
    if (e.key === '/') {
      var inp = document.querySelector('input[type="search"]');
      if (inp) { e.preventDefault(); inp.focus(); if (inp.select) inp.select(); }
    }
  });

  // —— 自动刷新 ——
  function applyAutoRefresh() {
    if (window.__adminAutoRefreshTimer) { clearInterval(window.__adminAutoRefreshTimer); window.__adminAutoRefreshTimer = null; }
    if (prefs.autoRefresh > 0 && typeof window.refreshAdminData === 'function') {
      window.__adminAutoRefreshTimer = setInterval(function () { window.refreshAdminData(); }, prefs.autoRefresh * 1000);
    }
  }

  window.adminShell = {
    openDrawer: openDrawer, closeDrawer: closeDrawer,
    openShortcuts: openShortcuts, closeShortcuts: closeShortcuts,
    prefs: prefs, can: can, currentRole: currentRole, currentUser: currentUser,
    applyNavPerms: applyNavPerms, ROLE_DEFAULTS: ROLE_DEFAULTS
  };

  function init() {
    guardPage();
    applyNavPerms();
    injectSidebarButtons();
    injectDrawer();
    injectShortcuts();
    applyAutoRefresh();
    setTimeout(function () {
      if (typeof window.refreshAdminData !== 'function' && typeof window.refreshData === 'function') {
        window.refreshAdminData = window.refreshData;
        applyAutoRefresh();
      }
    }, 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();