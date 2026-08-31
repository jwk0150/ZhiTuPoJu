/* 执图破局 · 个人仓库（全屏页） */
(function () {
  'use strict';

  var pickMode = false;
  var expanded = {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtTime(ts) {
    if (!ts) return '—';
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return '—';
      var p = function (n) { return n < 10 ? '0' + n : String(n); };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    } catch (_) {
      return '—';
    }
  }

  function snapshot() {
    if (window.ZhituVault && typeof window.ZhituVault.snapshot === 'function') {
      return window.ZhituVault.snapshot();
    }
    return { userId: 'guest', resumes: [], favs: { news: [], discovery: [], forecast: [], match: [] } };
  }

  function sourceLabel(src) {
    if (window.ZhituVault && window.ZhituVault.sourceLabel) return window.ZhituVault.sourceLabel(src);
    return src || '本地';
  }

  function renderFavLane(title, items, emptyHint) {
    var count = items.length;
    var body;
    if (!count) {
      body = '<div class="vault-empty">' + esc(emptyHint) + '</div>';
    } else {
      body = '<div class="vault-grid">' + items.map(function (it) {
        var meta = [];
        if (it.company) meta.push(it.company);
        if (it.city) meta.push(it.city);
        if (it.salary) meta.push(it.salary);
        if (it.match != null) meta.push('匹配 ' + it.match + '%');
        if (it.conf) meta.push('置信 ' + Math.round(Number(it.conf) * (Number(it.conf) <= 1 ? 100 : 1)) + '%');
        return (
          '<a class="vault-item" href="' + esc(it.href || '#') + '">' +
            '<span class="vault-item-k">' + esc(title) + '</span>' +
            '<p class="vault-item-t">' + esc(it.title || '未命名') + '</p>' +
            (meta.length ? '<p class="vault-item-m">' + esc(meta.join(' · ')) + '</p>' : '') +
          '</a>'
        );
      }).join('') + '</div>';
    }
    return (
      '<section class="vault-lane">' +
        '<div class="vault-lane-head">' +
          '<h2 class="vault-lane-title">' + esc(title) + '</h2>' +
          '<span class="vault-lane-count">' + count + '</span>' +
        '</div>' +
        body +
      '</section>'
    );
  }

  function renderFavs(snap) {
    var el = document.getElementById('vault-fav-lanes');
    if (!el) return;
    var f = snap.favs || {};
    el.innerHTML =
      renderFavLane('岗位大新闻', f.news || [], '还没有收藏新闻，去「岗位大新闻」点心形即可。') +
      renderFavLane('新岗位发现', f.discovery || [], '还没有收藏发现岗位。在详情页点「收藏到仓库」即可落入此处。') +
      renderFavLane('新岗位预测', f.forecast || [], '还没有收藏预测岗位。在详情页点「收藏到仓库」即可落入此处。') +
      renderFavLane('人岗匹配', f.match || [], '在人岗匹配结果卡片上点 ★。');
  }

  function useResume(item, versionId) {
    if (!item || !window.ZhituVault) return;
    if (versionId) window.ZhituVault.setCurrentVersion(item.id, versionId);
    item = window.ZhituVault.getVaultResume(item.id) || item;
    var payload = window.ZhituVault.toPayloadFromItem(item);
    window.ZhituVault.saveMatchResume(payload);
    location.href = 'match.html?v=20260826ai1&from=warehouse';
  }

  function parseUploadText(text, fileName) {
    var lines = String(text || '').split(/\r?\n/);
    return {
      sections: [
        { id: 'basic', label: '个人信息', content: lines.slice(0, 8).join('\n') || fileName, ai_suggestion: '' },
        { id: 'education', label: '教育经历', content: '（上传稿）', ai_suggestion: '' },
        { id: 'projects', label: '项目经历', content: lines.slice(8, 40).join('\n') || '—', ai_suggestion: '' },
        { id: 'work', label: '工作经历', content: '—', ai_suggestion: '' },
        { id: 'skills', label: '专业技能', content: '—', ai_suggestion: '' },
        { id: 'summary', label: '自我评价', content: lines.slice(40).join('\n') || '—', ai_suggestion: '' }
      ],
      text: text
    };
  }

  function bindUpload() {
    var input = document.getElementById('vault-upload-input');
    var btn = document.getElementById('vault-upload-btn');
    if (!input || !btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file || !window.ZhituVault) return;
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result || '');
        var parsed = parseUploadText(text, file.name);
        window.ZhituVault.upsertVaultResume({
          id: 'VR-upload-' + Date.now().toString(36),
          source: 'upload',
          fileName: file.name || '上传简历.txt',
          size: file.size || text.length,
          sections: parsed.sections,
          text: parsed.text,
          versionLabel: '上传稿'
        });
        paint();
      };
      reader.readAsText(file, 'utf-8');
      input.value = '';
    });
  }

  function renderResumes(snap) {
    var el = document.getElementById('vault-resume-list');
    if (!el) return;
    var list = snap.resumes || [];
    if (!list.length) {
      el.innerHTML = '<div class="vault-empty">还没有简历。可上传，或通过「简历探索」生成初稿。</div>';
      return;
    }
    el.innerHTML = list.map(function (r) {
      var open = !!expanded[r.id];
      var vers = r.versions || [];
      var histBtn = vers.length
        ? ('<button type="button" class="vault-link" data-expand="' + esc(r.id) + '">' +
            (open ? '收起历史' : ('历史版本 · ' + vers.length)) + '</button>')
        : '';
      var histList = '';
      if (open && vers.length) {
        histList = '<ul class="vault-versions">' + vers.slice().reverse().map(function (v) {
          var cur = v.id === r.currentVersionId;
          return (
            '<li class="vault-ver' + (cur ? ' is-cur' : '') + '">' +
              '<div><b>' + esc(v.label || '版本') + '</b><span>' +
                esc(sourceLabel(v.source)) + ' · ' + esc(fmtTime(v.createdAt)) +
              '</span></div>' +
              '<button type="button" class="vault-btn vault-btn--mini" data-use="' + esc(r.id) + '" data-ver="' + esc(v.id) + '">' +
                (pickMode ? '选用' : (cur ? '当前 · 匹配' : '用此版本匹配')) +
              '</button>' +
            '</li>'
          );
        }).join('') + '</ul>';
      }
      return (
        '<article class="vault-resume" data-id="' + esc(r.id) + '">' +
          '<div>' +
            '<p class="vault-resume-name">' + esc(r.name || r.fileName || '未命名简历') + '</p>' +
            '<p class="vault-resume-meta">' + esc(sourceLabel(r.source)) +
              ' · 创建于 ' + esc(fmtTime(r.createdAt)) +
              ' · 更新 ' + esc(fmtTime(r.updatedAt)) + '</p>' +
            histBtn + histList +
          '</div>' +
          '<div class="vault-resume-actions">' +
            '<button type="button" class="vault-btn" data-use="' + esc(r.id) + '">' +
              (pickMode ? '选用此简历' : '用人岗匹配') +
            '</button>' +
            (pickMode ? '' : '<button type="button" class="vault-btn vault-btn--ghost" data-del="' + esc(r.id) + '">删除</button>') +
          '</div>' +
        '</article>'
      );
    }).join('');

    el.querySelectorAll('[data-expand]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-expand');
        expanded[id] = !expanded[id];
        paint();
      });
    });
    el.querySelectorAll('[data-use]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-use');
        var ver = btn.getAttribute('data-ver');
        var item = list.find(function (x) { return String(x.id) === String(id); });
        useResume(item, ver);
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!window.confirm('确定删除这份简历（含历史版本）？')) return;
        if (window.ZhituVault) window.ZhituVault.removeVaultResume(btn.getAttribute('data-del'));
        paint();
      });
    });
  }

  function bindTabs() {
    var tabs = document.querySelectorAll('.vault-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = tab.getAttribute('data-tab');
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('is-on', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        document.querySelectorAll('.vault-panel').forEach(function (p) {
          var on = p.getAttribute('data-panel') === id;
          p.classList.toggle('is-on', on);
          p.hidden = !on;
        });
      });
    });
  }

  function paint() {
    var snap = snapshot();
    var u = document.getElementById('vault-user');
    if (u) u.textContent = '当前用户 · ' + (snap.userId || 'guest');
    renderFavs(snap);
    renderResumes(snap);
    bindUpload();
  }

  function init() {
    try {
      var params = new URLSearchParams(location.search || '');
      pickMode = params.get('pick') === '1';
    } catch (_) {}
    if (window.ZhituVault && typeof window.ZhituVault.ensureDemoResumes === 'function') {
      try { window.ZhituVault.ensureDemoResumes(); } catch (_) {}
    }
    if (pickMode) {
      var lead = document.getElementById('vault-lead');
      var hint = document.getElementById('vault-resume-hint');
      if (lead) lead.textContent = '请选择一份简历用于人岗匹配（可展开历史优化版本）。';
      if (hint) hint.textContent = '选用后将返回人岗匹配工作台。';
      document.querySelectorAll('.vault-tab').forEach(function (t) {
        var on = t.getAttribute('data-tab') === 'resumes';
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      document.querySelectorAll('.vault-panel').forEach(function (p) {
        var on = p.getAttribute('data-panel') === 'resumes';
        p.classList.toggle('is-on', on);
        p.hidden = !on;
      });
    }
    bindTabs();
    paint();
    window.addEventListener('zhitu-vault-changed', paint);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
