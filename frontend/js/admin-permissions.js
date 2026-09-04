(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var STORE_KEY = 'zhitu_perm_matrix_v2';
  var CHANGES_KEY = 'zhitu_perm_changes_v1';

  var ROLES = [
    { id: 'admin', label: '管理员', color: 'admin' },
    { id: 'operator', label: '运营', color: 'operator' },
    { id: 'analyst', label: '分析师', color: 'analyst' }
  ];
  var PERMS = [
    { group: '数据采集', items: [
      { id: 'crawler.view', label: '查看数据管线' },
      { id: 'crawler.run', label: '手动触发采集' },
      { id: 'crawler.config', label: '修改来源规则' },
      { id: 'crawler.delete', label: '删除采集任务' }
    ] },
    { group: '岗位数据', items: [
      { id: 'jobs.view', label: '查看岗位池' },
      { id: 'jobs.edit', label: '编辑岗位字段' },
      { id: 'jobs.export', label: '导出岗位数据' },
      { id: 'jobs.delete', label: '删除岗位记录' }
    ] },
    { group: '图谱与知识', items: [
      { id: 'graph.view', label: '查看图谱' },
      { id: 'graph.edit', label: '编辑图谱节点' },
      { id: 'graph.merge', label: '合并实体' },
      { id: 'knowledge.upload', label: '上传文档' }
    ] },
    { group: '质量与审计', items: [
      { id: 'quality.view', label: '查看质量面板' },
      { id: 'quality.gate', label: '调整可信防线阈值' },
      { id: 'audit.export', label: '导出审计记录' }
    ] },
    { group: '账号管理', items: [
      { id: 'user.view', label: '查看用户列表' },
      { id: 'user.toggle', label: '启用 / 停用账号' },
      { id: 'user.role', label: '修改用户角色' },
      { id: 'user.invite', label: '邀请新用户' }
    ] },
    { group: '清洗仓', items: [
      { id: 'cleaning.view', label: '查看清洗仓' },
      { id: 'cleaning.run', label: '一键清洗入库' }
    ] },
    { group: '公告与日报', items: [
      { id: 'notice.view', label: '查看系统公告' },
      { id: 'notice.publish', label: '发布系统公告' },
      { id: 'notice.schedule', label: '排期公告' },
      { id: 'report.export', label: '导出运营日报' }
    ] }
  ];

  var DEFAULTS = {
    admin: {},
    operator: {
      'crawler.view': true, 'crawler.run': true,
      'jobs.view': true, 'jobs.edit': true, 'jobs.export': true,
      'graph.view': true, 'graph.edit': true, 'knowledge.upload': true,
      'cleaning.view': true, 'cleaning.run': true,
      'quality.view': true,
      'user.view': true,
      'notice.view': true, 'notice.publish': true, 'notice.schedule': true,
      'report.export': true
    },
    analyst: {
      'crawler.view': true,
      'jobs.view': true, 'jobs.export': true,
      'graph.view': true,
      'cleaning.view': true,
      'quality.view': true, 'audit.export': true,
      'notice.view': true,
      'report.export': true
    }
  };
  // 管理员默认全量
  DEFAULTS.admin = (function () {
    var o = {};
    var all = [];
    PERMS.forEach(function (g) { g.items.forEach(function (i) { all.push(i.id); }); });
    all.forEach(function (k) { o[k] = true; });
    return o;
  })();

  var matrix = loadMatrix();
  var changes = [];
  var searchKeyword = '';

  function loadMatrix() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (raw) return raw;
    } catch (_) {}
    return clone(DEFAULTS);
  }
  function saveMatrix() { try { localStorage.setItem(STORE_KEY, JSON.stringify(matrix)); } catch (_) {} }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function totalGranted() {
    var n = 0;
    ROLES.forEach(function (r) {
      var m = matrix[r.id] || {};
      Object.keys(m).forEach(function (k) { if (m[k]) n++; });
    });
    return n;
  }
  function totalPerms() {
    var n = 0;
    PERMS.forEach(function (g) { n += g.items.length; });
    return n * ROLES.length;
  }
  function roleGranted(roleId) {
    var m = matrix[roleId] || {};
    return Object.keys(m).filter(function (k) { return m[k]; }).length;
  }

  function renderHeader() {
    var headRow = $('#permHeadRow');
    if (!headRow) return;
    var totalPerms = PERMS.flatMap(function (g) { return g.items; }).length;
    var html = ROLES.map(function (r) {
      var granted = roleGranted(r.id);
      return '<th class="perm-role" data-role="' + r.id + '"><span class="role-chip role-' + r.color + '">' + esc(r.label) + '</span><small>' + granted + ' / ' + totalPerms + '</small></th>';
    }).join('');
    headRow.innerHTML = '<th class="perm-feature">功能 / 权限</th><th class="perm-key">key</th>' + html;
  }
  function text(sel, v) { var n = $(sel); if (n) n.textContent = v; }

  function renderBody() {
    var body = $('#permBody');
    if (!body) return;
    body.innerHTML = '';
    PERMS.forEach(function (group) {
      // group header
      var tr = document.createElement('tr');
      tr.className = 'perm-group-row';
      tr.innerHTML = '<td colspan="' + (2 + ROLES.length) + '">' + esc(group.group) + ' <small>' + group.items.length + ' 项</small></td>';
      body.appendChild(tr);
      group.items.forEach(function (perm) {
        if (searchKeyword && esc(perm.label).toLowerCase().indexOf(searchKeyword) < 0 && perm.id.toLowerCase().indexOf(searchKeyword) < 0) return;
        var row = document.createElement('tr');
        row.className = 'perm-row';
        row.innerHTML = '<td><strong>' + esc(perm.label) + '</strong></td>'
          + '<td><code>' + esc(perm.id) + '</code></td>'
          + ROLES.map(function (r) {
            var checked = !!(matrix[r.id] && matrix[r.id][perm.id]);
            return '<td class="perm-cell" data-role="' + r.id + '" data-perm="' + esc(perm.id) + '"><button type="button" class="perm-check' + (checked ? ' is-on' : '') + '" aria-pressed="' + checked + '">' + (checked ? '✓' : '·') + '</button></td>';
          }).join('');
        body.appendChild(row);
      });
    });
  }

  function renderStats() {
    text('#statRoles', ROLES.length);
    text('#statPerms', PERMS.flatMap(function (g) { return g.items; }).length);
    text('#statGranted', totalGranted());
    text('#statChanges', changes.length);
  }

  function setCell(role, perm, value) {
    matrix[role] = matrix[role] || {};
    if (matrix[role][perm] === value) return;
    matrix[role][perm] = value;
    var roleLabel = (ROLES.filter(function (r) { return r.id === role; })[0] || {}).label || role;
    var permLabel = (function () { for (var i = 0; i < PERMS.length; i++) { for (var j = 0; j < PERMS[i].items.length; j++) if (PERMS[i].items[j].id === perm) return PERMS[i].items[j].label; } return perm; })();
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    changes.unshift({
      time: pad(now.getHours()) + ':' + pad(now.getMinutes()),
      role: roleLabel,
      perm: permLabel,
      value: value ? '允许' : '禁止'
    });
  }

  function renderChangeLog() {
    var log = $('#changeLog');
    if (!log) return;
    if (!changes.length) {
      log.innerHTML = '<div class="audit-empty"><span>◌</span><strong>暂无变更</strong><p>点击矩阵中的单元格即可记录到此处。</p></div>';
      return;
    }
    log.innerHTML = changes.slice(0, 30).map(function (c) {
      return '<div class="audit-item"><div class="audit-item-head"><strong>' + esc(c.role) + ' · ' + esc(c.perm) + ' → ' + esc(c.value) + '</strong><time>' + esc(c.time) + '</time></div></div>';
    }).join('');
  }

  function renderOverrides() {
    var body = $('#overrideBody');
    if (!body) return;
    var data = [
      { name: '沈知远', account: 'shenzy', role: '管理员', extra: '图谱合并、节点编辑', minus: '—', action: '查看' },
      { name: '林晚晴', account: 'linwq', role: '普通用户', extra: '岗位导出', minus: '账号停用', action: '查看' },
      { name: '顾北辰', account: 'gubc', role: '运营', extra: '—', minus: '岗位删除', action: '查看' },
      { name: '程一鸣', account: 'chengym', role: '分析师', extra: '采集触发', minus: '—', action: '查看' }
    ];
    body.innerHTML = data.map(function (u) {
      return '<tr><td><strong>' + esc(u.name) + '</strong><small>' + esc(u.account) + '</small></td>'
        + '<td><span class="tag">' + esc(u.role) + '</span></td>'
        + '<td>' + (u.extra === '—' ? '<span style="color:var(--admin-faint)">—</span>' : '<span class="tag" style="color:var(--accent-green-deep);background:var(--accent-green-soft);border-color:var(--accent-green-border)">' + esc(u.extra) + '</span>') + '</td>'
        + '<td>' + (u.minus === '—' ? '<span style="color:var(--admin-faint)">—</span>' : '<span class="tag failed">' + esc(u.minus) + '</span>') + '</td>'
        + '<td><button class="mini-btn" type="button">' + esc(u.action) + '</button></td></tr>';
    }).join('');
  }

  function bindEvents() {
    if (window.__admin403) return;
    $('#permBody').addEventListener('click', function (e) {
      var cell = e.target.closest('.perm-cell');
      if (!cell) return;
      var role = cell.getAttribute('data-role');
      var perm = cell.getAttribute('data-perm');
      var btn = cell.querySelector('.perm-check');
      var next = !btn.classList.contains('is-on');
      btn.classList.toggle('is-on', next);
      btn.setAttribute('aria-pressed', String(next));
      btn.textContent = next ? '✓' : '·';
      setCell(role, perm, next);
      renderHeader();
      renderStats();
      renderChangeLog();
    });

    $('#permSearch').addEventListener('input', function (e) {
      searchKeyword = e.target.value.trim().toLowerCase();
      renderBody();
    });
    $('#permReset').addEventListener('click', function () {
      matrix = clone(DEFAULTS);
      changes.unshift({ time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), role: '系统', perm: '全部权限', value: '已重置' });
      renderHeader(); renderBody(); renderStats(); renderChangeLog();
      toast('已恢复默认矩阵');
    });
    $('#permSave').addEventListener('click', function () {
      saveMatrix();
      try { localStorage.setItem(CHANGES_KEY, JSON.stringify(changes)); } catch (_) {}
      var n = changes.length;
      changes = [];
      renderStats();
      renderChangeLog();
      toast('已保存 ' + n + ' 项权限变更');
    });
    $('#refreshBtn').addEventListener('click', function () {
      matrix = loadMatrix();
      changes = [];
      renderAll();
      toast('矩阵已重新载入');
    });
  }

  function renderAll() {
    renderHeader();
    renderBody();
    renderOverrides();
    renderStats();
    renderChangeLog();
  }

  // 顶部身份 + 移动端导航
  function init() {
    var user = {}; try { user = JSON.parse(localStorage.getItem('zhitu_user') || '{}') || {}; } catch (_) {}
    var name = user.name || user.username;
    var role = String(user.role || '').toLowerCase();
    var isAdmin = role === 'admin';
    var set = function (sel, v) { var n = $(sel); if (n) n.textContent = v; };
    set('#userChip', name ? name + (isAdmin ? ' · ADMIN' : '') : '未登录 · READ ONLY');
    set('#operatorName', name || '演示值班员');
    set('#operatorRole', isAdmin ? 'ADMIN / OPERATOR' : 'ADMIN / OBSERVER');
    set('#lastSync', new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
    set('#sideUpdated', '同步于 ' + new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
    var sidebar = $('#adminSidebar');
    var scrim = $('#navScrim');
    function closeNav() { sidebar.classList.remove('is-open'); scrim.classList.remove('is-open'); }
    $('#openNav').addEventListener('click', function () { sidebar.classList.add('is-open'); scrim.classList.add('is-open'); });
    $('#closeNav').addEventListener('click', closeNav);
    scrim.addEventListener('click', closeNav);

    bindEvents();
    renderAll();
  }

  // toast helper (复用)
  function toast(message) {
    var host = $('#toastHost');
    if (!host) return;
    var item = document.createElement('div');
    item.className = 'toast';
    item.textContent = message;
    host.appendChild(item);
    setTimeout(function () { item.classList.add('is-leaving'); setTimeout(function () { item.remove(); }, 220); }, 2400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();