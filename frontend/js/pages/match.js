// ============== Match View ==============
window.matchState = {
    result: null,
    file: null,
    selectedJobId: null,
    processing: false,
    progressTimer: null,
    dimensionChart: null,
    mode: 'b',
    targetJobId: null
};

window.matchEscape = function(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
};
window.matchReduced = function() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
window.matchEmpty = function(title, text) {
    return `<div class="match-empty"><svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.4" style="opacity:.28;margin:0 auto;display:block"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg><h4>${window.matchEscape(title)}</h4><p>${window.matchEscape(text)}</p></div>`;
};

window.setMatchPipeline = function(activeKey, completedKeys) {
    const done = new Set(completedKeys || []);
    document.querySelectorAll('#match-pipeline .match-pipe-step').forEach(step => {
        const key = step.dataset.step;
        step.classList.toggle('done', done.has(key));
        step.classList.toggle('active', key === activeKey);
        const dot = step.querySelector('.match-pipe-dot');
        if (window.gsap && dot && key === activeKey && !window.matchReduced()) {
            window.gsap.fromTo(dot, {scale:.78}, {scale:1, duration:.45, ease:'back.out(1.8)', overwrite:'auto'});
        }
    });
};

window.showMatchLocked = function() {
    const summary = document.getElementById('match-summary');
    const results = document.getElementById('match-results-card');
    const gap = document.getElementById('gap-analysis');
    const path = document.getElementById('learning-path');
    const profile = document.getElementById('resume-detail');
    if (summary) summary.innerHTML = `
        <div class="match-summary-grid">
            <div class="match-score-hero"><svg viewBox="0 0 92 92"><circle class="score-bg" cx="46" cy="46" r="40"/></svg><div class="match-score-center"><span class="match-score-number">--</span><span class="match-score-unit">等待诊断</span></div></div>
            <div><div class="match-summary-title">上传一份简历，开启深层匹配</div><div class="match-summary-reason">系统将完成版面解析、DeepSeek人才画像、语义匹配、图谱能力迁移与学习路径规划。</div><div class="match-summary-badges"><span class="match-summary-badge">非关键词打分</span><span class="match-summary-badge">证据可追溯</span><span class="match-summary-badge">结果可解释</span></div></div>
            <span class="match-rank">READY</span>
        </div>`;
    if (results) results.innerHTML = `<div class="card-header"><div class="card-title">推荐岗位</div><span class="tag">TOP 5</span></div><div class="card-body">${window.matchEmpty('等待简历', '完成解析后，将按综合匹配度生成岗位排名')}</div>`;
    if (gap) gap.innerHTML = window.matchEmpty('暂无差距路径', '选择匹配岗位后展示能力迁移链路');
    if (path) path.innerHTML = window.matchEmpty('暂无学习计划', '能力差距将自动转换成分阶段成长路线');
    if (profile) profile.innerHTML = '<div class="match-resume-empty">上传后在这里查看结构化人才画像</div>';
    const chart = document.getElementById('match-dimension-chart');
    if (chart) chart.innerHTML = window.matchEmpty('等待评分', '技能、语义、项目、经验、图谱五维分析');
    const impact = document.getElementById('learning-impact');
    if (impact) impact.textContent = '等待诊断';
    window.setMatchPipeline(null, []);
};

window.renderMatchProcessing = function(file) {
    const summary = document.getElementById('match-summary');
    const results = document.getElementById('match-results-card');
    const gap = document.getElementById('gap-analysis');
    const path = document.getElementById('learning-path');
    if (summary) summary.innerHTML = `<div class="match-summary-grid"><div class="match-score-hero"><svg viewBox="0 0 92 92"><circle class="score-bg" cx="46" cy="46" r="40"/></svg><div class="match-score-center"><span class="match-score-number">AI</span><span class="match-score-unit">分析中</span></div></div><div><div class="match-summary-title">诊断智能体正在工作</div><div class="match-summary-reason">正在解析 ${window.matchEscape(file.name)}，DeepSeek语义分析通常需要数秒，请保持页面开启。</div><div class="match-summary-badges"><span class="match-summary-badge">结构化抽取</span><span class="match-summary-badge">语义审查</span><span class="match-summary-badge">图谱推理</span></div></div><span class="match-rank">RUNNING</span></div>`;
    const skeleton = `<div style="display:grid;gap:13px"><div class="match-skeleton" style="width:42%"></div><div class="match-skeleton" style="height:64px"></div><div class="match-skeleton" style="height:64px"></div><div class="match-skeleton" style="height:64px"></div></div>`;
    if (results) results.innerHTML = `<div class="card-header"><div class="card-title">正在生成岗位排名</div><span class="tag tag-cyan"><span class="live-dot"></span>实时推理</span></div><div class="card-body">${skeleton}</div>`;
    if (gap) gap.innerHTML = skeleton;
    if (path) path.innerHTML = skeleton;
    const chart = document.getElementById('match-dimension-chart');
    if (chart) chart.innerHTML = skeleton;
};

