(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var USERS_KEY = 'zhitu_internal_users_v1';
  var AUDIT_KEY = 'zhitu_audit_v1';

  // 内部角色只有三种：管理员 / 运营 / 分析师
  var ROLES = [
    { id: 'admin', label: '管理员' },
    { id: 'operator', label: '运营' },
    { id: 'analyst', label: '分析师' }
  ];

  var SEED_USERS = [
    { name: '沈知远', account: 'shenzy', role: 'admin', status: 'active', city: '杭州', password: 'admin123', lastActive: '2026-09-04 01:29' },
    { name: '林晚晴', account: 'linwq', role: 'operator', status: 'active', city: '上海', password: 'operator123', lastActive: '2026-09-03 22:08' },
    { name: '顾北辰', account: 'gubc', role: 'analyst', status: 'active', city: '北京', password: 'analyst123', lastActive: '2026-09-03 20:36' },
    { name: '程一鸣', account: 'chengym', role: 'analyst', status: 'disabled', city: '广州', password: 'chengym123', lastActive: '2026-09-02 18:54' }
  ];
  var SEED_AUDIT = [
    { type: '采集', title: '猎聘 · 增量采集任务启动', detail: '调度器触发今日增量抓取，预计处理 320 条岗位。', time: '2026-09-03 23:20' },
    { type: '系统', title: '健康探针巡检通过', detail: 'API / 数据底座 / 采集服务全部在线。', time: '2026-09-03 23:00' },
    { type: '账号', title: '用户「程一鸣」被停用', detail: '操作人：沈知远 · 原因：长期未活跃。', time: '2026-09-03 21:47' },
    { type: '采集', title: '企业招聘官网任务异常', detail: '来源规则匹配失败，已进入人工检查队列。', time: '2026-09-03 06:40', tone: 'is-error' },
    { type: '评测', title: '检索质量抽检完成', detail: 'Precision@5 抽样 50 组，平均 0.86。', time: '2026-09-02 19:12' },
    { type: '账号', title: '管理员「沈知远」登录', detail: 'IP 172.16.8.* · 会话通过服务端验证。', time: '2026-09-02 09:03' },
    { type: '系统', title: '知识库增量索引完成', detail: '新增文档 18 篇，向量化 18 / 18。', time: '2026-09-01 22:31' }
  ];

  function loadUsers() {
    try {
      var raw = JSON.parse(localStorage.getItem(USERS_KEY) || 'null');
      if (Array.isArray(raw) && raw.length) return raw;
    } catch (_) {}
    saveUsers(SEED_USERS.slice());
    return SEED_USERS.slice();
  }
  function saveUsers(list) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(list)); } catch (_) {}
  }
  var users = loadUsers();

  function loadAudit() {
    try {
      var raw = JSON.parse(localStorage.getItem(AUDIT_KEY) || 'null');
      if (Array.isArray(raw)) return raw;
    } catch (_) {}
    saveAudit(SEED_AUDIT.slice());
    return SEED_AUDIT.slice();
  }
  function saveAudit(list) {
    try { localStorage.setItem(AUDIT_KEY, JSON.stringify(list.slice(0, 200))); } catch (_) {}
  }
  var auditEntries = loadAudit();

  // 全局审计写入（供其他页面快捷操作调用）
  window.appendAudit = function (type, title, detail) {
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    auditEntries.unshift({
      type: type,
      title: title,
      detail: detail || '',
      time: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes())
    });
    saveAudit(auditEntries);
    renderAudit();
  };

  function fmtNow() {
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
  }
  function text(sel, v) { var n = $(sel); if (n) n.textContent = v; }

  // —— 用户表 ——
  var searchKeyword = '';
  var roleFilter = 'all';

  function renderUsers() {
    var body = $('#usersBody');
    if (!body) return;
    var rows = users.filter(function (u) {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!searchKeyword) return true;
      return (u.name + ' ' + u.account + ' ' + (u.city || '')).toLowerCase().indexOf(searchKeyword) >= 0;
    });
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="5" class="table-empty">没有符合条件的内部用户</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (u) {
      var enabled = u.status === 'active';
      var roleLabel = (ROLES.filter(function (r) { return r.id === u.role; })[0] || {}).label || u.role;
      var options = ROLES.map(function (r) {
        return '<option value="' + r.id + '"' + (r.id === u.role ? ' selected' : '') + '>' + r.label + '</option>';
      }).join('');
      var isSelf = (window.adminShell && window.adminShell.currentUser && window.adminShell.currentUser()) ?
        window.adminShell.currentUser().username === u.account : false;
      return '<tr><td><strong>' + esc(u.name) + '</strong><small>' + esc(u.account) + ' · ' + esc(u.city || '—') + '</small></td>'
        + '<td><select class="role-select" data-role-account="' + esc(u.account) + '"' + (isSelf ? ' disabled title="不能修改自己的角色"' : '') + '>' + options + '</select></td>'
        + '<td><span class="tag ' + (enabled ? '' : 'failed') + '">' + (enabled ? '正常' : '已停用') + '</span></td>'
        + '<td><code>' + esc(u.lastActive || '—') + '</code></td>'
        + '<td><div class="table-tools" style="gap:6px"><button class="mini-btn" type="button" data-user-action="reset" data-account="' + esc(u.account) + '">重置密码</button>'
        + '<button class="mini-btn ' + (enabled ? 'is-danger' : '') + '" type="button" data-user-action="toggle" data-account="' + esc(u.account) + '"' + (isSelf ? ' disabled title="不能停用自己"' : '') + '>' + (enabled ? '停用' : '启用') + '</button>'
        + '<button class="mini-btn is-danger" type="button" data-user-action="delete" data-account="' + esc(u.account) + '"' + (isSelf ? ' disabled title="不能删除自己"' : '') + '>删除</button></div></td></tr>';
    }).join('');
    text('#usersCount', users.length + ' 人');
  }

  function renderRoleFilter() {
    var sel = $('#userRoleFilter');
    if (!sel) return;
    sel.innerHTML = '<option value="all">全部角色</option>' + ROLES.map(function (r) {
      return '<option value="' + r.id + '"' + (roleFilter === r.id ? ' selected' : '') + '>' + r.label + '</option>';
    }).join('');
    sel.value = roleFilter;
  }

  function toast(message, tone) {
    var host = $('#toastHost');
    if (!host) return;
    var item = document.createElement('div');
    item.className = 'toast' + (tone ? ' is-' + tone : '');
    item.textContent = message;
    host.appendChild(item);
    setTimeout(function () { item.classList.add('is-leaving'); setTimeout(function () { item.remove(); }, 220); }, 2400);
  }

  function handleUserAction(action, account) {
    var user = users.filter(function (u) { return u.account === account; })[0];
    if (!user) return;
    if (action === 'reset') {
      user.password = '123456';
      saveUsers(users);
      toast('已重置「' + user.name + '」密码为 123456');
      window.appendAudit('账号', '重置密码', '操作对象：' + user.name + '（' + user.account + '）');
    } else if (action === 'toggle') {
      user.status = user.status === 'active' ? 'disabled' : 'active';
      saveUsers(users);
      var enabled = user.status === 'active';
      toast('用户「' + user.name + '」已' + (enabled ? '启用' : '停用'), enabled ? '' : 'warn');
      window.appendAudit('账号', '用户「' + user.name + '」被' + (enabled ? '启用' : '停用'), '操作人：当前会话');
    } else if (action === 'delete') {
      users = users.filter(function (u) { return u.account !== account; });
      saveUsers(users);
      toast('用户「' + user.name + '」已删除', 'warn');
      window.appendAudit('账号', '删除内部用户「' + user.name + '」', '账号 ' + user.account + ' · 操作人：当前会话');
    }
    renderUsers();
  }

  // —— 审计 ——
  var auditFilterType = 'all';
  function renderAudit() {
    var list = $('#auditList');
    if (!list) return;
    var rows = auditEntries.filter(function (e) { return auditFilterType === 'all' || e.type === auditFilterType; });
    text('#auditCount', rows.length + ' 条记录');
    if (!rows.length) {
      list.innerHTML = '<div class="audit-empty"><span>◌</span><strong>暂无该类型的审计记录</strong><p>切换回「全部类型」查看完整时间线。</p></div>';
      return;
    }
    list.innerHTML = rows.map(function (e) {
      return '<div class="audit-item ' + (e.tone || '') + '"><div class="audit-item-head"><strong>' + esc(e.title) + '</strong><time>' + esc(e.time) + '</time></div>' + (e.detail ? '<p>' + esc(e.detail) + '</p>' : '') + '<span class="audit-chip">' + esc(e.type) + '</span></div>';
    }).join('');
  }

  function exportAuditCsv() {
    var rows = [['时间', '类型', '标题', '详情']].concat(auditEntries.map(function (e) {
      return [e.time, e.type, e.title, e.detail];
    }));
    var csv = '\uFEFF' + rows.map(function (row) {
      return row.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'audit-trail-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1500);
    window.appendAudit('系统', '导出审计记录', '当前会话导出 ' + auditEntries.length + ' 条审计记录为 CSV。');
    toast('审计记录已导出为 CSV');
  }

  // —— 添加内部用户 ——
  function addUser(name, account, role, city) {
    if (users.filter(function (u) { return u.account === account; }).length) {
      toast('账号 ' + account + ' 已存在', 'warn');
      return false;
    }
    users.unshift({
      name: name, account: account, role: role, status: 'active',
      city: city || '—', password: '123456', lastActive: '从未登录'
    });
    saveUsers(users);
    renderUsers();
    window.appendAudit('账号', '新增内部用户「' + name + '」', '账号 ' + account + ' · 角色 ' + (ROLES.filter(function (r) { return r.id === role; })[0] || {}).label);
    toast('已添加 ' + name + ' · 初始密码 123456');
    return true;
  }

  function bindEvents() {
    var search = $('#userSearch');
    var roleSel = $('#userRoleFilter');
    var body = $('#usersBody');
    if (search) search.addEventListener('input', function (e) { searchKeyword = e.target.value.trim().toLowerCase(); renderUsers(); });
    if (roleSel) {
      renderRoleFilter();
      roleSel.addEventListener('change', function (e) { roleFilter = e.target.value; renderUsers(); });
    }
    if (body) body.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-user-action]') : null;
      if (!btn || btn.disabled) return;
      handleUserAction(btn.getAttribute('data-user-action'), btn.getAttribute('data-account'));
    });
    if (body) body.addEventListener('change', function (e) {
      var sel = e.target.closest ? e.target.closest('.role-select') : null;
      if (!sel || sel.disabled) return;
      var account = sel.getAttribute('data-role-account');
      var u = users.filter(function (x) { return x.account === account; })[0];
      if (!u) return;
      var newRole = sel.value;
      var oldLabel = (ROLES.filter(function (r) { return r.id === u.role; })[0] || {}).label;
      var newLabel = (ROLES.filter(function (r) { return r.id === newRole; })[0] || {}).label;
      u.role = newRole;
      saveUsers(users);
      toast('「' + u.name + '」角色已从 ' + oldLabel + ' 改为 ' + newLabel);
      window.appendAudit('账号', '调整角色', u.name + '（' + u.account + '）：' + oldLabel + ' → ' + newLabel);
      // 权限矩阵里该账号身份变化 → 刷新导航显隐
      if (window.adminShell && window.adminShell.applyNavPerms) window.adminShell.applyNavPerms();
    });

    // 添加用户表单
    var form = $('#addUserForm');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#newUserName').value.trim();
      var account = $('#newUserAccount').value.trim();
      var role = $('#newUserRole').value;
      var city = $('#newUserCity').value.trim();
      if (!name || !account) { toast('姓名和账号不能为空', 'warn'); return; }
      if (addUser(name, account, role, city)) {
        form.reset();
      }
    });

    var auditFilterEl = $('#auditFilter');
    if (auditFilterEl) auditFilterEl.addEventListener('change', function (e) { auditFilterType = e.target.value; renderAudit(); });
    var exportBtn = $('#auditExport');
    if (exportBtn) exportBtn.addEventListener('click', exportAuditCsv);

    // 顶部身份
    var user = {}; try { user = JSON.parse(localStorage.getItem('zhitu_user') || '{}') || {}; } catch (_) {}
    var name = user.name || user.username;
    var role = String(user.role || '').toLowerCase();
    var isAdmin = role === 'admin';
    text('#userChip', name ? name + (isAdmin ? ' · ADMIN' : '') : '未登录 · READ ONLY');
    text('#operatorName', name || '演示值班员');
    text('#operatorRole', isAdmin ? 'ADMIN / OPERATOR' : 'ADMIN / OBSERVER');
    text('#lastSync', fmtNow());
    text('#sideUpdated', '同步于 ' + fmtNow());

    // 移动端导航
    var sidebar = $('#adminSidebar');
    var scrim = $('#navScrim');
    function closeNav() { sidebar.classList.remove('is-open'); scrim.classList.remove('is-open'); }
    var open = $('#openNav'); var close = $('#closeNav');
    if (open) open.addEventListener('click', function () { sidebar.classList.add('is-open'); scrim.classList.add('is-open'); });
    if (close) close.addEventListener('click', closeNav);
    if (scrim) scrim.addEventListener('click', closeNav);
  }

  function init() {
    renderUsers();
    renderAudit();
    bindEvents();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();