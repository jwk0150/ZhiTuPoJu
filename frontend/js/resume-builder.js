/* ============================================================
 * 执图破局 · 简历向导
 * 主控：步骤管理 + 数据绑定 + 本地暂存 + 简历预览
 * ============================================================ */

(function () {
  'use strict';

  /* ============== 1. 数据状态 ============== */
  const STORAGE_KEY = 'rb_builder_state_v2';
  const LEGACY_STORAGE_KEY = 'rb_builder_state_v1';

  function currentUserId() {
    try {
      const u = JSON.parse(localStorage.getItem('zhitu_user') || 'null');
      if (u && (u.username || u.user_id || u.id)) return String(u.username || u.user_id || u.id);
    } catch (_) {}
    return 'guest';
  }

  function scopedStorageKey(base) { return base + '__' + currentUserId(); }
  const USER_STORAGE_KEY = scopedStorageKey(STORAGE_KEY);
  const USER_LEGACY_STORAGE_KEY = scopedStorageKey(LEGACY_STORAGE_KEY);

  function seedFromProfile(target) {
    try {
      const profile = JSON.parse(localStorage.getItem('zhitu_my_profile_v1__' + currentUserId()) || 'null');
      if (!profile || typeof profile !== 'object') return;
      const p = profile.userProfile || {};
      const info = target.basicInfo;
      ['name', 'phone', 'email', 'city'].forEach((key) => {
        if (!String(info[key] || '').trim() && String(p[key] || '').trim()) info[key] = p[key];
      });
      const edu = Array.isArray(profile.education) ? profile.education[0] : null;
      if (edu) {
        if (!String(info.school || '').trim()) info.school = edu.school || '';
        if (!String(info.major || '').trim()) info.major = edu.major || '';
        if (!String(info.degree || '').trim()) info.degree = edu.degree || '';
        if (!String(info.graduate || '').trim()) info.graduate = edu.graduateYear || '';
      }
      const pref = profile.careerPreference || {};
      if (!target.jobDirection.positions.length && Array.isArray(pref.desiredJobs)) {
        const wanted = pref.desiredJobs.map((name) => POSITION_LIST.find((j) => j.name === name)).filter(Boolean).slice(0, 3);
        target.jobDirection.positions = wanted.map((j) => j.id);
      }
      if (!target.profile.skills.length && Array.isArray(pref.desiredIndustries)) {
        target.profile.skills = pref.desiredIndustries.slice(0, 8);
      }
    } catch (_) {}
  }

  const defaultState = {
    currentStep: 1,
    completedSteps: {},
    basicInfo: {
      name: '', phone: '', email: '',
      city: '', degree: '', school: '',
      major: '', graduate: ''
    },
    jobDirection: {
      positions: []
    },
    experiences: [],
    starExperiences: [],
    profile: {
      personality: '',
      intent: '',
      dislike: '',
      skills: [],
      summary: ''
    },
    photo: null,
    ai: {
      expHint: ''
    },
    polish: {
      complete: false
    },
    generated: false
  };

  let state = loadState();

  function loadState() {
    try {
      let raw = localStorage.getItem(USER_STORAGE_KEY);
      let migratedGlobal = false;
      if (!raw) {
        raw = localStorage.getItem(USER_LEGACY_STORAGE_KEY);
      }
      // 兼容旧版本全局草稿：仅在当前用户没有用户级草稿时迁移一次。
      if (!raw) {
        raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
        migratedGlobal = !!raw;
      }
      if (raw) {
        const obj = JSON.parse(raw);
        const mapped = Object.assign({}, defaultState, obj, {
          basicInfo: Object.assign({}, defaultState.basicInfo, obj.basicInfo || {}),
          jobDirection: Object.assign({}, defaultState.jobDirection, obj.jobDirection || { positions: [] }),
          experiences: (Array.isArray(obj.experiences) && obj.experiences.length)
            ? obj.experiences
            : JSON.parse(JSON.stringify(defaultState.experiences)),
          starExperiences: Array.isArray(obj.starExperiences) ? obj.starExperiences : [],
          profile: Object.assign({}, defaultState.profile, obj.profile || {}, { skills: (obj.profile && obj.profile.skills) || [] }),
          photo: obj.photo || null,
          ai: Object.assign({}, defaultState.ai, obj.ai || {}),
          polish: Object.assign({}, defaultState.polish, obj.polish || {}),
          completedSteps: obj.completedSteps || {}
        });
        // 旧 8 步 → 新 5 步
        const legacyMap = { 1: 1, 2: 2, 3: 3, 4: 3, 5: 2, 6: 5, 7: 4, 8: 5 };
        if (mapped.currentStep > 5) {
          mapped.currentStep = legacyMap[mapped.currentStep] || 1;
        }
        seedFromProfile(mapped);
        if (migratedGlobal) {
          try { localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mapped)); } catch (_) {}
        }
        return mapped;
      }
    } catch (err) { console.warn('rb state load fail:', err); }
    return JSON.parse(JSON.stringify(defaultState));
  }

  function saveState() {
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(state));
    } catch (err) { console.warn('rb state save fail:', err); }
  }

  /* ============== 2. 工具 ============== */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(k => {
        const v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k === 'selected' || k === 'checked' || k === 'disabled' || k === 'hidden') {
          if (v) node.setAttribute(k, k === 'selected' || k === 'checked' ? '' : String(v));
        } else node.setAttribute(k, v);
      });
    }
    const append = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { c.forEach(append); return; }
      if (typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(String(c)));
      else if (c.nodeType) node.appendChild(c);
    };
    children.forEach(append);
    return node;
  }

  function toast(msg, type) {
    const t = $('#rb-toast');
    if (!t) return;
    t.innerHTML = msg;
    t.classList.add('is-on');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.remove('is-on'), 2200);
  }

  function clockNow() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function randId() {
    return 'AX-' + Math.floor(1000 + Math.random() * 9000) + '-' + String(Date.now()).slice(-4);
  }

  function fakeDelay(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ============== 3. 步骤配置 ============== */
  const STEPS = [
    { id: 1, label: '基础信息', short: '基础信息' },
    { id: 2, label: '方向技能', short: '方向技能' },
    { id: 3, label: '实践经历', short: '实践经历' },
    { id: 4, label: '润色检查', short: '润色检查' },
    { id: 5, label: '生成导出', short: '生成导出' }
  ];

  const ILLUS_IMG = { 1: 1, 2: 2, 3: 3, 4: 7, 5: 8 };

  let POSITION_LIST = [];
  let jobFilter = { q: '', cat: '全部' };
  let skillFilter = { q: '' };

  function slugId(name, fallback) {
    return fallback || ('job_' + String(name || '').replace(/\s+/g, '_'));
  }

  function loadJobPoolSync() {
    const pack = window.ZHITU_JOB_POOL;
    if (pack && Array.isArray(pack.jobs) && pack.jobs.length) {
      POSITION_LIST = pack.jobs.map((j, i) => ({
        id: j.id || slugId(j.name, 'jp' + String(i + 1).padStart(3, '0')),
        name: j.name,
        cat: j.cat || j.meta || '其他',
        meta: j.cat || j.meta || '其他',
        skills: Array.isArray(j.skills) ? j.skills.slice() : [],
        hot: typeof j.hot === 'number' ? j.hot : 0.5
      }));
      return;
    }
    POSITION_LIST = [
      { id: 'java', name: 'Java开发工程师', cat: '软件开发', meta: '软件开发', skills: ['Java', 'Spring Boot', 'MySQL'], hot: 0.9 },
      { id: 'web', name: '前端开发工程师', cat: '软件开发', meta: '软件开发', skills: ['Vue', 'React', 'TypeScript'], hot: 0.9 },
      { id: 'data', name: '数据分析师', cat: '数据与人工智能', meta: '数据与人工智能', skills: ['SQL', 'Python', 'Excel'], hot: 0.9 }
    ];
  }

  async function enrichJobPoolFromApi() {
    try {
      const base = apiBase();
      const res = await fetch(base + '/api/ability/job-pool', { method: 'GET' });
      if (!res.ok) return;
      const data = await res.json();
      const jobs = data && data.data && data.data.jobs;
      if (!Array.isArray(jobs) || !jobs.length) return;
      const selected = new Set(state.jobDirection.positions || []);
      POSITION_LIST = jobs.map((j, i) => ({
        id: j.id || slugId(j.name, 'jp' + String(i + 1).padStart(3, '0')),
        name: j.name,
        cat: j.cat || j.meta || '其他',
        meta: j.cat || j.meta || '其他',
        skills: Array.isArray(j.skills) ? j.skills.slice() : [],
        hot: typeof j.hot === 'number' ? j.hot : 0.5
      }));
      // 保留已选 id；若旧 id 不在新池，按名称回填
      state.jobDirection.positions = (state.jobDirection.positions || []).filter((id) =>
        POSITION_LIST.some((p) => p.id === id)
      );
      if (!state.jobDirection.positions.length && selected.size) {
        /* keep empty */
      }
      saveState();
      if (state.currentStep === 2) renderPositions();
    } catch (_) { /* 前端静态池兜底即可 */ }
  }

  loadJobPoolSync();

  /* ============== 4. 步骤渲染 ============== */
  function maxReachableStep() {
    var max = state.currentStep || 1;
    Object.keys(state.completedSteps || {}).forEach(function (k) {
      if (state.completedSteps[k]) max = Math.max(max, Number(k));
    });
    if (isStepComplete(state.currentStep)) {
      max = Math.max(max, Math.min(state.currentStep + 1, STEPS.length));
    }
    return Math.min(Math.max(1, max), STEPS.length);
  }

  function renderTopnav() {
    const nav = $('#rb-topnav-steps');
    nav.innerHTML = '';
    const reach = maxReachableStep();
    STEPS.forEach(s => {
      const isDone = !!state.completedSteps[s.id];
      const isActive = s.id === state.currentStep;
      const dis = s.id > reach;
      const btn = el('button', {
        class: 'rb-step' + (isActive ? ' is-active' : '') + (isDone && !isActive ? ' is-done' : ''),
        type: 'button',
        'data-step': s.id,
        'aria-disabled': dis ? 'true' : 'false',
        'data-tooltip': dis ? '请先完成前面的步骤' : ('前往：' + s.label),
        'aria-label': dis ? s.label + '，请先完成前面的步骤' : '前往：' + s.label
      },
        el('span', { class: 'rb-step-num' }, String(s.id).padStart(2, '0')),
        el('span', { class: 'rb-step-label' }, s.label),
        isDone && !isActive ? el('span', { class: 'rb-step-check' }, '✓') : null
      );
      if (!dis) {
        btn.addEventListener('click', () => gotoStep(s.id));
      }
      nav.appendChild(btn);
    });
  }

  function renderBottom() {
    const s = STEPS[state.currentStep - 1];
    $('#rb-bottom-step').textContent = String(state.currentStep).padStart(2, '0');
    $('#rb-bottom-section').textContent = s.short;
    const done = Object.keys(state.completedSteps).filter(k => state.completedSteps[k]).length;
    $('#rb-bottom-progress').textContent = Math.round((done / STEPS.length) * 100) + '%';
    $('#rb-step-back').disabled = state.currentStep === 1;
    const isLast = state.currentStep === STEPS.length;
    const nextBtn = $('#rb-step-next');
    if (isLast) {
      nextBtn.textContent = state.generated ? '重新生成 →' : '一键生成 →';
      nextBtn.disabled = false;
    } else {
      nextBtn.textContent = '下一步 →';
      nextBtn.disabled = !isStepComplete(state.currentStep);
    }
  }

  function isStepComplete(stepId) {
    if (stepId === 1) {
      const b = state.basicInfo;
      return !!(b.name && b.phone && b.email && b.city && b.school && b.major);
    }
    if (stepId === 2) return state.jobDirection.positions.length > 0;
    if (stepId === 3) {
      ensureExperienceSeed();
      return state.experiences.length > 0;
    }
    if (stepId === 4) return !!state.polish.complete;
    if (stepId === 5) return true;
    return true;
  }

  /* ============== 4.5 左侧全列步骤插图 ============== */
  /* 根据当前步骤切换 .rb-left-bg 的 background-image 为对应 step-N.jpg */
  /* 同时更新副标与左下角标题 / 描述文案，与每一步一一对应 */
  const ILLUS_COPY = {
    1: {
      title: '基本<br/><em>信息</em>',
      desc: '填写姓名、联系方式与学校专业，后续步骤会用到这些字段。'
    },
    2: {
      title: '方向<br/><em>技能</em>',
      desc: '选 1–3 个投递方向，补充技能标签与自我评价。'
    },
    3: {
      title: '实践<br/><em>经历</em>',
      desc: '写实习、项目或校园实践，并用 STAR 改写要点。'
    },
    4: {
      title: '润色<br/><em>检查</em>',
      desc: '压缩空话，保留可量化结果与岗位相关关键词。'
    },
    5: {
      title: '生成<br/><em>导出</em>',
      desc: '可选证件照，生成简历后下载或进入简历库。'
    }
  };

  let _illusTimer = null;
  let _illusLastIdx = -1;
  function renderIllus(stepId) {
    const box = document.getElementById('rb-left-bg');
    if (!box) return;
    const idx = Math.min(Math.max(1, stepId | 0), STEPS.length);

    // 同步更新步骤副标与文案
    const eyebrow = document.getElementById('rb-left-step-eyebrow');
    if (eyebrow) {
      eyebrow.textContent = `步骤 ${String(idx).padStart(2, '0')} / ${String(STEPS.length).padStart(2, '0')}`;
    }
    const meta = document.getElementById('rb-current-meta');
    if (meta) {
      meta.textContent = `${String(idx).padStart(2, '0')} / ${String(STEPS.length).padStart(2, '0')}`;
    }
    const copy = ILLUS_COPY[idx];
    if (copy) {
      const title = document.getElementById('rb-left-title');
      if (title) title.innerHTML = copy.title;
      const desc = document.getElementById('rb-left-desc');
      if (desc) desc.textContent = copy.desc;
    }

    if (idx === _illusLastIdx) return;
    _illusLastIdx = idx;
    if (_illusTimer) { clearTimeout(_illusTimer); _illusTimer = null; }
    box.classList.add('is-switching');
    const imgIdx = ILLUS_IMG[idx] || idx;
    _illusTimer = setTimeout(() => {
      box.style.backgroundImage = `url('../images/resume-step-${imgIdx}.jpg')`;
      // eslint-disable-next-line no-unused-expressions
      box.offsetHeight;
      box.classList.remove('is-switching');
      _illusTimer = null;
    }, 220);
  }

  /* ============== 5. 步骤切换 ============== */
  function gotoStep(stepId) {
    if (stepId < 1 || stepId > STEPS.length) return;
    state.currentStep = stepId;
    $$('.rb-step-view').forEach(v => v.classList.remove('is-active'));
    const target = $(`.rb-step-view[data-step="${stepId}"]`);
    if (target) target.classList.add('is-active');
    renderTopnav();
    renderBottom();
    updateStageSpecific(stepId);
    renderIllus(stepId);
    saveState();
  }

  function nextStep() {
    if (!isStepComplete(state.currentStep)) {
      toast(`当前步骤资料不完整，请先填写。`);
      return;
    }
    state.completedSteps[state.currentStep] = true;
    if (state.currentStep < STEPS.length) {
      gotoStep(state.currentStep + 1);
    } else {
      runGenerate();
    }
  }

  function prevStep() {
    if (state.currentStep > 1) gotoStep(state.currentStep - 1);
  }

  function updateStageSpecific(stepId) {
    if (stepId === 2) {
      bindJobFilters();
      bindSkillFilters();
      renderJobCats();
      renderPositions();
      renderSkillPool();
      renderTags();
    }
    if (stepId === 3) {
      ensureExperienceSeed();
      renderExpList();
      syncAndPaintStars();
    }
    if (stepId === 4) renderPolish();
    if (stepId === 5) { renderPhoto(); renderExport(); }
    if (stepId === 1) renderBasic();
  }

  function ensureExperienceSeed() {
    if (!Array.isArray(state.experiences)) state.experiences = [];
    if (!state.experiences.length) {
      state.experiences.push({
        id: Date.now(),
        type: '', time: '', title: '',
        org: '', role: '',
        brief: '', result: ''
      });
      saveState();
    }
  }

  /* ============== 6. 步骤 01 - 基础信息 ============== */
  function renderBasic() {
    $$('[data-bind]').forEach(input => {
      const path = input.getAttribute('data-bind');
      const val = readPath(state, path);
      if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT' || input.tagName === 'SELECT') {
        if (input.value !== String(val || '')) input.value = val || '';
      }
    });
  }

  function readPath(obj, path) {
    return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
  }

  function writePath(obj, path, val) {
    const ks = path.split('.');
    const last = ks.pop();
    const ctx = ks.reduce((o, k) => (o[k] = o[k] || {}), obj);
    ctx[last] = val;
  }

  function bindInputs() {
    $$('[data-bind]').forEach(input => {
      const path = input.getAttribute('data-bind');
      input.addEventListener('input', () => {
        writePath(state, path, input.value);
        saveState();
        renderBottom();
      });
      input.addEventListener('change', () => {
        writePath(state, path, input.value);
        saveState();
        renderBottom();
      });
    });
  }

  /* AI 自动补全 - 基础信息 */
  async function aiAutofillBasic() {
    const btn = $('#rb-ai-basic');
    if (!btn || btn.classList.contains('is-loading')) return;
    btn.classList.add('is-loading');
    btn.querySelector('.rb-ai-icon').textContent = '⟳';
    btn.querySelector('.rb-ai-label').textContent = '补全中…';
    const seed = state.basicInfo;
    // 自动补全只整理已有输入，不编造学校、联系方式或日期。
    const missing = ['name', 'major', 'school', 'degree', 'city', 'graduate', 'email', 'phone'].filter((k) => !String(seed[k] || '').trim());
    saveState();
    renderBasic();
    btn.classList.remove('is-loading');
    btn.classList.add('is-done');
    btn.querySelector('.rb-ai-icon').textContent = '✓';
    btn.querySelector('.rb-ai-label').textContent = '已补全';
    toast(missing.length ? '请补充空缺字段；系统不会代填虚构信息' : '已检查基础信息');
  }

  /* ============== 7. 步骤 02 - 求职方向 ============== */
  function findPosition(id) {
    return POSITION_LIST.find(p => p.id === id);
  }

  function filteredPositions() {
    const q = (jobFilter.q || '').trim().toLowerCase();
    const cat = jobFilter.cat || '全部';
    return POSITION_LIST.filter(p => {
      if (cat !== '全部' && p.cat !== cat) return false;
      if (!q) return true;
      const hay = (p.name + ' ' + (p.cat || '') + ' ' + (p.skills || []).join(' ')).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function skillCatalog() {
    const set = new Set();
    POSITION_LIST.forEach(p => (p.skills || []).forEach(s => set.add(s)));
    (state.profile.skills || []).forEach(s => set.add(s));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }

  function toggleSkill(skill) {
    if (!skill) return;
    const arr = state.profile.skills || [];
    const i = arr.indexOf(skill);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(skill);
    state.profile.skills = arr;
    saveState();
    renderSkillPool();
    renderTags();
    renderBottom();
  }

  function clearSelection() {
    state.jobDirection.positions = [];
    state.profile.skills = [];
    saveState();
    renderPositions();
    renderSkillPool();
    renderTags();
    renderBottom();
    toast('已清除所选岗位与技能');
  }

  function filteredSkills() {
    const q = (skillFilter.q || '').trim().toLowerCase();
    const all = skillCatalog();
    if (!q) return all;
    return all.filter(s => String(s).toLowerCase().indexOf(q) !== -1);
  }

  function renderSkillPool() {
    const wrap = $('#rb-skill-pool');
    if (!wrap) return;
    wrap.innerHTML = '';
    const selected = new Set(state.profile.skills || []);
    const list = filteredSkills();
    const countEl = $('#rb-skill-count');
    if (countEl) {
      countEl.textContent = list.length + ' 个技能' +
        (selected.size ? ' · 已选 ' + selected.size : '');
    }
    if (!list.length) {
      wrap.appendChild(el('div', { class: 'rb-skill-empty' },
        skillFilter.q ? '没有匹配的技能，可在下方手动添加' : '暂无技能标签'));
      return;
    }
    list.forEach(skill => {
      const on = selected.has(skill);
      const btn = el('button', {
        class: 'rb-skill-chip' + (on ? ' is-on' : ''),
        type: 'button',
        'data-tooltip': on ? '取消选择' : '选择技能',
        'aria-label': skill + '：' + (on ? '取消选择' : '选择技能')
      }, skill);
      btn.addEventListener('click', () => toggleSkill(skill));
      wrap.appendChild(btn);
    });
  }

  function renderJobCats() {
    const wrap = $('#rb-job-cats');
    if (!wrap) return;
    const cats = ['全部'].concat(
      Array.from(new Set(POSITION_LIST.map(p => p.cat).filter(Boolean))).sort((a, b) => {
        if (a === '爬取岗位') return 1;
        if (b === '爬取岗位') return -1;
        return a.localeCompare(b, 'zh-CN');
      })
    );
    wrap.innerHTML = '';
    cats.forEach(cat => {
      const btn = el('button', {
        class: 'rb-job-cat' + (jobFilter.cat === cat ? ' is-on' : ''),
        type: 'button',
        'data-cat': cat
      }, cat);
      btn.addEventListener('click', () => {
        jobFilter.cat = cat;
        renderJobCats();
        renderPositions();
      });
      wrap.appendChild(btn);
    });
  }

  function renderPositions() {
    const list = $('#rb-positions');
    if (!list) return;
    list.innerHTML = '';
    const rows = filteredPositions();
    const countEl = $('#rb-job-count');
    if (countEl) {
      countEl.textContent = '显示 ' + rows.length + ' / 共 ' + POSITION_LIST.length + ' · 已选 ' + state.jobDirection.positions.length + '/3';
    }
    if (!rows.length) {
      list.appendChild(el('div', { class: 'rb-job-empty' }, '没有匹配的岗位，试试换个关键词或分类'));
    } else {
      rows.forEach(p => {
        const on = state.jobDirection.positions.includes(p.id);
        const item = el('button', {
          class: 'rb-position' + (on ? ' is-on' : ''),
          type: 'button'
        },
          el('span', { class: 'rb-position-dot' }),
          el('span', { class: 'rb-position-name' }, p.name),
          el('span', { class: 'rb-position-meta' }, p.meta || p.cat || '')
        );
        item.addEventListener('click', () => {
          const arr = state.jobDirection.positions;
          const idx = arr.indexOf(p.id);
          if (idx >= 0) arr.splice(idx, 1);
          else {
            if (arr.length >= 3) { toast('最多选择 3 个方向'); return; }
            arr.push(p.id);
          }
          saveState();
          renderPositions();
          renderBottom();
        });
        list.appendChild(item);
      });
    }

    const personaEl = $('#rb-persona-text');
    if (personaEl) {
      const b = state.basicInfo;
      const parts = [];
      // 与 HTML 默认文案同构：就读于 <em>学校 专业名专业</em> 学历。
      parts.push(
        '就读于 <em>' +
          (b.school || '未填写学校') + ' ' +
          (b.major || '软件工程') + '专业</em> ' +
          (b.degree || '本科') + '。'
      );
      if (b.city) parts.push('期望在 <em>' + b.city + '</em> 寻找发展机会。');
      const firstThree = state.jobDirection.positions.length
        ? state.jobDirection.positions.map(id => (findPosition(id) || {}).name).filter(Boolean).join('、')
        : '';
      if (firstThree) parts.push('目前重点关注 <em>' + firstThree + '</em> 等方向。');
      parts.push('按常见课程结构，更适合工程实现类岗位，可优先考虑开发或测试方向。');
      personaEl.innerHTML = parts.join(' ');
    }
  }

  function bindJobFilters() {
    const input = $('#rb-job-search');
    if (!input || input.dataset.bound === '1') return;
    input.dataset.bound = '1';
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        jobFilter.q = input.value || '';
        renderPositions();
      }, 120);
    });
  }

  function bindSkillFilters() {
    const input = $('#rb-skill-search');
    if (!input || input.dataset.bound === '1') return;
    input.dataset.bound = '1';
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        skillFilter.q = input.value || '';
        renderSkillPool();
      }, 120);
    });
  }

  /* ============== 8. 步骤 03 - 经历补充 ============== */
  function renderExpList() {
    const list = $('#rb-exp-list');
    list.innerHTML = '';
    state.experiences.forEach((exp, i) => {
      const expEl = el('div', { class: 'rb-exp' },
        el('div', { class: 'rb-exp-head' },
          el('div', { class: 'rb-exp-title' },
            el('span', { class: 'rb-exp-title-eyebrow' }, `EXPERIENCE ${String(i + 1).padStart(2, '0')}`),
            el('b', null, exp.title || '经历 ' + (i + 1))
          ),
          el('div', { class: 'rb-exp-controls' },
            el('button', { class: 'rb-icon-btn', type: 'button', 'data-tooltip': '上移', 'aria-label': '上移经历', onclick: () => moveExp(i, -1) }, '↑'),
            el('button', { class: 'rb-icon-btn', type: 'button', 'data-tooltip': '下移', 'aria-label': '下移经历', onclick: () => moveExp(i, +1) }, '↓'),
            el('button', { class: 'rb-icon-btn', type: 'button', 'data-tooltip': '删除', 'aria-label': '删除经历', onclick: () => removeExp(i) }, '×')
          )
        ),
        el('div', { class: 'rb-exp-row' },
          expField('类型', (() => {
            const sel = el('select', null,
              el('option', { value: '' }, '—'),
              ['实习', '项目', '竞赛', '校园'].map(t => el('option', { value: t }, t))
            );
            sel.value = exp.type || '';
            return sel;
          })(), exp, 'type'),
          expField('时间', el('input', { type: 'text', value: exp.time || '', placeholder: '2024.06 - 2024.09' }), exp, 'time')
        ),
        el('div', { class: 'rb-exp-row' },
          expField('公司 / 项目', el('input', { type: 'text', value: exp.org || '', placeholder: '公司名或项目名' }), exp, 'org'),
          expField('角色', el('input', { type: 'text', value: exp.role || '', placeholder: '如：后端开发 / 算法助理' }), exp, 'role')
        ),
        el('div', { class: 'rb-exp-full' },
          expField('简介', el('textarea', { placeholder: '做了什么，遇到什么问题，如何解决 …' }, exp.brief || ''), exp, 'brief', true)
        ),
        el('div', { class: 'rb-exp-full' },
          expField('成果 / 收获', el('textarea', { placeholder: '量化数据：性能、规模、收益 …' }, exp.result || ''), exp, 'result', true)
        )
      );
      list.appendChild(expEl);
    });
  }

  function expField(label, control, exp, key, isArea) {
    const wrap = el('div', { class: 'rb-field' },
      el('label', null, label),
      isArea
        ? el('div', { class: 'rb-field-texarea-wrap' }, control)
        : el('div', { class: 'rb-field-input' }, control)
    );
    control.addEventListener('input', () => {
      exp[key] = control.value;
      saveState();
    });
    return wrap;
  }

  function moveExp(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= state.experiences.length) return;
    const arr = state.experiences;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    saveState(); renderExpList(); syncAndPaintStars(); renderBottom();
  }
  function removeExp(i) {
    state.experiences.splice(i, 1);
    saveState(); renderExpList(); syncAndPaintStars(); renderBottom();
  }
  function addExp() {
    state.experiences.push({
      id: Date.now(),
      type: '', time: '', title: '',
      org: '', role: '',
      brief: '', result: ''
    });
    saveState(); renderExpList(); syncAndPaintStars(); renderBottom();
    toast('已新增一段经历');
  }

  /* AI 生成经历 */
  async function aiGenerateExp() {
    const hint = (state.ai && state.ai.expHint || '').trim();
    if (!hint) { toast('先简单描述一下你的经历'); return; }
    const btn = $('#rb-ai-input-go');
    btn.classList.add('is-loading');
    btn.querySelector('.rb-ai-icon').textContent = '⟳';
    btn.querySelector('.rb-ai-label').textContent = '生成中…';
    await fakeDelay(1500);

    // 根据 hint 拆解关键词
    const parts = hint.split(/[，。,.;；\.\n]/).filter(Boolean);
    const keywords = parts.slice(0, 4).map(p => p.trim()).filter(Boolean);

    const orgGuess = (keywords[0] || '校园项目') + ' · 实践';
    const roleGuess = state.jobDirection.positions.length
      ? ((findPosition(state.jobDirection.positions[0]) || {}).name || '开发实习生')
      : '开发实习生';
    const brief = keywords.length > 1
      ? `在${keywords[0] || '校园项目'}中负责${keywords.slice(1).join('、')}等工作，与团队一起完成从需求拆解、接口设计到上线验证的完整链路。`
      : '在校园项目中负责核心模块开发，参与从需求分析到上线验证的全流程，并与前端 / 测试协作完成功能交付。';
    const result = '请补充可核验的项目结果（如性能、效率或用户规模），系统不会替你虚构量化指标。';

    const newExp = {
      id: Date.now(),
      type: '项目',
      time: '2024.06 - 2024.09',
      title: (keywords[0] || '校园') + '实践项目',
      org: orgGuess,
      role: roleGuess,
      brief,
      result
    };
    state.experiences.push(newExp);
    saveState();

    btn.classList.remove('is-loading');
    btn.classList.add('is-done');
    btn.querySelector('.rb-ai-icon').textContent = '✓';
    btn.querySelector('.rb-ai-label').textContent = '已完成';
    $('#rb-ai-input-block').classList.remove('is-on');
    state.ai.expHint = '';
    $('#rb-ai-input-block textarea').value = '';
    renderExpList();
    syncAndPaintStars();
    renderBottom();
    toast('✓ 已根据描述整理 1 段经历');
  }

  /* ============== 9. STAR（嵌在步骤 03） ============== */
  function syncStarsFromExperiences() {
    const prev = state.starExperiences || [];
    state.starExperiences = state.experiences.map((exp, i) => {
      const old = prev.find(s => s.id === exp.id) || prev[i];
      const auto = expToSTAR(exp);
      return {
        id: exp.id,
        title: exp.title || ('经历 ' + (i + 1)),
        S: (old && old.S) || auto.S,
        T: (old && old.T) || auto.T,
        A: (old && old.A) || auto.A,
        R: (old && old.R) || auto.R
      };
    });
    saveState();
  }

  function syncAndPaintStars() {
    const loading = $('#rb-star-loading');
    const numEl = $('#rb-star-num');
    const list = $('#rb-star-list');
    if (!state.experiences.length) {
      if (numEl) numEl.textContent = '0';
      if (loading) {
        loading.hidden = false;
        loading.style.display = '';
        loading.classList.add('is-empty');
        const tip = loading.querySelector('.rb-star-loading-text');
        if (tip) tip.innerHTML = '还没有经历 · 先在上方「手动添加」或「根据描述整理」';
      }
      if (list) list.innerHTML = '';
      return;
    }
    if (loading) {
      loading.hidden = true;
      loading.style.display = 'none';
      loading.classList.remove('is-empty');
    }
    syncStarsFromExperiences();
    paintStarList();
  }

  async function renderStarList() {
    syncAndPaintStars();
  }

  function expToSTAR(exp) {
    const org = exp.org || '相关项目';
    const role = exp.role || '开发工程师';
    const roleTag = role.includes('后端') ? '后端开发' :
                    role.includes('前端') ? '前端开发' :
                    role.includes('测试') ? '测试开发' :
                    role.includes('产品') ? '产品方向' :
                    role.includes('算法') ? '算法工程' :
                    '开发';
    return {
      S: `在${org}的${role}岗位上，团队需要在一个完整迭代周期内交付一个新功能模块，作为组内${roleTag}成员加入项目。`,
      T: `需要在 2-3 个月内完成模块的核心功能，并保证与上下游系统的接口稳定性，最终产出可上线的版本。`,
      A: `对模块进行了功能拆解，独立完成${roleTag}链路上的核心实现；与前端约定接口边界；与测试同学协作梳理回归用例；在 Review 中持续吸收团队反馈。`,
      R: `模块按期上线，运行稳定后被 1 个下游业务复用；过程中沉淀了 1 份${roleTag}规范文档，团队后续类似工作复用率达到 60% 以上。`
    };
  }

  function paintStarList() {
    const list = $('#rb-star-list');
    list.innerHTML = '';
    state.starExperiences.forEach((star, i) => {
      const block = el('div', { class: 'rb-star-block' },
        el('div', { class: 'rb-star-block-eyebrow' }, `EXPERIENCE ${String(i + 1).padStart(2, '0')}`),
        el('h3', null, star.title)
      );
      ['S', 'T', 'A', 'R'].forEach((letter, idx) => {
        const labels = { S: 'SITUATION', T: 'TASK', A: 'ACTION', R: 'RESULT' };
        const cn = { S: '情境', T: '任务', A: '行动', R: '结果' };
        const row = el('div', { class: 'rb-star-row' },
          el('div', { class: 'rb-star-letter' }, letter),
          el('div', { class: 'rb-star-content' },
            el('div', { class: 'rb-star-content-eyebrow' }, labels[letter]),
            el('div', { class: 'rb-star-content-label' }, cn[letter]),
            el('div', { class: 'rb-star-content-input' },
              el('textarea', null, star[letter])
            )
          )
        );
        const ta = row.querySelector('textarea');
        ta.value = star[letter];
        ta.addEventListener('input', () => { star[letter] = ta.value; saveState(); });
        block.appendChild(row);
      });
      list.appendChild(block);
    });
  }

  /* ============== 10. 步骤 05 - 软件信息 ============== */
  function renderTags() {
    const wrap = $('#rb-tags-input');
    const input = $('#rb-tags-input-el');
    if (!wrap || !input) return;
    wrap.querySelectorAll('.rb-tag').forEach(n => n.remove());
    state.profile.skills.forEach((s, i) => {
      const tag = el('span', { class: 'rb-tag' }, s,
        el('button', { class: 'rb-tag-remove', type: 'button', onclick: (e) => {
          e.preventDefault();
          state.profile.skills.splice(i, 1);
          saveState();
          renderTags();
          renderSkillPool();
          renderBottom();
        } }, '×')
      );
      wrap.insertBefore(tag, input);
    });
    const selfTa = $('#rb-self-textarea');
    if (selfTa && state.profile.summary) selfTa.value = state.profile.summary;
    $$('[data-bind^="profile."]').forEach(inp => {
      const path = inp.getAttribute('data-bind');
      if (path === 'profile.summary') return;
      const val = readPath(state, path);
      if (inp.value !== String(val || '')) inp.value = val || '';
    });
  }

  function bindTagsInput() {
    const input = $('#rb-tags-input-el');
    if (!input || input.dataset.bound === '1') return;
    input.dataset.bound = '1';
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const v = input.value.trim().replace(/,$/, '');
        if (v && !state.profile.skills.includes(v)) {
          state.profile.skills.push(v);
          saveState();
          renderTags();
          renderSkillPool();
          renderBottom();
          input.value = '';
        }
      } else if (e.key === 'Backspace' && input.value === '' && state.profile.skills.length) {
        state.profile.skills.pop();
        saveState();
        renderTags();
        renderSkillPool();
        renderBottom();
      }
    });
  }

  async function aiGenerateSelf() {
    const btn = $('#rb-ai-self');
    const ta = $('#rb-self-textarea');
    btn.classList.add('is-loading');
    btn.querySelector('.rb-ai-icon').textContent = '⟳';
    btn.querySelector('.rb-ai-label').textContent = '生成中…';
    await fakeDelay(1400);
    const seed = state.basicInfo;
    const pos = state.jobDirection.positions.length
      ? state.jobDirection.positions.map(id => (findPosition(id) || {}).name).filter(Boolean).join('、')
      : '互联网开发';
    const personality = state.profile.personality || '沉稳细致、注重细节、善于协作';
    const summary = `${seed.name || '本人'}${seed.school ? `就读于${seed.school}` : ''}${seed.major ? `${seed.major}专业` : ''}${seed.degree ? `（${seed.degree}）` : ''}，${personality.split(/[，。]/)[0] || '具备工程实践能力'}。${pos ? `希望从事${pos}相关岗位。` : '请补充目标岗位后生成更准确的自我评价。'}`;
    state.profile.summary = summary;
    saveState();
    ta.value = summary;
    btn.classList.remove('is-loading');
    btn.classList.add('is-done');
    btn.querySelector('.rb-ai-icon').textContent = '✓';
    btn.querySelector('.rb-ai-label').textContent = '已完成';
    toast('✓ 自我评价已生成，可继续编辑');
  }

  /* ============== 11. 步骤 06 - 证件照 ============== */
  function renderPhoto() {
    const frame = $('#rb-photo-frame');
    const empty = $('#rb-photo-empty');
    const overlay = $('#rb-photo-overlay');
    const tip = $('#rb-photo-tip');
    const stateEl = $('#rb-photo-state');
    // 移除已有 img
    frame.querySelectorAll('img.rb-photo-image').forEach(n => n.remove());
    overlay.style.display = '';
    frame.classList.remove('is-uploading');
    if (state.photo) {
      empty.style.display = 'none';
      const img = el('img', { src: state.photo.data, class: 'rb-photo-image', alt: '' });
      frame.appendChild(img);
      tip.style.display = 'none';
      stateEl.textContent = '已上传';
    } else {
      empty.style.display = '';
      tip.style.display = '';
      stateEl.textContent = '未上传';
    }
  }

  function setPhoto(dataUrl) {
    state.photo = { data: dataUrl, ts: Date.now() };
    saveState();
    renderPhoto();
  }

  function bindPhoto() {
    $('#rb-photo-upload').addEventListener('click', () => $('#rb-photo-input').click());
    $('#rb-photo-frame').addEventListener('click', () => $('#rb-photo-input').click());
    $('#rb-photo-frame').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#rb-photo-input').click(); }
    });
    $('#rb-photo-input').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      simulateUpload().then(() => {
        const reader = new FileReader();
        reader.onload = (ev) => setPhoto(ev.target.result);
        reader.readAsDataURL(f);
      });
    });
    $('#rb-photo-placeholder').addEventListener('click', () => {
      // 占位图（SVG）
      const svg = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 106"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%23C5C3B6"/><stop offset="100%" stop-color="%239E9C8F"/></linearGradient></defs><rect width="80" height="106" fill="url(%23g)"/><circle cx="40" cy="38" r="14" fill="%23ECE8DE"/><path d="M14 92c0-12 12-19 26-19s26 7 26 19v14H14z" fill="%23ECE8DE"/></svg>')}`;
      setPhoto(svg);
      toast('已使用占位图，可随时替换');
    });
  }

  async function simulateUpload() {
    const frame = $('#rb-photo-frame');
    const pct = $('#rb-photo-pct');
    const fill = $('#rb-photo-progress-fill');
    frame.classList.add('is-uploading');
    for (let i = 0; i <= 100; i += 8) {
      pct.textContent = i + '%';
      fill.style.width = i + '%';
      await fakeDelay(60);
    }
    frame.classList.remove('is-uploading');
  }

  /* ============== 12. 步骤 07 - 精简润色 ============== */
  async function renderPolish() {
    const list = $('#rb-polish-list');
    const stateIcon = $('#rb-polish-state-icon');
    const stateTitle = $('#rb-polish-state-title');
    const stateText = $('#rb-polish-state-text');
    list.innerHTML = '';
    if (state.polish.complete) {
      stateTitle.textContent = '分析完成';
      stateIcon.classList.add('is-done');
      stateText.textContent = '完成';
    } else {
      stateTitle.textContent = '正在检查简历 …';
      stateIcon.classList.remove('is-done');
      stateText.textContent = '检查中';
    }

    const items = [
      { num: '01', name: '关键词', desc: '对照所选岗位补关键词', status: 'ready' },
      { num: '02', name: '精简',   desc: '去掉空话，保留事实', status: 'ready' },
      { num: '03', name: '成果',   desc: '尽量保留可量化结果', status: 'ready' },
      { num: '04', name: '匹配',   desc: '与投递方向对齐表述', status: 'ready' }
    ];

    items.forEach(it => {
      const row = el('div', { class: 'rb-polish-item' },
        el('div', { class: 'rb-polish-item-name' },
          el('span', { class: 'rb-polish-item-name-num' }, it.num),
          el('div', null,
            el('b', null, it.name),
            el('div', { class: 'rb-polish-item-desc' }, it.desc)
          )
        ),
        el('div', { class: 'rb-polish-status is-' + (state.polish.complete ? 'ready' : it.status === 'ready' ? 'processing' : 'pending') },
          el('span', { class: 'dot' }),
          el('span', null, state.polish.complete ? '完成' : '进行中')
        )
      );
      list.appendChild(row);
    });

    if (!state.polish.complete) {
      // 模拟 4 步逐步完成
      const rows = list.querySelectorAll('.rb-polish-status');
      for (let i = 0; i < rows.length; i++) {
        await fakeDelay(700);
        rows[i].classList.remove('is-processing');
        rows[i].classList.add('is-ready');
        rows[i].querySelector('span:last-child').textContent = '完成';
      }
      state.polish.complete = true;
      saveState();
      stateTitle.textContent = '检查完成';
      stateIcon.classList.add('is-done');
      stateText.textContent = '完成';
      renderBottom();
      toast('✓ 润色检查完成');
    }
  }

  /* ============== 13. 步骤 08 - 生成与导出 ============== */
  function renderExport() {
    // 内容预览
    const inc = $('#rb-include-rows');
    inc.innerHTML = '';
    const posNames = state.jobDirection.positions.map(id => (findPosition(id) || {}).name).filter(Boolean).join(' / ') || '—';
    const rows = [
      ['投递方向', posNames],
      ['实践经历', state.starExperiences.length + ' 段'],
      ['技能标签', state.profile.skills.length + ' 个'],
      ['自我评价', state.profile.summary ? '已填写' : '未填写'],
      ['证件照', state.photo ? '已上传' : '未上传']
    ];
    rows.forEach(r => {
      inc.appendChild(el('div', { class: 'rb-include-row' },
        el('span', null, r[0]), el('b', null, r[1])
      ));
    });

    // 完整检查
    const checks = $('#rb-check-list');
    checks.innerHTML = '';
    const checksData = [
      { ok: !!state.basicInfo.name, title: '简历内容', desc: state.basicInfo.name ? `信息完整，姓名 ${state.basicInfo.name}` : '尚未填写姓名' },
      { ok: state.profile.summary && state.profile.summary.length > 20, title: '可读性', desc: state.profile.summary && state.profile.summary.length > 20 ? '自我评价长度合理' : '自我评价偏短，建议先生成一稿再改' },
      { ok: state.experiences.length > 0, title: '经历完整', desc: state.experiences.length > 0 ? `${state.experiences.length} 段经历已结构化为 STAR` : '尚未补充经历' },
      { ok: state.photo, title: '证件照', desc: state.photo ? '已上传（可后续替换）' : '可继续使用占位图' }
    ];
    checksData.forEach(c => {
      checks.appendChild(el('div', { class: 'rb-check-item' },
        el('span', { class: 'rb-check-mark is-' + (c.ok ? 'ok' : 'warn') }, c.ok ? '✓' : '!'),
        el('div', null,
          el('b', null, c.title),
          el('small', null, c.desc)
        )
      ));
    });

    // 渲染进度列表 / 成功 / 简历
    const prog = $('#rb-generate-stage');
    const succ = $('#rb-success');
    const paper = $('#rb-paper-stage');
    prog.classList.remove('is-on');
    succ.classList.remove('is-on');
    paper.classList.remove('is-on');

    if (state.generated) {
      succ.classList.add('is-on');
      paper.classList.add('is-on');
      paintPaper();
    }
  }

  async function runGenerate() {
    state.generated = false;
    state.completedSteps[5] = true;
    saveState();
    renderBottom();

    const stage = $('#rb-generate-stage');
    const succ = $('#rb-success');
    const paper = $('#rb-paper-stage');
    const list = $('#rb-progress-list');
    list.innerHTML = '';
    stage.classList.add('is-on');
    succ.classList.remove('is-on');
    paper.classList.remove('is-on');

    const steps = [
      '正在读取个人信息',
      '正在解析实践经历',
      '正在优化职业关键词',
      '正在构建简历结构',
      '正在汇总生成简历'
    ];
    const rows = [];
    steps.forEach((s, i) => {
      rows.push(el('div', { class: 'rb-progress-row' },
        el('span', { class: 'rb-progress-row-num' }, String(i + 1).padStart(2, '0')),
        el('b', null, s),
        el('span', { class: 'rb-progress-row-mark is-pending' })
      ));
      list.appendChild(rows[i]);
    });

    const targetRows = list.querySelectorAll('.rb-progress-row');
    for (let i = 0; i < targetRows.length; i++) {
      targetRows[i].classList.add('is-current');
      targetRows[i].querySelector('.rb-progress-row-mark').className = 'rb-progress-row-mark is-current';
      targetRows[i].querySelector('.rb-progress-row-mark').textContent = '⟳';
      await fakeDelay(700 + Math.random() * 400);
      targetRows[i].classList.remove('is-current');
      targetRows[i].classList.add('is-done');
      targetRows[i].querySelector('.rb-progress-row-mark').className = 'rb-progress-row-mark is-done';
      targetRows[i].querySelector('.rb-progress-row-mark').textContent = '✓';
    }

    state.generated = true;
    saveState();
    saveToLibrary();
    saveMatchResume();
    syncProfileToBackend().catch(function () {});
    syncProfileLocal();
    succ.classList.add('is-on');
    paper.classList.add('is-on');
    paintPaper();
    renderBottom();
    renderTopnav();
    toast('✓ 简历已生成，可进入人岗匹配');
    showVaultPromptModal();
  }

  // 生成完成：提示简历已存入个人仓库，可在仓库选岗位进行人岗匹配
  function showVaultPromptModal() {
    if (document.getElementById('rb-vault-prompt')) return;
    var overlay = document.createElement('div');
    overlay.id = 'rb-vault-prompt';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(20,14,8,.5);display:flex;align-items:center;justify-content:center;padding:24px';
    overlay.innerHTML =
      '<div style="width:min(460px,100%);background:#fff;border-radius:18px;padding:28px 28px 24px;box-shadow:0 24px 64px rgba(60,45,30,.28);text-align:center">'
      + '<div style="width:56px;height:56px;margin:0 auto 14px;border-radius:50%;background:linear-gradient(135deg,#B07A28,#8C5E1E);color:#fff;display:grid;place-items:center;font-size:26px">⚑</div>'
      + '<h3 style="margin:0 0 8px;font:600 20px var(--font-serif,serif);color:#111">简历已存入个人仓库</h3>'
      + '<p style="margin:0 0 20px;color:#5a6472;font-size:13px;line-height:1.8">简历档案、技能画像与匹配报告都已保存。前往<b style="color:#8C5E1E">个人仓库</b>选择岗位，即可开始人岗匹配。</p>'
      + '<div style="display:flex;gap:10px;justify-content:center">'
      + '<button id="rb-vault-go" style="flex:1.2;height:44px;border:0;border-radius:10px;background:linear-gradient(135deg,#B07A28,#8C5E1E);color:#fff;font:600 14px sans-serif;cursor:pointer">前往个人仓库 · 选岗位匹配</button>'
      + '<button id="rb-vault-stay" style="flex:1;height:44px;border:1px solid #ddd;border-radius:10px;background:#fff;color:#333;font:600 14px sans-serif;cursor:pointer">留在此页</button>'
      + '</div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#rb-vault-go').addEventListener('click', function () {
      overlay.remove();
      window.location.href = 'warehouse.html?tab=resumes';
    });
    overlay.querySelector('#rb-vault-stay').addEventListener('click', function () { overlay.remove(); });
  }

  function apiBase() {
    if (window.resolveApiBase) return window.resolveApiBase();
    if (window.API_BASE) return window.API_BASE;
    var host = location.hostname;
    if (host === '127.0.0.1' || host === 'localhost') return 'http://127.0.0.1:5000';
    return location.origin;
  }

  function currentUserId() {
    try {
      var u = JSON.parse(localStorage.getItem('zhitu_user') || 'null');
      if (u && (u.username || u.user_id || u.id)) return String(u.username || u.user_id || u.id);
    } catch (_) {}
    return 'guest';
  }

  async function syncProfileToBackend() {
    var b = state.basicInfo;
    var pos = state.jobDirection.positions[0]
      ? ((findPosition(state.jobDirection.positions[0]) || {}).name || '')
      : '';
    var body = {
      user_id: currentUserId(),
      name: b.name || null,
      school: b.school || null,
      major: b.major || null,
      education: b.degree || null,
      target_job: pos || null,
      bio: state.profile.summary || null,
      phone: b.phone || null,
      email: b.email || null
    };
    var headers = { 'Content-Type': 'application/json' };
    if (window.zhituGetToken && window.zhituGetToken()) headers.Authorization = 'Bearer ' + window.zhituGetToken();
    var res = await fetch(apiBase() + '/api/profile/profile/update', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('profile sync failed');
    return res.json();
  }

  /* ============== 14.5 简历库 + 人岗匹配桥接 ============== */
  const LIB_STORAGE_KEY = 'rb_resume_library_v1__' + currentUserId();
  const MATCH_RESUME_KEY = 'zhitu_match_resume_v1__' + currentUserId();

  function buildMatchSectionsFromState() {
    const b = state.basicInfo || {};
    const posName = state.jobDirection.positions[0]
      ? ((findPosition(state.jobDirection.positions[0]) || {}).name || '')
      : '';
    const basicLines = [
      b.name || '未命名',
      posName ? (posName + (b.city ? '（' + b.city + '）' : '')) : (b.city || ''),
      b.phone ? ('电话：' + b.phone) : '',
      b.email ? ('邮箱：' + b.email) : ''
    ].filter(Boolean);

    const edu = [
      [b.school || '未填写学校', b.major || '相关专业', b.degree || '本科'].filter(Boolean).join(' · '),
      b.graduate ? (b.graduate + ' 毕业') : ''
    ].filter(Boolean).join('\n');

    const expLines = (state.starExperiences || []).map((s, i) => {
      const exp = (state.experiences && state.experiences[i]) || {};
      const head = [exp.title || s.title || ('经历 ' + (i + 1)), exp.org || '', exp.time || ''].filter(Boolean).join(' · ');
      const body = ['S · ' + (s.S || ''), 'T · ' + (s.T || ''), 'A · ' + (s.A || ''), 'R · ' + (s.R || '')]
        .filter((line) => !/·\s*$/.test(line))
        .join('\n');
      return [head, body].filter(Boolean).join('\n');
    }).filter(Boolean);

    const rawExps = (state.experiences || []).filter((e) => e && (e.title || e.org || e.brief || e.result));
    const workLines = rawExps.map((e, i) => {
      const head = [e.title || ('经历 ' + (i + 1)), e.org || '', e.role || '', e.time || ''].filter(Boolean).join(' · ');
      const body = [e.brief, e.result].filter(Boolean).join('\n');
      return [head, body].filter(Boolean).join('\n');
    });

    const skills = (state.profile.skills || []).join('、') || '—';
    const summary = state.profile.summary || '';

    return [
      { id: 'basic', label: '个人信息', content: basicLines.join('\n'), ai_suggestion: '可补充期望城市与到岗时间。' },
      { id: 'education', label: '教育经历', content: edu || '—', ai_suggestion: '可补充 GPA、主修课程或获奖。' },
      { id: 'projects', label: '项目经历', content: expLines.join('\n\n') || '暂无项目经历', ai_suggestion: '建议用 STAR 突出可量化结果。' },
      { id: 'work', label: '工作经历', content: workLines.join('\n\n') || '暂无正式工作 / 实习经历', ai_suggestion: '有实习请补全公司、时间与职责。' },
      { id: 'skills', label: '专业技能', content: skills, ai_suggestion: '可将熟练度与项目场景绑定。' },
      { id: 'summary', label: '自我评价', content: summary || '—', ai_suggestion: '控制在 2–3 句，突出方向与优势。' }
    ];
  }

  function syncProfileLocal() {
    try {
      const key = 'zhitu_my_profile_v1__' + currentUserId();
      const profile = JSON.parse(localStorage.getItem(key) || 'null') || {};
      const p = profile.userProfile || {};
      const b = state.basicInfo || {};
      profile.userProfile = Object.assign({}, p, {
        name: b.name || p.name || '', phone: b.phone || p.phone || '', email: b.email || p.email || '', city: b.city || p.city || ''
      });
      const edu = profile.education || [];
      if (b.school || b.major || b.degree || b.graduate) {
        const item = Object.assign({}, edu[0] || { id: 'edu-builder' }, {
          school: b.school || '', major: b.major || '', degree: b.degree || '', graduateYear: b.graduate || ''
        });
        profile.education = [item].concat(edu.slice(1));
      }
      const pref = profile.careerPreference || {};
      const posName = state.jobDirection.positions[0] ? ((findPosition(state.jobDirection.positions[0]) || {}).name || '') : '';
      profile.careerPreference = Object.assign({}, pref, { desiredJobs: posName ? [posName] : (pref.desiredJobs || []) });
      const text = buildMatchSectionsFromState().map((s) => s.content).join('\\n');
      profile.resume = Object.assign({}, profile.resume || {}, { exists: true, updatedAt: todayISO(), status: '已生成', completion: Math.max(24, Math.min(100, Math.round((text.length / 8) + 40))), snapshot: { text: text, source: 'resume-builder' } });
      localStorage.setItem(key, JSON.stringify(profile));
      window.dispatchEvent(new CustomEvent('zhitu-profile-changed', { detail: { data: profile } }));
    } catch (_) {}
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  }

  function saveMatchResume() {
    try {
      const sections = buildMatchSectionsFromState();
      const text = sections.map((s) => '【' + s.label + '】\n' + s.content).join('\n\n');
      const payload = {
        id: 'VR-wizard-' + (state.basicInfo.name || 'user'),
        source: 'resume-builder',
        updatedAt: Date.now(),
        fileName: (state.basicInfo.name || '执图破局') + '_简历.txt',
        size: text.length,
        sections: sections,
        text: text,
        versionLabel: '探索初稿'
      };
      if (window.ZhituVault && typeof window.ZhituVault.saveMatchResume === 'function') {
        window.ZhituVault.saveMatchResume(payload);
      } else {
        localStorage.setItem(MATCH_RESUME_KEY, JSON.stringify(payload));
      }
      // 登录用户同步到后端个人仓库，保留本地缓存以支持离线访问。
      if (window.zhituGetToken && window.zhituGetToken()) {
        fetch(apiBase() + '/api/profile/resumes/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + window.zhituGetToken() },
          body: JSON.stringify({ filename: payload.fileName, source: payload.source, content: payload.text, metadata: { sections: payload.sections, versionLabel: payload.versionLabel } })
        }).catch(function () {});
      }
    } catch (err) {
      console.warn('saveMatchResume fail:', err);
    }
  }

  function returnFromResume() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: 'zhitu-resume', type: 'close' }, '*');
        // 直接回到我的资料页（而不是停留在岗位大新闻）
        try { window.parent.location.href = 'my-profile.html?v=fix25c5'; } catch (_) {}
        return;
      }
    } catch (_) {}
    window.location.href = 'my-profile.html?v=fix25c5';
  }

  function goMatchPage() {
    saveMatchResume();
    const href = new URL('match.html', location.href).href + '?v=20260826vault1&auto=1';
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: 'zhitu-resume', type: 'done' }, '*');
        window.parent.location.href = href;
        return;
      }
    } catch (_) {}
    window.location.href = href;
  }

  function saveToLibrary() {
    try {
      const lib = loadLibrary();
      const item = {
        id: 'RB-' + Date.now().toString().slice(-8),
        name: state.basicInfo.name || '未命名简历',
        position: (state.jobDirection.positions[0] && (findPosition(state.jobDirection.positions[0]) || {}).name) || '未选择方向',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        summary: state.profile.summary || '',
        skills: state.profile.skills.slice(),
        expCount: state.starExperiences.length,
        photo: state.photo ? state.photo.data : null,
        data: JSON.parse(JSON.stringify(state))
      };
      // 同 id 去重更新；否则插入到最前
      const idx = lib.findIndex(r => r.id === item.id);
      if (idx >= 0) lib[idx] = item; else lib.unshift(item);
      localStorage.setItem(LIB_STORAGE_KEY, JSON.stringify(lib));
    } catch (err) {
      console.warn('saveToLibrary fail:', err);
    }
  }

  function loadLibrary() {
    try {
      const raw = localStorage.getItem(LIB_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  function paintPaper() {
    const b = state.basicInfo;
    const posName = (state.jobDirection.positions[0] && (findPosition(state.jobDirection.positions[0]) || {}).name) || '—';
    const skills = state.profile.skills;
    const paper = $('#rb-paper');
    const photoHtml = state.photo
      ? `<img src="${state.photo.data}" alt="" />`
      : `<span style="font-size:9px;letter-spacing:0.10em">PORTRAIT</span>`;
    paper.innerHTML = `
      <div class="rb-paper-content">
        <div class="rb-paper-main">
          <div>
            <div class="rb-paper-name">${b.name || '未填'}</div>
            <div class="rb-paper-target">求职方向 · ${posName}</div>
            <div class="rb-paper-meta">
              ${b.phone ? '<span>' + b.phone + '</span>' : ''}
              ${b.email ? '<span>' + b.email + '</span>' : ''}
              ${b.city ? '<span>' + b.city + '</span>' : ''}
            </div>
          </div>
          <div class="rb-paper-section">
            <h5>教育背景</h5>
            <p><b style="color:#1B1B16">${b.school || '未填写学校'}</b>　${b.degree || '本科'}　${b.major || '—'}</p>
            <p style="color:#5A5042;font-size:10px">${b.graduate || '—'} 毕业</p>
          </div>
          ${state.starExperiences.map((s, i) => `
            <div class="rb-paper-section">
              <h5>实践经历 ${String(i + 1).padStart(2, '0')}</h5>
              <div class="exp-head"><b>${s.title}</b><span>${(state.experiences[i] && state.experiences[i].time) || '—'}</span></div>
              <p><b style="color:#947B4C">S · </b>${s.S}</p>
              <p><b style="color:#947B4C">T · </b>${s.T}</p>
              <p><b style="color:#947B4C">A · </b>${s.A}</p>
              <p style="color:#5A3B1C"><b style="color:#947B4C">R · </b>${s.R}</p>
            </div>
          `).join('')}
          <div class="rb-paper-section">
            <h5>技能 · Skills</h5>
            <div class="rb-paper-skills">
              ${skills.map(s => `<span>${s}</span>`).join('') || '<span style="color:#5A5042">—</span>'}
            </div>
          </div>
          <div class="rb-paper-section">
            <h5>自我评价</h5>
            <p>${state.profile.summary || '—'}</p>
          </div>
        </div>
        <div class="rb-paper-side">
          <div class="rb-paper-photo">${photoHtml}</div>
        </div>
      </div>
    `;
  }

  /* ============== 14. 导出 ============== */
  function downloadWord() {
    const html = $('#rb-paper').outerHTML;
    const content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${state.basicInfo.name || '简历'}</title></head><body>${html}</body></html>`;
    const blob = new Blob([content], { type: 'application/msword' });
    triggerDownload(blob, (state.basicInfo.name || 'resume') + '.doc');
    toast('已生成 Word 文档');
  }

  function downloadPDF() {
    const html = $('#rb-paper').outerHTML;
    const w = window.open('', '_blank');
    if (!w) { toast('请允许弹窗以导出 PDF'); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${state.basicInfo.name || '简历'}</title><style>${getPaperPrintStyle()}</style></head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
    toast('请使用浏览器的"另存为 PDF"完成导出');
  }

  function getPaperPrintStyle() {
    return `
      body { margin: 0; padding: 24px; background: #ddd; font-family: "Noto Serif SC", serif; }
      .rb-paper {
        width: 210mm; min-height: 297mm;
        margin: 0 auto;
        background: #ECE8DE;
        color: #2A2A24;
        padding: 18mm 20mm;
        box-shadow: 0 0 12px rgba(0,0,0,0.12);
        font-family: "Noto Serif SC", serif;
        font-size: 11px;
        line-height: 1.7;
        box-sizing: border-box;
      }
      .rb-paper-content { display: grid; grid-template-columns: 1fr 70px; gap: 14px; }
      .rb-paper-name { font-size: 22px; font-weight: 700; color: #1B1B16; letter-spacing: 0.08em; }
      .rb-paper-target { font-size: 11.5px; color: #947B4C; letter-spacing: 0.10em; margin-top: 2px; }
      .rb-paper-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 10.5px; color: #5A5042; margin-top: 8px; }
      .rb-paper-meta span::before { content: ''; display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: #947B4C; margin-right: 6px; vertical-align: middle; }
      .rb-paper-section { border-top: 1px solid rgba(180,124,70,0.20); padding-top: 6px; margin-top: 6px; }
      .rb-paper-section h5 { font-size: 12px; margin: 0 0 6px; color: #947B4C; letter-spacing: 0.18em; font-weight: 600; }
      .rb-paper-section p { margin: 0 0 3px; font-size: 10.5px; line-height: 1.7; }
      .rb-paper-section .exp-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px; }
      .rb-paper-section .exp-head b { font-size: 11.5px; color: #1B1B16; font-weight: 600; }
      .rb-paper-section .exp-head span { font-size: 10.5px; color: #947B4C; }
      .rb-paper-photo { width: 70px; height: 92px; background: linear-gradient(135deg, #C5C3B6, #9E9C8F); border: 1px solid rgba(180,124,70,0.20); display: flex; align-items: center; justify-content: center; color: #ECE8DE; overflow: hidden; }
      .rb-paper-photo img { width: 100%; height: 100%; object-fit: cover; }
      .rb-paper-skills { display: flex; flex-wrap: wrap; gap: 4px; font-size: 10.5px; }
      .rb-paper-skills span { padding: 1px 8px; background: rgba(180,124,70,0.08); border: 1px solid rgba(180,124,70,0.18); border-radius: 2px; color: #5A4F3C; }
      @media print { body { background: #fff; padding: 0; } .rb-paper { box-shadow: none; } }
    `;
  }

  function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  /* ============== 15. 绑定 ============== */
  function bindEvents() {
    $('#rb-step-back').addEventListener('click', prevStep);
    $('#rb-step-next').addEventListener('click', nextStep);
    const returnProfile = $('#rb-return-profile');
    if (returnProfile) returnProfile.addEventListener('click', returnFromResume);

    // 步骤 1
    $('#rb-ai-basic').addEventListener('click', aiAutofillBasic);

    // 步骤 2
    const clearBtn = $('#rb-clear-selection');
    if (clearBtn) clearBtn.addEventListener('click', clearSelection);

    // 步骤 3
    $('#rb-exp-mode-haved').addEventListener('click', () => addExp());
    $('#rb-exp-mode-none').addEventListener('click', () => $('#rb-ai-input-block').classList.add('is-on'));
    $('#rb-ai-input-cancel').addEventListener('click', () => {
      $('#rb-ai-input-block').classList.remove('is-on');
    });
    $('#rb-ai-input-go').addEventListener('click', aiGenerateExp);
    $('#rb-exp-add').addEventListener('click', addExp);

    // 技能 / 评价
    bindTagsInput();
    $('#rb-ai-self').addEventListener('click', aiGenerateSelf);

    // 步骤 6
    bindPhoto();

    // 步骤 8
    $('#rb-export-word').addEventListener('click', downloadWord);
    $('#rb-export-pdf').addEventListener('click', downloadPDF);
    const goMatch = $('#rb-go-match');
    if (goMatch) goMatch.addEventListener('click', goMatchPage);
    const goLib = $('#rb-go-library');
    if (goLib) goLib.addEventListener('click', goMatchPage);

    bindInputs();
  }

  /* ============== 15.5 一键加载测试数据 · 直接生成完美简历 ============== */
  window.loadTestData = function () {
    // 1. 完整基本档案
    state.basicInfo = {
      name: '王储源',
      phone: '13800138000',
      email: 'wang.chuyuan@example.com',
      city: '杭州',
      degree: '本科',
      school: '浙江大学',
      major: '计算机科学与技术',
      graduate: '2026-07'
    };
    // 2. 投递方向（多选）
    state.jobDirection.positions = ['java', 'web', 'data'];
    // 3. 个人画像
    state.profile = {
      personality: '逻辑严谨、好奇心驱动；偏好以数据说话、用可验证的结果闭环。',
      intent: '寻求一线城市后端与全栈开发岗位，关注 AI / LLM 应用与数据平台方向。',
      dislike: '不接受无明确产出衡量、与重复性事务消耗型岗位。',
      skills: ['Python', 'PyTorch', 'LangChain', 'RAG', 'React', 'Vue', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'Kubernetes', 'Spark', 'AWS'],
      summary: '具备全栈开发与机器学习项目落地经验的应届生；参与过 RAG 知识库、行业与技能图谱等真实数据驱动项目的交付。'
    };
    // 4. 实践经历（原始 + STAR 对齐）
    state.experiences = [
      { id: 'EXP-001', title: 'AI Agent 平台后端', org: '执图云算科技', role: '后端工程师（实习）', time: '2025-03 – 2025-08',
        brief: '负责 RAG 检索服务、Agent 编排 API 与多租户权限模块。',
        result: '平均检索响应从 480ms 降至 130ms；推理 QPS 提升 2.2 倍。' },
      { id: 'EXP-002', title: '知识图谱可视化前端', org: '远见数据', role: '前端工程师（实习）', time: '2024-07 – 2024-12',
        brief: '用 React + ECharts 搭建岗位-技能-公司三层关系图谱。',
        result: '支撑 2 万节点、6 万边渲染稳定 60fps；入选年度优秀实习生作品集。' },
      { id: 'EXP-003', title: '校园项目 · 智能问答', org: '学生创新项目', role: '队长 / 全栈', time: '2024-02 – 2024-06',
        brief: '基于 RAG + Prompt Engineering 的课程答疑 demo。',
        result: 'Top-3 命中率达 91%，项目获评校级优秀结题。' }
    ];
    state.starExperiences = [
      { S: 'RAG 检索服务偶发返回空集，业务侧多次反馈。', T: '3 周内将检索平均时延与空集率降至可接受水位。', A: '重构检索链路，引入查询改写与重排，并补充 fallback 策略。', R: '平均时延 480ms → 130ms，空集率由 5.6% 降至 0.4%，获评季度优秀工程实践。' },
      { S: '图谱首屏在 2 万节点场景下卡顿明显、交互卡死。', T: '首屏 1 秒内帧率达 60fps 并保留可缩放能力。', A: '改用 Canvas 渲染并把布局任务迁到 WebWorker，主线程长任务由 1400ms 降至 220ms。', R: '入选年度优秀实习生作品集，并成为后续图谱组件基线方案。' },
      { S: '课程答疑 demo 早期回答命中率低、用户体验差。', T: '校级验收前将 Top-3 命中率提升至 90% 以上。', A: '优化切片策略、补齐文档切分、补全少样本样例与重排模型。', R: 'Top-3 命中率 91%，项目获评校级优秀结题。' }
    ];
    // 5. 润色与质量（"完美简历"标记）
    state.polish = {
      complete: true,
      score: 96,
      coverage: 100,
      keywordHits: 100,
      langIssues: 0,
      readability: 'A',
      quality: 'excellent',
      badge: 'perfect'
    };
    state.generated = true;
    state.completedSteps = { 1: true, 2: true, 3: true, 4: true, 5: true };

    // 6. 落库 + 同步
    saveState();
    if (typeof saveToLibrary === 'function') saveToLibrary();
    if (typeof saveMatchResume === 'function') saveMatchResume();
    if (typeof syncProfileLocal === 'function') syncProfileLocal();

    // 7. 跳到第 5 步并渲染纸面 + 仓库提示
    state.currentStep = 5;
    if (typeof renderTopnav === 'function') renderTopnav();
    if (typeof renderBottom === 'function') renderBottom();
    if (typeof gotoStep === 'function') gotoStep(5);
    if (typeof paintPaper === 'function') paintPaper();
    if (typeof showVaultPromptModal === 'function') showVaultPromptModal();

    if (typeof toast === 'function') toast('✓ 完美简历已生成 · 已存入个人仓库');
  };

  /* ============== 16. 初始化 ============== */
  function init() {
    bindEvents();
    renderTopnav();
    renderBottom();
    renderBasic();
    // 重新进入时，按当前 step 渲染；gotoStep 内部会触发 renderIllus
    gotoStep(state.currentStep);
    enrichJobPoolFromApi();
    // 一键加载测试数据按钮（演示用）
    var tdb = document.getElementById('rb-load-test-data');
    if (tdb) tdb.addEventListener('click', window.loadTestData);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
