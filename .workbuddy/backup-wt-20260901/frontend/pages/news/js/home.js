/* =========================================================================
 * 岗位大新闻 · 首页逻辑
 * -------------------------------------------------------------------------
 * 第一屏：数字杂志式 Hero（标题 / 大数据 / 视觉 / 编辑列表 / 头版新闻）
 * 第二~五屏：热门资讯 / 行业快讯 / 热门排行 / 延伸阅读（保持原样）
 * ========================================================================= */
(function () {
  'use strict';

  var D = window.JOB_NEWS_DATA;
  var JN = window.JN;
  var esc = JN.escapeHtml;

  var state = {
    latestCategory: 'all',
    search: { keyword: '', date: '', sort: 'date' }
  };

  /* ---------- 顶部更新时间胶囊（Hero 页头中央） ---------- */
  function renderModuleHead() {
    var M = D.META;
    var el = document.getElementById('jn-topbar-update');
    if (el) el.innerHTML = '更新于 <b>' + esc(M.date) + ' ' + esc(M.time) + '</b>';
  }

  /* ============================================================
   * 第一屏 · 杂志式 Hero
   * ============================================================ */

  /* 编辑部精选 4 条：与第二张图内容一一对应 */
  var HERO_EDITORIAL = [
    { id: 'r007', cat: '行业趋势', catCls: 'is-teal' },
    { id: 'n007', cat: '政策资讯', catCls: 'is-rose' },
    { id: 'n002', cat: '新职业',   catCls: 'is-blue' },
    { id: 'n015', cat: '市场洞察', catCls: 'is-violet' }
  ];

  function findById(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* 头版封面新闻：腾讯 2026 校招（flag = 热点、阅读量最高） */
  function pickHeadline() {
    var n = findById(D.focusList, 'n001');
    if (n) return n;
    /* 退化：取 flag=热点 或阅读量最高的一条 */
    for (var i = 0; i < D.focusList.length; i++) {
      if (D.focusList[i].flag === '热点') return D.focusList[i];
    }
    return D.focusList[0];
  }

  function statsHtml() {
    return (
      '<div class="jn-hero-data-row">' +
        '<div class="jn-hero-big-stat">' +
          '<div class="jn-hero-big-num">' +
            '<span class="sign">+</span>' +
            '<span class="jn-hero-big-figure" data-count="218" data-decimals="0">0</span>' +
            '<span class="suffix">%</span>' +
          '</div>' +
          '<div class="jn-hero-big-label">AI相关岗位需求增长</div>' +
        '</div>' +
        '<div class="jn-hero-sub-stats">' +
          '<div class="jn-hero-sub-stat">' +
            '<div class="jn-hero-sub-num"><span data-count="285" data-decimals="0">0</span>万+</div>' +
            '<div class="jn-hero-sub-label">企业人才需求缺口</div>' +
          '</div>' +
          '<div class="jn-hero-sub-stat">' +
            '<div class="jn-hero-sub-num"><span data-count="26.7" data-decimals="1">0</span>%</div>' +
            '<div class="jn-hero-sub-label">平均薪资涨幅</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function tagsHtml() {
    var tags = ['AI产品经理', '智能体开发', '大模型工程师', '数据分析师', '数字化转型'];
    return tags.map(function (t, i) {
      return '<a class="jn-hero-tag' + (i === 0 ? ' is-gold' : '') + '" href="all.html?tag=' + encodeURIComponent(t) + '">' + esc(t) + '</a>';
    }).join('');
  }

  function headlinerHtml(head) {
    var isExt = !!head.external;
    var attr = isExt
      ? ('data-url="' + esc(head.url) + '"')
      : ('data-go="' + esc(head.id) + '"');
    return (
      '<article class="jn-hero-headliner jn-hero-anim" style="--d:.58s" ' + attr + '>' +
        '<span class="jn-hero-headliner-flag">本期头条</span>' +
        '<div class="jn-hero-headliner-body">' +
          '<h3 class="jn-hero-headliner-title">' + esc(head.title) + '</h3>' +
          '<div class="jn-hero-headliner-meta">' +
            '<span class="jn-hero-headliner-source">' + esc(head.source) + '</span>' +
            '<span>' + esc(head.date) + '</span>' +
            '<span>' + JN.fmtRead(head.readCount) + '阅读</span>' +
          '</div>' +
          '<div class="jn-hero-headliner-cta">查看完整报道 <span aria-hidden="true">→</span></div>' +
        '</div>' +
      '</article>'
    );
  }

  function editThumbSvg(cat) {
    var svgs = {
      '行业趋势': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
      '政策资讯': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 10h6"/><path d="M9 14h6"/></svg>',
      '新职业': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M8 13h8"/></svg>',
      '市场洞察': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg>'
    };
    return '<div class="jn-hero-edit-thumb">' + (svgs[cat] || svgs['市场洞察']) + '</div>';
  }

  function editorialHtml() {
    var pool = D.focusList.concat(D.newsList);
    return HERO_EDITORIAL.map(function (p, i) {
      var n = findById(pool, p.id);
      if (!n) return '';
      var isExt = !!n.external;
      var attr = isExt
        ? ('data-url="' + esc(n.url) + '"')
        : ('data-go="' + esc(n.id) + '"');
      var hostHtml = n.host ? '<span class="jn-hero-edit-host">' + esc(n.host) + '</span>' : '';
      return (
        '<article class="jn-hero-edit-item jn-hero-anim" style="--d:' + (0.55 + i * 0.08).toFixed(2) + 's" ' + attr + '>' +
          '<div class="jn-hero-edit-num">' + ('0' + (i + 1)) + '</div>' +
          '<div class="jn-hero-edit-body">' +
            '<div class="jn-hero-edit-cat ' + p.catCls + '">' + esc(p.cat) + '</div>' +
            '<h4 class="jn-hero-edit-title">' + esc(n.title) + '</h4>' +
            '<div class="jn-hero-edit-meta">' +
              '<span class="jn-hero-edit-source">' + esc(n.source) + '</span>' +
              hostHtml +
              '<span>' + esc(n.date) + '</span>' +
              '<span>' + JN.fmtRead(n.readCount) + '阅读</span>' +
            '</div>' +
          '</div>' +
          editThumbSvg(p.cat) +
        '</article>'
      );
    }).join('');
  }

  /* ============================================================
   * 第一屏右栏：五大实时信源（对应真实爬虫 source_type，串联第二屏智能发现）
   * ============================================================ */
  /* 第一屏右栏：五大信源分类（对应真实爬虫 source_type，串联第二屏智能发现）
   * 注意：卡片正面只出现「五大分类」本身，不特指任何具体平台（BOSS/CSDN/GitHub…）；
   * 具体抓取了哪些站点，放在发现日志抽屉里说明（用户要求）。 */
  var HERO_SOURCES = [
    { id: '招聘平台', name: '招聘平台', en: 'JOBS',       icon: 'briefcase', tint: '#A88B4E',
      desc: '实时岗位 · 用人需求 · 薪资区间', tags: ['岗位需求', '薪资', '面试'] },
    { id: '企业官网', name: '企业官网', en: 'ENTERPRISE', icon: 'building',  tint: '#3D8B7A',
      desc: '团队扩张 · 融资裁员 · 用人信号', tags: ['扩招', '裁员', '远程'] },
    { id: '行业报告', name: '行业报告', en: 'REPORTS',    icon: 'report',    tint: '#4A7C9B',
      desc: '行业趋势 · 供需薪资 · 城市分布', tags: ['趋势', '薪资', '供需'] },
    { id: '政策文件', name: '政策文件', en: 'POLICY',     icon: 'policy',    tint: '#8B7340',
      desc: '就业优先 · 人才培育 · 产业政策', tags: ['就业', '人才', '补贴'] },
    { id: '学术论文', name: '学术论文', en: 'PAPERS',     icon: 'paper',     tint: '#6B7FA8',
      desc: '前沿研究 · 技术方向 · 学什么', tags: ['大模型', 'Agent', '推理'] }
  ];

  function sourceIconSvg(icon) {
    var svgs = {
      briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>',
      building:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/><path d="M10 21v-3h4v3"/></svg>',
      report:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h11l3 3v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 8h6M9 12h6M9 16h4"/><path d="M15 3v4h4"/></svg>',
      policy:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
      paper:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M14 3v5h5"/><path d="M8 13h8M8 17h6"/></svg>'
    };
    return svgs[icon] || svgs.report;
  }

  function sourcesHtml() {
    return '<div class="jn-hero-sources-list">' + HERO_SOURCES.map(function (s, i) {
      return '<a class="jn-hero-source-item jn-hero-anim" style="--d:' + (0.36 + i * 0.07).toFixed(2) + 's;--tint:' + s.tint + '" href="javascript:void(0)" data-source-type="' + esc(s.id) + '">' +
        '<span class="jn-hero-source-idx">' + ('0' + (i + 1)) + '</span>' +
        '<span class="jn-hero-source-icon">' + sourceIconSvg(s.icon) + '</span>' +
        '<span class="jn-hero-source-body">' +
          '<span class="jn-hero-source-line1">' +
            '<span class="jn-hero-source-name">' + esc(s.name) + '</span>' +
            '<em class="jn-hero-source-en">' + esc(s.en) + '</em>' +
          '</span>' +
          '<span class="jn-hero-source-desc">' + esc(s.desc) + '</span>' +
          '<span class="jn-hero-source-tags">' +
            s.tags.map(function (t) { return '<i class="jn-hero-source-tag">' + esc(t) + '</i>'; }).join('') +
          '</span>' +
        '</span>' +
        '<span class="jn-hero-source-arrow" aria-hidden="true">→</span>' +
      '</a>';
    }).join('') + '</div>';
  }

  function renderFocus() {
    var root = document.getElementById('focus');
    if (!root) return;
    var head = pickHeadline();

    var leftCol =
      '<div class="jn-hero-left">' +
        '<div class="jn-hero-left-top">' +
          '<div class="jn-hero-eyebrow jn-hero-anim" style="--d:.05s">2026 岗位变化观察</div>' +
          '<h1 class="jn-hero-title jn-hero-anim" style="--d:.15s">' +
            '<span class="jn-hero-title-line">AI浪潮</span>' +
            '<span class="jn-hero-title-line">重塑就业格局</span>' +
          '</h1>' +
          '<div class="jn-hero-subtitle jn-hero-anim" style="--d:.22s">新岗位爆发式增长</div>' +
          '<p class="jn-hero-desc jn-hero-anim" style="--d:.28s">企业人才标准正在被重新定义。</p>' +
        '</div>' +
        headlinerHtml(head) +
        '<div class="jn-hero-data jn-hero-anim" style="--d:.38s">' + statsHtml() + '</div>' +
        '<div class="jn-hero-actions jn-hero-anim" style="--d:.46s">' +
          '<a class="jn-hero-btn-primary" href="detail.html?id=' + esc(head.id) + '">查看完整报告 <span aria-hidden="true">→</span></a>' +
          '<button type="button" class="jn-hero-btn-secondary" id="hero-play">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
            '<span>3分钟速读</span>' +
          '</button>' +
        '</div>' +
        '<div class="jn-hero-tags jn-hero-anim" style="--d:.52s">' +
          '<span class="jn-hero-tags-label">热门岗位</span>' +
          '<div class="jn-hero-tags-list">' + tagsHtml() + '</div>' +
        '</div>' +
      '</div>';

    var visual =
      '<div class="jn-hero-visual jn-hero-anim" style="--d:.18s">' +
        '<div class="jn-hero-visual-frame">' +
          '<img class="jn-hero-visual-img" src="../../assets/news/hero-magazine.png" alt="未来城市职业入口" />' +
        '</div>' +
        '<span class="jn-hero-visual-tag">本期封面</span>' +
        '<div class="jn-hero-visual-caption">' +
          '<span>VOL.01</span>' +
          '<span class="jn-dotline"></span>' +
          '<span>FUTURE CAREER MEDIA</span>' +
        '</div>' +
        '<svg class="jn-hero-ink" viewBox="0 0 240 360" preserveAspectRatio="none" aria-hidden="true">' +
          '<defs>' +
            '<linearGradient id="jnInkGrad" x1="1" y1="0" x2="0" y2="1">' +
              '<stop offset="0" stop-color="#9A7B3E" stop-opacity="0.9" />' +
              '<stop offset="0.55" stop-color="#8A6F3E" stop-opacity="0.42" />' +
              '<stop offset="1" stop-color="#8A6F3E" stop-opacity="0" />' +
            '</linearGradient>' +
          '</defs>' +
          '<g filter="url(#jn-ink-stroke)">' +
            '<path class="jn-ink-stroke s1" pathLength="1" d="M188 24 C 150 86, 120 150, 64 244 S 30 300, 12 334" />' +
            '<path class="jn-ink-stroke s2" pathLength="1" d="M198 54 C 158 116, 132 176, 86 268 S 52 320, 38 350" />' +
            '<path class="jn-ink-stroke s3" pathLength="1" d="M172 12 C 140 70, 110 120, 52 206 S 24 262, 6 292" />' +
          '</g>' +
        '</svg>' +
      '</div>';

    var editorialCol =
      '<aside class="jn-hero-sources jn-hero-anim" style="--d:.30s">' +
        '<div class="jn-hero-sources-head">' +
          '<div class="jn-hero-sources-title">实时发现 · 五大信源</div>' +
          '<div class="jn-hero-sources-sub">点任意信源 · 直达发现结果</div>' +
        '</div>' +
        sourcesHtml() +
        '<div class="jn-hero-sources-foot">岗位相关资讯优先 · 无关内容不入库</div>' +
      '</aside>';

    root.innerHTML = '<div class="jn-hero-magazine">' + leftCol + visual + editorialCol + '</div>';

    /* 数据数字 count-up */
    JN.animateDataValues(root);

    /* 3 分钟速读：平滑滚到下一屏（行业快讯） */
    var play = document.getElementById('hero-play');
    if (play) {
      play.addEventListener('click', function () {
        var next = document.getElementById('screen-industry');
        if (next && next.scrollIntoView) next.scrollIntoView({ behavior: 'smooth' });
        else JN.toast('即将上线', 'info');
      });
    }
  }

  /* ============================================================
   * 第二~五屏：热门资讯 / 行业快讯 / 热门排行 / 延伸阅读（保持原样）
   * ============================================================ */

  function renderHot() {
    var items = D.hotNews.map(function (h, i) {
      return JN.newsRowHtml(h, i + 1);
    }).join('');
    return JN.sectionHead('热门资讯', '阅读热度 · 编辑精选', { href: 'all.html', text: '全部 <span aria-hidden="true">→</span>' }) +
      '<div class="jn-news-grid">' + items + '</div>';
  }

  /* ---------- 行业快讯 ---------- */
  function latestTabsHtml() {
    return D.CATEGORIES.map(function (c) {
      return '<button type="button" class="jn-filter-tab' + (c.key === state.latestCategory ? ' is-active' : '') + '" data-filter="' + c.key + '">' + esc(c.label) + '</button>';
    }).join('');
  }

  function latestFiltered() {
    if (state.latestCategory === 'all') return D.latestNews;
    return D.latestNews.filter(function (n) { return n.category === state.latestCategory; });
  }

  function renderLatest() {
    var list = latestFiltered().slice(0, 6);
    var more = { href: 'industry.html', text: '全部 <span aria-hidden="true">→</span>' };
    var html = JN.sectionHead('智能发现', '从招聘平台、企业官网、行业报告、政策文件与学术论文中发现最新资讯', more, true, 'industry.html') +
      '<div class="jn-disc-bar" id="home-disc-bar">' +
        '<div class="jn-disc-bar-left">' +
          '<div class="jn-disc-scanner"><span class="jn-disc-scanner-ring"></span><span class="jn-disc-scanner-core"></span></div>' +
          '<div class="jn-disc-bar-text">' +
            '<div class="jn-disc-bar-title" id="home-disc-bar-title">正在多源发现中…</div>' +
            '<div class="jn-disc-bar-sub"><b id="home-disc-bar-count">0</b> 条新资讯</div>' +
          '</div>' +
          '<ol class="jn-disc-chips" id="home-disc-chips">' +
            DISCO_SOURCES.map(function(s) {
              return '<li class="jn-disc-chip" data-source="' + s.id + '">' +
                '<span class="jn-disc-chip-mark">' + s.mark + '</span>' +
                '<span class="jn-disc-chip-body">' +
                  '<span class="jn-disc-chip-name">' + esc(s.name) + '</span>' +
                  '<span class="jn-disc-chip-type">' + esc(s.desc || s.type) + '</span>' +
                '</span>' +
                '<span class="jn-disc-chip-pulse"></span>' +
              '</li>';
            }).join('') +
          '</ol>' +
        '</div>' +
        '<div class="jn-disc-bar-right">' +
          '<div class="jn-disc-bar-time">' +
            '<span class="jn-disc-bar-time-dot"></span>预计完成 <b id="home-disc-bar-eta">00:00</b>' +
          '</div>' +
          '<button type="button" class="jn-disc-trigger" id="home-disc-trigger">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
            '<span id="home-disc-trigger-text">开始发现</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;flex-wrap:wrap">' +
        '<div class="jn-filter-tabs">' + latestTabsHtml() + '</div>' +
        '<button type="button" class="jn-disc-log-btn" id="home-disc-log-btn">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>' +
          '发现日志' +
        '</button>' +
      '</div>';

    if (list.length === 0) {
      html += '<div class="jn-state jn-state--compact">该分类下暂时没有资讯，稍后再来看看。</div>';
    } else {
      html += '<div class="jn-news-grid" id="home-disc-grid">' + list.map(function (n) { return JN.newsRowHtml(n, null); }).join('') + '</div>';
    }
    html += '<div class="jn-disc-foot">' +
      '<span class="jn-disc-foot-rule"></span>' +
      '<span>已显示最新 6 条发现</span>' +
      '<span class="jn-disc-foot-rule"></span>' +
      '<a class="jn-disc-foot-more" href="industry.html">查看更多新发现 →</a>' +
    '</div>';
    return html;
  }

  /* ============================================================
   * Discovery Service —— 真实后端爬虫接入（type 必须与 discovery.py 的 source_type 一致）
   * 五大信源：招聘平台 / 企业官网 / 行业报告 / 政策文件 / 学术论文
   * （与首页 Hero「五大信源」data-source-type 一一对应，串联第一~二屏）
   * ============================================================ */
  /* 五大信源 ID 与第一屏 HERO_SOURCES 的 data-source-type 一一对应。
   * name 只用「五大分类」本身，不特指具体平台；
   * sites（具体站点）只出现在发现日志 / 抽屉里（用户要求：细节在日志里面说）。 */
  var DISCO_SOURCES = [
    { id: 'boss', name: '招聘平台', type: '招聘平台', mark: '招', color: '#A88B4E',
      desc: '实时岗位与用人需求', sites: 'BOSS 直聘 · Remotive 远程职位' },
    { id: 'co',   name: '企业官网', type: '企业官网', mark: '企', color: '#3D8B7A',
      desc: '企业动向与团队扩张', sites: 'GitHub 开源 · GitHub 趋势 · Hacker News' },
    { id: 'rpt',  name: '行业报告', type: '行业报告', mark: '研', color: '#4A7C9B',
      desc: '行业趋势与薪资供需', sites: '少数派 · IT之家 · 百度热搜 · 头条热榜' },
    { id: 'gov',  name: '政策文件', type: '政策文件', mark: '政', color: '#8B7340',
      desc: '就业与人才产业政策', sites: '中国政府网 · 新华网时政' },
    { id: 'csdn', name: '学术论文', type: '学术论文', mark: '学', color: '#6B7FA8',
      desc: '前沿研究与方向指引', sites: 'CSDN 技术社区 · 掘金' }
  ];

  /* 模拟发现的新资讯（点击"开始发现"后注入前 3 个槽位） */
  var DISCO_NEW_BATCH = [
    { title: 'AI 智能体工程师·字节跳动 · 30-60K', summary: '负责智能体 Agent 架构设计与多模态接入，要求 LLM 调优、RAG 与工具调用经验。', source: 'BOSS直聘', sourceType: '招聘平台', category: '岗位变化', date: '刚刚发现', isNew: true },
    { title: '人社部发布新职业目录：新增 AI 训练师、提示词工程师', summary: '人社部 19 个新职业中包含两个 AI 相关岗位，预计带动 30-80 万就业。', source: '人社部', sourceType: '政策文件', category: '政策资讯', date: '刚刚发现', isNew: true },
    { title: '2026 智能体人才市场月报 · 6 月', summary: 'AI 人才需求同比增 12 倍，算法工程师薪资中位 45K，Agent 相关岗位占比 38%。', source: '智联研究院', sourceType: '行业报告', category: '行业趋势', date: '刚刚发现', isNew: true }
  ];

  /* 历史发现记录（启动时载入 + 每次发现后追加） */
  var DISCO_HISTORY = [
    { date: '2026.08.31', time: '20:30:15', total: 142, duration: 31, status: '已完成' },
    { date: '2026.08.31', time: '19:30:12', total: 156, duration: 29, status: '已完成' },
    { date: '2026.08.31', time: '18:30:08', total: 134, duration: 32, status: '已完成' },
    { date: '2026.08.31', time: '17:30:01', total: 161, duration: 27, status: '已完成' },
    { date: '2026.08.31', time: '16:30:18', total: 128, duration: 35, status: '已完成' }
  ];

  /* ============================================================
   * Discovery Service —— 真实后端爬虫接入（可回退 Mock）
   * 前端调用本地后端 GET /api/discovery/run 进行真实多源采集；
   * 若后端未启动/不可达，自动回退到内置 Mock，保证页面始终可用。
   * ============================================================ */
  function getDiscoveryApiBase() {
    try {
      // 页面由 node 静态服务器提供（默认 8090），后端默认 5000，同主机不同端口
      return window.location.protocol + '//' + window.location.hostname + ':5000';
    } catch (e) {
      return 'http://127.0.0.1:5000';
    }
  }
  var DISCOVERY_API_BASE = getDiscoveryApiBase();

  function fetchDiscovery() {
    return new Promise(function (resolve, reject) {
      // 加时间戳防浏览器/代理缓存，确保每次点击都拉取最新一批
      var url = DISCOVERY_API_BASE + '/api/discovery/run?_=' + Date.now();
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      xhr.setRequestHeader('Pragma', 'no-cache');
      xhr.timeout = 30000;
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve((JSON.parse(xhr.responseText) || {}).data); }
          catch (e) { reject(e); }
        } else { reject(new Error('http ' + xhr.status)); }
      };
      xhr.onerror = function () { reject(new Error('network')); };
      xhr.ontimeout = function () { reject(new Error('timeout')); };
      xhr.send();
    });
  }

  // 内置 Mock 回退（后端不可达时使用，行为与原版一致）
  function mockRun(onEvent) {
    var seq = [
      { type: 'start',   t: 0,    payload: {} },
      { type: 'connect', t: 200,  payload: { sourceId: 'boss' } },
      { type: 'fetched', t: 700,  payload: { sourceId: 'boss', count: 42 } },
      { type: 'connect', t: 950,  payload: { sourceId: 'csdn' } },
      { type: 'fetched', t: 1400, payload: { sourceId: 'csdn', count: 18 } },
      { type: 'connect', t: 1700, payload: { sourceId: 'co' } },
      { type: 'fetched', t: 2200, payload: { sourceId: 'co', count: 27 } },
      { type: 'connect', t: 2500, payload: { sourceId: 'gov' } },
      { type: 'fetched', t: 2900, payload: { sourceId: 'gov', count: 12 } },
      { type: 'connect', t: 3200, payload: { sourceId: 'rpt' } },
      { type: 'fetched', t: 3700, payload: { sourceId: 'rpt', count: 21 } },
      { type: 'complete',t: 4100, payload: { total: 120, duration: 28, items: null, stats: null, sources: null } }
    ];
    var timers = [];
    seq.forEach(function (e) {
      timers.push(setTimeout(function () { onEvent(e); }, e.t));
    });
    return function cancel() { timers.forEach(clearTimeout); };
  }

  function mapRealItem(it) {
    return {
      title: it.title || '',
      summary: it.summary || '',
      source: it.source_name || '',
      sourceType: it.source_type || '',
      date: '刚刚发现',
      url: it.url || '',
      isNew: true
    };
  }

  /* 真实发现结果的一行：外链到源站原文 */
  function discoveryRowHtml(it, idx) {
    var host = '';
    try { host = new URL(it.url || '').hostname; } catch (e) {}
    var isLink = !!it.url;
    var open = isLink
      ? '<a class="jn-news-row jn-news-row--ext jn-disc-row" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">'
      : '<div class="jn-news-row jn-disc-row">';
    var close = isLink ? '</a>' : '</div>';
    var fav = host ? '<img class="jn-news-favicon" src="https://api.iowen.cn/favicon/' + esc(host) + '.png" alt="" loading="lazy" onerror="this.remove()">' : '';
    var meta = fav +
      '<span class="jn-disc-source-type">' + esc(it.sourceType || '') + '</span>' +
      '<span class="jn-news-source">' + esc(it.source || '') + '</span>' +
      (host ? '<span class="jn-news-ext"><span class="jn-news-host">' + esc(host) + '</span><span class="jn-news-goto">↗ 在源站查看原文</span></span>' : '');
    return open +
      (idx != null ? '<span class="jn-news-rank">' + (idx < 10 ? '0' + idx : idx) + '</span>' : '') +
      '<div class="jn-news-body">' +
        '<span class="jn-disc-cat">' + esc(it.sourceType || '实时') + '</span>' +
        '<h3 class="jn-news-title">' + esc(it.title || '(无标题)') + '</h3>' +
        (it.summary ? '<p class="jn-news-summary">' + esc(it.summary) + '</p>' : '') +
        '<div class="jn-news-meta">' + meta + '</div>' +
      '</div>' + close;
  }

  /* 第二屏：把真实发现结果渲染为完整列表（点首页信源后直达对应平台实时结果）
   * 用户要求：扫描发现后页面只展示 6 条，不要太多 —— 这里统一截断到 DISCO_MAX_ROWS。 */
  var DISCO_MAX_ROWS = 6;

  function renderDiscoveryGrid(items, catLabel, catEmpty, srcs) {
    var grid = document.getElementById('home-disc-grid');
    if (!grid) return;
    var total = items.length;
    var shown = items.slice(0, DISCO_MAX_ROWS);
    var banner = '';
    if (catLabel) {
      var srcLine = '';
      if (srcs && srcs.length) {
        var rel = srcs.filter(function (s) { return s.type === catLabel; });
        if (rel.length) {
          srcLine = rel.map(function (s) {
            var st = s.status === 'ok' ? ('✓ ' + s.count + ' 条')
              : (s.status === 'blocked' ? '反爬限制' : '暂不可达');
            return esc(s.name) + '（' + st + '）';
          }).join(' · ');
        }
      }
      /* 只展示 6 条：总数多于 6 时明确告知「已精选 x / 共 y 条」 */
      var countText = (total > shown.length)
        ? ('已精选 ' + shown.length + ' 条 / 共 ' + total + ' 条')
        : ('已采集 ' + shown.length + ' 条');
      banner = '<div class="jn-disc-context">' +
        '<span class="jn-disc-context-dot"></span>' +
        '<div class="jn-disc-context-body">' +
          '<div class="jn-disc-context-title">实时发现 · ' + esc(catLabel) + '</div>' +
          '<div class="jn-disc-context-sub">' + countText + ' · ' + (srcLine || '实时抓取') + '</div>' +
        '</div>' +
        '<a class="jn-disc-context-reset" href="javascript:void(0)" id="home-disc-reset-cat">查看全部信源 ↺</a>' +
      '</div>';
    }
    if (!shown.length) {
      grid.innerHTML = banner + '<div class="jn-state jn-state--compact">本轮没有抓到该信源的实时资讯，稍后再试，或点「开始发现」查看全部信源。</div>';
      return;
    }
    var more = (total > shown.length)
      ? '<div class="jn-disc-more">本轮共 ' + total + ' 条，展示前 ' + shown.length + ' 条 · 点「再次发现」换一批</div>'
      : '';
    grid.innerHTML = banner + shown.map(function (it, i) { return discoveryRowHtml(it, i + 1); }).join('') + more;
  }

  var DiscoveryService = {
    run: function (onEvent) {
      var timers = [];
      var cancelled = false;
      var extraCancel = null;
      var cleanup = function () { cancelled = true; timers.forEach(clearTimeout); if (extraCancel) extraCancel(); };

      // 1) 立即开始 + 依次点亮各数据源（视觉扫描）
      onEvent({ type: 'start', payload: {} });
      var seq = ['boss', 'csdn', 'co', 'gov', 'rpt'];
      seq.forEach(function (id, i) {
        timers.push(setTimeout(function () {
          if (!cancelled) onEvent({ type: 'connect', payload: { sourceId: id } });
        }, 150 + i * 180));
      });

      // 2) 真实抓取后端
      fetchDiscovery().then(function (data) {
        if (cancelled) return;
        var sources = (data && data.sources) || [];
        // 按分类聚合（一个 chip 可能对应多个真实爬虫）
        var typeOf = {}; DISCO_SOURCES.forEach(function (s) { typeOf[s.id] = s.type; });
        var typeCount = {}; var typeOk = {};
        sources.forEach(function (s) {
          typeCount[s.type] = (typeCount[s.type] || 0) + (s.count || 0);
          if (s.status === 'ok') typeOk[s.type] = true;
        });
        // 逐个 chip 汇报真实结果
        seq.forEach(function (id, i) {
          timers.push(setTimeout(function () {
            if (cancelled) return;
            var stype = typeOf[id];
            var cnt = typeCount[stype] || 0;
            var ok = !!typeOk[stype];
            onEvent({
              type: 'fetched',
              payload: { sourceId: id, count: cnt, status: ok ? 'ok' : 'blocked', type: stype }
            });
          }, 1200 + i * 260));
        });
        // 完成
        timers.push(setTimeout(function () {
          if (cancelled) return;
          onEvent({
            type: 'complete',
            payload: {
              total: data.stats ? data.stats.new : (data.items ? data.items.length : 0),
              duration: data.stats ? parseInt((data.stats.duration || '0:0').split(':')[1] || '0', 10) : 0,
              items: data.items || [],
              stats: data.stats || null,
              sources: sources
            }
          });
        }, 1200 + seq.length * 260 + 250));
      }).catch(function () {
        if (cancelled) return;
        // 后端不可达 → 回退 Mock，保证页面始终可用
        extraCancel = mockRun(onEvent);
      });

      return function cancel() { cleanup(); };
    }
  };

  /* ============================================================
   * 首页发现交互：状态栏 + 资讯更新 + 日志抽屉
   * ============================================================ */
  (function initHomeDiscovery() {
    var startedAt = null;
    var elapsedTimer = null;
    var cancelRun = null;
    var sourceCounts = {}; // { boss: 42, csdn: 18, ... }
    var totalDiscovered = 0;
    var lastRunSummary = null;
    var currentCategory = null; // 由第一屏「五大信源」点击传入，用于过滤对应 source_type
    var discoveryCategoryActive = false; // 是否正处于「单信源实时发现」视图（隐藏新闻筛选 tab）

    function pad(n) { return String(n).padStart(2, '0'); }
    function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }

    /* —— 状态栏更新 —— */
    function setBarTitle(text, kind) {
      var el = document.getElementById('home-disc-bar-title');
      if (el) {
        el.textContent = text;
        el.parentElement.parentElement.classList.toggle('is-running', kind === 'running');
      }
    }
    function setBarCount(n) {
      var el = document.getElementById('home-disc-bar-count');
      if (el) el.textContent = String(n);
    }
    function setBarEta(seconds) {
      var el = document.getElementById('home-disc-bar-eta');
      if (el) el.textContent = pad(Math.floor(seconds / 60)) + ':' + pad(seconds % 60);
    }
    function setChipState(sourceId, state, count) {
      var li = document.querySelector('#home-disc-chips .jn-disc-chip[data-source="' + sourceId + '"]');
      if (!li) return;
      li.classList.remove('is-pending', 'is-running', 'is-done', 'is-blocked');
      li.classList.add('is-' + state);
      if (typeof count !== 'undefined') {
        var badge = li.querySelector('.jn-disc-chip-pulse');
        if (badge) badge.textContent = (count > 0) ? count : (state === 'blocked' ? '—' : '');
      }
      if (state === 'blocked') li.title = '真实反爬限制 / 暂不可达，本轮未采集到数据';
      else li.removeAttribute('title');
    }
    function resetChips() {
      document.querySelectorAll('#home-disc-chips .jn-disc-chip').forEach(function(li) {
        li.classList.remove('is-running', 'is-done');
        li.classList.add('is-pending');
        var badge = li.querySelector('.jn-disc-chip-pulse');
        if (badge) badge.textContent = '';
      });
    }

    /* —— 资讯更新（前 3 卡 淡出→更新→淡入 + 扫描线）—— */
    function startScanLine() {
      var grid = document.getElementById('home-disc-grid');
      if (!grid) return;
      var line = grid.querySelector('.jn-disc-scanline');
      if (!line) {
        line = document.createElement('div');
        line.className = 'jn-disc-scanline';
        grid.insertBefore(line, grid.firstChild);
      }
      line.classList.add('is-scanning');
    }
    function stopScanLine() {
      var line = document.querySelector('#home-disc-grid .jn-disc-scanline');
      if (line) line.classList.remove('is-scanning');
    }

    function refreshNewsWithNew(newsData) {
      var grid = document.getElementById('home-disc-grid');
      if (!grid) return;
      var cards = grid.querySelectorAll('.jn-news-row, [class*="jn-news"]');
      if (cards.length < 3) return;
      /* 前 N 张卡淡出（真实数据多时更新更多，至少 3 张） */
      var n = Math.min(cards.length, Math.max(3, newsData.length));
      var toUpdate = [];
      for (var i = 0; i < n && i < newsData.length; i++) {
        cards[i].classList.add('jn-disc-fade-out');
        toUpdate.push({ card: cards[i], item: newsData[i] });
      }
      /* 800ms 后更新内容并淡入 */
      setTimeout(function() {
        toUpdate.forEach(function(pair) {
          updateCardContent(pair.card, pair.item);
          pair.card.classList.remove('jn-disc-fade-out');
          pair.card.classList.add('jn-disc-fade-in', 'jn-disc-news-new');
          injectNewBadge(pair.card, pair.item);
        });
      }, 800);
    }

    function updateCardContent(card, item) {
      if (!card) return;
      /* 更新标题 */
      var titleEl = card.querySelector('.jn-news-title, .jn-news-row-title, h3, h4');
      if (titleEl) titleEl.textContent = item.title;
      /* 更新摘要 */
      var sumEl = card.querySelector('.jn-news-summary, .jn-news-row-summary, p');
      if (sumEl) sumEl.textContent = item.summary || '';
      /* 更新来源 */
      var srcEl = card.querySelector('.jn-news-source, .jn-news-row-source');
      if (srcEl) srcEl.textContent = item.source || '';
      /* 更新日期为"刚刚发现" */
      var dateEl = card.querySelector('.jn-news-date, .jn-news-row-date');
      if (dateEl) dateEl.textContent = item.date || '刚刚发现';
      /* 真实来源链接：让"查看原文"指向真实页面 */
      var linkEl = card.querySelector('a');
      if (linkEl && item.url) linkEl.href = item.url;
    }

    function injectNewBadge(card, item) {
      if (!card) return;
      /* 在标题区前加 NEW 标 */
      var titleEl = card.querySelector('.jn-news-title, .jn-news-row-title, h3, h4');
      if (titleEl && !titleEl.parentElement.querySelector('.jn-disc-new-badge')) {
        var badge = document.createElement('span');
        badge.className = 'jn-disc-new-badge';
        badge.textContent = 'NEW';
        titleEl.parentElement.insertBefore(badge, titleEl);
      }
      /* 更新来源类型 */
      var meta = card.querySelector('.jn-news-meta, .jn-news-row-meta, .jn-card-meta');
      if (meta) {
        var srcEl = meta.querySelector('.jn-disc-source-type');
        if (!srcEl) {
          srcEl = document.createElement('span');
          srcEl.className = 'jn-disc-source-type';
          meta.appendChild(srcEl);
        }
        srcEl.textContent = (item.sourceType || '') + ' · ' + (item.source || '');
      }
    }

    /* —— 完成提示 toast —— */
    function showToast(text) {
      var old = document.getElementById('home-disc-toast');
      if (old) old.remove();
      var toast = document.createElement('div');
      toast.id = 'home-disc-toast';
      toast.className = 'jn-disc-toast';
      toast.innerHTML = '<span class="jn-disc-toast-check">✓</span> ' + esc(text);
      var bar = document.getElementById('home-disc-bar');
      if (bar && bar.parentNode) {
        bar.parentNode.insertBefore(toast, bar.nextSibling);
      }
      setTimeout(function() { toast.classList.add('is-show'); }, 10);
      setTimeout(function() {
        toast.classList.remove('is-show');
        setTimeout(function() { if (toast.parentNode) toast.remove(); }, 400);
      }, 4000);
    }

    /* —— 抽屉渲染 —— */
    function renderDrawer() {
      renderSourceList();
      renderLatestLog();
      renderHistory();
    }
    function renderSourceList() {
      var el = document.getElementById('home-disc-sources');
      if (!el) return;
      el.innerHTML = DISCO_SOURCES.map(function(s) {
        var count = sourceCounts[s.id] || 0;
        var state = lastRunSummary ? 'is-done' : 'is-pending';
        var stateText = lastRunSummary ? '已完成' : '待发现';
        return '<li class="jn-disc-source ' + state + '" data-source="' + s.id + '">' +
          '<span class="jn-disc-source-icon" style="background:' + s.color + '">' + s.mark + '</span>' +
          '<div class="jn-disc-source-body">' +
            '<div class="jn-disc-source-row1"><span class="jn-disc-source-name">' + esc(s.name) + '</span></div>' +
            '<div class="jn-disc-source-row2">' + esc(s.desc || s.type) + '</div>' +
            '<div class="jn-disc-source-progress"><span class="jn-disc-source-progress-fill" style="width:' + (lastRunSummary ? 100 : 0) + '%;background:' + s.color + '"></span></div>' +
          '</div>' +
          '<div class="jn-disc-source-side">' +
            (count > 0 ? '<span class="jn-disc-source-count">+' + count + '</span>' : '') +
            '<span class="jn-disc-source-status">' + stateText + '</span>' +
          '</div>' +
        '</li>';
      }).join('');
    }
    function renderLatestLog() {
      var el = document.getElementById('home-disc-log');
      if (!el) return;
      if (lastRunSummary && lastRunSummary.events) {
        el.innerHTML = lastRunSummary.events.map(function(e) {
          return '<li class="jn-disc-tl-item"><span class="jn-disc-tl-time">' + esc(e.time) + '</span><span class="jn-disc-tl-text">' + esc(e.text) + '</span></li>';
        }).join('');
      } else {
        el.innerHTML = '<li class="jn-disc-tl-empty">点击「开始发现」启动一次新的多源扫描 →</li>';
      }
    }
    function renderHistory() {
      var el = document.getElementById('home-disc-history');
      if (!el) return;
      el.innerHTML = DISCO_HISTORY.map(function(h) {
        return '<li class="jn-disc-hist-item" data-date="' + esc(h.date) + ' ' + esc(h.time) + '">' +
          '<div class="jn-disc-hist-main">' +
            '<div class="jn-disc-hist-when">' + esc(h.date) + ' ' + esc(h.time) + '</div>' +
            '<div class="jn-disc-hist-meta">发现 <b>' + h.total + '</b> 条资讯 · 耗时 ' + h.duration + 's · ' + esc(h.status) + '</div>' +
          '</div>' +
          '<span class="jn-disc-hist-arrow">›</span>' +
        '</li>';
      }).join('');
    }
    function setSummaryState(stateText, color) {
      var el = document.getElementById('home-disc-state');
      if (el) {
        el.innerHTML = '<span class="jn-disc-dot" style="background:' + (color || '#5C7A5A') + '"></span>' + esc(stateText);
      }
    }
    function setSummaryTime(startStr, elapsed) {
      var s = document.getElementById('home-disc-start');
      if (s) s.textContent = startStr || '—';
      var e = document.getElementById('home-disc-elapsed');
      if (e) e.textContent = elapsed || '—';
    }
    function setSummaryTotals(total, duration) {
      var t = document.getElementById('home-disc-total');
      if (t) t.textContent = total || 0;
      var d = document.getElementById('home-disc-duration');
      if (d) d.textContent = duration || '00:00';
    }
    /* 6 格汇总统计：数据源 / 扫描页面 / 原始数据 / 有效资讯 / 新增资讯 / 耗时 */
    function applyRealStats(stats) {
      if (!stats) return;
      var map = {
        'home-disc-sources-count': stats.sources,
        'home-disc-pages': stats.pages,
        'home-disc-raw': stats.raw,
        'home-disc-valid': stats.valid,
        'home-disc-total': stats.new,
        'home-disc-duration': stats.duration
      };
      Object.keys(map).forEach(function (id) {
        var el = document.getElementById(id);
        if (el && map[id] !== undefined && map[id] !== null) el.textContent = map[id];
      });
    }

    /* —— 抽屉开关 —— */
    function openDrawer() {
      var overlay = document.getElementById('home-disc-overlay');
      var drawer = document.getElementById('home-disc-drawer');
      if (!overlay || !drawer) return;
      overlay.classList.add('is-open');
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('jn-disc-locked');
      renderDrawer();
    }
    function closeDrawer() {
      var overlay = document.getElementById('home-disc-overlay');
      var drawer = document.getElementById('home-disc-drawer');
      if (overlay) overlay.classList.remove('is-open');
      if (drawer) {
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
      }
      document.body.classList.remove('jn-disc-locked');
    }

    /* —— Tabs —— */
    function bindTabs() {
      var tabs = document.querySelectorAll('.jn-disc-tab');
      var panels = document.querySelectorAll('.jn-disc-panel');
      tabs.forEach(function(t) {
        t.addEventListener('click', function() {
          var key = t.getAttribute('data-tab');
          tabs.forEach(function(x) { x.classList.toggle('is-active', x === t); x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
          panels.forEach(function(p) { p.classList.toggle('is-active', p.getAttribute('data-panel') === key); });
        });
      });
    }

    /* —— 启动一次发现（category 可选：第一屏信源点击时传入 source_type）—— */
    function startDiscovery(category) {
      var btn = document.getElementById('home-disc-trigger');
      var btnText = document.getElementById('home-disc-trigger-text');
      if (btn && btn.classList.contains('is-running')) return;
      currentCategory = category || null;
      startedAt = new Date();
      sourceCounts = {};
      totalDiscovered = 0;
      lastRunSummary = { events: [] };
      if (btn) btn.classList.add('is-running');
      if (btnText) btnText.textContent = '正在发现…';
      resetChips();
      setBarTitle(currentCategory ? ('正在发现「' + currentCategory + '」…') : '正在多源发现中…', 'running');
      setBarCount(0);
      setBarEta(0);
      setSummaryState('进行中', '#B99A5A');
      setSummaryTime(fmtTime(startedAt), '00:00');
      setSummaryTotals(0, '00:00');
      startScanLine();
      if (document.getElementById('home-disc-drawer').classList.contains('is-open')) renderDrawer();

      elapsedTimer = setInterval(function() {
        var sec = Math.floor((Date.now() - startedAt.getTime()) / 1000);
        setBarEta(Math.max(0, 30 - sec));
        setSummaryTime(fmtTime(startedAt), pad(Math.floor(sec / 60)) + ':' + pad(sec % 60));
      }, 250);

      cancelRun = DiscoveryService.run(function(e) {
        var now = new Date();
        var timeStr = fmtTime(now);
        if (e.type === 'connect') {
          setChipState(e.payload.sourceId, 'running');
          lastRunSummary.events.push({ time: timeStr, text: '连接 ' + sourceLogName(e.payload.sourceId) });
        } else if (e.type === 'fetched') {
          var blocked = (e.payload.status === 'blocked' || !e.payload.count);
          setChipState(e.payload.sourceId, blocked ? 'blocked' : 'done', e.payload.count);
          sourceCounts[e.payload.sourceId] = e.payload.count;
          totalDiscovered += e.payload.count;
          setBarCount(totalDiscovered);
          lastRunSummary.events.push({ time: timeStr, text: blocked ? (sourceLogName(e.payload.sourceId) + '：反爬限制 / 暂不可达') : ('发现 ' + e.payload.count + ' 条来自 ' + sourceLogName(e.payload.sourceId)) });
        } else if (e.type === 'complete') {
          var dur = e.payload.duration;
          var realItems = (e.payload.items && e.payload.items.length) ? e.payload.items.map(mapRealItem) : DISCO_NEW_BATCH;
          var catEmpty = false;
          /* 由第一屏信源点击进入：只展示对应 source_type 的实时发现结果 */
          if (currentCategory) {
            /* 空分类必须真的置空（展示空态），不能保留全量列表回退 */
            realItems = realItems.filter(function (it) { return it.sourceType === currentCategory; });
            catEmpty = realItems.length === 0;
          }
          var srcs = e.payload.sources || null;
          /* 抽屉：按 chip 聚合真实数量 */
          if (srcs) {
            var typeOf = {}; DISCO_SOURCES.forEach(function (s) { typeOf[s.id] = s.type; });
            var typeCount = {};
            srcs.forEach(function (s) { typeCount[s.type] = (typeCount[s.type] || 0) + (s.count || 0); });
            DISCO_SOURCES.forEach(function (s) { sourceCounts[s.id] = typeCount[typeOf[s.id]] || 0; });
          }
          lastRunSummary.events.push({ time: timeStr, text: '完成本轮 · 共 ' + e.payload.total + ' 条' });
          setBarTitle(currentCategory ? ('「' + currentCategory + '」发现完成') : '本次发现完成', 'done');
          setBarCount(currentCategory ? Math.min(realItems.length, DISCO_MAX_ROWS) : e.payload.total);
          setBarEta(0);
          setSummaryTotals(e.payload.total, pad(Math.floor(dur / 60)) + ':' + pad(dur % 60));
          setSummaryState('已完成', '#5C7A5A');
          if (btn) btn.classList.remove('is-running');
          if (btnText) btnText.textContent = '再次发现';
          stopScanLine();
          /* 第二屏：渲染真实发现结果（点信源后直达对应平台；或展示全部信源） */
          renderDiscoveryGrid(realItems, currentCategory, catEmpty, srcs);
          /* 6 格汇总统计 */
          if (e.payload.stats) applyRealStats(e.payload.stats);
          /* 完成提示：带上本批主题 / 信源分类，让「每批不同」一眼可见 */
          var topics = [];
          realItems.forEach(function (it) {
            if (it.source && topics.indexOf(it.source) < 0) topics.push(it.source);
          });
          var topicStr = topics.slice(0, 3).join(' · ');
          var toastMsg;
          if (currentCategory) {
            toastMsg = catEmpty
              ? ('本轮「' + currentCategory + '」暂无新结果 · 已展示全部 ' + e.payload.total + ' 条')
              : ('刚刚发现 ' + realItems.length + ' 条「' + currentCategory + '」实时资讯');
          } else {
            toastMsg = '刚刚更新 ' + e.payload.total + ' 条新资讯' + (topicStr ? '（' + topicStr + '）' : '');
          }
          showToast(toastMsg);
          /* 历史日志追加 */
          var newHist = { date: '2026.08.31', time: fmtTime(startedAt), total: e.payload.total, duration: dur, status: '已完成' };
          DISCO_HISTORY.unshift(newHist);
          if (elapsedTimer) clearInterval(elapsedTimer);
          if (document.getElementById('home-disc-drawer').classList.contains('is-open')) renderDrawer();
        }
        /* 日志抽屉打开时实时刷新 */
        if (document.getElementById('home-disc-drawer').classList.contains('is-open')) {
          renderLatestLog();
        }
      });
    }

    function sourceName(id) {
      var s = DISCO_SOURCES.filter(function(x) { return x.id === id; })[0];
      return s ? s.name : id;
    }

    /* 日志里才出现具体站点名（用户要求：卡片/列表只讲五大类，细节放日志） */
    function sourceLogName(id) {
      var s = DISCO_SOURCES.filter(function(x) { return x.id === id; })[0];
      if (!s) return id;
      return s.sites ? (s.name + '（' + s.sites + '）') : s.name;
    }

    /* —— 绑定（事件委托，避免时序问题）—— */
    document.addEventListener('click', function(ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      /* 第一屏「五大信源」→ 滚动到第二屏并触发对应分类的实时发现 */
      if (t.closest('.jn-hero-source-item')) {
        var sItem = t.closest('.jn-hero-source-item');
        var stype = sItem.getAttribute('data-source-type');
        var sc = document.getElementById('screen-industry');
        if (sc && sc.scrollIntoView) sc.scrollIntoView({ behavior: 'smooth' });
        if (stype) {
          discoveryCategoryActive = true;
          var lc = document.getElementById('latest-cols');
          if (lc) lc.classList.add('is-discovery-mode');
          startDiscovery(stype);
        }
        return;
      }
      /* 单信源视图 → 返回「全部信源」实时发现 */
      if (t.closest('#home-disc-reset-cat')) {
        discoveryCategoryActive = false;
        var lc2 = document.getElementById('latest-cols');
        if (lc2) lc2.classList.remove('is-discovery-mode');
        startDiscovery();
        return;
      }
      if (t.closest('#home-disc-trigger')) { startDiscovery(); return; }
      if (t.closest('#home-disc-log-btn')) { openDrawer(); return; }
      if (t.closest('#home-disc-close')) { closeDrawer(); return; }
      if (t.closest('#home-disc-overlay')) { closeDrawer(); return; }
    });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeDrawer(); });
    /* Tabs 用委托 */
    document.addEventListener('click', function(ev) {
      var tab = ev.target.closest ? ev.target.closest('.jn-disc-tab') : null;
      if (!tab) return;
      var key = tab.getAttribute('data-tab');
      document.querySelectorAll('.jn-disc-tab').forEach(function(x) {
        x.classList.toggle('is-active', x === tab);
        x.setAttribute('aria-selected', x === tab ? 'true' : 'false');
      });
      document.querySelectorAll('.jn-disc-panel').forEach(function(p) {
        p.classList.toggle('is-active', p.getAttribute('data-panel') === key);
      });
    });
    /* 初始渲染抽屉内容（不等点击）*/
    setTimeout(function() {
      if (document.getElementById('home-disc-drawer')) renderDrawer();
    }, 500);
  })();

  /* ---------- 热门排行（屏内，TOP10） ---------- */
  function renderRanking() {
    var items = D.rankingList.map(function (n, i) {
      return (
        '<li class="jn-rank-item' + (i < 3 ? ' is-top' : '') + '" data-go="' + n.id + '">' +
          '<span class="jn-rank-num">' + (i + 1) + '</span>' +
          '<span class="jn-rank-title">' + esc(n.title) + '</span>' +
          '<span class="jn-rank-read">' + JN.fmtRead(n.readCount) + '</span>' +
        '</li>'
      );
    }).join('');
    return JN.sectionHead('热门排行', '阅读热度 · TOP ' + D.rankingList.length, false) +
      '<ol class="jn-rank-list">' + items + '</ol>';
  }

  /* ---------- 搜索 / 筛选（抽屉式） ---------- */
  function isSearchActive() {
    return !!(state.search.keyword.trim() || state.search.date.trim() || state.search.sort === 'hot');
  }

  function getSearchResults() {
    var kw = state.search.keyword.trim().toLowerCase();
    var dateNorm = state.search.date.trim().replace(/-/g, '.');
    var list = D.newsList.slice();

    if (kw) {
      list = list.filter(function (n) {
        var c = D.catByKey(n.category);
        var hay = [n.title, n.summary, n.source, (n.tags || []).join(' '), c ? c.label : ''].join(' ').toLowerCase();
        return hay.indexOf(kw) !== -1;
      });
    }
    if (dateNorm) {
      list = list.filter(function (n) { return n.date === dateNorm; });
    }
    if (state.search.sort === 'hot') {
      list.sort(function (a, b) { return b.readCount - a.readCount; });
    } else {
      list.sort(function (a, b) {
        if (a.date === b.date) return b.readCount - a.readCount;
        return a.date < b.date ? 1 : -1;
      });
    }
    return list;
  }

  function renderSearchResults() {
    var list = getSearchResults();
    var resultsEl = document.getElementById('search-results');
    if (!resultsEl) return;
    var html = JN.sectionHead('搜索结果', list.length + ' 条匹配', false);
    if (list.length === 0) {
      html += '<div class="jn-state jn-state--compact">没有找到匹配的资讯，换个关键词或日期试试。</div>';
    } else {
      html += '<div class="jn-news-list">' + list.map(function (n) { return JN.newsRowHtml(n, null); }).join('') + '</div>';
    }
    resultsEl.innerHTML = html;
  }

  function clearSearchResults() {
    var el = document.getElementById('search-results');
    if (el) el.innerHTML = '';
  }

  function openSearchDrawer() {
    var d = document.getElementById('search-drawer');
    var m = document.getElementById('search-mask');
    if (d) d.classList.add('is-open');
    if (m) m.hidden = false;
  }
  function closeSearchDrawer() {
    var d = document.getElementById('search-drawer');
    var m = document.getElementById('search-mask');
    if (d) d.classList.remove('is-open');
    if (m) m.hidden = true;
  }

  function renderMain() {
    if (isSearchActive()) {
      openSearchDrawer();
      renderSearchResults();
    } else {
      closeSearchDrawer();
      clearSearchResults();
    }
  }

  function updateSearchUI() {
    var panel = document.getElementById('search-panel');
    if (!panel) return;
    panel.classList.toggle('is-active', isSearchActive());
  }

  function bindSearch() {
    var panel = document.getElementById('search-panel');
    if (!panel) return;
    var kwEl = document.getElementById('search-kw');
    var dateEl = document.getElementById('search-date');
    var goBtn = document.getElementById('search-go');
    var resetBtn = document.getElementById('search-reset');

    function syncSeg() {
      var btns = panel.querySelectorAll('[data-sort]');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('is-active', btns[i].getAttribute('data-sort') === state.search.sort);
      }
    }

    kwEl.addEventListener('input', function () {
      state.search.keyword = kwEl.value;
      renderMain();
      updateSearchUI();
    });
    dateEl.addEventListener('change', function () {
      state.search.date = dateEl.value;
      renderMain();
      updateSearchUI();
    });
    panel.addEventListener('click', function (e) {
      var seg = e.target.closest ? e.target.closest('[data-sort]') : null;
      if (seg) {
        state.search.sort = seg.getAttribute('data-sort');
        syncSeg();
        renderMain();
        updateSearchUI();
      }
    });
    goBtn.addEventListener('click', function () {
      state.search.keyword = kwEl.value;
      state.search.date = dateEl.value;
      renderMain();
      updateSearchUI();
    });
    resetBtn.addEventListener('click', function () {
      state.search.keyword = '';
      state.search.date = '';
      state.search.sort = 'date';
      kwEl.value = '';
      dateEl.value = '';
      syncSeg();
      renderMain();
      updateSearchUI();
    });
  }

  /* ---------- 延伸阅读 ---------- */
  function relatedItemHtml(r) {
    return (
      '<article class="jn-readmore-item" data-go="' + r.id + '">' +
        (r.source ? '<span class="jn-readmore-source">' + esc(r.source) + '</span>' : '') +
        '<h3 class="jn-readmore-title">' + esc(r.title) + '</h3>' +
        '<div class="jn-readmore-foot">' +
          '<span>' + esc(r.date) + '</span>' +
          '<span class="jn-readmore-read">' + JN.fmtRead(r.readCount) + '阅读</span>' +
        '</div>' +
      '</article>'
    );
  }

  function renderRelated() {
    document.getElementById('related').innerHTML =
      JN.sectionHead('延伸阅读', '换个角度，继续了解就业市场', true) +
      '<div class="jn-readmore-grid">' + D.relatedNews.map(relatedItemHtml).join('') + '</div>';
  }

  /* ---------- 分类筛选交互（行业快讯） ---------- */
  function bindFilter() {
    var root = document.getElementById('latest-cols');
    if (!root) return;
    root.addEventListener('click', function (e) {
      var tab = e.target.closest ? e.target.closest('[data-filter]') : null;
      if (!tab) return;
      state.latestCategory = tab.getAttribute('data-filter');
      document.getElementById('latest-cols').innerHTML = renderLatest();
    });
  }

  /* ---------- 进入详情 / 外链 ---------- */
  function bindNavigation() {
    document.addEventListener('click', function (e) {
      var el = e.target;
      if (!el || !el.closest) return;
      if (el.closest('[data-fav]')) return;
      /* 行业快讯 / 头版封面 / 编辑列表外链：整卡新标签打开原文 */
      var ext = el.closest('[data-url]');
      if (ext) {
        e.preventDefault();
        window.open(ext.getAttribute('data-url'), '_blank', 'noopener');
        return;
      }
      if (el.closest('[data-more]')) {
        JN.toast('更多资讯即将上线', 'info');
        return;
      }
      var go = el.closest('[data-go]');
      if (!go) return;
      location.href = 'detail.html?id=' + encodeURIComponent(go.getAttribute('data-go'));
    });
  }

  /* ---------- 启动 ---------- */
  function renderAll() {
    renderModuleHead();
    renderFocus();
    document.getElementById('hot-cols').innerHTML = renderHot();
    document.getElementById('latest-cols').innerHTML = renderLatest();
    document.getElementById('rank-cols').innerHTML = renderRanking();
    renderRelated();
    initDots();
  }

  /* ---------- 全屏滚动：右侧导航圆点 ---------- */
  function initDots() {
    var fp = document.getElementById('jn-fullpage');
    var dotsEl = document.getElementById('jn-dots');
    if (!fp || !dotsEl) return;
    var screens = Array.prototype.slice.call(fp.querySelectorAll('.jn-screen'));
    dotsEl.innerHTML = screens.map(function (s, i) {
      var label = s.getAttribute('data-label') || ('0' + (i + 1));
      return '<button type="button" class="jn-dot' + (i === 0 ? ' is-active' : '') + '" data-i="' + i + '" aria-label="跳转到' + label + '">' +
        '<span class="jn-dot-label">' + esc(label) + '</span></button>';
    }).join('');

    dotsEl.addEventListener('click', function (e) {
      var d = e.target.closest ? e.target.closest('.jn-dot') : null;
      if (!d) return;
      var i = parseInt(d.getAttribute('data-i'), 10);
      if (screens[i]) screens[i].scrollIntoView({ behavior: 'smooth' });
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var i = screens.indexOf(en.target);
            if (i < 0) return;
            var dots = dotsEl.querySelectorAll('.jn-dot');
            for (var k = 0; k < dots.length; k++) dots[k].classList.toggle('is-active', k === i);
          }
        });
      }, { root: fp, threshold: 0.55 });
      screens.forEach(function (s) { io.observe(s); });
    }
  }

  /* ---------- 全屏滚动：键盘上下翻屏 ---------- */
  function bindKeyboard() {
    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (document.getElementById('search-drawer') && document.getElementById('search-drawer').classList.contains('is-open')) return;
      var fp = document.getElementById('jn-fullpage');
      if (!fp) return;
      var screens = Array.prototype.slice.call(fp.querySelectorAll('.jn-screen'));
      var cur = 0;
      for (var i = 0; i < screens.length; i++) {
        var r = screens[i].getBoundingClientRect();
        if (r.top <= 2 && r.bottom > 2) { cur = i; break; }
      }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        if (cur < screens.length - 1) { screens[cur + 1].scrollIntoView({ behavior: 'smooth' }); e.preventDefault(); }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        if (cur > 0) { screens[cur - 1].scrollIntoView({ behavior: 'smooth' }); e.preventDefault(); }
      } else if (e.key === 'Home') {
        screens[0].scrollIntoView({ behavior: 'smooth' }); e.preventDefault();
      } else if (e.key === 'End') {
        screens[screens.length - 1].scrollIntoView({ behavior: 'smooth' }); e.preventDefault();
      }
    });
  }

  /* ---------- 搜索抽屉开合 ---------- */
  function bindSearchDrawer() {
    var toggle = document.getElementById('search-toggle');
    var close = document.getElementById('search-close');
    var mask = document.getElementById('search-mask');
    if (toggle) toggle.addEventListener('click', function () {
      if (isSearchActive()) {
        renderSearchResults();
      } else {
        var el = document.getElementById('search-results');
        if (el) el.innerHTML = JN.sectionHead('全部资讯', D.newsList.length + ' 条', false) +
          '<div class="jn-news-list">' + D.newsList.map(function (n) { return JN.newsRowHtml(n, null); }).join('') + '</div>';
      }
      openSearchDrawer();
    });
    if (close) close.addEventListener('click', closeSearchDrawer);
    if (mask) mask.addEventListener('click', closeSearchDrawer);
  }

  function init() {
    bindFilter();
    bindSearch();
    bindSearchDrawer();
    bindKeyboard();
    bindNavigation();

    setTimeout(function () {
      var loading = document.getElementById('app-loading');
      var app = document.getElementById('app');
      if (loading) loading.style.display = 'none';
      if (app) app.hidden = false;
      renderAll();
    }, 380);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();