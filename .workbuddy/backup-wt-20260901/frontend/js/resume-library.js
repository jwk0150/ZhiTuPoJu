/* ============================================================
 * 简历库 · 读取 / 渲染 / 详情 / 删除 / 续编
 * ============================================================ */

(function () {
  'use strict';

  const LIB_KEY = 'rb_resume_library_v1';
  const BUILDER_KEY = 'rb_builder_state_v1';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function toast(msg) {
    const t = $('#rb-toast');
    if (!t) return;
    t.innerHTML = msg;
    t.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('is-on'), 2200);
  }

  function loadLibrary() {
    try {
      const raw = localStorage.getItem(LIB_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  function saveLibrary(lib) {
    try { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); } catch (_) {}
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ============ 渲染列表 ============ */
  function render() {
    const lib = loadLibrary();
    const grid = $('#rbl-grid');
    const empty = $('#rbl-empty');
    const count = $('#rbl-count');

    count.textContent = lib.length;
    grid.innerHTML = '';

    if (lib.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    lib.forEach((item, i) => {
      const card = document.createElement('div');
      card.className = 'rbl-card';
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', '查看 ' + item.name + ' 的简历');

      const photoHtml = item.photo
        ? '<img src="' + item.photo + '" alt="" />'
        : 'PORTRAIT';

      card.innerHTML = `
        <div class="rbl-card-top">
          <div>
            <div class="rbl-card-name">${esc(item.name)}</div>
            <div class="rbl-card-id">${esc(item.id)}</div>
          </div>
          <div class="rbl-card-photo">${photoHtml}</div>
        </div>
        <div class="rbl-card-tags">
          <span class="rbl-tag">${esc(item.position)}</span>
          <span class="rbl-tag rbl-tag--leaf">${item.expCount || 0} 段经历</span>
          <span class="rbl-tag rbl-tag--leaf">${(item.skills || []).length} 个技能</span>
        </div>
        <div class="rbl-card-summary">${esc(item.summary || '暂无自我评价')}</div>
        <div class="rbl-card-meta">
          <span>创建于 ${esc(item.createdAt)}</span>
        </div>
        <div class="rbl-card-actions">
          <button class="rb-btn rb-btn-ghost" data-act="view" data-i="${i}" type="button">预览</button>
          <button class="rb-btn rb-btn-primary" data-act="edit" data-i="${i}" type="button">继续编辑</button>
          <button class="rb-btn rb-btn--danger" data-act="delete" data-i="${i}" type="button">删除</button>
        </div>
      `;

      grid.appendChild(card);
    });
  }

  /* ============ 详情预览 ============ */
  function renderDetail(item) {
    const d = item.data || item;
    const paper = $('#rbl-detail-paper');
    $('#rbl-detail-title').textContent = item.name + ' · ' + item.position;
    const posName = (d.jobDirection && d.jobDirection.positions && d.jobDirection.positions[0] && (window.RB_POSITION_MAP ? '' : item.position)) || item.position;
    const b = d.basicInfo || {};
    const expList = (d.starExperiences || []).slice(0, 3);
    const skills = (d.profile && d.profile.skills) || [];
    const summary = (d.profile && d.profile.summary) || '';
    const photoHtml = item.photo ? '<img src="' + item.photo + '" alt="" />' : '';

    paper.innerHTML = `
      <div class="rb-paper" style="position:static;max-width:620px;aspect-ratio:auto;min-height:700px">
        <div class="rb-paper-content">
          <div class="rb-paper-main">
            <div>
              <div class="rb-paper-name">${esc(b.name || item.name)}</div>
              <div class="rb-paper-target">求职方向 · ${esc(item.position)}</div>
              <div class="rb-paper-meta">
                ${b.phone ? '<span>' + esc(b.phone) + '</span>' : ''}
                ${b.email ? '<span>' + esc(b.email) + '</span>' : ''}
                ${b.city ? '<span>' + esc(b.city) + '</span>' : ''}
              </div>
            </div>
            <div class="rb-paper-section">
              <h5>教育背景</h5>
              <p><b style="color:#1B1B16">${esc(b.school || '某高校')}</b>　${esc(b.degree || '本科')}　${esc(b.major || '—')}</p>
            </div>
            ${expList.map((s, i) => `
              <div class="rb-paper-section">
                <h5>实践经历 ${String(i + 1).padStart(2, '0')}</h5>
                <div class="exp-head"><b>${esc(s.title)}</b></div>
                <p><b style="color:#947B4C">S · </b>${esc(s.S)}</p>
                <p><b style="color:#947B4C">T · </b>${esc(s.T)}</p>
                <p><b style="color:#947B4C">A · </b>${esc(s.A)}</p>
                <p style="color:#5A3B1C"><b style="color:#947B4C">R · </b>${esc(s.R)}</p>
              </div>
            `).join('')}
            <div class="rb-paper-section">
              <h5>技能 · Skills</h5>
              <div class="rb-paper-skills">${skills.map(s => '<span>' + esc(s) + '</span>').join('') || '<span style="color:#5A5042">—</span>'}</div>
            </div>
            ${summary ? `<div class="rb-paper-section"><h5>自我评价</h5><p>${esc(summary)}</p></div>` : ''}
          </div>
          <div class="rb-paper-side">
            ${photoHtml ? `<div class="rb-paper-photo">${photoHtml}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /* ============ 事件 ============ */
  function bind() {
    $('#rbl-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const lib = loadLibrary();
      const item = lib[+btn.dataset.i];
      if (!item) return;
      const act = btn.dataset.act;

      if (act === 'view') {
        renderDetail(item);
        $('#rbl-detail-mask').hidden = false;
        $('#rbl-detail').hidden = false;
        $('#rbl-detail').dataset.id = item.id;
      } else if (act === 'edit') {
        continueEdit(item);
      } else if (act === 'delete') {
        if (confirm('确认删除档案「' + item.name + '」？')) {
          lib.splice(+btn.dataset.i, 1);
          saveLibrary(lib);
          render();
          toast('✓ 档案已删除');
        }
      }
    });

    $('#rbl-detail-close').addEventListener('click', closeDetail);
    $('#rbl-detail-mask').addEventListener('click', closeDetail);

    $('#rbl-detail-edit').addEventListener('click', () => {
      const id = $('#rbl-detail').dataset.id;
      const lib = loadLibrary();
      const item = lib.find(x => x.id === id);
      if (item) continueEdit(item);
    });

    $('#rbl-detail-delete').addEventListener('click', () => {
      const id = $('#rbl-detail').dataset.id;
      const lib = loadLibrary();
      const idx = lib.findIndex(x => x.id === id);
      if (idx >= 0 && confirm('确认删除该档案？')) {
        lib.splice(idx, 1);
        saveLibrary(lib);
        closeDetail();
        render();
        toast('✓ 档案已删除');
      }
    });

    $('#rbl-create').addEventListener('click', () => {
      window.location.href = 'resume.html';
    });

    $('#rbl-back-builder').addEventListener('click', () => {
      window.location.href = 'resume.html';
    });

    $('#rbl-go-home').addEventListener('click', () => {
      window.location.href = 'news/index.html';
    });
  }

  function closeDetail() {
    $('#rbl-detail-mask').hidden = true;
    $('#rbl-detail').hidden = true;
  }

  /* ============ 继续编辑 ============ */
  function continueEdit(item) {
    try {
      // 把简历库中保存的 state 恢复到生成器
      const data = item.data || item;
      localStorage.setItem(BUILDER_KEY, JSON.stringify(data));
      window.location.href = 'resume.html';
    } catch (e) {
      toast('恢复数据失败，请重新生成');
    }
  }

  /* ============ init ============ */
  function init() {
    bind();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