window.startMatchProgress = function() {
    clearInterval(window.matchState.progressTimer);
    const order = ['upload','extract','profile','semantic','graph','plan'];
    let index = 0;
    window.setMatchPipeline(order[0], []);
    window.matchState.progressTimer = setInterval(() => {
        if (index >= 3) return;
        index += 1;
        window.setMatchPipeline(order[index], order.slice(0,index));
    }, 1050);
};

window.finishMatchProgress = function(trace) {
    clearInterval(window.matchState.progressTimer);
    const keys = (trace || []).map(item => item.key);
    window.setMatchPipeline(null, keys.length ? keys : ['upload','extract','profile','semantic','graph','plan']);
    if (window.gsap && !window.matchReduced()) {
        window.gsap.fromTo('#match-pipeline .match-pipe-step.done .match-pipe-dot', {scale:.72}, {scale:1,duration:.42,ease:'back.out(1.8)',stagger:.07,overwrite:'auto'});
    }
};

window.runMatchFromFile = async function(file) {
    if (!file || window.matchState.processing) return;
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    if (!['pdf','doc','docx','txt'].includes(extension)) {
        window.Utils.showToast('仅支持 PDF、DOC、DOCX、TXT 简历', 'amber');
        return;
    }
    if (file.size > 8 * 1024 * 1024) {
        window.Utils.showToast('文件不能超过 8MB', 'amber');
        return;
    }
    window.matchState.processing = true;
    window.matchState.file = file;
    const zone = document.getElementById('upload-zone');
    const title = document.getElementById('upload-title');
    const hint = document.getElementById('upload-hint');
    const modelPill = document.getElementById('match-model-pill');
    zone && zone.classList.add('processing','has-file');
    if (title) title.textContent = file.name;
    if (hint) hint.textContent = `${(file.size/1024).toFixed(1)} KB · 正在安全上传与解析`;
    if (modelPill) { modelPill.classList.remove('online'); modelPill.querySelector('span').textContent = 'DeepSeek 推理中'; }
    window.renderMatchProcessing(file);
    window.startMatchProgress();
    window.Utils.showToast('诊断智能体已接管任务', 'cyan');

    const form = new FormData();
    form.append('file', file);
    form.append('mode', (window.matchState && window.matchState.mode) || 'b');
    if (window.matchState && window.matchState.targetJobId) {
        form.append('target_job_id', window.matchState.targetJobId);
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 130000);
    try {
        const response = await fetch((window.API_BASE || 'http://127.0.0.1:5000') + '/api/match/diagnose', {
            method:'POST', body:form, signal:controller.signal
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.code !== 0) {
            throw new Error(payload.detail || payload.message || `诊断服务返回 ${response.status}`);
        }
        window.matchState.result = payload.data; /* CareerFit diagnose hook */
        window.matchState.selectedJobId = payload.data.selected_job_id || payload.data.matches?.[0]?.job?.id;
        window.finishMatchProgress(payload.data.trace);
        window.renderMatchWorkspace();
        const model = payload.data.model || {};
        if (modelPill) {
            modelPill.classList.toggle('online', !!model.used);
            modelPill.querySelector('span').textContent = model.used ? (model.name || 'DeepSeek') : '本地降级模式';
        }
        if (hint) hint.textContent = `${payload.data.document.extension} · ${payload.data.document.characters} 字符 · 解析完成`;
        window.Utils.showToast(`诊断完成 · TOP1 匹配 ${payload.data.matches[0].score} 分`, 'mint');
    } catch (error) {
        clearInterval(window.matchState.progressTimer);
        window.setMatchPipeline(null, []);
        const message = error && error.name === 'AbortError' ? '诊断超时，请稍后重试' : (error.message || '诊断失败');
        const results = document.getElementById('match-results-card');
        if (results) results.innerHTML = `<div class="card-header"><div class="card-title">诊断未完成</div></div><div class="card-body"><div class="match-error"><b>无法完成本次分析</b>${window.matchEscape(message)}<div style="margin-top:9px;font-size:11px">请确认后端已启动、DeepSeek环境变量有效，或换用项目 samples 目录中的示例简历。</div></div></div>`;
        if (hint) hint.textContent = message;
        if (modelPill) modelPill.querySelector('span').textContent = '服务异常';
        window.Utils.showToast(message, 'amber');
    } finally {
        clearTimeout(timeoutId);
        window.matchState.processing = false;
        zone && zone.classList.remove('processing');
    }
};

window.initMatch = function() {
    const view = document.getElementById('view-match');
    if (!view) return;
    if (!view.dataset.bound) {
        view.dataset.bound = '1';
        const zone = document.getElementById('upload-zone');
        const input = document.getElementById('resume-file-input');
        const openPicker = () => { if (!window.matchState.processing && input) input.click(); };
        zone?.addEventListener('click', openPicker);
        zone?.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); } });
        input?.addEventListener('change', () => { const file = input.files && input.files[0]; if (file) window.runMatchFromFile(file); });
        document.getElementById('match-upload-trigger')?.addEventListener('click', openPicker);
        document.getElementById('match-reset-btn')?.addEventListener('click', window.resetMatchDiagnosis);
        ['dragenter','dragover'].forEach(name => zone?.addEventListener(name, event => { event.preventDefault(); zone.classList.add('dragover'); }));
        ['dragleave','drop'].forEach(name => zone?.addEventListener(name, event => { event.preventDefault(); zone.classList.remove('dragover'); }));
        zone?.addEventListener('drop', event => { const file = event.dataTransfer?.files?.[0]; if (file) window.runMatchFromFile(file); });
    }
    if (window.matchState.result) window.renderMatchWorkspace(); else window.showMatchLocked();
    if (window.gsap && !window.matchReduced()) {
        const tl = window.gsap.timeline({defaults:{duration:.55,ease:'power3.out'}});
        tl.fromTo('#view-match .page-header',{autoAlpha:0,y:-10},{autoAlpha:1,y:0})
          .fromTo('#view-match .match-agent-banner',{autoAlpha:0,y:16},{autoAlpha:1,y:0},'<.08')
          .fromTo('#view-match .match-upload-card',{autoAlpha:0,x:-16},{autoAlpha:1,x:0},'<.08')
          .fromTo('#view-match .match-main-stack',{autoAlpha:0,x:18},{autoAlpha:1,x:0},'<');
        window.gsap.to('.match-agent-orb',{y:-3,duration:1.8,ease:'sine.inOut',repeat:-1,yoyo:true});
    }
};

