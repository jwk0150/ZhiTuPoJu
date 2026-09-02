/* ============================================================
 * 岗位能力演化 · Capability Graph v3 (UI 渲染层)
 * ------------------------------------------------------------
 * 设计核心：
 *   1. 中心辐射的能力图谱（按分类分组，按 demand 大小排）
 *   2. 时间滑块可拖动切换版本，整张图谱随之变化
 *   3. 节点颜色：绿增 / 红删 / 橙调 / 紫预测 / 灰稳定
 * ============================================================ */
(function () {
  'use strict';

  const D = window.EVData;
  const A = window.EVApp || {};
  const $ = A.$ || ((s, r) => (r || document).querySelector(s));
  const $$ = A.$$ || ((s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s)));
  const esc = A.esc || ((s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c])));
  const toast = A.toast || function () {};
  const store = A.store;

  // 当前拖动到的版本索引（基于 VERSIONS）
  const DEFAULT_VERSION_IDX = 3; // V2025.07

  // ============================================================
  // 工具函数
  // ============================================================
  function pad2(n) { return String(n).padStart(2, '0'); }
  function versionDate(vid) {
    const v = D.versionById(vid);
    if (!v || !v.date) return vid;
    const p = v.date.split('-');
    return p[0] + '.' + pad2(parseInt(p[1], 10));
  }
  function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }
  function capCountAt(versionId) {
    const snap = D.getCapabilitySnapshot('Java开发工程师', versionId);
    return snap.skills.filter(s => s.demand > 0 && s.status !== 'hidden' && s.status !== 'deleted').length;
  }

  // 当前版本下,每个 skill 的视觉状态
  function getVisualStatus(skill, versionId) {
    const snap = D.getCapabilitySnapshot('Java开发工程师', versionId);
    const item = snap.skills.find(s => s.id === skill.id);
    if (!item) return 'hidden';
    if (item.demand <= 0) return 'hidden';
    const st = item.status;
    if (st === 'hidden') return 'hidden';
    if (st === 'deleted' || st === 'declining') return 'del';
    if (st === 'added') return 'add';
    if (st === 'modified') return 'mod';
    return 'stable';
  }

  // 用于统计与顶部 5 个胶囊
  function countByStatus(versionId) {
    const snap = D.getCapabilitySnapshot('Java开发工程师', versionId);
    const counts = { add: 0, del: 0, mod: 0, stable: 0 };
    snap.skills.forEach(s => {
      if (s.demand <= 0) return;
      const v = getVisualStatus({ id: s.id }, versionId);
      if (v === 'add') counts.add++;
      else if (v === 'del') counts.del++;
      else if (v === 'mod') counts.mod++;
      else if (v === 'stable') counts.stable++;
    });
    return counts;
  }

  // 预测:在当前版本之后,基于 forecastRanking 取即将加入核心模型的能力
  function countPredictions(versionId) {
    // 简化: 从 forecastRanking 中筛 status==='added' 的未出现在当前 snapshot 中
    const snap = D.getCapabilitySnapshot('Java开发工程师', versionId);
    const visible = new Set(snap.skills.filter(s => s.demand > 0).map(s => s.id));
    const all = D.SKILLS.filter(s => s.status === 'added');
    // 出现在当前 + 后续版本的 added 数(via versionAdded > currentVersion)
    const vs = D.VERSIONS;
    const verIdx = D.versionById(versionId).idx;
    let predCount = 0;
    all.forEach(s => {
      const aIdx = D.versionById(s.versionAdded || versionId).idx;
      if (aIdx > verIdx && !visible.has(s.id)) predCount++;
    });
    return Math.min(predCount, 4);
  }

  // ============================================================
  // 初始化 + 渲染
  // ============================================================
  function init() {
    if (!store) return;
    store.currentVersion = D.VERSIONS[DEFAULT_VERSION_IDX].id;
    store.currentVersionIdx = DEFAULT_VERSION_IDX;
    buildSlider();
    renderCatChips();
    renderJobList();
    renderAll();
    bindGlobalEvents();
    document.dispatchEvent(new CustomEvent('EVViewsReady'));
  }

  function renderAll() {
    renderHeader();
    renderTiers();
    renderGraph();
    renderSideState();
    renderCatChips();   // 同步 chips active 态
    renderJobList();    // 同步岗位列表 active 态
  }

  function renderHeader() {
    setText('gh-version', store.currentVersion);
    setText('gh-maturity', (D.versionById(store.currentVersion).maturity || 76) + '%');
    setText('gs-current-version', store.currentVersion);
    setText('gs-pill-ver', store.currentVersion);
    setText('gs-cap-count', capCountAt(store.currentVersion));
    const mbar = document.getElementById('gs-mat-bar');
    if (mbar) mbar.style.width = (D.versionById(store.currentVersion).maturity || 76) + '%';
    const mnum = document.getElementById('gs-mat-num');
    if (mnum) mnum.textContent = (D.versionById(store.currentVersion).maturity || 76) + '%';
  }

  // ============================================================
  // 时间滑块构建
  // ============================================================
  function buildSlider() {
    const ticksBox = document.getElementById('gs-ticks');
    if (!ticksBox) return;
    const total = D.VERSIONS.length;
    ticksBox.innerHTML = D.VERSIONS.map((v, i) => {
      const cls = ['gs-tick'];
      if (v.isForecast) cls.push('future');
      if (i === DEFAULT_VERSION_IDX) cls.push('active');
      // 绝对定位：6 个 tick 均匀分布
      const pct = total > 1 ? (i / (total - 1)) * 100 : 50;
      const tag = (i === DEFAULT_VERSION_IDX) ? (v.isForecast ? 'PREDICTED' : 'CURRENT') : '';
      return `<div class="${cls.join(' ')}" data-idx="${i}" style="left:${pct.toFixed(2)}%;">
        <span class="dot"></span>
        <span class="lbl">${v.label}${tag ? ' · ' + tag : ''}</span>
      </div>`;
    }).join('');

    // tick click → jump
    $$('.gs-tick', ticksBox).forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        setVersionByIdx(idx);
      });
    });
  }

  function updateSliderUI(idx) {
    const slider = document.getElementById('gs-slider');
    if (slider && parseInt(slider.value, 10) !== idx) slider.value = String(idx);
    const totalSteps = D.VERSIONS.length - 1;
    const progress = document.getElementById('gs-progress');
    if (progress) progress.style.width = ((idx / totalSteps) * 100) + '%';
    $$('.gs-tick').forEach((el, i) => {
      const isActive = i === idx;
      el.classList.toggle('active', isActive);
      const lblEl = el.querySelector('.lbl');
      if (lblEl) {
        const v = D.VERSIONS[i];
        if (isActive) {
          lblEl.textContent = v.label + ' · ' + (v.isForecast ? 'PREDICTED' : 'CURRENT');
        } else {
          lblEl.textContent = v.label;
        }
      }
    });
    // prev/next 按钮 disabled 状态
    const prevBtn = document.getElementById('gs-prev');
    const nextBtn = document.getElementById('gs-next');
    if (prevBtn) prevBtn.disabled = idx <= 0;
    if (nextBtn) nextBtn.disabled = idx >= D.VERSIONS.length - 1;
  }

  function setVersionByIdx(idx) {
    if (idx < 0 || idx >= D.VERSIONS.length) return;
    idx = parseInt(idx, 10);
    const v = D.VERSIONS[idx];
    if (v.isForecast) {
      // 预测版:仍允许查看,但提示
      toast('正在查看预测版本 ' + v.label + '（基于多源趋势外推）', 'gold');
    }
    store.currentVersion = v.id;
    store.currentVersionIdx = idx;
    updateSliderUI(idx);
    renderAll();
  }

  // ============================================================
  // 状态胶囊 (Tiers)
  // ============================================================
  function renderTiers() {
    const counts = countByStatus(store.currentVersion);
    const pred = countPredictions(store.currentVersion);
    setText('t-num-add', counts.add);
    setText('t-num-del', counts.del);
    setText('t-num-mod', counts.mod);
    setText('t-num-stable', counts.stable);
    setText('t-num-pred', pred);
  }

  // ============================================================
  // 图谱渲染（核心）
  // ============================================================
  let currentLayout = null;
  let currentNodeMap = null;
  let prevVisibleSet = new Set();
  let isRendering = false;

  const CAT_LABEL = {
    'AI':     'AI · 人工智能',
    '云原生': 'CLOUD · 云原生',
    '架构':   'ARCH · 架构',
    '后端':   'BACKEND · 后端',
    '数据':   'DATA · 数据',
    '工程化': 'ENG · 工程化',
  };

  // 4 象限布局:基础概念(新增) | 核心方法(稳定/调整) | 练习与辨析(待提升) | 综合与迁移(迁移类)
  // 将原 6 个 category 重新映射到 4 个象限,保留视觉关系
  const QUADRANTS = [
    { key: 'basic',     label: '基础概念',   cn: '基础概念', cats: ['AI'],                 statusFilter: ['add'] },
    { key: 'core',      label: '核心方法',   cn: '核心方法', cats: ['后端', '架构'],       statusFilter: ['mod', 'stable'] },
    { key: 'practice',  label: '练习与辨析', cn: '练习与辨析', cats: ['数据', '工程化'],   statusFilter: ['mod'] },
    { key: 'migrate',   label: '综合与迁移', cn: '综合与迁移', cats: ['云原生'],           statusFilter: ['add', 'mod'] }
  ];

  function renderGraph() {
    const svg = document.getElementById('gg-svg');
    const wrap = document.getElementById('git-graph-side');
    if (!svg || !wrap) return;
    if (isRendering) return;
    isRendering = true;

    // 取当前版本快照
    const snap = D.getCapabilitySnapshot('Java开发工程师', store.currentVersion);
    const visible = snap.skills.filter(s => s.demand > 0 && s.status !== 'hidden' && s.status !== 'deleted');
    visible.sort((a, b) => b.demand - a.demand);
    const top = visible.slice(0, 16);

    // viewBox
    const VBW = 1000, VBH = 600;
    svg.setAttribute('viewBox', `0 0 ${VBW} ${VBH}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const cx = VBW / 2;
    const cy = VBH / 2;
    const CORE_R = 42;       // 核心半径
    const EDGE = 30;         // 边距
    const TITLE_H = 32;      // 标题高度

    // 4 象限可用矩形（避开标题区+核心区）
    function quadRect(key) {
      switch (key) {
        case 'basic':    return { x0: EDGE,                  y0: EDGE + TITLE_H,         x1: cx - 60,         y1: cy - 60 };
        case 'core':     return { x0: cx + 60,               y0: EDGE + TITLE_H,         x1: VBW - EDGE,      y1: cy - 60 };
        case 'practice': return { x0: EDGE,                  y0: cy + 60,                x1: cx - 60,         y1: VBH - EDGE };
        case 'migrate':  return { x0: cx + 60,               y0: cy + 60,                x1: VBW - EDGE,      y1: VBH - EDGE };
      }
    }

    // 把 visible 按 category/status 映射到象限
    const groups = { basic: [], core: [], practice: [], migrate: [] };
    const usedIds = new Set();
    top.forEach(s => {
      const st = getVisualStatus({ id: s.id }, store.currentVersion);
      const cat = s.category || '其他';
      for (const q of QUADRANTS) {
        if (q.cats.includes(cat) && (q.statusFilter.includes(st) || (q.key === 'core' && st === 'stable'))) {
          groups[q.key].push({ ...s, _cat: cat, _status: st });
          usedIds.add(s.id);
          break;
        }
      }
    });
    // 若仍有未分配的,按 demand 分散到对应 category 的第一象限
    top.forEach(s => {
      if (usedIds.has(s.id)) return;
      const cat = s.category || '其他';
      const q = QUADRANTS.find(q => q.cats.includes(cat)) || QUADRANTS[0];
      groups[q.key].push({ ...s, _cat: cat, _status: getVisualStatus({ id: s.id }, store.currentVersion) });
    });

    const nodes = [{
      id: 'center', x: cx, y: cy, r: CORE_R,
      name: 'Java', demand: '', en: 'CORE · 中心节点',
      status: 'center', category: ''
    }];

    // 4 象限内计算节点位置（矩形均布）
    QUADRANTS.forEach(q => {
      const list = groups[q.key].slice().sort((a, b) => b.demand - a.demand).slice(0, 4);
      const b = quadRect(q.key);
      const w = b.x1 - b.x0;
      const h = b.y1 - b.y0;
      list.forEach((s, i) => {
        let x, y;
        if (list.length === 1) { x = (b.x0 + b.x1) / 2; y = (b.y0 + b.y1) / 2; }
        else if (list.length === 2) {
          x = b.x0 + w * (0.30 + 0.40 * i);
          y = (b.y0 + b.y1) / 2;
        } else if (list.length === 3) {
          if (i < 2) {
            x = b.x0 + w * (0.25 + 0.50 * i);
            y = b.y0 + h * 0.32;
          } else {
            x = (b.x0 + b.x1) / 2;
            y = b.y0 + h * 0.78;
          }
        } else {
          x = b.x0 + w * (0.18 + 0.64 * (i % 2));
          y = b.y0 + h * (0.30 + 0.40 * Math.floor(i / 2));
        }
        const r = 22 + Math.min(s.demand, 100) / 6.5;
        const nm = s.short || s.name;
        const displayName = nm.length > 7 ? nm.substring(0, 7) : nm;
        nodes.push({
          id: s.id, x, y, r,
          name: displayName,
          demand: Math.round(s.demand),
          status: s._status,
          category: s._cat,
          quadrant: q.key,
          fullName: s.name,
        });
      });
    });

    currentLayout = nodes;
    currentNodeMap = {};
    nodes.forEach(n => { currentNodeMap[n.id] = n; });

    // 渲染 SVG
    renderSvgEdges(svg, nodes);
    renderSvgNodes(svg, nodes);
    renderQuadrantLabels(wrap, VBW, VBH);

    // 入场动画
    const newIds = new Set(nodes.map(n => n.id));
    $$('.gg-node', svg).forEach(g => {
      const id = g.dataset.id;
      if (!prevVisibleSet.has(id)) g.classList.add('enter');
    });
    prevVisibleSet = newIds;

    isRendering = false;
  }

  // 渲染连线：节点 → 中心；同组相邻节点轻连线
  function renderSvgEdges(svg, nodes) {
    const eg = document.getElementById('gg-edges') || (() => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', 'gg-edges');
      svg.appendChild(g);
      return g;
    })();
    const center = nodes.find(n => n.id === 'center');
    if (!center) return;
    const ns = 'http://www.w3.org/2000/svg';

    // 收集当前 edges
    let html = '';
    nodes.forEach(n => {
      if (n.id === 'center') return;
      const dx = n.x - center.x;
      const dy = n.y - center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // 截取到不进入中心圆和节点圆
      const sx = center.x + (dx / dist) * (center.r + 4);
      const sy = center.y + (dy / dist) * (center.r + 4);
      const ex = center.x + (dx / dist) * (dist - n.r - 4);
      const ey = center.y + (dy / dist) * (dist - n.r - 4);

      const cls = 'gg-edge line-';
      const lineCls = (n.status === 'add' || n.status === 'mod') ? cls + 'mid' :
                       (n.status === 'del') ? cls + 'weak' :
                       cls + 'strong';
      html += `<line class="${lineCls}" x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" />`;
    });

    // 同 category 兄弟节点之间的轻连线
    const byCat = {};
    nodes.forEach(n => {
      if (n.id === 'center') return;
      byCat[n.category] = byCat[n.category] || [];
      byCat[n.category].push(n);
    });
    Object.values(byCat).forEach(arr => {
      for (let i = 0; i < arr.length - 1; i++) {
        const a = arr[i], b = arr[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 200) continue;
        const ax = a.x + (dx / d) * a.r;
        const ay = a.y + (dy / d) * a.r;
        const bx = a.x + (dx / d) * (d - b.r);
        const by = a.y + (dy / d) * (d - b.r);
        html += `<line class="gg-edge line-weak" x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" />`;
      }
    });
    eg.innerHTML = html;
  }

  // 渲染节点
  function renderSvgNodes(svg, nodes) {
    const ng = document.getElementById('gg-nodes') || (() => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', 'gg-nodes');
      svg.appendChild(g);
      return g;
    })();
    const ns = 'http://www.w3.org/2000/svg';

    ng.innerHTML = nodes.map(n => {
      const cls = ['gg-node'];
      if (n.id === 'center') cls.push('center');
      else if (n.status) cls.push('s-' + n.status);
      // 中心节点 - 模仿参考图（红色粗环 + 岗位名 + 0%）
      if (n.id === 'center') {
        return `<g class="${cls.join(' ')}" data-id="center" tabindex="0">
          <circle class="gg-halo" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${(n.r + 10).toFixed(1)}" />
          <circle class="gg-fill" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${(n.r - 2).toFixed(1)}" />
          <circle class="gg-ring" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.r.toFixed(1)}" />
          <text class="gg-name" x="${n.x.toFixed(1)}" y="${(n.y - 1).toFixed(1)}">${esc(n.name)}</text>
          <text class="gg-num" x="${n.x.toFixed(1)}" y="${(n.y + 14).toFixed(1)}">0%</text>
        </g>`;
      }
      // 普通节点 - 模仿参考图：圆环 + 名称 + 底部百分比徽章
      const pct = n.demand; // 0-100
      const pctLabel = `${Math.round(pct)}%`;
      const bw = pctLabel.length * 7 + 12; // 徽章宽度
      const bx = n.x - bw / 2;
      const by = n.y + n.r + 5;
      return `<g class="${cls.join(' ')}" data-id="${esc(n.id)}" tabindex="0">
        <circle class="gg-halo" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${(n.r + 4).toFixed(1)}" />
        <circle class="gg-fill" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${(n.r - 2).toFixed(1)}" />
        <circle class="gg-ring" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.r.toFixed(1)}" />
        <text class="gg-name" x="${n.x.toFixed(1)}" y="${(n.y + 4).toFixed(1)}">${esc(n.name)}</text>
        <g class="gg-pct">
          <rect class="gg-pct-bg" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw}" height="16" rx="8" />
          <text class="gg-pct-label" x="${n.x.toFixed(1)}" y="${(by + 11).toFixed(1)}">${pctLabel}</text>
        </g>
      </g>`;
    }).join('');

    // 事件绑定
    $$('.gg-node', ng).forEach(g => {
      const id = g.dataset.id;
      g.addEventListener('mouseenter', (e) => showTooltip(id, e));
      g.addEventListener('mousemove', (e) => positionTooltip(e));
      g.addEventListener('mouseleave', hideTooltip);
      g.addEventListener('click', () => openNodeDetail(id));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openNodeDetail(id);
        }
      });
    });
  }

  // 4 象限标题(参考图样式：图标 + 中文，置于画布四角内)
  function renderQuadrantLabels(wrap, VBW, VBH) {
    const box = document.getElementById('gg-tier-labels');
    if (!box) return;
    const wrapRect = wrap.querySelector('.gg-canvas-wrap');
    if (!wrapRect) return;
    const W = wrapRect.clientWidth, H = wrapRect.clientHeight;
    const scale = Math.min(W / VBW, H / VBH);
    const offsetX = (W - VBW * scale) / 2;
    const offsetY = (H - VBH * scale) / 2;
    // 4 角内边距（避开圆环节点）
    const positions = {
      basic:    { fx: 0.18,   fy: 0.10, align: 'left'   },     // 左上
      core:     { fx: 0.82,   fy: 0.10, align: 'right'  },     // 右上
      practice: { fx: 0.18,   fy: 0.90, align: 'left'   },     // 左下
      migrate:  { fx: 0.82,   fy: 0.90, align: 'right'  }      // 右下
    };
    const qIcons = { basic: '📘', core: '⚙️', practice: '✏️', migrate: '🚀' };
    box.innerHTML = QUADRANTS.map(q => {
      const p = positions[q.key];
      const screenX = p.fx * VBW * scale + offsetX;
      const screenY = p.fy * VBH * scale + offsetY;
      // 文字对齐方式：左/右边对齐到节点的中心方向
      const translate = p.align === 'right'
        ? 'translate(-100%, -50%)'
        : 'translate(0, -50%)';
      return `<div class="gg-quad-label gg-quad-${q.key}" style="left:${screenX.toFixed(1)}px;top:${screenY.toFixed(1)}px;transform:${translate};">
        <span class="gg-quad-ic">${qIcons[q.key]}</span>
        <span class="cn">${esc(q.cn)}</span>
      </div>`;
    }).join('');
  }

  // Tooltip
  function showTooltip(skillId, e) {
    const tip = document.getElementById('gg-tooltip');
    if (!tip) return;
    const node = currentNodeMap && currentNodeMap[skillId];
    if (!node) return;
    const sid = skillId;
    const statusLabel = { add: '+ 新增', del: '− 移除', mod: '~ 调整', pred: '◇ 预测', stable: '· 稳定', center: 'CENTER · 岗位' };
    const skill = sid === 'center' ? null : D.SKILL_MAP[sid];
    if (!skill) {
      // center node
      tip.innerHTML = `<div class="tt-name">Java 开发工程师</div>
        <div class="tt-en">CORE NODE · 岗位中心</div>
        <div class="tt-status s-stable">${statusLabel.center}</div>
        <div class="tt-row"><span>当前版本</span><b>${esc(store.currentVersion)}</b></div>
        <div class="tt-row"><span>能力项</span><b>${capCountAt(store.currentVersion)}</b></div>`;
    } else {
      const cur = (skill.series || [])[D.versionById(store.currentVersion).idx] || 0;
      const grow = D.futureGrowth ? D.futureGrowth(skill) : 0;
      const rel = Math.min(99, Math.round(42 + cur * 0.52));
      tip.innerHTML = `
        <div class="tt-name">${esc(skill.name)}</div>
        <div class="tt-en">${esc(skill.en || '')} · ${esc(skill.category || '')}</div>
        <div class="tt-status s-${node.status}">${statusLabel[node.status] || node.status}</div>
        <div class="tt-row"><span>需求强度</span><b>${cur}</b></div>
        <div class="tt-row"><span>未来增长</span><b class="${grow >= 0 ? 'up' : 'down'}">${grow >= 0 ? '+' : ''}${grow}%</b></div>
        <div class="tt-row"><span>岗位相关度</span><b>${rel}%</b></div>
        <div class="tt-row"><span>可信度</span><b>${Math.round((skill.confidence || 0.85) * 100)}%</b></div>
      `;
    }
    tip.classList.add('show');
    tip.setAttribute('aria-hidden', 'false');
    positionTooltip(e);
  }

  function positionTooltip(e) {
    const tip = document.getElementById('gg-tooltip');
    if (!tip) return;
    const x = e.clientX, y = e.clientY;
    const w = tip.offsetWidth || 240;
    const h = tip.offsetHeight || 140;
    let left = x + 18, top = y - 12;
    if (left + w > window.innerWidth - 24) left = x - w - 18;
    if (top + h > window.innerHeight - 24) top = y - h - 8;
    if (left < 24) left = 24;
    if (top < 24) top = 24;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function hideTooltip() {
    const tip = document.getElementById('gg-tooltip');
    if (!tip) return;
    tip.classList.remove('show');
    tip.setAttribute('aria-hidden', 'true');
  }

  // 节点详情(右侧面板)
  function openNodeDetail(skillId) {
    if (skillId === 'center') {
      closeNodeDetail();
      // 重置 selected,展示 CURRENT ROLE
      return;
    }
    const info = D.getSkillInfo(skillId);
    if (!info) return;
    store.selectedSkill = skillId;
    const def = document.getElementById('gs-state-default');
    const det = document.getElementById('gs-state-detail');
    if (!def || !det) return;
    def.classList.add('hidden');
    det.classList.remove('hidden');

    setText('gd-name', info.name);
    setText('gd-en', info.en || info.name);
    const map = {
      added: ['+ 新增', 's-add'],
      deleted: ['− 移除', 's-del'],
      modified: ['~ 调整', 's-mod'],
      predicted: ['◇ 预测', 's-pred'],
      stable: ['· 稳定', 's-stable'],
    };
    const sm = map[info.status] || ['· 稳定', 's-stable'];
    const sEl = document.getElementById('gd-status');
    if (sEl) {
      sEl.textContent = sm[0];
      sEl.className = 'gs-detail-status ' + sm[1];
    }
    setText('gd-demand', info.value);
    const growEl = document.getElementById('gd-growth');
    if (growEl) {
      growEl.textContent = (info.growth >= 0 ? '+' : '') + info.growth + '%';
      growEl.classList.toggle('up', info.growth >= 0);
      growEl.classList.toggle('down', info.growth < 0);
    }
    setText('gd-rel', info.rel + '%');
    setText('gd-cat', info.category || '—');
    setText('gd-version', info.firstVersion || '—');
    setText('gd-reason', info.reason || '—');

    const relBox = document.getElementById('gd-related');
    if (relBox) {
      const tags = (info.related || []).map(r => `<span data-skill="${esc(r.id)}">${esc(r.name)}</span>`).join('');
      relBox.innerHTML = tags || '<span style="background:transparent;border:none;color:var(--text-3);">暂未关联</span>';
      $$('#gd-related span[data-skill]').forEach(s => {
        s.addEventListener('click', () => openNodeDetail(s.dataset.skill));
      });
    }

    const evBtn = document.getElementById('gd-ev-btn');
    if (evBtn) evBtn.onclick = () => openEvidenceDrawer(skillId);

    // 面板滚动到顶部
    const side = document.getElementById('git-side');
    if (side) side.scrollTop = 0;

    // 高亮 SVG 节点
    $$('.gg-node').forEach(g => g.classList.toggle('selected', g.dataset.id === skillId));
    hideTooltip();
  }

  function closeNodeDetail() {
    store.selectedSkill = null;
    const def = document.getElementById('gs-state-default');
    const det = document.getElementById('gs-state-detail');
    if (def) def.classList.remove('hidden');
    if (det) det.classList.add('hidden');
    $$('.gg-node.selected').forEach(g => g.classList.remove('selected'));
  }

  // ============================================================
  // 右侧 Side State（默认面板 + 分类构成）
  // ============================================================
  function renderSideState() {
    // 分类构成
    const snap = D.getCapabilitySnapshot('Java开发工程师', store.currentVersion);
    const visible = snap.skills.filter(s => s.demand > 0 && s.status !== 'hidden' && s.status !== 'deleted');
    const byCat = {};
    visible.forEach(s => {
      const cat = s.category || '其他';
      byCat[cat] = (byCat[cat] || 0) + 1;
    });
    const total = visible.length || 1;
    const list = document.getElementById('gs-cat-list');
    if (list) {
      const order = ['AI', '云原生', '架构', '后端', '数据', '工程化'];
      const items = order.filter(c => byCat[c]).map(c => `
        <div class="gs-cat-row">
          <span class="cat-name">${c}</span>
          <span class="cat-bar"><i style="width:${(byCat[c] / total * 100).toFixed(0)}%"></i></span>
          <span class="cat-val">${byCat[c]}</span>
        </div>
      `).join('');
      list.innerHTML = items || '<div class="diff-empty">暂无数据</div>';
    }

    // 节点详情（如果已选中）
    if (store.selectedSkill) openNodeDetail(store.selectedSkill);
  }

  // ============================================================
  // 证据抽屉
  // ============================================================
  function openEvidenceDrawer(skillId) {
    const mask = document.getElementById('git-drawer-mask');
    const dr = document.getElementById('git-drawer');
    if (!mask || !dr) return;
    let evidences = [];
    let title = '数据证据';
    let summaryHTML = '';

    if (skillId) {
      const info = D.getSkillInfo(skillId);
      title = info ? info.name + ' · 数据证据' : '数据证据';
      evidences = D.gatherEvidenceForSkill(skillId);
      if (info) {
        summaryHTML = `
          <div class="gd-summary">
            <h3>${esc(info.name)} <span style="font-family:var(--font-num);font-size:12px;color:var(--text-3);font-weight:400;letter-spacing:0.12em;margin-left:6px;">${esc(info.en || '')}</span></h3>
            <div class="gd-summary-stats">
              <div><span>需求强度</span><b>${info.value}</b></div>
              <div class="${info.growth >= 0 ? '' : 'down'}"><span>未来增长</span><b>${info.growth >= 0 ? '+' : ''}${info.growth}%</b></div>
              <div><span>可信度</span><b>${Math.round((info.confidence || 0.85) * 100)}%</b></div>
            </div>
          </div>
        `;
      }
    } else {
      title = '岗位能力演化 · 数据证据';
      const ids = [];
      const snap = D.getCapabilitySnapshot('Java开发工程师', store.currentVersion);
      snap.skills.slice(0, 10).forEach(s => { if (s.id) ids.push(s.id); });
      evidences = D.gatherEvidenceForChanges(ids);
    }

    setText('gd-title', title);

    const list = (evidences || []).map((e) => {
      const matched = (e.excerpt || '').replace(/「([^」]+)」/g, '<mark>$1</mark>');
      const keywords = (e.keywords || []).map(k => `<span>${esc(k)}</span>`).join('');
      const supports = (e.supports || []).map(s => `<span>${esc(s)}</span>`).join('');
      return `
        <div class="gd-ev-item">
          <div class="gd-evi-head">
            <span class="gd-evi-type">${esc(e.type || '数据')}</span>
            <span class="gd-evi-conf">可信度 ${Math.round((e.confidence || 0.85) * 100)}%</span>
          </div>
          <h4 class="gd-evi-name">${esc(e.name || '')}</h4>
          <div class="gd-evi-meta">
            <span>发布时间 <b>${esc(e.published || '—')}</b></span>
            <span>更新 <b>${esc(e.updated || '—')}</b></span>
            <span>时间窗 <b>${esc(e.timeRange || '—')}</b></span>
            <span>规模 <b>${esc(e.scale || '—')}</b></span>
          </div>
          <p class="gd-evi-excerpt">${matched}</p>
          ${keywords ? `<div class="gd-evi-keywords">${keywords}</div>` : ''}
          ${supports ? `<div class="gd-evi-supports">${supports}</div>` : ''}
          <div class="gd-evi-foot">
            <span>权重 <b>${(e.weight || 0)}%</b></span>
            <span class="gd-evi-weight">来源：${esc(e.id || '—')}</span>
          </div>
        </div>`;
    }).join('');

    const noteBlock = D.isDemo() ? '<div class="gd-foot-note">当前为内置演示证据池；真实数据就绪后自动切换为锚定真实 JD / 报告。</div>' : '';

    const body = document.getElementById('gd-body');
    if (body) {
      body.innerHTML = `
        ${summaryHTML}
        <section class="gd-section">
          <div class="gd-sec-head">
            <span class="en">SOURCES</span>
            <span class="cn">证据来源 (${evidences.length})</span>
          </div>
          <div class="gd-evidence-list">${list || '<div class="diff-empty">暂无证据数据</div>'}</div>
        </section>
        ${noteBlock}
      `;
    }
    mask.classList.add('show');
    dr.classList.add('show');
  }

  function closeEvidenceDrawer() {
    const mask = document.getElementById('git-drawer-mask');
    const dr = document.getElementById('git-drawer');
    if (mask) mask.classList.remove('show');
    if (dr) dr.classList.remove('show');
  }

  // ============================================================
  // 全局事件
  // ============================================================
  function bindGlobalEvents() {
    const slider = document.getElementById('gs-slider');
    if (slider) {
      slider.addEventListener('input', () => {
        setVersionByIdx(parseInt(slider.value, 10));
      });
    }
    const prev = document.getElementById('gs-prev');
    const next = document.getElementById('gs-next');
    if (prev) prev.addEventListener('click', () => setVersionByIdx(store.currentVersionIdx - 1));
    if (next) next.addEventListener('click', () => setVersionByIdx(store.currentVersionIdx + 1));
    const reset = document.getElementById('gs-reset');
    if (reset) reset.addEventListener('click', () => setVersionByIdx(DEFAULT_VERSION_IDX));

    const evBtn = document.getElementById('gs-ev-btn');
    if (evBtn) evBtn.addEventListener('click', () => openEvidenceDrawer(null));

    const back = document.getElementById('gs-detail-back');
    if (back) back.addEventListener('click', closeNodeDetail);

    const mask = document.getElementById('git-drawer-mask');
    const closeBtn = document.getElementById('gd-close');
    if (mask) mask.addEventListener('click', closeEvidenceDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeEvidenceDrawer);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeEvidenceDrawer();
        closeNodeDetail();
        hideTooltip();
      }
    });

    window.addEventListener('resize', () => {
      if (currentLayout) renderGraph();
    });

    // 岗位搜索 + 分类筛选
    const jobSearch = document.getElementById('git-job-search');
    if (jobSearch) {
      jobSearch.addEventListener('input', (e) => {
        STATE.jobSearch = e.target.value || '';
        const clr = document.getElementById('git-job-search-clear');
        if (clr) clr.style.display = STATE.jobSearch ? 'flex' : 'none';
        renderJobList();
      });
    }
    const clearBtn = document.getElementById('git-job-search-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        STATE.jobSearch = '';
        if (jobSearch) { jobSearch.value = ''; jobSearch.focus(); }
        clearBtn.style.display = 'none';
        renderJobList();
      });
    }
  }

  // ============================================================
  // 公开
  // ============================================================
  window.EVViews = {
    init: init,
    renderAll: renderAll,
    renderHeader: renderHeader,
    renderTiers: renderTiers,
    renderGraph: renderGraph,
    renderSideState: renderSideState,
    setVersionByIdx: setVersionByIdx,
    openNodeDetail: openNodeDetail,
    closeNodeDetail: closeNodeDetail,
    openEvidenceDrawer: openEvidenceDrawer,
    closeEvidenceDrawer: closeEvidenceDrawer,
    renderJobList: renderJobList,
    renderCatChips: renderCatChips,
  };

  // ============================================================
  // 岗位搜索/分类筛选（强化版）
  // ============================================================
  // 简化版岗位列表（用于前端交互）
  const JOB_DEFINITIONS = [
    { id: 'Java开发工程师',     name: 'Java 开发工程师',     cat: '后端开发',     tag: 'hot',     growth: '+12%' },
    { id: '前端开发工程师',     name: '前端开发工程师',     cat: '前端开发',     tag: '',        growth: '+18%' },
    { id: 'Python开发工程师',   name: 'Python 开发工程师',   cat: '后端开发',     tag: '',        growth: '+22%' },
    { id: '全栈工程师',         name: '全栈工程师',         cat: '全栈',         tag: 'hot',     growth: '+21%' },
    { id: '算法工程师',         name: '算法工程师',         cat: '人工智能',     tag: 'new',     growth: '+32%' },
    { id: 'AI应用工程师',       name: 'AI 应用工程师',       cat: '人工智能',     tag: 'new',     growth: '+45%' },
    { id: '大模型算法工程师',   name: '大模型算法工程师',   cat: '人工智能',     tag: 'new',     growth: '+55%' },
    { id: 'AI产品经理',         name: 'AI 产品经理',         cat: '产品',         tag: 'new',     growth: '+38%' },
    { id: '数据工程师',         name: '数据工程师',         cat: '数据',         tag: '',        growth: '+9%'  },
    { id: '数据分析师',         name: '数据分析师',         cat: '数据',         tag: '',        growth: '+11%' },
    { id: 'DevOps工程师',       name: 'DevOps 工程师',       cat: '运维',         tag: '',        growth: '+22%' },
    { id: '云原生工程师',       name: '云原生工程师',       cat: '运维',         tag: 'hot',     growth: '+28%' },
    { id: '架构师',             name: '架构师',             cat: '后端开发',     tag: 'hot',     growth: '+13%' },
    { id: '鸿蒙开发工程师',     name: '鸿蒙开发工程师',     cat: '移动端',       tag: 'new',     growth: '+52%' },
    { id: 'iOS开发工程师',      name: 'iOS 开发工程师',      cat: '移动端',       tag: '',        growth: '+6%'  },
    { id: 'Android开发工程师',  name: 'Android 开发工程师',  cat: '移动端',       tag: '',        growth: '+5%'  },
    { id: '嵌入式工程师',       name: '嵌入式工程师',       cat: '嵌入式',       tag: '',        growth: '+8%'  },
    { id: '安全工程师',         name: '安全工程师',         cat: '安全',         tag: '',        growth: '+17%' },
    { id: '测试开发工程师',     name: '测试开发工程师',     cat: '质量',         tag: '',        growth: '+15%' },
    { id: '产品经理',           name: '产品经理',           cat: '产品',         tag: '',        growth: '+7%'  },
    { id: '游戏开发工程师',     name: '游戏开发工程师',     cat: '游戏',         tag: '',        growth: '+4%'  },
    { id: 'UI设计师',           name: 'UI 设计师',           cat: '设计',         tag: '',        growth: '+3%'  },
    { id: '运维工程师',         name: '运维工程师',         cat: '运维',         tag: '',        growth: '+6%'  }
  ];

  const JOB_CATS = (function () {
    const s = new Set();
    JOB_DEFINITIONS.forEach(j => { if (j.cat) s.add(j.cat); });
    return ['全部', ...Array.from(s)];
  })();

  // 当前岗位状态(本页面以 Java 为固定数据源,所以切换仅 UI 高亮生效)
  const STATE = {
    jobId: 'Java开发工程师',
    jobCat: 'all',
    jobSearch: ''
  };

  function renderCatChips() {
    const root = document.getElementById('git-job-cats');
    if (!root) return;
    const current = STATE.jobCat || 'all';
    const html = JOB_CATS.map(cat => {
      const key = cat === '全部' ? 'all' : cat;
      const active = key === current ? ' active' : '';
      let count = 0;
      if (key === 'all') count = JOB_DEFINITIONS.length;
      else count = JOB_DEFINITIONS.filter(j => j.cat === key).length;
      return `<button class="git-cat-chip${active}" type="button" data-cat="${esc(key)}">
        <span class="git-cat-chip-name">${esc(cat)}</span>
        <span class="git-cat-chip-count">${count}</span>
      </button>`;
    }).join('');
    root.innerHTML = html;
    root.querySelectorAll('.git-cat-chip').forEach(el => {
      el.addEventListener('click', () => {
        STATE.jobCat = el.dataset.cat;
        renderCatChips();
        renderJobList();
      });
    });
  }

  function renderJobList() {
    const root = document.getElementById('git-job-list');
    const countEl = document.getElementById('git-job-picker-count');
    if (!root) return;
    const q = (STATE.jobSearch || '').trim().toLowerCase();
    const cat = STATE.jobCat || 'all';
    const list = JOB_DEFINITIONS.filter(j => {
      if (q && !(j.name.toLowerCase().includes(q) || j.cat.toLowerCase().includes(q))) return false;
      if (cat !== 'all' && j.cat !== cat) return false;
      return true;
    });
    if (countEl) {
      countEl.textContent = `${list.length} / ${JOB_DEFINITIONS.length} 个岗位`;
    }
    if (list.length === 0) {
      root.innerHTML = `<div class="git-job-empty"><div class="git-job-empty-ic">🔍</div><div class="git-job-empty-tip">没有匹配的岗位</div></div>`;
      return;
    }
    root.innerHTML = list.map(j => {
      const active = j.id === STATE.jobId ? ' active' : '';
      const tagHtml = j.tag === 'hot' ? '<span class="git-tag git-tag-hot">热门</span>' :
                      j.tag === 'new' ? '<span class="git-tag git-tag-new">新兴</span>' : '';
      return `<div class="git-job-card${active}" data-job="${esc(j.id)}" role="option">
        <div class="git-job-name-row">
          <span class="git-job-name">${esc(j.name)}</span>
          ${tagHtml}
        </div>
        <div class="git-job-cat">${esc(j.cat)}</div>
        <div class="git-job-growth"><b>${esc(j.growth)}</b> <span>需求增长</span></div>
      </div>`;
    }).join('');
    root.querySelectorAll('.git-job-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.job;
        STATE.jobId = id;
        // 当前图谱数据固定为 Java, 点击切换时给出提示
        const realSwitch = (id === 'Java开发工程师' || id === '架构师');
        if (realSwitch) {
          renderAll();
        } else {
          toast('该岗位的图谱数据持续完善中，当前展示"Java 开发工程师"作为参考', 'gold');
          STATE.jobId = 'Java开发工程师';
          renderJobList();
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
  } else {
    setTimeout(init, 0);
  }
})();
