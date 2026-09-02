/* 执图破局 · 个人仓库抽屉（顶栏下方，非整页） */
(function (global) {
  'use strict';

  var state = {
    open: false,
    mode: 'browse', // browse | pick
    tab: 'resumes',
    onPick: null,
    expanded: {}
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

  function vault() {
    return global.ZhituVault || null;
  }

  function ensureDom() {
    var el = document.getElementById('vault-drawer');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'vault-drawer';
    el.className = 'vault-drawer';
    el.hidden = true;
    el.innerHTML =
      '<div class="vault-drawer-mask" data-vd-close="1" aria-hidden="true"></div>' +
      '<aside class="vault-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="vd-title">' +
        '<header class="vd-head">' +
          '<div>' +
            '<p class="vd-kicker">PERSONAL VAULT</p>' +
            '<h2 class="vd-title" id="vd-title">个人仓库</h2>' +
            '<p class="vd-user" id="vd-user"></p>' +
          '</div>' +
          '<button type="button" class="vd-back" data-vd-close="1" aria-label="返回">← 返回</button>' +
        '</header>' +
        '<nav class="vd-tabs" role="tablist">' +
          '<button type="button" class="vd-tab" data-vd-tab="favs">收藏</button>' +
          '<button type="button" class="vd-tab is-on" data-vd-tab="resumes">我的简历</button>' +
        '</nav>' +
        '<div class="vd-body">' +
          '<div class="vd-panel" data-vd-panel="favs" hidden></div>' +
          '<div class="vd-panel is-on" data-vd-panel="resumes"></div>' +
        '</div>' +
      '</aside>';
    document.body.appendChild(el);

    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-vd-close]');
      if (t) { close(); return; }
      var tab = e.target.closest('[data-vd-tab]');
      if (tab) {
        setTab(tab.getAttribute('data-vd-tab'));
        return;
      }
      var pick = e.target.closest('[data-vd-pick]');
      if (pick) {
        handlePick(pick.getAttribute('data-vd-pick'), pick.getAttribute('data-vd-ver'));
        return;
      }
      var exp = e.target.closest('[data-vd-expand]');
      if (exp) {
        var id = exp.getAttribute('data-vd-expand');
        state.expanded[id] = !state.expanded[id];
        paint();
        return;
      }
      var del = e.target.closest('[data-vd-del]');
      if (del) {
        if (!global.confirm('确定删除这份简历（含历史版本）？')) return;
        if (vault()) vault().removeVaultResume(del.getAttribute('data-vd-del'));
        paint();
        return;
      }
      var setv = e.target.closest('[data-vd-setver]');
      if (setv) {
        if (vault()) vault().setCurrentVersion(setv.getAttribute('data-vd-rid'), setv.getAttribute('data-vd-setver'));
        paint();
        return;
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.open) close();
    });

    global.addEventListener('zhitu-vault-changed', function () {
      if (state.open) paint();
    });

    return el;
  }

  function setTab(tab) {
    state.tab = tab === 'favs' ? 'favs' : 'resumes';
    paint();
  }

  function handlePick(resumeId, versionId) {
    var V = vault();
    if (!V) return;
    var item = V.getVaultResume(resumeId);
    if (!item) return;
    if (versionId) V.setCurrentVersion(resumeId, versionId);
    item = V.getVaultResume(resumeId);
    var payload = V.toPayloadFromItem(item);
    V.saveMatchResume(Object.assign({}, payload, { source: payload.source || 'vault' }));
    if (typeof state.onPick === 'function') {
      try { state.onPick(payload, item); } catch (_) {}
    }
    close();
    try {
      global.dispatchEvent(new CustomEvent('zhitu-resume-picked', { detail: { payload: payload, item: item } }));
    } catch (_) {}
  }

  function renderFavLane(title, items, emptyHint) {
    var body;
    if (!items.length) {
      body = '<div class="vd-empty">' + esc(emptyHint) + '</div>';
    } else {
      body = '<div class="vd-grid">' + items.map(function (it) {
        var meta = [];
        if (it.company) meta.push(it.company);
        if (it.city) meta.push(it.city);
        if (it.salary) meta.push(it.salary);
        if (it.match != null) meta.push('匹配 ' + it.match + '%');
        if (it.conf) meta.push('置信 ' + Math.round(Number(it.conf) * (Number(it.conf) <= 1 ? 100 : 1)) + '%');
        return (
          '<a class="vd-card" href="' + esc(it.href || '#') + '">' +
            '<span class="vd-card-k">' + esc(title) + '</span>' +
            '<b class="vd-card-t">' + esc(it.title || '未命名') + '</b>' +
            (meta.length ? '<span class="vd-card-m">' + esc(meta.join(' · ')) + '</span>' : '') +
          '</a>'
        );
      }).join('') + '</div>';
    }
    return (
      '<section class="vd-lane">' +
        '<div class="vd-lane-h"><h3>' + esc(title) + '</h3><span>' + items.length + '</span></div>' +
        body +
      '</section>'
    );
  }

  function renderFavs(snap) {
    var f = (snap && snap.favs) || {};
    return (
      renderFavLane('岗位大新闻', f.news || [], '去「岗位大新闻」点心形收藏') +
      renderFavLane('新岗位发现', f.discovery || [], '去「新岗位发现」收藏真实发现') +
      renderFavLane('新岗位预测', f.forecast || [], '去「新岗位发现」收藏未来预测') +
      renderFavLane('人岗匹配', f.match || [], '在人岗匹配结果卡片上点 ★')
    );
  }

  function parseUploadText(text, fileName) {
    var lines = String(text || '').split(/\r?\n/);
    return {
      sections: [
        { id: 'basic', label: '个人信息', content: lines.slice(0, 8).join('\n') || fileName, ai_suggestion: '' },
        { id: 'education', label: '教育经历', content: '（上传稿，可在后续优化）', ai_suggestion: '' },
        { id: 'projects', label: '项目经历', content: lines.slice(8, 40).join('\n') || '—', ai_suggestion: '' },
        { id: 'work', label: '工作经历', content: '—', ai_suggestion: '' },
        { id: 'skills', label: '专业技能', content: '—', ai_suggestion: '' },
        { id: 'summary', label: '自我评价', content: lines.slice(40).join('\n') || '—', ai_suggestion: '' }
      ],
      text: text
    };
  }

  function bindUpload(root) {
    var input = root.querySelector('#vd-upload-input');
    var btn = root.querySelector('#vd-upload-btn');
    if (!input || input._vdBound) return;
    input._vdBound = true;
    function doUpload(file) {
      if (!file || !vault()) return;
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result || '');
        var parsed = parseUploadText(text, file.name);
        vault().upsertVaultResume({
          id: 'VR-upload-' + Date.now().toString(36),
          source: 'upload',
          fileName: file.name || '上传简历.txt',
          size: file.size || text.length,
          sections: parsed.sections,
          text: parsed.text,
          versionLabel: '上传稿'
        });
        if (global.showToast) global.showToast('已上传到个人仓库', 'teal');
        paint();
      };
      reader.readAsText(file, 'utf-8');
    }
    if (btn) btn.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (f) doUpload(f);
      input.value = '';
    });
  }

  function renderResumes(snap) {
    var V = vault();
    var list = (snap && snap.resumes) || [];
    var pickMode = state.mode === 'pick';
    var html =
      '<div class="vd-resume-bar">' +
        '<p class="vd-hint">' + (pickMode ? '选择一份简历用于人岗匹配（含历史优化版本）。' : '上传、探索初稿与优化版本都会留在这里。') + '</p>' +
        '<div class="vd-upload-row">' +
          '<input type="file" id="vd-upload-input" accept=".txt,.pdf,.doc,.docx,text/plain" hidden />' +
          '<button type="button" class="vd-btn" id="vd-upload-btn">上传简历</button>' +
        '</div>' +
      '</div>';

    if (!list.length) {
      html += '<div class="vd-empty">仓库还没有简历。可上传，或通过顶部「简历探索」生成初稿。</div>';
      return html;
    }

    html += '<div class="vd-resume-list">' + list.map(function (r) {
      var open = !!state.expanded[r.id];
      var vers = r.versions || [];
      var src = V ? V.sourceLabel(r.source) : r.source;
      var actions = pickMode
        ? '<button type="button" class="vd-btn vd-btn--solid" data-vd-pick="' + esc(r.id) + '">选用此简历</button>'
        : '<button type="button" class="vd-btn vd-btn--solid" data-vd-pick="' + esc(r.id) + '">用人岗匹配</button>';
      var hist = '';
      if (vers.length) {
        hist =
          '<button type="button" class="vd-link" data-vd-expand="' + esc(r.id) + '">' +
            (open ? '收起历史' : ('历史版本 · ' + vers.length)) +
          '</button>';
        if (open) {
          hist += '<ul class="vd-versions">' + vers.slice().reverse().map(function (v) {
            var cur = v.id === r.currentVersionId;
            return (
              '<li class="vd-ver' + (cur ? ' is-cur' : '') + '">' +
                '<div>' +
                  '<b>' + esc(v.label || '版本') + '</b>' +
                  '<span>' + esc((V && V.sourceLabel(v.source)) || v.source) + ' · ' + esc(fmtTime(v.createdAt)) + '</span>' +
                '</div>' +
                '<div class="vd-ver-actions">' +
                  (pickMode
                    ? '<button type="button" class="vd-btn vd-btn--mini" data-vd-pick="' + esc(r.id) + '" data-vd-ver="' + esc(v.id) + '">选用</button>'
                    : '<button type="button" class="vd-btn vd-btn--mini" data-vd-setver="' + esc(v.id) + '" data-vd-rid="' + esc(r.id) + '">' + (cur ? '当前' : '设为当前') + '</button>') +
                '</div>' +
              '</li>'
            );
          }).join('') + '</ul>';
        }
      }
      return (
        '<article class="vd-resume">' +
          '<div class="vd-resume-main">' +
            '<p class="vd-resume-name">' + esc(r.name || r.fileName || '未命名') + '</p>' +
            '<p class="vd-resume-meta">' + esc(src) + ' · 创建于 ' + esc(fmtTime(r.createdAt)) + ' · 更新 ' + esc(fmtTime(r.updatedAt)) + '</p>' +
            hist +
          '</div>' +
          '<div class="vd-resume-actions">' +
            actions +
            (pickMode ? '' : '<button type="button" class="vd-btn vd-btn--ghost" data-vd-del="' + esc(r.id) + '">删除</button>') +
          '</div>' +
        '</article>'
      );
    }).join('') + '</div>';
    return html;
  }

  function paint() {
    var root = ensureDom();
    var V = vault();
    var snap = V ? V.snapshot() : { userId: 'guest', resumes: [], favs: {} };
    var userEl = root.querySelector('#vd-user');
    if (userEl) userEl.textContent = '当前用户 · ' + (snap.userId || 'guest');

    root.querySelectorAll('.vd-tab').forEach(function (t) {
      var on = t.getAttribute('data-vd-tab') === state.tab;
      t.classList.toggle('is-on', on);
    });
    root.querySelectorAll('.vd-panel').forEach(function (p) {
      var on = p.getAttribute('data-vd-panel') === state.tab;
      p.classList.toggle('is-on', on);
      p.hidden = !on;
    });

    // pick 模式默认简历 tab
    if (state.mode === 'pick') state.tab = 'resumes';

    var favPanel = root.querySelector('[data-vd-panel="favs"]');
    var resPanel = root.querySelector('[data-vd-panel="resumes"]');
    if (favPanel) favPanel.innerHTML = renderFavs(snap);
    if (resPanel) {
      resPanel.innerHTML = renderResumes(snap);
      bindUpload(resPanel);
    }

    var title = root.querySelector('#vd-title');
    if (title) title.textContent = state.mode === 'pick' ? '选择简历' : '个人仓库';
    root.classList.toggle('is-pick', state.mode === 'pick');
  }

  function open(opts) {
    opts = opts || {};
    state.mode = opts.mode === 'pick' ? 'pick' : 'browse';
    state.tab = state.mode === 'pick' ? 'resumes' : (opts.tab || state.tab || 'resumes');
    state.onPick = typeof opts.onPick === 'function' ? opts.onPick : null;
    var root = ensureDom();
    paint();
    root.hidden = false;
    requestAnimationFrame(function () {
      root.classList.add('is-open');
    });
    state.open = true;
    document.body.classList.add('vault-drawer-open');
  }

  function close() {
    var root = document.getElementById('vault-drawer');
    if (!root) return;
    root.classList.remove('is-open');
    state.open = false;
    document.body.classList.remove('vault-drawer-open');
    setTimeout(function () {
      if (!state.open) root.hidden = true;
    }, 280);
  }

  function toggle(opts) {
    if (state.open) close();
    else open(opts);
  }

  global.ZhituVaultUI = {
    open: open,
    close: close,
    toggle: toggle,
    isOpen: function () { return state.open; },
    paint: paint
  };
})(window);