window.resetMatchDiagnosis = function() {
    clearInterval(window.matchState.progressTimer);
    if (window.matchState.dimensionChart) { window.matchState.dimensionChart.dispose(); window.matchState.dimensionChart = null; }
    window.matchState.result = null;
    window.matchState.file = null;
    window.matchState.selectedJobId = null;
    window.matchState.processing = false;
    window.matchState.mode = 'b';
    window.matchState.targetJobId = null;
    ['a', 'b'].forEach(m => document.getElementById('mode-card-' + m)?.classList.remove('flipped'));
    const input = document.getElementById('resume-file-input');
    if (input) input.value = '';
    const zone = document.getElementById('upload-zone');
    zone?.classList.remove('processing','has-file','dragover');
    const title = document.getElementById('upload-title');
    const hint = document.getElementById('upload-hint');
    if (title) title.textContent = '拖拽或点击上传简历';
    if (hint) hint.textContent = '上传后自动完成解析、匹配与推荐';
    const modelPill = document.getElementById('match-model-pill');
    if (modelPill) { modelPill.classList.remove('online'); modelPill.querySelector('span').textContent = '等待任务'; }
    window.showMatchLocked();
    window.Utils.showToast('已清空本次诊断', 'cyan');
};

window.getSelectedMatch = function() {
    const matches = window.matchState.result?.matches || [];
    return matches.find(item => item.job.id === window.matchState.selectedJobId) || matches[0] || null;
};

window.renderMatchWorkspace = function() {
    const result = window.matchState.result;
    if (!result) return window.showMatchLocked();
    window.renderResumeDetail();
    window.renderMatchResults();
    window.renderMatchSummary();
    window.renderDimensionChart();
    window.renderGapAnalysis();
    window.renderLearningPath();
    if (window.gsap && !window.matchReduced()) {
        const tl = window.gsap.timeline({defaults:{duration:.5,ease:'power3.out'}});
        tl.fromTo('#resume-detail',{autoAlpha:0,y:12},{autoAlpha:1,y:0})
          .fromTo('#match-summary',{autoAlpha:0,y:14},{autoAlpha:1,y:0},'<.08')
          .fromTo('#match-results-card .match-job-card',{autoAlpha:0,y:16},{autoAlpha:1,y:0,stagger:.07},'<.05')
          .fromTo('#view-match .match-insight-grid .card',{autoAlpha:0,y:15},{autoAlpha:1,y:0,stagger:.08},'<.12')
          .fromTo('#learning-path .path-step',{autoAlpha:0,y:12},{autoAlpha:1,y:0,stagger:.07},'<.1');
    }
};

