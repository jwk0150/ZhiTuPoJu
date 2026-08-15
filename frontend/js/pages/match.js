// ============== Match View ==============
window.matchState = {
    result: null,
    file: null,
    selectedJobId: null,
    processing: false,
    progressTimer: null,
    dimensionChart: null,
    mode: null, // 'a' = know job, 'b' = just resume
    targetJobId: null, // for mode-a
    currentPanel: 0,
    theaterLogTimer: null,
    selectedArchiveId: 'java-backend',
    selectedVersionId: 'v4',
    versionDetailTab: 'overview',
    selectedResumeMeta: null
};

window.resumeArchives = [
    {
        id: 'java-backend',
        title: 'Java后端求职简历',
        direction: 'Java后端开发',
        currentVersion: 'v4',
        sample: 'samples/LiSi_Java_Resume.doc',
        filename: '李四_Java后端_V4.doc',
        versions: [
            {
                id: 'v4', date: '2026.08.14', reason: '面试后优化', score: 91, delta: 5, gaps: 2,
                primaryJob: 'Java后端开发', interview: { score: 78, status: '已完成', focus: ['Redis原理回答不完整', '项目难点表达不够具体', '回答结构已有改善'] },
                jobs: [{name:'Java后端开发',score:91},{name:'数据开发工程师',score:80},{name:'测试开发工程师',score:75}],
                changes: [
                    {area:'Redis项目描述',before:'负责系统缓存功能开发',after:'使用 Redis 构建热点数据缓存，并补充缓存一致性处理方案'},
                    {area:'项目成果',before:'完成校园管理系统开发',after:'完成核心模块交付，并使用可验证指标说明系统优化效果'},
                    {area:'表达结构',before:'按技术点罗列项目职责',after:'按照问题、行动、结果重新组织项目经历'}
                ],
                learning: [{name:'Redis缓存一致性',status:'已完成'},{name:'Docker项目容器化',status:'已完成'},{name:'微服务基础',status:'进行中'}]
            },
            {
                id: 'v3', date: '2026.08.12', reason: '学习后补充能力证据', score: 86, delta: 7, gaps: 4,
                primaryJob: 'Java后端开发', interview: { score: 72, status: '已完成', focus: ['项目表达偏职责描述', 'Docker经验需要补充证据'] },
                jobs: [{name:'Java后端开发',score:86},{name:'数据开发工程师',score:78},{name:'测试开发工程师',score:73}],
                changes: [
                    {area:'Docker',before:'简历中没有容器化内容',after:'补充项目容器化部署过程和 Dockerfile 实践'},
                    {area:'微服务',before:'只描述单体项目',after:'补充服务拆分和接口协作的学习项目'}
                ],
                learning: [{name:'Docker基础',status:'已完成'},{name:'项目容器化',status:'已完成'},{name:'微服务基础',status:'待开始'}]
            },
            {
                id: 'v2', date: '2026.08.07', reason: 'AI优化项目经历', score: 79, delta: 7, gaps: 5,
                primaryJob: 'Java后端开发', interview: null,
                jobs: [{name:'Java后端开发',score:79},{name:'测试开发工程师',score:72},{name:'数据开发工程师',score:70}],
                changes: [
                    {area:'技术栈表达',before:'参与后台系统开发',after:'使用 Spring Boot、MySQL 和 Redis 完成后台模块开发'},
                    {area:'项目结构',before:'项目内容集中为一段',after:'拆分为项目背景、个人职责和成果三部分'}
                ],
                learning: [{name:'Spring Boot进阶',status:'已完成'},{name:'Redis基础',status:'进行中'}]
            },
            {
                id: 'v1', date: '2026.08.01', reason: '初始上传', score: 72, delta: 0, gaps: 7,
                primaryJob: 'Java开发工程师', interview: null,
                jobs: [{name:'Java开发工程师',score:72},{name:'测试开发工程师',score:68},{name:'实施工程师',score:64}],
                changes: [], learning: []
            }
        ]
    },
    {
        id: 'ai-algorithm',
        title: 'AI算法求职简历',
        direction: 'AI算法与大模型应用',
        currentVersion: 'v2',
        sample: 'samples/ZhangSan_AI_Resume.doc',
        filename: '张三_AI算法工程师_V2.doc',
        versions: [
            {
                id:'v2',date:'2026.08.10',reason:'强化模型项目证据',score:88,delta:7,gaps:3,primaryJob:'AI算法工程师',
                interview:{score:82,status:'已完成',focus:['模型原理较扎实','工程部署经验仍需加强']},
                jobs:[{name:'AI算法工程师',score:88},{name:'大模型应用工程师',score:84},{name:'RAG工程师',score:81}],
                changes:[{area:'模型项目',before:'参与文本分类项目',after:'补充数据处理、模型训练、评测指标和误差分析过程'}],
                learning:[{name:'RAG工程实践',status:'已完成'},{name:'模型服务化',status:'进行中'}]
            },
            {
                id:'v1',date:'2026.07.29',reason:'初始上传',score:81,delta:0,gaps:5,primaryJob:'AI算法工程师',interview:null,
                jobs:[{name:'AI算法工程师',score:81},{name:'NLP工程师',score:77},{name:'数据分析师',score:69}],changes:[],learning:[]
            }
        ]
    }
];

window.matchEscape = function(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
};
window.matchReduced = function() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };

/* ===== Stage 1: Entry Hall ===== */
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

/* ===== File Handling ===== */
window.handleFileSelect = function(event, mode) {
    const file = event.target?.files?.[0];
    if (!file) return;
    window.matchState.mode = mode;
    window.showMatchIntent(file, {
        archiveTitle: '新上传简历', version: '待创建', direction: '尚未匹配', reason: '本地上传'
    });
};

window.updateCareerStepper = function(step) {
    document.querySelectorAll('[data-career-step]').forEach(item => {
        const value = Number(item.dataset.careerStep || 0);
        item.classList.toggle('active', value === step);
        item.classList.toggle('done', value < step);
    });
};

