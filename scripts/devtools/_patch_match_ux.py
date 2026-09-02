# -*- coding: utf-8 -*-
from pathlib import Path

p = Path('frontend/js/pages/match.js')
t = p.read_text(encoding='utf-8')

old_prog = '''  // 顶部进度节点（去掉了\\"能力\\"；\\"学习\\"与\\"面试\\"并联，表示可反复循环：学完面试，面试完再学）
  const PROGRESS_NODES = [
    { id: 'resume', label: '简历' }, { id: 'match', label: '匹配' }, { id: 'jobs', label: '岗位' },
    { id: 'learn', label: '学习' }, { id: 'interview', label: '面试' }
  ];
  // 学习 ↔ 面试 是循环关系：后面的连线是一个 \\"双向循环\\" 图标
  const LOOP_PAIR_IDS = ['learn', 'interview'];'''

# file may have different escaping - try raw from file
import re
m = re.search(r"  // 顶部进度节点.*?const LOOP_PAIR_IDS = \['learn', 'interview'\];", t, re.S)
if not m:
    raise SystemExit('PROGRESS_NODES block not found')
new_prog = '''  // 顶部进度：唯一主路径导航（左栏已隐藏）
  const PROGRESS_NODES = [
    { id: 'resume', label: '简历', hint: '确认简历后开始匹配' },
    { id: 'match', label: '匹配', hint: '设定条件并运行匹配' },
    { id: 'jobs', label: '岗位', hint: '挑选目标岗位' },
    { id: 'learn', label: '学习', hint: '针对岗位补缺口' },
    { id: 'interview', label: '面试', hint: '模拟面试演练' }
  ];
  const LOOP_PAIR_IDS = ['learn', 'interview'];

  const STEP_GUIDE = {
    resume: { k: 'STEP 01 · 确认简历', t: '先确认左侧简历无误，再点「开始匹配」。需要改稿时再开「精修」。' },
    match: { k: 'STEP 02 · 设定条件', t: '确认城市与方向后直接运行匹配。细则可展开调整，不影响主流程。' },
    analysis: { k: '分析中', t: '正在对照简历与条件生成岗位清单…' },
    jobs: { k: 'STEP 03 · 选岗决策', t: '点左侧岗位看匹配原因；选定后可去「学习」补缺口，或直接「面试」演练。' },
    learn: { k: 'STEP 04 · 针对岗位提升', t: '围绕当前岗位补能力缺口；学完可切到面试演练，面完再回来学——可循环。' },
    interview: { k: 'STEP 04 · 模拟面试', t: '针对当前岗位练问答；面完可回学习继续补强。' },
    compare: { k: '对比视图', t: '对照标杆与能力差距，辅助决策。' }
  };'''
t = t[:m.start()] + new_prog + t[m.end():]

# Patch toast message in renderProgress
t = t.replace(
    "window.showToast('请先完成前面的诊断步骤', 'amber');",
    "const need = PROGRESS_NODES[cur]; window.showToast(need && need.hint ? ('下一步：' + need.hint) : '请先完成前面的步骤', 'amber');"
)

# Add title to prog node button
t = t.replace(
    'const node = `<button class="wks-prog-node ${state}" data-prog="${n.id}" type="button">${dot}<span>${escapeHtml(n.label)}</span></button>`;',
    'const node = `<button class="wks-prog-node ${state}" data-prog="${n.id}" type="button" title="${escapeHtml(n.hint || n.label)}">${dot}<span>${escapeHtml(n.label)}</span></button>`;'
)

# Insert updateStepGuide + call after renderProgress definition ends - patch setView instead
old_set = '''  function setView(name) {
    if (name === 'detail') name = 'jobs'; // 兼容旧调用：详情已合并到 jobs 视图右栏
    const st = window.matchState;
    st.activeView = name;
    const views = ['resume', 'match', 'jobs', 'analysis', 'learn', 'compare'];
    views.forEach((v) => { const el = $('view-' + v); if (el) { el.classList.toggle('is-active', v === name); el.hidden = (v !== name); } });
    // view-resume 三栏工作台有自己的视觉，不展示艺术背景插图
    const art = qs('.match-art-layer');
    if (art) art.hidden = (name === 'resume');
    // 左导航高亮
    const navMap = { resume: 'resume', match: 'match', jobs: 'jobs', learn: 'learn', compare: 'compare' };
    qsa('.wks-nav-item').forEach((b) => b.classList.toggle('is-active', navMap[name] === b.dataset.nav));
    // 同步 stage（用于进度）
    if (name === 'resume') st.stage = 'resume';
    else if (name === 'match') st.stage = 'match';
    else if (name === 'jobs') st.stage = 'jobs';
    else if (name === 'learn') st.stage = 'learn';
    else if (name === 'interview') st.stage = 'interview';
    renderProgress();
    if (name === 'jobs') renderJobs();
    if (name === 'match') renderCondWorkbench();
    if (name === 'learn') renderLearning();
    if (name === 'compare') renderCompare();
    if (name === 'resume') renderResume();
  }'''