window.renderResumeDetail = function() {
    const el = document.getElementById('resume-detail');
    const profile = window.matchState.result?.profile;
    if (!el || !profile) return;
    const skills = (profile.skills || []).slice(0,14);
    const confidence = Math.round((Number(profile.confidence) || 0) * 100);
    el.innerHTML = `
        <div class="match-resume-head">
            <div class="match-resume-avatar">${window.matchEscape((profile.name || '候')[0])}</div>
            <div class="match-resume-info"><div class="match-resume-name">${window.matchEscape(profile.name || '候选人')}</div><div class="match-resume-meta">${window.matchEscape(profile.target_role || '求职方向待确认')}</div></div>
            <div style="text-align:right"><div class="match-resume-score">${confidence}%</div><div style="font-size:9px;color:#94a3b8">解析置信度</div></div>
        </div>
        <div class="match-profile-grid">
            <div class="match-profile-chip"><span>工作经验</span><b>${Number(profile.experience_years || 0)} 年</b></div>
            <div class="match-profile-chip"><span>学历</span><b>${window.matchEscape(profile.education || '未识别')}</b></div>
            <div class="match-profile-chip"><span>城市</span><b>${window.matchEscape(profile.city || '未识别')}</b></div>
        </div>
        <div style="font-size:10px;color:#94a3b8;margin-bottom:8px">识别技能 ${skills.length} 项 · ${profile.source === 'deepseek' ? 'DeepSeek结构化抽取' : '本地规则降级'}</div>
        <div class="match-skill-list">${skills.map(item => `<span class="skill-matched" title="${window.matchEscape(item.evidence || '')}">${window.matchEscape(item.name)} · ${window.matchEscape(item.level || '未说明')}</span>`).join('') || '<span style="font-size:11px;color:#94a3b8">暂无可确认技能</span>'}</div>
        ${profile.summary ? `<div style="margin-top:12px;padding:10px;border-radius:9px;background:rgba(255,255,255,.72);font-size:11px;line-height:1.65;color:#475569">${window.matchEscape(profile.summary)}</div>` : ''}`;
};

window.renderMatchSummary = function() {
    const el = document.getElementById('match-summary');
    const match = window.getSelectedMatch();
    if (!el || !match) return;
    const score = Number(match.score || 0);
    const rank = (window.matchState.result.matches || []).findIndex(item => item.job.id === match.job.id) + 1;
    el.innerHTML = `
        <div class="match-summary-grid">
            <div class="match-score-hero"><svg viewBox="0 0 92 92"><defs><linearGradient id="matchScoreGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#0d9488"/></linearGradient></defs><circle class="score-bg" cx="46" cy="46" r="40"/><circle class="score-fg" cx="46" cy="46" r="40"/></svg><div class="match-score-center"><span class="match-score-number">${score.toFixed(1)}</span><span class="match-score-unit">综合匹配</span></div></div>
            <div><div class="match-summary-title">${window.matchEscape(match.job.title)} · ${window.matchEscape(match.job.company)}</div><div class="match-summary-reason">${window.matchEscape(match.reason)}</div><div class="match-summary-badges"><span class="match-summary-badge">${window.matchEscape(match.job.city)}</span><span class="match-summary-badge">${window.matchEscape(match.job.salary)}</span><span class="match-summary-badge">直接匹配 ${match.matched.length} 项</span><span class="match-summary-badge">可迁移 ${match.transferable.length} 项</span></div></div>
            <span class="match-rank">TOP ${rank}</span>
        </div>`;
    const circle = el.querySelector('.score-fg');
    const offset = 251.3 * (1 - score / 100);
    if (window.gsap && circle && !window.matchReduced()) window.gsap.to(circle,{strokeDashoffset:offset,duration:1.15,ease:'power3.out'});
    else if (circle) circle.style.strokeDashoffset = offset;
};