window.getSelectedArchive = function() {
    return window.resumeArchives.find(item => item.id === window.matchState.selectedArchiveId) || window.resumeArchives[0];
};

window.getSelectedVersion = function() {
    const archive = window.getSelectedArchive();
    return archive?.versions.find(item => item.id === window.matchState.selectedVersionId) || archive?.versions[0];
};

window.renderResumeArchives = function() {
    const list = document.getElementById('career-archive-list');
    const count = document.getElementById('career-archive-count');
    if (!list) return;
    if (count) count.textContent = window.resumeArchives.length + ' 份档案';
    list.innerHTML = window.resumeArchives.map(archive => {
        const current = archive.versions.find(item => item.id === archive.currentVersion) || archive.versions[0];
        return `<button class="career-archive-item ${archive.id === window.matchState.selectedArchiveId ? 'active' : ''}" type="button" onclick="window.selectResumeArchive('${archive.id}')">
            <div class="career-archive-name"><span>${window.matchEscape(archive.title)}</span><span class="career-archive-current">${window.matchEscape(current.id.toUpperCase())}</span></div>
            <div class="career-archive-meta">${window.matchEscape(archive.direction)}<br>最近匹配 <span class="career-archive-score">${current.score}%</span> · ${archive.versions.length} 个版本</div>
        </button>`;
    }).join('');
    window.renderResumeArchiveDetail();
};

window.selectResumeArchive = function(archiveId) {
    const archive = window.resumeArchives.find(item => item.id === archiveId);
    if (!archive) return;
    window.matchState.selectedArchiveId = archiveId;
    window.matchState.selectedVersionId = archive.currentVersion;
    window.matchState.versionDetailTab = 'overview';
    window.renderResumeArchives();
};

window.selectResumeVersion = function(versionId) {
    window.matchState.selectedVersionId = versionId;
    window.matchState.versionDetailTab = 'overview';
    window.renderResumeArchiveDetail();
};

window.setVersionDetailTab = function(tab) {
    window.matchState.versionDetailTab = tab;
    window.renderResumeVersionDetail();
};

window.renderResumeArchiveDetail = function() {
    const archive = window.getSelectedArchive();
    const selected = window.getSelectedVersion();
    const column = document.getElementById('career-version-column');
    if (!archive || !selected || !column) return;
    column.innerHTML = `
        <div class="career-archive-hero">
            <div><h3>${window.matchEscape(archive.title)}</h3><p>当前方向：${window.matchEscape(archive.direction)}<br>不同版本保留当时的岗位推荐和成长记录。</p></div>
            <div class="career-hero-stats"><div class="career-hero-stat"><strong>${archive.versions.length}</strong><span>版本</span></div><div class="career-hero-stat"><strong>${archive.versions[0].score}%</strong><span>当前匹配</span></div></div>
        </div>
        <div class="career-timeline-title">版本成长记录</div>
        <div class="career-timeline">${archive.versions.map(version => `
            <div class="career-version ${version.id === selected.id ? 'active' : ''}" onclick="window.selectResumeVersion('${version.id}')">
                <div class="career-version-card">
                    <div class="career-version-top"><span class="career-version-id">${window.matchEscape(version.id.toUpperCase())}</span><span class="career-version-date">${window.matchEscape(version.date)}</span></div>
                    <div class="career-version-reason">${window.matchEscape(version.reason)}</div>
                    <div class="career-version-metrics"><span>${window.matchEscape(version.primaryJob)} ${version.score}%</span><span>能力缺口 ${version.gaps} 项</span>${version.delta ? `<span class="career-delta-up">+${version.delta}%</span>` : '<span>初始版本</span>'}${version.interview ? `<span>面试 ${version.interview.score} 分</span>` : '<span>未面试</span>'}</div>
                </div>
            </div>`).join('')}</div>`;
    window.renderResumeVersionDetail();
};

