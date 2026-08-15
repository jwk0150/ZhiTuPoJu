(function () {
  const PAGE_HREF = {
    home: 'home.html',
    map: '../portal.html#view-map',
    evolution: '../portal.html#view-evolution',
    discovery: '../portal.html#view-discovery',
    match: '../portal.html#view-match',
    qa: '../portal.html#view-qa',
    collection: '../portal.html#view-collection',
    analysis: '../portal.html#view-analysis',
    quality: '../portal.html#view-quality',
    settings: '../portal.html#view-settings',
    profile: '../profile.html'
  };

  const NAV = {
    primary: [
      { id: 'home', label: '首页 / 演示路径' },
      { id: 'map', label: '数字人才地图' },
      { id: 'evolution', label: '岗位能力演化' },
      { id: 'discovery', label: '新岗位发现' },
      { id: 'match', label: '人岗匹配诊断' },
      { id: 'qa', label: '智能问答' }
    ],
    more: [
      { id: 'collection', label: '数据采集' },
      { id: 'analysis', label: '趋势分析' },
      { id: 'quality', label: '质量监控' },
      { id: 'settings', label: '系统设置' }
    ]
  };

  const DEMO_STEPS = [
    { id: 'map', label: '地图' },
    { id: 'evolution', label: '演化' },
    { id: 'discovery', label: '发现' },
    { id: 'match', label: '匹配' }
  ];

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>',
    evolution: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>',
    discovery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>',
    match: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-7l-2-2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="m9 14 2 2 4-4"/></svg>',
    qa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    collection: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    analysis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    quality: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>'
  };

  function readUser() {
    try {
      const raw = localStorage.getItem('zhitu_user');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return { name: String(localStorage.getItem('zhitu_user') || '') };
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

  function moreIsOpen(pageId) {
    const inMore = NAV.more.some(function (item) { return item.id === pageId; });
    if (inMore) return true;
    return sessionStorage.getItem('shell_more_open') === '1';
  }

  function setMoreOpen(open) {
    sessionStorage.setItem('shell_more_open', open ? '1' : '0');
  }

  function navItemHtml(item, pageId) {
    const active = item.id === pageId ? ' active' : '';
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
    const siblings = parent.children;
    for (let i = 0; i < siblings.length; i++) {
      const el = siblings[i];
      if (el !== host && el.classList && el.classList.contains('page-main')) return el;
    }
    return null;
  }

  function renderNav(pageId, moreOpen) {
    const primary = NAV.primary.map(function (item) {
      return navItemHtml(item, pageId);
    }).join('');
    const moreItems = NAV.more.map(function (item) {
      return navItemHtml(item, pageId);
    }).join('');
    return (
      '<nav class="sidebar-nav">' +
        '<div class="nav-group">' +
          '<div class="nav-label">主线</div>' +
          primary +
        '</div>' +
        '<div class="nav-group' + (moreOpen ? ' is-open' : '') + '" data-nav-more>' +
          '<button type="button" class="nav-label nav-more-toggle" data-more-toggle>' +
            '更多' +
          '</button>' +
          '<div class="nav-more-items" data-more-items style="display:' + (moreOpen ? 'block' : 'none') + '">' +
            moreItems +
          '</div>' +
        '</div>' +
      '</nav>'
    );
  }

  function renderDemoPath(pageId) {
    const idx = DEMO_STEPS.findIndex(function (step) { return step.id === pageId; });
    const parts = ['<span class="demo-path-label">演示路径</span>'];
    DEMO_STEPS.forEach(function (step, i) {
      if (i > 0) parts.push('<span class="demo-path-arrow">→</span>');
      let cls = 'demo-path-step';
      if (step.id === pageId) cls += ' active';
      else if (idx >= 0 && i < idx) cls += ' done';
      parts.push('<a class="' + cls + '" href="' + PAGE_HREF[step.id] + '" data-demo="' + step.id + '">' + step.label + '</a>');
    });
    const next = idx < 0 ? DEMO_STEPS[0] : DEMO_STEPS[idx + 1];
    if (next) {
      parts.push('<a class="demo-path-next" href="' + PAGE_HREF[next.id] + '">下一步：' + next.label + '</a>');
    }
    return parts.join('');
  }

  function bindChrome(host, pageId) {
    const sidebar = host.querySelector('.sidebar');
    const backdrop = host.querySelector('.sidebar-backdrop');
    const toggle = host.querySelector('.topbar-toggle');
    const moreToggle = host.querySelector('[data-more-toggle]');
    const moreItems = host.querySelector('[data-more-items]');
    const moreGroup = host.querySelector('[data-nav-more]');

    function setSidebarOpen(open) {
      if (!sidebar) return;
      sidebar.classList.toggle('is-open', open);
      if (backdrop) backdrop.classList.toggle('is-visible', open);
    }

    if (toggle) {
      toggle.addEventListener('click', function () {
        setSidebarOpen(!sidebar.classList.contains('is-open'));
      });
    }
    if (backdrop) {
      backdrop.addEventListener('click', function () { setSidebarOpen(false); });
    }
    if (moreToggle && moreItems) {
      moreToggle.addEventListener('click', function () {
        const open = moreItems.style.display === 'none';
        moreItems.style.display = open ? 'block' : 'none';
        if (moreGroup) moreGroup.classList.toggle('is-open', open);
        setMoreOpen(open);
      });
    }
  }

  function mount(opts) {
    opts = opts || {};
    const pageId = opts.pageId || document.body.getAttribute('data-page') || 'home';
    const title = opts.title || '';
    const subtitle = opts.subtitle || '';

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
    const moreOpen = moreIsOpen(pageId);

    host.className = 'app-frame';
    host.innerHTML =
      '<div class="sidebar-backdrop"></div>' +
      '<aside class="sidebar">' +
        '<div class="sidebar-brand">' +
          '<div class="sidebar-brand-logo">' + ICONS.map + '</div>' +
          '<div class="sidebar-brand-text">' +
            '<div class="sidebar-brand-title">执图破局</div>' +
            '<div class="sidebar-brand-sub">ZHITU POJU</div>' +
          '</div>' +
        '</div>' +
        renderNav(pageId, moreOpen) +
        '<div class="sidebar-footer">' +
          '<div class="sidebar-user-avatar">' + userInitial(label) + '</div>' +
          '<div class="sidebar-user-info">' +
            '<div class="sidebar-user-name">' + label + '</div>' +
            '<div class="sidebar-user-role">演示账号</div>' +
          '</div>' +
        '</div>' +
      '</aside>' +
      '<div class="main-column">' +
        '<header class="topbar">' +
          '<button type="button" class="topbar-toggle" aria-label="打开导航">' + ICONS.menu + '</button>' +
          '<div class="topbar-title-block">' +
            '<div class="topbar-title">' + title + '</div>' +
            (subtitle ? '<div class="topbar-subtitle">' + subtitle + '</div>' : '') +
          '</div>' +
          '<div class="topbar-actions">' +
            '<a class="topbar-user" href="' + PAGE_HREF.profile + '">' +
              '<span class="topbar-user-avatar">' + userInitial(label) + '</span>' +
              '<span class="topbar-user-label">' + label + '</span>' +
            '</a>' +
          '</div>' +
        '</header>' +
        '<div class="demo-path">' + renderDemoPath(pageId) + '</div>' +
      '</div>';

    const column = host.querySelector('.main-column');
    if (pageMain && column) column.appendChild(pageMain);

    bindChrome(host, pageId);
  }

  window.PAGE_HREF = PAGE_HREF;
  window.Shell = { mount: mount, NAV: NAV, DEMO_STEPS: DEMO_STEPS };
})();
