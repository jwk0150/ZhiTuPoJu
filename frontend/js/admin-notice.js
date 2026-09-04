(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var number = function (v) { var n = Number(v); return Number.isFinite(n) ? n : 0; };

  var NOTICES = [
    { id: 'N-2401', title: '关于 9 月 3 日数据采集延迟的说明', type: '运营', audience: '全部用户', status: 'published', time: '2026-09-03 22:30', reads: 1862, content: '9 月 3 日下午猎聘来源出现规则匹配异常，运维团队已介入并补充了来源正则，影响范围仅限猎聘相关岗位的增量字段。' },
    { id: 'N-2400', title: '「执图破局」v3.1 版本发布说明', type: '版本', audience: '全部用户', status: 'published', time: '2026-09-02 10:00', reads: 3241, content: '本次更新带来全新的管理运营中枢、新增岗位池与图谱探索页面，并对账号管理流程做了体验优化。' },
    { id: 'N-2399', title: '本周日凌晨数据库例行维护通知', type: '维护', audience: '全部用户', status: 'published', time: '2026-09-01 16:42', reads: 1248, content: '9 月 6 日（周日）02:00 - 04:00 进行数据库例行维护，期间岗位检索与人岗匹配可能出现 1-2 分钟延迟。' },
    { id: 'N-2398', title: '人岗匹配算法优化预告', type: '公告', audience: '仅企业用户', status: 'scheduled', time: '2026-09-08 09:00', reads: 0, content: '下周将上线新版匹配算法，结合岗位能力图谱与候选人技能链路，给出可解释的匹配分。' },
    { id: 'N-2397', title: '关于隐私政策的更新说明', type: '公告', audience: '全部用户', status: 'draft', time: '', reads: 0, content: '我们对隐私政策做了进一步说明，扩展了数据使用的边界条件，并新增了用户主动删除的快捷入口。' }
  ];

  var state = { status: 'all' };

  function renderList() {
    var list = NOTICES.filter(function (n) { return state.status === 'all' || n.status === state.status; });
    if (!list.length) {
      $('#noticeList').innerHTML = '<div class="notice-empty">当前状态下没有公告 · 试试切换筛选</div>';
      return;
    }
    var labelMap = { published: '已发布', scheduled: '已排期', draft: '草稿' };
    $('#noticeList').innerHTML = list.map(function (n) {
      return '<article class="notice-item" data-id="' + esc(n.id) + '">'
        + '<div class="notice-item-head"><strong>' + esc(n.title) + '</strong><time>' + esc(n.time || '待排期') + '</time></div>'
        + '<p>' + esc(n.content) + '</p>'
        + '<div class="notice-item-meta"><span>· ' + esc(n.type) + '</span><span>· ' + esc(n.audience) + '</span><span>· ' + labelMap[n.status] + '</span><span style="margin-left:auto">阅读 ' + number(n.reads).toLocaleString('zh-CN') + '</span></div>'
        + '</article>';
    }).join('');
    renderStats();
  }

  function renderStats() {
    $('#statTotal').textContent = NOTICES.filter(function (n) { return n.status === 'published'; }).length;
    $('#statScheduled').textContent = NOTICES.filter(function (n) { return n.status === 'scheduled'; }).length;
    $('#statDrafts').textContent = NOTICES.filter(function (n) { return n.status === 'draft'; }).length;
    $('#statReads').textContent = NOTICES.reduce(function (a, n) { return a + number(n.reads); }, 0).toLocaleString('zh-CN');
  }

  function renderPreview() {
    $('#previewTitle').textContent = $('#noticeTitle').value.trim() || '公告标题';
    $('#previewContent').textContent = $('#noticeContent').value.trim() || '在左侧输入内容后，这里会实时显示用户端看到的公告样式。';
    $('#previewType').textContent = $('#noticeType').value;
    $('#previewAudience').textContent = $('#noticeAudience').value;
  }

  function toast(message, tone) {
    var host = $('#toastHost');
    if (!host) return;
    var item = document.createElement('div');
    item.className = 'toast' + (tone ? ' is-' + tone : '');
    item.textContent = message;
    host.appendChild(item);
    setTimeout(function () { item.classList.add('is-leaving'); setTimeout(function () { item.remove(); }, 220); }, 2200);
  }

  function publish(status) {
    var title = $('#noticeTitle').value.trim();
    var content = $('#noticeContent').value.trim();
    if (!title || !content) { toast('标题和正文不能为空', 'w'); return; }
    var id = 'N-' + (2402 + NOTICES.length - 5);
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var time = status === 'scheduled'
      ? ($('#noticeSchedule').value ? $('#noticeSchedule').value.replace('T', ' ') : now.toISOString().slice(0, 16))
      : now.toISOString().slice(0, 16);
    NOTICES.unshift({
      id: id,
      title: title,
      type: $('#noticeType').value,
      audience: $('#noticeAudience').value,
      status: status,
      time: time,
      reads: 0,
      content: content
    });
    renderList();
    var msg = status === 'draft' ? '已保存为草稿' : (status === 'scheduled' ? '已加入排期' : '公告已发布');
    toast(msg);
    // 清空标题与正文
    if (status !== 'draft') {
      $('#noticeTitle').value = '';
      $('#noticeContent').value = '';
      renderPreview();
    }
  }

  function bindEvents() {
    if (window.__admin403) return;
    $('#statusChips').addEventListener('click', function (e) {
      var c = e.target.closest('.chip');
      if (!c) return;
      $$('#statusChips .chip').forEach(function (x) { x.classList.remove('is-active'); });
      c.classList.add('is-active');
      state.status = c.getAttribute('data-status');
      renderList();
    });
    ['noticeTitle', 'noticeContent', 'noticeType', 'noticeAudience'].forEach(function (id) {
      $('#' + id).addEventListener('input', renderPreview);
      $('#' + id).addEventListener('change', renderPreview);
    });
    $('#noticeForm').addEventListener('submit', function (e) { e.preventDefault(); publish('published'); });
    $('#saveDraft').addEventListener('click', function () { publish('draft'); });
    $('#scheduleBtn').addEventListener('click', function () { publish('scheduled'); });
    $('#newNoticeBtn').addEventListener('click', function () {
      $('#noticeTitle').focus();
      $('#noticeTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $('#refreshBtn').addEventListener('click', function () { renderList(); toast('公告列表已刷新'); });

    // 顶部身份 / 移动端
    var user = {}; try { user = JSON.parse(localStorage.getItem('zhitu_user') || '{}') || {}; } catch (_) {}
    var name = user.name || user.username;
    var role = String(user.role || '').toLowerCase();
    var isAdmin = role === 'admin';
    $('#userChip').textContent = name ? name + (isAdmin ? ' · ADMIN' : '') : '未登录 · READ ONLY';
    $('#operatorName').textContent = name || '演示值班员';
    $('#operatorRole').textContent = isAdmin ? 'ADMIN / OPERATOR' : 'ADMIN / OBSERVER';
    $('#lastSync').textContent = new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    $('#sideUpdated').textContent = '同步于 ' + new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    var sidebar = $('#adminSidebar');
    var scrim = $('#navScrim');
    function closeNav() { sidebar.classList.remove('is-open'); scrim.classList.remove('is-open'); }
    $('#openNav').addEventListener('click', function () { sidebar.classList.add('is-open'); scrim.classList.add('is-open'); });
    $('#closeNav').addEventListener('click', closeNav);
    scrim.addEventListener('click', closeNav);
  }

  function init() { bindEvents(); renderList(); renderPreview(); }
  window.refreshData = function () { renderList(); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();