window.renderResumeVersionDetail = function() {
    const archive = window.getSelectedArchive();
    const version = window.getSelectedVersion();
    const column = document.getElementById('career-detail-column');
    if (!archive || !version || !column) return;
    const tab = window.matchState.versionDetailTab || 'overview';
    const tabs = [
        ['overview','概览'],['jobs','岗位'],['changes','修改'],['interview','面试'],['learning','学习']
    ];
    column.innerHTML = `
        <div class="career-detail-head"><div><h4>${window.matchEscape(version.id.toUpperCase())} · ${window.matchEscape(version.reason)}</h4><p>${window.matchEscape(version.date)} · 保存的是当时的完整状态</p></div></div>
        <div class="career-detail-tabs">${tabs.map(item => `<button class="career-detail-tab ${tab === item[0] ? 'active' : ''}" type="button" onclick="window.setVersionDetailTab('${item[0]}')">${item[1]}</button>`).join('')}</div>
        <div class="career-detail-body" id="career-detail-body"></div>
        <div class="career-detail-actions"><button class="career-btn primary" type="button" onclick="window.useResumeVersion('${archive.id}','${version.id}')">使用 ${window.matchEscape(version.id.toUpperCase())} 开始匹配</button></div>`;
    const body = document.getElementById('career-detail-body');
    if (!body) return;
    if (tab === 'overview') {
        const previousIndex = archive.versions.findIndex(item => item.id === version.id) + 1;
        const previous = archive.versions[previousIndex] || null;
        body.innerHTML = `
            <div class="career-summary-score"><div><span>当时的主推荐岗位</span><div style="font-size:12px;font-weight:700;margin-top:4px">${window.matchEscape(version.primaryJob)}</div></div><strong>${version.score}%</strong></div>
            <div class="career-detail-section"><h5>版本变化</h5><div class="career-detail-list">
                <div class="career-detail-row"><strong>匹配度</strong><br>${previous ? previous.score + '% → ' + version.score + '%' : '初始匹配 ' + version.score + '%'}${version.delta ? `，提升 <span class="career-delta-up">${version.delta}%</span>` : ''}</div>
                <div class="career-detail-row"><strong>能力缺口</strong><br>${previous ? previous.gaps + ' 项 → ' + version.gaps + ' 项' : version.gaps + ' 项待补齐'}</div>
                <div class="career-detail-row"><strong>本次来源</strong><br>${window.matchEscape(version.reason)}</div>
            </div></div>`;
    } else if (tab === 'jobs') {
        body.innerHTML = `<div class="career-detail-section"><h5>当时的推荐岗位</h5><div class="career-detail-list">${(version.jobs || []).map((job,index) => `<div class="career-detail-row"><strong>${index + 1}. ${window.matchEscape(job.name)}</strong><span style="float:right;color:var(--primary);font-weight:750">${job.score}%</span></div>`).join('')}</div></div><div class="career-detail-row">历史结果保持当时快照；重新分析会生成新的匹配记录，不覆盖这里的数据。</div>`;
    } else if (tab === 'changes') {
        body.innerHTML = version.changes?.length ? `<div class="career-detail-section"><h5>本版本修改记录</h5><div class="career-detail-list">${version.changes.map(change => `<div class="career-detail-row"><strong>${window.matchEscape(change.area)}</strong><div class="career-change-box" style="margin-top:7px"><div class="career-change-side">${window.matchEscape(change.before)}</div><div class="career-change-arrow">→</div><div class="career-change-side after">${window.matchEscape(change.after)}</div></div></div>`).join('')}</div></div>` : '<div class="career-empty">这是初始版本，尚无修改记录。</div>';
    } else if (tab === 'interview') {
        body.innerHTML = version.interview ? `<div class="career-summary-score"><div><span>模拟面试</span><div style="font-size:12px;font-weight:700;margin-top:4px">${window.matchEscape(version.interview.status)}</div></div><strong>${version.interview.score}</strong></div><div class="career-detail-section"><h5>主要反馈</h5><div class="career-detail-list">${version.interview.focus.map(item => `<div class="career-detail-row">${window.matchEscape(item)}</div>`).join('')}</div></div>` : '<div class="career-empty">该版本尚未进行模拟面试。完成岗位匹配并选定目标岗位后，才会出现面试入口。</div>';
    } else {
        body.innerHTML = version.learning?.length ? `<div class="career-detail-section"><h5>学习记录</h5><div class="career-detail-list">${version.learning.map(item => `<div class="career-detail-row"><strong>${window.matchEscape(item.name)}</strong><span style="float:right;color:${item.status === '已完成' ? '#059669' : '#d97706'}">${window.matchEscape(item.status)}</span></div>`).join('')}</div></div>` : '<div class="career-empty">该版本还没有学习记录。学习路径需要先完成岗位匹配。</div>';
    }
};

window.showArchiveStage = function(fromResult) {
    const hall = document.getElementById('match-hall');
    const stage = document.getElementById('match-stage');
    const theater = document.getElementById('match-theater');
    if (stage) stage.classList.remove('active');
    if (theater) theater.classList.remove('active');
    if (hall) hall.style.display = 'flex';
    document.getElementById('career-archive-stage')?.classList.add('active');
    document.getElementById('career-intent-stage')?.classList.remove('active');
    window.updateCareerStepper(1);
    window.renderResumeArchives();
    if (fromResult) window.Utils.showToast('已返回简历档案，当前结果仍保留', 'cyan');
};

window.showMatchIntent = function(file, meta) {
    if (!file) return;
    window.matchState.file = file;
    window.matchState.selectedResumeMeta = meta || {};
    window.matchState.mode = 'b';
    window.matchState.targetJobId = null;
    document.getElementById('career-archive-stage')?.classList.remove('active');
    document.getElementById('career-intent-stage')?.classList.add('active');
    const name = document.getElementById('career-selected-name');
    const detail = document.getElementById('career-selected-meta');
    const type = document.getElementById('career-file-type');
    if (name) name.textContent = meta?.archiveTitle ? `${meta.archiveTitle} / ${(meta.version || '').toUpperCase()}` : file.name;
    if (detail) detail.textContent = `${meta?.direction || '待识别方向'} · ${file.name}`;
    if (type) type.textContent = (file.name.split('.').pop() || 'FILE').toUpperCase().slice(0,4);
    window.chooseMatchMode('b');
    window.updateCareerStepper(2);
};

window.useResumeVersion = async function(archiveId, versionId) {
    const archive = window.resumeArchives.find(item => item.id === archiveId);
    const version = archive?.versions.find(item => item.id === versionId);
    if (!archive || !version) return;
    try {
        const response = await fetch(archive.sample);
        if (!response.ok) throw new Error('示例简历读取失败');
        const blob = await response.blob();
        const file = new File([blob], archive.filename, {type: blob.type || 'text/html'});
        window.matchState.selectedArchiveId = archiveId;
        window.matchState.selectedVersionId = versionId;
        window.showMatchIntent(file, {archiveTitle:archive.title,version:version.id,direction:archive.direction,reason:version.reason,date:version.date});
    } catch (error) {
        window.Utils.showToast(error.message || '无法读取该版本简历', 'amber');
    }
};

window.handleCareerUpload = function(file) {
    if (!file) return;
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    if (!['pdf','doc','docx','txt'].includes(extension)) {
        window.Utils.showToast('仅支持 PDF、DOC、DOCX、TXT 简历', 'amber');
        return;
    }
    if (file.size > 8 * 1024 * 1024) {
        window.Utils.showToast('文件不能超过 8MB', 'amber');
        return;
    }
    window.showMatchIntent(file, {archiveTitle:file.name.replace(/\.[^.]+$/, ''),version:'新版本',direction:'上传后由系统识别',reason:'本地上传'});
};

window.chooseMatchMode = function(mode) {
    window.matchState.mode = mode;
    document.getElementById('career-mode-a')?.classList.toggle('active', mode === 'a');
    document.getElementById('career-mode-b')?.classList.toggle('active', mode === 'b');
    document.getElementById('career-target-panel')?.classList.toggle('active', mode === 'a');
    if (mode === 'a') window.searchJobs('a');
    else window.matchState.targetJobId = null;
};

