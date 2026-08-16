(function () {
  function hrefBase() {
    const path = String(location.pathname || '').replace(/\\/g, '/');
    if (/\/pages\/more\//.test(path)) return '../';
    return '';
  }

  function buildPageHref() {
    const b = hrefBase();
    return {
      home: b + 'home.html',
      map: b + 'map.html',
      insight: b + 'insight.html',
      evolution: b + 'insight.html',
      analysis: b + 'insight.html?tab=trends',
      discovery: b + 'discovery.html',
      match: b + 'match.html',
      profile: b + 'match.html?tab=profile',
      qa: b + 'qa-embed.html',
      data: b + 'more/data.html',
      collection: b + 'more/data.html',
      quality: b + 'more/data.html?tab=quality',
      settings: b + 'more/settings.html'
    };
  }

  const PAGE_HREF = buildPageHref();

  const NAV = {
    primary: [
      { id: 'home', label: '工作台' },
      { id: 'map', label: '数字人才地图' },
      { id: 'insight', label: '岗位洞察' },
      { id: 'discovery', label: '新岗位发现' },
      { id: 'match', label: '人岗匹配' }
    ],
    more: [
      { id: 'data', label: '数据底座' }
    ]
  };

  const NAV_ALIASES = {
    evolution: 'insight',
    analysis: 'insight',
    collection: 'data',
    quality: 'data',
    profile: 'match'
  };

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>',
    insight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>',
    discovery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>',
    match: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-7l-2-2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="m9 14 2 2 4-4"/></svg>',
    data: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    qa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
  };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readUser() {
    try {
      const raw = localStorage.getItem('zhitu_user');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function userLabel(user) {
    if (!user) return '访客';
    return user.name || user.username || user.displayName || user.nickname || '访客';
  }

  function userInitial(label) {
    const text = String(label || '访').trim();
    return text.slice(0, 1) || '访';
  }

  function resolveNavId(pageId) {
    return NAV_ALIASES[pageId] || pageId;
  }

  function navItemHtml(item, pageId) {
    const navId = resolveNavId(pageId);
    const active = item.id === navId ? ' active' : '';
    const href = PAGE_HREF[item.id] || '#';
    const icon = ICONS[item.id] || '';
    return (
      '<a class="nav-item' + active + '" href="' + href + '" data-nav="' + item.id + '">' +
        icon + '<span>' + item.label + '</span>' +
      '</a>'
    );
  }

  function findPageMainSibling(host) {
    const byId = document.getElementById('page-main');
    if (byId && !host.contains(byId)) return byId;
    const parent = host.parentElement;
    if (!parent) return null;
    for (let i = 0; i < parent.children.length; i++) {
      const el = parent.children[i];
      if (el !== host && el.classList && el.classList.contains('page-main')) return el;
    }
    return null;
  }

  function renderNav(pageId) {
    const items = NAV.primary.concat(NAV.more);
    return (
      '<nav class="topnav-nav">' +
        items.map(function (item) { return navItemHtml(item, pageId); }).join('') +
      '</nav>'
    );
  }

  function qaSrc() {
    const b = hrefBase();
    return b + 'qa-embed.html';
  }

  function ensureQaUi() {
    if (document.getElementById('shell-qa-root')) return;
    const root = document.createElement('div');
    root.id = 'shell-qa-root';
    root.innerHTML =
      '<button type="button" class="qa-fab" id="qa-fab" aria-label="打开智能问答">' +
        ICONS.qa +
        '<span>问答</span>' +
      '</button>' +
      '<div class="qa-drawer" id="qa-drawer" aria-hidden="true">' +
        '<div class="qa-drawer-head">' +
          '<div class="qa-drawer-title">智能问答<small>图谱 · RAG</small></div>' +
          '<button type="button" class="qa-drawer-close" id="qa-drawer-close" aria-label="关闭">' + ICONS.close + '</button>' +
        '</div>' +
        '<iframe class="qa-drawer-frame" id="qa-drawer-frame" title="智能问答" src="about:blank"></iframe>' +
      '</div>' +
      '<div class="qa-drawer-mask" id="qa-drawer-mask" hidden></div>';
    document.body.appendChild(root);

    const fab = document.getElementById('qa-fab');
    const drawer = document.getElementById('qa-drawer');
    const mask = document.getElementById('qa-drawer-mask');
    const frame = document.getElementById('qa-drawer-frame');
    const closeBtn = document.getElementById('qa-drawer-close');

    function setOpen(open) {
      drawer.classList.toggle('is-open', open);
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
      mask.hidden = !open;
      fab.classList.toggle('is-hidden', open);
      if (open && (!frame.getAttribute('src') || frame.getAttribute('src') === 'about:blank')) {
        frame.setAttribute('src', qaSrc());
      }
      try { sessionStorage.setItem('shell_qa_open', open ? '1' : '0'); } catch (_) {}
    }

    fab.addEventListener('click', function () { setOpen(true); });
    closeBtn.addEventListener('click', function () { setOpen(false); });
    mask.addEventListener('click', function () { setOpen(false); });

    try {
      if (sessionStorage.getItem('shell_qa_open') === '1' || location.hash === '#qa') {
        setOpen(true);
      }
    } catch (_) {}

    window.ShellQA = { open: function () { setOpen(true); }, close: function () { setOpen(false); } };
  }

  function mount(opts) {
    opts = opts || {};
    const pageId = opts.pageId || document.body.getAttribute('data-page') || 'home';
    const embed = !!opts.embed;

    if (!document.body.getAttribute('data-page')) {
      document.body.setAttribute('data-page', pageId);
    }

    let host = document.getElementById('app-shell');
    if (!host) {
      host = document.createElement('div');
      host.id = 'app-shell';
      document.body.insertBefore(host, document.body.firstChild);
    }

    const pageMain = findPageMainSibling(host);
    const user = readUser();
    const label = userLabel(user);
    const safeLabel = escapeHtml(label);

    host.className = 'app-frame';
    host.innerHTML =
      '<header class="topnav">' +
        '<div class="topnav-left">' +
          '<a class="topnav-brand" href="' + PAGE_HREF.home + '" aria-label="执图破局">' +
            '<span class="topnav-brand-logo" role="img" aria-label="执图破局"></span>' +
            '<span class="topnav-brand-title">执图破局</span>' +
          '</a>' +
        '</div>' +
        '<div class="topnav-center">' +
          renderNav(pageId) +
        '</div>' +
        '<div class="topnav-right">' +
          '<a class="topnav-user" href="' + PAGE_HREF.profile + '" title="' + safeLabel + '">' +
            '<span class="topnav-user-avatar">' + escapeHtml(userInitial(label)) + '</span>' +
            '<span class="topnav-user-label">' + safeLabel + '</span>' +
          '</a>' +
        '</div>' +
      '</header>' +
      '<div class="main-column"></div>';

    const column = host.querySelector('.main-column');
    if (pageMain && column) {
      if (embed) pageMain.classList.add('page-main--embed');
      column.appendChild(pageMain);
    }

    ensureQaUi();
  }

  window.PAGE_HREF = PAGE_HREF;
  window.Shell = { mount: mount, NAV: NAV, openQA: function () { ensureQaUi(); window.ShellQA && window.ShellQA.open(); } };
})();