window.renderMatchResults = function() {
    const card = document.getElementById('match-results-card');
    const matches = window.matchState.result?.matches || [];
    if (!card) return;
    card.innerHTML = `
        <div class="card-header"><div><div class="card-title">推荐岗位 TOP ${matches.length}</div><div style="font-size:10px;color:#94a3b8;margin-top:3px">固定权重评分 · DeepSeek语义增强 · 图谱迁移衰减</div></div><span class="tag tag-mint"><span class="live-dot"></span>已完成</span></div>
        <div class="card-body">
        ${matches.map((item,index) => {
            const active = item.job.id === window.matchState.selectedJobId;
            const circumference = 150.7;
            const dash = circumference - circumference * Number(item.score || 0) / 100;
            return `<div class="match-job-card ${active ? 'active' : ''}" data-job-id="${window.matchEscape(item.job.id)}" tabindex="0">
                <div class="match-job-head">
                    <div><div class="match-job-title">${index+1}. ${window.matchEscape(item.job.title)}</div><div style="font-size:10px;color:#94a3b8;margin-top:3px">${window.matchEscape(item.job.company)} · ${window.matchEscape(item.job.city)} · ${window.matchEscape(item.job.salary)}</div></div>
                    <div><div class="score-ring"><svg width="56" height="56"><circle cx="28" cy="28" r="24" fill="none" stroke="#e8eef0" stroke-width="4"/><circle class="job-score-circle" cx="28" cy="28" r="24" fill="none" stroke="#0d9488" stroke-width="4" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${dash}"/></svg><div class="score-ring-text">${Number(item.score).toFixed(1)}</div></div><div class="match-score-caption">综合分</div></div>
                </div>
                <div class="match-job-reason">${window.matchEscape(item.reason)}</div>
                <div class="match-skill-row">${item.matched.slice(0,5).map(skill => `<span class="skill-matched">✓ ${window.matchEscape(skill)}</span>`).join('')}${item.transferable.slice(0,3).map(skill => `<span class="skill-transfer">↗ ${window.matchEscape(skill.to)}</span>`).join('')}${item.missing.slice(0,3).map(skill => `<span class="skill-missing">△ ${window.matchEscape(skill)}</span>`).join('')}</div>
            </div>`;
        }).join('')}
        </div>`;
    card.querySelectorAll('.match-job-card').forEach(jobCard => {
        const select = () => window.selectMatchJob(jobCard.dataset.jobId);
        jobCard.addEventListener('click', select);
        jobCard.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
        if (window.gsap && !window.matchReduced()) {
            jobCard.addEventListener('mouseenter', () => window.gsap.to(jobCard,{y:-3,scale:1.006,duration:.24,ease:'power2.out',overwrite:'auto'}));
            jobCard.addEventListener('mouseleave', () => window.gsap.to(jobCard,{y:0,scale:1,duration:.3,ease:'power2.out',overwrite:'auto'}));
        }
    });
};

window.selectMatchJob = function(jobId) {
    if (!jobId || jobId === window.matchState.selectedJobId) return;
    window.matchState.selectedJobId = jobId;
    window.renderMatchResults();
    window.renderMatchSummary();
    window.renderDimensionChart();
    window.renderGapAnalysis();
    window.renderLearningPath();
    if (window.gsap && !window.matchReduced()) {
        window.gsap.fromTo(['#match-summary','#gap-analysis','#learning-path'],{autoAlpha:.25,y:6},{autoAlpha:1,y:0,duration:.42,ease:'power2.out',stagger:.05});
    }
};

window.renderDimensionChart = function() {
    const el = document.getElementById('match-dimension-chart');
    const match = window.getSelectedMatch();
    if (!el || !match || !window.echarts) return;
    if (window.matchState.dimensionChart) window.matchState.dimensionChart.dispose();
    el.innerHTML = '';
    const d = match.dimensions || {};
    const chart = window.echarts.init(el);
    window.matchState.dimensionChart = chart;
    chart.setOption({
        animationDuration: window.matchReduced() ? 0 : 900,
        animationEasing:'cubicOut',
        tooltip:{trigger:'item'},
        radar:{center:['50%','52%'],radius:'68%',splitNumber:4,shape:'polygon',indicator:[{name:'技能覆盖',max:100},{name:'语义契合',max:100},{name:'项目证据',max:100},{name:'经验适配',max:100},{name:'图谱迁移',max:100}],axisName:{color:'#475569',fontSize:10},splitArea:{areaStyle:{color:['rgba(13,148,136,.02)','rgba(13,148,136,.045)']}},splitLine:{lineStyle:{color:'rgba(13,148,136,.14)'}},axisLine:{lineStyle:{color:'rgba(13,148,136,.18)'}}},
        series:[{type:'radar',data:[{value:[d.skills||0,d.semantics||0,d.projects||0,d.experience||0,d.graph||0],name:match.job.title,areaStyle:{color:'rgba(13,148,136,.22)'},lineStyle:{color:'#0d9488',width:2.5},itemStyle:{color:'#2dd4bf'},symbolSize:6}]}]
    });
    setTimeout(() => chart.resize(),80);
};