window.startSelectedResumeMatch = function() {
    const file = window.matchState.file;
    if (!file) {
        window.Utils.showToast('请先选择一份简历', 'amber');
        return;
    }
    if (window.matchState.mode === 'a' && !window.matchState.targetJobId) {
        window.Utils.showToast('请先选择目标岗位', 'amber');
        return;
    }
    window.updateCareerStepper(3);
    window.runMatchFromFile(file);
};

/* ===== Stage 2: Diagnosis Theater ===== */
window.showTheater = function(file) {
    const hall = document.getElementById('match-hall');
    const theater = document.getElementById('match-theater');
    if (hall) hall.style.display = 'none';
    if (theater) {
        theater.classList.add('active');
        if (window.gsap && !window.matchReduced()) {
            window.gsap.fromTo(theater, {opacity:0}, {opacity:1, duration:.4});
        }
    }
    // Update title
    const title = document.getElementById('theater-title');
    if (title) title.textContent = '诊断智能体运行中';
    const sub = document.getElementById('theater-subtitle');
    if (sub) sub.textContent = file.name + ' · DeepSeek · 语义分析 · 图谱推理';
    // Start particle animation
    window.startTheaterParticles();
    // Start progress bar
    window.startTheaterProgress();
    // Start log stream
    window.startTheaterLog();
};

window.hideTheater = function() {
    const theater = document.getElementById('match-theater');
    if (theater) {
        theater.classList.remove('active');
    }
    window.stopTheaterParticles();
    clearTimeout(window.matchState.theaterLogTimer);
};

