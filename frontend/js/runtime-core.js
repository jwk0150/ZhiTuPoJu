/* Shared runtime extracted for standalone pages */
window.API_BASE = window.API_BASE || ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') ? 'http://127.0.0.1:8000' : location.origin);
window.resolveApiBase = window.resolveApiBase || function () {
  return window.API_BASE || ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') ? 'http://127.0.0.1:8000' : location.origin);
};
window.Utils = {
    rand: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    pick: arr => arr[Math.floor(Math.random() * arr.length)],
    pickN: (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n),
    timeAgo: (date) => {
        const s = Math.floor((new Date() - date) / 1000);
        if (s < 60) return s + '秒前';
        if (s < 3600) return Math.floor(s / 60) + '分钟前';
        if (s < 86400) return Math.floor(s / 3600) + '小时前';
        return Math.floor(s / 86400) + '天前';
    },
    animateNum: (el, target, dur = 1500, decimals = 0) => {
        if (!el) return;
        const start = parseFloat(el.dataset.val || '0') || 0;
        const t0 = Date.now();
        const textNode = [...el.childNodes].find(n => n.nodeType === 3) || el.appendChild(document.createTextNode(''));
        const step = () => {
            const p = Math.min((Date.now() - t0) / dur, 1);
            const v = start + (target - start) * (1 - Math.pow(1 - p, 3));
            textNode.nodeValue = decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString();
            if (p < 1) requestAnimationFrame(step);
            else el.dataset.val = target;
        };
        step();
    },
    showToast: (msg, type = 'mint') => {
        const tone = String(type || 'mint');
        const colors = {
            mint: { bg: 'rgba(16,185,129,.94)', fg: '#fff' },
            teal: { bg: 'rgba(45,212,191,.94)', fg: '#06201c' },
            cyan: { bg: 'rgba(45,212,191,.94)', fg: '#06201c' },
            amber: { bg: 'rgba(245,158,11,.96)', fg: '#1a1205' },
            pink: { bg: 'rgba(247,37,133,.94)', fg: '#fff' },
            coral: { bg: 'rgba(239,68,68,.94)', fg: '#fff' },
            success: { bg: 'rgba(16,185,129,.94)', fg: '#fff' },
            error: { bg: 'rgba(239,68,68,.94)', fg: '#fff' },
            info: { bg: 'rgba(59,130,246,.94)', fg: '#fff' }
        };
        const c = colors[tone] || colors.mint;
        let el = document.getElementById('zhitu-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'zhitu-toast';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        el.className = 'zhitu-toast is-show';
        el.textContent = String(msg || '');
        el.style.background = c.bg;
        el.style.color = c.fg;
        clearTimeout(window.__zhituToastTimer);
        window.__zhituToastTimer = setTimeout(() => {
            el.classList.remove('is-show');
        }, 2400);
    }
};
window.showToast = window.Utils.showToast;
window.closeModal = function () {
  const el = document.getElementById('modal-overlay');
  if (el) el.classList.remove('show');
};
window.Store = window.Store || {
  state: { jobs: [], newJobs: [], skills: [], activities: [] },
  get: function (k) { return this.state[k]; },
  set: function (k, v) { this.state[k] = v; }
};

// ============== ECharts通用配置 ==============
window.chartInstances = {};
window.baseChartOpt = function() {
    return {
        textStyle:{fontFamily:'DM Sans, Noto Sans SC', color:'#475569'},
        grid:{left:50, right:24, top:36, bottom:36, containLabel:true},
        tooltip:{trigger:'axis', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}, padding:[10,14], extraCssText:'box-shadow: 0 4px 20px rgba(0,0,0,.2); border-radius: 8px;'},
        legend:{textStyle:{color:'#475569', fontSize:12}, top:0, right:0}
    };
};
window.disposeChart = function(id) {
    if (window.chartInstances[id]) {
        try { window.chartInstances[id].dispose(); } catch(e){}
        window.chartInstances[id] = null;
    }
};
window.safeChart = function(id) {
    const noop = { setOption(){}, resize(){}, dispose(){} };
    const el = document.getElementById(id);
    if (!el) return noop;
    if (typeof echarts === 'undefined') {
        console.warn('ECharts unavailable');
        return noop;
    }
    window.disposeChart(id);
    if (el.clientWidth < 10) el.style.minHeight = el.style.minHeight || '240px';
    try {
        const chart = echarts.init(el);
        window.chartInstances[id] = chart;
        requestAnimationFrame(() => { try { chart.resize(); } catch(e){} });
        return chart;
    } catch (err) {
        console.warn('ECharts init failed', id, err);
        return noop;
    }
};

// ============== 全局实时更新 ==============


window.generateAllData = window.generateAllData || function () {
  window.Store.state = window.Store.state || {};
  window.Store.state.evolution = true;
  window.Store.state.jobs = window.Store.state.jobs || [];
};
window.viewNames = window.viewNames || {
  evolution: '岗位能力演化',
  learningPath: '学习路径',
  newSkill: '新增技能'
};
window.switchView = window.switchView || function (viewId) {
  // 学习路径 / 新增技能已拆分为独立页面
  if (viewId === 'learningPath') { location.href = 'learning-path.html'; return; }
  if (viewId === 'newSkill') { location.href = 'new-skill.html'; return; }
  if (viewId === 'evolution' || viewId === 'insight') { location.href = 'insight.html'; return; }
  var map = { evolution: 'view-evolution' };
  var target = map[viewId] || ('view-' + viewId);
  document.querySelectorAll('#page-main section.view').forEach(function (v) {
    v.classList.toggle('active', v.id === target);
  });
  if (viewId === 'evolution' && window.initEvolution) window.initEvolution();
};