window.renderGapAnalysis = function() {
    const el = document.getElementById('gap-analysis');
    const match = window.getSelectedMatch();
    if (!el || !match) return;
    if (!match.gaps.length) {
        el.innerHTML = `<div class="match-empty"><h4 style="color:#047857">核心能力已覆盖</h4><p>建议通过综合项目强化能力证据与工程深度。</p></div>`;
        return;
    }
    el.innerHTML = `<div class="match-gap-list">${match.gaps.map(gap => {
        const path = (match.gap_paths || []).find(item => item.to === gap.skill);
        return `<div class="match-gap-item ${gap.severity}">
            <div class="match-gap-top"><span class="match-gap-name">${window.matchEscape(gap.skill)}</span><span class="match-gap-readiness">迁移准备度 ${gap.readiness}%</span></div>
            <div class="match-gap-path"><span class="match-path-node have">${window.matchEscape(path?.from || '待建立基础')}</span><span class="match-path-arrow"></span><span class="match-path-node need">${window.matchEscape(gap.skill)}</span><span class="match-path-arrow"></span><span class="match-path-node">${window.matchEscape(match.job.title)}</span></div>
            <div class="match-path-reason">${window.matchEscape(path?.relation || gap.reason)}</div>
        </div>`;
    }).join('')}</div>`;
    if (window.gsap && !window.matchReduced()) window.gsap.fromTo(el.querySelectorAll('.match-gap-item'),{autoAlpha:0,x:12},{autoAlpha:1,x:0,duration:.38,stagger:.055,ease:'power2.out'});
};

window.deriveLearningPath = function(match) {
    return (match.gaps || []).slice(0,4).map((gap,index) => ({
        step:index+1, skill:gap.skill, title:`${gap.skill}能力冲刺`, description:`围绕${gap.skill}完成知识学习、动手实验与岗位场景复盘`, weeks:2, schedule:`第${index*2+1}-${index*2+2}周`, resource:'知识图谱精选资源', deliverable:`形成1个可验证的${gap.skill}实践成果`, impact:Math.min(12,5+Math.ceil((100-gap.readiness)/14))
    }));
};

window.renderLearningPath = function() {
    const el = document.getElementById('learning-path');
    const match = window.getSelectedMatch();
    if (!el || !match) return;
    const result = window.matchState.result;
    let paths = match.job.id === result.selected_job_id ? (result.learning_path || []) : window.deriveLearningPath(match);
    if (!paths.length) paths = window.deriveLearningPath(match);
    const totalImpact = paths.reduce((sum,item) => sum + Number(item.impact||0),0);
    const impact = document.getElementById('learning-impact');
    if (impact) impact.textContent = `预计提升 +${Math.min(22,totalImpact)} 分`;
    el.innerHTML = paths.map(item => `<div class="path-step">
        <div class="path-step-head"><div class="path-num">${item.step}</div><div><div class="path-title">${window.matchEscape(item.title)}</div><div class="path-meta">${window.matchEscape(item.schedule)} · ${window.matchEscape(item.resource)}</div></div><span class="path-impact">+${item.impact} 潜力</span></div>
        <div class="path-desc">${window.matchEscape(item.description)}</div>
        <div class="path-deliverable">交付物：${window.matchEscape(item.deliverable)}</div>
    </div>`).join('');
};

window.showJobMatchDetail = function(jobId) {
    const item = (window.matchState.result?.matches || []).find(match => match.job.id === jobId);
    if (!item) return;
    document.getElementById('modal-title').textContent = '匹配证据 · ' + item.job.title;
    document.getElementById('modal-body').innerHTML = `
        <div class="jd-grid"><div class="jd-item"><div class="jd-item-label">综合匹配</div><div class="jd-item-val">${item.score}</div></div><div class="jd-item"><div class="jd-item-label">技能覆盖</div><div class="jd-item-val">${item.dimensions.skills}</div></div><div class="jd-item"><div class="jd-item-label">语义契合</div><div class="jd-item-val">${item.dimensions.semantics}</div></div><div class="jd-item"><div class="jd-item-label">图谱迁移</div><div class="jd-item-val">${item.dimensions.graph}</div></div></div>
        <div class="job-detail-section"><div class="job-detail-section-title">判断依据</div><div style="line-height:1.75;color:#475569">${window.matchEscape(item.reason)}</div></div>
        <div class="job-detail-section"><div class="job-detail-section-title">直接匹配</div><div class="match-skill-list">${item.matched.map(skill=>`<span class="skill-matched">${window.matchEscape(skill)}</span>`).join('')||'暂无'}</div></div>
        <div class="job-detail-section"><div class="job-detail-section-title">能力差距</div><div class="match-skill-list">${item.missing.map(skill=>`<span class="skill-missing">${window.matchEscape(skill)}</span>`).join('')||'暂无'}</div></div>`;
    document.getElementById('modal-footer').innerHTML = `<button class="btn" onclick="window.closeModal()">关闭</button><button class="btn btn-primary" onclick="window.closeModal();window.selectMatchJob('${window.matchEscape(jobId)}')">设为目标岗位</button>`;
    document.getElementById('modal-overlay').classList.add('show');
};