new_set = '''  function updateStepGuide(viewName) {
    const g = STEP_GUIDE[viewName] || STEP_GUIDE.resume;
    const viewId = viewName === 'interview' ? 'learn' : viewName;
    const root = $('view-' + viewId) || document;
    const local = root.querySelector ? root.querySelector('.wks-step-guide') : null;
    if (local) {
      const lk = local.querySelector('.wks-step-guide-k');
      const lt = local.querySelector('.wks-step-guide-t');
      if (lk) lk.textContent = g.k;
      if (lt) lt.textContent = g.t;
    }
    const tEl = $('wks-step-guide-t');
    if (tEl && viewName === 'resume') tEl.textContent = g.t;
  }

  function setView(name) {
    if (name === 'detail') name = 'jobs';
    const st = window.matchState;
    st.activeView = name;
    const views = ['resume', 'match', 'jobs', 'analysis', 'learn', 'compare'];
    const show = name === 'interview' ? 'learn' : name;
    views.forEach((v) => {
      const el = $('view-' + v);
      if (el) { el.classList.toggle('is-active', v === show); el.hidden = (v !== show); }
    });
    const art = qs('.match-art-layer');
    if (art) art.hidden = (show === 'resume');
    const navMap = { resume: 'resume', match: 'match', jobs: 'jobs', learn: 'learn', interview: 'interview', compare: 'compare' };
    qsa('.wks-nav-item').forEach((b) => b.classList.toggle('is-active', navMap[name] === b.dataset.nav));
    if (name === 'resume') st.stage = 'resume';
    else if (name === 'match' || name === 'analysis') st.stage = name === 'analysis' ? 'match' : 'match';
    else if (name === 'jobs') st.stage = 'jobs';
    else if (name === 'learn') st.stage = 'learn';
    else if (name === 'interview') st.stage = 'interview';
    renderProgress();
    updateStepGuide(name);
    if (show === 'jobs') renderJobs();
    if (show === 'match') renderCondWorkbench();
    if (show === 'learn') renderLearning();
    if (show === 'compare') renderCompare();
    if (show === 'resume') renderResume();
  }'''

if old_set not in t:
    raise SystemExit('setView block not found')
t = t.replace(old_set, new_set, 1)

# bindEntry: add refine toggle
old_bind_end = '''    const change = $('md-change-resume');
    if (change) change.addEventListener('click', () => $('resume-file-input').click());
    bindResumeAnalyze();
    bindDiffModal();
  }'''
new_bind_end = '''    const change = $('md-change-resume');
    if (change) change.addEventListener('click', () => $('resume-file-input').click());
    const refineBtn = $('md-refine-toggle');
    if (refineBtn) {
      refineBtn.addEventListener('click', () => {
        window.matchState.refineMode = !window.matchState.refineMode;
        renderResume();
      });
    }
    bindResumeAnalyze();
    bindDiffModal();
  }'''
if old_bind_end not in t:
    raise SystemExit('bindEntry end not found')
t = t.replace(old_bind_end, new_bind_end, 1)

# renderResume: preview vs refine layout
old_rr = '''  function renderResume() {
    const st = window.matchState;
    const uploadCard = $('resume-upload-card');
    const headMetrics = $('resume-head-metrics');
    const toolbar = $('rw-toolbar');
    const grid = document.querySelector('.rw-grid');
    const generate = $('rw-generate');
    const fileBadge = $('rw-file-badge');

    if (st.file) {
      if (!st.resumeSections || !st.resumeSections.length) {
        st.resumeSections = buildDefaultResumeSections();
      }
      if (uploadCard) uploadCard.hidden = true;
      if (headMetrics) {
        headMetrics.innerHTML = st.file.fromWizard
          ? `<span class="mod-tag mod-tag--ok">来自简历向导</span>`
          : `<span class="mod-tag mod-tag--ok">解析完成</span>`;
      }
      if (toolbar) toolbar.hidden = false;
      if (grid) grid.hidden = false;
      if (generate) generate.hidden = false;'''

# Find and patch more carefully with regex for applyRefineLayout after file branch start
marker = 'function renderResume() {'
idx = t.find(marker)
if idx < 0:
    raise SystemExit('renderResume not found')
# Insert helper before renderResume
helper = '''
  function applyResumeLayoutMode() {
    const st = window.matchState;
    const grid = $('rw-grid') || document.querySelector('.rw-grid');
    const nav = $('rw-col-nav');
    const editor = $('rw-col-editor');
    const refineBtn = $('md-refine-toggle');
    const refine = !!st.refineMode && !!st.file;
    if (grid) {
      grid.classList.toggle('is-preview', !refine);
      grid.classList.toggle('is-refine', refine);
      grid.hidden = false;
    }
    if (nav) nav.hidden = !refine;
    if (editor) editor.hidden = !refine;
    if (refineBtn) {
      refineBtn.classList.toggle('is-on', refine);
      refineBtn.setAttribute('aria-pressed', refine ? 'true' : 'false');
      refineBtn.textContent = refine ? '收起精修' : '精修简历';
      refineBtn.hidden = !st.file;
    }
  }

'''
if 'function applyResumeLayoutMode()' not in t:
    t = t[:idx] + helper + t[idx:]

# After renderResumePreview/Nav/Editor calls at end of renderResume, ensure applyResumeLayoutMode
# Find the end of renderResume that calls the three renders
old_tail = '''    renderResumePreview();
    renderResumeNav();
    renderResumeEditor();
    renderAIPanelResume();
  }

  function getSections() {'''
new_tail = '''    applyResumeLayoutMode();
    renderResumePreview();
    if (st.refineMode && st.file) {
      renderResumeNav();
      renderResumeEditor();
    }
    renderAIPanelResume();
  }

  function getSections() {'''
if old_tail not in t:
    raise SystemExit('renderResume tail not found')
t = t.replace(old_tail, new_tail, 1)

# Also when no file, hide refine and keep preview
# In else branch of renderResume, after fileBadge clear, apply layout is enough via applyResumeLayoutMode

p.write_text(t, encoding='utf-8')
print('patched ok', len(t))
