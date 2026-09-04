(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var rand = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  var ri = function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; };

  // —— 采集源：每个站点用首字 chip + 品牌色（事实配色，避免版权问题） ——
  var SOURCES = [
    { id: 'zhaopin', mark: '智', name: '智联招聘', brand: '智联招聘 · ZHAOPIN.COM', color: '#1F5BB6', region: '全国', status: 'success', today: 1284, mode: '增量 · 每 6 小时', schedule: '06:30 / 12:30 / 18:30' },
    { id: 'lagou', mark: '拉', name: '拉勾网', brand: 'LAGOU.COM · 互联网招聘', color: '#00B7C2', region: '全国', status: 'success', today: 286, mode: '增量 · 每日', schedule: '07:00' },
    { id: 'boss', mark: 'B', name: 'BOSS 直聘', brand: 'BOSS直聘 · ZHIPIN.COM', color: '#FF7E2D', region: '全国', status: 'running', today: 1102, mode: '流式 · 实时', schedule: '持续运行' },
    { id: 'liepin', mark: '猎', name: '猎聘', brand: '猎聘 · LIEPIN.COM', color: '#3D8B7A', region: '全国', status: 'running', today: 437, mode: '增量 · 每 4 小时', schedule: '09:15 / 13:15 / 17:15 / 21:15' },
    { id: '51job', mark: '51', name: '前程无忧 51Job', brand: '51JOB.COM · 综合招聘', color: '#C8361F', region: '全国', status: 'success', today: 962, mode: '增量 · 每日', schedule: '02:00' },
    { id: 'maimai', mark: '脉', name: '脉脉', brand: 'MAIMAI.CN · 职场社区', color: '#1E3A6F', region: '全国', status: 'paused', today: 0, mode: '已暂停 · 等规则更新', schedule: '—' },
    { id: 'gov', mark: '政', name: '政府公共人才网', brand: '政府公共招聘网', color: '#8B7340', region: '全国', status: 'success', today: 92, mode: '全量 · 每日', schedule: '00:30' },
    { id: 'linkedin', mark: 'in', name: '领英中国', brand: 'LINKEDIN.COM · 国际招聘', color: '#0A66C2', region: '全国', status: 'success', today: 158, mode: '增量 · 每日', schedule: '10:00' }
  ];

  var state = {
    sources: SOURCES.map(function (s) { return Object.assign({}, s); }),
    logs: [],
    counts: { ok: 0, warn: 0, error: 0, info: 0 },
    filter: 'all',
    paused: false,
    autoScroll: true,
    running: {},  // sourceId -> intervalId
    logIdSeed: 0
  };

  // —— 海量日志模板：每个分类 12-20 条，组合后看起来真实不重复 ——
  var LOG_TEMPLATES = {
    boot: [
      '启动调度器 · 加载采集器 {id}',
      '初始化浏览器上下文 (Playwright) · 视口 1440×900',
      '加载代理池 · 当前可用 38 个出口',
      '预热 Cookie 池 · 命中 12 条有效凭据',
      '检查反爬策略 · 当前策略等级 {level}',
      '构建入口链接种子 · 共 {n} 条',
      '校验来源规则正则 · 通过 {n}/{total}'
    ],
    fetch: [
      'GET {url} · {code} · {ms}ms · {kb}KB',
      'GET {url} · {code} · {ms}ms · 命中反爬 · 切换代理',
      'GET {url} · {code} · {ms}ms · 命中验证码 · 转人工通道',
      'POST {url} · payload {bytes}B · {code} · {ms}ms',
      '解析详情页 · DOM 节点 {nodes} · 字段 {fields}',
      '解码编码字段 (GBK) · 命中率 {pct}%',
      '提取结构化数据 · JSON Schema v{ver}'
    ],
    process: [
      '已加载入口链接 {n} 个',
      '已获取详情页 {n} 篇',
      '字段清洗完成 · 通过 {ok}/{total} ({pct}%)',
      '语言检测 · zh-CN {n} · en {m}',
      '薪资规范化 · 区间字符串 → 数字 · 处理 {n} 条',
      '城市标准化 · 命中 {n}/{m}',
      '技能标签归一化 · 新增 {n} 个 · 合并 {m} 个',
      '公司别名合并 · 消除 {n} 个重复',
      '学历要求枚举化 · 5 个值',
      '岗位类型推断 · 全职/兼职/实习'
    ],
    persist: [
      'SHA256 去重 · 移除 {n} 条重复',
      '批次打包 · {batch}',
      '已写入清洗仓 · {batch} · {n} 条',
      '已写入 PostgreSQL · jobs +{n} · companies +{m}',
      '向量索引同步 · {n} 条已编码',
      '通知清洗仓 · 队列已推进'
    ],
    error: [
      '来源 {src} 返回 {code} · 已重试 {n}/{max}',
      'IP 被限速 · 切换代理 {proxy}',
      'Cookie 失效 · 重新登录',
      '验证码出现 · 已上报转人工',
      '页面结构变更 · 解析失败 · 已记入灰度',
      '批次 {batch} 部分字段缺失 · 已标记待补全'
    ],
    warn: [
      '响应耗时 {ms}ms · 高于阈值 {threshold}ms',
      '字段 {field} 命中率 {pct}% · 低于预期',
      '检测到重复内容 · {n} 条已合并',
      '部分岗位薪资区间为空 · 已记入待补全'
    ],
    info: [
      '心跳 · 累计处理 {n} 条 · 平均 {ms}ms',
      '调度器空闲 · 等待下一窗口',
      '队列长度 {n} · 预估 {eta} 分钟',
      '缓存命中 · 跳过 {n} 个详情页',
      '随机抽样校验 · 通过 {n}/{m}'
    ],
    done: [
      '✓ 任务完成 · 用时 {time} · 提取 {n} 条 · 已推送清洗仓',
      '✓ 批次 {batch} 收尾 · 进入待清洗队列',
      '✓ 增量任务进入空闲 · 等待下一调度窗口'
    ]
  };

  // 占位符池
  var URLS = [
    'https://www.zhaopin.com/job/{id}',
    'https://www.lagou.com/jobs/{id}.html',
    'https://www.zhipin.com/job_detail/{id}',
    'https://www.liepin.com/a/{id}.shtml',
    'https://jobs.51job.com/all/co{co}/{id}.html',
    'https://maimai.cn/jobs/detail/{id}',
    'https://www.linkedin.com/jobs/view/{id}',
    'https://www.example.gov.cn/job/{id}'
  ];
  var COMPANIES = ['星河科技', '远见数据', '云阶智能', '深言科技', '数澜咨询', '轻芽生活', '山雾创意', '恒信银行', '启程人力', '新轨迹研究院', '玖源量化', '云巢物联', '锐明智能', '瀚星云算', '北辰智算'];
  var REGIONS = ['北京', '上海', '杭州', '深圳', '广州', '成都', '南京', '武汉', '苏州', '西安', '厦门', '长沙', '重庆', '青岛'];
  var LEVELS = ['低', '中', '高'];
  var CODES = [200, 200, 200, 200, 200, 304, 200, 200, 403, 502];
  var FIELDS = ['职位名称', '薪资', '城市', '公司', '经验', '学历', '技能', '描述', '发布时间', '来源链接'];

  function fill(tpl, source) {
    var id = source ? source.id : rand(SOURCES).id;
    return tpl
      .replace('{id}', id)
      .replace('{src}', id)
      .replace('{level}', rand(LEVELS))
      .replace('{n}', ri(40, 1847).toString())
      .replace('{m}', ri(8, 312).toString())
      .replace('{total}', ri(80, 1200).toString())
      .replace('{ok}', ri(60, 1100).toString())
      .replace('{nodes}', ri(120, 1840).toString())
      .replace('{fields}', rand(FIELDS) + ' 等 ' + ri(4, 9) + ' 项')
      .replace('{ver}', ri(2, 4).toString())
      .replace('{code}', rand(CODES).toString())
      .replace('{ms}', ri(48, 1480).toString())
      .replace('{threshold}', '800')
      .replace('{kb}', ri(8, 312).toString())
      .replace('{bytes}', ri(280, 12480).toString())
      .replace('{pct}', ri(72, 99).toString())
      .replace('{field}', rand(FIELDS))
      .replace('{url}', rand(URLS).replace('{id}', ri(10000000, 99999999).toString()))
      .replace('{proxy}', '出口-' + ri(2, 38) + '.proxy.zhitu.cn')
      .replace('{batch}', 'CQ-2404-' + String(ri(100, 999)))
      .replace('{time}', ri(38, 642) + 's')
      .replace('{eta}', ri(2, 18).toString())
      .replace('{co}', ri(110000, 450000).toString());
  }

  // 生成一条指定分类日志
  function makeEntry(category, source) {
    var tpl = rand(LOG_TEMPLATES[category] || LOG_TEMPLATES.info);
    var tone = category;
    if (category === 'done') tone = 'ok';
    if (category === 'warn') tone = 'warn';
    if (category === 'error') tone = 'error';
    if (category === 'boot' || category === 'process' || category === 'persist') tone = 'info';
    if (category === 'fetch') tone = Math.random() < 0.1 ? 'error' : 'ok';
    return {
      id: ++state.logIdSeed,
      ts: new Date(),
      tone: tone,
      text: fill(tpl, source),
      source: source ? source.id : null,
      category: category
    };
  }

  // 渲染源卡片
  function renderSources() {
    var grid = $('#sourceGrid');
    if (!grid) return;
    grid.innerHTML = state.sources.map(function (s) {
      var isRunning = state.running[s.id];
      var statusLabel = { success: '已就绪', running: '采集中', paused: '已暂停', failed: '异常' }[s.status] || s.status;
      var statusTone = 'is-' + s.status;
      return '<article class="source-card ' + (isRunning ? 'is-active' : '') + '" data-source="' + esc(s.id) + '">'
        + '<div class="source-mark" style="--brand:' + s.color + '"><span>' + esc(s.mark) + '</span></div>'
        + '<div class="source-body">'
        + '<header><h4>' + esc(s.name) + '</h4><span class="tag ' + statusTone + '">' + statusLabel + '</span></header>'
        + '<p class="source-meta">' + esc(s.brand) + ' · ' + esc(s.region) + '</p>'
        + '<div class="source-stats"><span>今日 <b>' + s.today.toLocaleString('zh-CN') + '</b></span><span>模式 <b>' + esc(s.mode) + '</b></span></div>'
        + '<div class="source-schedule">调度：<code>' + esc(s.schedule) + '</code></div>'
        + '</div>'
        + '<div class="source-actions"><button class="ghost-btn is-start" type="button" data-source-action="start" data-source-id="' + esc(s.id) + '">' + (isRunning ? '⏸ 暂停' : '▶ 启动') + '</button></div>'
        + '</article>';
    }).join('');
    text('#statSources', state.sources.length);
    text('#statRunning', Object.keys(state.running).length);
    var totalToday = state.sources.reduce(function (a, s) { return a + s.today; }, 0);
    text('#statToday', totalToday.toLocaleString('zh-CN'));
    text('#statRate', '94.2%');
  }

  var lastRenderedId = 0;
  var lastFilter = null;

  function lineHtml(l) {
    return '<div class="log-line log-' + l.tone + '" data-id="' + l.id + '">'
      + '<span class="log-ts">' + fmtTs(l.ts) + '</span>'
      + '<span class="log-tone">' + toneGlyph(l.tone) + '</span>'
      + '<span class="log-source">' + (l.source ? '[' + esc(l.source) + ']' : '[调度]') + '</span>'
      + '<span class="log-text">' + esc(l.text) + '</span>'
      + '</div>';
  }

  // 增量渲染：只追加新日志，避免全量重绘造成的卡顿与动画重放
  function renderLog(force) {
    var stream = $('#logStream');
    if (!stream) return;
    var items = state.filter === 'all' ? state.logs : state.logs.filter(function (l) { return l.tone === state.filter; });
    var full = force || state.filter !== lastFilter;
    lastFilter = state.filter;
    var last = items.length ? items[items.length - 1].id : 0;
    if (full) {
      var view = items.slice(-200);
      stream.innerHTML = view.length ? view.map(lineHtml).join('') : '<div class="log-empty">暂无日志 · 点击源卡片「▶ 启动」或顶部「▶ 全部启动」</div>';
      lastRenderedId = last;
    } else if (items.length) {
      var fresh = items.filter(function (l) { return l.id > lastRenderedId; });
      if (fresh.length) {
        var emptyEl = stream.querySelector('.log-empty');
        if (emptyEl) emptyEl.remove();
        stream.insertAdjacentHTML('beforeend', fresh.map(lineHtml).join(''));
        lastRenderedId = last;
      }
    }
    // DOM 上限保护：最多保留 220 行，防止日志过多撑爆内存与排版
    while (stream.children.length > 220) stream.removeChild(stream.firstChild);
    if (state.autoScroll) stream.scrollTop = stream.scrollHeight;
    // 更新计数
    var counts = state.logs.reduce(function (c, l) {
      if (l.tone === 'ok') c.ok++;
      else if (l.tone === 'warn') c.warn++;
      else if (l.tone === 'error') c.error++;
      else c.info++;
      return c;
    }, { ok: 0, warn: 0, error: 0, info: 0 });
    state.counts = counts;
    text('#logOk', counts.ok);
    text('#logWarn', counts.warn);
    text('#logError', counts.error);
    text('#logInfo', counts.info);
    text('#queueBadge', state.sources.filter(function (s) { return state.running[s.id]; }).length + ' 运行中');
  }

  function toneGlyph(tone) {
    return { ok: '✓', warn: '!', error: '×', info: '·' }[tone] || '·';
  }
  function fmtTs(d) {
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function text(sel, v) { var n = $(sel); if (n) n.textContent = v; }

  function pushLog(entry) {
    state.logs.push(entry);
    // 限制总条数
    if (state.logs.length > 800) state.logs = state.logs.slice(-600);
    if (!state.paused) renderLog();
  }

  // 启动某个源的爬取循环
  function startSource(sourceId) {
    if (state.running[sourceId]) return;
    var source = state.sources.filter(function (s) { return s.id === sourceId; })[0];
    if (!source) return;
    state.running[sourceId] = true;
    pushLog(makeEntry('boot', source));
    setTimeout(function () { pushLog(makeEntry('fetch', source)); }, 80);
    setTimeout(function () { pushLog(makeEntry('fetch', source)); }, 220);
    setTimeout(function () { pushLog(makeEntry('process', source)); }, 380);
    setTimeout(function () { pushLog(makeEntry('fetch', source)); }, 520);
    var tick = 0;
    var iv = setInterval(function () {
      if (!state.running[sourceId]) { clearInterval(iv); return; }
      tick++;
      // 权重化分类选择
      var r = Math.random();
      var category;
      if (tick < 5) category = r < 0.5 ? 'fetch' : 'process';
      else if (tick < 10) category = r < 0.4 ? 'fetch' : r < 0.7 ? 'process' : 'persist';
      else category = r < 0.4 ? 'process' : r < 0.6 ? 'persist' : r < 0.85 ? 'info' : (r < 0.95 ? 'warn' : 'error');
      // 错误率低
      if (category === 'error' && Math.random() > 0.18) category = 'info';
      pushLog(makeEntry(category, source));
      // 每 15 tick 完成一次批次
      if (tick % 15 === 0) {
        pushLog(makeEntry('done', source));
        source.today += ri(20, 80);
        renderSources();
      }
      // 每 30 tick 推送清洗仓
      if (tick % 30 === 0) {
        pushLog(makeEntry('persist', source));
      }
    }, ri(380, 720));
    state.running[sourceId] = iv;
    renderSources();
  }

  function stopSource(sourceId) {
    var iv = state.running[sourceId];
    if (iv) { clearInterval(iv); }
    delete state.running[sourceId];
    var source = state.sources.filter(function (s) { return s.id === sourceId; })[0];
    if (source) pushLog(Object.assign(makeEntry('info', source), { text: '任务已暂停 · 等待恢复' }));
    renderSources();
  }

  function startAll() {
    state.sources.forEach(function (s) {
      if (s.status !== 'paused' && !state.running[s.id]) startSource(s.id);
    });
    toast('已启动所有可调度源');
  }
  function stopAll() {
    Object.keys(state.running).forEach(function (id) { stopSource(id); });
    toast('已暂停全部采集任务');
  }

  // —— Toast ——
  function toast(message) {
    var host = $('#toastHost');
    if (!host) return;
    var item = document.createElement('div');
    item.className = 'toast';
    item.textContent = message;
    host.appendChild(item);
    setTimeout(function () { item.classList.add('is-leaving'); setTimeout(function () { item.remove(); }, 220); }, 2400);
  }

  function bindEvents() {
    if (window.__admin403) return;
    $('#sourceGrid').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-source-action]');
      if (!btn) return;
      var id = btn.getAttribute('data-source-id');
      var action = btn.getAttribute('data-source-action');
      if (action === 'start') {
        if (state.running[id]) stopSource(id);
        else startSource(id);
      }
    });
    $('#bulkStart').addEventListener('click', startAll);
    $('#pauseAll').addEventListener('click', stopAll);
    $('#logClear').addEventListener('click', function () { state.logs = []; renderLog(true); });
    $('#logPause').addEventListener('click', function (e) {
      state.paused = !state.paused;
      e.target.textContent = state.paused ? '▶ 继续' : '⏸ 暂停';
      if (!state.paused) renderLog();
    });
    $('#autoScroll').addEventListener('change', function (e) { state.autoScroll = e.target.checked; });
    document.querySelectorAll('.log-filter .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('.log-filter .chip').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active');
        state.filter = c.getAttribute('data-filter');
        renderLog();
      });
    });

    // 顶部身份 + 移动端
    var user = {}; try { user = JSON.parse(localStorage.getItem('zhitu_user') || '{}') || {}; } catch (_) {}
    var name = user.name || user.username;
    var role = String(user.role || '').toLowerCase();
    var isAdmin = role === 'admin';
    $('#userChip').textContent = name ? name + (isAdmin ? ' · ADMIN' : '') : '未登录 · READ ONLY';
    $('#operatorName').textContent = name || '演示值班员';
    $('#operatorRole').textContent = isAdmin ? 'ADMIN / OPERATOR' : 'ADMIN / OBSERVER';
    $('#sideUpdated').textContent = '同步于 ' + new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

    var sidebar = $('#adminSidebar');
    var scrim = $('#navScrim');
    function closeNav() { sidebar.classList.remove('is-open'); scrim.classList.remove('is-open'); }
    $('#openNav').addEventListener('click', function () { sidebar.classList.add('is-open'); scrim.classList.add('is-open'); });
    $('#closeNav').addEventListener('click', closeNav);
    scrim.addEventListener('click', closeNav);
  }

  function init() {
    renderSources();
    renderLog();
    bindEvents();
    // 自动启动默认运行源，给页面以"在跑"的氛围
    state.sources.forEach(function (s) {
      if (s.status === 'running') startSource(s.id);
    });
    // 系统级心跳日志
    setInterval(function () {
      if (!state.paused) pushLog(makeEntry('info'));
    }, 4200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();