/* === CareerFit Match JS (from jwk) === */
window.matchState = window.matchState || {};
if (window.matchState.mode == null) window.matchState.mode = 'b';
if (window.matchState.targetJobId == null) window.matchState.targetJobId = null;
window.flipModeCard = function(mode) {
    if (window.matchState.processing) return;
    window.matchState.mode = mode;
    const card = document.getElementById('mode-card-' + mode);
    if (!card) return;
    card.classList.add('flipped');
    if (mode === 'a') {
        // Pre-populate job suggestions
        setTimeout(() => window.searchJobs('a'), 200);
        // Focus search
        setTimeout(() => {
            const inp = document.getElementById('mode-a-search');
            if (inp) inp.focus();
        }, 400);
    }
};

window.unflipModeCard = function(mode) {
    const card = document.getElementById('mode-card-' + mode);
    if (!card) return;
    card.classList.remove('flipped');
    window.matchState.mode = null;
    window.matchState.targetJobId = null;
};

window.searchJobs = function(mode) {
    const input = document.getElementById('mode-' + mode + '-search');
    const container = document.getElementById('mode-' + mode + '-suggestions');
    if (!input || !container) return;
    const query = (input.value || '').toLowerCase().trim();
    // Fetch jobs from data
    const apiBase = window.API_BASE || 'http://127.0.0.1:5000';
    fetch(apiBase + '/api/match/jobs')
        .then(r => r.json())
        .then(resp => {
            const jobs = (resp.data || []);
            const filtered = query ? jobs.filter(j => 
                (j.title || '').toLowerCase().includes(query) || 
                (j.description || '').toLowerCase().includes(query) ||
                (j.company || '').toLowerCase().includes(query)
            ).slice(0, 6) : jobs.slice(0, 6);
            container.innerHTML = filtered.map(j => 
                `<div class="job-suggest-item${j.id === window.matchState.targetJobId ? ' selected' : ''}" onclick="window.selectTargetJob('${j.id}', '${window.matchEscape(j.title)}')">${window.matchEscape(j.title)} · ${window.matchEscape(j.company || '')}</div>`
            ).join('') || '<div style="padding:12px;color:var(--text-muted);font-size:12px;text-align:center">未找到匹配岗位，请尝试其他关键词</div>';
        }).catch(() => {
            container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:12px;text-align:center">岗位列表加载中...</div>';
        });
};

window.selectTargetJob = function(jobId, title) {
    window.matchState.targetJobId = jobId;
    window.matchState.mode = 'a';
    const container = document.getElementById('mode-a-suggestions');
    if (container) {
        container.querySelectorAll('.job-suggest-item').forEach(el => {
            el.classList.toggle('selected', el.textContent.includes(title));
        });
    }
    window.Utils.showToast('已选择目标岗位: ' + title, 'cyan');
};

window.handleFileSelect = function(event, mode) {
    const file = event.target?.files?.[0];
    if (!file) return;
    window.matchState.mode = mode;
    window.runMatchFromFile(file);
};