window.startTheaterParticles = function() {
    const canvas = document.getElementById('theater-particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const particles = [];
    for (let i = 0; i < 40; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            r: Math.random() * 2 + 1,
            opacity: Math.random() * 0.4 + 0.1
        });
    }
    canvas._particles = particles;
    canvas._animating = true;
    const animate = () => {
        if (!canvas._animating) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(45,212,191,${p.opacity})`;
            ctx.fill();
        });
        // Draw connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(45,212,191,${0.08 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    };
    animate();
};

window.stopTheaterParticles = function() {
    const canvas = document.getElementById('theater-particles');
    if (canvas) canvas._animating = false;
};

window.startTheaterProgress = function() {
    const bar = document.getElementById('theater-progress');
    if (!bar) return;
    bar.style.width = '0%';
    let progress = 0;
    const steps = [
        { at: 15, label: '文件校验' },
        { at: 30, label: '版面解析' },
        { at: 48, label: 'AI人才画像' },
        { at: 65, label: '语义匹配' },
        { at: 80, label: '图谱推理' },
        { at: 92, label: '路径规划' }
    ];
    let stepIdx = 0;
    const tick = () => {
        if (progress >= 92) return;
        progress += 1.5;
        if (bar) bar.style.width = progress + '%';
        if (stepIdx < steps.length && progress >= steps[stepIdx].at) {
            window.appendTheaterLog(steps[stepIdx].label, 'done');
            stepIdx++;
        }
        window.matchState.progressTimer = setTimeout(tick, 280);
    };
    tick();
};

window.startTheaterLog = function() {
    const log = document.getElementById('theater-log');
    if (log) log.innerHTML = '';
    window.appendTheaterLog('初始化诊断引擎...', 'active');
    setTimeout(() => window.appendTheaterLog('连接DeepSeek推理服务', 'active'), 500);
    setTimeout(() => window.appendTheaterLog('加载知识图谱 v5.2.1', 'done'), 900);
};

window.appendTheaterLog = function(msg, status) {
    const log = document.getElementById('theater-log');
    if (!log) return;
    const now = new Date();
    const time = now.getHours().toString().padStart(2,'0') + ':' + 
                 now.getMinutes().toString().padStart(2,'0') + ':' + 
                 now.getSeconds().toString().padStart(2,'0');
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = `<span class="log-time">[${time}]</span><span class="log-msg ${status || ''}">${window.matchEscape(msg)}</span>`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
};

window.finishTheater = function(success) {
    clearTimeout(window.matchState.progressTimer);
    const bar = document.getElementById('theater-progress');
    if (bar) bar.style.width = success ? '100%' : '92%';
    const title = document.getElementById('theater-title');
    if (title) title.textContent = success ? '诊断完成 ✓' : '诊断异常';
    window.appendTheaterLog(success ? '分析完成，准备渲染结果' : '诊断过程出现异常', success ? 'done' : 'active');
};

/* ===== Core: Run Match ===== */
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
    window.showTheater(file);
    window.Utils.showToast('诊断智能体已接管任务', 'cyan');

    const form = new FormData();
    form.append('file', file);
    form.append('mode', window.matchState.mode || 'b');
    if (window.matchState.targetJobId) {
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
            throw new Error(payload.detail || payload.message || '诊断服务返回 ' + response.status);
        }
        window.matchState.result = payload.data;
        window.matchState.selectedJobId = payload.data.selected_job_id || payload.data.matches?.[0]?.job?.id;
        window.finishTheater(true);
        setTimeout(() => {
            window.hideTheater();
            window.showResultsStage();
        }, 1200);
        window.Utils.showToast('诊断完成 · TOP1 匹配 ' + payload.data.matches[0].score + ' 分', 'mint');
    } catch (error) {
        window.finishTheater(false);
        const message = error && error.name === 'AbortError' ? '诊断超时，请稍后重试' : (error.message || '诊断失败');
        setTimeout(() => {
            window.hideTheater();
            const hall = document.getElementById('match-hall');
            if (hall) hall.style.display = 'flex';
        }, 2000);
        window.Utils.showToast(message, 'amber');
    } finally {
        clearTimeout(timeoutId);
        window.matchState.processing = false;
    }
};

/* ===== Stage 3: Results Stage ===== */
window.showResultsStage = function() {
    const stage = document.getElementById('match-stage');
    if (stage) {
        stage.classList.add('active');
        if (window.gsap && !window.matchReduced()) {
            window.gsap.fromTo(stage, {opacity:0}, {opacity:1, duration:.4});
        }
    }
    window.updateCareerStepper(4);
    window.renderResultsStage();
    window.renderCareerResultContext();
    const viewport = document.getElementById('stage-viewport');
    if (viewport) viewport.scrollTop = 0;
};

window.buildStageNav = function() { /* No longer needed - single page */ };

window.renderResultsStage = function() {
    const result = window.matchState.result;
    if (!result) return;
    window.renderScoreBar();
    window.renderVSResumes();
    window.renderSkillTable();
    setTimeout(() => window.renderDimensionChart(), 200);
    window.renderGapGrid();
    window.renderSuggestions();
    window.renderLearningPathList();
};

window.renderCareerResultContext = function() {
    const result = window.matchState.result;
    if (!result) return;
    const meta = window.matchState.selectedResumeMeta || {};
    const name = document.getElementById('career-result-resume-name');
    const detail = document.getElementById('career-result-resume-meta');
    const jobs = document.getElementById('career-result-jobs');
    if (name) name.textContent = meta.archiveTitle ? `${meta.archiveTitle} / ${(meta.version || '').toUpperCase()}` : (window.matchState.file?.name || '当前简历');
    if (detail) detail.textContent = `${meta.direction || result.profile?.target_role || '智能推荐'} · ${result.profile?.name || '候选人'}`;
    if (jobs) jobs.innerHTML = (result.matches || []).slice(0,5).map(item => `<button class="career-result-job ${item.job.id === window.matchState.selectedJobId ? 'active' : ''}" type="button" onclick="window.selectMatchJob('${window.matchEscape(item.job.id)}')"><strong>${window.matchEscape(item.job.title)}</strong>${Number(item.score || 0).toFixed(0)}%</button>`).join('');
};

/* Score Bar */
window.renderScoreBar = function() {
    const match = window.getSelectedMatch();
    if (!match) return;
    const score = Number(match.score || 0);
    const comp = window.matchState.result?.competitiveness || {};
    const number = document.getElementById('score-number');
    const job = document.getElementById('score-job');
    const meta = document.getElementById('score-meta-line');
    if (number) {
        if (window.gsap && !window.matchReduced()) {
            const obj = {val:0};
            window.gsap.to(obj, {val:score, duration:1.2, ease:'power2.out', onUpdate:() => { if (number) number.textContent = obj.val.toFixed(1); }});
        } else { number.textContent = score.toFixed(1); }
    }
    if (job) job.textContent = window.matchEscape(match.job.title) + ' · ' + window.matchEscape(match.job.company || '');
    if (meta) meta.textContent = (match.job.city || '') + ' · ' + (match.job.salary || '') + ' · 直接匹配' + match.matched.length + '项 可迁移' + match.transferable.length + '项';
    document.getElementById('mini-competitiveness').textContent = (comp.competitiveness != null ? comp.competitiveness.toFixed(0) : '--') + '%';
    document.getElementById('mini-matched').textContent = match.matched.length;
    document.getElementById('mini-transfer').textContent = match.transferable.length;
    document.getElementById('mini-gaps').textContent = match.missing.length;
};

/* Resume VS Section */
window.renderVSResumes = function() {
    const profile = window.matchState.result?.profile || {};
    const perfect = window.matchState.result?.perfect_resume || {};
    const match = window.getSelectedMatch();
    if (!match) return;
    const comp = window.matchState.result?.competitiveness || {};
    const score = Number(match.score || 0);

    document.getElementById('vs-user-score').textContent = score.toFixed(0);
    document.getElementById('vs-user-info').innerHTML = '<strong>' + window.matchEscape(profile.name || '候选人') + '</strong> · ' + window.matchEscape(profile.education || '') + ' · ' + Number(profile.experience_years || 0) + '年经验<br>' + window.matchEscape(profile.summary || '暂无个人简介').substring(0, 120);

    const userSkills = (profile.skills || []).slice(0, 12);
    const perfectSkills = perfect.ideal_skills || [];
    const matchedSet = new Set((match.matched || []).map(s => s.toLowerCase()));
    const missingSet = new Set((match.missing || []).map(s => s.toLowerCase()));

    document.getElementById('vs-user-skills').innerHTML = userSkills.map(s => {
        const name = window.matchEscape(s.name || '');
        const isMatched = matchedSet.has(name.toLowerCase()) || missingSet.has(name.toLowerCase()) || match.matched.some(m => m.toLowerCase() === name.toLowerCase());
        return '<span class="resume-vs-skill ' + (isMatched ? 'match' : 'normal') + '">' + name + '</span>';
    }).join('') || '<span style="font-size:10px;color:var(--text-muted)">暂无可确认技能</span>';

    document.getElementById('vs-perfect-info').innerHTML = '<strong>理想画像</strong> · ' + window.matchEscape(perfect.ideal_education || '本科及以上') + ' · ' + (perfect.ideal_experience_years || 3) + '年经验<br>' + window.matchEscape(perfect.ideal_summary || '具备该岗位所需的完整技能栈与项目经验').substring(0, 120);

    document.getElementById('vs-perfect-skills').innerHTML = perfectSkills.slice(0, 12).map(s => {
        const name = window.matchEscape(s.name || '');
        const isMatch = match.matched.some(m => m.toLowerCase() === name.toLowerCase());
        const isMissing = match.missing.some(m => m.toLowerCase() === name.toLowerCase());
        return '<span class="resume-vs-skill ' + (isMatch ? 'normal' : 'gap') + '">' + name + (isMatch ? '' : ' ✗') + '</span>';
    }).join('') || '<span style="font-size:10px;color:var(--text-muted)">分析中...</span>';

    document.getElementById('vs-user-summary').innerHTML = (perfect.ideal_projects || []).slice(0, 3).map(p => '<span>🏗 ' + window.matchEscape(typeof p === 'string' ? p : (p.title || '')) + '</span>').join('');
    document.getElementById('vs-perfect-summary').innerHTML = (perfect.key_differentiators || []).slice(0, 3).map(d => '<span>⭐ ' + window.matchEscape(d) + '</span>').join('');
};

/* Skill Comparison Table */
window.renderSkillTable = function() {
    const body = document.getElementById('skill-table-body');
    const match = window.getSelectedMatch();
    const comp = window.matchState.result?.competitiveness || {};
    const perfect = window.matchState.result?.perfect_resume || {};
    if (!body || !match) return;

    const skillCompare = comp.skill_comparison || [];
    const requiredSkills = match.job.requiredSkills || match.job.required_skills || [];
    const preferredSkills = match.job.preferredSkills || match.job.preferred_skills || [];

    if (skillCompare.length > 0) {
        body.innerHTML = skillCompare.map(sc => {
            const gapClass = sc.gap === 'matched' ? 'small' : 'medium';
            const gapLabel = sc.gap === 'matched' ? '已掌握' : '需补齐';
            const gapColor = sc.gap === 'matched' ? 'color:#059669' : 'color:#dc2626';
            const barWidth = sc.gap === 'matched' ? '40px' : '12px';
            return '<tr><td style="font-weight:600;color:var(--text-dark)">' + window.matchEscape(sc.skill) + '</td><td>' + window.matchEscape(sc.ideal_level) + '</td><td style="' + gapColor + '">' + window.matchEscape(sc.user_level) + '</td><td><span class="skill-gap-indicator ' + gapClass + '"></span>' + gapLabel + '<span class="skill-level-bar" style="width:' + barWidth + '"></span></td><td style="font-size:10px;color:var(--text-muted)">' + window.matchEscape(sc.why_important || '岗位要求') + '</td><td style="font-size:10px;color:var(--text-dark-secondary)">' + (sc.gap === 'matched' ? '保持并深化' : '重点强化') + '</td></tr>';
        }).join('');
    } else {
        // Fallback: build from matched/missing
        const rows = [];
        match.matched.forEach(s => {
            const importance = requiredSkills.includes(s) ? '必备' : '加分';
            rows.push('<tr><td style="font-weight:600;color:var(--text-dark)">' + window.matchEscape(s) + '</td><td>熟练</td><td style="color:#059669">已掌握</td><td><span class="skill-gap-indicator small"></span>已匹配<span class="skill-level-bar" style="width:38px"></span></td><td style="font-size:10px;color:var(--text-muted)">' + importance + '</td><td style="color:#059669;font-size:10px">继续深化</td></tr>');
        });
        match.missing.forEach(s => {
            const importance = requiredSkills.includes(s) ? '必备' : '建议';
            rows.push('<tr><td style="font-weight:600;color:var(--text-dark)">' + window.matchEscape(s) + '</td><td>熟练</td><td style="color:#dc2626">未掌握</td><td><span class="skill-gap-indicator medium"></span>需补齐<span class="skill-level-bar" style="width:12px;background:#F5A524"></span></td><td style="font-size:10px;color:var(--text-muted)">' + importance + '</td><td style="color:#dc2626;font-size:10px">优先学习</td></tr>');
        });
        body.innerHTML = rows.join('');
    }
};

/* Suggestions Grid */
window.renderSuggestions = function() {
    const grid = document.getElementById('suggestions-grid');
    const match = window.getSelectedMatch();
    const comp = window.matchState.result?.competitiveness || {};
    if (!grid || !match) return;

    const suggestions = comp.improvement_suggestions || [];
    let items = [];

    if (suggestions.length > 0) {
        items = suggestions.slice(0, 6).map(s => ({
            priority: s.priority || 'medium',
            title: window.matchEscape(s.skill),
            desc: window.matchEscape(s.action || '重点学习和实践'),
            meta: '预计 ' + (s.effort_weeks || 2) + ' 周',
        }));
    } else {
        // Fallback from gaps
        items = (match.gaps || []).slice(0, 6).map(g => ({
            priority: g.severity === 'high' ? 'high' : 'medium',
            title: window.matchEscape(g.skill),
            desc: window.matchEscape(g.reason || '岗位核心要求，建议优先补齐'),
            meta: '准备度 ' + g.readiness + '%',
        }));
    }

    if (items.length === 0) {
        items.push({priority:'low', title:'综合能力强化', desc:'当前能力已覆盖岗位核心要求，建议通过综合项目强化证据深度', meta:'持续提升'});
    }

    grid.innerHTML = items.map(item => '<div class="suggestion-card ' + item.priority + '"><div class="suggestion-priority">' + (item.priority === 'high' ? '高优先级' : item.priority === 'medium' ? '中优先级' : '低优先级') + '</div><div class="suggestion-title">' + item.title + '</div><div class="suggestion-desc">' + item.desc + '</div><div class="suggestion-meta">' + item.meta + '</div></div>').join('');
};

/* Learning Path List */
window.renderLearningPathList = function() {
    const el = document.getElementById('learning-path-list');
    const match = window.getSelectedMatch();
    if (!el || !match) return;
    const result = window.matchState.result;
    let paths = (result.learning_path || []);
    if (!paths.length) paths = window.deriveLearningPath(match);
    const totalImpact = paths.reduce((sum, item) => sum + Number(item.impact || 0), 0);
    const impact = document.getElementById('learning-impact');
    if (impact) impact.textContent = '累计提升 +' + Math.min(22, totalImpact) + ' 分';
    el.innerHTML = paths.slice(0, 4).map((item, i) => '<div class="learning-path-item"><div class="learning-path-num">' + (i + 1) + '</div><div class="learning-path-content"><div class="title">' + window.matchEscape(item.title || item.skill + '能力冲刺') + '</div><div class="desc">' + window.matchEscape(item.description || '') + '</div></div><div class="learning-path-meta">+' + (item.impact || 0) + ' 分<br>' + window.matchEscape(item.schedule || '') + '<br>' + window.matchEscape(item.resource || '') + '</div></div>').join('') || '<div style="color:rgba(255,255,255,.5);font-size:12px;padding:8px">核心能力已满足，重点深化实战经验</div>';
};

/* Keep: renderDimensionChart, renderGapGrid, selectMatchJob unchanged but targeting new IDs */
window.selectMatchJob = function(jobId) {
    if (!jobId || jobId === window.matchState.selectedJobId) return;
    window.matchState.selectedJobId = jobId;
    window.renderScoreBar();
    window.renderVSResumes();
    window.renderSkillTable();
    setTimeout(() => window.renderDimensionChart(), 100);
    window.renderGapGrid();
    window.renderSuggestions();
    window.renderLearningPathList();
    window.renderCareerResultContext();
};

// Old renderResultsStage removed - replaced by new single-page layout


/* Panel 3: Dimension Chart + Gaps */
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
        series:[{type:'radar',data:[{value:[d.skills||0,d.semantics||0,d.projects||0,d.experience||0,d.graph||0],name:(match.job.title||'').substring(0,12),areaStyle:{color:'rgba(13,148,136,.22)'},lineStyle:{color:'#0d9488',width:2.5},itemStyle:{color:'#2dd4bf'},symbolSize:6}]}]
    });
    setTimeout(() => chart.resize(), 80);
};

window.renderGapGrid = function() {
    const el = document.getElementById('gap-grid');
    const match = window.getSelectedMatch();
    if (!el || !match) return;
    if (!match.gaps.length) {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:32px;margin-bottom:8px">&#10003;</div><div style="font-size:13px;color:#059669;font-weight:600">核心能力已覆盖</div><div style="font-size:12px;margin-top:4px">建议通过综合项目强化能力证据</div></div>';
        return;
    }
    el.innerHTML = match.gaps.map(gap => {
        const path = (match.gap_paths || []).find(item => item.to === gap.skill);
        return `<div class="gap-card ${gap.severity}">
            <div class="gap-card-header"><span class="gap-card-skill">${window.matchEscape(gap.skill)}</span><span class="gap-card-readiness">迁移准备度 ${gap.readiness}%</span></div>
            <div class="gap-card-bar"><div class="gap-card-fill" style="width:${gap.readiness}%"></div></div>
            <div class="gap-card-reason">${window.matchEscape(path?.relation || gap.reason)}</div>
        </div>`;
    }).join('');
};

/* Panel 4: Learning Path */
window.deriveLearningPath = function(match) {
    return (match.gaps || []).slice(0,4).map((gap,index) => ({
        step:index+1, skill:gap.skill, title:`${gap.skill}能力冲刺`, description:`围绕${gap.skill}完成知识学习、动手实验与岗位场景复盘`, weeks:2, schedule:`第${index*2+1}-${index*2+2}周`, resource:'知识图谱精选资源', deliverable:`形成1个可验证的${gap.skill}实践成果`, impact:Math.min(12,5+Math.ceil((100-gap.readiness)/14))
    }));
};

/* ===== Overlays ===== */
window.showJobAnalysis = function() {
    const match = window.getSelectedMatch();
    if (!match) return;
    const overlay = document.getElementById('job-drawer-overlay');
    const drawer = document.getElementById('job-analysis-drawer');
    const body = document.getElementById('job-drawer-body');
    if (!body) return;
    const job = match.job || {};
    const required = job.requiredSkills || job.required_skills || [];
    const preferred = job.preferredSkills || job.preferred_skills || [];
    body.innerHTML = `
        <div class="match-drawer-section"><h4>岗位概览</h4><p>${window.matchEscape(job.title || '')} · ${window.matchEscape(job.company || '')}</p><p style="margin-top:6px">${window.matchEscape(job.city || '')} · ${window.matchEscape(job.salary || '')}</p></div>
        <div class="match-drawer-section"><h4>岗位描述</h4><p>${window.matchEscape(job.description || job.desc || '暂无详细描述')}</p></div>
        <div class="match-drawer-section"><h4>必备技能</h4><div>${required.map(s => `<span class="match-requirement-chip">${window.matchEscape(s)}</span>`).join('') || '<span style="color:var(--text-muted);font-size:12px">未指定</span>'}</div></div>
        <div class="match-drawer-section"><h4>加分技能</h4><div>${preferred.map(s => `<span class="match-requirement-chip">${window.matchEscape(s)}</span>`).join('') || '<span style="color:var(--text-muted);font-size:12px">未指定</span>'}</div></div>
        <div class="match-drawer-section"><h4>匹配分析</h4><p>综合匹配度: <strong style="color:var(--primary)">${Number(match.score).toFixed(1)}</strong></p><p style="margin-top:6px">直接匹配技能 ${match.matched.length} 项，可迁移技能 ${match.transferable.length} 项，差距技能 ${match.missing.length} 项。</p><p style="margin-top:6px">${window.matchEscape(match.reason)}</p></div>
        <div class="match-drawer-section"><h4>准备建议</h4><ol>${(match.gaps || []).slice(0,5).map(g => `<li>加强 <strong>${window.matchEscape(g.skill)}</strong> 能力（当前准备度 ${g.readiness}%）</li>`).join('')}</ol></div>`;
    if (overlay) overlay.classList.add('show');
    if (drawer) drawer.classList.add('show');
};

window.closeJobAnalysis = function() {
    document.getElementById('job-drawer-overlay')?.classList.remove('show');
    document.getElementById('job-analysis-drawer')?.classList.remove('show');
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

window.showImprovementDrawer = function() {
    const drawer = document.getElementById('improvement-drawer');
    const body = document.getElementById('improvement-drawer-body');
    const match = window.getSelectedMatch();
    if (!drawer || !body || !match) return;
    const gaps = match.gaps || [];
    const profile = window.matchState.result?.profile || {};
    
    const highGaps = gaps.filter(g => g.severity === 'high');
    const mediumGaps = gaps.filter(g => g.severity === 'medium');
    
    body.innerHTML = `
        ${highGaps.length > 0 ? `<div class="match-bottom-priority high"><span class="prio-label">高优先级</span>${highGaps.map(g => `<p>• <strong>${window.matchEscape(g.skill)}</strong>：${window.matchEscape(g.reason)}。建议通过项目实战或系统学习补齐，预计需要2-4周。</p>`).join('')}</div>` : ''}
        ${mediumGaps.length > 0 ? `<div class="match-bottom-priority medium"><span class="prio-label">中优先级</span>${mediumGaps.map(g => `<p>• <strong>${window.matchEscape(g.skill)}</strong>：${window.matchEscape(g.reason)}。可通过在线课程或小型项目快速掌握，预计需要1-2周。</p>`).join('')}</div>` : ''}
        <div class="match-bottom-priority low"><span class="prio-label">通用建议</span>
            <p>• 简历中量化项目成果，使用具体数据（如"性能提升30%"）代替模糊描述。</p>
            <p>• 在个人简介中明确体现与岗位相关的核心技能和项目经验。</p>
            <p>• 补充行业相关认证或开源贡献作为能力证据。</p>
            ${profile.experience_years < 2 ? '<p>• 作为初级候选人，强调学习能力和项目参与度比技能完备度更重要。</p>' : ''}
        </div>
    `;
    drawer.classList.add('show');
    
    // Drag to expand
    let startY, startH;
    const handle = document.getElementById('improvement-handle');
    if (handle) {
        handle.onmousedown = (e) => {
            startY = e.clientY;
            startH = drawer.offsetHeight;
            const onMove = (ev) => {
                const dy = startY - ev.clientY;
                drawer.style.height = Math.max(200, Math.min(window.innerHeight * 0.8, startH + dy)) + 'px';
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        };
    }
};

window.closeImprovementDrawer = function() {
    const drawer = document.getElementById('improvement-drawer');
    if (drawer) { drawer.classList.remove('show'); drawer.style.height = ''; }
};

window.exportMatchReport = function() {
    window.Utils.showToast('报告导出功能开发中，敬请期待', 'cyan');
};

/* ===== Init & Reset ===== */
window.loadHotJobs = function() {
    const container = document.getElementById('hall-hot-jobs');
    if (!container) return;
    const apiBase = window.API_BASE || 'http://127.0.0.1:5000';
    fetch(apiBase + '/api/match/jobs')
        .then(r => r.json())
        .then(resp => {
            const jobs = (resp.data || []).slice(0, 6);
            container.innerHTML = jobs.map(j => 
                `<div class="match-hot-item" onclick="window.matchState.mode='a';window.matchState.targetJobId='${j.id}';window.Utils.showToast('已选择: ${j.title}', 'cyan')">
                    <span class="hot-name">${window.matchEscape((j.title || '').substring(0, 18))}</span>
                    <span class="hot-count">${window.matchEscape(j.company || '')}</span>
                </div>`
            ).join('') || '<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px">暂无可显示岗位</div>';
        }).catch(() => {
            container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px">加载失败，请确认后端已启动</div>';
        });
};

window.initMatch = function() {
    document.body.classList.add('match-view-active');
    const view = document.getElementById('view-match');
    if (!view) return;

    if (!view.dataset.bound) {
        view.dataset.bound = '1';

        // File input change handler
        const fallbackInput = document.getElementById('resume-file-input');
        fallbackInput?.addEventListener('change', () => {
            const file = fallbackInput.files?.[0];
            if (file) window.handleCareerUpload(file);
        });

        // Dragover/drop on archive stage
        view.addEventListener('dragover', e => { e.preventDefault(); });
        view.addEventListener('drop', e => {
            e.preventDefault();
            const file = e.dataTransfer?.files?.[0];
            if (file) window.handleCareerUpload(file);
        });
    }

    const hall = document.getElementById('match-hall');
    const theater = document.getElementById('match-theater');
    const stage = document.getElementById('match-stage');
    if (theater) theater.classList.remove('active');

    if (window.matchState.result) {
        if (hall) hall.style.display = 'none';
        window.showResultsStage();
    } else {
        if (hall) hall.style.display = 'flex';
        if (stage) stage.classList.remove('active');
        window.showArchiveStage();
    }
};

window.resetMatchDiagnosis = function() {
    clearInterval(window.matchState.progressTimer);
    clearTimeout(window.matchState.theaterLogTimer);
    if (window.matchState.dimensionChart) { window.matchState.dimensionChart.dispose(); window.matchState.dimensionChart = null; }
    window.matchState.result = null;
    window.matchState.file = null;
    window.matchState.selectedJobId = null;
    window.matchState.processing = false;
    window.matchState.mode = null;
    window.matchState.targetJobId = null;
    window.matchState.currentPanel = 0;
    window.matchState.selectedResumeMeta = null;

    // Reset file inputs
    ['resume-file-input','mode-a-file-input','mode-b-file-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    // Show hall, hide theater and stage
    const hall = document.getElementById('match-hall');
    const theater = document.getElementById('match-theater');
    const stage = document.getElementById('match-stage');
    if (hall) hall.style.display = 'flex';
    if (theater) theater.classList.remove('active');
    if (stage) stage.classList.remove('active');
    
    // Reset progress
    const bar = document.getElementById('theater-progress');
    if (bar) bar.style.width = '0%';
    const log = document.getElementById('theater-log');
    if (log) log.innerHTML = '';
    
    // Close all overlays
    window.closeJobAnalysis();
    window.closeCompetitivenessModal();
    window.closeImprovementDrawer();
    
    window.showArchiveStage();
    window.Utils.showToast('已结束本次诊断，历史档案未受影响', 'cyan');
};

window.getSelectedMatch = function() {
    const matches = window.matchState.result?.matches || [];
    return matches.find(item => item.job.id === window.matchState.selectedJobId) || matches[0] || null;
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
