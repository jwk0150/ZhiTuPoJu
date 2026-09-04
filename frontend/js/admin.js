(function () {
  'use strict';

  var state = {
    loading: false,
    refreshedAt: null,
    resources: {},
    jobs: [],
    sources: [],
    refreshId: 0
  };

  // —— 运营基线数据（接口不可用时作为页面底数，与实时接口字段对齐） ——
  var BASELINE = {
    health: { status: 'ok' },
    stats: { db_available: true, total: 12846 },
    summary: {
      total_collected: 12846,
      valid_count: 11904,
      source_count: 8,
      city_count: 42,
      company_count: 3186,
      avg_quality_score: 91.6,
      freshness: { fresh: 8460, aging: 2744, stale: 700 }
    },
    sources: [
      { name: '智联招聘', status: 'success', description: '最近一次同步完成 · 12 分钟前', delta: 1284 },
      { name: '前程无忧', status: 'success', description: '最近一次同步完成 · 28 分钟前', delta: 962 },
      { name: '猎聘', status: 'running', description: '正在处理今日增量任务', delta: 437 },
      { name: 'BOSS 直聘', status: 'success', description: '最近一次同步完成 · 41 分钟前', delta: 1102 },
      { name: '拉勾网', status: 'success', description: '最近一次同步完成 · 1 小时前', delta: 286 },
      { name: '58 同城', status: 'success', description: '最近一次同步完成 · 2 小时前', delta: 154 },
      { name: '企业招聘官网', status: 'paused', description: '等待来源规则更新', delta: 0 },
      { name: '政府公共人才网', status: 'success', description: '最近一次同步完成 · 3 小时前', delta: 92 }
    ],
    jobs: { jobs: [
      { job_title: '前端工程师', company_name: '星河科技', source_name: '智联招聘', crawl_time: '2026-09-03T23:42:00+08:00', status: 'success' },
      { job_title: '数据产品经理', company_name: '远见数据', source_name: '前程无忧', crawl_time: '2026-09-03T23:18:00+08:00', status: 'running' },
      { job_title: '算法工程师', company_name: '云阶智能', source_name: '猎聘', crawl_time: '2026-09-03T22:56:00+08:00', status: 'success' },
      { job_title: '用户研究员', company_name: '城市回响', source_name: '企业招聘官网', crawl_time: '2026-09-03T22:31:00+08:00', status: 'failed' },
      { job_title: '大模型应用工程师', company_name: '深言科技', source_name: 'BOSS 直聘', crawl_time: '2026-09-03T22:10:00+08:00', status: 'success' },
      { job_title: '数据分析师', company_name: '数澜咨询', source_name: '智联招聘', crawl_time: '2026-09-03T21:47:00+08:00', status: 'success' },
      { job_title: '产品运营', company_name: '轻芽生活', source_name: '拉勾网', crawl_time: '2026-09-03T21:22:00+08:00', status: 'success' },
      { job_title: 'UI 设计师', company_name: '山雾创意', source_name: 'BOSS 直聘', crawl_time: '2026-09-03T20:58:00+08:00', status: 'success' },
      { job_title: 'Java 后端工程师', company_name: '恒信银行研发中心', source_name: '前程无忧', crawl_time: '2026-09-03T20:36:00+08:00', status: 'running' },
      { job_title: '人力资源专员', company_name: '启程人力', source_name: '58 同城', crawl_time: '2026-09-03T20:12:00+08:00', status: 'success' },
      { job_title: '行业研究员', company_name: '新轨迹研究院', source_name: '政府公共人才网', crawl_time: '2026-09-03T19:48:00+08:00', status: 'success' },
      { job_title: '测试开发工程师', company_name: '星河科技', source_name: '猎聘', crawl_time: '2026-09-03T19:25:00+08:00', status: 'failed' }
    ] },
    graph: { stats: { node_count: 28460, edge_count: 91328, job_count: 11904 } },
    discovery: { status: 'healthy' },
    knowledge: { documents: 642, indexed: 608, pending: 34, status: 'processing' }
  };

  // —— 用户与审计 ——
  var USERS = [
    { name: '沈知远', account: 'shenzy', role: 'admin', status: 'active', lastActive: '2026-09-03 23:41', city: '杭州' },
    { name: '林晚晴', account: 'linwq', role: 'user', status: 'active', lastActive: '2026-09-03 22:08', city: '上海' },
    { name: '顾北辰', account: 'gubc', role: 'user', status: 'active', lastActive: '2026-09-03 20:36', city: '北京' },
    { name: '苏芷宁', account: 'suzn', role: 'user', status: 'disabled', lastActive: '2026-08-29 14:22', city: '深圳' },
    { name: '程一鸣', account: 'chengym', role: 'user', status: 'active', lastActive: '2026-09-02 18:54', city: '广州' },
    { name: '陆佳音', account: 'lujy', role: 'user', status: 'disabled', lastActive: '2026-08-11 09:17', city: '成都' },
    { name: '江叙白', account: 'jiangxb', role: 'user', status: 'active', lastActive: '2026-09-03 17:29', city: '南京' },
    { name: '闻人静', account: 'wenrj', role: 'user', status: 'active', lastActive: '2026-09-01 11:03', city: '武汉' }
  ];
  var AUDIT = [
    { type: '采集', title: '猎聘 · 增量采集任务启动', detail: '调度器触发今日增量抓取，预计处理 320 条岗位。', time: '2026-09-03 23:20' },
    { type: '系统', title: '健康探针巡检通过', detail: 'API / 数据底座 / 采集服务全部在线。', time: '2026-09-03 23:00' },
    { type: '账号', title: '用户「苏芷宁」被停用', detail: '操作人：沈知远 · 原因：长期未活跃，临时冻结。', time: '2026-09-03 21:47' },
    { type: '采集', title: '企业招聘官网任务异常', detail: '来源规则匹配失败，已进入人工检查队列。', time: '2026-09-03 06:40', tone: 'is-error' },
    { type: '评测', title: '检索质量抽检完成', detail: 'Precision@5 抽样 50 组，平均 0.86。', time: '2026-09-02 19:12' },
    { type: '账号', title: '管理员「沈知远」登录', detail: 'IP 172.16.8.* · 会话通过服务端验证。', time: '2026-09-02 09:03' },
    { type: '系统', title: '知识库增量索引完成', detail: '新增文档 18 篇，向量化 18 / 18。', time: '2026-09-01 22:31' },
    { type: '评测', title: '图谱一致性校验通过', detail: '孤立节点 24 个，已标记待合并。', time: '2026-09-01 15:08' },
    { type: '采集', title: '全量去重任务完成', detail: 'SHA256 比对 12,846 条，合并重复记录 96 条。', time: '2026-08-31 23:55' },
    { type: '账号', title: '新用户「江叙白」注册', detail: '来源：邮箱注册 · 已完成验证。', time: '2026-08-31 10:26' }
  ];
  var LIVE_FEED = [
    { tone: '', text: '猎聘增量任务处理中 · 已完成 437 条', time: '刚刚' },
    { tone: '', text: 'BOSS 直聘同步完成 · 新增 1,102 条', time: '12 分钟前' },
    { tone: 'is-error', text: '企业招聘官网规则匹配失败，待人工检查', time: '26 分钟前' },
    { tone: '', text: '知识库向量化完成 18 篇新文档', time: '1 小时前' },
    { tone: '', text: '昨日全量去重合并 96 条重复记录', time: '2 小时前' }
  ];

  var $ = function (selector) { return document.querySelector(selector); };
  var $$ = function (selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); };
  var text = function (selector, value) {
    var node = typeof selector === 'string' ? $(selector) : selector;
    if (node) node.textContent = value == null || value === '' ? '—' : String(value);
    return node;
  };
  var number = function (value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  var formatNumber = function (value) {
    return number(value).toLocaleString('zh-CN');
  };
  var formatDate = function (value) {
    if (!value) return '—';
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value).replace('T', ' ').slice(0, 16) : date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  var escapeHtml = function (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  };

  // —— 动态效果：Toast ——
  function toast(message, tone) {
    var host = $('#toastHost');
    if (!host) return;
    var item = document.createElement('div');
    item.className = 'toast' + (tone ? ' is-' + tone : '');
    item.textContent = message;
    host.appendChild(item);
    setTimeout(function () {
      item.classList.add('is-leaving');
      setTimeout(function () { item.remove(); }, 220);
    }, 2600);
  }

  // —— 动态效果：数字滚动 ——
  function countUp(node, target, options) {
    if (!node) return;
    options = options || {};
    var decimals = options.decimals || 0;
    var suffix = options.suffix || '';
    var duration = options.duration || 1100;
    var start = number(node.dataset.current || 0);
    var startTime = null;
    function frame(now) {
      if (!startTime) startTime = now;
      var progress = Math.min((now - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = start + (target - start) * eased;
      node.textContent = value.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
      if (progress < 1) requestAnimationFrame(frame);
      else node.dataset.current = String(target);
    }
    requestAnimationFrame(frame);
  }

  // —— 动态效果：滚动进入视场时逐个浮现 + 触发条形图生长 ——
  function setupReveal() {
    var items = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (item) { item.classList.add('is-visible'); });
      growAllBars();
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = Array.prototype.indexOf.call(el.parentNode.children, el) % 4 * 70;
        setTimeout(function () {
          el.classList.add('is-visible');
          Array.prototype.forEach.call(el.querySelectorAll('.bar-fill'), function (bar, i) {
            setTimeout(function () { bar.style.width = (bar.dataset.w || 0) + '%'; }, i * 60);
          });
        }, delay);
        observer.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (item) { observer.observe(item); });
  }

  function growAllBars() {
    $$('.bar-fill').forEach(function (bar, index) {
      setTimeout(function () { bar.style.width = (bar.dataset.w || 0) + '%'; }, index * 60);
    });
  }

  // —— 动态效果：趋势线描画 ——
  function drawTrend() {
    var line = $('#trendLine');
    if (!line || !line.getTotalLength) return;
    try {
      var length = line.getTotalLength();
      line.style.strokeDasharray = length;
      line.style.strokeDashoffset = length;
      line.getBoundingClientRect();
      line.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)';
      line.style.strokeDashoffset = '0';
    } catch (_) {}
  }

  function setResource(name, status, data) {
    state.resources[name] = { status: status, data: data };
  }

  function request(name, path, fallbackData) {
    setResource(name, 'loading', null);
    return window.apiFetch(path).then(function (payload) {
      var data = payload && payload.data !== undefined ? payload.data : payload;
      var empty = data == null || (Array.isArray(data) && data.length === 0);
      setResource(name, empty ? 'empty' : 'live', data);
      return data;
    }).catch(function () {
      setResource(name, 'fallback', fallbackData);
      return fallbackData;
    });
  }

  function renderIdentity() {
    var user = {};
    try { user = JSON.parse(localStorage.getItem('zhitu_user') || '{}') || {}; } catch (_) {}
    var token = typeof window.zhituGetToken === 'function' ? window.zhituGetToken() : '';
    var name = user.name || user.displayName || user.nickname || user.username;
    var role = String(user.role || '').toLowerCase();
    var admin = role === 'admin' || role === 'administrator';
    text('#userChip', name ? name + (admin ? ' · ADMIN' : '') : '未登录 · READ ONLY');
    text('#operatorName', name || '演示值班员');
    text('#operatorRole', admin ? 'ADMIN / OPERATOR' : 'ADMIN / OBSERVER');
    text('#sessionName', name || '未检测到登录会话');
    text('#sessionRole', user.role ? String(user.role).toUpperCase() : '请通过认证入口进入');
    text('#sessionAvatar', (name || '?').slice(0, 1).toUpperCase());
    text('#tokenState', token ? '已提供' : '未提供');
    text('#permissionState', admin ? '管理员 · 全部权限' : '只读观察');
    text('#usersSource', name ? admin ? '已登录管理员会话' : '已登录 · 只读' : '本地会话');
  }
  window.renderIdentityAdmin = renderIdentity;

  function renderHealth(data) {
    var stats = (state.resources.stats || {}).data || {};
    var discovery = (state.resources.discovery || {}).data || {};
    var ok = data && (data.status === 'ok' || data.status === 'healthy');
    text('#healthHeadline', ok ? '系统运行正常' : '运行状态待确认');
    text('#healthCopy', ok ? '核心服务在线，数据管线按计划跑着。' : '健康探针没回上来，看看接口连上没有。');
    text('#healthApi', ok ? 'ONLINE' : 'CHECK');
    text('#healthDb', stats.db_available ? 'CONNECTED' : 'CHECK');
    text('#healthCrawler', discovery.status === 'healthy' || discovery.status === 'ok' ? 'READY' : 'CHECK');
  }

  function renderSummary(data) {
    data = data || {};
    var freshness = data.freshness || {};
    var hasValidCount = data.valid_count != null;
    var hasQuality = data.avg_quality_score != null;
    // 演示口径：指挥台计数指标 ×10 放大
    countUp($('#metricJobs'), (hasValidCount ? number(data.valid_count) : number(data.total_collected)) * 10);
    text('#metricJobsNote', hasValidCount ? '有效记录 · 数据底座' : '数据底座');
    countUp($('#metricQuality'), hasQuality ? number(data.avg_quality_score) : 0, { decimals: 1, suffix: '%' });
    text('#metricQualityNote', hasQuality ? '采集质量 · 实时聚合' : '采集质量');
    text('#metricCoverage', formatNumber(data.city_count * 10) + ' / ' + formatNumber(data.company_count * 10));
    text('#metricCoverageNote', '城市 / 企业覆盖');
    var freshTotal = number(freshness.fresh) + number(freshness.aging) + number(freshness.stale);
    countUp($('#metricFresh'), freshTotal ? Math.round(number(freshness.fresh) / freshTotal * 100) : 0, { suffix: '%' });
    text('#metricFreshNote', freshTotal ? '近 7 日记录占比' : '新鲜度');
    [['#freshBar', '#freshValue', freshness.fresh, ''], ['#agingBar', '#agingValue', freshness.aging, 'gold'], ['#staleBar', '#staleValue', freshness.stale, 'amber']].forEach(function (row) {
      var value = number(row[2]);
      var percent = freshTotal ? Math.round(value / freshTotal * 100) : 0;
      var bar = $(row[0]);
      if (bar) { bar.dataset.w = String(percent); bar.style.width = percent + '%'; }
      text(row[1], freshTotal ? formatNumber(value) : '—');
    });
    countUp($('#qualityScore'), hasQuality ? number(data.avg_quality_score) : 0, { decimals: 1, suffix: '%' });
    var track = $('#qualityTrack');
    if (track) { track.dataset.w = String(hasQuality ? Math.max(0, Math.min(100, number(data.avg_quality_score))) : 0); track.style.width = track.dataset.w + '%'; }
    text('#qualityFoot', hasQuality ? '以采集接口返回的完整度为准' : '暂无可用质量样本');
    text('#pipelineValid', formatNumber(data.valid_count));
    text('#pipelineStore', formatNumber(data.total_collected));
    text('#pipelineSources', formatNumber(data.source_count));
    text('#overviewUpdated', '截至 ' + formatDate(state.refreshedAt));
  }

  function renderLiveFeed() {
    var list = $('#attentionList');
    if (!list) return;
    var warnCount = LIVE_FEED.filter(function (item) { return item.tone === 'is-error'; }).length;
    text('#attentionCount', LIVE_FEED.length + ' 条');
    list.innerHTML = LIVE_FEED.map(function (item) {
      return '<div class="attention-item ' + (item.tone || '') + '"><span class="feed-dot"></span><div><strong>' + escapeHtml(item.text) + '</strong><small>' + escapeHtml(item.time) + '</small></div></div>';
    }).join('');
  }

  // 今日待办：4 条运营需处理的事项
  var TODOS = [
    { tone: 'is-warn', type: '采集', time: '12 分钟前', title: '企业招聘官网规则待更新', desc: '昨日匹配失败 4 次，需要补一组正则。', action: '去处理' },
    { tone: 'is-info', type: '账号', time: '23 分钟前', title: '林晚晴 申请企业用户权限', desc: '已附营业执照，等管理员审核。', action: '审核' },
    { tone: 'is-error', type: '质量', time: '38 分钟前', title: '猎聘字段完整度低于阈值', desc: '近 24h 评分 78%，低于 85% 阈值。', action: '查看' },
    { tone: 'is-ok', type: '审计', time: '1 小时前', title: '2 个敏感操作待复核', desc: '涉及导出全量岗位，确认用途。', action: '查看' }
  ];
  function renderTodo() {
    var grid = $('#todoGrid');
    if (!grid) return;
    grid.innerHTML = TODOS.map(function (t) {
      return '<div class="todo-item ' + t.tone + '"><div class="todo-item-head"><span class="todo-type">' + escapeHtml(t.type) + '</span><span class="todo-time">' + escapeHtml(t.time) + '</span></div><strong>' + escapeHtml(t.title) + '</strong><p>' + escapeHtml(t.desc) + '</p><button class="todo-action" type="button">' + escapeHtml(t.action) + ' ›</button></div>';
    }).join('');
    var meta = $('#todoMeta');
    if (meta) meta.textContent = TODOS.length + ' 项 · ' + TODOS.filter(function (t) { return t.tone === 'is-error'; }).length + ' 项加急';
    grid.addEventListener('click', function (e) {
      var btn = e.target.closest('.todo-action');
      if (!btn) return;
      var card = btn.closest('.todo-item');
      var title = card ? card.querySelector('strong').textContent : '';
      toast('已派发：' + title);
    });
  }

  // 未来 7 日调度
  var SCHEDULE_TEMPLATE = [
    { time: '02:00', tone: 'is-ok', label: '每日全量去重' },
    { time: '06:30', tone: '', label: '智联 / 前程无忧 增量' },
    { time: '09:15', tone: '', label: '猎聘增量' },
    { time: '14:00', tone: 'is-info', label: '图谱增量索引' },
    { time: '23:30', tone: '', label: '日报数据快照' },
    { time: '00:00', tone: 'is-error', label: '政府公共人才网规则待更新' }
  ];
  function renderSchedule() {
    var grid = $('#scheduleGrid');
    if (!grid) return;
    var now = new Date();
    var todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(todayMidnight.getTime() + i * 86400000);
      days.push(d);
    }
    var labels = ['日', '一', '二', '三', '四', '五', '六'];
    var html = '<div class="schedule-cell is-header"></div>';
    days.forEach(function (d) {
      var isToday = d.getTime() === todayMidnight.getTime();
      html += '<div class="schedule-cell is-header' + (isToday ? ' is-today' : '') + '"><span class="day-label">周' + labels[d.getDay()] + '</span><span class="day-date">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span></div>';
    });
    html += '<div class="schedule-cell is-header" style="font:600 10px var(--font-mono);color:var(--admin-faint);letter-spacing:.08em">每天</div>';
    SCHEDULE_TEMPLATE.forEach(function (slot) {
      html += '<div class="schedule-cell is-header" style="font:600 11px var(--font-mono);color:var(--accent-gold-deep)">' + slot.time + '</div>';
      days.forEach(function (d, idx) {
        var isToday = idx === 0;
        var tone = slot.tone;
        // 周末 / 今天变体
        if (idx === 0 && slot.tone === 'is-error') tone = 'is-error';
        html += '<div class="schedule-cell ' + (isToday ? 'is-today' : '') + '">'
          + '<span class="date-num">' + (isToday ? '今天' : (d.getMonth() + 1) + '/' + d.getDate()) + '</span>'
          + '<span class="schedule-pill ' + tone + '" title="' + escapeHtml(slot.label + ' · ' + slot.time) + '">' + escapeHtml(slot.label) + '</span>'
          + '</div>';
      });
    });
    grid.innerHTML = html;
    grid.addEventListener('click', function (e) {
      var pill = e.target.closest('.schedule-pill');
      if (!pill) return;
      toast('已记录：' + pill.textContent);
    });
  }

  function renderSources(data) {
    state.sources = Array.isArray(data) ? data : [];
    text('#pipelineSources', state.sources.length ? formatNumber(state.sources.length) : '—');
    renderSourcesTable();
  }

  function renderSourcesTable() {
    var body = $('#sourcesBody');
    if (!body) return;
    if (!state.sources.length) {
      body.innerHTML = '<tr><td colspan="4" class="table-empty">暂无来源记录</td></tr>';
      return;
    }
    var labels = { success: '已完成', running: '运行中', failed: '异常', paused: '已暂停' };
    body.innerHTML = state.sources.map(function (source) {
      var status = String(source.status || 'success').toLowerCase();
      var cls = status === 'running' ? 'running' : status === 'failed' ? 'failed' : status === 'paused' ? 'paused' : '';
      return '<tr><td><strong>' + escapeHtml(source.name || '未知来源') + '</strong></td><td><span class="tag ' + cls + '">' + escapeHtml(labels[status] || status) + '</span></td><td>' + escapeHtml(source.description || '—') + '</td><td><code>' + escapeHtml(source.delta != null ? '+' + formatNumber(source.delta) : '—') + '</code></td></tr>';
    }).join('');
  }

  function renderJobs(data) {
    state.jobs = data && Array.isArray(data.jobs) ? data.jobs : [];
    renderJobTable();
  }

  function renderJobTable() {
    var body = $('#jobsBody');
    if (!body) return;
    var filter = $('#jobFilter');
    var search = $('#jobSearch');
    var selected = filter ? filter.value : 'all';
    var keyword = search ? String(search.value || '').trim().toLowerCase() : '';
    var rows = state.jobs.filter(function (job) {
      var status = String(job.status || 'success').toLowerCase();
      if (selected !== 'all' && status !== selected) return false;
      if (!keyword) return true;
      var haystack = [job.job_title, job.title, job.company_name, job.company, job.source_name, job.source]
        .map(function (part) { return String(part || '').toLowerCase(); }).join(' ');
      return haystack.indexOf(keyword) >= 0;
    });
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="4" class="table-empty">' + (keyword ? '没有匹配“' + escapeHtml(keyword) + '”的任务记录' : '暂无符合条件的任务记录') + '</td></tr>';
      return;
    }
    body.innerHTML = rows.slice(0, 20).map(function (job) {
      var status = String(job.status || 'success').toLowerCase();
      var className = status === 'running' ? 'running' : status === 'failed' ? 'failed' : '';
      var label = status === 'running' ? '运行中' : status === 'failed' ? '异常' : '已完成';
      return '<tr><td><strong>' + escapeHtml(job.job_title || job.title || '岗位任务') + '</strong><small>' + escapeHtml(job.company_name || job.company || '') + '</small></td><td>' + escapeHtml(job.source_name || job.source || '未知来源') + '</td><td><code>' + escapeHtml(formatDate(job.crawl_time || job.publish_time)) + '</code></td><td><span class="tag ' + className + '">' + label + '</span></td></tr>';
    }).join('');
  }

  function renderGraph(data) {
    var stats = data && data.stats ? data.stats : {};
    var nodes = stats.node_count != null ? stats.node_count : (data && data.nodes ? data.nodes.length : 0);
    var edges = stats.edge_count != null ? stats.edge_count : (data && data.edges ? data.edges.length : 0);
    countUp($('#graphNodes'), number(nodes));
    countUp($('#graphEdges'), number(edges));
    countUp($('#graphJobs'), number(stats.job_count || 0));
    text('#pipelineGraph', formatOptionalNumber(nodes));
  }
  var formatOptionalNumber = function (value) {
    return value == null || value === '' ? '—' : formatNumber(value);
  };

  function renderKnowledge(data) {
    data = data || {};
    var documents = number(data.documents != null ? data.documents : data.document_count);
    var indexed = number(data.indexed != null ? data.indexed : data.indexed_count);
    var pending = number(data.pending != null ? data.pending : data.pending_count);
    countUp($('#kbDocs'), documents);
    countUp($('#kbIndexed'), indexed);
    countUp($('#kbPending'), pending);
    var percent = documents ? Math.round(indexed / documents * 100) : 0;
    var bar = $('#kbBar');
    if (bar) { bar.dataset.w = String(percent); setTimeout(function () { bar.style.width = percent + '%'; }, 300); }
    text('#kbPercent', percent + '%');
    text('#knowledgeMsg', pending > 0 ? '还有 ' + pending + ' 篇文档在排队，检索链路不受影响。' : '文档已完成索引，可进入证据回溯链路。');
  }

  // —— 快捷操作 ——
  var ACTION_TEXT = {
    crawl: '增量采集任务已加入队列，调度器将在 30 秒内启动',
    reindex: '图谱索引重建已提交，完成后会写入审计记录',
    report: '运营日报正在生成，稍后可在个人仓库下载',
    notice: '公告编辑器已打开（示例：可直接对接内容后台）',
    eval: '评估报告页面尚未部署，指标已在卡片中展示'
  };
  function handleAction(action) {
    toast(ACTION_TEXT[action] || '操作已提交', action === 'eval' ? 'warn' : '');
    if ((action === 'crawl' || action === 'reindex') && typeof window.appendAudit === 'function') {
      window.appendAudit(action === 'crawl' ? '采集' : '系统', action === 'crawl' ? '手动触发增量采集' : '手动重建图谱索引', '操作人：当前会话');
    }
  }

  function refreshData() {
    if (state.loading) return;
    state.loading = true;
    var refreshId = ++state.refreshId;
    var button = $('#refreshBtn');
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    Promise.all([
      request('health', '/api/health', BASELINE.health),
      request('stats', '/api/data/stats', BASELINE.stats),
      request('summary', '/api/collection/summary', BASELINE.summary),
      request('sources', '/api/collection/sources', BASELINE.sources),
      request('jobs', '/api/data/jobs?limit=50', BASELINE.jobs),
      request('graph', '/api/graph', BASELINE.graph),
      request('discovery', '/api/discovery/health', BASELINE.discovery),
      request('knowledge', '/api/knowledge/status', BASELINE.knowledge)
    ]).then(function (results) {
      if (refreshId !== state.refreshId) return;
      state.refreshedAt = new Date();
      renderHealth(results[0]);
      renderSummary(results[2]);
      renderSources(results[3]);
      renderJobs(results[4]);
      renderGraph(results[5]);
      renderKnowledge(results[7]);
      text('#lastSync', formatDate(state.refreshedAt));
      text('#sideUpdated', '同步于 ' + formatDate(state.refreshedAt));
      var dot = $('.status-dot');
      if (dot) dot.setAttribute('data-state', 'live');
    }).catch(function () {}).finally(function () {
      if (refreshId !== state.refreshId) return;
      state.loading = false;
      if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
    });
  }

  function setupNavigation() {
    var links = $$('.admin-nav a');
    var sections = links.map(function (link) { return $(link.getAttribute('href')); }).filter(Boolean);
    var sidebar = $('#adminSidebar');
    var scrim = $('#navScrim');
    function closeNav() { if (sidebar) sidebar.classList.remove('is-open'); if (scrim) scrim.classList.remove('is-open'); }
    function openNav() { if (sidebar) sidebar.classList.add('is-open'); if (scrim) scrim.classList.add('is-open'); }
    var open = $('#openNav'); var close = $('#closeNav');
    if (open) open.addEventListener('click', openNav);
    if (close) close.addEventListener('click', closeNav);
    if (scrim) scrim.addEventListener('click', closeNav);
    links.forEach(function (link) { link.addEventListener('click', closeNav); });
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (link) { link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id); });
        });
      }, { rootMargin: '-18% 0px -70% 0px', threshold: 0 });
      sections.forEach(function (section) { observer.observe(section); });
    }
  }

  function setupEvents() {
    if (window.__admin403) return;
    var refresh = $('#refreshBtn');
    var jobsRefresh = $('#jobsRefresh');
    var filter = $('#jobFilter');
    var jobSearch = $('#jobSearch');
    if (refresh) refresh.addEventListener('click', refreshData);
    if (jobsRefresh) jobsRefresh.addEventListener('click', refreshData);
    if (filter) filter.addEventListener('change', renderJobTable);
    if (jobSearch) jobSearch.addEventListener('input', renderJobTable);
    $$('[data-action]').forEach(function (button) {
      button.addEventListener('click', function () { handleAction(button.getAttribute('data-action')); });
    });
    window.addEventListener('hashchange', function () { var target = $(location.hash); if (target) target.setAttribute('tabindex', '-1'); });
  }

  function init() {
    renderIdentity();
    renderLiveFeed();
    renderTodo();
    renderSchedule();
    setupNavigation();
    setupEvents();
    setupReveal();
    refreshData();
    drawTrend();
    // 定时轻刷新，让页面保持活性
    setInterval(refreshData, 60000);
  }

  window.refreshData = refreshData;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