window.showCompetitivenessModal = function() {
    const modal = document.getElementById('competitiveness-modal');
    const body = document.getElementById('comp-modal-body');
    const match = window.getSelectedMatch();
    if (!modal || !body || !match) return;
    const d = match.dimensions || {};
    const score = Number(match.score || 0);
    const comp = window.matchState.result?.competitiveness || {};
    const perfect = window.matchState.result?.perfect_resume || {};
    const compScores = comp.dimension_scores || {};
    const skillCompare = comp.skill_comparison || [];
    const suggestions = comp.improvement_suggestions || [];
    const profile = window.matchState.result?.profile || {};

    body.innerHTML = `
        <div class="match-comp-vs">
            <div class="match-comp-side">
                <h4>📄 你的简历</h4>
                <div class="match-comp-score-bar"><span style="font-size:11px;color:var(--text-muted)">综合</span><div class="match-comp-bar-track"><div class="match-comp-bar-fill" style="width:${score}%"></div></div><span class="match-comp-bar-label">${score.toFixed(0)}</span></div>
                <div style="margin-top:12px;font-size:12px;color:var(--text-dark-secondary);line-height:1.7">${window.matchEscape(profile.name || '候选人')} · ${window.matchEscape(profile.education || '')} · ${Number(profile.experience_years||0)}年经验<br>直接匹配: <strong>${match.matched.length}</strong> 项 · 可迁移: <strong>${match.transferable.length}</strong> 项 · 差距: <strong>${match.missing.length}</strong> 项</div>
            </div>
            <div class="match-comp-divider">VS</div>
            <div class="match-comp-side perfect">
                <h4>🏆 完美候选人参考</h4>
                <div class="match-comp-score-bar"><span style="font-size:11px;color:var(--text-muted)">综合</span><div class="match-comp-bar-track"><div class="match-comp-bar-fill" style="width:96%"></div></div><span class="match-comp-bar-label">96</span></div>
                <div style="margin-top:12px;font-size:12px;color:var(--text-dark-secondary);line-height:1.7">${window.matchEscape(perfect.ideal_summary || 'AI推演的该岗位理想候选人画像')}<br>建议经验: <strong>${perfect.ideal_experience_years || '3-5'}年</strong> · 学历: <strong>${window.matchEscape(perfect.ideal_education || '本科及以上')}</strong></div>
                ${perfect.key_differentiators ? `<div style="margin-top:10px;font-size:11px;color:var(--text-muted)">关键优势：${perfect.key_differentiators.map(d => `<span class="match-summary-badge" style="font-size:10px;margin:1px">${window.matchEscape(d)}</span>`).join('')}</div>` : ''}
            </div>
        </div>
        <div class="match-comp-dimensions">
            <div class="match-comp-dim"><div class="dim-label">技能覆盖</div><div class="dim-value">${compScores.skill_coverage != null ? compScores.skill_coverage.toFixed(0) : d.skills||0}</div></div>
            <div class="match-comp-dim"><div class="dim-label">语义契合</div><div class="dim-value">${d.semantics||0}</div></div>
            <div class="match-comp-dim"><div class="dim-label">项目证据</div><div class="dim-value">${d.projects||0}</div></div>
            <div class="match-comp-dim"><div class="dim-label">经验适配</div><div class="dim-value">${compScores.experience_match != null ? compScores.experience_match.toFixed(0) : d.experience||0}</div></div>
            <div class="match-comp-dim"><div class="dim-label">图谱迁移</div><div class="dim-value">${d.graph||0}</div></div>
        </div>
        ${skillCompare.length > 0 ? `<div style="margin-top:16px"><h4 style="font-size:14px;font-weight:600;color:var(--text-dark);margin-bottom:10px">技能逐项对比</h4><div style="max-height:240px;overflow-y:auto">${skillCompare.map(sc => {
            const gapClass = sc.gap === 'matched' ? 'color:#059669' : 'color:#dc2626';
            return `<div style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid var(--border-dark);font-size:12px"><span style="width:90px;font-weight:600;color:var(--text-dark)">${window.matchEscape(sc.skill)}</span><span style="width:55px;text-align:center;font-size:11px;background:rgba(16,185,129,.08);border-radius:4px;padding:2px 4px;color:#059669">${window.matchEscape(sc.ideal_level)}</span><span style="width:55px;text-align:center;font-size:11px;background:rgba(239,68,68,.06);border-radius:4px;padding:2px 4px;${gapClass}">${window.matchEscape(sc.user_level)}</span><span style="font-size:10px;color:var(--text-muted);flex:1">${window.matchEscape(sc.why_important || '')}</span></div>`;
        }).join('')}</div></div>` : ''}
        ${suggestions.length > 0 ? `<div class="match-comp-suggestions" style="margin-top:16px"><h4>提升建议</h4>${suggestions.map(s => `<div class="match-comp-suggestion"><strong>${window.matchEscape(s.skill)}</strong>（${s.priority === 'high' ? '高' : s.priority === 'medium' ? '中' : '低'}优先级）：${window.matchEscape(s.action)} · 预计${s.effort_weeks}周</div>`).join('')}</div>` : `<div class="match-comp-suggestions" style="margin-top:16px"><h4>提升建议</h4>${(match.gaps || []).slice(0,4).map(g => `<div class="match-comp-suggestion"><strong>${window.matchEscape(g.skill)}</strong>：${window.matchEscape(g.reason)}（当前准备度 ${g.readiness}%）</div>`).join('')}${match.gaps.length === 0 ? '<div style="color:#059669;font-size:13px;padding:12px">核心能力已满足该岗位要求</div>' : ''}</div>`}
    `;
    modal.classList.add('show');
};

window.closeCompetitivenessModal = function() {
    document.getElementById('competitiveness-modal')?.classList.remove('show');
};

window.__openCareerFitComp = function() {
  if (!window.matchState || !window.matchState.result) {
    if (window.Utils && window.Utils.showToast) window.Utils.showToast('请先完成一次简历诊断', 'amber');
    else alert('请先完成一次简历诊断');
    return;
  }
  if (typeof window.showCompetitivenessModal === 'function') window.showCompetitivenessModal();
};
