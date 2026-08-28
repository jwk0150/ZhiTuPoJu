/* Discovery job detail — unified black-gold board */
(function () {
  let trendChart = null;
  let graphChart = null;
  let graphSourceCache = [];
  let fcProbChart = null;
  let fcSupplyChart = null;
  let currentJob = null;
  let activeMod = 'overview';
  const dutyLanes = {
    fc: { timer: null, expanded: false, slideIndex: 0, rowHeight: 32, visibleRows: 3, data: { duties: [], scores: [] } },
    found: { timer: null, expanded: false, slideIndex: 0, rowHeight: 32, visibleRows: 3, data: { duties: [], scores: [] } }
  };

  const FOUND_MODS = [
    { id: 'overview', n: '01', label: '画像概览', hint: '基本信息与读法' },
    { id: 'skills', n: '02', label: '核心能力', hint: 'TOP 10 热度分层' },
    { id: 'duties', n: '03', label: '典型职责', hint: '日常工作画像' },
    { id: 'radar', n: '04', label: '能力对照', hint: '本岗 vs 行业' },
    { id: 'graph', n: '05', label: '来源路径', hint: '从哪些岗走来' },
    { id: 'trend', n: '06', label: '需求趋势', hint: '发布与搜索热度' },
    { id: 'supply', n: '07', label: '人才供需', hint: '缺口与竞争态势' }
  ];

  const FORECAST_MODS = [
    { id: 'overview', n: '01', label: '预测概览', hint: '窗口与基本画像' },
    { id: 'skills', n: '02', label: '核心能力', hint: '提前布局清单' },
    { id: 'duties', n: '03', label: '预测职责', hint: '可能的工作形态' },
    { id: 'evolve', n: '04', label: '能力演化', hint: '从已有岗长出来' },
    { id: 'prob', n: '05', label: '出现概率', hint: '窗口抬升轨迹' },
    { id: 'industry', n: '06', label: '行业落点', hint: '需求可能在哪' },
    { id: 'supply', n: '07', label: '供需趋势', hint: '需求与供给预测' },
    { id: 'risk', n: '08', label: '不确定性', hint: '观测与风险说明' }
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function qs(name) {
    try {
      return new URLSearchParams(location.search).get(name);
    } catch (_) {
      return null;
    }
  }

  function setModQuery(modId) {
    try {
      const u = new URL(location.href);
      u.searchParams.set('mod', modId);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (_) {}
  }

  function validMod(isForecast, modId) {
    const list = isForecast ? FORECAST_MODS : FOUND_MODS;
    return list.some((m) => m.id === modId) ? modId : 'overview';
  }

  function buildModRail(isForecast) {
    const railId = isForecast ? 'dd-fc-rail' : 'dd-found-rail';
    const rail = document.getElementById(railId);
    if (!rail) return;
    const mods = isForecast ? FORECAST_MODS : FOUND_MODS;
    const idx = Math.max(0, mods.findIndex((m) => m.id === activeMod));
    const cur = mods[idx] || mods[0];
    const job = currentJob || {};
    const snapHeat = job.conf != null ? String(job.conf) : '—';
    const snapSample =
      job.sampleCount != null ? Number(job.sampleCount).toLocaleString('zh-CN') : '—';
    const snapCity = job.city || job.locationDisplay || '多城';
    rail.innerHTML =
      '<p class="dd-mod-rail-kicker">' +
      (isForecast ? '预测分析模块' : '发现分析模块') +
      '</p>' +
      '<div class="dd-mod-rail-list" role="tablist">' +
      mods
        .map(
          (m, i) =>
            '<button type="button" class="dd-mod-btn' +
            (m.id === activeMod ? ' is-active' : '') +
            (i < idx ? ' is-done' : '') +
            '" data-mod="' +
            m.id +
            '" role="tab" aria-selected="' +
            (m.id === activeMod ? 'true' : 'false') +
            '">' +
            '<span class="n">' +
            m.n +
            '</span>' +
            '<span class="lab"><strong>' +
            esc(m.label) +
            '</strong><em>' +
            esc(m.hint) +
            '</em></span>' +
            '<span class="dd-mod-btn-state">' +
            (m.id === activeMod ? '当前' : i < idx ? '已读' : '待读') +
            '</span>' +
            '</button>'
        )
        .join('') +
      '</div>' +
      '<div class="dd-mod-rail-foot" aria-live="polite">' +
      '<div class="dd-mod-rail-progress">' +
      '<span class="dd-mod-rail-progress-lab">阅读进度</span>' +
      '<strong data-rail-progress>' +
      String(idx + 1).padStart(2, '0') +
      ' / ' +
      String(mods.length).padStart(2, '0') +
      '</strong>' +
      '<div class="dd-mod-rail-progress-track" aria-hidden="true"><i style="width:' +
      Math.round(((idx + 1) / mods.length) * 100) +
      '%"></i></div></div>' +
      '<p class="dd-mod-rail-tip" data-rail-tip><em>当前</em> ' +
      esc(cur.label) +
      ' · ' +
      esc(cur.hint) +
      '</p>' +
      '<div class="dd-mod-rail-snap">' +
      '<div><em>热度</em><strong>' +
      esc(snapHeat) +
      '</strong></div>' +
      '<div><em>样本</em><strong>' +
      esc(snapSample) +
      '</strong></div>' +
      '<div><em>城市</em><strong>' +
      esc(String(snapCity).slice(0, 6)) +
      '</strong></div>' +
      '</div>' +
      '<ul class="dd-mod-rail-checklist">' +
      '<li>按 01→' +
      mods[mods.length - 1].n +
      ' 顺序读更稳</li>' +
      '<li>右栏行动清单勾 1–2 件本周可做</li>' +
      '<li>三列同高，底部进度会跟着走</li>' +
      '<li>切换模块后，先扫右栏再看中间主图</li>' +
      '</ul>' +
      '</div>';
    rail.querySelectorAll('.dd-mod-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchMod(btn.getAttribute('data-mod')));
    });
  }

  function syncRailFoot(isForecast, modId) {
    const rail = document.getElementById(isForecast ? 'dd-fc-rail' : 'dd-found-rail');
    if (!rail) return;
    const mods = isForecast ? FORECAST_MODS : FOUND_MODS;
    const idx = Math.max(0, mods.findIndex((m) => m.id === modId));
    const cur = mods[idx] || mods[0];
    const prog = rail.querySelector('[data-rail-progress]');
    const tip = rail.querySelector('[data-rail-tip]');
    const bar = rail.querySelector('.dd-mod-rail-progress-track > i');
    if (prog) {
      prog.textContent =
        String(idx + 1).padStart(2, '0') + ' / ' + String(mods.length).padStart(2, '0');
    }
    if (tip) {
      tip.innerHTML = '<em>当前</em> ' + esc(cur.label) + ' · ' + esc(cur.hint);
    }
    if (bar) bar.style.width = Math.round(((idx + 1) / mods.length) * 100) + '%';
    rail.querySelectorAll('.dd-mod-btn').forEach((btn) => {
      const id = btn.getAttribute('data-mod');
      const i = mods.findIndex((m) => m.id === id);
      const on = id === modId;
      btn.classList.toggle('is-active', on);
      btn.classList.toggle('is-done', i >= 0 && i < idx);
      const st = btn.querySelector('.dd-mod-btn-state');
      if (st) st.textContent = on ? '当前' : i < idx ? '已读' : '待读';
    });
  }

  function ensureInsightColumn(isForecast) {
    const layout = document.getElementById(isForecast ? 'dd-fc-mod-layout' : 'dd-found-mod-layout');
    const stage = document.getElementById(isForecast ? 'dd-fc-board' : 'dd-found-board');
    if (!layout || !stage) return null;
    let col = layout.querySelector('.dd-mod-insight-col');
    if (!col) {
      col = document.createElement('div');
      col.className = 'dd-mod-insight-col';
      col.id = isForecast ? 'dd-fc-insight-col' : 'dd-found-insight-col';
      col.setAttribute('aria-label', '模块解读');
      layout.appendChild(col);
    }
    stage.querySelectorAll('.dd-mod-insight').forEach((aside) => {
      const panel = aside.closest('[data-mod]');
      if (panel) aside.setAttribute('data-mod', panel.getAttribute('data-mod'));
      if (aside.parentElement !== col) col.appendChild(aside);
    });
    return col;
  }

  function switchMod(modId, opts) {
    if (!currentJob) return;
    const isForecast = !!currentJob.isForecast;
    const next = validMod(isForecast, modId || 'overview');
    activeMod = next;
    if (!opts || opts.syncUrl !== false) setModQuery(next);

    const stageId = isForecast ? 'dd-fc-board' : 'dd-found-board';
    const stage = document.getElementById(stageId);
    if (stage) {
      stage.querySelectorAll('[data-mod]').forEach((panel) => {
        const on = panel.getAttribute('data-mod') === next;
        panel.classList.toggle('is-mod-active', on);
        panel.hidden = !on;
      });
    }

    const col = document.getElementById(isForecast ? 'dd-fc-insight-col' : 'dd-found-insight-col');
    if (col) {
      col.querySelectorAll('.dd-mod-insight').forEach((aside) => {
        const on = aside.getAttribute('data-mod') === next;
        aside.hidden = !on;
        aside.classList.toggle('is-mod-active', on);
      });
    }

    const railId = isForecast ? 'dd-fc-rail' : 'dd-found-rail';
    const rail = document.getElementById(railId);
    if (rail) {
      rail.querySelectorAll('.dd-mod-btn').forEach((btn) => {
        const on = btn.getAttribute('data-mod') === next;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      syncRailFoot(isForecast, next);
    }

    requestAnimationFrame(() => {
      if (isForecast) {
        layoutFcRow();
        resizeFcCharts();
        if (next === 'skills') {
          renderSkillConstellation('dd-fc-skills', currentJob);
          animateSkillConstellation('dd-fc-skills');
        }
        if (next === 'duties') {
          if (document.querySelector('#dd-fc-board.dd-mod-stage')) renderModularDutiesList('fc');
          else startDutyCarousel('fc');
        }
        if (next === 'evolve') renderFcSankey();
        if (next === 'prob') renderFcProb();
        if (next === 'industry') renderFcIndustry();
        if (next === 'supply') renderFcSupply();
      } else {
        layoutFoundRow();
        resizeFoundCharts();
        if (next === 'skills') {
          renderFoundSkills(currentJob);
          animateSkillConstellation('dd-found-skills');
        }
        if (next === 'duties') {
          if (document.querySelector('#dd-found-board.dd-mod-stage')) renderModularDutiesList('found');
          else startDutyCarousel('found');
        }
        if (next === 'radar') renderFoundRadar();
        if (next === 'graph') renderFoundGraph();
        if (next === 'trend') renderFoundTrend();
        if (next === 'supply') renderFoundSupply(currentJob);
      }
      runModEnterMotion(isForecast);
    });
  }

  function runModEnterMotion(isForecast) {
    if (!window.gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const stage = document.getElementById(isForecast ? 'dd-fc-board' : 'dd-found-board');
    const panel = stage && stage.querySelector('.is-mod-active');
    if (!panel) return;
    try {
      window.gsap.fromTo(
        panel,
        { opacity: 0.35, y: 12 },
        { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', clearProps: 'opacity,transform' }
      );
    } catch (_) {}
  }

  function fillInsight(id, title, body, bullets, extra) {
    const el = document.getElementById(id);
    if (!el) return;
    extra = extra || {};
    const signals = extra.signals || [];
    const checks = extra.checks || [];
    const next = extra.next || null;
    const deeper = extra.deeper || [];
    const reads =
      extra.reads && extra.reads.length
        ? extra.reads
        : [
            '先扫顶部信号，判断本模块重心',
            '再读要点与行动清单，勾 1–2 件本周可做',
            '深读卡片用来核对有没有漏读关键信号'
          ];
    const signalHtml =
      signals.length ?
        '<div class="dd-insight-signals">' +
        signals
          .map(
            (s) =>
              '<div class="dd-insight-sig' +
              (s.tone ? ' ' + s.tone : '') +
              '"><em>' +
              esc(s.lab) +
              '</em><strong>' +
              esc(s.val) +
              '</strong></div>'
          )
          .join('') +
        '</div>'
      : '';
    const checkHtml =
      checks.length ?
        '<div class="dd-insight-checks"><span class="dd-insight-sec">行动清单</span><ul>' +
        checks.map((c) => '<li>' + esc(c) + '</li>').join('') +
        '</ul></div>'
      : '';
    const readHtml =
      reads.length ?
        '<div class="dd-insight-reads"><span class="dd-insight-sec">本页读法</span><ol>' +
        reads.map((r) => '<li>' + esc(r) + '</li>').join('') +
        '</ol></div>'
      : '';
    const deeperHtml =
      deeper.length ?
        '<div class="dd-insight-deeper"><span class="dd-insight-sec">深读要点</span><div class="dd-insight-deeper-grid">' +
        deeper
          .map(
            (d) =>
              '<div class="dd-insight-deep-card"><strong>' +
              esc(d.t) +
              '</strong><p>' +
              esc(d.p) +
              '</p></div>'
          )
          .join('') +
        '</div></div>'
      : '';
    const nextHtml =
      next && next.mod ?
        '<button type="button" class="dd-insight-next" data-jump="' +
        esc(next.mod) +
        '"><span>下一步</span><strong>' +
        esc(next.label || '继续阅读') +
        '</strong></button>'
      : '';
    el.innerHTML =
      '<div class="dd-insight-top">' +
      '<p class="dd-mod-insight-k">模块解读</p>' +
      '<p class="dd-mod-insight-t">' +
      esc(title) +
      '</p>' +
      '<p class="dd-mod-insight-p">' +
      esc(body) +
      '</p>' +
      signalHtml +
      (bullets && bullets.length
        ? '<ul class="dd-insight-bullets">' +
          bullets.map((b) => '<li>' + esc(b) + '</li>').join('') +
          '</ul>'
        : '') +
      readHtml +
      checkHtml +
      deeperHtml +
      '</div>' +
      '<div class="dd-insight-foot">' +
      (nextHtml || '') +
      '</div>';
    el.querySelectorAll('[data-jump]').forEach((btn) => {
      btn.addEventListener('click', () => switchMod(btn.getAttribute('data-jump')));
    });
  }

  function fillOverviewJumps(elId, mods, skipId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const jumps = mods.filter((m) => m.id !== skipId);
    let foot = el.querySelector('.dd-insight-foot');
    if (!foot) {
      foot = document.createElement('div');
      foot.className = 'dd-insight-foot';
      el.appendChild(foot);
    }
    const jumpHtml =
      '<span class="dd-insight-sec">快速进入模块</span>' +
      '<div class="dd-mod-jumps" role="list">' +
      jumps
        .map(
          (m) =>
            '<button type="button" class="dd-mod-jump dd-bubble" data-jump="' +
            m.id +
            '" role="listitem">' +
            '<span class="dd-mod-jump-n">' +
            esc(m.n) +
            '</span>' +
            '<span class="dd-mod-jump-lab">' +
            '<strong>' +
            esc(m.label) +
            '</strong>' +
            '<span>' +
            esc(m.hint) +
            '</span>' +
            '</span></button>'
        )
        .join('') +
      '</div>';
    foot.insertAdjacentHTML('beforeend', jumpHtml);
    foot.querySelectorAll('.dd-mod-jumps [data-jump]').forEach((btn) => {
      btn.addEventListener('click', () => switchMod(btn.getAttribute('data-jump')));
    });
  }

  function ensureModMain(modId, isForecast) {
    const stage = document.getElementById(isForecast ? 'dd-fc-board' : 'dd-found-board');
    const panel = stage && stage.querySelector('[data-mod="' + modId + '"]');
    if (!panel) return null;
    const body = panel.querySelector('.dd-mod-body');
    if (!body) return null;
    let main = body.querySelector('.dd-mod-main');
    if (!main) {
      const insight = body.querySelector('.dd-mod-insight');
      main = document.createElement('div');
      main.className = 'dd-mod-main';
      Array.from(body.children).forEach((ch) => {
        if (ch !== insight) main.appendChild(ch);
      });
      if (insight) body.insertBefore(main, insight);
      else body.appendChild(main);
    }
    let rich = main.querySelector('.dd-mod-rich');
    if (!rich) {
      rich = document.createElement('div');
      rich.className = 'dd-mod-rich';
      main.appendChild(rich);
    }
    return rich;
  }

  function bubbleRow(items) {
    return (
      '<div class="dd-bubble-row">' +
      items
        .map(
          (it) =>
            '<div class="dd-bubble dd-bubble-stat' +
            (it.tone ? ' ' + it.tone : '') +
            '">' +
            '<em>' +
            esc(it.lab) +
            '</em>' +
            '<strong>' +
            esc(it.val) +
            '</strong>' +
            (it.sub ? '<span>' + esc(it.sub) + '</span>' : '') +
            '</div>'
        )
        .join('') +
      '</div>'
    );
  }

  function noteCards(cards) {
    return (
      '<div class="dd-note-grid">' +
      cards
        .map(
          (c) =>
            '<article class="dd-bubble dd-note-card">' +
            '<header><em>' +
            esc(c.k) +
            '</em><strong>' +
            esc(c.t) +
            '</strong></header>' +
            '<p>' +
            esc(c.p) +
            '</p></article>'
        )
        .join('') +
      '</div>'
    );
  }

  /** Extra dense blocks so each module fills the one-screen column */
  function modFill(rows) {
    return (
      '<div class="dd-mod-fill" role="list">' +
      rows
        .map(
          (r) =>
            '<article class="dd-mod-fill-card dd-bubble" role="listitem">' +
            '<em>' +
            esc(r.k) +
            '</em>' +
            '<strong>' +
            esc(r.t) +
            '</strong>' +
            '<p>' +
            esc(r.p) +
            '</p></article>'
        )
        .join('') +
      '</div>'
    );
  }

  function appendFill(el, rows) {
    if (!el || !rows || !rows.length) return;
    el.querySelectorAll('.dd-mod-fill.is-tail').forEach((n) => n.remove());
    const html = modFill(rows).replace('class="dd-mod-fill"', 'class="dd-mod-fill is-tail"');
    el.insertAdjacentHTML('beforeend', html);
  }

  function fillTail(modId, isForecast, rows) {
    // ensureModMain 返回的是 .dd-mod-rich（order:-1 在顶部）；底部填空必须挂到 .dd-mod-main
    const rich = ensureModMain(modId, isForecast);
    if (!rich) return;
    const main = rich.closest('.dd-mod-main') || rich.parentElement;
    if (main) appendFill(main, rows);
  }

  function renderFoundModRich(job) {
    const skills = job.skillScores || [];
    const hot = skills.filter((s) => s.score >= 85).length;
    const warm = skills.filter((s) => s.score >= 72 && s.score < 85).length;
    const cool = skills.filter((s) => s.score < 72).length;
    const top3 = skills.slice(0, 3).map((s) => s.name);
    const duties = job.duties || [];
    const city = job.city || '一线/新一线';
    const sample = Number(job.sampleCount || 0).toLocaleString('zh-CN');

    const ov = ensureModMain('overview', false);
    if (ov) {
      ov.innerHTML =
        bubbleRow([
          { lab: '热度指数', val: String(job.conf || '—'), sub: '综合新兴信号', tone: 'is-gold' },
          { lab: '样本规模', val: sample, sub: '招聘文本聚类' },
          { lab: '近半年增长', val: '↑' + (job.growth || 0) + '%', sub: '发布量环比', tone: 'is-up' },
          { lab: '首次出现', val: job.firstSeen || '—', sub: '稳定进入市场' }
        ]) +
        noteCards([
          {
            k: '岗位定位',
            t: '为什么它算「新」',
            p:
              job.brief ||
              job.positioning ||
              '能力组合与职责边界已从传统岗位拆分出来，并在真实招聘中反复出现。'
          },
          {
            k: '适合谁',
            t: '迁移成本更低的人群',
            p:
              '已有 ' +
              (top3[0] || '核心能力') +
              ' / ' +
              (top3[1] || '工程能力') +
              ' 基础者，补齐编排与治理即可过渡。'
          },
          {
            k: '下一步',
            t: '建议阅读顺序',
            p: '先核核心能力与职责，再看来源路径确认迁移成本，最后用趋势/供需判断窗口。'
          }
        ]);
    }

    const sk = ensureModMain('skills', false);
    if (sk) {
      sk.innerHTML =
        bubbleRow([
          { lab: '高热门槛', val: String(hot), sub: '≥85 分', tone: 'is-hot' },
          { lab: '中腰能力', val: String(warm), sub: '72–84 分', tone: 'is-warm' },
          { lab: '可迁移项', val: String(cool), sub: '<72 分' },
          { lab: '优先补齐', val: top3[0] || '—', sub: 'TOP 1', tone: 'is-gold' }
        ]) +
        noteCards([
          {
            k: '30 天计划',
            t: '先对齐 TOP 3',
            p: top3.map((n, i) => i + 1 + '. ' + n).join(' · ') + '。用一个可演示项目串起检索、工具调用与评测。'
          },
          {
            k: '简历映射',
            t: '把热度写成成果',
            p: '每个高热能力对应 1 条可量化结果（延迟、准确率、成本或人效），避免只堆关键词。'
          },
          {
            k: '交叉验证',
            t: '去「能力对照」看差值',
            p: '若某能力热度高但相对行业领先不大，说明已是通用门槛；差值大的才是差异化筹码。'
          }
        ]);
    }

    const du = ensureModMain('duties', false);
    if (du) {
      const themes = [
        { k: '架构', t: '系统设计', p: '工作流、工具调用、知识检索与多模型协同的边界划分。' },
        { k: '落地', t: '场景推进', p: '把 Agent 能力接到真实业务，完成评审、上线与验收闭环。' },
        { k: '治理', t: '效果与安全', p: '评测、权限、成本与稳定性，决定能否规模化复制。' }
      ];
      du.innerHTML =
        bubbleRow([
          { lab: '职责条目', val: String(duties.length || 8), sub: '典型工作画像' },
          { lab: '核心重心', val: '架构+落地', sub: '非纯写代码', tone: 'is-gold' },
          { lab: '协作密度', val: '跨团队高', sub: '产品 / 业务 / 安全' },
          { lab: '可展示度', val: '强', sub: '适合做成项目经历', tone: 'is-up' }
        ]) +
        noteCards(themes);
    }

    const rd = ensureModMain('radar', false);
    if (rd) {
      rd.innerHTML =
        bubbleRow([
          { lab: '读法', val: '金条本岗', sub: '蓝条行业均值', tone: 'is-gold' },
          { lab: '关注点', val: '领先差值', sub: '越大越像新门槛' },
          { lab: '迁移项', val: '接近均值', sub: '可复用旧履历' },
          { lab: '行动', val: '补最大差', sub: '再回能力清单', tone: 'is-up' }
        ]) +
        noteCards([
          {
            k: '怎么用',
            t: '先找「真正新」的维度',
            p: '领先幅度最大的能力，往往是该岗从旧岗位拆出来的原因，也是简历最该补的点。'
          },
          {
            k: '误区',
            t: '不要平均用力',
            p: '接近行业均值的能力说明可迁移；把时间花在差值最大的 2–3 项上，性价比更高。'
          }
        ]);
    }

    const gp = ensureModMain('graph', false);
    if (gp) {
      const sources = (job.fromRoles || ['大模型工程师', '平台架构师', '后端工程师', '算法工程师']).slice(0, 4);
      gp.innerHTML =
        bubbleRow(
          sources.map((s, i) => ({
            lab: '路径 ' + String(i + 1).padStart(2, '0'),
            val: s,
            sub: i === 0 ? '主迁移来源' : '相邻岗位',
            tone: i === 0 ? 'is-gold' : ''
          }))
        ) +
        noteCards([
          {
            k: '迁移策略',
            t: '选一条主路径深挖',
            p: '主来源岗位与本岗重叠能力最多；先沿主路径补缺口，再吸收次要路径的差异化技能。'
          },
          {
            k: '图谱',
            t: '需要全局关系时',
            p: '点右上角「打开演化图谱」，查看多层关联与潜在方向（仅示意，不跳预测线）。'
          }
        ]);
    }

    const tr = ensureModMain('trend', false);
    if (tr) {
      tr.innerHTML =
        bubbleRow([
          { lab: '增长幅度', val: '↑' + (job.growth || 0) + '%', sub: '近 6 个月', tone: 'is-up' },
          { lab: '信号形态', val: '柱线同升', sub: '需求+关注双热', tone: 'is-gold' },
          { lab: '窗口判断', val: '宜提前布局', sub: '标题仍在固化' },
          { lab: '风险提示', val: '防概念热', sub: '对照供需模块' }
        ]) +
        noteCards([
          {
            k: '读图要点',
            t: '发布量 vs 搜索热度',
            p: '同向上抬=真需求；只抬搜索=概念热；只抬发布=企业先行、人才池未跟上。'
          },
          {
            k: '行动窗口',
            t: '趋势抬头期做什么',
            p: '优先沉淀可验证项目与评测指标，而不是等岗位标题完全标准化后再动手。'
          }
        ]);
    }

    const su = ensureModMain('supply', false);
    if (su) {
      su.innerHTML =
        bubbleRow([
          { lab: '供需关系', val: '需求领先', sub: '缺口仍打开', tone: 'is-gold' },
          { lab: '议价空间', val: '偏早鸟', sub: '差异化能力值钱', tone: 'is-up' },
          { lab: '竞争态势', val: '加速进入', sub: '供给正在追赶' },
          { lab: '建议动作', val: '作品优先', sub: '再追证书' }
        ]) +
        noteCards([
          {
            k: '窗口逻辑',
            t: '缺口收窄前布局',
            p: '需求增速高于供给时，早期进入者更容易拿到机会；供给追上后，差异化比「会用过工具」更重要。'
          },
          {
            k: '落到简历',
            t: '用对比报告找优先缺口',
            p: '点顶部「对比简历报告」，把供需窗口翻译成你要先补的 2–3 项能力。'
          }
        ]);
    }

    // 底部填满：挂在 mod-main 末尾（图表/控件下方），消灭大片留白
    fillTail('overview', false, [
      { k: '城市信号', t: (job.city || '一线') + ' 优先观察', p: '头部城市样本更密，适合作为信息源与投递优先地。' },
      { k: '30 天', t: '1 个可演示项目', p: '用 TOP 能力串端到端 demo，比堆关键词更有用。' },
      { k: '对照', t: '对比简历报告', p: '把能力清单映射到缺口，先补差值最大的两项。' },
      { k: '风险', t: '标题可能改写', p: '盯能力组合比盯单一标题更稳。' },
      { k: '信息源', t: '每周扫一次 JD', p: '盯能力词是否扩散到更多公司，而不是死盯一个别名。' },
      { k: '交付物', t: '一页岗位备忘', p: '热度、TOP 能力、城市、投递优先级写在一页，方便复盘。' }
    ]);
    fillTail('skills', false, [
      { k: '本周', t: ((job.skillScores || [])[0] && (job.skillScores || [])[0].name) || 'TOP1', p: '最小闭环：输入→工具→输出→评测。' },
      { k: '证据', t: '数字 > 形容词', p: '简历用延迟/召回/成本替代「熟悉/精通」。' },
      { k: '对照', t: '能力对照', p: '确认高热项是否也是相对行业的领先项。' },
      { k: '交付', t: '一页能力清单', p: 'TOP3 + 作品链接 + 指标，面试可直接讲。' },
      { k: '避坑', t: '别只会堆词', p: '招聘方最终看你是否跑通过，而不是词表长度。' },
      { k: '联动', t: '回看供需', p: '高热且缺口大的能力，优先排进本月学习。' }
    ]);
    fillTail('duties', false, [
      { k: '面试', t: '挑 2 条职责讲透', p: '情境—行动—结果，最好带指标。' },
      { k: '验收', t: '先定义成功', p: '评测集、权限与成本上限写清再开工。' },
      { k: '协作', t: '干系人对齐', p: '产品/业务/安全是高频协作对象。' },
      { k: '下周', t: '补一条职责样例', p: '按本岗一条职责写 200 字项目说明。' },
      { k: '拆解', t: '职责→模块', p: '把职责拆成可交付模块，方便排期与协作。' },
      { k: '迁移', t: '强调闭环', p: '设计到上线到复盘，比罗列工具名更有说服力。' }
    ]);
    fillTail('radar', false, [
      { k: '≥10 差', t: '优先补齐', p: '差异化信号，作品与面试应主动展示。' },
      { k: '4–9 差', t: '巩固即可', p: '保持不落后，不必作为本月主线。' },
      { k: '近均值', t: '迁移证据', p: '说明有底座，可从旧岗平滑过渡。' },
      { k: '本周', t: '练最大差值', p: '做一个能讲清「我比均值强在哪」的小 demo。' },
      { k: '简历', t: '要求 + 结果', p: '先写岗位领先维度，再写你对应的量化结果。' },
      { k: '回看', t: '核心能力清单', p: '对照 TOP 热度，确认差值项是否也在高热层。' }
    ]);
    fillTail('graph', false, [
      { k: '主路径', t: ((job.fromRoles || [])[0] || '相关岗'), p: '优先复用该路径项目与术语。' },
      { k: '次路径', t: ((job.fromRoles || [])[1] || '相邻岗'), p: '吸收差异化技能，避免只靠单一背景。' },
      { k: '缺口', t: '写 3 条必补', p: '主路径没有、本岗高频的能力列入本月。' },
      { k: '人脉', t: '找 1 位过来人', p: '问清如何从旧岗切入，比只看 JD 真。' },
      { k: '图谱', t: '看全局再决策', p: '确认是否还有更近的跳板岗。' },
      { k: '投递', t: '标题可宽', p: '相关别名也可投，关键是能力组合对得上。' }
    ]);
    fillTail('trend', false, [
      { k: '双热', t: '真窗口', p: '企业在招、求职者在搜，适合加速作品。' },
      { k: '只热搜', t: '概念阶段', p: '先观察标题是否固化。' },
      { k: '只热发', t: '企业先行', p: '人才池未跟上，早进入者更有议价空间。' },
      { k: '对照', t: '供需模块', p: '趋势好看还要看缺口，避免追空概念。' },
      { k: '本周', t: '记一条趋势笔记', p: '截图关键拐点，写清学习调整。' },
      { k: '复盘', t: '每两周一次', p: '窗口变化快，固定复盘更稳。' }
    ]);
    fillTail('supply', false, [
      { k: '投递', t: '本月加强对口投', p: '缺口打开期，作品+量化结果（延迟/召回/成本）更容易过筛。' },
      { k: '学习', t: '作品 > 证书', p: '缺口收窄前，可验证项目比泛化证书更能证明你。' },
      { k: '谈判', t: '稀缺组合', p: '面试强调需求领先维度上你已有的结果，而不是工具清单。' },
      { k: '城市', t: (job.city || '一线') + ' 优先', p: '头部城市样本更密，适合投递与信息源。' },
      { k: '对照', t: '对比简历报告', p: '把窗口翻译成你要先补的 2–3 项能力，再排学习优先级。' },
      { k: '复盘', t: '每月看供需比', p: '比值回落则转向做深差异化，避免继续「只抢窗口」。' }
    ]);
  }

  function renderForecastModRich(job) {
    const skills = job.skillScores || [];
    const top3 = skills.slice(0, 3).map((s) => s.name);
    const from = (job.fromRoles || []).slice(0, 4);
    const inds = (job.industries || []).slice(0, 3);

    const ov = ensureModMain('overview', true);
    if (ov) {
      ov.innerHTML =
        bubbleRow([
          { lab: '预测置信度', val: (job.conf || '—') + '%', sub: '推演强度', tone: 'is-gold' },
          { lab: '预计窗口', val: job.windowLabel || job.etaDisplay || '—', sub: '成型时间带' },
          { lab: '演化来源', val: String((job.fromRoles || []).length || job.evolveCount || 7), sub: '相邻岗位数' },
          { lab: '使用方式', val: '前瞻信号', sub: '非招聘承诺', tone: 'is-warn' }
        ]) +
        noteCards([
          {
            k: '怎么读',
            t: '把它当布局地图',
            p: '先看能力交汇与职责形态，再看概率/行业，最后必须读不确定性，再决定投入深度。'
          },
          {
            k: '和真实发现的关系',
            t: '用已有岗做过渡',
            p: '同源真实发现岗位是更稳的跳板；预测岗负责告诉你能力组合会往哪走。'
          },
          {
            k: '马上可做',
            t: '补交汇能力',
            p: (top3[0] || '编排') + ' / ' + (top3[1] || '治理') + ' / ' + (top3[2] || '集成') + ' 可现在练，不必等标题出现。'
          }
        ]);
    }

    const sk = ensureModMain('skills', true);
    if (sk) {
      sk.innerHTML =
        bubbleRow([
          { lab: '布局重心', val: '交汇型', sub: '而非单栈深挖', tone: 'is-gold' },
          { lab: 'TOP 1', val: top3[0] || '—', sub: '最先写进 JD' },
          { lab: 'TOP 2', val: top3[1] || '—', sub: '差异化信号' },
          { lab: 'TOP 3', val: top3[2] || '—', sub: '落地推动' }
        ]) +
        noteCards([
          {
            k: '练习法',
            t: '用一个试点串起来',
            p: '选一个内部流程做 Agent 编排试点：工具调用 + 评测 + 权限审计，比刷概念词有效。'
          },
          {
            k: '履历复用',
            t: '重叠能力先写清',
            p: '与已有岗位重叠的能力直接迁移；真正要新学的是交汇层（编排/治理/集成）。'
          }
        ]);
    }

    const du = ensureModMain('duties', true);
    if (du) {
      du.innerHTML =
        bubbleRow([
          { lab: '职责成熟度', val: '成形中', sub: '非标准 JD', tone: 'is-warn' },
          { lab: '工作形态', val: '编排+治理', sub: '偏系统化' },
          { lab: '验证方式', val: '试点项目', sub: '可写进作品集', tone: 'is-gold' },
          { lab: '组织要求', val: '偏高', sub: '跨团队协同' }
        ]) +
        noteCards([
          {
            k: '用途',
            t: '理解场景，而非对标招聘',
            p: '预测职责帮助你想象业务场景；不要把它当成某家公司已经在招的岗位说明书。'
          },
          {
            k: '转化',
            t: '写成可做的实验',
            p: '每条职责对应一个 1–2 周可完成的实验：评测集、权限模型或成本看板。'
          }
        ]);
    }

    const ev = ensureModMain('evolve', true);
    if (ev) {
      ev.innerHTML =
        bubbleRow(
          (from.length ? from : ['相邻岗位 A', '相邻岗位 B', '相邻岗位 C', '相邻岗位 D']).map((s, i) => ({
            lab: '来源 ' + String(i + 1).padStart(2, '0'),
            val: s,
            sub: i === 0 ? '主演化源' : '能力贡献',
            tone: i === 0 ? 'is-gold' : ''
          }))
        ) +
        noteCards([
          {
            k: '三栏读法',
            t: '已有岗 → 交汇 → 预测岗',
            p: '左栏是你可迁移的起点，中栏是现在就能练的能力，右栏是尚未固化的招聘标题。'
          },
          {
            k: '可解释性',
            t: '交汇越清晰越可信',
            p: '若中栏能力能在多源真实 JD 中找到零散证据，预测就更像「提前组合」，而非空想。'
          }
        ]);
    }

    const pb = ensureModMain('prob', true);
    if (pb) {
      pb.innerHTML =
        bubbleRow([
          { lab: '当前置信', val: (job.conf || '—') + '%', sub: '综合推演', tone: 'is-gold' },
          { lab: '轨迹', val: '窗口抬升', sub: '概念→可招聘' },
          { lab: '策略', val: '观察+布局', sub: '避免 All-in', tone: 'is-warn' },
          { lab: '对照', val: '读不确定性', sub: '再下投入决心' }
        ]) +
        noteCards([
          {
            k: '抬升意味着什么',
            t: '信号在变强，不是录用保证',
            p: '概率抬升说明相关技能/职责出现频率增加；仍可能被拆进已有岗位标题。'
          },
          {
            k: '两种抬升',
            t: '集中 vs 分散',
            p: '行业集中抬升=机会清晰；分散抬升=标题更杂，更要靠交汇能力说话。'
          }
        ]);
    }

    const ind = ensureModMain('industry', true);
    if (ind) {
      const cards = (inds.length ? inds : [{ name: '互联网', value: 36 }, { name: '金融科技', value: 22 }, { name: '智能制造', value: 18 }]).map(
        (d, i) => ({
          lab: '落点 ' + String(i + 1).padStart(2, '0'),
          val: d.name,
          sub: (d.value != null ? d.value + '%' : '关注'),
          tone: i === 0 ? 'is-gold' : ''
        })
      );
      const mainInd = (inds[0] && inds[0].name) || '互联网';
      ind.innerHTML =
        bubbleRow(cards) +
        noteCards([
          {
            k: '落地策略',
            t: '先盯主行业试点团队',
            p: '主落地行业通常最先写出相关职责；可优先关注该行业的平台 / 中台 / 效能团队。'
          },
          {
            k: '话术',
            t: '覆盖分散时怎么讲',
            p: '强调可迁移的交汇能力与场景方法论，而不是押注单一行业岗位名。'
          }
        ]);
    }

    const sp = ensureModMain('supply', true);
    if (sp) {
      sp.innerHTML =
        bubbleRow([
          { lab: '需求预测', val: '领先', sub: '布局窗口打开', tone: 'is-gold' },
          { lab: '供给预测', val: '追赶中', sub: '人才池尚未饱和' },
          { lab: '缺口阶段', val: '扩大期', sub: '适合积累作品', tone: 'is-up' },
          { lab: '避开', val: '只学概念', sub: '供给追上会贬值', tone: 'is-warn' }
        ]) +
        noteCards([
          {
            k: '时间感',
            t: '需求领先供给时动手',
            p: '用作品与案例占住早期叙事；等供给追上，市场上会挤满「会用过工具」的人。'
          },
          {
            k: '对照真实线',
            t: '找已验证过渡岗',
            p: '回到真实发现列表，选同源已有岗位作为跳板，降低等待预测标题出现的风险。'
          }
        ]);
    }

    const rk = ensureModMain('risk', true);
    if (rk) {
      rk.innerHTML =
        bubbleRow([
          { lab: '技术路线', val: '迭代快', sub: '标题可能改写', tone: 'is-warn' },
          { lab: '政策预算', val: '敏感', sub: '窗口可推迟' },
          { lab: '路径固化', val: '未完成', sub: '或并入旧岗' },
          { lab: '建议姿态', val: '收藏观察', sub: '补交汇能力', tone: 'is-gold' }
        ]) +
        noteCards([
          {
            k: '底线',
            t: '预测不是承诺',
            p: job.riskLead || '以下因素可能推迟或改写该岗位出现形态，请当作前瞻信号而非招聘保证。'
          },
          {
            k: '稳健做法',
            t: '三件套',
            p: '收藏跟踪 + 补交汇能力 + 同步关注真实发现列表。这样即使标题变化，能力也不浪费。'
          }
        ]);
      const riskMain = document.querySelector('#dd-fc-board [data-mod="risk"] .dd-mod-risk-main');
      if (riskMain) riskMain.classList.add('is-rich-dup');
    }

    fillTail('overview', true, [
      { k: '读序', t: '能力→职责→概率→风险', p: '按序读完再决定投入，避免只看置信度。' },
      { k: '跳板', t: '真实发现同源岗', p: '预测未固化前，用已有岗站稳脚跟。' },
      { k: '现在练', t: (top3[0] || '交汇能力'), p: '不必等标题出现，交汇层可立刻开工。' },
      { k: '姿态', t: '观察+布局', p: '收藏跟踪，不全仓押单一预测标题。' },
      { k: '对照', t: '打开简历对比', p: '提前找交汇缺口，比等 JD 再慌更划算。' },
      { k: '底线', t: '必读不确定性', p: '任何加码前先过风险清单。' }
    ]);
    fillTail('skills', true, [
      { k: '交汇练', t: '编排+评测+权限', p: '一个试点同时练三项，比分科刷课更接近真实岗。' },
      { k: '旧履历', t: '重叠能力先亮', p: '面试先讲可迁移部分，再讲新补的交汇层。' },
      { k: '证据', t: '试点复盘一页', p: '问题、方案、指标与失败点写清。' },
      { k: '避坑', t: '别只追新词', p: '供给追上后，交汇深度才稀缺。' },
      { k: '对照', t: '回真实发现列表', p: '确认交汇能力是否已在真实 JD 出现。' },
      { k: '本周', t: '定一个试点范围', p: '选可两周内跑通的流程。' }
    ]);
    fillTail('duties', true, [
      { k: '实验 1', t: '评测集最小版', p: '20 条用例 + 通过率。' },
      { k: '实验 2', t: '权限与审计', p: '工具调用白名单与日志。' },
      { k: '实验 3', t: '成本看板', p: 'token/延迟粗算。' },
      { k: '写法', t: '职责→实验映射', p: '一页表说明如何用实验覆盖预测职责。' },
      { k: '协作', t: '拉一个业务同学', p: '有真实场景验收更可信。' },
      { k: '提醒', t: '别当已招 JD', p: '职责仍在成形，盯能力交汇。' }
    ]);
    fillTail('evolve', true, [
      { k: '左栏', t: '你的跳板', p: '选一个最熟的已有岗，列可复用项目。' },
      { k: '中栏', t: '现在就练', p: '交汇能力不依赖预测标题。' },
      { k: '右栏', t: '观察标题', p: '标题固化后再加大投递权重。' },
      { k: '证据', t: '真实 JD 零散命中', p: '多源命中则更可信。' },
      { k: '路径', t: '一主一次', p: '主路径深挖，次路径补差异。' },
      { k: '决策', t: '能力先于标题', p: '标题变了能力还在。' }
    ]);
    fillTail('prob', true, [
      { k: '置信度', t: (job.conf || '—') + '%', p: '只表示信号强度，不是录用概率。' },
      { k: '投入上限', t: '先 30% 精力', p: '其余放在真实发现跳板岗。' },
      { k: '加码', t: '标题开始固化', p: '多家写出相近职责再提高权重。' },
      { k: '减码', t: '不确定性抬头', p: '回到观察+补交汇。' },
      { k: '必读', t: '不确定性模块', p: '概率好看也要对照风险。' },
      { k: '记录', t: '每月记一笔', p: '置信与窗口变化写下来。' }
    ]);
    fillTail('industry', true, [
      { k: '主行业', t: (inds[0] && inds[0].name) || '互联网', p: '优先看中台/效能/平台试点招聘。' },
      { k: '次行业', t: (inds[1] && inds[1].name) || '关注扩散', p: '验证能力是否跨行业可迁移。' },
      { k: '信息源', t: '行业峰会与案例', p: '补场景语感。' },
      { k: '投递包', t: '按行业改摘要', p: '同一作品集换行业关键词。' },
      { k: '避坑', t: '别押单一标题', p: '能力方法论比岗位名更重要。' },
      { k: '联动', t: '对照供需趋势', p: '主行业缺口大时可略提高权重。' }
    ]);
    fillTail('supply', true, [
      { k: '现在', t: '扩作品叙事', p: '缺口扩大期，作品比证书更抢窗口。' },
      { k: '之后', t: '拼差异化', p: '供给追赶后靠独特组合。' },
      { k: '跳板', t: '真实发现同源岗', p: '先拿已有岗站稳。' },
      { k: '节奏', t: '双周复盘供需', p: '看曲线是否交叉再加码。' },
      { k: '避坑', t: '别只囤课', p: '概念多、作品少最容易被淹没。' },
      { k: '联动', t: '读不确定性', p: '供需好看也要看路线扰动。' }
    ]);
    fillTail('risk', true, [
      { k: '观测', t: '路线是否改写', p: '框架/范式切换可能让标题失效。' },
      { k: '政策', t: '预算与合规', p: '窗口可推迟，保持可切换能力。' },
      { k: '路径', t: '是否并入旧岗', p: '交汇能力仍可复用。' },
      { k: '姿态', t: '收藏+布局', p: '不全仓押标题。' },
      { k: '止损', t: '设投入上限', p: '不确定性高时控制押注深度。' },
      { k: '备份', t: '真实发现跳板', p: '始终保留一条已验证路径。' }
    ]);
  }

  function enrichFoundInsights(job) {
    const topSkill =
      (job.skillScores && job.skillScores[0] && job.skillScores[0].name) ||
      (job.skills && job.skills[0] && (job.skills[0].name || job.skills[0])) ||
      '核心技能';
    const top3 = (job.skillScores || []).slice(0, 3).map((s) => s.name);
    fillInsight(
      'dd-found-overview-insight',
      '先读清这个岗为什么「新」',
      (job.brief || job.positioning || '该岗位已在真实招聘中出现，以下模块拆开看能力、来源与供需。') +
        ' 热度指数 ' +
        (job.conf || '—') +
        '，样本 ' +
        Number(job.sampleCount || 0).toLocaleString('zh-CN') +
        '。',
      [
        '本岗重心在系统交付，而不仅是调模型。',
        '建议顺序：能力 → 职责 → 来源 → 趋势/供需。',
        '需要和简历对照时，点顶部「对比简历报告」。'
      ],
      {
        signals: [
          { lab: '热度', val: String(job.conf || '—'), tone: 'is-gold' },
          { lab: '增长', val: '↑' + (job.growth || 0) + '%', tone: 'is-up' },
          { lab: '样本', val: Number(job.sampleCount || 0).toLocaleString('zh-CN') }
        ],
        checks: [
          '扫一眼基础信息与定位是否对口',
          '进入核心能力，核对 TOP 3 是否具备',
          '不确定迁移成本时，看来源路径'
        ],
        next: { mod: 'skills', label: '进入核心能力 →' },
        deeper: [
          { t: '新在交付边界', p: '从单点模型能力，扩展到编排、工具调用与评测闭环。' },
          { t: '先核能力再谈趋势', p: '没有 TOP 能力底座，供需窗口再好也难转化成机会。' },
          { t: '简历对照更准', p: '顶部「对比简历报告」能把模块阅读结果落到具体缺口。' }
        ]
      }
    );
    fillOverviewJumps('dd-found-overview-insight', FOUND_MODS, 'overview');

    fillInsight(
      'dd-found-skills-insight',
      '能力热度在说什么',
      '「' + topSkill + '」等能力在该岗位招聘文本中反复出现。分层越高，越常作为硬门槛或加分项。',
      [
        '优先对齐 TOP 3，再补齐中腰能力。',
        '可与「能力对照」交叉验证是否高于行业均值。',
        '收藏后可在个人仓库集中复盘能力清单。'
      ],
      {
        signals: [
          { lab: 'TOP1', val: top3[0] || '—', tone: 'is-gold' },
          { lab: 'TOP2', val: top3[1] || '—' },
          { lab: 'TOP3', val: top3[2] || '—' }
        ],
        checks: [
          '标出你已具备 / 半具备 / 缺失的能力',
          '给缺失项各配一个可演示小项目',
          '回能力对照看差值最大的 2 项'
        ],
        next: { mod: 'duties', label: '进入典型职责 →' },
        deeper: [
          { t: '热度≠简历关键词', p: '高热能力要配可量化结果：延迟、准确率、成本或人效。' },
          { t: '分层决定投入', p: '≥85 先补齐；72–84 做加分项；更低的可迁移复用。' },
          { t: '和对照联动', p: '热度高且行业差值大的，才是真正差异化筹码。' }
        ]
      }
    );

    fillInsight(
      'dd-found-duties-insight',
      '职责里藏着能力用法',
      '典型职责写的是「日常怎么干活」，比岗位名称更能判断你是否匹配。把高频职责翻译成项目经历，就能看出自己差在架构、落地还是治理。',
      [
        '把职责翻译成可展示的项目经历，而不是停留在岗位标题。',
        '若职责偏编排/治理，说明岗位已从纯执行走向系统化。',
        '八条职责一次看清覆盖面：高频项优先写进作品集。'
      ],
      {
        signals: [
          { lab: '重心', val: '架构+落地', tone: 'is-gold' },
          { lab: '协作', val: '跨团队高' },
          { lab: '可写简历', val: '强', tone: 'is-up' }
        ],
        checks: [
          '选 2–3 条职责写成「场景-动作-结果」',
          '对照能力清单，职责里用到了哪些热度项',
          '缺治理/评测经历就补一个试点',
          '高频职责（≥85%）优先做成可演示作品'
        ],
        next: { mod: 'radar', label: '进入能力对照 →' },
        deeper: [
          { t: '职责→项目', p: '每条职责写成「场景-动作-结果」，直接可进简历与作品集。' },
          { t: '看重心', p: '架构/落地/治理占比，决定你该补系统设计还是试点落地。' },
          { t: '可展示度', p: '高可展示职责优先做成作品；纯协作项用协作成果与指标表述。' },
          { t: '和能力联动', p: '职责里反复出现的词，往往对应核心能力 TOP 项，两边对照补齐。' }
        ]
      }
    );

    fillInsight(
      'dd-found-radar-insight',
      '相对行业你差在哪',
      '金条为本岗位要求，蓝条为行业均值。领先维度是该岗真正「新」的差异化信号。',
      [
        '差值最大的维度通常是入行门槛。',
        '接近行业均值的能力说明可迁移，不必从零开始。',
        '对照完可回「核心能力」制定补齐顺序。'
      ],
      {
        signals: [
          { lab: '金条', val: '本岗要求', tone: 'is-gold' },
          { lab: '蓝条', val: '行业均值' },
          { lab: '策略', val: '补最大差', tone: 'is-up' }
        ],
        checks: [
          '圈出领先差值最大的 2–3 项',
          '接近均值的项直接复用旧履历表述',
          '回核心能力排 30 天补齐顺序'
        ],
        next: { mod: 'graph', label: '进入来源路径 →' },
        deeper: [
          { t: '差值最大优先', p: '领先行业最多的维度，通常是本岗真正的新门槛。' },
          { t: '接近均值可复用', p: '这些能力不必重学，把旧履历话术改写即可。' },
          { t: '别平均用力', p: '只盯 2–3 个最大差，补齐速度远快于全面铺开。' },
          { t: '回能力清单', p: '对照完立刻回核心能力，排出 30 天补齐顺序。' }
        ]
      }
    );

    fillInsight(
      'dd-found-graph-insight',
      '从相邻岗位迁过来',
      '来源占比越高，说明越多人/岗位路径汇入此新兴岗位。可据此规划过渡路径。',
      [
        '悬停扇区查看单条路径说明。',
        '需要全局关系时，打开完整「演化图谱」。',
        '路径集中 = 迁移成本更低；路径分散 = 能力组合更独特。'
      ],
      {
        signals: [
          { lab: '主路径', val: (job.fromRoles && job.fromRoles[0]) || '大模型工程', tone: 'is-gold' },
          { lab: '策略', val: '先主后次' },
          { lab: '图谱', val: '可深挖' }
        ],
        checks: [
          '选定一条主迁移路径深挖',
          '列出主路径已具备 vs 本岗缺口',
          '需要全局时打开演化图谱'
        ],
        next: { mod: 'trend', label: '进入需求趋势 →' },
        deeper: [
          { t: '主路径优先', p: '占比最高的来源岗，迁移成本最低，适合作为跳板。' },
          { t: '次路径补差异', p: '次要来源提供差异化技能，用来拉开竞争。' },
          { t: '分散=独特', p: '来源很散时，能力组合更稀缺，简历要讲组合故事。' },
          { t: '图谱深挖', p: '需要多层关系时，打开完整演化图谱继续看。' }
        ]
      }
    );

    fillInsight(
      'dd-found-trend-insight',
      '发布量与搜索热度',
      '柱线同向上抬，说明岗位既被企业需要，也被求职者关注；只抬搜索、发布滞后则偏「概念热」。',
      [
        '近 6 个月增长 ' + (job.growth != null ? job.growth + '%' : '—') + '。',
        '趋势抬头时更适合提前补能力，而不是等标题固化。',
        '可与「人才供需」对照，判断是缺人还是虚火。'
      ],
      {
        signals: [
          { lab: '增长', val: '↑' + (job.growth || 0) + '%', tone: 'is-up' },
          { lab: '形态', val: '柱线同升', tone: 'is-gold' },
          { lab: '窗口', val: '宜布局' }
        ],
        checks: [
          '确认是双热还是偏概念热',
          '抬头期优先沉淀可验证项目',
          '再去供需模块看缺口是否真打开'
        ],
        next: { mod: 'supply', label: '进入人才供需 →' },
        deeper: [
          { t: '双热=真窗口', p: '发布与搜索同升，说明企业与求职者都在跟。' },
          { t: '只热搜索', p: '偏概念热，先观察，别把全部精力押标题。' },
          { t: '抬头期布局', p: '标题未固化前，作品与评测指标比证书更值钱。' },
          { t: '对照供需', p: '趋势好看还要看缺口，虚火和缺人差很多。' }
        ]
      }
    );

    fillInsight(
      'dd-found-supply-insight',
      '缺口决定窗口长短',
      '需求增速高于供给时，早期进入者更容易拿到机会与议价空间。把本模块当成「投递节奏表」：缺口打开就加速作品与对口投，比值回落就转向做深差异化。',
      [
        '缺口收窄前，优先沉淀可验证项目。',
        '供给追赶快时，差异化能力比泛化证书更重要。',
        '结合简历对比，把优先缺口落到人岗匹配。',
        '每月回看供需比，及时调整投递与学习权重。'
      ],
      {
        signals: [
          { lab: '供需', val: '需求领先', tone: 'is-gold' },
          { lab: '议价', val: '偏早鸟', tone: 'is-up' },
          { lab: '动作', val: '作品优先' }
        ],
        checks: [
          '缺口仍打开：先做作品再追证书',
          '用「对比简历报告」锁定优先缺口 2–3 项',
          '本月至少 1 次对口投递（带量化结果）',
          '收藏本岗，方便回看窗口变化',
          '面试话术准备「稀缺组合 + 可验证结果」'
        ],
        reads: [
          '先看供需比与需求/供给增速，判断窗口阶段',
          '再对照行动清单，勾 1–2 件本周可做',
          '用深读卡片核对：作品优先 vs 证书优先是否搞反',
          '最后跳到核心能力，把缺口落到具体技能'
        ],
        next: { mod: 'skills', label: '回到核心能力 →' },
        deeper: [
          { t: '缺口逻辑', p: '需求领先供给时，早进入者议价空间更大；比值回落就要改策略。' },
          { t: '作品优先', p: '缺口收窄前，可验证项目比泛化证书更能证明你。' },
          { t: '差异化', p: '供给追赶后，拼的是独特组合，不是「会用过工具」。' },
          { t: '落到简历', p: '用对比报告把窗口翻译成你要先补的 2–3 项。' },
          { t: '城市策略', p: '头部城市样本更密，适合作为投递与信息源优先地。' },
          { t: '复盘节奏', p: '每月看一次供需比，避免凭感觉追空概念或错过窗口。' }
        ]
      }
    );

    const evolve = document.getElementById('dd-found-evolve-link');
    if (evolve && job.id) {
      evolve.href = 'discovery-evolve.html?id=' + encodeURIComponent(job.id);
    }
    renderFoundModRich(job);
  }

  function enrichForecastInsights(job) {
    const from = (job.fromRoles && job.fromRoles[0]) || '相邻已有岗位';
    const top3 = (job.skillScores || []).slice(0, 3).map((s) => s.name);
    fillInsight(
      'dd-fc-overview-insight',
      '把它当「前瞻信号」读',
      '预测置信度 ' +
        (job.conf || '—') +
        '%，预计窗口 ' +
        (job.windowLabel || job.etaDisplay || '待观察') +
        '。尚未固化为稳定招聘标题，适合提前布局而非当作已招岗位。',
      [
        '先看能力演化与职责，再看概率与行业落点。',
        '不确定性模块必须读完再做决策。',
        '可用「对比简历报告」提前找缺口。'
      ],
      {
        signals: [
          { lab: '置信', val: (job.conf || '—') + '%', tone: 'is-gold' },
          { lab: '窗口', val: job.windowLabel || job.etaDisplay || '—' },
          { lab: '姿态', val: '观察+布局', tone: 'is-warn' }
        ],
        checks: [
          '先读能力演化，确认交汇是否可解释',
          '再看职责与概率，判断投入深度',
          '决策前必读不确定性'
        ],
        next: { mod: 'skills', label: '进入核心能力 →' },
        deeper: [
          { t: '前瞻≠在招', p: '标题未固化前，按信号布局，别按已招岗硬投。' },
          { t: '读序很重要', p: '能力→职责→概率→行业→供需→风险，顺序决定判断质量。' },
          { t: '置信度', p: (job.conf || '—') + '% 只说明信号强度，不是录用概率。' },
          { t: '简历对照', p: '用对比报告提前找交汇缺口，比等 JD 出来再慌更划算。' }
        ]
      }
    );
    fillOverviewJumps('dd-fc-overview-insight', FORECAST_MODS, 'overview');

    fillInsight(
      'dd-fc-skills-insight',
      '提前布局的能力清单',
      '这些能力多来自相邻岗位交汇，尚未形成统一 JD 模板，但已在相关招聘中零散出现。',
      [
        '优先练「交汇型」能力，而不是单一栈深挖。',
        '与已有岗位能力重叠处可复用履历。',
        '窗口临近时，TOP 能力会更快写进真实 JD。'
      ],
      {
        signals: [
          { lab: 'TOP1', val: top3[0] || '—', tone: 'is-gold' },
          { lab: 'TOP2', val: top3[1] || '—' },
          { lab: '重心', val: '交汇型' }
        ],
        checks: [
          '选一个内部流程做编排试点',
          '把交汇能力写成可演示结果',
          '重叠能力直接迁移旧履历'
        ],
        next: { mod: 'duties', label: '进入预测职责 →' },
        deeper: [
          { t: '交汇优先', p: '预测岗吃的是组合能力，不是单一栈刷到极致。' },
          { t: '复用旧履历', p: '与已有岗重叠的部分，直接改写成可迁移成果。' },
          { t: '可演示', p: '每项 TOP 能力至少对应一个可演示结果或指标。' },
          { t: '窗口临近', p: '置信抬升时，TOP 能力会更快写进真实 JD。' }
        ]
      }
    );

    fillInsight(
      'dd-fc-duties-insight',
      '职责还在成形中',
      '预测职责描述的是可能工作形态，用于理解业务场景，不代表某家公司已按此招聘。',
      [
        '把职责映射到可做的 side project / 内部试点。',
        '若职责偏治理与编排，说明组织成熟度要求更高。',
        '与「能力演化」对照，看职责从哪些已有岗拆分而来。'
      ],
      {
        signals: [
          { lab: '成熟度', val: '成形中', tone: 'is-warn' },
          { lab: '形态', val: '编排+治理', tone: 'is-gold' },
          { lab: '验证', val: '试点项目' }
        ],
        checks: [
          '每条职责对应 1–2 周实验',
          '优先做评测 / 权限 / 成本类试点',
          '回能力演化看职责从哪拆出来'
        ],
        next: { mod: 'evolve', label: '进入能力演化 →' },
        deeper: [
          { t: '场景读法', p: '职责是业务形态预演，不是某家公司的招聘条款。' },
          { t: '试点映射', p: '每条职责落到 1–2 周可完成的实验或 side project。' },
          { t: '成熟度信号', p: '偏治理/编排时，组织流程要求更高，别只堆工具。' },
          { t: '拆分来源', p: '对照能力演化，看职责从哪些已有岗拆出来。' }
        ]
      }
    );

    fillInsight(
      'dd-fc-evolve-insight',
      '从「' + from + '」等岗位长出来',
      '左栏是已有岗位，中栏是能力交汇，右栏是预测岗位。交汇越清晰，预测越可解释。',
      [
        '交汇能力是你现在就能开始练的部分。',
        '来源岗位越多，说明并非单一赛道臆测。',
        '可回到真实发现列表，找同源已有岗位做过渡。'
      ],
      {
        signals: [
          { lab: '主源', val: from, tone: 'is-gold' },
          { lab: '读法', val: '三栏递进' },
          { lab: '可练', val: '中栏交汇', tone: 'is-up' }
        ],
        checks: [
          '中栏能力各找一条真实 JD 证据',
          '选同源真实发现岗做过渡',
          '交汇不清就先降投入、多观察'
        ],
        next: { mod: 'prob', label: '进入出现概率 →' },
        deeper: [
          { t: '三栏递进', p: '已有岗 → 交汇能力 → 预测岗，交汇越清越可信。' },
          { t: '现在可练', p: '中栏交汇是当下就能动手的部分，别等标题固化。' },
          { t: '多源更稳', p: '来源岗越多，越不像单一赛道拍脑袋。' },
          { t: '过渡岗', p: '先投同源真实发现岗，比硬冲未固化标题更稳。' }
        ]
      }
    );

    fillInsight(
      'dd-fc-prob-insight',
      '窗口是否在抬升',
      '出现概率抬升，意味着信号从「概念」走向「可招聘」的可能性增加。',
      [
        '概率抬升但行业分散：机会广、标题更杂。',
        '概率走平：继续观察，不必押注单一标题。',
        '与不确定性模块一起读，避免过度解读。'
      ],
      {
        signals: [
          { lab: '置信', val: (job.conf || '—') + '%', tone: 'is-gold' },
          { lab: '轨迹', val: '窗口抬升' },
          { lab: '策略', val: '观察+布局', tone: 'is-warn' }
        ],
        checks: [
          '抬升≠录用保证，只代表信号变强',
          '行业分散时更靠交汇能力说话',
          '必读不确定性后再加码投入'
        ],
        next: { mod: 'industry', label: '进入行业落点 →' },
        deeper: [
          { t: '抬升含义', p: '从概念热走向可招聘的可能性在增，不是 offer 保证。' },
          { t: '行业分散', p: '机会广但标题杂，更要用交汇能力统一叙事。' },
          { t: '走平策略', p: '继续观察即可，不必把全部精力押单一标题。' },
          { t: '联读风险', p: '概率好看也要对照不确定性，避免过度解读。' }
        ]
      }
    );

    fillInsight(
      'dd-fc-industry-insight',
      '需求可能先落在哪',
      '主落地行业通常最先写出相关职责；前三覆盖越高，机会越集中。',
      [
        '可优先关注主落地行业的试点团队。',
        '覆盖分散时，跨行业迁移话术更重要。',
        '结合供需趋势判断哪一行业更缺人。'
      ],
      {
        signals: [
          {
            lab: '主落点',
            val: (job.industries && job.industries[0] && job.industries[0].name) || '互联网',
            tone: 'is-gold'
          },
          { lab: '策略', val: '先主行业' },
          { lab: '话术', val: '可迁移' }
        ],
        checks: [
          '盯主行业平台 / 中台 / 效能团队',
          '准备跨行业的交汇能力表述',
          '再看供需确认哪边更缺人'
        ],
        next: { mod: 'supply', label: '进入供需趋势 →' },
        deeper: [
          { t: '主行业优先', p: '主落点通常最先写出相关职责，试点团队最值得盯。' },
          { t: '覆盖集中', p: '前三行业占比高=机会集中，投递与话术可更聚焦。' },
          { t: '覆盖分散', p: '跨行业时，迁移话术比堆行业关键词更重要。' },
          { t: '对照供需', p: '落点好看还要看哪边更缺人，避免挤进虚火赛道。' }
        ]
      }
    );

    fillInsight(
      'dd-fc-supply-insight',
      '供需何时错开',
      '需求预测领先供给时，是布局窗口；供给追上后，差异化能力决定去留。',
      [
        '缺口扩大阶段适合积累作品与案例。',
        '供给追赶快时，避免只学「概念词」。',
        '可与真实发现岗位对照，找已验证的过渡岗。'
      ],
      {
        signals: [
          { lab: '需求', val: '领先', tone: 'is-gold' },
          { lab: '供给', val: '追赶中' },
          { lab: '阶段', val: '扩大期', tone: 'is-up' }
        ],
        checks: [
          '扩大期：作品与案例优先',
          '避免只学概念词',
          '找同源真实发现岗做跳板'
        ],
        next: { mod: 'risk', label: '进入不确定性 →' },
        deeper: [
          { t: '错开窗口', p: '需求领先供给时，是布局与议价空间最大的阶段。' },
          { t: '作品优先', p: '扩大期用作品与案例证明你，比背概念词有效。' },
          { t: '追赶后', p: '供给上来后，差异化组合能力决定去留。' },
          { t: '过渡跳板', p: '对照真实发现岗，找已验证的同源过渡路径。' }
        ]
      }
    );

    fillInsight(
      'dd-fc-risk-insight',
      '预测不是承诺',
      job.riskLead ||
        '以下因素可能推迟或改写该岗位的出现形态，请把本页当作前瞻信号而非招聘保证。',
      [
        '政策与预算变化会显著影响窗口。',
        '能力路径未固化时，标题可能被拆进已有岗位。',
        '建议：收藏观察 + 补交汇能力 + 跟踪真实发现列表。'
      ],
      {
        signals: [
          { lab: '技术', val: '迭代快', tone: 'is-warn' },
          { lab: '路径', val: '未固化' },
          { lab: '姿态', val: '收藏观察', tone: 'is-gold' }
        ],
        checks: [
          '收藏本预测，持续跟踪',
          '只补交汇能力，不赌单一标题',
          '同步盯真实发现列表'
        ],
        next: { mod: 'overview', label: '回到预测概览 →' },
        deeper: [
          { t: '政策预算', p: '窗口可能被推迟或改写，别把预测当招聘保证。' },
          { t: '路径未定', p: '标题可能被拆进已有岗，交汇能力仍可复用。' },
          { t: '正确姿态', p: '收藏观察 + 补交汇 + 盯真实发现，三件事并行。' },
          { t: '投入上限', p: '不确定性高时控制押注深度，保留切换空间。' }
        ]
      }
    );
    renderForecastModRich(job);
  }

  function toast(msg, tone) {
    if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, tone || 'mint');
  }

  function readFavs() {
    return window.DiscoveryFavs ? window.DiscoveryFavs.readFavs() : [];
  }

  function isFav(id) {
    return window.DiscoveryFavs ? window.DiscoveryFavs.isFav(id) : false;
  }

  function toggleFav(id, meta) {
    if (window.DiscoveryFavs) return window.DiscoveryFavs.toggleFav(id, meta);
    return false;
  }

  function syncFavButtons(job) {
    if (window.DiscoveryFavs) window.DiscoveryFavs.syncFavButtons(job);
  }

  function fillVerdict(job) {
    const top = (job.skillScores || []).slice(0, 3).map((s) => s.name);
    if (job.isForecast) {
      const kicker = document.getElementById('dd-fc-verdict-kicker');
      const text = document.getElementById('dd-fc-verdict-text');
      const chips = document.getElementById('dd-fc-verdict-chips');
      const trust = document.getElementById('dd-fc-trust');
      if (kicker) kicker.textContent = job.conf >= 80 ? '建议提前准备' : '建议持续观察';
      if (text) {
        text.textContent =
          '预计在「' +
          (job.windowLabel || job.etaDisplay) +
          '」窗口内成型（置信 ' +
          job.conf +
          '%）。先对照简历缺口，再决定是否投入准备。';
      }
      if (chips) {
        chips.innerHTML = top
          .map((n) => '<span class="dd-chip-mini">' + esc(n) + '</span>')
          .join('');
      }
      if (trust) {
        trust.innerHTML =
          '<span>推演示意</span><span>·</span><span>' +
          esc(job.alliance || '执图破局预测') +
          '</span><span>·</span><span>非招聘承诺</span>';
      }
      return;
    }

    const kicker = document.getElementById('dd-found-verdict-kicker');
    const text = document.getElementById('dd-found-verdict-text');
    const chips = document.getElementById('dd-found-verdict-chips');
    const trust = document.getElementById('dd-found-trust');
    if (kicker) kicker.textContent = job.growth >= 80 ? '建议关注' : '可以了解';
    if (text) {
      text.textContent =
        '该岗位已在真实招聘中稳定出现，近半年需求 ↑' +
        job.growth +
        '%。优先核对你是否具备核心能力，再决定收藏或深挖。';
    }
    if (chips) {
      chips.innerHTML = top
        .map((n) => '<span class="dd-chip-mini">' + esc(n) + '</span>')
        .join('');
    }
    if (trust) {
      trust.innerHTML =
        '<span>样本 ' +
        Number(job.sampleCount || 0).toLocaleString('zh-CN') +
        '</span><span>·</span><span>' +
        esc(job.source || '多源招聘库') +
        '</span><span>·</span><span>仅供参考</span>';
    }
  }

  function findJobInMock(id) {
    if (!id || !window.buildMockScanPayload) return null;
    const mock = window.buildMockScanPayload();
    const all = [...(mock.discoveries || []), ...(mock.forecasts || [])];
    return all.find((j) => j.id === id) || null;
  }

  function loadJob() {
    const id = qs('id');
    let job = null;

    if (id) job = findJobInMock(id);

    if (!job) {
      try {
        const raw = sessionStorage.getItem('zhitu_disc_job');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (!id || parsed.id === id) job = parsed;
        }
      } catch (_) {}
    }

    if (!job && window.buildMockScanPayload) {
      const mock = window.buildMockScanPayload();
      const all = [...(mock.discoveries || []), ...(mock.forecasts || [])];
      job = (id && all.find((j) => j.id === id)) || all[0];
    }

    if (!job) {
      job = {
        id: 'disc_mock_1',
        title: 'AI Agent 架构师',
        category: '人工智能',
        confidence: 88,
        city: '北京',
        level: '中高级',
        requiredSkills: [
          'LLM 应用与工程化',
          'Agent 设计与开发',
          'RAG 体系构建',
          'Prompt Engineering',
          '工具调用 (Tool Use)'
        ],
        definition:
          '负责设计与规划基于大模型的 Agent 系统架构，打通工具调用、知识检索与多模型协同，支撑企业级智能应用落地。',
        reasoning: '标题新颖度 + 技能组合熵 + 跨行业外溢'
      };
    }
    return enrichJob(job);
  }

  function enrichJob(job) {
    const isForecast = !!(job.is_forecast || job.status === 'forecast');
    const conf = job.confidence || 72;
    const growth =
      job.growth != null
        ? Number(job.growth)
        : conf >= 85
          ? 125
          : Math.max(48, Math.round((conf - 30) * 2.4));
    const skills = job.requiredSkills || job.core_skills || [];
    const first =
      job.freshness ||
      (job.discoveredAt || job.discovered_at
        ? String(job.discoveredAt || job.discovered_at).slice(0, 7)
        : '2024-Q4');

    const etaDisplay = job.eta_months
      ? String(job.eta_months).indexOf('月') >= 0
        ? String(job.eta_months)
        : String(job.eta_months) + ' 个月'
      : '6–12 个月';

    const defaultTop10 = [
      { name: 'LLM 应用与工程化', score: 92 },
      { name: 'Agent 设计与开发', score: 88 },
      { name: 'RAG 体系构建', score: 85 },
      { name: 'Prompt Engineering', score: 82 },
      { name: '工具调用 (Tool Use)', score: 78 },
      { name: '多智能体协作', score: 72 },
      { name: '向量数据库', score: 68 },
      { name: '系统架构设计', score: 65 },
      { name: 'Python 开发', score: 64 },
      { name: 'API 设计与集成', score: 61 }
    ];

    // Prefer curated TOP10 for found board; merge job skills only when names differ
    let skillScores = defaultTop10.map((d) => ({ ...d }));
    if (skills.length && !isForecast) {
      skills.forEach((s, i) => {
        const hit = skillScores.find((x) => x.name === s || s.indexOf(x.name.slice(0, 4)) === 0);
        if (!hit && skillScores.length < 10) {
          skillScores.push({
            name: s,
            score: Math.max(61, Math.min(92, conf + 4 - i * 4))
          });
        }
      });
      skillScores = skillScores.slice(0, 10);
    } else if (isForecast) {
      const fcTop10 = [
        { name: 'AI 工作流编排', score: 94 },
        { name: '多智能体协同', score: 90 },
        { name: 'LLMOps', score: 87 },
        { name: '安全与治理', score: 84 },
        { name: '企业系统集成', score: 81 },
        { name: '可观测与评测', score: 78 },
        { name: '成本与配额管理', score: 74 },
        { name: '权限与审计', score: 71 },
        { name: 'Prompt / 策略设计', score: 68 },
        { name: '跨团队落地推动', score: 65 }
      ];
      skillScores = fcTop10.map((d) => ({ ...d }));
      (job.skills || skills || []).forEach((s, i) => {
        const name = typeof s === 'string' ? s : s.name;
        if (!skillScores.some((x) => x.name === name) && skillScores.length < 10) {
          skillScores.push({ name, score: Math.max(65, conf + 6 - i * 4) });
        }
      });
      skillScores = skillScores.slice(0, 10);
    }

    const title = job.title || (isForecast ? '新兴岗位方向' : '新兴岗位');
    const basePos = job.definition || job.description || '';

    const defaultFoundDuties = [
      '负责 AI Agent 系统的整体架构设计与落地',
      '设计 Agent 工作流、任务规划与工具调用逻辑',
      '构建 RAG 检索增强与知识管理体系',
      '评估与优化 Agent 性能、效果与安全性',
      '推动 Agent 技术在业务场景中的应用落地',
      '编写技术方案与接口文档',
      '参与跨团队评审与上线验收',
      '沉淀可复用 Agent 场景模板'
    ];
    const rawDuties = (job.duties || job.responsibilities || []).filter(Boolean);
    const foundDuties =
      !isForecast && rawDuties.length < 5 ? defaultFoundDuties : rawDuties.length ? rawDuties : defaultFoundDuties;

    const foundPortrait = {
      positioning:
        basePos ||
        title +
          '负责把复杂智能体系统从方案推进到可上线、可运维的工程形态，明确模块边界、工具链路与评测标准。',
      brief:
        '这是一个已经在真实招聘文本中稳定出现的岗位。它不是单纯的模型调用角色，而是要把规划、工具调用、知识检索与执行闭环串成可交付系统。',
      duties: foundDuties,
      who: [
        '有后端或平台工程经验，能把服务边界画清楚',
        '接触过大模型应用或 RAG / 工具调用链路',
        '习惯用指标与评测说话，而不是只看 Demo',
        '能跨产品、算法、运维推进联调与上线'
      ],
      day: [
        '梳理业务场景，拆成可编排的任务与工具集',
        '设计 Agent 架构、上下文与失败回退路径',
        '联调检索、工具、权限与观测链路',
        '制定评测集，跟踪成功率、时延与成本'
      ],
      outputs: ['架构说明与接口契约', '工具目录与权限矩阵', '评测报告与回归清单', '上线与灰度方案'],
      collab:
        '对上对齐产品与业务目标，对内协同大模型、后端、数据与安全同学，对外对接运维与 SRE。',
      scenes: [
        { name: '企业知识助手', desc: '制度与资料接到可追问、可引用的问答链路。' },
        { name: '智能客服编排', desc: '多轮对话中调用工单、CRM、知识库。' },
        { name: '研发效能工具', desc: '代码检索、变更分析与发布检查。' },
        { name: '运营流程助手', desc: '审批、巡检、报表等流程任务链。' }
      ],
      note: '本页一次性呈现岗位画像、能力、趋势与供需，便于整体阅读。'
    };

    const forecastPortrait = {
      positioning:
        basePos && basePos.indexOf('Mock') === -1
          ? basePos
          : title +
            '面向企业级 AI 编排：把多 Agent、工具链与治理要求收成可交付的架构岗位方向。',
      brief: '窗口期内更可能成型，关注出现时间、演化来源与简历缺口。',
      duties: job.responsibilities || job.duties || [
        '设计企业级 AI 编排架构与多 Agent 协作边界',
        '建立 LLMOps、评测与灰度发布机制',
        '制定安全治理、权限审计与成本配额策略',
        '打通业务系统集成与工具调用链路',
        '推动试点编制走向常规岗位与交付标准',
        '编写架构规范与跨团队接口契约',
        '主导试点复盘并沉淀岗位能力模型',
        '对接合规与安全团队完成上线评审'
      ],
      who: [
        '已有相邻岗位经验，希望提前布局下一跳能力',
        '负责试点项目，需要预判编制与分工变化',
        '做人才规划，关注 6–18 个月岗位结构变化'
      ],
      day: [
        '把试点场景拆成可协作的角色与接口',
        '设计多 Agent / 编排与回退',
        '补齐观测、权限、成本与评测短板'
      ],
      outputs: ['方向说明与能力清单', '试点方案与角色分工表', '风险清单', '能力准备路径'],
      collab: '与业务共定场景，与工程岗位共定边界，与组织侧同步编制变化。',
      scenes: [
        { name: '多 Agent 业务试点', desc: '客服、运营、研效等场景协作。' },
        { name: '企业智能体运维', desc: '稳定性、配额、权限与事故响应。' }
      ],
      note: '预测存在不确定性，请结合窗口与能力准备阅读。'
    };

    const portrait = isForecast ? forecastPortrait : foundPortrait;
    const dutyScores = portrait.duties.map((_, i) =>
      isForecast ? Math.max(66, 91 - i * 3) : Math.max(62, 92 - i * 4)
    );

    const fromRoles = job.from || job.evolution_from || [
      'AI Agent 架构师',
      '大模型工程师',
      '平台架构师',
      'RAG 工程师',
      '自动化工程师',
      '智能体产品经理',
      '后端架构师'
    ];

    const related = isForecast
      ? fromRoles.slice(0, 4).map((name, i) => ({
          name,
          score: 90 - i * 5,
          note: '演化来源'
        }))
      : fromRoles.map((name, i) => {
          const notes = [
            '模型与编排能力直接延续',
            '检索与知识链路可迁移',
            '平台架构经验可复用',
            '多 Agent 协作背景',
            '自动化流水线经验',
            '产品化场景理解',
            '分布式系统底座'
          ];
          const weight = Math.max(36, 96 - i * 8 - (i % 2) * 4);
          return {
            name,
            score: weight,
            note: notes[i % notes.length] || '常见跃迁来源',
            count: Math.round(95 + weight * 3.8 - i * 12)
          };
        });

    const skillBoard = skillScores.map((s) => ({
      ...s,
      why: '招聘文本中与该岗位共现较高，是履职的重要支撑能力。',
      level: s.score >= 85 ? '必备' : s.score >= 72 ? '重要' : '加分'
    }));

    const windowLabel =
      job.eta ||
      job.etaDisplay ||
      (job.eta_months
        ? String(job.eta_months).indexOf('月') >= 0
          ? String(job.eta_months)
          : String(job.eta_months) + ' 个月'
        : isForecast
          ? '2025-Q3 – 2026-Q1'
          : first);

    return {
      ...job,
      isForecast,
      conf,
      growth,
      firstSeen: first,
      etaDisplay: isForecast ? windowLabel : etaDisplay,
      windowLabel,
      dataConf: Math.min(96, conf + 4),
      sampleCount: job.sample_count || job.sampleCount || 2356,
      industry: isForecast
        ? job.industry_label || '互联网 / 金融 / 制造 / 政企'
        : job.industry || '互联网 / 科技 / 金融',
      direction: '技术研发类',
      subtype: job.category || '软件与系统架构',
      levelDisplay: isForecast
        ? job.level_display || '高级 / 专家级'
        : job.level_display ||
          (job.level === '中高级' || job.level === '中/高级' ? '中级 / 高级' : job.level) ||
          '中级 / 高级',
      locationDisplay: '一线 / 新一线城市为主',
      salaryDisplay: isForecast ? job.salary || '35-60K · 16薪' : job.salary || '25-45K · 16薪',
      salaryPeak: isForecast ? 62 : 72,
      fromRoles,
      evolveCount: fromRoles.length,
      alliance: job.alliance || '执图破局 AI 预测联盟 v2.1',
      positioning: portrait.positioning,
      brief: portrait.brief,
      who: portrait.who,
      day: portrait.day,
      duties: portrait.duties,
      dutyScores,
      outputs: portrait.outputs,
      collab: portrait.collab,
      portraitNote: portrait.note,
      scenes: portrait.scenes,
      skillScores,
      skillBoard,
      skillsBrief: isForecast
        ? '若该预测方向在窗口内成型，履职最依赖的能力组合。'
        : '这些能力来自该岗位招聘文本与职责描述的共现分析。',
      skillsTiers: ['必备：岗位 JD 反复出现', '重要：影响上线与协作', '加分：拉开资深差距'],
      skillsPrep: [
        '选一个可上线的小场景，跑通工具/知识/评测闭环',
        '写清架构边界、失败回退与权限矩阵',
        '建立最小评测集：成功率、时延、成本'
      ],
      skillsGaps: ['Demo 很炫但接口/权限/观测缺失', '只会单点技术，串不起端到端', '缺少评测习惯'],
      skillsMap: [
        { duty: '架构与边界设计', skills: '系统架构设计 / API 编排' },
        { duty: '工具与知识集成', skills: 'Tool Use / RAG / 向量库' },
        { duty: '可靠性与评测', skills: '可观测性 / 成本优化' },
        { duty: '安全可控', skills: '安全与权限控制' }
      ],
      related,
      derived: [
        { name: '多智能体系统架构师', score: 86, eta: '12–18 月', note: '高潜力' },
        { name: '智能体产品经理', score: 78, eta: '9–15 月', note: '跨职能' }
      ],
      radarAxes: ['AI 应用开发', '大模型工程化', '系统设计', '数据处理', '业务理解'],
      radarJob: [92, 88, 78, 70, 74],
      radarAvg: [68, 62, 72, 66, 70],
      supply: {
        demandGrowth: growth,
        supplyGrowth: job.supply_growth != null ? Number(job.supply_growth) : 45,
        ratio:
          job.supply_ratio != null ? String(job.supply_ratio) : (growth / 45).toFixed(2)
      },
      skillDev: isForecast
        ? [
            { name: 'AI 工作流编排', now: '中', m6: '高', m12: '极高', m24: '极高' },
            { name: '多智能体协同', now: '中', m6: '高', m12: '高', m24: '极高' },
            { name: 'LLMOps', now: '中', m6: '中', m12: '高', m24: '极高' },
            { name: '安全与治理', now: '低', m6: '中', m12: '高', m24: '高' },
            { name: '企业系统集成', now: '中', m6: '高', m12: '高', m24: '极高' }
          ]
        : [],
      industries: [
        { name: '互联网', value: 32 },
        { name: '金融', value: 22 },
        { name: '制造', value: 16 },
        { name: '政企', value: 14 },
        { name: '医疗', value: 8 },
        { name: '其他', value: 8 }
      ],
      fusionSkills: ['多智能体编排', 'LLMOps', '安全治理', '企业集成'],
      riskLead:
        '本预测基于历史岗位演化、能力共现与行业试点信号推演，结果会随技术迭代与企业采纳节奏变化。',
      risks: ['技术路线迭代加快', '行业需求阶段性波动', '企业采纳与编制节奏', '政策与合规约束变化'],
      evidence: {
        reasons: isForecast
          ? ['相邻岗位能力密度上升', '业务场景开始试点', '招聘文本出现近义描述']
          : ['大模型能力成熟', '工具调用需求上升', 'Agent 场景扩张'],
        fusion: ['大模型工程师', '后端架构师', '自动化工程师'],
        industries: ['互联网', '金融', '教育', '企业服务'],
        future: isForecast
          ? '预计在窗口期内从试点岗位描述走向更稳定的招聘标题。'
          : '该岗位处于高速增长期，人才缺口较大；核心能力集中在 LLM、Agent 架构与 RAG。'
      },
      trendInsights: [
        first + ' 前后，相关招聘表述开始稳定出现',
        '近周期需求抬升，覆盖互联网、金融、企业服务等行业',
        '未来 6–12 个月仍可能保持较高增长区间'
      ]
    };
  }

  function seriesForRange(months) {
    const n = months;
    const heat = [];
    const demand = [];
    const supplyIdx = [];
    const labels = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
      const t = (n - i) / n;
      const base = 18 + t * 48 + Math.sin(i * 0.75) * 4;
      const h = Math.round(base + (currentJob?.conf || 70) * 0.1);
      heat.push(h);
      demand.push(Math.round(h * 0.78 + 8 + Math.cos(i * 0.5) * 3));
      supplyIdx.push(Math.round(h * 0.52 + 8 + i * 2.2));
    }
    const growthPct =
      heat.length > 1 ? Math.round(((heat[heat.length - 1] - heat[0]) / Math.max(heat[0], 1)) * 100) : 0;
    let peakIdx = 0;
    let peakVal = heat[0] || 0;
    heat.forEach((v, i) => {
      if (v >= peakVal) {
        peakVal = v;
        peakIdx = i;
      }
    });
    const pressure = heat.map((h, i) => Math.max(0, h - supplyIdx[i]));
    const accelStart = Math.max(0, n - 3);
    return {
      labels,
      heat,
      demand,
      supplyIdx,
      growthPct,
      peakIdx,
      peakVal,
      pressure,
      accelStart
    };
  }

  function chartTheme() {
    return { real: '#d4b07a', demand: '#8a7355' };
  }

  /* ---------- Found unified board ---------- */
  function renderFoundBoard(job) {
    clearDutyTimers();
    disposeFcCharts();
    const found = document.getElementById('dd-found');
    const forecast = document.getElementById('dd-forecast-shell');
    if (found) found.hidden = false;
    if (forecast) forecast.hidden = true;

    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('dd-found-title', job.title || '岗位详情');
    set('dd-found-heat', String(job.conf));
    fillVerdict(job);
    syncFavButtons(job);

    const meta = document.getElementById('dd-found-meta');
    if (meta) {
      meta.innerHTML =
        '<span><em>初次出现</em> ' +
        esc(job.firstSeen) +
        '</span>' +
        '<span class="sep" aria-hidden="true">|</span>' +
        '<span><em>样本数量</em> ' +
        esc(Number(job.sampleCount).toLocaleString('zh-CN')) +
        '</span>' +
        '<span class="sep" aria-hidden="true">|</span>' +
        '<span class="is-up"><em>增长趋势</em> ↑ ' +
        job.growth +
        '% <small>(近6个月)</small></span>';
    }

    const basics = document.getElementById('dd-found-basics');
    if (basics) {
      basics.innerHTML = [
        ['岗位类别', job.direction],
        ['所属行业', job.industry],
        ['岗位层级', job.levelDisplay],
        ['工作地点', job.locationDisplay],
        ['薪资范围', job.salaryDisplay],
        ['证据强度', (job.dataConf || job.conf || '—') + ' / 100']
      ]
        .map(
          (row) =>
            '<div><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>'
        )
        .join('');
    }
    set('dd-found-brief', job.brief || job.positioning || '');

    renderFoundSkills(job);

    mountDuties('found', job);
    bindDutiesOnce();

    renderFoundSupply(job);

    renderFoundTrend();
    renderFoundRadar();
    renderFoundGraph();
    ensureInsightColumn(false);
    enrichFoundInsights(job);
    buildModRail(false);
    switchMod(validMod(false, qs('mod') || activeMod || 'overview'), { syncUrl: true });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        layoutFoundRow();
        runFoundMotion();
        startDutyCarousel('found');
      });
    });
  }

  function layoutFoundRow() {
    const { shell } = dutyEls('found');
    if (shell && shell.closest('.dd-mod-stage')) {
      if (activeMod === 'duties') renderModularDutiesList('found');
      resizeFoundCharts();
      return;
    }
    const st = dutyLanes.found;
    const prevRows = st.visibleRows;
    const prevRowH = st.rowHeight;
    syncDutyViewportHeight('found');
    if (!st.expanded && (st.visibleRows !== prevRows || st.rowHeight !== prevRowH)) {
      buildDutyCarousel('found');
      st.slideIndex = 0;
      applyDutySlide('found', false);
    }
    resizeFoundCharts();
  }

  function runFoundMotion() {
    if (!window.gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      window.gsap.from('.dd-back-bubble', {
        opacity: 0,
        x: -14,
        duration: 0.58,
        ease: 'power2.out',
        clearProps: 'opacity,transform'
      });
      window.gsap.from(
        '.dd-found-hero, #dd-found-verdict, #dd-found-rail, #dd-found-board .dd-panel.is-mod-active',
        {
          opacity: 0,
          y: 16,
          duration: 0.72,
          stagger: 0.045,
          ease: 'power3.out',
          clearProps: 'opacity,transform'
        }
      );
    } catch (_) {}
  }

  function animateCmpLanes() {
    const bars = document.querySelectorAll('#dd-found-radar .dd-cmp-lane .bar.is-job[data-w]');
    const indBars = document.querySelectorAll('#dd-found-radar .dd-cmp-lane .bar.is-ind[data-w]');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap) {
      bars.forEach((b) => {
        b.style.width = b.getAttribute('data-w');
      });
      indBars.forEach((b) => {
        b.style.width = b.getAttribute('data-w');
      });
      return;
    }
    indBars.forEach((b, i) => {
      window.gsap.fromTo(
        b,
        { width: '0%' },
        { width: b.getAttribute('data-w'), duration: 0.62, ease: 'power2.out', delay: 0.12 + i * 0.04 }
      );
    });
    bars.forEach((b, i) => {
      window.gsap.fromTo(
        b,
        { width: '0%' },
        { width: b.getAttribute('data-w'), duration: 0.82, ease: 'power2.out', delay: 0.18 + i * 0.05 }
      );
    });
  }

  function graphSourceData() {
    const related = (currentJob?.related || []).slice().sort((a, b) => b.score - a.score);
    const total = related.reduce((s, r) => s + (Number(r.score) || 0), 0) || 1;
    const items = related.map((r, i) => ({
      name: r.name,
      value: Math.round(((Number(r.score) || 0) / total) * 100),
      note: r.note || '能力路径重叠',
      count: r.count || Math.round(80 + (Number(r.score) || 0) * 2.5),
      overlap: Number(r.score) || 0,
      rank: i + 1
    }));
    const sum = items.reduce((s, x) => s + x.value, 0);
    if (items.length && sum !== 100) items[items.length - 1].value += 100 - sum;
    return items;
  }

  const GRAPH_PIE_COLORS = [
    '#f5d478',
    '#5cb8e8',
    '#e8925a',
    '#6ecf9a',
    '#c49af5',
    '#f07898',
    '#8ab8f5'
  ];

  function dutyVisibleRows(lane) {
    const st = dutyLanes[lane];
    if (st.visibleRows) return st.visibleRows;
    return 3;
  }

  function resizeFoundCharts() {
    requestAnimationFrame(() => {
      try {
        applyGraphPieLayout();
        trendChart && trendChart.resize();
        graphChart && graphChart.resize();
        applyGraphPieLayout();
      } catch (_) {}
    });
  }

  function animateTrendChart() {
    /* 趋势图仅保留入场动画与 CSS 光效，不做持续数据浮动 */
  }

  function renderFoundTrend() {
    const el = document.getElementById('dd-found-trend');
    if (!el || !window.echarts) return;
    const series = seriesForRange(6);
    const badge = document.getElementById('dd-found-trend-badge');
    if (badge) {
      badge.textContent = '强劲 ↑' + series.growthPct + '%';
      badge.classList.toggle('is-surge', series.growthPct >= 80);
    }
    const { labels, heat, demand } = series;
    const lastIdx = heat.length - 1;
    const yMaxL = Math.ceil(Math.max(...heat, 1) / 10) * 10 + 8;
    const yMaxR = Math.ceil(Math.max(...demand, 1) / 10) * 10 + 8;
    if (!trendChart) trendChart = window.echarts.init(el);
    trendChart.setOption({
      backgroundColor: 'transparent',
      animationDuration: 980,
      animationEasing: 'elasticOut',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: { color: 'rgba(212,176,122,0.35)' },
          lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.12)' }
        },
        backgroundColor: 'rgba(10,14,20,0.94)',
        borderColor: 'rgba(212,176,122,0.25)',
        textStyle: { color: '#e8f2f8', fontSize: 11 },
        formatter(params) {
          if (!params || !params.length) return '';
          const idx = params[0].dataIndex;
          return (
            labels[idx] +
            '<br/><span style="color:#e8c988">● 发布量 ' +
            heat[idx] +
            '</span><br/><span style="color:#7ec8f0">● 搜索热度 ' +
            demand[idx] +
            '</span>'
          );
        }
      },
      legend: { show: false },
      grid: { left: 34, right: 34, top: 10, bottom: 16 },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: true,
        axisLine: { lineStyle: { color: 'rgba(212,176,122,0.22)' } },
        axisLabel: {
          color: 'rgba(232,242,248,0.58)',
          fontSize: 10,
          margin: 6,
          formatter(v) {
            return String(v).slice(5);
          }
        },
        axisTick: { show: false }
      },
      yAxis: [
        {
          type: 'value',
          position: 'left',
          min: 0,
          max: yMaxL,
          splitNumber: 3,
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } },
          axisLabel: {
            color: 'rgba(232,201,136,0.62)',
            fontSize: 9,
            margin: 6,
            formatter: '{value}'
          },
          axisLine: { show: false },
          axisTick: { show: false }
        },
        {
          type: 'value',
          position: 'right',
          min: 0,
          max: yMaxR,
          splitNumber: 3,
          splitLine: { show: false },
          axisLabel: {
            color: 'rgba(126,200,240,0.62)',
            fontSize: 9,
            margin: 6,
            formatter: '{value}'
          },
          axisLine: { show: false },
          axisTick: { show: false }
        }
      ],
      series: [
        {
          name: '发布量',
          type: 'bar',
          yAxisIndex: 0,
          data: heat,
          barWidth: '46%',
          barCategoryGap: '28%',
          animationDelay(idx) {
            return idx * 85 + 280;
          },
          itemStyle: {
            borderRadius: [6, 6, 2, 2],
            borderWidth: 1,
            borderColor: 'rgba(255,240,200,0.38)',
            color(p) {
              const isLast = p.dataIndex === lastIdx;
              return {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: isLast
                  ? [
                      { offset: 0, color: '#fff8dc' },
                      { offset: 0.45, color: '#f0d080' },
                      { offset: 1, color: '#a87830' }
                    ]
                  : [
                      { offset: 0, color: '#f5e0a8' },
                      { offset: 0.55, color: '#d4a858' },
                      { offset: 1, color: '#8a6530' }
                    ]
              };
            },
            shadowBlur: 0,
            shadowColor: 'transparent',
            shadowOffsetY: 0
          },
          emphasis: {
            itemStyle: {
              borderColor: 'rgba(255,248,220,0.9)',
              shadowBlur: 8,
              shadowColor: 'rgba(240,208,128,0.35)'
            }
          },
          z: 2
        },
        {
          name: '搜索热度',
          type: 'line',
          yAxisIndex: 1,
          data: demand,
          smooth: 0.42,
          animationDuration: 1100,
          animationDelay: 420,
          animationEasing: 'cubicOut',
          symbol: 'circle',
          symbolSize(_v, p) {
            return p.dataIndex === lastIdx ? 8 : 0;
          },
          showSymbol: true,
          lineStyle: {
            width: 2.2,
            color: '#7ec8f0'
          },
          itemStyle: {
            color: '#0c1218',
            borderColor: '#c8eeff',
            borderWidth: 2
          },
          z: 4
        }
      ]
    }, true);
  }

  function supplyVerdict(ratio) {
    const r = Number(ratio);
    if (r >= 2.5) return { label: '供不应求', tone: 'is-hot', hint: '需求增速显著高于人才供给，招聘竞争偏激烈。' };
    if (r >= 1.6) return { label: '偏紧', tone: 'is-warm', hint: '需求仍在扩张，供给跟进略慢，需提前储备。' };
    return { label: '相对均衡', tone: 'is-ok', hint: '供需节奏接近，可关注结构性缺口而非总量。' };
  }

  function renderFoundSupply(job) {
    const el = document.getElementById('dd-found-supply');
    if (!el || !job.supply) return;
    const ratio = Number(job.supply.ratio) || 1;
    const verdict = supplyVerdict(ratio);
    const gaugePct = Math.min(100, Math.round((ratio / 3.2) * 100));
    const dG = Number(job.supply.demandGrowth) || 0;
    const sG = Number(job.supply.supplyGrowth) || 0;
    const sum = Math.max(dG + sG, 1);
    const dShare = Math.round((dG / sum) * 100);
    const sShare = 100 - dShare;
    const foot = job.evidence?.future
      ? '<p class="dd-supply-foot">' + esc(job.evidence.future) + '</p>'
      : '';
    el.innerHTML =
      '<div class="dd-supply-focus-inner">' +
      '<div class="dd-supply-top">' +
      '<div class="dd-supply-gauge is-compact is-live" style="--gauge:' +
      gaugePct +
      '%" aria-hidden="true">' +
      '<div class="dd-supply-gauge-aura"></div>' +
      '<div class="dd-supply-gauge-aura is-hot"></div>' +
      '<div class="dd-supply-gauge-orbit"></div>' +
      '<div class="dd-supply-gauge-orbit is-reverse"></div>' +
      '<div class="dd-supply-gauge-ring"></div>' +
      '<div class="dd-supply-gauge-sweep"></div>' +
      '<div class="dd-supply-gauge-core">' +
      '<strong class="dd-supply-gauge-num" data-val="' +
      esc(String(job.supply.ratio)) +
      '">0</strong>' +
      '<span>供需比</span></div></div>' +
      '<div class="dd-supply-state">' +
      '<strong class="' +
      verdict.tone +
      '">' +
      esc(verdict.label) +
      '</strong>' +
      '<span class="dd-supply-ratio">需求增速是供给的 ' +
      (sG > 0 ? (dG / sG).toFixed(1) : '—') +
      ' 倍</span></div></div>' +
      '<div class="dd-supply-beam" aria-label="需求与供给增长对比">' +
      '<div class="dd-supply-beam-labels">' +
      '<span>需求 ↑' +
      dG +
      '%</span>' +
      '<span>供给 ↑' +
      sG +
      '%</span></div>' +
      '<div class="dd-supply-beam-track">' +
      '<span class="is-demand" data-w="' +
      dShare +
      '"></span>' +
      '<span class="is-supply" data-w="' +
      sShare +
      '"></span></div></div>' +
      '<p class="dd-supply-read">' +
      esc(verdict.hint) +
      '</p>' +
      foot +
      '<div class="dd-supply-extra">' +
      '<div class="dd-supply-extra-grid">' +
      '<div class="dd-supply-extra-card"><em>需求</em><strong>↑' +
      dG +
      '%</strong><span>企业端扩张</span></div>' +
      '<div class="dd-supply-extra-card"><em>供给</em><strong>↑' +
      sG +
      '%</strong><span>人才池追赶</span></div>' +
      '<div class="dd-supply-extra-card"><em>比值</em><strong>' +
      esc(String(job.supply.ratio)) +
      '</strong><span>需求/供给强度</span></div>' +
      '<div class="dd-supply-extra-card"><em>窗口</em><strong>' +
      esc(verdict.label) +
      '</strong><span>当前阶段判断</span></div></div>' +
      '<ul class="dd-supply-actions">' +
      '<li><b>本周</b> 选 1 个对口作品补量化指标，准备对口投递</li>' +
      '<li><b>本月</b> 用「对比简历报告」锁定优先缺口 2–3 项</li>' +
      '<li><b>持续</b> 每月回看供需比，比值回落则转向做深差异化</li>' +
      '<li><b>谈判</b> 面试强调稀缺组合与可验证结果，而非工具清单</li>' +
      '</ul></div>' +
      '</div>';
    animateSupplyBeam(el);
    animateSupplyGauge(el);
  }

  function animateSupplyGauge(root) {
    if (!root) return;
    const num = root.querySelector('.dd-supply-gauge-num');
    const gauge = root.querySelector('.dd-supply-gauge.is-live');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (num) {
      const target = parseFloat(num.getAttribute('data-val')) || 0;
      if (reduced || !window.gsap) {
        num.textContent = num.getAttribute('data-val');
      } else {
        const proxy = { v: 0 };
        window.gsap.to(proxy, {
          v: target,
          duration: 1.1,
          ease: 'power2.out',
          delay: 0.15,
          onUpdate: function () {
            num.textContent = proxy.v.toFixed(2).replace(/\.?0+$/, '');
          },
          onComplete: function () {
            num.textContent = num.getAttribute('data-val');
          }
        });
      }
    }
    if (gauge && !reduced && window.gsap) {
      window.gsap.fromTo(
        gauge,
        { scale: 0.88, opacity: 0.6 },
        { scale: 1, opacity: 1, duration: 0.75, ease: 'back.out(1.4)', delay: 0.08 }
      );
    }
  }

  function animateSupplyBeam(root) {
    if (!root) return;
    const spans = root.querySelectorAll('.dd-supply-beam-track span[data-w]');
    if (!spans.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    spans.forEach((s, i) => {
      const w = s.getAttribute('data-w') + '%';
      if (reduced || !window.gsap) {
        s.style.width = w;
        return;
      }
      window.gsap.fromTo(
        s,
        { width: '0%' },
        { width: w, duration: 0.85, ease: 'power2.out', delay: 0.2 + i * 0.06 }
      );
    });
  }

  function renderFoundRadar() {
    const el = document.getElementById('dd-found-radar');
    if (!el || !currentJob) return;
    const axes = currentJob.radarAxes || [];
    const job = currentJob.radarJob || [];
    const avg = currentJob.radarAvg || [];
    if (!axes.length) {
      el.innerHTML = '<p class="dd-ind-empty">暂无能力对照数据</p>';
      return;
    }
    let leadCount = 0;
    let deltaSum = 0;
    let maxDelta = -999;
    let maxDeltaName = '';
    axes.forEach((name, i) => {
      const d = (Number(job[i]) || 0) - (Number(avg[i]) || 0);
      if (d > 0) leadCount++;
      deltaSum += d;
      if (d > maxDelta) {
        maxDelta = d;
        maxDeltaName = name;
      }
    });
    const avgDelta = Math.round(deltaSum / axes.length);
    const diffIdx = avgDelta >= 12 ? '高' : avgDelta >= 6 ? '中' : '低';
    const diffCls = avgDelta >= 12 ? 'is-high' : avgDelta >= 6 ? 'is-mid' : 'is-low';
    const maxLabel =
      maxDeltaName.length > 9 ? maxDeltaName.slice(0, 8) + '…' : maxDeltaName;
    const order = axes
      .map((name, i) => ({
        name,
        job: Number(job[i]) || 0,
        avg: Number(avg[i]) || 0,
        delta: (Number(job[i]) || 0) - (Number(avg[i]) || 0)
      }))
      .sort((a, b) => b.delta - a.delta);
    const lanes = order
      .map((row, idx) => {
        const deltaCls = row.delta >= 10 ? 'is-strong' : row.delta >= 4 ? 'is-mid' : 'is-flat';
        const deltaTxt = row.delta > 0 ? '+' + row.delta : String(row.delta);
        const leadCls = idx === 0 && row.delta >= 10 ? ' is-lead' : '';
        return (
          '<div class="dd-cmp-lane' +
          leadCls +
          '" role="listitem">' +
          '<span class="dd-cmp-lane-name" title="' +
          esc(row.name) +
          '">' +
          esc(row.name) +
          '</span>' +
          '<div class="dd-cmp-lane-track" aria-hidden="true">' +
          '<span class="dd-cmp-lane-grid"></span>' +
          '<span class="bar is-ind" data-w="' +
          row.avg +
          '%"></span>' +
          '<span class="bar is-job" data-w="' +
          row.job +
          '%"></span></div>' +
          '<div class="dd-cmp-lane-meta">' +
          '<span class="score is-ind"><em>业</em><b>' +
          row.avg +
          '</b></span>' +
          '<span class="score is-job"><em>本</em><b>' +
          row.job +
          '</b></span>' +
          '<span class="delta ' +
          deltaCls +
          '">' +
          deltaTxt +
          '</span></div></div>'
        );
      })
      .join('');
    el.innerHTML =
      '<div class="dd-ind-cmp">' +
      '<div class="dd-ind-summary">' +
      '<div class="dd-ind-kpi"><span>领先维度</span><strong>' +
      leadCount +
      '/' +
      axes.length +
      '</strong></div>' +
      '<div class="dd-ind-kpi"><span>平均领先</span><strong class="is-gold">+' +
      avgDelta +
      '</strong></div>' +
      '<div class="dd-ind-kpi"><span>最强差值</span><strong>' +
      esc(maxLabel) +
      ' +' +
      maxDelta +
      '</strong></div>' +
      '<div class="dd-ind-kpi ' +
      diffCls +
      '"><span>差异化</span><strong>' +
      diffIdx +
      '</strong></div></div>' +
      '<div class="dd-cmp-lanes-wrap" aria-label="蓝条行业均值，金条本岗位，按领先幅度排序">' +
      '<div class="dd-cmp-lanes" role="list" data-count="' +
      order.length +
      '" style="--cmp-count:' +
      order.length +
      '">' +
      lanes +
      '</div></div></div>';
    requestAnimationFrame(() => {
      animateCmpLanes();
      resizeFoundCharts();
    });
  }

  function paintGraphDetail(item) {
    const detailEl = document.getElementById('dd-found-graph-detail');
    if (!detailEl || !item) return;
    detailEl.classList.add('is-active');
    detailEl.innerHTML =
      '<div class="dd-graph-detail-inner">' +
      '<p class="dd-graph-detail-note">' +
      esc(item.note || '能力路径重叠') +
      '</p>' +
      '<p class="dd-graph-detail-stats">' +
      '跃迁样本 <b>' +
      item.count +
      '</b> 人 · 能力重叠 <b>' +
      item.overlap +
      '</b> · 排名 <b>#' +
      String(item.rank).padStart(2, '0') +
      '</b></p></div>';
  }

  function selectGraphSlice(idx) {
    const data = graphSourceCache;
    if (!data[idx]) return;
    highlightGraphSlice(idx);
    paintGraphDetail(data[idx]);
    const listEl = document.getElementById('dd-found-graph-legend');
    if (listEl) {
      listEl.querySelectorAll('.dd-graph-leg-item').forEach((btn, i) => {
        btn.classList.toggle('is-active', i === idx);
      });
    }
  }

  function renderGraphLegend(data) {
    const listEl = document.getElementById('dd-found-graph-legend');
    if (!listEl) return;
    listEl.style.setProperty('--graph-count', String(data.length || 1));
    listEl.innerHTML = data
      .map(
        (d, i) =>
          '<li><button type="button" class="dd-graph-leg-item' +
          (i === 0 ? ' is-active' : '') +
          '" data-idx="' +
          i +
          '">' +
          '<i class="sw" style="background:' +
          GRAPH_PIE_COLORS[i % GRAPH_PIE_COLORS.length] +
          '"></i>' +
          '<span class="name">' +
          esc(d.name) +
          '</span>' +
          '<span class="pct">' +
          d.value +
          '%</span></button></li>'
      )
      .join('');
    if (!listEl.dataset.bound) {
      listEl.dataset.bound = '1';
      listEl.addEventListener('mouseover', (e) => {
        const btn = e.target.closest('.dd-graph-leg-item');
        if (!btn) return;
        selectGraphSlice(+btn.dataset.idx);
      });
    }
  }

  function graphPieLayout() {
    const el = document.getElementById('dd-found-graph');
    if (!el) return { center: [54, 54], radius: 46 };
    const w = el.clientWidth || 108;
    const h = el.clientHeight || 108;
    const pad = 3;
    const maxR = Math.max(36, Math.min(w - pad * 2, h - pad * 2) / 2);
    return { center: [w / 2, h / 2], radius: maxR };
  }

  function applyGraphPieLayout() {
    const el = document.getElementById('dd-found-graph');
    const host = el && el.closest('.dd-graph-pie-host');
    if (host && el) {
      const size = Math.floor(Math.min(host.clientWidth - 10, host.clientHeight - 10, 152));
      if (size >= 88) {
        el.style.width = size + 'px';
        el.style.height = size + 'px';
      }
    }
    if (!graphChart) return;
    graphChart.resize();
    const layout = graphPieLayout();
    graphChart.setOption({
      series: [{ center: layout.center, radius: layout.radius }]
    });
  }

  function highlightGraphSlice(idx) {
    if (!graphChart) return;
    graphChart.dispatchAction({ type: 'downplay', seriesIndex: 0 });
    graphChart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: idx });
  }

  function bindGraphChartEvents() {
    if (!graphChart) return;
    graphChart.off('mouseover');
    graphChart.on('mouseover', (p) => {
      if (p.seriesType !== 'pie') return;
      selectGraphSlice(p.dataIndex);
    });
  }

  function renderFoundGraph() {
    const el = document.getElementById('dd-found-graph');
    const detailEl = document.getElementById('dd-found-graph-detail');
    const listEl = document.getElementById('dd-found-graph-legend');
    if (!el || !window.echarts || !currentJob) return;
    const data = graphSourceData();
    graphSourceCache = data;
    if (!data.length) {
      el.innerHTML = '<p class="dd-graph-empty">暂无来源路径数据</p>';
      if (listEl) listEl.innerHTML = '';
      if (detailEl) {
        detailEl.classList.remove('is-active');
        detailEl.innerHTML = '<p class="dd-graph-detail-hint">暂无来源数据</p>';
      }
      return;
    }
    renderGraphLegend(data);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!graphChart) graphChart = window.echarts.init(el);
    const layout = graphPieLayout();
    graphChart.setOption({
      backgroundColor: 'transparent',
      color: GRAPH_PIE_COLORS,
      animationDuration: reduced ? 0 : 680,
      animationEasing: 'cubicOut',
      tooltip: { show: false },
      legend: { show: false },
      series: [
        {
          name: '来源占比',
          type: 'pie',
          center: layout.center,
          radius: layout.radius,
          padAngle: 2,
          itemStyle: {
            borderRadius: 3,
            borderColor: 'rgba(6,10,16,0.95)',
            borderWidth: 2
          },
          label: { show: false },
          labelLine: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 4,
            itemStyle: {
              shadowBlur: 12,
              shadowColor: 'rgba(212,176,122,0.38)'
            }
          },
          data: data
        }
      ]
    }, true);
    bindGraphChartEvents();
    selectGraphSlice(0);
    resizeFoundCharts();
  }

  /* ---------- Forecast unified gold board ---------- */
  function levelTone(lv) {
    if (lv === '极高') return 'is-extreme';
    if (lv === '高') return 'is-high';
    if (lv === '中') return 'is-mid';
    return 'is-low';
  }

  function dutyEls(lane) {
    const p = lane === 'fc' ? 'dd-fc' : 'dd-found';
    return {
      shell: document.getElementById(p + '-duties-shell'),
      viewport: document.getElementById(p + '-duties-viewport'),
      track: document.getElementById(p + '-duties'),
      toggle: document.getElementById(p + '-duties-toggle')
    };
  }

  function clearDutyTimers() {
    ['fc', 'found'].forEach((lane) => {
      const st = dutyLanes[lane];
      if (st.timer) {
        clearInterval(st.timer);
        st.timer = null;
      }
    });
  }

  function dutyScore(lane, i) {
    const d = dutyLanes[lane].data;
    return d.scores[i] != null ? d.scores[i] : Math.max(62, 91 - i * 3);
  }

  function dutyItemHtml(lane, d, rankIndex) {
    return (
      '<li class="dd-fc-duty-item">' +
      '<span class="num">' +
      String(rankIndex + 1).padStart(2, '0') +
      '</span>' +
      '<span class="txt">' +
      esc(d) +
      '</span>' +
      '<span class="pct">' +
      dutyScore(lane, rankIndex) +
      '%</span></li>'
    );
  }

  function resetDutyTrackMotion(lane) {
    const { track } = dutyEls(lane);
    if (track && window.gsap) window.gsap.killTweensOf(track);
    if (track) {
      track.style.transform = '';
      if (window.gsap) window.gsap.set(track, { y: 0 });
    }
  }

  function syncDutyViewportHeight(lane) {
    const { viewport, shell } = dutyEls(lane);
    const st = dutyLanes[lane];
    if (!viewport) return;
    const gap = 4;
    const modular = !!(shell && shell.closest('.dd-mod-stage'));

    // Modular detail: never size from unconstrained flex height (causes 20k+px blowup)
    if (modular) {
      st.rowHeight = 40;
      st.visibleRows = Math.min(8, Math.max(4, (st.data.duties || []).length || 4));
      if (shell) shell.style.setProperty('--dd-duty-row-h', '36px');
      viewport.style.height = 'auto';
      viewport.style.maxHeight = 'none';
      viewport.style.flex = '0 0 auto';
      return;
    }

    st.rowHeight = 28 + gap;
    if (st.expanded) {
      viewport.style.removeProperty('height');
      viewport.style.maxHeight = 'min(176px, 30vh)';
    } else if ((lane === 'found' || lane === 'fc') && shell) {
      const { toggle } = dutyEls(lane);
      const toggleH =
        toggle && !toggle.hidden && !st.expanded
          ? Math.max(16, toggle.offsetHeight) + 4
          : 0;
      if (lane === 'fc') {
        viewport.style.removeProperty('height');
        viewport.style.removeProperty('max-height');
        viewport.style.flex = '1 1 0';
        void shell.offsetHeight;
      }
      let avail = Math.max(
        92,
        lane === 'fc' ? viewport.clientHeight || shell.clientHeight - toggleH : shell.clientHeight - toggleH
      );
      // Guard: unconstrained shell height must not drive row size
      if (avail > 280) avail = 120;
      const minRow = lane === 'fc' ? 30 : 28;
      const maxVis = lane === 'fc' ? 5 : 3;
      const vis = Math.max(3, Math.min(maxVis, Math.floor((avail + gap) / (minRow + gap))));
      st.visibleRows = vis;
      const rowH = Math.min(40, Math.max(minRow, Math.floor((avail - gap * (vis - 1)) / vis)));
      st.rowHeight = rowH + gap;
      shell.style.setProperty('--dd-duty-row-h', rowH + 'px');
      if (lane !== 'fc') {
        const exactH = rowH * vis + gap * (vis - 1);
        viewport.style.height = exactH + 'px';
        viewport.style.maxHeight = exactH + 'px';
      }
      const track = viewport.querySelector('.dd-fc-duties-track');
      if (track) {
        track.querySelectorAll('.dd-fc-duty-item').forEach((el) => {
          el.style.setProperty('height', rowH + 'px', 'important');
          el.style.setProperty('min-height', rowH + 'px', 'important');
          el.style.setProperty('max-height', rowH + 'px', 'important');
        });
      }
    } else {
      viewport.style.height = '92px';
      viewport.style.maxHeight = '92px';
      st.visibleRows = 3;
    }
  }

  function renderModularDutiesList(lane) {
    const { track, viewport, shell, toggle } = dutyEls(lane);
    const st = dutyLanes[lane];
    if (!track || !viewport) return;
    if (st.timer) {
      clearInterval(st.timer);
      st.timer = null;
    }
    resetDutyTrackMotion(lane);
    st.expanded = true;
    st.slideIndex = 0;
    const duties = st.data.duties || [];
    track.innerHTML = duties.map((d, i) => dutyItemHtml(lane, d, i)).join('');
    track.style.transform = '';
    if (toggle) {
      toggle.hidden = true;
      toggle.textContent = '查看全部';
    }
    if (shell) {
      shell.classList.add('is-expanded', 'is-mod-static');
      shell.style.removeProperty('--dd-duty-row-h');
    }
    viewport.style.height = 'auto';
    viewport.style.maxHeight = 'none';
    viewport.style.flex = '0 0 auto';
    track.querySelectorAll('.dd-fc-duty-item').forEach((el) => {
      el.style.removeProperty('height');
      el.style.removeProperty('min-height');
      el.style.removeProperty('max-height');
    });
  }

  function layoutFcRow() {
    const { shell } = dutyEls('fc');
    if (shell && shell.closest('.dd-mod-stage')) {
      if (activeMod === 'duties') renderModularDutiesList('fc');
      resizeFcCharts();
      return;
    }
    const st = dutyLanes.fc;
    const prevRows = st.visibleRows;
    const prevRowH = st.rowHeight;
    syncDutyViewportHeight('fc');
    if (!st.expanded && (st.visibleRows !== prevRows || st.rowHeight !== prevRowH)) {
      buildDutyCarousel('fc');
      st.slideIndex = 0;
      applyDutySlide('fc', false);
    }
    resizeFcCharts();
  }

  function applyDutySlide(lane, animate) {
    const st = dutyLanes[lane];
    const { track } = dutyEls(lane);
    if (!track || st.expanded) return;
    const n = st.data.duties.length;
    if (n <= dutyVisibleRows(lane)) return;
    const y = -st.slideIndex * st.rowHeight;
    if (animate && window.gsap) {
      window.gsap.to(track, {
        y: y,
        duration: 0.62,
        ease: 'power2.inOut',
        onComplete: () => {
          if (st.slideIndex >= n) {
            st.slideIndex = 0;
            window.gsap.set(track, { y: 0 });
          }
        }
      });
    } else if (window.gsap) {
      window.gsap.set(track, { y: y });
    } else {
      track.style.transform = 'translate3d(0,' + y + 'px,0)';
    }
  }

  function buildDutyCarousel(lane) {
    const st = dutyLanes[lane];
    const { track, viewport } = dutyEls(lane);
    if (!track) return;
    resetDutyTrackMotion(lane);
    const n = st.data.duties.length;
    const vis = dutyVisibleRows(lane);
    const main = st.data.duties.map((d, i) => dutyItemHtml(lane, d, i)).join('');
    const clone =
      n > vis
        ? st.data.duties
            .slice(0, vis)
            .map((d, i) => dutyItemHtml(lane, d, i))
            .join('')
        : '';
    track.innerHTML = main + clone;
    st.slideIndex = 0;
    if (viewport) {
      viewport.style.height = '';
      viewport.style.maxHeight = '';
    }
    requestAnimationFrame(() => {
      syncDutyViewportHeight(lane);
      const { track } = dutyEls(lane);
      const first = track && track.querySelector('.dd-fc-duty-item');
      if (first && !st.expanded) {
        const gap = 4;
        st.rowHeight = Math.max(st.rowHeight, first.offsetHeight + gap);
      }
      applyDutySlide(lane, false);
    });
  }

  function buildDutyExpanded(lane) {
    const st = dutyLanes[lane];
    const { track } = dutyEls(lane);
    if (!track) return;
    resetDutyTrackMotion(lane);
    track.innerHTML = st.data.duties.map((d, i) => dutyItemHtml(lane, d, i)).join('');
    requestAnimationFrame(() => syncDutyViewportHeight(lane));
  }

  function slideDutyOnce(lane) {
    const st = dutyLanes[lane];
    if (st.expanded || st.data.duties.length <= dutyVisibleRows(lane)) return;
    st.slideIndex += 1;
    applyDutySlide(lane, true);
  }

  function renderDutyView(lane) {
    const st = dutyLanes[lane];
    if (st.expanded) buildDutyExpanded(lane);
    else buildDutyCarousel(lane);
  }

  function syncDutyUi(lane) {
    const st = dutyLanes[lane];
    const { shell, toggle } = dutyEls(lane);
    const n = st.data.duties.length;
    if (shell) shell.classList.toggle('is-expanded', st.expanded);
    if (toggle) {
      toggle.hidden = n <= dutyVisibleRows(lane);
      toggle.textContent = st.expanded ? '收起' : '查看全部';
    }
  }

  function startDutyCarousel(lane) {
    const { shell } = dutyEls(lane);
    if (shell && shell.closest('.dd-mod-stage')) {
      renderModularDutiesList(lane);
      return;
    }
    const st = dutyLanes[lane];
    if (st.timer) {
      clearInterval(st.timer);
      st.timer = null;
    }
    if (st.expanded || st.data.duties.length <= dutyVisibleRows(lane)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    st.timer = setInterval(() => slideDutyOnce(lane), 3000);
  }

  function setDutyExpanded(lane, on) {
    const st = dutyLanes[lane];
    st.expanded = !!on;
    if (st.expanded && st.timer) {
      clearInterval(st.timer);
      st.timer = null;
    }
    syncDutyUi(lane);
    renderDutyView(lane);
    if (!st.expanded) startDutyCarousel(lane);
  }

  function mountDuties(lane, job) {
    const duties = (job.duties || []).filter(Boolean);
    const scores = duties.map((_, i) =>
      job.dutyScores && job.dutyScores[i] != null
        ? job.dutyScores[i]
        : Math.max(62, 91 - i * 3)
    );
    const st = dutyLanes[lane];
    st.data = { duties, scores };
    st.slideIndex = 0;
    st.expanded = false;
    syncDutyUi(lane);
    renderDutyView(lane);
  }

  function bindDutiesOnce() {
    ['fc', 'found'].forEach((lane) => {
      const { toggle } = dutyEls(lane);
      if (!toggle || toggle._dutyBound) return;
      toggle._dutyBound = true;
      toggle.addEventListener('click', () => {
        const st = dutyLanes[lane];
        setDutyExpanded(lane, !st.expanded);
      });
    });
  }

  function skillHeatTier(score) {
    const n = Number(score) || 0;
    if (n >= 85) return 'is-hot';
    if (n >= 72) return 'is-warm';
    return 'is-cool';
  }

  function renderFoundSkills(job) {
    renderSkillConstellation('dd-found-skills', job);
  }

  function renderSkillConstellation(rootId, job) {
    const skillsEl = document.getElementById(rootId);
    if (!skillsEl || !job) return;
    const list = (job.skillScores || []).slice();
    if (!list.length) {
      skillsEl.innerHTML = '<p class="dd-skill-empty">暂无核心能力数据</p>';
      return;
    }
    const rows = Math.max(1, Math.ceil(list.length / 2));
    const items = list
      .map((s, i) => {
        const rank = i + 1;
        const tier = skillHeatTier(s.score);
        return (
          '<li class="dd-skill-item ' +
          tier +
          '" role="listitem" title="' +
          esc(s.name) +
          ' · 需求热度 ' +
          s.score +
          '%">' +
          '<div class="dd-skill-head">' +
          '<em>' +
          String(rank).padStart(2, '0') +
          '</em>' +
          '<span class="nm">' +
          esc(s.name) +
          '</span>' +
          '<b data-heat="' +
          s.score +
          '">0</b>' +
          '</div>' +
          '<div class="dd-skill-track" aria-hidden="true">' +
          '<span class="dd-skill-fill" data-w="' +
          s.score +
          '%"></span>' +
          '</div></li>'
        );
      })
      .join('');
    skillsEl.innerHTML =
      '<div class="dd-skill-ambient" aria-hidden="true">' +
      '<span class="dd-skill-orb is-gold"></span>' +
      '<span class="dd-skill-floor"></span></div>' +
      '<ul class="dd-skill-list" role="list" data-count="' +
      list.length +
      '" style="--skill-rows:' +
      rows +
      '">' +
      items +
      '</ul>';
  }

  function animateSkillConstellation(rootId) {
    const root = document.getElementById(rootId || 'dd-found-skills');
    if (!root) return;
    const items = root.querySelectorAll('.dd-skill-item');
    const scores = root.querySelectorAll('.dd-skill-item b[data-heat]');
    const fills = root.querySelectorAll('.dd-skill-item .dd-skill-fill[data-w]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || !window.gsap) {
      scores.forEach((el) => {
        el.textContent = String(el.getAttribute('data-heat') || 0);
      });
      fills.forEach((f) => {
        f.style.width = f.getAttribute('data-w') || '0%';
      });
      return;
    }

    scores.forEach((el) => {
      el.textContent = '0';
    });
    fills.forEach((f) => {
      f.style.width = '0%';
    });

    window.gsap.from(items, {
      opacity: 0,
      y: 14,
      x: -10,
      duration: 0.62,
      stagger: 0.045,
      delay: 0.38,
      ease: 'power3.out',
      clearProps: 'opacity,transform'
    });

    scores.forEach((el, i) => {
      const target = Number(el.getAttribute('data-heat')) || 0;
      const proxy = { v: 0 };
      window.gsap.to(proxy, {
        v: target,
        duration: 0.92,
        ease: 'power2.out',
        delay: 0.46 + i * 0.042,
        onUpdate() {
          el.textContent = String(Math.round(proxy.v));
        }
      });
    });

    fills.forEach((f, i) => {
      const w = f.getAttribute('data-w') || '0%';
      window.gsap.fromTo(
        f,
        { width: '0%' },
        {
          width: w,
          duration: 1.05,
          ease: 'power2.out',
          delay: 0.5 + i * 0.042
        }
      );
    });
  }

  function animateSkillBars(root) {
    if (!root) return;
    const bars = root.querySelectorAll('b[data-w]');
    if (!bars.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bars.forEach((b, i) => {
      const w = b.getAttribute('data-w') + '%';
      if (reduced || !window.gsap) {
        b.style.width = w;
        return;
      }
      window.gsap.fromTo(
        b,
        { width: '0%' },
        { width: w, duration: 0.72, ease: 'power2.out', delay: 0.04 * i }
      );
    });
  }

  function renderForecast(job) {
    clearDutyTimers();
    const found = document.getElementById('dd-found');
    const forecast = document.getElementById('dd-forecast-shell');
    if (found) found.hidden = true;
    if (forecast) forecast.hidden = false;

    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };

    const title =
      (job.title || '预测岗位') +
      (String(job.title || '').indexOf('预测') >= 0 ? '' : ' (预测)');
    set('dd-fc-title', title);
    set('dd-fc-conf', job.conf + '%');
    fillVerdict(job);
    syncFavButtons(job);

    const meta = document.getElementById('dd-fc-meta');
    if (meta) {
      meta.innerHTML =
        '<span><em>预计出现时间</em> ' +
        esc(job.windowLabel || job.etaDisplay) +
        '</span>' +
        '<span class="sep" aria-hidden="true">|</span>' +
        '<span><em>演化来源</em> ' +
        esc((job.fromRoles && job.fromRoles[0]) || '相邻岗位') +
        ' 等 ' +
        (job.evolveCount || 7) +
        ' 个岗位</span>' +
        '<span class="sep" aria-hidden="true">|</span>' +
        '<span><em>推演联盟</em> ' +
        esc(job.alliance) +
        '</span>';
    }

    const basics = document.getElementById('dd-fc-basics');
    if (basics) {
      basics.innerHTML = [
        ['岗位类别', job.direction],
        ['所属行业', job.industry],
        ['岗位层级', job.levelDisplay],
        ['预计窗口', job.windowLabel || job.etaDisplay],
        ['薪资范围', job.salaryDisplay],
        ['推演联盟', job.alliance || '执图破局预测']
      ]
        .map(
          (row) =>
            '<div><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>'
        )
        .join('');
    }
    set('dd-fc-brief', job.brief || job.positioning || '');

    renderSkillConstellation('dd-fc-skills', job);

    mountDuties('fc', job);
    bindDutiesOnce();
    startDutyCarousel('fc');

    set('dd-fc-risk-lead', job.riskLead || '—');
    const riskList = document.getElementById('dd-fc-risk-list');
    if (riskList) {
      const risks = job.risks || [];
      const tags = ['观测', '政策', '路径', '窗口'];
      riskList.className = 'dd-fc-risk-cards';
      riskList.innerHTML = risks
        .map((r, i) => {
          const sev = i === 0 ? 'is-watch' : i === 1 ? 'is-policy' : 'is-path';
          return (
            '<li class="dd-fc-risk-card ' +
            sev +
            '">' +
            '<span class="dd-fc-risk-tag">' +
            esc(tags[i] || '风险') +
            '</span>' +
            '<p>' +
            esc(r) +
            '</p></li>'
          );
        })
        .join('');
    }

    renderFcSankey();
    renderFcProb();
    renderFcIndustry();
    renderFcSupply();
    ensureInsightColumn(true);
    enrichForecastInsights(job);
    buildModRail(true);
    switchMod(validMod(true, qs('mod') || activeMod || 'overview'), { syncUrl: true });
    requestAnimationFrame(() => {
      layoutFcRow();
      setTimeout(layoutFcRow, 80);
    });
  }

  function disposeFcCharts() {
    try {
      if (fcProbChart) {
        fcProbChart.dispose();
        fcProbChart = null;
      }
      if (fcSupplyChart) {
        fcSupplyChart.dispose();
        fcSupplyChart = null;
      }
    } catch (_) {}
  }

  function resizeFcCharts() {
    requestAnimationFrame(() => {
      try {
        fcProbChart && fcProbChart.resize();
        fcSupplyChart && fcSupplyChart.resize();
      } catch (_) {}
    });
  }

  function renderFcSankey() {
    const el = document.getElementById('dd-fc-sankey');
    if (!el || !currentJob) return;
    const sources = (currentJob.fromRoles || []).slice(0, 6);
    const fusions = currentJob.fusionSkills || ['多智能体编排', 'LLMOps', '安全治理', '企业集成'];
    const target = (currentJob.title || '预测岗位').replace(/\s*\(预测\)\s*$/, '');
    el.innerHTML =
      '<div class="dd-flow-col">' +
      '<span class="dd-flow-h">已有岗位</span>' +
      sources.map((s) => '<span class="dd-flow-pill">' + esc(s) + '</span>').join('') +
      '</div>' +
      '<div class="dd-flow-arrow" aria-hidden="true"><span></span></div>' +
      '<div class="dd-flow-col is-mid">' +
      '<span class="dd-flow-h">能力交汇</span>' +
      fusions.map((s) => '<span class="dd-flow-pill is-fuse">' + esc(s) + '</span>').join('') +
      '</div>' +
      '<div class="dd-flow-arrow" aria-hidden="true"><span></span></div>' +
      '<div class="dd-flow-col is-end">' +
      '<span class="dd-flow-h">预测岗位</span>' +
      '<div class="dd-flow-target"><strong>' +
      esc(target) +
      '</strong><em>能力组合尚未固化为稳定招聘标题</em></div>' +
      '</div>';
  }

  function renderFcIndustry() {
    const el = document.getElementById('dd-fc-industry-chart');
    if (!el || !currentJob) return;
    const list = (currentJob.industries || []).slice().sort((a, b) => b.value - a.value);
    const max = Math.max.apply(
      null,
      list.map((d) => d.value).concat([1])
    );
    const top = list[0];
    const cover = list.slice(0, 3).reduce((s, d) => s + d.value, 0);
    el.innerHTML =
      '<div class="dd-fc-ind-summary">' +
      '<div class="dd-fc-ind-kpi"><span>主落地</span><strong>' +
      esc(top ? top.name : '—') +
      '</strong></div>' +
      '<div class="dd-fc-ind-kpi"><span>前三覆盖</span><strong class="is-gold">' +
      cover +
      '%</strong></div></div>' +
      '<ul class="dd-share-grid is-fc-ind" role="list" style="--share-rows:' +
      Math.max(1, Math.ceil(list.length / 2)) +
      '">' +
      list
        .map((d, i) => {
          const pct = Math.round((d.value / max) * 100);
          return (
            '<li class="dd-share-card' +
            (i === 0 ? ' is-lead' : '') +
            '" role="listitem">' +
            '<div class="dd-share-card-head">' +
            '<em>' +
            String(i + 1).padStart(2, '0') +
            '</em>' +
            '<span class="n">' +
            esc(d.name) +
            '</span>' +
            '<b>' +
            d.value +
            '%</b></div>' +
            '<div class="dd-skill-track" aria-hidden="true">' +
            '<span class="dd-skill-fill" style="width:' +
            pct +
            '%"></span></div></li>'
          );
        })
        .join('') +
      '</ul>';
  }

  function renderFcProb() {
    const el = document.getElementById('dd-fc-prob-chart');
    if (!el || !window.echarts) return;
    const labels = ['3月', '6月', '9月', '12月', '18月', '24月'];
    const data = [18, 32, 48, 66, 84, 96];
    const lastIdx = data.length - 1;
    const badge = document.getElementById('dd-fc-prob-badge');
    if (badge) {
      badge.textContent = '窗口抬升 ↑' + (data[lastIdx] - data[0]) + '%';
      badge.classList.add('is-surge');
    }
    if (!fcProbChart) fcProbChart = window.echarts.init(el);
    fcProbChart.setOption({
      backgroundColor: 'transparent',
      animationDuration: 980,
      animationEasing: 'cubicOut',
      grid: { left: 34, right: 12, top: 12, bottom: 18 },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.12)' }
        },
        backgroundColor: 'rgba(10,14,20,0.94)',
        borderColor: 'rgba(212,176,122,0.25)',
        textStyle: { color: '#e8f2f8', fontSize: 11 },
        formatter(params) {
          if (!params || !params.length) return '';
          const idx = params[0].dataIndex;
          return (
            labels[idx] +
            '<br/><span style="color:#e8c988">● 出现概率 ' +
            data[idx] +
            '%</span>'
          );
        }
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: true,
        axisLabel: { color: 'rgba(232,242,248,0.55)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(212,176,122,0.22)' } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        max: 100,
        splitNumber: 3,
        axisLabel: {
          color: 'rgba(232,201,136,0.58)',
          fontSize: 9,
          formatter: '{value}%'
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [
        {
          name: '出现概率',
          type: 'bar',
          data,
          barWidth: '48%',
          barCategoryGap: '28%',
          animationDelay(idx) {
            return idx * 70 + 220;
          },
          itemStyle: {
            borderRadius: [5, 5, 2, 2],
            borderWidth: 1,
            borderColor: 'rgba(255,240,200,0.32)',
            color(p) {
              const isLast = p.dataIndex === lastIdx;
              return {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: isLast
                  ? [
                      { offset: 0, color: '#fff8dc' },
                      { offset: 0.45, color: '#f0d080' },
                      { offset: 1, color: '#a87830' }
                    ]
                  : [
                      { offset: 0, color: 'rgba(232,201,136,0.88)' },
                      { offset: 1, color: 'rgba(168,120,48,0.55)' }
                    ]
              };
            }
          }
        },
        {
          name: '抬升轨迹',
          type: 'line',
          data,
          smooth: 0.35,
          symbol: 'circle',
          symbolSize(_v, p) {
            return p.dataIndex === lastIdx ? 7 : 0;
          },
          showSymbol: true,
          lineStyle: { width: 2, color: '#7ec8f0' },
          itemStyle: {
            color: '#0c1218',
            borderColor: '#9ad8f5',
            borderWidth: 2
          },
          z: 5
        }
      ]
    }, true);
    resizeFcCharts();
  }

  function renderFcSupply() {
    const el = document.getElementById('dd-fc-supply-chart');
    if (!el || !window.echarts) return;
    const labels = ['0', '6', '12', '18', '24', '30', '36月'];
    const demand = [22, 34, 48, 62, 78, 90, 100];
    const supply = [20, 26, 32, 38, 44, 50, 56];
    const lastIdx = demand.length - 1;
    const gap = demand[lastIdx] - supply[lastIdx];
    if (!fcSupplyChart) fcSupplyChart = window.echarts.init(el);
    fcSupplyChart.setOption({
      backgroundColor: 'transparent',
      animationDuration: 980,
      animationEasing: 'cubicOut',
      legend: { show: false },
      grid: { left: 32, right: 12, top: 14, bottom: 18 },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.12)' }
        },
        backgroundColor: 'rgba(10,14,20,0.94)',
        borderColor: 'rgba(212,176,122,0.25)',
        textStyle: { color: '#e8f2f8', fontSize: 11 },
        formatter(params) {
          if (!params || !params.length) return '';
          const idx = params[0].dataIndex;
          return (
            labels[idx] +
            '<br/><span style="color:#e8c988">● 需求预测 ' +
            demand[idx] +
            '</span><br/><span style="color:#7ec8f0">● 供给预测 ' +
            supply[idx] +
            '</span><br/><span style="color:#f0a35a">△ 缺口 ' +
            (demand[idx] - supply[idx]) +
            '</span>'
          );
        }
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: true,
        axisLabel: { color: 'rgba(232,242,248,0.55)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(212,176,122,0.22)' } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        splitNumber: 3,
        axisLabel: { color: 'rgba(232,201,136,0.58)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [
        {
          name: '需求预测',
          type: 'bar',
          data: demand,
          barWidth: '42%',
          barCategoryGap: '30%',
          animationDelay(idx) {
            return idx * 60 + 180;
          },
          itemStyle: {
            borderRadius: [5, 5, 2, 2],
            borderWidth: 1,
            borderColor: 'rgba(255,240,200,0.28)',
            color(p) {
              const isLast = p.dataIndex === lastIdx;
              return {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: isLast
                  ? [
                      { offset: 0, color: '#fff8dc' },
                      { offset: 0.5, color: '#e8c988' },
                      { offset: 1, color: '#9a7028' }
                    ]
                  : [
                      { offset: 0, color: 'rgba(232,201,136,0.78)' },
                      { offset: 1, color: 'rgba(154,112,40,0.48)' }
                    ]
              };
            }
          }
        },
        {
          name: '供给预测',
          type: 'line',
          data: supply,
          smooth: 0.35,
          symbol: 'circle',
          symbolSize: 5,
          showSymbol: true,
          lineStyle: { width: 2.2, color: '#7ec8f0' },
          itemStyle: {
            color: '#0c1218',
            borderColor: '#9ad8f5',
            borderWidth: 1.5
          },
          markPoint: {
            symbol: 'circle',
            symbolSize: 1,
            label: {
              show: true,
              formatter: '缺口 ' + gap,
              color: '#f0a35a',
              fontSize: 10,
              fontWeight: 700,
              backgroundColor: 'rgba(10,14,20,0.82)',
              borderColor: 'rgba(240,163,90,0.35)',
              borderWidth: 1,
              borderRadius: 4,
              padding: [3, 6]
            },
            data: [{ coord: [labels[lastIdx], demand[lastIdx]], name: 'gap' }]
          },
          z: 5
        }
      ]
    }, true);
    resizeFcCharts();
  }

  function getResumeReport() {
    try {
      const raw = sessionStorage.getItem('zhitu_resume_report');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {
      name: '我的简历报告',
      version: 'v2 · AI算法求职简历',
      score: 88,
      skills: [
        { name: '大模型应用', level: 78 },
        { name: 'RAG 工程', level: 74 },
        { name: 'Python 开发', level: 86 },
        { name: '系统架构', level: 62 },
        { name: '多智能体协同', level: 48 },
        { name: 'LLMOps', level: 40 },
        { name: '安全与治理', level: 35 },
        { name: '企业系统集成', level: 55 }
      ]
    };
  }

  function openResumeCompare() {
    if (!currentJob) return;
    const modal = document.getElementById('dd-resume-modal');
    const body = document.getElementById('dd-resume-body');
    const sub = document.getElementById('dd-resume-sub');
    const titleEl = document.getElementById('dd-resume-title');
    if (!modal || !body) return;
    const resume = getResumeReport();
    const laneTag = currentJob.isForecast ? '预测岗位' : '真实发现岗位';
    if (titleEl) titleEl.textContent = '与我的简历报告对比';
    if (sub) {
      sub.textContent =
        resume.version +
        ' · 对照「' +
        (currentJob.title || '') +
        '」· ' +
        laneTag;
    }

    const scored = (currentJob.skillScores || []).slice(0, 8).map((js) => {
      const hit = (resume.skills || []).find(
        (r) =>
          r.name === js.name ||
          js.name.indexOf(r.name) >= 0 ||
          r.name.indexOf(js.name.slice(0, 3)) >= 0
      );
      const mine = hit ? hit.level : Math.max(20, Math.round(js.score * 0.45));
      const gap = Math.max(0, js.score - mine);
      return { ...js, mine, gap };
    });
    scored.sort((a, b) => b.gap - a.gap);
    const priority = scored.filter((s) => s.gap > 12).slice(0, 3);

    const rows = scored
      .map((js) => {
        const fit = js.gap <= 12 ? '匹配较好' : js.gap <= 28 ? '需补强' : '缺口较大';
        const tone = js.gap <= 12 ? 'is-ok' : js.gap <= 28 ? 'is-warn' : 'is-gap';
        const pri =
          priority.some((p) => p.name === js.name) ?
            '<em class="dd-pri">优先</em>'
          : '';
        return (
          '<div class="dd-resume-row ' +
          tone +
          '"><span class="sk">' +
          pri +
          esc(js.name) +
          '</span><span class="need">岗位 ' +
          js.score +
          '</span><span class="have">简历 ' +
          js.mine +
          '</span><span class="gap">差距 ' +
          js.gap +
          '</span><span class="fit">' +
          fit +
          '</span></div>'
        );
      })
      .join('');

    const matched = scored.filter((s) => s.gap <= 12).length;
    const fitScore = Math.round(
      40 + (matched / Math.max(1, scored.length)) * 45 + resume.score * 0.12
    );

    const priHtml =
      priority.length ?
        '<div class="dd-resume-pri"><span class="lab">建议先补</span>' +
        priority
          .map((p) => '<span class="dd-chip-mini is-gap">' + esc(p.name) + '</span>')
          .join('') +
        '</div>'
      : '<div class="dd-resume-pri is-ok"><span class="lab">当前缺口可控</span><span>可先收藏观察，再按需深挖。</span></div>';

    body.innerHTML =
      '<div class="dd-resume-score"><strong>' +
      fitScore +
      '</strong><span>相对该岗位的适合度（基于简历报告能力画像）</span></div>' +
      priHtml +
      '<div class="dd-resume-cols"><span>能力</span><span>岗位需求</span><span>简历报告</span><span>差距</span><span>结论</span></div>' +
      '<div class="dd-resume-list">' +
      rows +
      '</div>' +
      '<p class="dd-resume-note">对比用于辅助决策，不是录用结论。完善人岗匹配中的简历后，适合度会更准。</p>';

    modal.hidden = false;
    document.body.classList.add('dd-modal-open');
    document.getElementById('dd-resume-match-cta')?.focus?.();
  }

  function closeResumeCompare() {
    const modal = document.getElementById('dd-resume-modal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('dd-modal-open');
  }

  function render(job) {
    currentJob = job;
    const page = document.getElementById('view-discovery-detail');
    page?.classList.toggle('is-forecast', !!job.isForecast);
    page?.classList.toggle('is-found', !job.isForecast);

    document.title =
      '执图破局 · ' + (job.title || '') + (job.isForecast ? ' · 预测详情' : ' · 岗位详情');

    try {
      sessionStorage.setItem('zhitu_disc_lane', job.isForecast ? 'forecast' : 'found');
    } catch (_) {}

    if (job.isForecast) renderForecast(job);
    else renderFoundBoard(job);
    window.DiscoveryFavs &&
      window.DiscoveryFavs.initBar({ activeId: job.id });
    if (job.isForecast) requestAnimationFrame(() => runDetailMotion(true));
    else requestAnimationFrame(() => runFoundMotion());
  }

  function runDetailMotion(isForecast) {
    if (!window.gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      window.gsap.from('.dd-back-bubble', {
        opacity: 0,
        x: -14,
        duration: 0.58,
        ease: 'power2.out',
        clearProps: 'opacity,transform'
      });
      const panelSel = isForecast
        ? '.dd-fc-hero, .dd-verdict--fc, #dd-fc-rail, #dd-fc-board .dd-fc-panel.is-mod-active'
        : '.dd-found-hero, #dd-found-verdict, #dd-found-rail, #dd-found-board .dd-panel.is-mod-active';
      window.gsap.from(panelSel, {
        opacity: 0,
        y: 16,
        duration: 0.72,
        stagger: 0.045,
        ease: 'power3.out',
        clearProps: 'opacity,transform'
      });
    } catch (_) {}
  }

  window.initDiscoveryDetail = function () {
    const urlId = qs('id');
    if (urlId && window.buildMockScanPayload) {
      try {
        const match = findJobInMock(urlId);
        if (match) {
          sessionStorage.setItem('zhitu_disc_job', JSON.stringify(match));
          sessionStorage.setItem(
            'zhitu_disc_lane',
            match.is_forecast || match.status === 'forecast' ? 'forecast' : 'found'
          );
        }
      } catch (_) {}
    }

    render(loadJob());
    bindDutiesOnce();

    document.getElementById('dd-found-fav')?.addEventListener('click', () => {
      if (!currentJob?.id) return;
      const on = toggleFav(currentJob.id, {
        title: currentJob.title,
        lane: currentJob.isForecast ? 'forecast' : 'found',
        conf: currentJob.conf || currentJob.confidence || 0
      });
      syncFavButtons(currentJob);
      toast(on ? '已收藏，可在顶部收藏栏回看' : '已取消收藏');
    });
    document.getElementById('dd-found-compare')?.addEventListener('click', openResumeCompare);
    document.getElementById('dd-found-report')?.addEventListener('click', () => {
      toast('画像报告导出任务已创建（演示）');
    });

    document.getElementById('dd-fc-fav')?.addEventListener('click', () => {
      if (!currentJob?.id) return;
      const on = toggleFav(currentJob.id, {
        title: currentJob.title,
        lane: 'forecast',
        conf: currentJob.conf || currentJob.confidence || 0
      });
      syncFavButtons(currentJob);
      toast(on ? '已收藏，可在顶部收藏栏回看' : '已取消收藏', 'amber');
    });
    document.getElementById('dd-fc-compare')?.addEventListener('click', openResumeCompare);
    document.getElementById('dd-fc-report')?.addEventListener('click', () => {
      toast('预测报告导出任务已创建（演示）', 'amber');
    });
    document.querySelectorAll('[data-close-resume]').forEach((el) => {
      el.addEventListener('click', closeResumeCompare);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeResumeCompare();
    });

    window.addEventListener('resize', () => {
      trendChart && trendChart.resize();
      graphChart && graphChart.resize();
      fcProbChart && fcProbChart.resize();
      fcSupplyChart && fcSupplyChart.resize();
      if (currentJob && !currentJob.isForecast) layoutFoundRow();
      if (currentJob && currentJob.isForecast) layoutFcRow();
    });

    window.addEventListener('discovery-favs-changed', () => {
      if (currentJob) syncFavButtons(currentJob);
    });
  };
})();
