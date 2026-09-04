/* 执图破局 · 个人仓库（全屏页） */
(function () {
  'use strict';

  var pickMode = false;
  var expanded = {};

  var LANE_META = {
    news: {
      title: '岗位大新闻',
      emptyTitle: '还没有收藏新闻',
      emptyDesc: '在新闻列表或详情页点「收藏」，行业动态会集中显示在这里。',
      href: 'news/index.html',
      cta: '去看岗位大新闻',
      quickDesc: '行业动态与政策解读'
    },
    discovery: {
      title: '新岗位发现',
      emptyTitle: '还没有收藏发现岗位',
      emptyDesc: '在发现详情页点「收藏到仓库」，新兴岗位会归入此栏。',
      href: 'discovery.html',
      cta: '去发现新岗位',
      quickDesc: '新兴岗位与趋势线索'
    },
    forecast: {
      title: '新岗位预测',
      emptyTitle: '还没有收藏预测岗位',
      emptyDesc: '在预测详情页收藏后，未来方向岗位会保存在这里。',
      href: 'discovery-forecast.html',
      cta: '去看岗位预测',
      quickDesc: '未来方向与能力要求'
    },
  };

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

  function fmtDateShort(ts) {
    if (!ts) return '';
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      var p = function (n) { return n < 10 ? '0' + n : String(n); };
      return p(d.getMonth() + 1) + '月' + p(d.getDate()) + '日';
    } catch (_) {
      return '';
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

  function favTotal(f) {
    f = f || {};
    return (f.news || []).length + (f.discovery || []).length + (f.forecast || []).length + (f.match || []).length;
  }

  function lastActivityTs(snap) {
    var max = 0;
    var f = snap.favs || {};
    ['news', 'discovery', 'forecast'].forEach(function (key) {
      (f[key] || []).forEach(function (it) {
        if (it.savedAt && it.savedAt > max) max = it.savedAt;
      });
    });
    (snap.resumes || []).forEach(function (r) {
      if (r.updatedAt && r.updatedAt > max) max = r.updatedAt;
      if (r.createdAt && r.createdAt > max) max = r.createdAt;
    });
    return max;
  }

  function renderStats(snap) {
    var el = document.getElementById('vault-stats');
    if (!el) return;
    var f = snap.favs || {};
    var total = favTotal(f);
    var resumes = (snap.resumes || []).length;
    var last = lastActivityTs(snap);
    el.innerHTML =
      '<div class="vault-stat">' +
        '<span class="vault-stat-n">' + total + '</span>' +
        '<span class="vault-stat-l">收藏条目</span>' +
      '</div>' +
      '<div class="vault-stat">' +
        '<span class="vault-stat-n">' + resumes + '</span>' +
        '<span class="vault-stat-l">简历档案</span>' +
      '</div>' +
      '<div class="vault-stat">' +
        '<span class="vault-stat-n vault-stat-n--text">' + (last ? fmtDateShort(last) : '暂无') + '</span>' +
        '<span class="vault-stat-l">最近更新</span>' +
      '</div>';
  }

  function renderQuickLinks(snap) {
    var el = document.getElementById('vault-quick');
    if (!el) return;
    var f = snap.favs || {};
    el.innerHTML = Object.keys(LANE_META).map(function (key) {
      var meta = LANE_META[key];
      var count = (f[key] || []).length;
      return (
        '<a class="vault-quick-card" href="' + esc(meta.href) + '">' +
          '<span class="vault-quick-title">' + esc(meta.title) + '</span>' +
          '<span class="vault-quick-desc">' + esc(meta.quickDesc) + '</span>' +
          '<span class="vault-quick-meta">已收藏 ' + count + ' 条</span>' +
        '</a>'
      );
    }).join('');
  }

  function renderEmptyLane(meta) {
    return (
      '<div class="vault-empty-rich">' +
        '<p class="vault-empty-title">' + esc(meta.emptyTitle) + '</p>' +
        '<p class="vault-empty-desc">' + esc(meta.emptyDesc) + '</p>' +
        '<a class="vault-empty-cta" href="' + esc(meta.href) + '">' + esc(meta.cta) + ' →</a>' +
      '</div>'
    );
  }

  function renderFavLane(laneKey, items) {
    var meta = LANE_META[laneKey] || { title: laneKey, emptyTitle: '暂无内容', emptyDesc: '', href: '#', cta: '去看看' };
    var title = meta.title;
    var count = items.length;
    var body;
    if (!count) {
      body = renderEmptyLane(meta);
    } else {
      body = '<div class="vault-grid">' + items.map(function (it) {
        var metaLine = [];
        if (it.company) metaLine.push(it.company);
        if (it.city) metaLine.push(it.city);
        if (it.salary) metaLine.push(it.salary);
        if (it.match != null) metaLine.push('匹配度 ' + it.match + '%');
        if (it.conf) metaLine.push('置信度 ' + Math.round(Number(it.conf) * (Number(it.conf) <= 1 ? 100 : 1)) + '%');
        var tag = fmtDateShort(it.savedAt) ? ('收藏于 ' + fmtDateShort(it.savedAt)) : title;
        return (
          '<a class="vault-item" href="' + esc(it.href || '#') + '">' +
            '<span class="vault-item-k">' + esc(tag) + '</span>' +
            '<p class="vault-item-t">' + esc(it.title || '未命名') + '</p>' +
            (metaLine.length ? '<p class="vault-item-m">' + esc(metaLine.join(' · ')) + '</p>' : '') +
            ((laneKey === 'discovery' || laneKey === 'forecast') ?
              '<span class="vault-item-jumps" style="display:flex;gap:6px;margin-top:10px">' +
                '<span role="button" tabindex="0" onclick="event.preventDefault();event.stopPropagation();try{localStorage.setItem(\'zhitu_last_insight_job\', \'' + esc(it.title || '').replace(/'/g, "\\'") + '\')}catch(_){};location.href=\'evolution.html?v=2&job=\' + encodeURIComponent(\'' + esc(it.title || '') + '\')" style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;border:1px solid rgba(212,175,55,.5);background:rgba(255,252,245,.95);color:#8F6B0E;font-size:11.5px;font-weight:600;cursor:pointer">◈ 洞察该岗位</span>' +
                '<span role="button" tabindex="0" onclick="event.preventDefault();event.stopPropagation();location.href=\'map.html?v=fix25c5&layer=graph&job=\' + encodeURIComponent(\'' + esc(it.title || '') + '\')" style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;border:1px solid rgba(119,141,169,.5);background:rgba(248,250,253,.95);color:#33557a;font-size:11.5px;font-weight:600;cursor:pointer">◱ 技能要求图谱</span>' +
              '</span>' : '') +
          '</a>'
        );
      }).join('') + '</div>';
    }
    return (
      '<section class="vault-lane">' +
        '<div class="vault-lane-head">' +
          '<h2 class="vault-lane-title">' + esc(title) + '</h2>' +
          '<span class="vault-lane-count">' + count + ' 条</span>' +
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
      renderFavLane('news', f.news || []) +
      renderFavLane('discovery', f.discovery || []) +
      renderFavLane('forecast', f.forecast || []);
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

  function renderResumeEmpty() {
    return (
      '<div class="vault-empty-rich vault-empty-rich--wide">' +
        '<p class="vault-empty-title">还没有简历档案</p>' +
        '<p class="vault-empty-desc">可以通过简历探索填写各模块内容，也可以直接上传已有 txt 文件。每次保存都会留档，方便对比不同版本。</p>' +
        '<div class="vault-empty-actions">' +
          '<a class="vault-empty-cta" href="resume.html">打开简历探索 →</a>' +
          '<button type="button" class="vault-btn vault-btn--ghost" id="vault-empty-upload">上传简历文件</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderResumes(snap) {
    var el = document.getElementById('vault-resume-list');
    if (!el) return;
    var list = snap.resumes || [];
    if (!list.length) {
      el.innerHTML = renderResumeEmpty();
      var emptyBtn = document.getElementById('vault-empty-upload');
      if (emptyBtn) {
        emptyBtn.addEventListener('click', function () {
          var input = document.getElementById('vault-upload-input');
          if (input) input.click();
        });
      }
      return;
    }
    el.innerHTML = list.map(function (r) {
      var open = !!expanded[r.id];
      var vers = r.versions || [];
      var histBtn = vers.length
        ? ('<button type="button" class="vault-link" data-expand="' + esc(r.id) + '">' +
            (open ? '收起修订记录' : ('查看修订 · 共 ' + vers.length + ' 版')) + '</button>')
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
                (pickMode ? '选用' : (cur ? '当前版本 · 去匹配' : '用此版本匹配')) +
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
              (pickMode ? '选用此简历' : '选用此简历') +
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
        if (!window.confirm('确定删除这份简历（含全部修订记录）？')) return;
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
    if (u) u.textContent = '当前账号 · ' + (snap.userId === 'guest' ? '访客（本地保存）' : snap.userId);
    renderStats(snap);
    renderQuickLinks(snap);
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
      if (lead) lead.textContent = '请选择一份简历，可展开查看历次修订并选用任意版本。';
      if (hint) hint.textContent = '选定后即可使用该版本。';
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
