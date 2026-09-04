(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var number = function (v) { var n = Number(v); return Number.isFinite(n) ? n : 0; };
  var fmt = function (v) { return number(v).toLocaleString('zh-CN'); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var CITIES = ['北京', '上海', '杭州', '深圳', '广州', '成都', '南京', '武汉', '苏州', '西安', '厦门', '长沙'];
  var SOURCES = ['智联招聘', '前程无忧', '猎聘', 'BOSS 直聘', '拉勾网', '58 同城', '政府公共人才网'];
  var STATUS = [
    { key: 'active', label: '在线' },
    { key: 'expiring', label: '即将过期' },
    { key: 'expired', label: '已过期' }
  ];
  var TITLES = [
    '前端工程师', '高级前端工程师', 'Node 后端工程师', 'Java 后端工程师', '数据分析师',
    '数据产品经理', '算法工程师', '大模型应用工程师', 'NLP 工程师', 'UI 设计师',
    '产品经理', '用户研究员', '增长运营', '内容运营', '市场策划', '行业研究员',
    '测试开发工程师', '运维工程师', 'DevOps 工程师', 'Android 工程师', 'iOS 工程师',
    '数据架构师', '解决方案架构师', '风控算法工程师', '产品运营', '客户成功经理'
  ];
  var COMPANIES = ['星河科技', '远见数据', '云阶智能', '深言科技', '数澜咨询', '轻芽生活', '山雾创意', '恒信银行研发中心', '启程人力', '新轨迹研究院', '玖源量化', '云巢物联', '锐明智能', '瀚星云算', '北辰智算', '象限互娱', '未远智能', '扶光文创'];
  var SKILLS = ['Python', 'PyTorch', 'LangChain', 'React', 'Vue', 'TypeScript', 'Node.js', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'LLM', 'RAG', '图数据库', 'Spark', 'Flink', 'AWS', 'GCP', '产品规划', '用户访谈'];
  var SALARY_BANDS = [
    { range: '0-10', min: 6, max: 10 },
    { range: '10-20', min: 12, max: 18 },
    { range: '20-40', min: 22, max: 35 },
    { range: '40-999', min: 45, max: 80 }
  ];

  // 生成 ~840 条岗位（演示数据量放大 10 倍）
  var jobs = [];
  var now = Date.now();
  for (var i = 0; i < 840; i++) {
    var title = TITLES[i % TITLES.length];
    var company = COMPANIES[(i * 3) % COMPANIES.length];
    var city = CITIES[i % CITIES.length];
    var source = SOURCES[i % SOURCES.length];
    var band = SALARY_BANDS[(i + Math.floor(i / SALARY_BANDS.length)) % SALARY_BANDS.length];
    var base = band.min + ((i * 7) % (band.max - band.min + 1));
    var age = i % 12; // 天
    var crawlTime = new Date(now - age * 86400000 - (i % 9) * 3600000).toISOString();
    var expireDays = 30 - age - (i % 5);
    var status = expireDays < 0 ? 'expired' : expireDays < 5 ? 'expiring' : 'active';
    var pickedSkills = [];
    for (var s = 0; s < 4; s++) pickedSkills.push(SKILLS[(i * 5 + s * 3) % SKILLS.length]);
    jobs.push({
      id: 'JOB-' + String(10000 + i),
      title: title,
      company: company,
      city: city,
      source: source,
      salaryMin: base,
      salaryMax: base + 4 + (i % 3),
      salaryBand: band.range,
      skills: pickedSkills,
      description: '参与「执图破局」岗位智能平台相关业务，负责 ' + title + ' 方向的方案设计与落地，与产品和算法团队协作完成核心交付。',
      crawlTime: crawlTime,
      status: status,
      expireDays: expireDays,
      sourceUrl: 'https://example.com/jobs/' + (10000 + i),
      matches: 70 + ((i * 13) % 28)
    });
  }
  // 按采集时间倒序
  jobs.sort(function (a, b) { return new Date(b.crawlTime) - new Date(a.crawlTime); });

  // 填充筛选下拉
  function fillSelect(select, items, placeholder) {
    items.forEach(function (item) {
      var opt = document.createElement('option');
      opt.value = item;
      opt.textContent = item;
      select.appendChild(opt);
    });
  }
  fillSelect($('#filterCity'), CITIES);
  fillSelect($('#filterSource'), SOURCES);

  var state = {
    keyword: '',
    city: '',
    source: '',
    salary: '',
    status: '',
    sortKey: 'crawlTime',
    sortDir: 'desc',
    page: 1,
    perPage: 12,
    selected: Object.create(null)
  };

  function matches(job) {
    if (state.city && job.city !== state.city) return false;
    if (state.source && job.source !== state.source) return false;
    if (state.salary && job.salaryBand !== state.salary) return false;
    if (state.status && job.status !== state.status) return false;
    if (state.keyword) {
      var k = state.keyword.toLowerCase();
      var hay = [job.title, job.company, job.city, job.source].concat(job.skills).join(' ').toLowerCase();
      if (hay.indexOf(k) < 0) return false;
    }
    return true;
  }

  function sortJobs(list) {
    var dir = state.sortDir === 'asc' ? 1 : -1;
    var key = state.sortKey;
    return list.slice().sort(function (a, b) {
      var av = a[key], bv = b[key];
      if (key === 'salary') { av = a.salaryMin; bv = b.salaryMin; }
      if (key === 'crawlTime') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  function render() {
    var filtered = jobs.filter(matches);
    var sorted = sortJobs(filtered);
    var total = sorted.length;
    var totalAll = jobs.length;
    var totalPages = Math.max(1, Math.ceil(total / state.perPage));
    if (state.page > totalPages) state.page = totalPages;
    var start = (state.page - 1) * state.perPage;
    var pageRows = sorted.slice(start, start + state.perPage);

    text('#statTotal', fmt(totalAll));
    text('#statNew', fmt(28));
    text('#statExpiring', fmt(jobs.filter(function (j) { return j.status === 'expiring'; }).length));
    var selectedCount = Object.keys(state.selected).length;
    text('#statSelected', selectedCount);
    text('#statSelectedDelta', selectedCount > 0 ? '选中占 ' + Math.round(selectedCount / totalAll * 100) + '%' : '—');
    text('#resultMeta', '匹配 ' + total + ' 条 · 第 ' + state.page + ' / ' + totalPages + ' 页');

    var body = $('#jobsBody');
    if (!pageRows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="9">没有符合条件的岗位，调整筛选试试</td></tr>';
    } else {
      var statusLabel = { active: '在线', expiring: '即将过期', expired: '已过期' };
      body.innerHTML = pageRows.map(function (job) {
        var checked = state.selected[job.id] ? 'checked' : '';
        var isSelected = state.selected[job.id] ? 'is-selected' : '';
        var statusCls = job.status === 'expiring' ? 'running' : job.status === 'expired' ? 'failed' : '';
        return '<tr class="' + isSelected + '"><td class="checkbox-cell"><input type="checkbox" class="row-check" data-id="' + esc(job.id) + '" ' + checked + ' aria-label="选择 ' + esc(job.title) + '" /></td>'
          + '<td><strong>' + esc(job.title) + '</strong><small>' + esc(job.id) + ' · ' + esc(job.skills.slice(0, 2).join(' · ')) + '</small></td>'
          + '<td>' + esc(job.company) + '</td>'
          + '<td>' + esc(job.city) + '</td>'
          + '<td><code>' + job.salaryMin + '-' + job.salaryMax + 'K</code></td>'
          + '<td>' + esc(job.source) + '</td>'
          + '<td><code>' + fmtDate(job.crawlTime) + '</code></td>'
          + '<td><span class="tag ' + statusCls + '">' + statusLabel[job.status] + '</span></td>'
          + '<td><button class="mini-btn" type="button" data-view="' + esc(job.id) + '">查看</button></td></tr>';
      }).join('');
    }

    // 分页
    var pageInfo = $('#pageInfo');
    pageInfo.textContent = total === 0 ? '无数据' : (start + 1) + ' - ' + Math.min(start + state.perPage, total) + ' / ' + total + ' 条';
    var pageButtons = $('#pageButtons');
    var buttons = '';
    buttons += '<button class="page-btn" data-page="prev" ' + (state.page === 1 ? 'disabled' : '') + '>‹</button>';
    var maxButtons = 7;
    var startPage = Math.max(1, Math.min(state.page - 3, totalPages - maxButtons + 1));
    var endPage = Math.min(totalPages, startPage + maxButtons - 1);
    for (var p = startPage; p <= endPage; p++) {
      buttons += '<button class="page-btn ' + (p === state.page ? 'is-active' : '') + '" data-page="' + p + '">' + p + '</button>';
    }
    buttons += '<button class="page-btn" data-page="next" ' + (state.page === totalPages ? 'disabled' : '') + '>›</button>';
    pageButtons.innerHTML = buttons;

    $$('th.sortable').forEach(function (th) {
      th.classList.remove('is-asc', 'is-desc');
      if (th.getAttribute('data-sort') === state.sortKey) {
        th.classList.add(state.sortDir === 'asc' ? 'is-asc' : 'is-desc');
      }
    });

    updateBulkBar();
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function text(sel, value) { var n = $(sel); if (n) n.textContent = value; }

  function updateBulkBar() {
    var n = Object.keys(state.selected).length;
    var bar = $('#bulkBar');
    $('#bulkCount').textContent = n;
    bar.classList.toggle('is-visible', n > 0);
    var selectAll = $('#selectAll');
    if (selectAll) {
      var visibleIds = $$('.row-check').map(function (c) { return c.getAttribute('data-id'); });
      var allSelected = visibleIds.length > 0 && visibleIds.every(function (id) { return state.selected[id]; });
      selectAll.checked = allSelected;
      selectAll.indeterminate = !allSelected && visibleIds.some(function (id) { return state.selected[id]; });
    }
  }

  // —— 抽屉详情 ——
  function openDrawer(id) {
    var job = jobs.filter(function (j) { return j.id === id; })[0];
    if (!job) return;
    var statusLabel = { active: '在线', expiring: '即将过期', expired: '已过期' }[job.status];
    var evidence = [
      { url: job.sourceUrl, snippet: '原文摘要：' + job.title + ' · ' + job.skills.slice(0, 3).join(' / ') + ' · 薪资 ' + job.salaryMin + '-' + job.salaryMax + 'K' },
      { url: job.sourceUrl + '?v=2', snippet: '来源回执：采集时间 ' + fmtDate(job.crawlTime) + ' · 字段完整性 ' + (85 + (id.charCodeAt(5) % 14)) + '%' },
      { url: job.sourceUrl + '?v=3', snippet: '企业档案：' + job.company + ' · 注册地 ' + job.city + ' · 已收录 14 份岗位' }
    ];
    $('#jobDrawer').innerHTML =
      '<div class="drawer-head"><div><span class="eyebrow">' + esc(job.id) + ' · ' + esc(job.source) + '</span><h3>' + esc(job.title) + '</h3><small>' + esc(job.company) + ' · ' + esc(job.city) + '</small></div><button class="drawer-close" id="drawerClose" aria-label="关闭">×</button></div>'
      + '<div class="drawer-section"><h4>核心信息</h4><dl class="drawer-kv"><dt>薪资</dt><dd><code>' + job.salaryMin + ' - ' + job.salaryMax + 'K · ' + job.salaryBand + '</code></dd><dt>状态</dt><dd><span class="tag">' + statusLabel + '</span></dd><dt>采集时间</dt><dd>' + fmtDate(job.crawlTime) + '</dd><dt>剩余天数</dt><dd>' + job.expireDays + ' 天</dd><dt>匹配度</dt><dd><code>' + job.matches + '%</code></dd></dl></div>'
      + '<div class="drawer-section"><h4>岗位描述</h4><p style="margin:0;color:var(--admin-muted);font-size:13px;line-height:1.7">' + esc(job.description) + '</p></div>'
      + '<div class="drawer-section"><h4>技能要求</h4><div class="drawer-tags">' + job.skills.map(function (s) { return '<span class="tag">' + esc(s) + '</span>'; }).join('') + '</div></div>'
      + '<div class="drawer-section"><h4>证据链</h4><div class="drawer-list">' + evidence.map(function (e) { return '<div class="drawer-evidence"><a href="' + esc(e.url) + '" target="_blank" rel="noopener">' + esc(e.url) + '</a><br>' + esc(e.snippet) + '</div>'; }).join('') + '</div></div>'
      + '<div class="drawer-section" style="display:flex;gap:8px"><button class="ghost-btn" type="button" data-action="recrawl">⟳ 重新采集</button><button class="ghost-btn" type="button" data-action="archive">▣ 归档</button><button class="outline-btn is-danger" type="button" data-action="delete" style="margin-left:auto;color:var(--accent-red);border-color:var(--accent-red-border);background:rgba(200,71,56,.08)">× 删除</button></div>';
    $('#jobDrawer').classList.add('is-open');
    $('#jobDrawer').setAttribute('aria-hidden', 'false');
    $('#drawerScrim').classList.add('is-open');
    document.body.style.overflow = 'hidden';
    $('#drawerClose').addEventListener('click', closeDrawer);
    $('#jobDrawer').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'recrawl') { toast('已为「' + job.title + '」提交重新采集任务'); }
      if (action === 'archive') { toast('岗位已归档'); }
      if (action === 'delete') {
        jobs = jobs.filter(function (j) { return j.id !== job.id; });
        delete state.selected[job.id];
        toast('岗位已删除（前端演示）', 'w');
        render();
        closeDrawer();
      }
    });
  }
  function closeDrawer() {
    $('#jobDrawer').classList.remove('is-open');
    $('#jobDrawer').setAttribute('aria-hidden', 'true');
    $('#drawerScrim').classList.remove('is-open');
    document.body.style.overflow = '';
  }
  $('#drawerScrim').addEventListener('click', closeDrawer);

  // —— Toast ——
  function toast(message, tone) {
    var host = $('#toastHost');
    if (!host) return;
    var item = document.createElement('div');
    item.className = 'toast' + (tone ? ' is-' + tone : '');
    item.textContent = message;
    host.appendChild(item);
    setTimeout(function () { item.classList.add('is-leaving'); setTimeout(function () { item.remove(); }, 220); }, 2400);
  }

  function bindEvents() {
    if (window.__admin403) return;
    var timer;
    function scheduleRender() {
      clearTimeout(timer);
      timer = setTimeout(function () { state.page = 1; render(); }, 120);
    }
    $('#filterKeyword').addEventListener('input', function (e) { state.keyword = e.target.value.trim(); scheduleRender(); });
    ['#filterCity', '#filterSource', '#filterSalary', '#filterStatus'].forEach(function (sel) {
      $(sel).addEventListener('change', function (e) {
        var key = sel.replace('#filter', '').toLowerCase();
        state[key] = e.target.value;
        state.page = 1;
        render();
      });
    });
    $('#filterReset').addEventListener('click', function () {
      state.keyword = ''; state.city = ''; state.source = ''; state.salary = ''; state.status = ''; state.page = 1;
      $('#filterKeyword').value = '';
      $('#filterCity').value = ''; $('#filterSource').value = ''; $('#filterSalary').value = ''; $('#filterStatus').value = '';
      render();
    });

    $$('th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-sort');
        if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        else { state.sortKey = key; state.sortDir = 'asc'; }
        render();
      });
    });

    $('#jobsBody').addEventListener('click', function (e) {
      var view = e.target.closest('[data-view]');
      if (view) { openDrawer(view.getAttribute('data-view')); return; }
      var check = e.target.closest('.row-check');
      if (check) {
        var id = check.getAttribute('data-id');
        if (check.checked) state.selected[id] = true; else delete state.selected[id];
        updateBulkBar();
        var row = check.closest('tr');
        if (row) row.classList.toggle('is-selected', check.checked);
      }
    });
    $('#selectAll').addEventListener('change', function (e) {
      $$('.row-check').forEach(function (c) {
        c.checked = e.target.checked;
        var id = c.getAttribute('data-id');
        if (e.target.checked) state.selected[id] = true; else delete state.selected[id];
        var row = c.closest('tr');
        if (row) row.classList.toggle('is-selected', e.target.checked);
      });
      updateBulkBar();
    });
    $('#pageButtons').addEventListener('click', function (e) {
      var btn = e.target.closest('.page-btn');
      if (!btn || btn.disabled) return;
      var p = btn.getAttribute('data-page');
      var totalPages = Math.max(1, Math.ceil(jobs.filter(matches).length / state.perPage));
      if (p === 'prev') state.page = Math.max(1, state.page - 1);
      else if (p === 'next') state.page = Math.min(totalPages, state.page + 1);
      else state.page = number(p);
      render();
    });

    $('#bulkBar').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-bulk]');
      if (!btn) return;
      var action = btn.getAttribute('data-bulk');
      var n = Object.keys(state.selected).length;
      var messages = { recrawl: '已为 ' + n + ' 个岗位提交重新采集', archive: n + ' 个岗位已归档', export: '已导出 ' + n + ' 个岗位为 CSV（前端下载）' };
      toast(messages[action] || '操作完成');
      if (action === 'export') {
        var rows = [['岗位', '企业', '城市', '薪资', '来源', '采集时间']].concat(jobs.filter(function (j) { return state.selected[j.id]; }).map(function (j) {
          return [j.title, j.company, j.city, j.salaryMin + '-' + j.salaryMax + 'K', j.source, fmtDate(j.crawlTime)];
        }));
        var csv = '\uFEFF' + rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'jobs-' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 1500);
      }
      if (action === 'archive') {
        var archived = Object.keys(state.selected);
        archived.forEach(function (id) { delete state.selected[id]; });
        updateBulkBar();
      }
    });
    $('#bulkClear').addEventListener('click', function () {
      state.selected = Object.create(null);
      $$('.row-check').forEach(function (c) { c.checked = false; var row = c.closest('tr'); if (row) row.classList.remove('is-selected'); });
      updateBulkBar();
    });

    $('#refreshBtn').addEventListener('click', function () { toast('已重新同步岗位池数据'); render(); });

    // 移动端导航
    var sidebar = $('#adminSidebar');
    var scrim = $('#navScrim');
    function closeNav() { sidebar.classList.remove('is-open'); scrim.classList.remove('is-open'); }
    $('#openNav').addEventListener('click', function () { sidebar.classList.add('is-open'); scrim.classList.add('is-open'); });
    $('#closeNav').addEventListener('click', closeNav);
    scrim.addEventListener('click', closeNav);
  }

  // 顶部身份
  function renderIdentity() {
    var user = {};
    try { user = JSON.parse(localStorage.getItem('zhitu_user') || '{}') || {}; } catch (_) {}
    var name = user.name || user.displayName || user.username;
    var role = String(user.role || '').toLowerCase();
    var admin = role === 'admin';
    $('#userChip').textContent = name ? name + (admin ? ' · ADMIN' : '') : '未登录 · READ ONLY';
    $('#operatorName').textContent = name || '演示值班员';
    $('#operatorRole').textContent = admin ? 'ADMIN / OPERATOR' : 'ADMIN / OBSERVER';
    $('#lastSync').textContent = fmtDate(new Date().toISOString());
    $('#sideUpdated').textContent = '同步于 ' + fmtDate(new Date().toISOString());
  }

  function init() {
    renderIdentity();
    bindEvents();
    render();
  }
  window.refreshData = function () { render(); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();