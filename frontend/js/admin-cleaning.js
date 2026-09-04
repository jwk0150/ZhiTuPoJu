(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var rand = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  var ri = function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; };

  // —— 批次队列：模拟采集源推过来的原始数据包 ——
  var SOURCES = ['智联招聘', 'BOSS 直聘', '猎聘', '前程无忧', '拉勾网', '领英中国', '政府人才网'];
  var state = {
    batches: [],
    logs: [],
    counts: { ok: 0, warn: 0, error: 0, info: 0 },
    filter: 'all',
    paused: false,
    autoScroll: true,
    cleaning: {},   // batchId -> intervalId
    logIdSeed: 0,
    cloudTotal: 11904,
    cleanedToday: 3126
  };

  function newBatch(pending, fromSource) {
    var n = ri(180, 940);
    return {
      id: 'CQ-2404-' + String(ri(100, 999)),
      source: fromSource || rand(SOURCES),
      count: n,
      receivedAt: new Date(Date.now() - ri(3, 140) * 60000),
      status: pending ? 'pending' : 'pending', // pending | cleaning | done
      progress: 0,
      stage: '',
      result: null
    };
  }

  // —— 清洗日志模板（每个阶段 10-16 条，随机组合避免重复感） ——
  var T = {
    boot: [
      '批次 {batch} 进入清洗流程 · 来源 {source}',
      '加载清洗规则集 v3.2 · 含 {n} 条正则与 {m} 个字典',
      '初始化 NER 模型 · job-ner-v2 · 权重已就绪',
      '初始化 embedding 服务 · text2vec-base-chinese',
      '分配工作线程 · worker-{w}',
      '载入原始记录 {n} 条 · 平均长度 {len} 字符'
    ],
    validate: [
      '字段完整性校验 · 通过 {ok}/{total} ({pct}%)',
      '薪资格式校验 · 规范化 {n} 条 · 异常 {m} 条',
      '城市标准化 · 命中城市库 {n}/{total}',
      '学历枚举校验 · 不限/大专/本科/硕士/博士 · 异常 {m} 条',
      '日期格式校验 · ISO8601 · 修复 {n} 条',
      'URL 格式校验 · 来源链接有效性 {pct}%',
      '必填字段缺失 · 缺「薪资」{a} 条 · 缺「城市」{b} 条'
    ],
    dedup: [
      'SHA256 精确去重 · 移除 {n} 条完全重复',
      '模糊去重 · 相似标题 + 同公司 + 同城 · 合并 {n} 组',
      '跨来源去重 · 与云仓已有记录比对 · 命中 {n} 条',
      '标题归一化 · 去括号/去空格/繁转简 · 处理 {n} 条',
      '指纹比对 · MinHash · 相似度阈值 0.92 · 合并 {n} 条'
    ],
    ner: [
      '实体识别 (NER) · 抽取技能实体 {n} 个',
      '公司名规范化 · 别名映射合并 {n} 个',
      '岗位标准名对齐 · 命中职业词典 {n}/{total}',
      '薪资解析 · 「{salary}」→ {kmin}-{kmax}K',
      '地址解析 · 省/市/区 三级 · 置信度 {pct}%',
      '经验要求解析 · 「{exp}」→ 枚举值',
      '技能词典扩展 · 新增候选词 {n} 个 · 待人工审核',
      '行业分类 · 参考国标行业 · 一级 {a} / 二级 {b}'
    ],
    graph: [
      '能力图谱关联 · 新增岗位-技能边 {n} 条',
      '实体消歧 · 合并同义技能节点 {n} 个',
      '图谱一致性校验 · 孤立节点 {n} 个 · 已标记',
      '岗位类别聚类 · K-means · 生成 {n} 个簇',
      '证据链回填 · chunk → document → source_url · {n} 条'
    ],
    vector: [
      '文本切片 · {n} 条 · 平均 {len} token',
      '向量化 · 批次 {b}/{bt} · 延迟 {ms}ms',
      '写入向量索引 · hnsw · 维度 768 · {n} 条',
      ' embedding 质量抽检 · 余弦相似度自检通过 {pct}%'
    ],
    persist: [
      '云仓写入 · jobs +{n} · skills +{m} · companies +{k}',
      '全文索引更新 · {n} 条',
      '统计汇总 · 本批次合格率 {pct}%',
      '审计记录已写入 · 操作类型「清洗入库」'
    ],
    done: [
      '✓ 批次 {batch} 清洗完成 · 入库 {n} 条 · 合格率 {pct}% · 用时 {time}',
      '✓ 已同步到系统云仓 · 岗位池可检索',
      '✓ 通知指挥台 · 批次 {batch} 已归档'
    ],
    warn: [
      '字段「{field}」缺失率 {pct}% · 高于阈值 15%',
      '疑似爬取截断 · {n} 条描述长度 < 50 字符',
      '编码异常 · GBK→UTF8 修复 {n} 条',
      '薪资区间异常 · 高薪离群点 {n} 条 · 已标记待复核',
      '重复公司名变体较多 · 建议扩充别名库'
    ],
    info: [
      '仓控心跳 · 队列 {n} · 平均处理 {ms}ms/条',
      '云仓水位 · 累计 {n} 条 · 剩余容量充足',
      '缓存命中 · 跳过重复解析 {n} 次',
      '调度器空闲 · 等待下一批次',
      '随机抽样校验 · 抽 {n} 条人工复核 · 通过率 {pct}%',
      '工作线程负载 · worker 平均 {pct}%'
    ],
    error: [
      '丢弃 {n} 条 · 关键字段全空（标题/公司/城市）',
      '丢弃 {n} 条 · 非招聘内容（疑似广告/政策页）',
      '丢弃 {n} 条 · 语种非中文且无翻译价值',
      '校验失败 · JSON Schema 不合规 · 已隔离 {n} 条'
    ]
  };

  var SALARIES = ['15k-25k', '8千-1.2万', '20-35万/年', '面议', '12k-18k·14薪', '600-800元/天'];
  var EXPS = ['3-5年', '1-3年', '5-10年', '经验不限', '应届生'];
  var FIELDS = ['薪资', '城市', '技能', '描述', '发布时间'];

  function fill(tpl, batch) {
    return tpl
      .replace('{batch}', batch ? batch.id : 'CQ-2404-' + ri(100, 999))
      .replace('{source}', batch ? batch.source : rand(SOURCES))
      .replace('{n}', ri(12, 880).toString())
      .replace('{m}', ri(3, 240).toString())
      .replace('{k}', ri(2, 48).toString())
      .replace('{a}', ri(1, 30).toString())
      .replace('{b}', ri(1, 20).toString())
      .replace('{total}', ri(120, 940).toString())
      .replace('{ok}', ri(80, 860).toString())
      .replace('{nodes}', ri(120, 1840).toString())
      .replace('{pct}', ri(82, 99).toString())
      .replace('{len}', ri(180, 920).toString())
      .replace('{w}', ri(1, 8).toString())
      .replace('{b}', ri(1, 9).toString())
      .replace('{bt}', ri(10, 19).toString())
      .replace('{ms}', ri(38, 680).toString())
      .replace('{salary}', rand(SALARIES))
      .replace('{kmin}', ri(6, 40).toString())
      .replace('{kmax}', ri(41, 90).toString())
      .replace('{exp}', rand(EXPS))
      .replace('{field}', rand(FIELDS))
      .replace('{time}', ri(52, 384) + 's');
  }

  function makeEntry(category, batch) {
    var toneMap = { done: 'ok', warn: 'warn', error: 'error' };
    var tone = toneMap[category] || 'info';
    if (category === 'validate' || category === 'dedup' || category === 'ner') tone = Math.random() < 0.12 ? 'warn' : 'info';
    return {
      id: ++state.logIdSeed,
      ts: new Date(),
      tone: tone,
      text: fill(rand(T[category] || T.info), batch),
      batch: batch ? batch.id : null,
      category: category
    };
  }

  function fmtTs(d) {
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function text(sel, v) { var n = $(sel); if (n) n.textContent = v; }

  var lastRenderedId = 0;
  var lastFilter = null;

  function lineHtml(l) {
    return '<div class="log-line log-' + l.tone + '">'
      + '<span class="log-ts">' + fmtTs(l.ts) + '</span>'
      + '<span class="log-tone">' + ({ ok: '✓', warn: '!', error: '×', info: '·' }[l.tone] || '·') + '</span>'
      + '<span class="log-source">' + (l.batch ? '[' + esc(l.batch) + ']' : '[仓控]') + '</span>'
      + '<span class="log-text">' + esc(l.text) + '</span>'
      + '</div>';
  }

  // 增量渲染：只追加新日志，避免全量重绘造成的卡顿与排版抖动
  function renderLog(force) {
    var stream = $('#logStream');
    if (!stream) return;
    var items = state.filter === 'all' ? state.logs : state.logs.filter(function (l) { return l.tone === state.filter; });
    var full = force || state.filter !== lastFilter;
    lastFilter = state.filter;
    var last = items.length ? items[items.length - 1].id : 0;
    if (full) {
      var view = items.slice(-200);
      stream.innerHTML = view.length ? view.map(lineHtml).join('') : '<div class="log-empty">暂无日志 · 点击批次「⚡ 一键清洗」或顶部「一键清洗全部」</div>';
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
    // DOM 上限保护：最多保留 220 行
    while (stream.children.length > 220) stream.removeChild(stream.firstChild);
    if (state.autoScroll) stream.scrollTop = stream.scrollHeight;
    var c = state.logs.reduce(function (acc, l) { acc[l.tone] = (acc[l.tone] || 0) + 1; return acc; }, {});
    state.counts = { ok: c.ok || 0, warn: c.warn || 0, error: c.error || 0, info: c.info || 0 };
    text('#logOk', state.counts.ok);
    text('#logWarn', state.counts.warn);
    text('#logError', state.counts.error);
    text('#logInfo', state.counts.info);
  }

  function pushLog(entry) {
    state.logs.push(entry);
    if (state.logs.length > 800) state.logs = state.logs.slice(-600);
    if (!state.paused) renderLog();
  }

  function renderBatches() {
    var list = $('#batchList');
    if (!list) return;
    if (!state.batches.length) {
      list.innerHTML = '<div class="log-empty">暂无待清洗批次 · 采集源推送后自动出现在这里</div>';
      return;
    }
    list.innerHTML = state.batches.map(function (b) {
      var isCleaning = !!state.cleaning[b.id];
      var isDone = b.status === 'done';
      var statusLabel = isDone ? '已入库' : isCleaning ? '清洗中' : '待清洗';
      var statusTone = isDone ? '' : isCleaning ? 'running' : 'paused';
      var stageLabel = b.stage ? ' · ' + b.stage : '';
      return '<article class="batch-card' + (isCleaning ? ' is-cleaning' : '') + '" data-batch="' + esc(b.id) + '">'
        + '<div class="batch-head"><span class="batch-id">' + esc(b.id) + '</span><span class="tag ' + statusTone + '">' + statusLabel + '</span></div>'
        + '<div class="batch-meta"><span>来源 <b>' + esc(b.source) + '</b></span><span>原始 <b>' + b.count.toLocaleString('zh-CN') + '</b> 条</span><span>接收 <b>' + fmtAge(b.receivedAt) + '</b></span>' + (isCleaning || isDone ? '<span>阶段 <b>' + esc(b.stage || (isDone ? '完成' : '启动')) + '</b></span>' : '') + '</div>'
        + (isCleaning || isDone ? '<div class="batch-progress"><i style="width:' + b.progress + '%"></i></div>' : '')
        + (isDone && b.result ? '<div class="batch-summary"><span>入库 <b>' + b.result.in + '</b></span><span>去重 -' + b.result.dup + '</span><span>丢弃 -' + b.result.drop + '</span><span>合格率 <b>' + b.result.rate + '%</b></span></div>' : '')
        + (!isDone && !isCleaning ? '<div class="batch-actions"><button class="ghost-btn is-primary" type="button" data-batch-action="clean" data-batch-id="' + esc(b.id) + '">⚡ 一键清洗 · 提取到云仓</button><button class="ghost-btn" type="button" data-batch-action="detail" data-batch-id="' + esc(b.id) + '">查看样本</button></div>' : '')
        + (!isDone && isCleaning ? '<div class="batch-actions"><span style="color:var(--admin-faint);font-size:11.5px">' + esc(stageLabel) + '</span></div>' : '')
        + '</article>';
    }).join('');
    text('#statPending', state.batches.filter(function (b) { return b.status === 'pending'; }).length);
    text('#queueBadge', state.batches.filter(function (b) { return b.status !== 'done'; }).length + ' 待处理');
  }

  function fmtAge(d) {
    var mins = Math.max(1, Math.round((Date.now() - d.getTime()) / 60000));
    if (mins < 60) return mins + ' 分钟前';
    var h = Math.round(mins / 60);
    return h + ' 小时前';
  }

  function renderStats() {
    text('#statCleaned', state.cleanedToday.toLocaleString('zh-CN'));
    text('#statPass', '94.6%');
    text('#statCloud', state.cloudTotal.toLocaleString('zh-CN'));
  }

  // —— 一键清洗：完整跑一遍流水线，逐阶段出日志 + 推进度条 ——
  var STAGES = [
    { key: 'boot', weight: 8, label: '初始化' },
    { key: 'validate', weight: 18, label: '字段校验' },
    { key: 'dedup', weight: 16, label: '去重' },
    { key: 'ner', weight: 20, label: '实体识别' },
    { key: 'graph', weight: 14, label: '图谱关联' },
    { key: 'vector', weight: 14, label: '向量化' },
    { key: 'persist', weight: 10, label: '入库' }
  ];

  function cleanBatch(batchId) {
    var batch = state.batches.filter(function (b) { return b.id === batchId; })[0];
    if (!batch || state.cleaning[batchId]) return;
    state.cleaning[batchId] = true;
    batch.status = 'cleaning';
    batch.progress = 0;
    batch.stage = '初始化';
    renderBatches();

    pushLog(makeEntry('boot', batch));
    var stageIdx = 0;
    var tick = 0;
    var drops = 0, dups = 0, kept = batch.count;
    var totalTicks = ri(38, 60);

    var iv = setInterval(function () {
      tick++;
      var stage = STAGES[stageIdx];
      batch.stage = stage.label;
      batch.progress = Math.min(99, Math.round(tick / totalTicks * 100));
      // 阶段推进
      var shouldAdvance = tick >= Math.round(totalTicks * (STAGES.slice(0, stageIdx + 1).reduce(function (a, s) { return a + s.weight; }, 0) / 100));
      if (shouldAdvance && stageIdx < STAGES.length - 1) {
        stageIdx++;
        stage = STAGES[stageIdx];
        batch.stage = stage.label;
      }
      // 日志：按当前阶段出 1-2 条
      var category = stage.key;
      if (Math.random() < 0.14) category = 'warn';
      if (Math.random() < 0.06) category = 'error';
      pushLog(makeEntry(category, batch));
      if (Math.random() < 0.35) pushLog(makeEntry(category, batch));
      // 累计去重/丢弃量
      if (category === 'dedup') dups += ri(2, 14);
      if (category === 'error') drops += ri(1, 6);

      if (tick >= totalTicks) {
        clearInterval(iv);
        delete state.cleaning[batchId];
        batch.status = 'done';
        batch.progress = 100;
        batch.stage = '完成';
        var rate = ri(91, 98);
        var inCount = Math.max(10, batch.count - dups - drops);
        batch.result = { in: inCount, dup: dups, drop: drops, rate: rate };
        state.cleanedToday += inCount;
        state.cloudTotal += inCount;
        pushLog(makeEntry('persist', batch));
        pushLog(Object.assign(makeEntry('done', batch), {}));
        renderBatches();
        renderStats();
        toast('批次 ' + batch.id + ' 已入库 · ' + inCount + ' 条 · 合格率 ' + rate + '%');
        // 清洗完成后，过一段时间新批次自动到达（模拟采集源持续推送）
        setTimeout(function () {
          var nb = newBatch(true);
          state.batches.unshift(nb);
          if (state.batches.filter(function (b) { return b.status !== 'done'; }).length > 7) {
            var idx = state.batches.map(function (b) { return b.id; }).lastIndexOf(nb.id);
            if (idx > 7) state.batches.splice(idx, 1);
          }
          pushLog(makeEntry('boot', nb));
          renderBatches();
        }, ri(8000, 16000));
      } else {
        renderBatches();
      }
    }, ri(300, 480));
    state.cleaning[batchId] = iv;
  }

  function cleanAll() {
    var pending = state.batches.filter(function (b) { return b.status === 'pending'; });
    if (!pending.length) { toast('当前没有待清洗批次'); return; }
    pending.forEach(function (b, i) {
      setTimeout(function () { cleanBatch(b.id); }, i * 900);
    });
    toast('已加入清洗队列 · ' + pending.length + ' 个批次');
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
    $('#batchList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-batch-action]');
      if (!btn) return;
      var id = btn.getAttribute('data-batch-id');
      var action = btn.getAttribute('data-batch-action');
      if (action === 'clean') cleanBatch(id);
      if (action === 'detail') {
        var b = state.batches.filter(function (x) { return x.id === id; })[0];
        if (b) toast('样本：' + b.source + ' · ' + ri(3, 12) + ' 条岗位 · 含「' + rand(['前端工程师', '数据分析师', '算法工程师', '产品经理', '运营专员']) + '」等岗位');
      }
    });
    $('#cleanAll').addEventListener('click', cleanAll);
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
    // 初始队列：6 个待清洗批次
    for (var i = 0; i < 6; i++) state.batches.push(newBatch(true));
    renderBatches();
    renderStats();
    renderLog();
    bindEvents();
    // 开机日志
    pushLog(makeEntry('boot'));
    pushLog(makeEntry('info'));
    // 系统心跳
    setInterval(function () {
      if (!state.paused) pushLog(makeEntry('info'));
    }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();