/* ============================================================
 * AI 简历生成器 · 未来生态都市终端
 * 主控：步骤管理 + 数据绑定 + AI Mock + 简历预览
 * ============================================================ */

(function () {
  'use strict';

  /* ============== 1. 数据状态 ============== */
  const STORAGE_KEY = 'rb_builder_state_v1';

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
    experiences: [{
      id: 0,
      type: '', time: '', title: '',
      org: '', role: '',
      brief: '', result: ''
    }],
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
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        // 一次性清理旧版本累积的多余经历，只保留第一条（已清理过则跳过）
        if (Array.isArray(obj.experiences) && obj.experiences.length > 1 && !obj._expClean) {
          obj.experiences = obj.experiences.slice(0, 1);
          obj._expClean = true;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (_) {}
        }
        return Object.assign({}, defaultState, obj, {
          basicInfo: Object.assign({}, defaultState.basicInfo, obj.basicInfo || {}),
          jobDirection: Object.assign({}, defaultState.jobDirection, obj.jobDirection || { positions: [] }),
          experiences: obj.experiences && obj.experiences.length ? obj.experiences : defaultState.experiences.slice(),
          starExperiences: obj.starExperiences || [],
          profile: Object.assign({}, defaultState.profile, obj.profile || {}, { skills: (obj.profile && obj.profile.skills) || [] }),
          photo: obj.photo || null,
          ai: Object.assign({}, defaultState.ai, obj.ai || {}),
          polish: Object.assign({}, defaultState.polish, obj.polish || {}),
          completedSteps: obj.completedSteps || {}
        });
      }
    } catch (err) { console.warn('rb state load fail:', err); }
    return JSON.parse(JSON.stringify(defaultState));
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) { console.warn('rb state save fail:', err); }
  }

  /* ============== 2. 工具 ============== */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(k => {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(node.style, attrs[k]);
        else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (k === 'dataset') Object.assign(node.dataset, attrs[k]);
        else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
      });
    }
    const appendChild = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { c.forEach(appendChild); return; }
      if (typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(String(c)));
      else node.appendChild(c);
    };
    children.forEach(appendChild);
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
    { id: 1, label: '基础信息',     short: '基础信息' },
    { id: 2, label: '画像与方向',   short: '画像与方向' },
    { id: 3, label: '经历补充',     short: '经历补充' },
    { id: 4, label: 'STAR 结构化',  short: 'STAR 结构化' },
    { id: 5, label: '软件信息',     short: '软件信息' },
    { id: 6, label: '证件照',       short: '证件照' },
    { id: 7, label: '精简润色',     short: '精简润色' },
    { id: 8, label: '生成与导出',   short: '生成与导出' }
  ];

  const POSITION_LIST = [
    { id: 'java',  name: 'Java 后端开发',    meta: 'BACKEND' },
    { id: 'web',   name: 'Web 前端开发',     meta: 'FRONTEND' },
    { id: 'full',  name: '全栈开发工程师',   meta: 'FULLSTACK' },
    { id: 'test',  name: '软件测试工程师',   meta: 'QA' },
    { id: 'ops',   name: '技术支持工程师',   meta: 'SUPPORT' },
    { id: 'pm',    name: '产品经理（技术方向）', meta: 'PRODUCT' },
    { id: 'data',  name: '数据分析师',       meta: 'DATA' },
    { id: 'it',    name: 'IT 运维工程师',    meta: 'OPS' }
  ];

  /* ============== 4. 步骤渲染 ============== */
  function renderTopnav() {
    const nav = $('#rb-topnav-steps');
    nav.innerHTML = '';
    STEPS.forEach(s => {
      const isDone = state.completedSteps[s.id];
      const isActive = s.id === state.currentStep;
      const reachable = s.id <= state.currentStep || isDone || s.id === Math.min(...Object.keys(state.completedSteps).map(Number).filter(n => state.completedSteps[n]), state.currentStep + 1) ;
      const dis = !reachable && s.id > state.currentStep && !isDone;
      const btn = el('button', {
        class: 'rb-step' + (isActive ? ' is-active' : '') + (isDone ? ' is-done' : ''),
        type: 'button',
        'data-step': s.id,
        'aria-disabled': dis ? 'true' : 'false'
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
    if (stepId === 3) return state.experiences.length > 0;
    if (stepId === 4) return state.starExperiences.length > 0;
    if (stepId === 5) return !!(state.profile.summary && state.profile.skills.length > 0);
    if (stepId === 6) return !!state.photo;
    if (stepId === 7) return !!state.polish.complete;
    return true;
  }

  /* ============== 4.5 左侧全列步骤插图 ============== */
  /* 根据当前步骤切换 .rb-left-bg 的 background-image 为对应 step-N.jpg */
  /* 同时更新副标与左下角标题 / 描述文案，与每一步一一对应 */
  const ILLUS_COPY = {
    1: {
      title: '先认识<br/><em>你</em>',
      desc: '从姓名、联系方式与教育背景开始，AI 为你打好这份档案的第一块基石。'
    },
    2: {
      title: '找准<br/><em>方向</em>',
      desc: 'AI 根据你的专业与经历画出个人画像，圈出 1-3 个最适合你的投递岗位。'
    },
    3: {
      title: '收集<br/><em>经历</em>',
      desc: '把实习、项目与校园实践写进来。没有也没关系，AI 会按你的画像帮你生成。'
    },
    4: {
      title: '重构<br/><em>亮点</em>',
      desc: '每段经历按 STAR 法则重新结构化：情境、任务、行动、结果，让成果被看见。'
    },
    5: {
      title: '认识<br/><em>自己</em>',
      desc: '性格、职业意愿与技能标签，这些软信息让简历从「合格」变得有温度。'
    },
    6: {
      title: '留下<br/><em>印象</em>',
      desc: '上传一张清晰的证件照，为简历添上你的面孔；占位图同样可以随时补传。'
    },
    7: {
      title: '打磨<br/><em>表达</em>',
      desc: 'AI 会检查全文表达，压缩冗余、突出成果与关键词，让每句话更有力量。'
    },
    8: {
      title: '翻开<br/><em>未来</em>',
      desc: '所有信息已就绪。生成一份专业简历，进入简历库查看、分析与匹配。'
    }
  };

  let _illusTimer = null;
  let _illusLastIdx = -1;
  function renderIllus(stepId) {
    const box = document.getElementById('rb-left-bg');
    if (!box) return;
    const idx = Math.min(Math.max(1, stepId | 0), STEPS.length);
    if (idx === _illusLastIdx) return; // 同一张图无需切换
    _illusLastIdx = idx;
    if (_illusTimer) { clearTimeout(_illusTimer); _illusTimer = null; }
    box.classList.add('is-switching');
    _illusTimer = setTimeout(() => {
      box.style.backgroundImage = `url('../images/resume-step-${idx}.jpg')`;
      // 强制一次重排再撤掉过渡态，触发淡入
      // eslint-disable-next-line no-unused-expressions
      box.offsetHeight;
      box.classList.remove('is-switching');
      _illusTimer = null;
    }, 220);

    // 同步更新步骤副标
    const eyebrow = document.getElementById('rb-left-step-eyebrow');
    if (eyebrow) {
      eyebrow.textContent = `STEP ${String(idx).padStart(2, '0')} · NEXUS`;
    }

    // 同步更新左下角标题与描述，与每一步一一对应
    const copy = ILLUS_COPY[idx];
    if (copy) {
      const title = document.getElementById('rb-left-title');
      if (title) title.innerHTML = copy.title;
      const desc = document.getElementById('rb-left-desc');
      if (desc) desc.textContent = copy.desc;
    }
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
    if (stepId === 2) renderPositions();
    if (stepId === 3) renderExpList();
    if (stepId === 4) renderStarList();
    if (stepId === 5) renderTags();
    if (stepId === 7) renderPolish();
    if (stepId === 8) renderExport();
    if (stepId === 6) renderPhoto();
    if (stepId === 1) renderBasic();
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
      });
    });
  }

  /* AI 自动补全 - 基础信息 */
  async function aiAutofillBasic() {
    const btn = $('#rb-ai-basic');
    if (!btn || btn.classList.contains('is-loading')) return;
    btn.classList.add('is-loading');
    btn.querySelector('.rb-ai-icon').textContent = '⟳';
    btn.querySelector('.rb-ai-label').textContent = 'AI 整理中...';
    await fakeDelay(1400);
    const seed = state.basicInfo;
    if (!seed.major) seed.major = '软件工程';
    if (!seed.school) seed.school = '某 211 高校';
    if (!seed.degree) seed.degree = '本科';
    if (!seed.city) seed.city = '上海';
    if (!seed.graduate) seed.graduate = '2025.06';
    if (!seed.email) seed.email = 'name_' + Math.floor(Math.random() * 9999) + '@example.com';
    if (!seed.phone) seed.phone = '138 ' + Math.floor(1000 + Math.random() * 8999) + ' ' + Math.floor(1000 + Math.random() * 8999);
    saveState();
    renderBasic();
    btn.classList.remove('is-loading');
    btn.classList.add('is-done');
    btn.querySelector('.rb-ai-icon').textContent = '✓';
    btn.querySelector('.rb-ai-label').textContent = '已自动整理';
    toast('✓ 基础信息已智能补全');
  }

  /* ============== 7. 步骤 02 - 求职方向 ============== */
  function renderPositions() {
    const list = $('#rb-positions');
    list.innerHTML = '';
    POSITION_LIST.forEach(p => {
      const on = state.jobDirection.positions.includes(p.id);
      const item = el('button', {
        class: 'rb-position' + (on ? ' is-on' : ''),
        type: 'button'
      },
        el('span', { class: 'rb-position-dot' }),
        el('span', { class: 'rb-position-name' }, p.name),
        el('span', { class: 'rb-position-meta' }, p.meta)
      );
      item.addEventListener('click', () => {
        const arr = state.jobDirection.positions;
        const idx = arr.indexOf(p.id);
        if (idx >= 0) arr.splice(idx, 1);
        else {
          if (arr.length >= 3) {
            toast('最多选择 3 个方向');
            return;
          }
          arr.push(p.id);
        }
        saveState();
        renderPositions();
      });
      list.appendChild(item);
    });

    // 同步 persona 文本
    const personaEl = $('#rb-persona-text');
    if (personaEl) {
      const b = state.basicInfo;
      const parts = [];
      parts.push(`就读于 <em>${b.school || '某高校'} ${b.major || '相关'}</em> 专业${b.degree || ''}生。`);
      if (b.city) parts.push(`期望在 <em>${b.city}</em> 寻找发展机会。`);
      const firstThree = state.jobDirection.positions.length
        ? state.jobDirection.positions.map(id => POSITION_LIST.find(x => x.id === id).name).join('、')
        : '';
      if (firstThree) parts.push(`目前重点关注 <em>${firstThree}</em> 等方向。`);
      parts.push('结合 AI 分析：你的课程结构与项目经历更偏向 <em>工程实现方向</em>，建议优先投递与开发或测试相关岗位。');
      personaEl.innerHTML = parts.join(' ');
    }
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
            el('button', { class: 'rb-icon-btn', type: 'button', title: '上移', onclick: () => moveExp(i, -1) }, '↑'),
            el('button', { class: 'rb-icon-btn', type: 'button', title: '下移', onclick: () => moveExp(i, +1) }, '↓'),
            el('button', { class: 'rb-icon-btn', type: 'button', title: '删除', onclick: () => removeExp(i) }, '×')
          )
        ),
        el('div', { class: 'rb-exp-row' },
          expField('类型', el('select', null,
            el('option', { value: '' }, '—'),
            ['实习', '项目', '竞赛', '校园'].map(t => el('option', { value: t, selected: exp.type === t ? 'selected' : null }, t))
          ), exp, 'type'),
          expField('时间', el('input', { type: 'text', value: exp.time, placeholder: '2024.06 - 2024.09' }), exp, 'time')
        ),
        el('div', { class: 'rb-exp-row' },
          expField('公司 / 项目', el('input', { type: 'text', value: exp.org, placeholder: '公司名或项目名' }), exp, 'org'),
          expField('角色', el('input', { type: 'text', value: exp.role, placeholder: '如：后端开发 / 算法助理' }), exp, 'role')
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
    saveState(); renderExpList();
  }
  function removeExp(i) {
    state.experiences.splice(i, 1);
    saveState(); renderExpList();
  }
  function addExp() {
    state.experiences.push({
      id: Date.now(),
      type: '', time: '', title: '',
      org: '', role: '',
      brief: '', result: ''
    });
    saveState(); renderExpList();
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
      ? POSITION_LIST.find(p => p.id === state.jobDirection.positions[0]).name
      : '开发实习生';
    const brief = keywords.length > 1
      ? `在${keywords[0] || '校园项目'}中负责${keywords.slice(1).join('、')}等工作，与团队一起完成从需求拆解、接口设计到上线验证的完整链路。`
      : '在校园项目中负责核心模块开发，参与从需求分析到上线验证的全流程，并与前端 / 测试协作完成功能交付。';
    const result = '沉淀出一份可复用的' + (keywords[0] || '项目') + '模板，为后续团队迭代减少 30% 的重复工作量；过程中熟悉了工程规范、版本管理与上线节奏。';

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
    // 若存在一条全空的初始经历，则替换它；否则追加新经历
    const emptyIdx = state.experiences.findIndex(e => e && !e.type && !e.time && !e.org && !e.role && !e.brief && !e.result && !e.title);
    if (emptyIdx >= 0) state.experiences[emptyIdx] = newExp;
    else state.experiences.push(newExp);
    saveState();

    btn.classList.remove('is-loading');
    btn.classList.add('is-done');
    btn.querySelector('.rb-ai-icon').textContent = '✓';
    btn.querySelector('.rb-ai-label').textContent = '已完成';
    $('#rb-ai-input-block').classList.remove('is-on');
    state.ai.expHint = '';
    $('#rb-ai-input-block textarea').value = '';
    renderExpList();
    toast('✓ AI 已根据你的描述生成 1 段经历');
  }

  /* ============== 9. 步骤 04 - STAR 结构化 ============== */
  async function renderStarList() {
    const list = $('#rb-star-list');
    const loading = $('#rb-star-loading');
    const numEl = $('#rb-star-num');
    list.innerHTML = '';
    loading.style.display = '';
    if (state.experiences.length === 0) {
      numEl.textContent = 0;
      loading.querySelector('.rb-star-loading-text').innerHTML = '你还没有经历 · <b style="color:var(--mist-dim)">请返回第 3 步先补充经历</b>';
      return;
    }
    numEl.textContent = state.experiences.length;
    if (state.starExperiences.length === state.experiences.length && state.starExperiences.every((s, i) => s.id === state.experiences[i].id)) {
      // 已结构化，直接渲染
      loading.style.display = 'none';
      paintStarList();
      return;
    }
    await fakeDelay(1300);
    // 根据经历自动生成 STAR
    state.starExperiences = state.experiences.map((exp, i) => ({
      id: exp.id,
      title: exp.title || ('经历 ' + (i + 1)),
      S: state.starExperiences[i]?.S || expToSTAR(exp).S,
      T: state.starExperiences[i]?.T || expToSTAR(exp).T,
      A: state.starExperiences[i]?.A || expToSTAR(exp).A,
      R: state.starExperiences[i]?.R || expToSTAR(exp).R
    }));
    saveState();
    loading.style.display = 'none';
    paintStarList();
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
    wrap.querySelectorAll('.rb-tag').forEach(n => n.remove());
    state.profile.skills.forEach((s, i) => {
      const tag = el('span', { class: 'rb-tag' }, s,
        el('button', { class: 'rb-tag-remove', type: 'button', onclick: (e) => {
          e.preventDefault();
          state.profile.skills.splice(i, 1);
          saveState();
          renderTags();
        } }, '×')
      );
      wrap.insertBefore(tag, input);
    });
    const selfTa = $('#rb-self-textarea');
    if (selfTa && state.profile.summary) selfTa.value = state.profile.summary;
    $$('[data-bind^="profile."]').forEach(input => {
      const path = input.getAttribute('data-bind');
      if (path === 'profile.summary') return; // handled above
      const val = readPath(state, path);
      if (input.value !== String(val || '')) input.value = val || '';
    });
  }

  function bindTagsInput() {
    const input = $('#rb-tags-input-el');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const v = input.value.trim().replace(/,$/, '');
        if (v && !state.profile.skills.includes(v)) {
          state.profile.skills.push(v);
          saveState();
          renderTags();
          input.value = '';
        }
      } else if (e.key === 'Backspace' && input.value === '' && state.profile.skills.length) {
        state.profile.skills.pop();
        saveState(); renderTags();
      }
    });
  }

  async function aiGenerateSkills() {
    const btn = $('#rb-ai-skills');
    btn.classList.add('is-loading');
    btn.querySelector('.rb-ai-icon').textContent = '⟳';
    btn.querySelector('.rb-ai-label').textContent = '推荐中…';
    await fakeDelay(1200);
    const seed = (state.basicInfo.major || '') + ' ' + (state.profile.intent || '') + ' ' +
                 state.jobDirection.positions.map(id => POSITION_LIST.find(p => p.id === id).name).join(' ');
    const set = new Set(state.profile.skills);
    const pool = ['Java', 'Python', 'JavaScript', 'TypeScript', 'HTML / CSS', 'Vue.js', 'React',
                  'Spring Boot', 'MySQL', 'Redis', 'Git', 'Docker', '数据结构', '算法基础',
                  'Linux 命令', 'RESTful API', 'Axios / Fetch', 'Webpack', 'MyBatis', 'Nginx'];
    pool.forEach(p => {
      if (set.size < 8 && (seed.includes(p) || /(开发|工程|编程|软件|计算机|Java|Web|前端|后端|数据)/i.test(seed))) {
        if (Math.random() > 0.4 && !set.has(p)) { set.add(p); }
      }
    });
    if (set.size < 4) {
      ['Java', 'Spring Boot', 'MySQL', 'Git'].forEach(p => set.add(p));
    }
    state.profile.skills = Array.from(set).slice(0, 10);
    saveState();
    renderTags();
    btn.classList.remove('is-loading');
    btn.classList.add('is-done');
    btn.querySelector('.rb-ai-icon').textContent = '✓';
    btn.querySelector('.rb-ai-label').textContent = '已推荐';
    toast('✓ AI 已推荐技能标签');
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
      ? state.jobDirection.positions.map(id => POSITION_LIST.find(p => p.id === id).name).join('、')
      : '互联网开发';
    const personality = state.profile.personality || '沉稳细致、注重细节、善于协作';
    const summary = `${seed.name || '我'}就读于${seed.school || '某高校'}${seed.major || '软件工程'}专业${seed.degree || '本科'}生，${personality.split(/[，。]/)[0] || '具备良好的工程素养'}。在校园学习和项目实践中，我对${pos}方向产生了浓厚兴趣，熟悉相关核心技术与开发流程。希望未来能够加入一个有清晰节奏与成长路径的工程团队，把课堂与项目里沉淀的能力转化为可被业务使用的产品。`;
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
      stateText.textContent = 'READY';
    } else {
      stateTitle.textContent = '正在分析简历 …';
      stateIcon.classList.remove('is-done');
      stateText.textContent = 'Processing';
    }

    const items = [
      { num: '01', name: '关键词优化', desc: '为每段经历匹配岗位核心词', status: 'ready' },
      { num: '02', name: '内容精简',   desc: '压缩冗余描述，保留关键信息', status: 'ready' },
      { num: '03', name: '成果强化',   desc: '突出量化数据与业务价值',     status: 'ready' },
      { num: '04', name: '岗位匹配',   desc: '与所选岗位方向做匹配度对齐', status: 'ready' }
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
          el('span', null, state.polish.complete ? 'READY' : 'PROCESSING')
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
        rows[i].querySelector('span:last-child').textContent = 'READY';
      }
      state.polish.complete = true;
      saveState();
      stateTitle.textContent = '分析完成';
      stateIcon.classList.add('is-done');
      stateText.textContent = 'READY';
      toast('✓ 简历润色分析完成');
    }
  }

  /* ============== 13. 步骤 08 - 生成与导出 ============== */
  function renderExport() {
    // 内容预览
    const inc = $('#rb-include-rows');
    inc.innerHTML = '';
    const posNames = state.jobDirection.positions.map(id => POSITION_LIST.find(p => p.id === id).name).join(' / ') || '—';
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
      { ok: state.profile.summary && state.profile.summary.length > 20, title: '可读性', desc: state.profile.summary && state.profile.summary.length > 20 ? '自我评价长度合理' : '自我评价偏短，建议先 AI 生成' },
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
    state.completedSteps[8] = true;
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
      '正在生成最终档案'
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
    await saveToLibrary();
    succ.classList.add('is-on');
    paper.classList.add('is-on');
    paintPaper();
    renderBottom();
    renderTopnav();
    toast('✓ 简历已生成，已存入简历库');
  }

  /* ============== 14.5 简历库 ============== */
  const LIB_STORAGE_KEY = 'rb_resume_library_v1';

  /** 压缩 base64 图片，防止 localStorage 配额超限 */
  function compressImage(dataUrl, maxW) {
    maxW = maxW || 300;
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          try {
            const ratio = Math.min(1, maxW / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * ratio));
            canvas.height = Math.max(1, Math.round(img.height * ratio));
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          } catch (_) { resolve(dataUrl); }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      } catch (_) { resolve(dataUrl); }
    });
  }

  async function saveToLibrary() {
    try {
      const lib = loadLibrary();
      // 照片超过 200KB 则压缩，避免超出 localStorage 配额
      let photoData = state.photo ? state.photo.data : null;
      if (photoData && photoData.length > 200 * 1024) {
        photoData = await compressImage(photoData);
      }
      const data = JSON.parse(JSON.stringify(state));
      if (data.photo && photoData) data.photo.data = photoData;

      const item = {
        id: 'RB-' + Date.now().toString().slice(-8),
        name: state.basicInfo.name || '未命名简历',
        position: (state.jobDirection.positions[0] && POSITION_LIST.find(p => p.id === state.jobDirection.positions[0]).name) || '未选择方向',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        summary: state.profile.summary || '',
        skills: state.profile.skills.slice(),
        expCount: state.starExperiences.length,
        photo: photoData,
        data
      };
      // 同 id 去重更新；否则插入到最前
      const idx = lib.findIndex(r => r.id === item.id);
      if (idx >= 0) lib[idx] = item; else lib.unshift(item);
      localStorage.setItem(LIB_STORAGE_KEY, JSON.stringify(lib));
    } catch (err) {
      // 兜底：去掉照片再存一次，保证简历文字内容一定能进库
      console.warn('saveToLibrary fail (retry without photo):', err);
      try {
        const lib = loadLibrary();
        const data = JSON.parse(JSON.stringify(state));
        delete data.photo;
        const item = {
          id: 'RB-' + Date.now().toString().slice(-8),
          name: state.basicInfo.name || '未命名简历',
          position: (state.jobDirection.positions[0] && POSITION_LIST.find(p => p.id === state.jobDirection.positions[0]).name) || '未选择方向',
          createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
          summary: state.profile.summary || '',
          skills: state.profile.skills.slice(),
          expCount: state.starExperiences.length,
          photo: null,
          data
        };
        lib.unshift(item);
        localStorage.setItem(LIB_STORAGE_KEY, JSON.stringify(lib));
      } catch (e2) {
        console.warn('saveToLibrary retry fail:', e2);
      }
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
    const posName = (state.jobDirection.positions[0] && POSITION_LIST.find(p => p.id === state.jobDirection.positions[0]).name) || '—';
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
            <p><b style="color:#1B1B16">${b.school || '某高校'}</b>　${b.degree || '本科'}　${b.major || '—'}</p>
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
    $('#rb-go-home').addEventListener('click', () => {
      saveState();
      toast('✓ 进度已暂存');
      setTimeout(() => { window.location.href = 'home.html'; }, 500);
    });

    // 步骤 1
    $('#rb-ai-basic').addEventListener('click', aiAutofillBasic);

    // 步骤 3
    $('#rb-exp-mode-haved').addEventListener('click', () => addExp());
    $('#rb-exp-mode-none').addEventListener('click', () => $('#rb-ai-input-block').classList.add('is-on'));
    $('#rb-ai-input-cancel').addEventListener('click', () => {
      $('#rb-ai-input-block').classList.remove('is-on');
    });
    $('#rb-ai-input-go').addEventListener('click', aiGenerateExp);
    $('#rb-exp-add').addEventListener('click', addExp);

    // 步骤 5
    bindTagsInput();
    $('#rb-ai-skills').addEventListener('click', aiGenerateSkills);
    $('#rb-ai-self').addEventListener('click', aiGenerateSelf);

    // 步骤 6
    bindPhoto();

    // 步骤 8
    $('#rb-export-word').addEventListener('click', downloadWord);
    $('#rb-export-pdf').addEventListener('click', downloadPDF);
    $('#rb-go-library').addEventListener('click', () => { window.location.href = 'resume-library.html'; });

    bindInputs();
  }

  /* ============== 16. 初始化 ============== */
  function init() {
    // 顶部时间
    function tick() {
      const tEl = $('#rb-status-time');
      if (tEl) tEl.textContent = clockNow();
      const arch = $('#rb-arch-id');
      if (arch && arch.textContent === 'AX-0000-0000') arch.textContent = randId();
    }
    tick();
    setInterval(tick, 30000);

    bindEvents();
    renderTopnav();
    renderBottom();
    renderBasic();
    // 重新进入时，按当前 step 渲染；gotoStep 内部会触发 renderIllus 同步左栏全列背景
    gotoStep(state.currentStep);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
