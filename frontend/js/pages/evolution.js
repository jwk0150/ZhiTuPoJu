// ============== Evolution View ==============
let evolutionState = {currentJobId: 'Java开发工程师', timeOffset: 6, filter: 'all'};
window.initEvolution = function() {
    if (!window.Store.state.evolution) window.generateAllData();
    window.renderEvolutionList();
    window.renderEvolution();
    // 时间滑块
    const thumb = document.getElementById('evo-thumb');
    const track = document.getElementById('evo-slider');
    if (thumb && track && !track.dataset.bound) {
        track.dataset.bound = '1';
        let dragging = false;
        const update = (clientX) => {
            const rect = track.getBoundingClientRect();
            const x = clientX - rect.left;
            const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
            thumb.style.left = pct + '%';
            evolutionState.timeOffset = Math.round(6 - (pct/100) * 11);
            const month = String(Math.max(1, Math.min(12, 7 - evolutionState.timeOffset))).padStart(2, '0');
            document.getElementById('evo-current-time').textContent = '2026-' + month;
            window.renderEvolutionCharts();
        };
        thumb.addEventListener('mousedown', () => dragging = true);
        document.addEventListener('mousemove', e => dragging && update(e.clientX));
        document.addEventListener('mouseup', () => dragging = false);
        track.addEventListener('click', e => update(e.clientX));
        thumb.style.left = '50%';
    }
    // 变化类型过滤
    document.querySelectorAll('.filter-pill[data-evo-filter]').forEach(p => {
        if (p.dataset.bound) return;
        p.dataset.bound = '1';
        p.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.filter-pill[data-evo-filter]').forEach(x => x.classList.remove('active'));
            p.classList.add('active');
            evolutionState.filter = p.dataset.evoFilter;
            window.renderEvolutionChanges();
        });
    });
    // 详细变更清单：可折叠下拉框（仅在工具栏空白处点击才折叠，筛选项不触发）
    const toggle = document.getElementById('evo-change-toggle');
    const cardEl = document.getElementById('evo-change-card');
    const collapseEl = document.getElementById('evo-change-collapse');
    // 强制默认收起（防止 CSS 缓存或遗留 class 导致默认展开）
    if (cardEl) cardEl.classList.remove('open');
    if (collapseEl) collapseEl.style.display = 'none';
    if (toggle && cardEl && !toggle.dataset.bound) {
        toggle.dataset.bound = '1';
        toggle.addEventListener('click', (e) => {
            if (e.target.closest('.filter-pill') || e.target.closest('.change-chevron')) return;
            const willOpen = !cardEl.classList.contains('open');
            cardEl.classList.toggle('open');
            if (collapseEl) collapseEl.style.display = willOpen ? 'block' : 'none';
        });
        // 点击箭头也能切换
        const chevron = document.getElementById('evo-change-chevron');
        if (chevron && !chevron.dataset.bound) {
            chevron.dataset.bound = '1';
            chevron.addEventListener('click', (e) => {
                e.stopPropagation();
                const willOpen = !cardEl.classList.contains('open');
                cardEl.classList.toggle('open');
                if (collapseEl) collapseEl.style.display = willOpen ? 'block' : 'none';
            });
        }
    }
    // 绑定“详细变更清单”技能项 → 新增技能详情页 的点击跳转
    window.bindEvolutionChangeLinks();
};
window.renderEvolutionList = function() {
    const el = document.getElementById('evo-list');
    if (!el) return;
    const jobs = Object.keys(window.EVOLUTION_JOB_PROFILES || {
        'Java开发工程师':1,'前端开发工程师':1,'Python数据分析师':1,'AI算法工程师':1,'产品经理':1,
        '运维工程师':1,'测试工程师':1,'UI设计师':1,'数据科学家':1,'DevOps工程师':1
    });
    el.innerHTML = jobs.map((t) => `
        <div class="evo-item ${t === evolutionState.currentJobId ? 'active' : ''}" data-job="${t}">
            <div class="evo-title">${t}</div>
            <div class="evo-cat">${(window.EVOLUTION_JOB_PROFILES[t]||{}).cat || '岗位'} · ${(window.EVOLUTION_JOB_PROFILES[t]||{}).jdCount || 800}个JD</div>
        </div>
    `).join('');
    el.querySelectorAll('.evo-item').forEach(item => {
        item.addEventListener('click', () => {
            el.querySelectorAll('.evo-item').forEach(x => x.classList.remove('active'));
            item.classList.add('active');
            evolutionState.currentJobId = item.dataset.job;
            window.renderEvolution();
        });
    });
};
window.getEvolutionForJob = function(jobId) {
    const profiles = window.EVOLUTION_JOB_PROFILES || {};
    const profile = profiles[jobId] || profiles['Java开发工程师'];
    if (!profile) {
        return { added:[], removed:[], modified:[], hotSkills:[], hotValues:[], trendMust:[], trendNice:[], cat:'岗位', jdCount:0 };
    }
    const seed = (jobId || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const jitter = (arr, key) => (arr || []).map((item, i) => {
        const copy = Object.assign({}, item);
        if (key === 'growth' && copy.growth && String(copy.growth).includes('%')) {
            const n = parseInt(String(copy.growth).replace(/[^\d-]/g, ''), 10) || 40;
            copy.growth = '+' + Math.max(8, n + ((seed + i * 17) % 40) - 15) + '%';
        }
        return copy;
    });
    return {
        added: jitter(profile.added, 'growth'),
        removed: (profile.removed || []).slice(),
        modified: (profile.modified || []).slice(),
        hotSkills: (profile.hotSkills || []).slice(),
        hotValues: (profile.hotValues || []).map((v, i) => Math.round(v * (0.85 + ((seed + i) % 30) / 100))),
        trendMust: (profile.trendMust || []).map((v, i) => Math.round(v + ((seed + i) % 5) - 2)),
        trendNice: (profile.trendNice || []).map((v, i) => Math.round(v + ((seed + i * 3) % 4) - 1)),
        cat: profile.cat,
        jdCount: profile.jdCount
    };
};
window.renderEvolution = function() {
    window.renderEvolutionChanges();
    window.renderEvolutionCharts();
};
window.renderEvolutionChanges = function() {
    const list = document.getElementById('evo-change-list');
    if (!list) return;
    const data = window.getEvolutionForJob(evolutionState.currentJobId);
    let html = '';
    if (evolutionState.filter === 'all' || evolutionState.filter === 'added') {
        html += data.added.slice(0, 8).map(c => `<div class="change-item clickable anim-fade-up" data-skill="${c.name}"><div class="change-badge add">+</div><div class="change-name">${c.name}</div><div class="change-meta">${c.version} · 引用 ${c.growth}</div></div>`).join('');
    }
    if (evolutionState.filter === 'all' || evolutionState.filter === 'modified') {
        html += data.modified.slice(0, 10).map(c => `<div class="change-item clickable anim-fade-up" data-skill="${c.name}"><div class="change-badge modify">~</div><div class="change-name">${c.name}</div><div class="change-meta">${c.change} · 权重 ${c.weight}</div></div>`).join('');
    }
    if (evolutionState.filter === 'all' || evolutionState.filter === 'removed') {
        html += data.removed.map(c => `<div class="change-item clickable anim-fade-up" data-skill="${c.name}"><div class="change-badge remove">-</div><div class="change-name">${c.name}</div><div class="change-meta">${c.version} · 引用 ${c.decline}</div></div>`).join('');
    }
    list.innerHTML = html || '<div class="empty-state" style="padding:40px">暂无变化数据</div>';
    const addEl = document.getElementById('evo-add-count');
    const rmEl = document.getElementById('evo-remove-count');
    const modEl = document.getElementById('evo-modify-count');
    if (addEl) addEl.textContent = data.added.length;
    if (rmEl) rmEl.textContent = data.removed.length;
    if (modEl) modEl.textContent = data.modified.length;
    // 写入当前筛选下的变更总数（标题徽标）
    const totalEl = document.getElementById('evo-change-total');
    if (totalEl) totalEl.textContent = list.querySelectorAll('.change-item').length;
    const sub = document.querySelector('#view-evolution .subtitle');
    if (sub) sub.innerHTML = `当前岗位：<strong style="color:var(--primary)">${evolutionState.currentJobId}</strong> · 基于时序图谱识别技能新增/删除/修改`;
};

// 点击“详细变更清单”中的技能项 → 跳转到对应技能的新增技能详情页面
window.bindEvolutionChangeLinks = function() {
    const list = document.getElementById('evo-change-list');
    if (!list || list.dataset.nsBound) return;
    list.dataset.nsBound = '1';
    list.addEventListener('click', function (e) {
        const item = e.target.closest('.change-item.clickable');
        if (!item) return;
        const skill = item.getAttribute('data-skill');
        const job = evolutionState.currentJobId;
        const href = (window.PAGE_HREF && window.PAGE_HREF.newSkill) || 'new-skill.html';
        const url = href + (href.indexOf('?') > -1 ? '&' : '?') + 'skill=' + encodeURIComponent(skill) + '&job=' + encodeURIComponent(job);
        window.location.href = url;
    });
};
window.renderEvolutionCharts = function() {
    window.disposeChart('chart-evo-trend');
    window.disposeChart('chart-evo-bar');
    const data = window.getEvolutionForJob(evolutionState.currentJobId);
    const factor = 1 + (6 - evolutionState.timeOffset) * 0.08;
    const must = data.trendMust.map(v => Math.round(v * factor));
    const nice = data.trendNice.map(v => Math.round(v * factor));
    const total = must.map((v, i) => v + nice[i]);
    window.chartInstances['chart-evo-trend'] = window.safeChart('chart-evo-trend');
    window.chartInstances['chart-evo-trend'].setOption({
        ...window.baseChartOpt(),
        legend:{data:['必备技能','加分技能','总技能数'], top:0, textStyle:{color:'#475569'}},
        xAxis:{type:'category',data:['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],axisLabel:{color:'#475569', fontSize:11},axisLine:{lineStyle:{color:'#e2e8f0'}}},
        yAxis:{type:'value',axisLabel:{color:'#475569', fontSize:11},splitLine:{lineStyle:{color:'#f1f3f9'}}},
        series:[
            {name:'必备技能',type:'line',smooth:true,symbolSize:6,lineStyle:{width:3, color:'#0D9488'},itemStyle:{color:'#0D9488'},data:must},
            {name:'加分技能',type:'line',smooth:true,symbolSize:6,lineStyle:{width:3, color:'#10b981'},itemStyle:{color:'#10b981'},data:nice},
            {name:'总技能数',type:'bar',barWidth:18,itemStyle:{borderRadius:[4,4,0,0], color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(13,148,136,.6)'},{offset:1,color:'rgba(13,148,136,.2)'}]}},data:total}
        ]
    });
    window.chartInstances['chart-evo-bar'] = window.safeChart('chart-evo-bar');
    const hotSkills = data.hotSkills.slice().reverse();
    const hotValues = data.hotValues.slice().reverse().map(v => Math.round(v * factor));
    window.chartInstances['chart-evo-bar'].setOption({
        ...window.baseChartOpt(),
        grid:{left:90, right:30, top:10, bottom:30, containLabel:true},
        tooltip:{trigger:'axis', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}},
        xAxis:{type:'value',axisLabel:{color:'#475569', fontSize:11},splitLine:{lineStyle:{color:'#f1f3f9'}}},
        yAxis:{type:'category',data:hotSkills,axisLabel:{color:'#475569', fontSize:11}},
        series:[{type:'bar',barWidth:14,data:hotValues,itemStyle:{borderRadius:[0,7,7,0],color:{type:'linear',x:0,y:0,x2:1,y2:0,colorStops:[{offset:0,color:'#0D9488'},{offset:1,color:'#F5A524'}]}}}]
    });
};

// 分岗位演化画像（切换左侧岗位时驱动变化）
window.EVOLUTION_JOB_PROFILES = {
    'Java开发工程师': {
        cat:'后端', jdCount:1420,
        added:[{name:'Spring Cloud Alibaba',version:'v2026.1',growth:'+347%'},{name:'GraalVM Native Image',version:'新出现',growth:'+128'},{name:'JDK 21 Virtual Thread',version:'v17→v21',growth:'+89%'},{name:'Spring AI',version:'新出现',growth:'+147'},{name:'OpenTelemetry',version:'新出现',growth:'+52'},{name:'eBPF',version:'新出现',growth:'+45'}],
        removed:[{name:'Struts2',version:'已废弃',decline:'-89%'},{name:'EJB',version:'已废弃',decline:'-95%'},{name:'JSP',version:'边缘化',decline:'-72%'},{name:'SOAP',version:'边缘化',decline:'-58%'}],
        modified:[{name:'微服务架构',change:'中级→高级',weight:'+18%'},{name:'MySQL',change:'加分→必备',weight:'↑'},{name:'Redis',change:'加分→必备',weight:'↑'},{name:'Kafka',change:'加分→必备',weight:'↑'},{name:'Kubernetes',change:'加分→必备',weight:'↑'}],
        hotSkills:['Spring Cloud','JDK 21','OpenTelemetry','GraalVM','Kafka','Redis','MySQL','Kubernetes','Docker','JVM调优'],
        hotValues:[387,289,152,128,210,198,176,168,154,132],
        trendMust:[18,19,19,20,21,22,23,24,25,26,28,30], trendNice:[12,13,14,15,16,17,18,20,22,24,26,28]
    },
    '前端开发工程师': {
        cat:'前端', jdCount:1180,
        added:[{name:'React Server Components',version:'新出现',growth:'+210%'},{name:'Next.js App Router',version:'v13→v15',growth:'+168%'},{name:'Vite 6',version:'新出现',growth:'+92%'},{name:'WebGPU',version:'新出现',growth:'+64%'},{name:'Astro',version:'新出现',growth:'+71%'},{name:'Tailwind v4',version:'新出现',growth:'+55%'}],
        removed:[{name:'jQuery',version:'边缘化',decline:'-78%'},{name:'Grunt',version:'已废弃',decline:'-91%'},{name:'Bower',version:'已废弃',decline:'-96%'},{name:'AngularJS 1.x',version:'已废弃',decline:'-88%'}],
        modified:[{name:'TypeScript',change:'加分→必备',weight:'↑'},{name:'React',change:'中级→高级',weight:'+22%'},{name:'工程化',change:'加分→必备',weight:'↑'},{name:'性能优化',change:'加分→必备',weight:'↑'},{name:'微前端',change:'选修→加分',weight:'↑'}],
        hotSkills:['TypeScript','React 19','Next.js','Vite','Vue3','CSS-in-JS','Webpack','Node.js','Playwright','WebGPU'],
        hotValues:[410,360,298,240,220,180,165,150,120,95],
        trendMust:[16,17,18,19,20,22,23,24,26,27,29,31], trendNice:[14,15,16,17,19,20,22,24,25,27,29,32]
    },
    'Python数据分析师': {
        cat:'数据', jdCount:860,
        added:[{name:'DuckDB',version:'新出现',growth:'+190%'},{name:'Polars',version:'新出现',growth:'+156%'},{name:'dbt',version:'新出现',growth:'+112%'},{name:'Lakehouse',version:'新出现',growth:'+88%'},{name:'LLM for Analytics',version:'新出现',growth:'+134%'}],
        removed:[{name:'SPSS',version:'边缘化',decline:'-62%'},{name:'Excel宏主导',version:'边缘化',decline:'-48%'},{name:'SAS基础岗',version:'下降',decline:'-41%'}],
        modified:[{name:'SQL',change:'必备→专家',weight:'↑'},{name:'Python',change:'中级→高级',weight:'+15%'},{name:'可视化',change:'加分→必备',weight:'↑'},{name:'A/B测试',change:'加分→必备',weight:'↑'}],
        hotSkills:['SQL','Python','Pandas','Polars','dbt','Tableau','PowerBI','Spark','Airflow','统计建模'],
        hotValues:[420,380,310,260,210,190,175,160,140,125],
        trendMust:[14,15,16,17,18,19,20,21,22,24,25,27], trendNice:[10,11,12,13,14,15,16,18,19,21,23,25]
    },
    'AI算法工程师': {
        cat:'AI', jdCount:1560,
        added:[{name:'LLM 应用工程',version:'新出现',growth:'+420%'},{name:'RAG',version:'新出现',growth:'+310%'},{name:'Agent / Tool Use',version:'新出现',growth:'+280%'},{name:'LoRA / PEFT',version:'新出现',growth:'+195%'},{name:'vLLM',version:'新出现',growth:'+160%'},{name:'多模态',version:'新出现',growth:'+148%'}],
        removed:[{name:'传统SVM主岗',version:'边缘化',decline:'-55%'},{name:'浅层特征工程岗',version:'下降',decline:'-43%'},{name:'纯规则引擎',version:'边缘化',decline:'-60%'}],
        modified:[{name:'PyTorch',change:'加分→必备',weight:'↑'},{name:'深度学习',change:'中级→高级',weight:'+25%'},{name:'CUDA',change:'选修→加分',weight:'↑'},{name:'分布式训练',change:'加分→必备',weight:'↑'}],
        hotSkills:['LLM','PyTorch','RAG','Transformer','CUDA','LoRA','Agent','向量检索','Python','MLSys'],
        hotValues:[480,420,390,340,280,260,240,210,190,150],
        trendMust:[20,22,24,26,28,30,33,36,38,41,44,48], trendNice:[15,16,18,20,22,25,28,30,33,36,40,44]
    },
    '产品经理': {
        cat:'产品', jdCount:980,
        added:[{name:'AI 产品设计',version:'新出现',growth:'+260%'},{name:'Prompt 产品化',version:'新出现',growth:'+180%'},{name:'数据闭环设计',version:'新出现',growth:'+95%'},{name:'增长实验平台',version:'新出现',growth:'+72%'}],
        removed:[{name:'纯画线框交付',version:'边缘化',decline:'-50%'},{name:'无数据决策',version:'下降',decline:'-66%'}],
        modified:[{name:'用户研究',change:'加分→必备',weight:'↑'},{name:'数据分析',change:'加分→必备',weight:'↑'},{name:'商业Sense',change:'中级→高级',weight:'+12%'}],
        hotSkills:['需求分析','AI产品','数据分析','用户研究','Roadmap','SQL基础','A/B测试','竞品分析','PRD','跨团队协作'],
        hotValues:[360,320,280,250,220,180,170,160,150,140],
        trendMust:[12,13,13,14,15,16,17,18,19,20,21,22], trendNice:[9,10,11,12,13,14,15,16,17,18,20,21]
    },
    '运维工程师': {
        cat:'运维', jdCount:720,
        added:[{name:'Platform Engineering',version:'新出现',growth:'+170%'},{name:'GitOps',version:'新出现',growth:'+130%'},{name:'eBPF Observability',version:'新出现',growth:'+98%'},{name:'FinOps',version:'新出现',growth:'+76%'}],
        removed:[{name:'纯手工部署',version:'已废弃',decline:'-82%'},{name:'无监控值班',version:'下降',decline:'-70%'}],
        modified:[{name:'Kubernetes',change:'加分→必备',weight:'↑'},{name:'IaC',change:'选修→必备',weight:'↑'},{name:'SRE实践',change:'加分→中级',weight:'↑'}],
        hotSkills:['Kubernetes','Terraform','Prometheus','Grafana','Linux','CI/CD','Ansible','Istio','AWS','SRE'],
        hotValues:[350,300,270,250,240,220,190,170,160,145],
        trendMust:[13,14,15,16,17,18,19,21,22,23,25,26], trendNice:[10,11,12,13,14,15,16,17,18,20,21,23]
    },
    '测试工程师': {
        cat:'测试', jdCount:640,
        added:[{name:'AI 辅助测试',version:'新出现',growth:'+200%'},{name:'契约测试',version:'新出现',growth:'+110%'},{name:'Chaos Engineering',version:'新出现',growth:'+85%'},{name:'质量门禁左移',version:'新出现',growth:'+90%'}],
        removed:[{name:'纯手工点点点',version:'边缘化',decline:'-58%'},{name:'无自动化报表',version:'下降',decline:'-47%'}],
        modified:[{name:'自动化测试',change:'加分→必备',weight:'↑'},{name:'接口测试',change:'中级→高级',weight:'↑'},{name:'性能测试',change:'选修→加分',weight:'↑'}],
        hotSkills:['自动化测试','Playwright','接口测试','CI质量门禁','性能测试','Python','Java','Appium','Mock','测试设计'],
        hotValues:[330,290,260,230,200,180,170,150,140,130],
        trendMust:[11,12,13,14,15,16,17,18,19,20,21,23], trendNice:[8,9,10,11,12,13,14,15,16,17,18,20]
    },
    'UI设计师': {
        cat:'设计', jdCount:510,
        added:[{name:'AI 设计协作',version:'新出现',growth:'+240%'},{name:'Design System Token',version:'新出现',growth:'+120%'},{name:'动效工程化',version:'新出现',growth:'+80%'}],
        removed:[{name:'切图工厂模式',version:'边缘化',decline:'-65%'},{name:'无组件库交付',version:'下降',decline:'-52%'}],
        modified:[{name:'Figma',change:'加分→必备',weight:'↑'},{name:'交互设计',change:'中级→高级',weight:'↑'},{name:'可用性测试',change:'选修→加分',weight:'↑'}],
        hotSkills:['Figma','设计系统','交互设计','视觉设计','原型','动效','用户体验','组件库','插画','AI作图'],
        hotValues:[300,270,240,210,190,170,160,140,120,100],
        trendMust:[10,11,11,12,13,14,14,15,16,17,18,19], trendNice:[8,8,9,10,11,12,13,14,15,16,17,18]
    },
    '数据科学家': {
        cat:'数据', jdCount:890,
        added:[{name:'Causal Inference',version:'新出现',growth:'+150%'},{name:'Feature Store',version:'新出现',growth:'+125%'},{name:'LLM Evaluation',version:'新出现',growth:'+175%'},{name:'MLOps',version:'新出现',growth:'+140%'}],
        removed:[{name:'纯离线报表岗',version:'边缘化',decline:'-45%'},{name:'无线上闭环',version:'下降',decline:'-50%'}],
        modified:[{name:'机器学习',change:'中级→高级',weight:'+20%'},{name:'实验设计',change:'加分→必备',weight:'↑'},{name:'特征工程',change:'加分→必备',weight:'↑'}],
        hotSkills:['机器学习','Python','实验设计','特征工程','MLOps','统计推断','Spark','SQL','模型评估','因果推断'],
        hotValues:[400,360,300,280,250,230,200,180,160,145],
        trendMust:[15,16,17,18,20,21,23,24,26,28,30,32], trendNice:[12,13,14,15,16,18,19,21,23,25,27,29]
    },
    'DevOps工程师': {
        cat:'运维', jdCount:780,
        added:[{name:'Internal Developer Platform',version:'新出现',growth:'+185%'},{name:'Policy as Code',version:'新出现',growth:'+115%'},{name:'Supply Chain Security',version:'新出现',growth:'+102%'},{name:'WASM Edge',version:'新出现',growth:'+68%'}],
        removed:[{name:'脚本堆砌发布',version:'已废弃',decline:'-75%'},{name:'无GitOps',version:'下降',decline:'-60%'}],
        modified:[{name:'CI/CD',change:'中级→专家',weight:'↑'},{name:'Kubernetes',change:'加分→必备',weight:'↑'},{name:'可观测性',change:'加分→必备',weight:'↑'}],
        hotSkills:['CI/CD','Kubernetes','Terraform','GitOps','Docker','Prometheus','ArgoCD','Security','Linux','云原生'],
        hotValues:[370,340,300,270,250,230,200,180,170,155],
        trendMust:[14,15,16,17,18,20,21,23,24,26,28,30], trendNice:[11,12,13,14,15,16,18,19,21,22,24,26]
    }
};


/* extracted for evolution */

// ============== Learning Path View ==============
let learningPathState = { currentJobId: 'Java开发工程师' };

window.initLearningPath = function() {
    const profiles = window.EVOLUTION_JOB_PROFILES || {};
    const jobs = Object.keys(profiles).length ? Object.keys(profiles) : [learningPathState.currentJobId];
    learningPathState.currentJobId = evolutionState.currentJobId || jobs[0] || 'Java开发工程师';
    console.log('[initLearningPath] jobId=', learningPathState.currentJobId, 'profiles=', jobs.length);
    // 直接渲染左侧岗位列表、步骤、效果、详情
    const lpList = document.getElementById('lp-job-list');
    const lpSteps = document.getElementById('lp-steps');
    const lpDetail = document.getElementById('lp-detail');
    const lpPct = document.getElementById('lp-effect-pct');
    const lpStars = document.getElementById('lp-stars');
    console.log('[initLearningPath] elements:', !!lpList, !!lpSteps, !!lpDetail, !!lpPct, !!lpStars);
    window.renderLpJobList();
    window.renderLpPage();
    window.bindLearningPathEvents();
    // 兜底：若 lp-steps 仍为空，直接基于当前岗位数据手动渲染
    if (lpSteps && !lpSteps.innerHTML.trim()) {
      const d = window.getEvolutionForJob(learningPathState.currentJobId);
      let steps = (d.added || []).slice(0, 3);
      if (steps.length < 3) (d.modified || []).forEach(m => { if (steps.length < 3 && m.name) steps.push(m); });
      if (steps.length < 3) ['核心框架','工程实践','架构设计'].forEach(n => { if (steps.length < 3) steps.push({ name: n }); });
      const periods = ['2-3 周', '1-2 周', '2-3 周'];
      const priorities = ['高', '高', '中'];
      lpSteps.innerHTML = steps.map((s, i) => `
        <div class="lp-step anim-fade-up" style="animation-delay:${i * 0.05}s">
          <div class="lp-step-num">${i + 1}</div>
          <div class="lp-step-name">${s.name}</div>
          <div class="lp-step-priority">优先级: <strong>${priorities[i]}</strong></div>
          <div class="lp-step-meta">预计学习周期 ${periods[i]}</div>
        </div>
        ${i < steps.length - 1 ? '<div class="lp-step-arrow">→</div>' : ''}
      `).join('');
      console.log('[initLearningPath] fallback steps rendered:', lpSteps.children.length);
    }
};

window.bindLearningPathEvents = function() {
    const search = document.getElementById('lp-search');
    if (search && !search.dataset.bound) {
        search.dataset.bound = '1';
        search.addEventListener('input', () => {
            const kw = search.value.trim().toLowerCase();
            document.querySelectorAll('#lp-job-list .lp-job-item').forEach(el => {
                const t = (el.dataset.job || '').toLowerCase();
                el.style.display = t.includes(kw) ? '' : 'none';
            });
        });
    }
};

window.renderLpJobList = function() {
    const el = document.getElementById('lp-job-list');
    if (!el) return;
    const profiles = window.EVOLUTION_JOB_PROFILES || {};
    let jobs = Object.keys(profiles);
    if (!jobs.length) jobs = window.Store && window.Store.state ? window.Store.state.jobs.map(j => j.title) : [learningPathState.currentJobId];
    const tags = ['紧缺','热门','新兴','稳定','高潜'];
    el.innerHTML = jobs.map((jid, i) => {
        const d = profiles[jid] || {};
        const active = jid === learningPathState.currentJobId ? ' active' : '';
        const tag = tags[i % tags.length];
        return `
            <div class="lp-job-item${active}" data-job="${jid}" onclick="window.switchLearningPathJob('${jid}')">
                <div class="lp-job-name"><span>${jid}</span><span class="lp-job-tag">${tag}</span></div>
                <div class="lp-job-meta">数据来源: ${d.jdCount || window.Utils.rand(120, 520)} 份JD</div>
                <div class="lp-job-meta">学习完成率: ${window.Utils.rand(68, 94)}%</div>
            </div>
        `;
    }).join('');
};

window.switchLearningPathJob = function(jid) {
    if (!jid) return;
    learningPathState.currentJobId = jid;
    evolutionState.currentJobId = jid;
    window.renderLpJobList();
    window.renderLpPage();
};

window.renderLpPage = function() {
    const d = window.getEvolutionForJob(learningPathState.currentJobId);
    window.renderLpSteps(d);
    window.renderLpEffect(d);
    window.renderLpDetail(d);
};

window.renderLpSteps = function(d) {
    const el = document.getElementById('lp-steps');
    if (!el) return;
    let steps = (d.added || []).slice(0, 3);
    if (steps.length < 3) (d.modified || []).forEach(m => { if (steps.length < 3 && m.name) steps.push(m); });
    if (steps.length < 3) ['核心框架','工程实践','架构设计'].forEach(n => { if (steps.length < 3) steps.push({ name: n, growth: '+0%' }); });
    const periods = ['2-3 周', '1-2 周', '2-3 周'];
    const priorities = ['高', '高', '中'];
    el.innerHTML = steps.map((s, i) => `
        <div class="lp-step anim-fade-up" style="animation-delay:${i * 0.05}s">
            <div class="lp-step-num">${i + 1}</div>
            <div class="lp-step-name">${s.name}</div>
            <div class="lp-step-priority">优先级: <strong>${priorities[i]}</strong></div>
            <div class="lp-step-meta">预计学习周期 ${periods[i]}</div>
        </div>
        ${i < steps.length - 1 ? '<div class="lp-step-arrow">→</div>' : ''}
    `).join('');
};

window.renderLpEffect = function(d) {
    const added = (d.added || []).length;
    const modified = (d.modified || []).length;
    const pct = Math.min(96, Math.max(70, 72 + added * 3 + modified * 2));
    const pctEl = document.getElementById('lp-effect-pct');
    if (pctEl) pctEl.textContent = pct;
    const starsEl = document.getElementById('lp-stars');
    if (starsEl) starsEl.textContent = '★'.repeat(Math.floor(pct / 20)) + '☆'.repeat(5 - Math.floor(pct / 20));

    window.disposeChart('lp-effect-chart');
    const chart = window.safeChart('lp-effect-chart');
    if (!chart) return;
    window.chartInstances['lp-effect-chart'] = chart;
    const vals = [window.Utils.rand(55, 65), window.Utils.rand(60, 72), window.Utils.rand(68, 78), window.Utils.rand(78, 86), pct];
    chart.setOption({
        ...window.baseChartOpt(),
        grid: { left: 0, right: 0, top: 6, bottom: 0 },
        xAxis: { type: 'category', show: false, data: ['M1', 'M2', 'M3', 'M4', 'M5'] },
        yAxis: { type: 'value', show: false, min: 40, max: 100 },
        tooltip: { trigger: 'axis', formatter: '{c}% 能力预估' },
        series: [{
            type: 'line', data: vals, smooth: true, symbol: 'none',
            lineStyle: { color: '#0D9488', width: 2.5 },
            areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(13,148,136,.35)' }, { offset: 1, color: 'rgba(13,148,136,.04)' }] } }
        }]
    });
};

window.renderLpDetail = function(d) {
    const el = document.getElementById('lp-detail');
    if (!el) return;
    let steps = (d.added || []).slice(0, 3);
    if (steps.length < 3) (d.modified || []).forEach(m => { if (steps.length < 3 && m.name) steps.push(m); });
    if (steps.length < 3) ['核心框架','工程实践','架构设计'].forEach(n => { if (steps.length < 3) steps.push({ name: n, growth: '+0%' }); });
    const goals = [
        ['理解核心概念与应用场景', '掌握框架及工具使用', '能够独立构建简单的应用'],
        ['深入掌握高级特性与配置', '能够解决复杂业务问题', '具备性能优化基础能力'],
        ['理解底层实现原理', '具备架构设计与扩展能力', '能够带领团队落地应用']
    ];
    const gains = [
        ['自动化流程能力', '智能决策能力', '提升开发效率'],
        ['复杂系统设计能力', '问题排查与优化能力', '提升代码质量'],
        ['技术领导力', '架构设计能力', '提升团队产出']
    ];
    const resources = [
        [{name:'官方文档', tag:'入门'}, {name:'实战课程', tag:'进阶'}, {name:'项目练习', tag:'提升'}],
        [{name:'源码阅读', tag:'进阶'}, {name:'案例拆解', tag:'进阶'}, {name:'社区讨论', tag:'提升'}],
        [{name:'架构实战', tag:'提升'}, {name:'最佳实践', tag:'提升'}, {name:'技术分享', tag:'提升'}]
    ];
    el.innerHTML = steps.map((s, i) => `
        <div class="lp-detail-step anim-fade-up" style="animation-delay:${i * 0.06}s">
            <div class="lp-detail-num">${i + 1}</div>
            <div>
                <div class="lp-detail-title">${s.name}</div>
                <div class="lp-detail-grid">
                    <div class="lp-detail-col">
                        <h4>学习目标</h4>
                        <ul>${goals[i].map(g => `<li>${g}</li>`).join('')}</ul>
                    </div>
                    <div class="lp-detail-col">
                        <h4>推荐资源</h4>
                        <div class="lp-resources">${resources[i].map(r => `<div class="lp-resource"><span>${r.name}</span><span class="lp-resource-tag">${r.tag}</span></div>`).join('')}</div>
                    </div>
                    <div class="lp-detail-col">
                        <h4>预计收获</h4>
                        <ul>${gains[i].map(g => `<li>${g}</li>`).join('')}</ul>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
};

// ============== 新增技能详情 ==============
let newSkillState = { currentName: '—', currentJobId: '' };

window.initNewSkill = function() {
    if (!window.EVOLUTION_JOB_PROFILES || !Object.keys(window.EVOLUTION_JOB_PROFILES).length) {
        window.generateAllData();
    }
    // 从 URL 读取 job / skill 参数（由演化页“详细变更清单”技能项跳转带入）
    try {
        const q = new URLSearchParams(window.location.search);
        const qJob = q.get('job');
        const qSkill = q.get('skill');
        if (qJob && window.EVOLUTION_JOB_PROFILES[qJob]) {
            newSkillState.currentJobId = qJob;
            evolutionState.currentJobId = qJob;
        }
        window.__nsFocusSkill = qSkill || '';
    } catch (e) {}
    newSkillState.currentJobId = evolutionState.currentJobId;
    window.renderNsJobList();
    window.renderNewSkillDetail();
    window.bindNewSkillEvents();
    // 若带有 skill 参数，自动定位到该技能详情并高亮
    if (window.__nsFocusSkill) {
        setTimeout(function () {
            const target = document.getElementById('ns-skill-name');
            if (target) { target.textContent = window.__nsFocusSkill; target.classList.add('ns-focus'); }
        }, 60);
    }
};

window.bindNewSkillEvents = function() {
    const search = document.getElementById('ns-search');
    if (search && !search.dataset.bound) {
        search.dataset.bound = '1';
        search.addEventListener('input', () => {
            const kw = search.value.trim().toLowerCase();
            document.querySelectorAll('#ns-job-list .lp-job-item').forEach(el => {
                const t = (el.dataset.job || '').toLowerCase();
                el.style.display = t.includes(kw) ? '' : 'none';
            });
        });
    }
};

window.renderNsJobList = function() {
    const el = document.getElementById('ns-job-list');
    if (!el) return;
    const profiles = window.EVOLUTION_JOB_PROFILES || {};
    const jobs = Object.keys(profiles);
    const tags = ['紧缺','热门','新兴','稳定','高潜'];
    el.innerHTML = jobs.map((jid, i) => {
        const d = profiles[jid] || {};
        const active = jid === newSkillState.currentJobId ? ' active' : '';
        const tag = tags[i % tags.length];
        return `
            <div class="lp-job-item${active}" data-job="${jid}" onclick="window.switchNsJob('${jid}')">
                <div class="lp-job-name"><span>${jid}</span><span class="lp-job-tag">${tag}</span></div>
                <div class="lp-job-meta">数据来源: ${d.jdCount || window.Utils.rand(120, 520)} 份JD</div>
                <div class="lp-job-meta">学习完成率: ${window.Utils.rand(68, 94)}%</div>
            </div>
        `;
    }).join('');
};

window.switchNsJob = function(jid) {
    if (!jid) return;
    newSkillState.currentJobId = jid;
    evolutionState.currentJobId = jid;
    window.renderNsJobList();
    window.renderNewSkillDetail();
};

window.renderNewSkillDetail = function() {
    const d = window.getEvolutionForJob(newSkillState.currentJobId);
    const top = (d.added || [])[0] || {};
    const skill = top.name || '—';
    const version = top.version || '—';
    const growth = top.growth || '+0%';
    const growthNum = Math.abs(parseInt(String(growth).replace(/[^0-9]/g, ''), 10)) || 0;
    const jdCount = d.jdCount || 0;
    const period = evolutionState.currentMonth || evolutionState.period || 3;

    newSkillState.currentName = skill;

    document.getElementById('ns-skill-name').textContent = skill;
    document.getElementById('ns-skill-meta').textContent = `版本 ${version} · 首次出现时间 ${period}个月内 · 数据来源 ${jdCount}条JD`;

    // Growth
    document.getElementById('ns-growth-val').textContent = growth;

    // Impact stars
    let stars = '★☆☆☆☆', label = '一般';
    if (growthNum >= 300) { stars = '★★★★★'; label = '极高'; }
    else if (growthNum >= 150) { stars = '★★★★☆'; label = '非常重要'; }
    else if (growthNum >= 80) { stars = '★★★☆☆'; label = '重要'; }
    else if (growthNum >= 30) { stars = '★★☆☆☆'; label = '关注'; }
    document.getElementById('ns-impact-stars').textContent = stars;
    document.getElementById('ns-impact-label').textContent = label;

    // Ratio
    const ratio = Math.min(35, Math.max(3, Math.round(growthNum / 10) + 4));
    document.getElementById('ns-ratio-val').textContent = ratio + '%';

    // Frequency
    document.getElementById('ns-freq-val').textContent = jdCount + ' 条JD';

    // Related skills: skip first, take 2-3 more from added + 1-2 from modified
    const related = [];
    (d.added || []).slice(1, 5).forEach(s => { if (s.name && !related.includes(s.name)) related.push(s.name); });
    if (related.length < 4) (d.modified || []).forEach(m => { if (related.length < 4 && m.name && !related.includes(m.name)) related.push(m.name); });
    if (related.length < 4) ['Less', 'Vue3', 'Node.js', 'JavaScript', 'TypeScript'].forEach(n => { if (related.length < 4 && !related.includes(n)) related.push(n); });
    document.getElementById('ns-related').innerHTML = related.map(s => `<span class="ns-related-tag">${s}</span>`).join('');

    // Typical JD examples
    const examples = [
        `熟悉使用 ${skill} 框架构建自动化流程，提升团队研发效率`,
        `熟悉 ${skill} 协作与工程化实践，具备开展实际项目的经验`
    ];
    document.getElementById('ns-jd-examples').innerHTML = examples.map(e => `<li>${e}</li>`).join('');

    // AI interpretation
    const trend = growthNum >= 200 ? '高速增长型' : growthNum >= 80 ? '快速增长型' : '稳步增长型';
    const urgency = growthNum >= 150 ? '立即' : '尽快';
    const aiBody = `这个 <strong style="color:var(--primary)">${skill}</strong> 是近 ${period} 个月新增的核心技能，需求增长率达 <strong style="color:#10b981">${growth}</strong>，呈现「${trend}」趋势。该技能的岗位需求占比已达 <strong>${ratio}%</strong>，影响等级 ${label}。建议${urgency}纳入学习计划，掌握 ${skill} 相关技术栈（含 ${related.slice(0, 3).join('、')} 等关联技能），以提升在 ${d.cat || '相关'} 岗位的竞争力。`;
    document.getElementById('ns-ai-body').innerHTML = aiBody;

    // Charts：等布局完成后再 init，避免 display:none/未挂载时容器尺寸为 0
    requestAnimationFrame(() => {
        window.renderNsGrowthChart(growthNum);
        window.renderNsTrendChart(skill, growthNum, period);
        // 主动 resize 一次，处理容器从 display:none 切到 block 后的尺寸为 0 问题
        setTimeout(() => {
            try { window.chartInstances['ns-trend-chart'] && window.chartInstances['ns-trend-chart'].resize(); } catch(e){}
            try { window.chartInstances['ns-growth-chart'] && window.chartInstances['ns-growth-chart'].resize(); } catch(e){}
        }, 60);
    });
};

window.renderNsGrowthChart = function(growthNum) {
    window.disposeChart('ns-growth-chart');
    const chart = window.safeChart('ns-growth-chart');
    if (!chart) return;
    window.chartInstances['ns-growth-chart'] = chart;
    const v = [10, 18, 26, 35, Math.max(40, growthNum)];
    chart.setOption({
        ...window.baseChartOpt(),
        grid: { left: 0, right: 0, top: 2, bottom: 0 },
        xAxis: { type: 'category', show: false, data: ['M1','M2','M3','M4','M5'] },
        yAxis: { type: 'value', show: false },
        tooltip: { show: false },
        series: [{
            type: 'line', data: v, smooth: true, symbol: 'none',
            lineStyle: { color: '#10b981', width: 2 },
            areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(16,185,129,.3)' }, { offset: 1, color: 'rgba(16,185,129,.02)' }] } }
        }]
    });
};

window.renderNsTrendChart = function(skill, growthNum, period) {
    window.disposeChart('ns-trend-chart');
    const chart = window.safeChart('ns-trend-chart');
    if (!chart) return;
    window.chartInstances['ns-trend-chart'] = chart;
    const months = ['10月','11月','12月','1月','2月','3月','4月','5月','6月','7月','8月','9月'].slice(0, Math.min(12, period));
    const base = Math.max(3, Math.round(growthNum / 30));
    const bars = months.map((_, i) => Math.round(base * Math.pow(1.35, i) + window.Utils.rand(0, 5)));
    const line = months.map((_, i) => Math.min(30, Math.round(2 + i * (ratio_at_end(i, months.length, growthNum)) + window.Utils.rand(0, 2))));
    function ratio_at_end(i, total, g) { return Math.max(2, Math.min(8, g / 30)); }
    chart.setOption({
        ...window.baseChartOpt(),
        tooltip: { trigger: 'axis' },
        legend: { data: ['提及次数','需求占比'], top: 0, textStyle: { color: '#475569' } },
        grid: { left: 44, right: 56, top: 32, bottom: 28 },
        xAxis: { type: 'category', data: months, axisLabel: { color: '#475569', fontSize: 11 }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
        yAxis: [
            { type: 'value', name: '提及次数', axisLabel: { color: '#475569', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(13,148,136,.1)' } } },
            { type: 'value', name: '需求占比', max: 30, axisLabel: { formatter: '{value}%', color: '#475569', fontSize: 10 }, splitLine: { show: false } }
        ],
        series: [
            { name: '提及次数', type: 'bar', data: bars, itemStyle: { color: '#0D9488', borderRadius: [4, 4, 0, 0] } },
            { name: '需求占比', type: 'line', data: line, yAxisIndex: 1, smooth: true, lineStyle: { color: '#F5A524', width: 2.5 }, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#F5A524' } }
        ]
    });
};

window.exportNewSkillReport = function() {
    window.Utils.showToast('✓ 已生成「' + newSkillState.currentName + '」技能详情报告（演示）', 'mint');
};

