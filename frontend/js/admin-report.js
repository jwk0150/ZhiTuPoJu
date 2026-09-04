(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var number = function (v) { var n = Number(v); return Number.isFinite(n) ? n : 0; };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // 简易数据（与日期相关，按"昨日/今日"差异展示）
  var SOURCES = [
    { name: '智联招聘', value: 1284, delta: '+12.4%' },
    { name: 'BOSS 直聘', value: 1102, delta: '+9.8%' },
    { name: '前程无忧', value: 962, delta: '+6.1%' },
    { name: '猎聘', value: 437, delta: '-3.2%' },
    { name: '拉勾网', value: 286, delta: '+4.5%' }
  ];
  var CITIES = [
    { name: '北京', value: 962 },
    { name: '上海', value: 814 },
    { name: '杭州', value: 642 },
    { name: '深圳', value: 591 },
    { name: '广州', value: 412 }
  ];
  var SKILLS = [
    { name: 'LangChain', value: 218 },
    { name: 'React', value: 196 },
    { name: 'PyTorch', value: 184 },
    { name: 'PostgreSQL', value: 152 },
    { name: 'Kubernetes', value: 134 }
  ];
  var QUALITY = [
    { name: '平均完整度', value: '91.6%', delta: '+0.8%' },
    { name: '字段完整性 Gate', value: '已检查', delta: '12 项' },
    { name: '来源可回溯', value: '已启用', delta: '100%' },
    { name: '事实校验', value: '已启用', delta: '8 项告警' }
  ];
  var AUDIT = [
    { name: '采集相关', value: 18 },
    { name: '账号相关', value: 4 },
    { name: '评测相关', value: 6 },
    { name: '系统相关', value: 9 }
  ];

  var state = { date: today() };

  function today() {
    var d = new Date();
    return d.toISOString().slice(0, 10);
  }
  function yesterday() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  function render() {
    // 概要
    var collected = 4281 + (state.date === today() ? 142 : 0);
    $('#ovCollected').textContent = collected.toLocaleString('zh-CN');
    $('#ovSummary').textContent = state.date === today()
      ? '采集管线正常运行，主要来源增量稳定。'
      : '昨日报告已归档，可作为周报素材继续引用。';
    $('#ovStatus').textContent = '所有可信防线正常运行 · 索引无阻塞';

    // 采集来源
    $('#ovSources').textContent = SOURCES.length + ' 个';
    $('#sourcesList').innerHTML = SOURCES.map(function (s) {
      return '<div class="report-row"><span>' + esc(s.name) + '</span><b>' + esc(s.value.toLocaleString('zh-CN')) + ' · ' + esc(s.delta) + '</b></div>';
    }).join('');

    // 城市
    $('#ovCities').textContent = CITIES.length + ' 城';
    $('#citiesList').innerHTML = CITIES.map(function (c) {
      return '<div class="report-row"><span>' + esc(c.name) + '</span><b>' + esc(c.value.toLocaleString('zh-CN')) + '</b></div>';
    }).join('');

    // 技能
    $('#ovSkills').textContent = SKILLS.length + ' 项';
    $('#skillsList').innerHTML = SKILLS.map(function (s, i) {
      return '<div class="report-row"><span><span class="report-rank">' + (i + 1) + '</span>' + esc(s.name) + '</span><b>' + esc(s.value) + ' 次</b></div>';
    }).join('');

    // 质量
    $('#ovQuality').textContent = '91.6%';
    $('#qualityList').innerHTML = QUALITY.map(function (q) {
      return '<div class="report-row"><span>' + esc(q.name) + '</span><b>' + esc(q.value) + ' · ' + esc(q.delta) + '</b></div>';
    }).join('');

    // 审计
    var auditTotal = AUDIT.reduce(function (a, b) { return a + b.value; }, 0);
    $('#ovAudits').textContent = auditTotal;
    $('#auditList').innerHTML = AUDIT.map(function (a) {
      return '<div class="report-row"><span>' + esc(a.name) + '</span><b>' + esc(a.value) + ' 条</b></div>';
    }).join('');

    $('#reportDate').value = state.date;
    $('#lastSync').textContent = state.date + ' 09:00';
  }

  function buildMarkdown() {
    var lines = [];
    lines.push('# 运营日报 · ' + state.date);
    lines.push('');
    lines.push('## 概要');
    lines.push('- 采集岗位：' + $('#ovCollected').textContent);
    lines.push('- 状态：' + $('#ovStatus').textContent);
    lines.push('');
    lines.push('## 数据采集');
    SOURCES.forEach(function (s) { lines.push('- ' + s.name + '：' + s.value + ' · ' + s.delta); });
    lines.push('');
    lines.push('## 岗位结构（TOP 5 城市）');
    CITIES.forEach(function (c) { lines.push('- ' + c.name + '：' + c.value); });
    lines.push('');
    lines.push('## 能力热点');
    SKILLS.forEach(function (s, i) { lines.push((i + 1) + '. ' + s.name + ' · ' + s.value + ' 次'); });
    lines.push('');
    lines.push('## 质量与可信');
    QUALITY.forEach(function (q) { lines.push('- ' + q.name + '：' + q.value + ' · ' + q.delta); });
    lines.push('');
    lines.push('## 审计摘要');
    AUDIT.forEach(function (a) { lines.push('- ' + a.name + '：' + a.value + ' 条'); });
    return lines.join('\n');
  }

  function buildJson() {
    return JSON.stringify({
      date: state.date,
      overview: { collected: $('#ovCollected').textContent, status: $('#ovStatus').textContent },
      ingestion: SOURCES,
      cities: CITIES,
      skills: SKILLS,
      quality: QUALITY,
      audit: AUDIT,
      generatedAt: new Date().toISOString()
    }, null, 2);
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1500);
  }

  function copyMarkdown() {
    var md = buildMarkdown();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).then(function () { toast('Markdown 已复制到剪贴板'); }, function () { fallbackCopy(md); });
    } else { fallbackCopy(md); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Markdown 已复制'); } catch (_) { toast('复制失败，请手动选择'); }
    ta.remove();
  }

  function toast(message) {
    var host = $('#toastHost');
    if (!host) return;
    var item = document.createElement('div');
    item.className = 'toast';
    item.textContent = message;
    host.appendChild(item);
    setTimeout(function () { item.classList.add('is-leaving'); setTimeout(function () { item.remove(); }, 220); }, 2200);
  }

  function bindEvents() {
    if (window.__admin403) return;
    $$('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = btn.getAttribute('data-preset');
        if (p === 'today') state.date = today();
        else if (p === 'yesterday') state.date = yesterday();
        else if (p === '7d') state.date = today();
        render();
      });
    });
    $('#reportDate').addEventListener('change', function (e) { state.date = e.target.value; render(); });
    $$('[data-exp]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = btn.getAttribute('data-exp');
        if (t === 'pdf') { window.print(); toast('已打开打印对话框 · 选择「另存为 PDF」'); }
        else if (t === 'json') { download('daily-report-' + state.date + '.json', buildJson(), 'application/json;charset=utf-8'); toast('JSON 已下载'); }
        else if (t === 'md') { copyMarkdown(); }
      });
    });
    $('#refreshBtn').addEventListener('click', function () { render(); toast('日报已重新生成'); });

    // 顶部身份 / 移动端
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

  function init() { bindEvents(); render(); }
  window.refreshData = function () { render(); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();