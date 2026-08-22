// ============== Trend Data ==============
window.TREND = {
  quarters: ['2024 Q1','2024 Q2','2024 Q3','2024 Q4','2025 Q1','2025 Q2','2025 Q3','2025 Q4','2026 Q1','2026 Q2'],
  jobs: {
    'AI Agent 工程师':     {color:'#2DD4BF', q:[18,22,28,35,42,55,68,82,102,126]},
    '大模型应用工程师':      {color:'#7C3AED', q:[10,14,20,28,38,50,65,78,95,112]},
    '数据工程师':           {color:'#0D9488', q:[52,55,58,62,65,70,74,78,82,85]},
    '云原生工程师':          {color:'#10b981', q:[42,45,48,52,56,60,64,68,72,76]},
    '算法工程师':           {color:'#F5A524', q:[65,64,62,60,58,56,55,54,53,52]},
  },
  lifecycle: [
    {name:'RAG',stage:'growth',growth:42.7,heat:82},{name:'LLM',stage:'growth',growth:38.2,heat:78},
    {name:'Agent',stage:'growth',growth:34.8,heat:71},{name:'GraphRAG',stage:'emerging',growth:68.3,heat:45},
    {name:'Tool Calling',stage:'emerging',growth:52.1,heat:38},{name:'向量数据库',stage:'growth',growth:28.6,heat:65},
    {name:'Kubernetes',stage:'mature',growth:5.2,heat:88},{name:'Python',stage:'mature',growth:3.1,heat:92},
    {name:'Docker',stage:'decline',growth:-8.4,heat:60},{name:'Hadoop',stage:'decline',growth:-18.2,heat:35},
    {name:'Prompt Engineering',stage:'mature',growth:2.8,heat:68},{name:'SQL',stage:'mature',growth:-1.5,heat:85},
  ],
  heatSkills: ['Python','RAG','LLM','Agent','SQL','Docker','Kubernetes','GraphRAG','Tool Calling','向量数据库','Hadoop'],
  heatYears: ['2024','2025','2026'],
  heatData: [[70,15,12,8,80,75,62,3,6,20,72],[72,42,38,28,72,60,70,16,23,38,48],[73,72,68,64,58,42,75,42,48,52,28]],
  changes: [
    {id:1,job:'AI Agent 工程师',ability:'Tool Calling',type:'add',desc:'Agent 工作流编排核心能力',time:'10:32'},
    {id:2,job:'大模型应用工程师',ability:'GraphRAG',type:'add',desc:'从 RAG 升级为知识图谱增强检索',time:'09:48'},
    {id:3,job:'数据工程师',ability:'实时流处理',type:'modify',desc:'Flink 权重↑，传统批处理权重↓',time:'09:12'},
    {id:4,job:'算法工程师',ability:'Hadoop',type:'remove',desc:'需求下降 -12%，被 Spark/Flink 替代',time:'16:45'},
    {id:5,job:'云原生工程师',ability:'eBPF',type:'add',desc:'内核可观测性成为云原生新标配',time:'14:20'},
    {id:6,job:'AI Agent 工程师',ability:'Multi-Agent',type:'add',desc:'从单 Agent 向多 Agent 协作演进',time:'11:08'},
    {id:7,job:'前端开发工程师',ability:'WebAssembly',type:'add',desc:'高性能前端运行时需求上升',time:'15:30'},
    {id:8,job:'Java 开发工程师',ability:'Spring AI',type:'add',desc:'Java 生态融合 AI 能力的标志性框架',time:'10:15'},
    {id:9,job:'大模型应用工程师',ability:'Prompt Engineering',type:'modify',desc:'从独立技能变为 Tool Calling 的子技能',time:'14:50'},
    {id:10,job:'数据工程师',ability:'SQL',type:'modify',desc:'需求稳定，但更强调与 Python/Spark 配合',time:'09:22'},
  ],
  forecastJobs: [
    {rank:1,name:'AI Agent 工程师',growth:63,conf:91},{rank:2,name:'大模型应用工程师',growth:47,conf:88},
    {rank:3,name:'AI 数据治理师',growth:39,conf:84},{rank:4,name:'MLOps 工程师',growth:35,conf:82},
    {rank:5,name:'多智能体系统架构师',growth:32,conf:79},
  ],
  insight: '过去12个月，AI Agent相关岗位需求持续增长，同比增长38.6%。Tool Calling、RAG、向量数据库成为AI Agent岗位的核心能力三角。① AI Agent工程师需求预计继续强劲增长 ② GraphRAG正从萌芽期进入快速增长阶段 ③ 单纯Prompt Engineering的增长趋于稳定，正被Tool Calling和Agent编排能力取代 ④ Hadoop等传统大数据技能持续衰退。',
};
window.trendJob = 'AI Agent 工程师';
window.trendTimeIdx = 9;
window.trendPlaying = false;
window.trendTimer = null;

// ============== Analysis View (Trends) — API驱动 + Fallback ==============
window.trendDataState = {dashboard: null, lifecycle: null, emerging: null, insight: null, source: 'loading'};

window.fetchTrendData = async function() {
    const API = (window.API_BASE || ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') ? 'http://127.0.0.1:5000' : location.origin));
    try {
        const [dash, lc, em, ins] = await Promise.all([
            fetch(API+'/api/trends/dashboard').then(r=>r.json()).then(d=>d.data).catch(()=>null),
            fetch(API+'/api/trends/job-lifecycle').then(r=>r.json()).then(d=>d.data).catch(()=>null),
            fetch(API+'/api/trends/emerging-jobs').then(r=>r.json()).then(d=>d.data).catch(()=>null),
            fetch(API+'/api/trends/ai-insight').then(r=>r.json()).then(d=>d.data).catch(()=>null),
        ]);
        window.trendDataState = {dashboard: dash, lifecycle: lc, emerging: em, insight: ins, source: (dash && dash.data_source==='db') ? 'db' : 'mock'};
    } catch(e) {
        window.trendDataState = {dashboard: null, lifecycle: null, emerging: null, insight: null, source: 'mock'};
    }
};

window.renderLifecyclePanel = function(lc) {
    if (!lc || !lc.jobs) return;
    var cols = {rising: 'lc-rising', stable: 'lc-stable', declining: 'lc-declining', emerging: 'lc-emerging'};
    var arrows = {up: '↑', down: '↓', flat: '→'};

    Object.keys(cols).forEach(function(stage) {
        var el = document.getElementById(cols[stage]);
        if (!el) return;
        var items = lc.jobs.filter(function(j) { return j.stage === stage; });
        el.innerHTML = items.map(function(j) {
            return '<div class="lifecycle-card-item '+stage+'">' +
                '<div class="lc-job-title">' + j.title + '</div>' +
                '<div class="lc-trend ' + j.trend + '">' + (arrows[j.trend] || '→') + '</div>' +
                '<div class="lc-growth">' + (j.growth_rate > 0 ? '+' : '') + j.growth_rate + '%' +
                (j.confidence ? ' · ' + j.confidence + '%' : '') + '</div>' +
                (j.reason ? '<div class="lc-reason" title="' + j.reason + '">' + j.reason + '</div>' : '') +
                '</div>';
        }).join('');
    });

    // Badge
    var badge = document.getElementById('lifecycle-badge');
    if (badge) {
        badge.textContent = lc.data_source === 'db' ? 'DB驱动' : 'Demo';
        badge.className = 'trend-data-badge ' + (lc.data_source === 'db' ? 'db' : 'mock');
    }
};

window.renderEmergingPanel = function(em) {
    var list = document.getElementById('emerging-list');
    if (!list) return;
    var jobs = (em && em.emerging_jobs) ? em.emerging_jobs : [];
    if (!jobs.length) { list.innerHTML = '<span style="color:var(--text-muted);font-size:13px">暂无数据</span>'; return; }

    list.innerHTML = jobs.slice(0, 6).map(function(j, i) {
        return '<div class="emerging-item">' +
            '<div class="emerging-rank" style="' + (i < 3 ? '' : 'background:var(--bg-page);color:var(--text-muted)') + '">' + (i+1) + '</div>' +
            '<div class="emerging-info">' +
                '<div class="emerging-title">' + j.title + '</div>' +
                '<div class="emerging-drivers">' + (j.drivers || []).slice(0, 2).join(' · ') + '</div>' +
                '<div class="emerging-skills">' + (j.required_skills || []).slice(0, 4).map(function(s) { return '<span class="tag tag-cyan">' + s + '</span>'; }).join('') + '</div>' +
            '</div>' +
            '<div style="text-align:right;flex-shrink:0">' +
                '<div class="emerging-potential">' + (j.growth_potential || 0) + '</div>' +
                '<div class="emerging-eta">' + (j.eta_months || '?') + '个月</div>' +
            '</div>' +
            '</div>';
    }).join('');

    var badge = document.getElementById('emerging-badge');
    if (badge) {
        badge.textContent = (em && em.data_source === 'db' && em.ai_enriched) ? 'AI+DB' : ((em && em.data_source === 'db') ? 'DB' : 'Demo');
        badge.className = 'trend-data-badge ' + ((em && em.data_source === 'db') ? 'db' : 'mock');
    }
};

// ============== Trend Analysis Phase 1 - Mock Data ==============
window.trendOverviewData = {
    emerging: 38,
    emergingGrowth: 24.6,
    declining: 17,
    decliningGrowth: -8.3,
    stable: 46,
    stableGrowth: 3.2,
    confidence: 82.6
};

// ============== Trend Analysis Phase 1 - Init ==============
window.initAnalysis = function() {
    var d = window.trendOverviewData;
    var elEmerging = document.getElementById('kpi-emerging');
    var elDeclining = document.getElementById('kpi-declining');
    var elStable = document.getElementById('kpi-stable');
    var elConfidence = document.getElementById('kpi-confidence');

    // Reset to 0 before animation
    if (elEmerging) elEmerging.textContent = '0';
    if (elDeclining) elDeclining.textContent = '0';
    if (elStable) elStable.textContent = '0';
    if (elConfidence) elConfidence.textContent = '0';

    // GSAP number animations
    if (window.gsap) {
        var animTarget = { emerging: 0, emergingGrowth: 0, declining: 0, decliningGrowth: 0, stable: 0, stableGrowth: 0, confidence: 0 };
        window.gsap.to(animTarget, {
            emerging: d.emerging,
            emergingGrowth: d.emergingGrowth,
            declining: d.declining,
            decliningGrowth: Math.abs(d.decliningGrowth),
            stable: d.stable,
            stableGrowth: d.stableGrowth,
            confidence: d.confidence,
            duration: 1.2,
            ease: 'power2.out',
            onUpdate: function() {
                if (elEmerging) elEmerging.textContent = Math.round(animTarget.emerging);
                if (elDeclining) elDeclining.textContent = Math.round(animTarget.declining);
                if (elStable) elStable.textContent = Math.round(animTarget.stable);
                if (elConfidence) elConfidence.textContent = animTarget.confidence.toFixed(1);
                var elEmChange = document.getElementById('kpi-emerging-change');
                if (elEmChange) elEmChange.textContent = '+' + animTarget.emergingGrowth.toFixed(1) + '%';
                var elDeChange = document.getElementById('kpi-declining-change');
                if (elDeChange) elDeChange.textContent = '-' + animTarget.decliningGrowth.toFixed(1) + '%';
                var elStChange = document.getElementById('kpi-stable-change');
                if (elStChange) elStChange.textContent = '+' + animTarget.stableGrowth.toFixed(1) + '%';
            }
        });
    } else {
        // Fallback without GSAP
        if (elEmerging) elEmerging.textContent = d.emerging;
        if (elDeclining) elDeclining.textContent = d.declining;
        if (elStable) elStable.textContent = d.stable;
        if (elConfidence) elConfidence.textContent = d.confidence.toFixed(1);
    }

    // Update timestamp
    var timeEl = document.getElementById('trend-update-time');
    if (timeEl) {
        var now = new Date();
        var pad = function(n) { return String(n).padStart(2, '0'); };
        timeEl.textContent = now.getFullYear() + '.' + pad(now.getMonth() + 1) + '.' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
    }

    // Phase 2: Init lifecycle chart
    window.initLifecycleChart();

    // Phase 3: Render emerging & declining job cards
    window.initTrendJobsPhase3();

    // Phase 4: Init job transition graph (deferred for G6 to pick up container size)
    setTimeout(function() { window.initTransitionPhase4(); }, 300);

    // Phase 5: Init forecast chart (deferred for container sizing)
    setTimeout(function() { window.initForecastPhase5(); }, 500);

	    // Phase 6: Init AI insight module (deferred to load after visual charts)
	    setTimeout(function() { window.initAIPhase6(); }, 700);
};

// ============== Start Trend Analysis Button ==============
window.startTrendAnalysis = function() {
    var btn = document.getElementById('trend-start-btn');
    if (!btn) return;
    var origText = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> 趋势分析引擎已启动';
    btn.style.background = 'linear-gradient(135deg,#7C3AED,#a855f7)';
    btn.style.boxShadow = '0 4px 14px rgba(124,58,237,.35)';
    setTimeout(function() {
        btn.innerHTML = origText;
        btn.style.background = '';
        btn.style.boxShadow = '';
    }, 2500);
};

// ============== Trend Analysis Phase 2 - Lifecycle Chart ==============
window.trendChartInstances = window.trendChartInstances || {};

// ── Mock Data ──
window.lifecycleMockData = [
    { name: "AI Agent工程师",    x: 88,  y: 68,  size: 90, status: "emerging",  trendIndex: 92, skills: ["AI Agent","LLM","RAG","Python"],              reason: "Agent应用快速增长" },
    { name: "大模型应用工程师",   x: 76,  y: 54,  size: 82, status: "emerging",  trendIndex: 88, skills: ["LLM","RAG","Prompt","API"],                  reason: "企业大模型应用需求增加" },
    { name: "具身智能工程师",    x: 70,  y: 48,  size: 60, status: "emerging",  trendIndex: 84, skills: ["ROS2","PyTorch","SLAM"],                       reason: "具身智能产业快速发展" },
    { name: "合成数据工程师",    x: 62,  y: 41,  size: 48, status: "growth",    trendIndex: 79, skills: ["Synthetic Data","Python","ML"],                reason: "AI训练数据需求增长" },
    { name: "数据分析师",        x: 20,  y: 12,  size: 95, status: "stable",    trendIndex: 65, skills: ["SQL","Python","BI"],                           reason: "需求稳定但技能结构正在变化" },
    { name: "传统运维工程师",    x: -15, y: -4,  size: 70, status: "stable",    trendIndex: 54, skills: ["Linux","Network","Cloud"],                      reason: "传统需求稳定，自动化程度提高" },
    { name: "传统数据录入员",    x: -72, y: -42, size: 80, status: "declining", trendIndex: 28, skills: ["Excel","Data Entry"],                          reason: "OCR、RPA和AI自动化替代" },
    { name: "基础报表专员",      x: -52, y: -31, size: 62, status: "declining", trendIndex: 34, skills: ["Excel","BI"],                                  reason: "自动报表和AI分析工具普及" },
    { name: "基础客服",          x: -45, y: -25, size: 75, status: "declining", trendIndex: 38, skills: ["客服","FAQ"],                                  reason: "AI客服和智能Agent逐渐普及" },
    { name: "基础测试工程师",    x: -30, y: -18, size: 55, status: "declining", trendIndex: 42, skills: ["Manual Testing"],                              reason: "自动化测试与AI测试工具发展" }
];

// ── Color & Status Helpers ──
window.getLifecycleColor = function(status) {
    var map = {
        emerging:  { fill: 'rgba(45,212,191,0.55)',  stroke: '#2DD4BF', shadow: 'rgba(45,212,191,0.45)' },
        growth:    { fill: 'rgba(59,130,246,0.55)',  stroke: '#3b82f6', shadow: 'rgba(59,130,246,0.45)' },
        stable:    { fill: 'rgba(124,58,237,0.55)',  stroke: '#7C3AED', shadow: 'rgba(124,58,237,0.45)' },
        declining: { fill: 'rgba(249,115,22,0.55)',  stroke: '#f97316', shadow: 'rgba(249,115,22,0.45)' }
    };
    return map[status] || map.stable;
};

window.getLifecycleStatusLabel = function(status) {
    var map = { emerging: '🔥 快速增长', growth: '↑ 持续增长', stable: '→ 相对稳定', declining: '↓ 需求收缩' };
    return map[status] || status;
};

// ── Tooltip Formatter ──
window.formatLifecycleTooltip = function(params) {
    if (!params || !params.data || params.data.length < 9) return '';
    var d = {
        name: params.data[0],
        x: params.data[1],
        y: params.data[2],
        size: params.data[3],
        status: params.data[4],
        trendIndex: params.data[5],
        skills: params.data[6],
        reason: params.data[7],
        statusLabel: params.data[8]
    };
    var color = window.getLifecycleColor(d.status);
    var skillsHtml = (d.skills || []).map(function(s) {
        return '<span style="display:inline-block;padding:1px 6px;margin:1px 2px;border-radius:3px;background:rgba(13,148,136,.1);color:#0D9488;font-size:10px">' + s + '</span>';
    }).join('');
    return '<div style="font-family:\'DM Sans\',\'Noto Sans SC\',sans-serif;padding:4px 6px;min-width:200px;max-width:280px">' +
        '<div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px">' + d.name + '</div>' +
        '<div style="font-size:12px;color:' + color.stroke + ';font-weight:600;margin-bottom:8px">' + d.statusLabel + '</div>' +
        '<div style="display:flex;gap:16px;margin-bottom:6px">' +
            '<div><span style="font-size:10px;color:#64748B">需求增长</span><br><span style="font-size:14px;font-weight:700;color:#0f172a">' + (d.y > 0 ? '+' : '') + d.y + '%</span></div>' +
            '<div><span style="font-size:10px;color:#64748B">趋势指数</span><br><span style="font-size:14px;font-weight:700;color:#0f172a">' + d.trendIndex + '</span></div>' +
        '</div>' +
        '<div style="margin-bottom:4px"><span style="font-size:10px;color:#64748B">核心技能</span><br>' + skillsHtml + '</div>' +
        '<div style="font-size:11px;color:#475569;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:4px"><span style="color:#64748B;font-size:10px">趋势原因</span><br>' + d.reason + '</div>' +
        '</div>';
};

// ── Build ECharts Option ──
window.buildLifecycleOption = function() {
    var data = window.lifecycleMockData;
    var scatterData = data.map(function(d) {
        return {
            name: d.name,
            value: [d.x, d.y, d.size, d.status, d.trendIndex, d.skills, d.reason, window.getLifecycleStatusLabel(d.status)],
            symbolSize: Math.max(18, d.size * 0.35),
            itemStyle: {
                color: window.getLifecycleColor(d.status).fill,
                borderColor: window.getLifecycleColor(d.status).stroke,
                borderWidth: 1.2,
                shadowBlur: 14,
                shadowColor: window.getLifecycleColor(d.status).shadow
            },
            emphasis: {
                scale: 1.35,
                itemStyle: {
                    shadowBlur: 24,
                    shadowColor: window.getLifecycleColor(d.status).shadow,
                    borderWidth: 2
                }
            }
        };
    });

    // Zone backgrounds via markArea
    var zoneAreas = [
        [{ xAxis: -100, yAxis: -50 }, { xAxis: -25, yAxis: 100 }],
        [{ xAxis: -25,  yAxis: -50 }, { xAxis: 25,  yAxis: 100 }],
        [{ xAxis: 25,   yAxis: -50 }, { xAxis: 65,  yAxis: 100 }],
        [{ xAxis: 65,   yAxis: -50 }, { xAxis: 100, yAxis: 100 }]
    ];
    var zoneColors = [
        ['rgba(249,115,22,0.03)', 'rgba(249,115,22,0.00)'],
        ['rgba(124,58,237,0.03)', 'rgba(124,58,237,0.00)'],
        ['rgba(59,130,246,0.03)', 'rgba(59,130,246,0.00)'],
        ['rgba(45,212,191,0.04)', 'rgba(45,212,191,0.00)']
    ];

    return {
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(255,255,255,0.96)',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            borderRadius: 12,
            padding: [14, 16],
            textStyle: { color: '#0f172a', fontSize: 12 },
            extraCssText: 'box-shadow: 0 8px 32px rgba(11,18,32,.12); backdrop-filter: blur(8px);',
            formatter: function(params) { return window.formatLifecycleTooltip(params); }
        },
        grid: { left: 60, right: 40, top: 50, bottom: 50, containLabel: false },
        xAxis: {
            name: '岗位生命周期趋势',
            nameLocation: 'center',
            nameGap: 32,
            nameTextStyle: { color: '#64748B', fontSize: 11, fontWeight: 600 },
            min: -100, max: 100,
            splitLine: { show: true, lineStyle: { color: '#f1f3f9', type: 'dashed', width: 0.5 } },
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisTick: { show: false },
            axisLabel: {
                color: '#64748B', fontSize: 10, fontFamily: 'var(--font-mono)',
                formatter: function(v) {
                    if (v === -75) return '衰退';
                    if (v === -25) return '稳定';
                    if (v === 25)  return '增长';
                    if (v === 75)  return '新兴';
                    return '';
                }
            }
        },
        yAxis: {
            name: '需求增长率 (%)',
            nameLocation: 'center',
            nameGap: 38,
            nameTextStyle: { color: '#64748B', fontSize: 11, fontWeight: 600 },
            min: -50, max: 100,
            splitLine: { show: true, lineStyle: { color: '#f1f3f9', type: 'dashed', width: 0.5 } },
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisTick: { show: false },
            axisLabel: { color: '#64748B', fontSize: 10, fontFamily: 'var(--font-mono)', formatter: '{value}%' }
        },
        series: [{
            type: 'scatter',
            data: scatterData,
            emphasis: {
                focus: 'self',
                label: { show: true, formatter: '{b}', position: 'top', distance: 10, fontSize: 12, fontWeight: 600, color: '#0f172a' }
            },
            markArea: {
                silent: true,
                data: [
                    [{ xAxis: -100, yAxis: -50, itemStyle: { color: 'rgba(249,115,22,0.025)' } },  { xAxis: -25, yAxis: 100, itemStyle: { color: 'rgba(249,115,22,0.00)' } }],
                    [{ xAxis: -25,  yAxis: -50, itemStyle: { color: 'rgba(124,58,237,0.025)' } }, { xAxis: 25,  yAxis: 100, itemStyle: { color: 'rgba(124,58,237,0.00)' } }],
                    [{ xAxis: 25,   yAxis: -50, itemStyle: { color: 'rgba(59,130,246,0.025)' } }, { xAxis: 65,  yAxis: 100, itemStyle: { color: 'rgba(59,130,246,0.00)' } }],
                    [{ xAxis: 65,   yAxis: -50, itemStyle: { color: 'rgba(45,212,191,0.03)' } }, { xAxis: 100, yAxis: 100, itemStyle: { color: 'rgba(45,212,191,0.00)' } }]
                ]
            }
        }]
    };
};

// ── Init / Update Lifecycle Chart ──
window.initLifecycleChart = function() {
    var dom = document.getElementById('chart-lifecycle-scatter');
    if (!dom) return;

    var existing = window.trendChartInstances.lifecycle;
    if (existing) {
        // Already initialized — resize and update option
        existing.setOption(window.buildLifecycleOption(), true);
        existing.resize();
        return;
    }

    // First init
    var chart = echarts.init(dom);
    chart.setOption(window.buildLifecycleOption());
    window.trendChartInstances.lifecycle = chart;

    // Click handler — open job trend drawer
    chart.off('click');
    chart.on('click', function(params) {
        if (params.data && params.data.name) {
            var name = params.data.name;
            var status = params.data.value ? params.data.value[3] : null;
            var emergingJob = window.emergingJobsMockData.find(function(j) { return j.name === name; });
            var decliningJob = window.decliningJobsMockData.find(function(j) { return j.name === name; });
            if (emergingJob) {
                window.openJobTrendDrawer(name, 'emerging');
            } else if (decliningJob) {
                window.openJobTrendDrawer(name, 'declining');
            } else if (status === 'emerging' || status === 'growth') {
                window.openJobTrendDrawer(name, 'emerging');
            } else if (status === 'declining') {
                window.openJobTrendDrawer(name, 'declining');
            } else {
                window.showLifecycleToast(name);
            }
        }
    });
};

// ── Toast ──
window.showLifecycleToast = function(name) {
    var toast = document.getElementById('lifecycle-toast');
    if (!toast) return;
    toast.textContent = 'Selected: ' + name;
    toast.classList.add('show');
    clearTimeout(window._lifecycleToastTimer);
    window._lifecycleToastTimer = setTimeout(function() {
        toast.classList.remove('show');
    }, 2000);
};

// ── Resize handler ──
window._lifecycleResizeHandler = function() {
    var chart = window.trendChartInstances.lifecycle;
    if (chart && !chart.isDisposed()) {
        try { chart.resize(); } catch(e) {}
    }
};

// ── Dispose ──
window.disposeLifecycleChart = function() {
    var chart = window.trendChartInstances.lifecycle;
    if (chart) {
        try { chart.dispose(); } catch(e) {}
        window.trendChartInstances.lifecycle = null;
    }
};

// ============== Trend Analysis Phase 3 - Emerging & Declining Jobs ==============

// ── Mock Data ──
window.emergingJobsMockData = [
    { name: "AI Agent工程师",   growth: 68.4, trendIndex: 92, skills: ["AI Agent","LLM","RAG","Python"],          reason: "企业Agent应用需求快速增长",               signal: "强增长" },
    { name: "大模型应用工程师", growth: 54.2, trendIndex: 88, skills: ["LLM","RAG","Prompt","API"],              reason: "大模型应用场景持续扩张",                   signal: "快速增长" },
    { name: "具身智能工程师",   growth: 47.8, trendIndex: 84, skills: ["ROS2","PyTorch","SLAM","强化学习"],        reason: "机器人与AI融合加速",                       signal: "高速增长" },
    { name: "合成数据工程师",   growth: 41.3, trendIndex: 79, skills: ["Synthetic Data","Python","ML"],           reason: "AI训练数据需求不断增加",                   signal: "持续增长" }
];

window.decliningJobsMockData = [
    { name: "传统数据录入员",   decline: -42.1, riskIndex: 86, skills: ["Excel","Data Entry"],                    reason: "OCR、RPA与AI自动化降低人工录入需求",        signal: "高转型压力" },
    { name: "基础报表专员",     decline: -31.5, riskIndex: 74, skills: ["Excel","BI","Reporting"],                reason: "自动报表与AI分析工具逐渐普及",             signal: "需求收缩" },
    { name: "基础客服",         decline: -24.8, riskIndex: 68, skills: ["FAQ","Customer Service"],                reason: "智能客服与Agent承担大量标准化问答",         signal: "转型压力" },
    { name: "基础测试工程师",   decline: -19.6, riskIndex: 61, skills: ["Manual Testing"],                        reason: "自动化测试与AI测试工具快速发展",           signal: "结构调整" }
];

// ── Calculate Averages ──
window.calculateTrendAverage = function() {
    var emergingAvg = window.emergingJobsMockData.reduce(function(s, j) { return s + j.growth; }, 0) / window.emergingJobsMockData.length;
    var decliningAvg = window.decliningJobsMockData.reduce(function(s, j) { return s + Math.abs(j.decline); }, 0) / window.decliningJobsMockData.length;
    return { emergingAvg: emergingAvg, decliningAvg: decliningAvg };
};

// ── Render Emerging Jobs ──
window.renderEmergingJobs = function() {
    var container = document.getElementById('emerging-cards');
    if (!container) return;
    var avg = window.calculateTrendAverage();
    var statEl = document.getElementById('emerging-avg-stat');
    if (statEl) statEl.textContent = '↑ +' + avg.emergingAvg.toFixed(1) + '%';

    container.innerHTML = window.emergingJobsMockData.map(function(j, i) {
        return '<div class="trend-job-card emerging anim-fade-up" style="animation-delay:' + (i * 0.1) + 's" onclick="window.openJobTrendDrawer(\'' + j.name + '\',\'emerging\')">' +
            '<div class="trend-job-card-head">' +
                '<div class="trend-job-card-name">' + j.name + '</div>' +
                '<div class="trend-job-card-signal strong-up">🔥 ' + j.signal + '</div>' +
            '</div>' +
            '<div>' +
                '<div class="trend-job-card-growth up">+' + j.growth.toFixed(1) + '%</div>' +
                '<div class="trend-job-card-growth-label">需求增长</div>' +
            '</div>' +
            '<div class="trend-job-card-trend">' +
                '<div class="trend-job-card-trend-label"><span>趋势指数</span><span class="val">' + j.trendIndex + '</span></div>' +
                '<div class="trend-job-card-trend-bar"><div class="trend-job-card-trend-bar-fill emerging" data-width="' + j.trendIndex + '" style="width:0"></div></div>' +
            '</div>' +
            '<div class="trend-job-card-skills">' + j.skills.map(function(s) { return '<span class="trend-job-skill-tag emerging">' + s + '</span>'; }).join('') + '</div>' +
            '<div class="trend-job-card-reason">' + j.reason + '</div>' +
            '<div class="trend-job-card-cta emerging">VIEW TREND <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>' +
            '</div>';
    }).join('');
};

// ── Render Declining Jobs ──
window.renderDecliningJobs = function() {
    var container = document.getElementById('declining-cards');
    if (!container) return;
    var avg = window.calculateTrendAverage();
    var statEl = document.getElementById('declining-avg-stat');
    if (statEl) statEl.textContent = '↓ -' + avg.decliningAvg.toFixed(1) + '%';

    container.innerHTML = window.decliningJobsMockData.map(function(j, i) {
        return '<div class="trend-job-card declining anim-fade-up" style="animation-delay:' + (i * 0.1) + 's" onclick="window.openJobTrendDrawer(\'' + j.name + '\',\'declining\')">' +
            '<div class="trend-job-card-head">' +
                '<div class="trend-job-card-name">' + j.name + '</div>' +
                '<div class="trend-job-card-signal strong-down">⚠ ' + j.signal + '</div>' +
            '</div>' +
            '<div>' +
                '<div class="trend-job-card-growth down">' + j.decline.toFixed(1) + '%</div>' +
                '<div class="trend-job-card-growth-label">需求变化</div>' +
            '</div>' +
            '<div class="trend-job-card-trend">' +
                '<div class="trend-job-card-trend-label"><span>趋势风险</span><span class="val">' + j.riskIndex + '</span></div>' +
                '<div class="trend-job-card-trend-bar"><div class="trend-job-card-trend-bar-fill declining" data-width="' + j.riskIndex + '" style="width:0"></div></div>' +
            '</div>' +
            '<div class="trend-job-card-skills">' + j.skills.map(function(s) { return '<span class="trend-job-skill-tag declining">' + s + '</span>'; }).join('') + '</div>' +
            '<div class="trend-job-card-reason">' + j.reason + '</div>' +
            '<div class="trend-job-card-cta declining">VIEW TREND <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>' +
            '</div>';
    }).join('');
};

// ── Animate Trend Bars ──
window.animateTrendBars = function() {
    var bars = document.querySelectorAll('.trend-job-card-trend-bar-fill[data-width]');
    bars.forEach(function(bar) {
        var target = parseInt(bar.getAttribute('data-width'));
        if (window.gsap) {
            window.gsap.to(bar, { width: target + '%', duration: 0.8, ease: 'power2.out', delay: 0.15 });
        } else {
            bar.style.width = target + '%';
        }
    });
};

// ── Init Phase 3 ──
window.initTrendJobsPhase3 = function() {
    window.renderEmergingJobs();
    window.renderDecliningJobs();
    // Animate bars after a short delay for DOM render
    setTimeout(function() { window.animateTrendBars(); }, 200);
};

// ── Drawer: Open ──
window.openJobTrendDrawer = function(name, type) {
    var job = null;
    if (type === 'emerging') {
        job = window.emergingJobsMockData.find(function(j) { return j.name === name; });
    } else {
        job = window.decliningJobsMockData.find(function(j) { return j.name === name; });
    }
    if (!job) return;

    var isEmerging = type === 'emerging';
    var growthVal = isEmerging ? ('+' + job.growth.toFixed(1) + '%') : (job.decline.toFixed(1) + '%');
    var indexVal = isEmerging ? job.trendIndex : job.riskIndex;
    var indexLabel = isEmerging ? '趋势指数' : '趋势风险';
    var judgmentText = isEmerging
        ? '未来12个月预计保持较高增长，企业需求持续扩大。建议关注相关技能培养。'
        : '未来12个月预计需求继续收缩，岗位面临结构性调整。建议关注技能转型路径。';
    var aiTipText = isEmerging
        ? '重点关注：Agent架构、LLM应用、RAG、工具调用等快速增长方向。'
        : '重点关注：技能升级、跨领域迁移、新兴岗位转型机会。';

    var content = '<button class="trend-drawer-close" onclick="window.closeJobTrendDrawer()">× CLOSE</button>' +
        '<div class="trend-drawer-hero">' +
            '<div class="trend-drawer-job-name">' + job.name + '</div>' +
            '<div class="trend-drawer-job-en">' + job.name + ' · ' + (isEmerging ? 'EMERGING' : 'DECLINING') + '</div>' +
            '<div class="trend-drawer-signal ' + type + '">' + (isEmerging ? '🔥 ' : '⚠ ') + job.signal + '</div>' +
        '</div>' +
        '<div class="trend-drawer-metrics">' +
            '<div class="trend-drawer-metric">' +
                '<div class="trend-drawer-metric-val ' + type + '">' + growthVal + '</div>' +
                '<div class="trend-drawer-metric-label">' + (isEmerging ? '需求增长' : '需求变化') + '</div>' +
            '</div>' +
            '<div class="trend-drawer-metric">' +
                '<div class="trend-drawer-metric-val">' + indexVal + '<span style="font-size:14px;color:var(--text-muted)">/100</span></div>' +
                '<div class="trend-drawer-metric-label">' + indexLabel + '</div>' +
            '</div>' +
        '</div>' +
        '<div class="trend-drawer-section">' +
            '<div class="trend-drawer-section-title">核心技能</div>' +
            '<div class="trend-drawer-skills">' + job.skills.map(function(s) { return '<span class="trend-drawer-skill-tag ' + type + '">' + s + '</span>'; }).join('') + '</div>' +
        '</div>' +
        '<div class="trend-drawer-section">' +
            '<div class="trend-drawer-section-title">趋势驱动因素</div>' +
            '<div class="trend-drawer-reason ' + type + '">' + job.reason + '</div>' +
        '</div>' +
        '<div class="trend-drawer-section">' +
            '<div class="trend-drawer-section-title">趋势判断</div>' +
            '<div class="trend-drawer-judgment ' + type + '">' + judgmentText + '</div>' +
        '</div>' +
        '<div class="trend-drawer-ai-tip">' +
            '<div class="ai-label">AI 建议</div>' +
            aiTipText +
        '</div>';

    var drawerContent = document.getElementById('trend-drawer-content');
    if (drawerContent) drawerContent.innerHTML = content;

    var overlay = document.getElementById('trend-drawer-overlay');
    var panel = document.getElementById('trend-drawer-panel');

    if (window.gsap) {
        if (overlay) { overlay.classList.add('open'); window.gsap.to(overlay, { opacity: 1, duration: 0.3 }); }
        if (panel) { panel.classList.add('open'); window.gsap.to(panel, { x: 0, duration: 0.35, ease: 'power3.out' }); }
    } else {
        if (overlay) overlay.classList.add('open');
        if (panel) panel.classList.add('open');
    }
};

// ── Drawer: Close ──
window.closeJobTrendDrawer = function() {
    var overlay = document.getElementById('trend-drawer-overlay');
    var panel = document.getElementById('trend-drawer-panel');

    if (window.gsap) {
        if (panel) {
            window.gsap.to(panel, { x: '100%', duration: 0.3, ease: 'power3.in', onComplete: function() {
                panel.classList.remove('open');
            }});
        }
        if (overlay) {
            window.gsap.to(overlay, { opacity: 0, duration: 0.3, onComplete: function() {
                overlay.classList.remove('open');
            }});
        }
    } else {
        if (panel) panel.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    }
};

// ============== Trend Analysis Phase 4 - Career Transition & Skill Evolution ==============
window.trendGraphInstances = window.trendGraphInstances || {};

// ── Mock Data (preserved from original; do NOT modify) ──
window.transitionMockData = {
    nodes: [
        { id: "data_analyst",  label: "传统数据分析师",   type: "traditional",  sub: "TRADITIONAL JOB" },
        { id: "python",        label: "Python",            type: "skill",        sub: "SKILL" },
        { id: "ml",            label: "机器学习",          type: "skill",        sub: "SKILL" },
        { id: "ai_analysis",   label: "AI辅助分析",        type: "augmentation", sub: "AI AUGMENTATION" },
        { id: "rag",           label: "RAG",               type: "skill",        sub: "SKILL" },
        { id: "ai_data_analyst", label: "AI增强数据分析师", type: "emerging",     sub: "EMERGING JOB" },
        { id: "ops",           label: "传统运维工程师",    type: "traditional",  sub: "TRADITIONAL JOB" },
        { id: "cloud",         label: "云平台",            type: "skill",        sub: "SKILL" },
        { id: "automation",    label: "自动化运维",        type: "augmentation", sub: "AI AUGMENTATION" },
        { id: "aiops",         label: "AIOps工程师",       type: "emerging",     sub: "EMERGING JOB" },
        { id: "tester",        label: "传统测试工程师",    type: "traditional",  sub: "TRADITIONAL JOB" },
        { id: "auto_test",     label: "自动化测试",        type: "skill",        sub: "SKILL" },
        { id: "ai_test",       label: "AI测试",            type: "augmentation", sub: "AI AUGMENTATION" },
        { id: "ai_quality",    label: "AI质量工程师",      type: "emerging",     sub: "EMERGING JOB" }
    ],
    edges: [
        { source: "data_analyst", target: "python",       label: "技能升级" },
        { source: "python",       target: "ml",           label: "能力扩展" },
        { source: "ml",           target: "ai_analysis",  label: "AI增强" },
        { source: "ai_analysis",  target: "rag",          label: "能力融合" },
        { source: "rag",          target: "ai_data_analyst", label: "岗位升级" },
        { source: "ops",          target: "cloud",        label: "技术迁移" },
        { source: "cloud",        target: "automation",   label: "自动化" },
        { source: "automation",   target: "aiops",        label: "智能化" },
        { source: "tester",       target: "auto_test",    label: "自动化" },
        { source: "auto_test",    target: "ai_test",      label: "AI增强" },
        { source: "ai_test",      target: "ai_quality",   label: "岗位升级" }
    ]
};

// ── Career Transition Display Data ──
// Transforms transitionMockData into job→job paths with skill annotations
window.buildCareerTransitionData = function(rawData) {
    rawData = rawData || window.transitionMockData;
    var nodes = rawData.nodes;
    var edges = rawData.edges;

    // Build adjacency maps
    var adj = {}; // source -> [target]
    var skillMap = {};
    nodes.forEach(function(n) {
        if (n.type === 'skill') skillMap[n.id] = n;
    });

    edges.forEach(function(e) {
        if (!adj[e.source]) adj[e.source] = [];
        adj[e.source].push(e.target);
    });

    // Find traditional→emerging paths
    var traditionalNodes = nodes.filter(function(n) { return n.type === 'traditional'; });
    var emergingNodes = nodes.filter(function(n) { return n.type === 'emerging'; });

    // Build path definitions
    var paths = [
        {
            id: 'path_data',
            from: 'data_analyst',
            to: 'ai_data_analyst',
            fromLabel: '传统数据分析师',
            toLabel: 'AI增强数据分析师',
            category: 'data',
            transitionScore: 92,
            growthRate: 38,
            skillChanges: 4,
            newSkills: ['Python', 'Machine Learning', 'LLM', 'RAG'],
            retainSkills: ['SQL', 'Excel', '统计学', '数据可视化'],
            readiness: 68,
            difficulty: 'MEDIUM',
            trend: 'high',
            reason: 'AI工具逐渐进入数据分析工作流，岗位从传统数据处理向AI增强分析转型。大模型和RAG技术正在重新定义数据分析师的工作方式。',
            suggestion: '优先补充 Python 编程能力、LLM应用开发、RAG架构理解、AI数据分析工具（如Copilot、ChatGPT Advanced Data Analysis）'
        },
        {
            id: 'path_ops',
            from: 'ops',
            to: 'aiops',
            fromLabel: '传统运维工程师',
            toLabel: 'AIOps工程师',
            category: 'ops',
            transitionScore: 88,
            growthRate: 34,
            skillChanges: 3,
            newSkills: ['Cloud Platform', 'Automation', 'AI Operations'],
            retainSkills: ['Linux', '网络管理', 'Shell脚本', '监控'],
            readiness: 62,
            difficulty: 'MEDIUM',
            trend: 'high',
            reason: '云原生架构全面普及，传统手工运维正在被AIOps智能运维平台替代。自动化+AI驱动的事件响应成为新常态。',
            suggestion: '重点学习云平台（AWS/Azure/阿里云）、基础设施即代码（Terraform）、AI驱动运维工具（Datadog AI、PagerDuty AIOps）'
        },
        {
            id: 'path_test',
            from: 'tester',
            to: 'ai_quality',
            fromLabel: '传统测试工程师',
            toLabel: 'AI质量工程师',
            category: 'tech',
            transitionScore: 84,
            growthRate: 29,
            skillChanges: 3,
            newSkills: ['自动化测试框架', 'AI测试策略', 'LLM评估'],
            retainSkills: ['测试用例设计', '缺陷管理', '测试流程', '回归测试'],
            readiness: 56,
            difficulty: 'HIGH',
            trend: 'medium',
            reason: 'AI系统测试与传统软件测试有本质区别——需要评估模型行为的不确定性、偏见和幻觉问题。测试工程师需要掌握全新的评估方法论。',
            suggestion: '学习AI模型评估框架（如DeepEval、LangSmith）、Prompt测试技术、自动化测试平台（Selenium+AI增强）'
        },
        {
            id: 'path_ops2',
            from: 'ops',
            to: 'ai_quality',
            fromLabel: '传统运维工程师',
            toLabel: 'AI质量工程师',
            category: 'tech',
            transitionScore: 72,
            growthRate: 18,
            skillChanges: 4,
            newSkills: ['自动化测试', '性能工程', 'AI可靠性', '混沌工程'],
            retainSkills: ['系统架构', '故障排查', '性能调优', 'Shell'],
            readiness: 45,
            difficulty: 'HIGH',
            trend: 'medium',
            reason: '运维工程师的系统可靠性经验可迁移至AI系统的质量保障和可靠性工程，但需要补足测试方法论和AI评估能力。',
            suggestion: '从SRE转向AI可靠性工程，学习混沌工程、AI性能基准测试、ML模型监控工具'
        }
    ];

    return { paths: paths, rawNodes: nodes, rawEdges: edges };
};

// Cache for display data
window.careerDisplayData = null;
window.careerActivePathId = null;
window.careerActiveFilter = 'all';

window.getCareerDisplayData = function() {
    if (!window.careerDisplayData) {
        window.careerDisplayData = window.buildCareerTransitionData();
    }
    return window.careerDisplayData;
};

// ── G6: Build graph config ──
window.buildCareerGraphConfig = function(displayData) {
    var paths = displayData.paths;
    var filterCat = window.careerActiveFilter;

    var filteredPaths = paths;
    if (filterCat !== 'all') {
        filteredPaths = paths.filter(function(p) { return p.category === filterCat; });
    }
    if (!filteredPaths.length) filteredPaths = paths;

    // Build G6 nodes: only job nodes (traditional + emerging)
    var nodeMap = {};
    var g6Nodes = [];
    var g6Edges = [];

    filteredPaths.forEach(function(p) {
        // Traditional node
        if (!nodeMap[p.from]) {
            nodeMap[p.from] = true;
            var score = p.transitionScore;
            var w = score >= 88 ? 170 : (score >= 80 ? 155 : 140);
            g6Nodes.push({
                id: p.from,
                label: p.fromLabel,
                type: 'rect',
                size: [w, 52],
                style: {
                    fill: '#1e3a5f', stroke: '#3b5998', lineWidth: 1.5,
                    shadowColor: 'rgba(59,89,152,0.3)', shadowBlur: 8,
                    radius: 8
                },
                labelCfg: {
                    style: { fill: '#c4d0e8', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans,Noto Sans SC', textAlign: 'center' },
                    position: 'bottom', offset: 8
                },
                _careerType: 'traditional',
                _category: p.category
            });
        }
        // Emerging node
        if (!nodeMap[p.to]) {
            nodeMap[p.to] = true;
            var escore = p.transitionScore;
            var ew = escore >= 88 ? 180 : (escore >= 80 ? 165 : 150);
            g6Nodes.push({
                id: p.to,
                label: p.toLabel,
                type: 'rect',
                size: [ew, 56],
                style: {
                    fill: '#0a3d34', stroke: '#2DD4BF', lineWidth: 2,
                    shadowColor: 'rgba(45,212,191,0.45)', shadowBlur: 14,
                    radius: 8
                },
                labelCfg: {
                    style: { fill: '#b3ece3', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans,Noto Sans SC', textAlign: 'center' },
                    position: 'bottom', offset: 8
                },
                _careerType: 'emerging',
                _category: p.category
            });
        }
        // Edge: job → job with skill capsules + score
        var edgeAlpha = p.transitionScore >= 88 ? 0.6 : (p.transitionScore >= 80 ? 0.4 : 0.28);
        var edgeWidth = p.transitionScore >= 88 ? 2.5 : (p.transitionScore >= 80 ? 2 : 1.5);
        var skillLabel = p.newSkills.join(' · ');
        g6Edges.push({
            source: p.from,
            target: p.to,
            label: '迁移潜力 ' + p.transitionScore + '\n' + skillLabel,
            style: {
                stroke: 'rgba(139,92,246,' + edgeAlpha + ')',
                lineWidth: edgeWidth,
                endArrow: { path: G6.Arrow.triangle(8, 10, 0), fill: 'rgba(45,212,191,0.7)' },
                shadowColor: 'rgba(139,92,246,0.15)',
                shadowBlur: 6
            },
            labelCfg: {
                style: {
                    fill: 'rgba(255,255,255,0.65)',
                    fontSize: 9,
                    fontFamily: 'DM Sans,Noto Sans SC',
                    background: { fill: 'rgba(10,18,32,0.88)', padding: [3, 6], radius: 4 }
                },
                autoRotate: false,
                refY: -8
            },
            _pathId: p.id,
            _pathData: p
        });
    });

    var container = document.getElementById('career-graph-container');
    var cw = container ? container.offsetWidth : 700;
    var ch = container ? container.offsetHeight : 520;

    return {
        container: 'career-graph-container',
        width: cw,
        height: ch,
        fitView: true,
        fitViewPadding: 30,
        layout: { type: 'dagre', rankdir: 'LR', nodesep: 50, ranksep: 150, controlPoints: true },
        defaultNode: { type: 'rect', labelCfg: { position: 'bottom', offset: 8 } },
        defaultEdge: { type: 'polyline', style: { stroke: 'rgba(139,92,246,0.35)', lineWidth: 1.5, endArrow: true } },
        modes: { default: ['drag-canvas', 'zoom-canvas'] },
        nodeStateStyles: { hover: { lineWidth: 3, shadowBlur: 24 }, inactive: { opacity: 0.22 } },
        edgeStateStyles: { hover: { stroke: 'rgba(45,212,191,0.7)', lineWidth: 3.5 }, inactive: { opacity: 0.06 } },
        // Internal arrays for G6 data()
        _nodes: g6Nodes,
        _edges: g6Edges
    };
};

// ── Init Career Transition Graph ──
window.initCareerTransitionGraph = function() {
    var container = document.getElementById('career-graph-container');
    if (!container) return;

    // Dispose existing
    var existing = window.trendGraphInstances.careerTransition;
    if (existing) {
        try { existing.destroy(); } catch(e) {}
        window.trendGraphInstances.careerTransition = null;
    }

    var displayData = window.getCareerDisplayData();
    var cfg = window.buildCareerGraphConfig(displayData);
    var graph = new G6.Graph(cfg);
    graph.data({ nodes: cfg._nodes, edges: cfg._edges });
    graph.render();

    setTimeout(function() {
        try { graph.fitView(30); } catch(e) {}
    }, 250);

    // ── Hover: highlight connected ──
    graph.on('node:mouseenter', function(e) {
        var item = e.item;
        graph.getNodes().forEach(function(n) { graph.setItemState(n, 'inactive', true); });
        graph.getEdges().forEach(function(ed) { graph.setItemState(ed, 'inactive', true); });
        graph.setItemState(item, 'inactive', false);
        item.getNeighbors().forEach(function(n) { graph.setItemState(n, 'inactive', false); });
        item.getEdges().forEach(function(ed) { graph.setItemState(ed, 'inactive', false); });
        graph.paint();
    });
    graph.on('node:mouseleave', function() {
        graph.getNodes().forEach(function(n) { graph.setItemState(n, 'inactive', false); });
        graph.getEdges().forEach(function(ed) { graph.setItemState(ed, 'inactive', false); });
        graph.paint();
    });

    // ── Edge hover ──
    graph.on('edge:mouseenter', function(e) {
        var edge = e.item;
        var model = edge.getModel();
        graph.getEdges().forEach(function(ed) { graph.setItemState(ed, 'inactive', true); });
        graph.getNodes().forEach(function(n) { graph.setItemState(n, 'inactive', true); });
        graph.setItemState(edge, 'inactive', false);
        // Activate source + target nodes
        var srcNode = graph.findById(model.source);
        var tgtNode = graph.findById(model.target);
        if (srcNode) { graph.setItemState(srcNode, 'inactive', false); }
        if (tgtNode) { graph.setItemState(tgtNode, 'inactive', false); }
        graph.paint();
    });
    graph.on('edge:mouseleave', function() {
        graph.getNodes().forEach(function(n) { graph.setItemState(n, 'inactive', false); });
        graph.getEdges().forEach(function(ed) { graph.setItemState(ed, 'inactive', false); });
        graph.paint();
    });

    // ── Edge click: show detail ──
    graph.on('edge:click', function(e) {
        var model = e.item.getModel();
        if (model._pathData) {
            window.showCareerTransitionDetail(model._pathData);
            window.highlightCareerPath(model._pathId);
        }
    });

    // ── Node click: find connecting edge ──
    graph.on('node:click', function(e) {
        var model = e.item.getModel();
        var allEdges = cfg._edges;
        var matchingEdge = null;
        for (var i = 0; i < allEdges.length; i++) {
            if (allEdges[i].source === model.id || allEdges[i].target === model.id) {
                matchingEdge = allEdges[i];
                break;
            }
        }
        if (matchingEdge && matchingEdge._pathData) {
            window.showCareerTransitionDetail(matchingEdge._pathData);
            window.highlightCareerPath(matchingEdge._pathId);
        }
    });

    window.trendGraphInstances.careerTransition = graph;
    return graph;
};

// ── Highlight a specific path in the graph ──
window.highlightCareerPath = function(pathId) {
    var graph = window.trendGraphInstances.careerTransition;
    if (!graph || graph.destroyed) return;

    window.careerActivePathId = pathId;

    graph.getEdges().forEach(function(ed) {
        var m = ed.getModel();
        if (m._pathId === pathId) {
            graph.setItemState(ed, 'inactive', false);
            graph.updateItem(ed, {
                style: { stroke: 'rgba(45,212,191,0.85)', lineWidth: 3.5, shadowColor: 'rgba(45,212,191,0.5)', shadowBlur: 16 }
            });
        } else {
            graph.setItemState(ed, 'inactive', true);
        }
    });
    graph.getNodes().forEach(function(n) {
        var m = n.getModel();
        var edges = graph.getEdges();
        var connected = false;
        edges.forEach(function(ed) {
            var em = ed.getModel();
            if (em._pathId === pathId && (em.source === m.id || em.target === m.id)) {
                connected = true;
            }
        });
        graph.setItemState(n, 'inactive', !connected);
    });
    graph.paint();
};

// ── Reset all highlights ──
window.resetCareerHighlight = function() {
    var graph = window.trendGraphInstances.careerTransition;
    if (!graph || graph.destroyed) return;
    window.careerActivePathId = null;
    graph.getNodes().forEach(function(n) { graph.setItemState(n, 'inactive', false); });
    graph.getEdges().forEach(function(ed) {
        graph.setItemState(ed, 'inactive', false);
        var m = ed.getModel();
        var alpha = m._pathData ? (m._pathData.transitionScore >= 88 ? 0.6 : (m._pathData.transitionScore >= 80 ? 0.4 : 0.28)) : 0.35;
        graph.updateItem(ed, {
            style: { stroke: 'rgba(139,92,246,' + alpha + ')', lineWidth: m._pathData && m._pathData.transitionScore >= 88 ? 2.5 : 2, shadowBlur: 6 }
        });
    });
    graph.paint();
};

// ── Filter by category ──
window.filterCareerCategory = function(cat, btnEl) {
    window.careerActiveFilter = cat;
    window.careerDisplayData = null; // invalidate cache so paths are re-filtered

    // Update tab active states
    document.querySelectorAll('.trend-career-filter-tab').forEach(function(t) { t.classList.remove('active'); });
    if (btnEl) btnEl.classList.add('active');

    // Rebuild graph
    window.initCareerTransitionGraph();

    // Reset detail
    window.resetCareerDetail();
};

// ── Show career transition detail in right panel ──
window.showCareerTransitionDetail = function(pathData) {
    var emptyEl = document.getElementById('career-detail-empty');
    var innerEl = document.getElementById('career-detail-inner');
    if (emptyEl) emptyEl.style.display = 'none';
    if (innerEl) innerEl.style.display = 'flex';

    var trendTag = pathData.trend === 'high'
        ? '<span class="trend-career-path-trend high">↑ HIGH POTENTIAL</span>'
        : '<span class="trend-career-path-trend medium">→ 稳定迁移</span>';

    var diffMap = { LOW: { color: '#2DD4BF', label: 'LOW · 低难度' }, MEDIUM: { color: '#f59e0b', label: 'MEDIUM · 中等难度' }, HIGH: { color: '#f97316', label: 'HIGH · 高难度' } };
    var diffInfo = diffMap[pathData.difficulty] || diffMap.MEDIUM;

    var newSkillsHtml = pathData.newSkills.map(function(s) {
        return '<span class="trend-career-new-skill-tag">' + s + '</span>';
    }).join('');

    var retainSkillsHtml = pathData.retainSkills.map(function(s) {
        return '<span class="trend-career-skill-retain-tag">' + s + '</span>';
    }).join('');
    var newSkillsHtml2 = pathData.newSkills.map(function(s) {
        return '<span class="trend-career-skill-new-tag">' + s + '</span>';
    }).join('');

    var html = '<div class="trend-career-path-header">' +
        '<div class="trend-career-path-label">CAREER TRANSITION</div>' +
        '<div class="trend-career-path-row">' +
            '<span class="trend-career-path-from">' + pathData.fromLabel + '</span>' +
            '<span class="trend-career-path-arrow">→</span>' +
            '<span class="trend-career-path-to">' + pathData.toLabel + '</span>' +
        '</div>' +
        trendTag +
    '</div>' +

    '<div class="trend-career-metrics">' +
        '<div class="trend-career-metric"><div class="trend-career-metric-val potential-high">' + pathData.transitionScore + '<span style="font-size:12px;opacity:.6">/100</span></div><div class="trend-career-metric-label">迁移潜力</div></div>' +
        '<div class="trend-career-metric"><div class="trend-career-metric-val growth">+' + pathData.growthRate + '%</div><div class="trend-career-metric-label">需求变化</div></div>' +
        '<div class="trend-career-metric"><div class="trend-career-metric-val skill-count">+' + pathData.skillChanges + '</div><div class="trend-career-metric-label">技能变化</div></div>' +
        '<div class="trend-career-metric"><div class="trend-career-metric-val difficulty" style="color:' + diffInfo.color + ';font-size:14px">' + diffInfo.label + '</div><div class="trend-career-metric-label">迁移难度</div></div>' +
    '</div>' +

    '<div style="border-top:1px solid rgba(255,255,255,.05);padding-top:10px">' +
        '<div class="trend-career-metric-label" style="margin-bottom:6px">需要补充的核心技能</div>' +
        '<div class="trend-career-new-skills">' + newSkillsHtml + '</div>' +
    '</div>' +

    '<div>' +
        '<div class="trend-career-metric-label" style="margin-bottom:6px">SKILL TRANSITION · 技能迁移</div>' +
        '<div class="trend-career-skill-cols">' +
            '<div class="trend-career-skill-col"><div class="trend-career-skill-col-title">保留能力</div><div class="trend-career-skill-col-tags">' + retainSkillsHtml + '</div></div>' +
            '<div class="trend-career-skill-col"><div class="trend-career-skill-col-title">新增能力</div><div class="trend-career-skill-col-tags">' + newSkillsHtml2 + '</div></div>' +
        '</div>' +
    '</div>' +

    '<div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
            '<div class="trend-career-metric-label">SKILL READINESS · 技能准备度</div>' +
            '<span style="font-size:13px;font-weight:700;color:#8b5cf6;font-family:var(--font-mono)">' + pathData.readiness + '%</span>' +
        '</div>' +
        '<div class="trend-career-readiness-bar"><div class="trend-career-readiness-fill" style="width:' + pathData.readiness + '%"></div></div>' +
    '</div>' +

    '<div class="trend-career-reason"><span style="color:rgba(255,255,255,.3);font-family:var(--font-mono);font-size:9px">迁移原因</span><br>' + pathData.reason + '</div>' +
    '<div class="trend-career-suggestion"><span style="color:rgba(45,212,191,.5);font-family:var(--font-mono);font-size:9px">迁移建议</span><br>' + pathData.suggestion + '</div>';

    if (innerEl) {
        innerEl.innerHTML = html;
        // GSAP entrance
        if (window.gsap) {
            innerEl.style.opacity = '0';
            innerEl.style.transform = 'translateX(12px)';
            window.gsap.to(innerEl, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' });
        }
    }
};

// ── Reset detail panel to empty ──
window.resetCareerDetail = function() {
    var emptyEl = document.getElementById('career-detail-empty');
    var innerEl = document.getElementById('career-detail-inner');
    if (emptyEl) emptyEl.style.display = 'flex';
    if (innerEl) { innerEl.style.display = 'none'; innerEl.innerHTML = ''; }
    window.resetCareerHighlight();
};

// ── Render hot transitions list ──
window.renderHotTransitions = function() {
    var displayData = window.getCareerDisplayData();
    var paths = displayData.paths;
    var hotList = document.getElementById('career-hot-list');
    if (!hotList) return;

    var topPaths = paths.slice().sort(function(a, b) { return b.transitionScore - a.transitionScore; }).slice(0, 4);

    hotList.innerHTML = topPaths.map(function(p, i) {
        return '<button class="trend-career-hot-item" onclick="window.clickHotTransition(\'' + p.id + '\')">' +
            '<span class="trend-career-hot-item-num">0' + (i + 1) + '</span>' +
            p.fromLabel +
            '<span class="trend-career-hot-item-arrow">→</span>' +
            p.toLabel +
            '<span class="trend-career-hot-item-pct">+' + p.growthRate + '%</span>' +
            '</button>';
    }).join('');

    // Update stats
    var highCount = paths.filter(function(p) { return p.transitionScore >= 85; }).length;
    var totalSkills = paths.reduce(function(s, p) { return s + p.skillChanges; }, 0);
    var elHigh = document.getElementById('cs-high');
    var elPaths = document.getElementById('cs-paths');
    var elSkills = document.getElementById('cs-skills');
    if (elHigh) elHigh.textContent = highCount;
    if (elPaths) elPaths.textContent = paths.length;
    if (elSkills) elSkills.textContent = totalSkills;

    var fp = document.getElementById('career-footer-paths');
    var fs = document.getElementById('career-footer-shifts');
    var fh = document.getElementById('career-footer-high');
    if (fp) fp.textContent = paths.length + ' 条主要迁移路径';
    if (fs) fs.textContent = totalSkills + ' 项技能变化';
    if (fh) fh.textContent = highCount + ' 个高潜力迁移方向';
};

// ── Click hot transition ──
window.clickHotTransition = function(pathId) {
    var displayData = window.getCareerDisplayData();
    var path = null;
    for (var i = 0; i < displayData.paths.length; i++) {
        if (displayData.paths[i].id === pathId) { path = displayData.paths[i]; break; }
    }
    if (!path) return;
    window.showCareerTransitionDetail(path);
    window.highlightCareerPath(pathId);
};

// ── Resize ──
window.resizeCareerTransitionGraph = function() {
    var graph = window.trendGraphInstances.careerTransition;
    if (!graph || graph.destroyed) return;
    var container = document.getElementById('career-graph-container');
    if (!container) return;
    try {
        graph.changeSize(container.offsetWidth, container.offsetHeight || 520);
        graph.fitView(30);
    } catch(e) {}
};

// ── Dispose ──
window.disposeCareerTransitionGraph = function() {
    var graph = window.trendGraphInstances.careerTransition;
    if (graph) {
        try { graph.destroy(); } catch(e) {}
        window.trendGraphInstances.careerTransition = null;
    }
    window.careerDisplayData = null;
    window.careerActivePathId = null;
};

// ── Init Phase 4 ──
window.initTransitionPhase4 = function() {
    window.careerDisplayData = null;
    window.initCareerTransitionGraph();
    window.renderHotTransitions();
    window.resetCareerDetail();
};

// Backward compat: reuse same resize/dispose hooks
window.resizeTransitionGraph = function() { window.resizeCareerTransitionGraph(); };
window.disposeTransitionGraph = function() { window.disposeCareerTransitionGraph(); };

// ============== Trend Analysis Phase 5 - Future Trend Forecast ==============

// ── Mock Data ──
window.forecastMockData = {
    timeline: ["当前","+3个月","+6个月","+9个月","+12个月","+15个月","+18个月"],
    jobs: [
        { name: "AI Agent工程师",    type: "emerging",  values: [72,76,81,85,89,92,95], confidence: 91, growth: "+31.9%", reason: "Agent应用与企业自动化需求持续增长" },
        { name: "大模型应用工程师",  type: "emerging",  values: [68,73,78,82,86,89,92], confidence: 88, growth: "+35.3%", reason: "企业AI应用落地持续扩大" },
        { name: "具身智能工程师",   type: "emerging",  values: [58,63,69,74,79,84,88], confidence: 82, growth: "+51.7%", reason: "机器人与AI融合加速" },
        { name: "传统数据分析师",    type: "stable",    values: [65,66,66,67,67,68,68], confidence: 79, growth: "+4.6%",  reason: "岗位整体稳定，但技能结构持续升级" },
        { name: "传统数据录入员",    type: "declining", values: [42,38,35,31,28,25,22], confidence: 87, growth: "-47.6%", reason: "自动化、OCR与AI工具持续替代标准化工作" }
    ]
};

// ── Forecast level helper ──
window.getForecastLevel = function(score) {
    if (score >= 85) return { label: '高增长潜力', cls: 'high' };
    if (score >= 70) return { label: '持续增长',   cls: 'stable' };
    if (score >= 50) return { label: '相对稳定',   cls: 'stable' };
    return { label: '需求收缩', cls: 'low' };
};

// ── Color map ──
window.getForecastColor = function(type) {
    var map = { emerging: '#2DD4BF', stable: '#3b82f6', declining: '#f97316' };
    return map[type] || '#94A3B8';
};

// ── Build chart option ──
window.buildForecastOption = function(months) {
    var d = window.forecastMockData;
    var fullTimeline = d.timeline;
    var sliceIdx = months === 6 ? 3 : months === 12 ? 5 : 7;
    var timeline = fullTimeline.slice(0, sliceIdx);
    var currentIdx = 0; // "当前" is at index 0

    var series = d.jobs.map(function(j) {
        var vals = j.values.slice(0, sliceIdx);
        var color = window.getForecastColor(j.type);
        var histData = vals.slice(0, currentIdx + 1);
        var predData = new Array(currentIdx + 1).fill(null);
        var predRaw = vals.slice(currentIdx + 1);
        predRaw.forEach(function(v, i) { predData.push(v); });

        return [
            // Historical (solid)
            {
                name: j.name,
                type: 'line',
                data: histData.concat(new Array(sliceIdx - histData.length).fill(null)),
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { color: color, width: 2.5 },
                itemStyle: { color: color },
                emphasis: { focus: 'series', lineStyle: { width: 4 } }
            },
            // Forecast (dashed)
            {
                name: j.name + ' (预测)',
                type: 'line',
                data: predData,
                smooth: true,
                symbol: 'diamond',
                symbolSize: 7,
                lineStyle: { color: color, width: 2.5, type: 'dashed' },
                itemStyle: { color: color },
                emphasis: { focus: 'series', lineStyle: { width: 4 } }
            }
        ];
    }).flat();

    return {
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255,255,255,0.96)',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            borderRadius: 12,
            padding: [12, 14],
            textStyle: { color: '#0f172a', fontSize: 12 },
            extraCssText: 'box-shadow: 0 8px 32px rgba(11,18,32,.12);',
            formatter: function(params) {
                if (!params || params.length === 0) return '';
                var items = params.filter(function(p) { return p.value !== null && p.value !== undefined; });
                if (items.length === 0) return '';
                var p = items[0];
                var job = d.jobs.find(function(j) { return j.name === p.seriesName.replace(' (预测)',''); });
                var level = job ? window.getForecastLevel(job.values[sliceIdx - 1]) : { label: '' };
                var isPred = p.seriesName.indexOf('预测') > -1;
                return '<div style="font-family:\'DM Sans\',\'Noto Sans SC\',sans-serif;min-width:180px">' +
                    '<div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px">' + p.seriesName.replace(' (预测)','') + '</div>' +
                    '<div style="font-size:11px;color:#64748B;margin-bottom:6px">未来 +' + p.axisValue.replace('+','').replace('个月','') + ' 个月' + (isPred ? ' (预测)' : '') + '</div>' +
                    '<div style="display:flex;gap:16px;margin-bottom:4px">' +
                        '<div><span style="font-size:10px;color:#64748B">趋势指数</span><br><span style="font-size:16px;font-weight:700;color:#0f172a">' + p.value + '</span></div>' +
                        (job ? '<div><span style="font-size:10px;color:#64748B">预测增长</span><br><span style="font-size:14px;font-weight:700;color:' + (job.type === 'declining' ? '#ea580c' : '#0D9488') + '">' + job.growth + '</span></div>' : '') +
                    '</div>' +
                    '<div style="display:flex;gap:12px;font-size:11px;color:#64748B">' +
                        (job ? '<span>置信度 <b>' + job.confidence + '%</b></span>' : '') +
                        '<span>趋势 <b style="color:' + (level.cls === 'low' ? '#f97316' : level.cls === 'high' ? '#2DD4BF' : '#3b82f6') + '">' + level.label + '</b></span>' +
                    '</div>' +
                    '</div>';
            }
        },
        legend: {
            bottom: 0,
            textStyle: { color: '#475569', fontSize: 11 },
            itemWidth: 16,
            itemHeight: 2,
            selectedMode: true
        },
        grid: { left: 52, right: 30, top: 30, bottom: 40 },
        xAxis: {
            type: 'category',
            data: timeline,
            axisLabel: { color: '#475569', fontSize: 11, fontWeight: 500 },
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisTick: { show: false },
            splitLine: { show: false }
        },
        yAxis: {
            type: 'value',
            name: '趋势指数',
            min: 0,
            max: 100,
            nameTextStyle: { color: '#64748B', fontSize: 11 },
            axisLabel: { color: '#64748B', fontSize: 10, fontFamily: 'var(--font-mono)' },
            splitLine: { lineStyle: { color: '#f1f3f9', type: 'dashed', width: 0.5 } }
        },
        series: series,
        animationDuration: 1200,
        animationEasing: 'cubicOut'
    };
};

// ── Build Rank List ──
window.renderForecastRankList = function(months) {
    var d = window.forecastMockData;
    var sliceIdx = months === 6 ? 3 : months === 12 ? 5 : 7;
    var ranked = d.jobs
        .map(function(j) { return { name: j.name, value: j.values[sliceIdx - 1], growth: j.growth, conf: j.confidence, type: j.type }; })
        .sort(function(a, b) { return b.value - a.value; })
        .slice(0, 3);
    var container = document.getElementById('forecast-rank-list');
    if (!container) return;
    container.innerHTML = ranked.map(function(r, i) {
        var numClass = i === 0 ? 'top1' : i === 1 ? 'top2' : 'top3';
        var isNeg = r.growth.indexOf('-') === 0;
        return '<div class="trend-forecast-rank-item" data-job="' + r.name + '" onclick="window.highlightForecastJob(\'' + r.name + '\')">' +
            '<div class="trend-forecast-rank-top">' +
                '<span class="trend-forecast-rank-num ' + numClass + '">' + (i + 1).toString().padStart(2, '0') + '</span>' +
                '<span class="trend-forecast-rank-name">' + r.name + '</span>' +
            '</div>' +
            '<div class="trend-forecast-rank-meta">' +
                '<span>趋势 <b>' + r.value + '</b></span>' +
                '<span class="trend-forecast-rank-growth' + (isNeg ? ' negative' : '') + '">' + r.growth + '</span>' +
                '<span class="trend-forecast-rank-conf">' + r.conf + '%</span>' +
            '</div>' +
            '</div>';
    }).join('');
};

// ── Highlight a single job's trend line ──
window.highlightForecastJob = function(jobName) {
    var chart = window.trendChartInstances.forecast;
    if (!chart) return;
    // Toggle highlight
    var current = chart.getOption();
    var series = current.series || [];
    var isAlreadyHighlighted = series.some(function(s) {
        return s.name === jobName && s.lineStyle && s.lineStyle.width > 3;
    });
    var newSeries = series.map(function(s) {
        var baseName = s.name.replace(' (预测)', '');
        if (baseName === jobName) {
            return { name: s.name, lineStyle: { width: isAlreadyHighlighted ? 2.5 : 4, type: s.lineStyle ? s.lineStyle.type : 'solid' }, emphasis: { focus: 'series' } };
        } else {
            return { name: s.name, lineStyle: { width: isAlreadyHighlighted ? 2.5 : 1, opacity: isAlreadyHighlighted ? 1 : 0.2, type: s.lineStyle ? s.lineStyle.type : 'solid' } };
        }
    });
    chart.setOption({ series: newSeries }, false);
    // Toggle active state in rank list
    document.querySelectorAll('.trend-forecast-rank-item').forEach(function(el) {
        el.classList.toggle('active', el.getAttribute('data-job') === jobName && !isAlreadyHighlighted);
    });
};

// ── Init Forecast Chart ──
window.initForecastChart = function(months) {
    var dom = document.getElementById('chart-forecast-trend');
    if (!dom) return;
    months = months || 18;
    var existing = window.trendChartInstances.forecast;
    if (existing) {
        existing.setOption(window.buildForecastOption(months), true);
        existing.resize();
    } else {
        var chart = echarts.init(dom);
        chart.setOption(window.buildForecastOption(months));
        window.trendChartInstances.forecast = chart;
        // Legend click clears highlight
        chart.on('legendselectchanged', function() {
            document.querySelectorAll('.trend-forecast-rank-item').forEach(function(el) { el.classList.remove('active'); });
        });
    }
    window.renderForecastRankList(months);
};

// ── Switch forecast period ──
window.switchForecastPeriod = function(months) {
    document.querySelectorAll('.trend-forecast-period-btn').forEach(function(btn) {
        btn.classList.toggle('active', parseInt(btn.getAttribute('data-months')) === months);
    });
    window.initForecastChart(months);
    document.querySelectorAll('.trend-forecast-rank-item').forEach(function(el) { el.classList.remove('active'); });
};

// ── Resize ──
window.resizeForecastChart = function() {
    var chart = window.trendChartInstances.forecast;
    if (chart && !chart.isDisposed()) {
        try { chart.resize(); } catch(e) {}
    }
};

// ── Dispose ──
window.disposeForecastChart = function() {
    var chart = window.trendChartInstances.forecast;
    if (chart) {
        try { chart.dispose(); } catch(e) {}
        window.trendChartInstances.forecast = null;
    }
};

// ── Init Phase 5 ──
window.initForecastPhase5 = function() {
    window.initForecastChart(18);
    // Bind period buttons
    document.querySelectorAll('.trend-forecast-period-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            window.switchForecastPeriod(parseInt(btn.getAttribute('data-months')));
        });
    });
};

// ── Phase 6: AI Trend Intelligence ──

// Mock AI analysis data — API-ready structure
window.aiInsightCache = null;

window.calculateAITrendMetrics = function() {
    var metrics = {};

    // Gather from lifecycleMockData (Phase 2)
    var life = window.lifecycleMockData || [];
    metrics.totalJobs = life.length;
    var statusCount = { emerging: 0, growing: 0, stable: 0, declining: 0 };
    life.forEach(function(j) {
        if (statusCount[j.status] !== undefined) statusCount[j.status]++;
    });
    metrics.statusCount = statusCount;
    metrics.emergingRatio = metrics.totalJobs ? Math.round(statusCount.emerging / metrics.totalJobs * 100) : 0;
    metrics.decliningRatio = metrics.totalJobs ? Math.round(statusCount.declining / metrics.totalJobs * 100) : 0;

    // Gather from emergingJobsMockData (Phase 3)
    var emerging = window.emergingJobsMockData || [];
    metrics.emergingAvgGrowth = emerging.length ? Math.round(emerging.reduce(function(s, j) { return s + (j.growthRate || j.trendValue || 0); }, 0) / emerging.length) : 0;
    metrics.topEmergingJob = emerging[0] ? emerging[0].name : '—';

    // Gather from decliningJobsMockData (Phase 3)
    var declining = window.decliningJobsMockData || [];
    metrics.decliningAvgDrop = declining.length ? Math.round(declining.reduce(function(s, j) { return s + Math.abs(j.growthRate || j.trendValue || 0); }, 0) / declining.length) : 0;
    metrics.topDecliningJob = declining[0] ? declining[0].name : '—';

    // Gather from transitionMockData (Phase 4)
    var trans = window.transitionMockData || {};
    var nodes = trans.nodes || [];
    var edges = trans.edges || [];
    metrics.transitionPaths = edges.length;
    metrics.skillNodes = nodes.filter(function(n) { return (n.type || n.group) === 'skill'; }).length;
    metrics.jobNodes = nodes.filter(function(n) { return (n.type || n.group) !== 'skill'; }).length;

    // Gather from forecastMockData (Phase 5)
    var fc = window.forecastMockData || [];
    if (fc.length) {
        var latestMonth = 18;
        var forecastEnd = fc[0].data ? fc[0].data[fc[0].data.length - 1].value : 0;
        metrics.forecastHeadroom = fc.reduce(function(s, job) {
            if (!job.data) return s;
            var hist = 0, fut = 0;
            job.data.forEach(function(pt) {
                if (pt.month <= 6) hist = pt.value;
                if (pt.month === 18) fut = pt.value;
            });
            return s + (fut - hist);
        }, 0);
        metrics.forecastJobsTracked = fc.length;
        metrics.forecastPosCount = fc.filter(function(j) {
            if (!j.data) return false;
            return j.data[j.data.length - 1].value > j.data[0].value;
        }).length;
    } else {
        metrics.forecastHeadroom = 0;
        metrics.forecastJobsTracked = 0;
        metrics.forecastPosCount = 0;
    }

    // Composite AI score (0-100)
    var score = 50;
    score += metrics.emergingRatio * 0.4;
    score -= metrics.decliningRatio * 0.3;
    score += Math.min(metrics.emergingAvgGrowth, 40) * 0.3;
    score += Math.min(metrics.forecastHeadroom / 10, 10);
    score += metrics.forecastPosCount * 1.5;
    metrics.compositeScore = Math.max(5, Math.min(95, Math.round(score)));

    // Confidence (0-100)
    var dataRichness = metrics.totalJobs + metrics.forecastJobsTracked + nodes.length;
    metrics.confidence = Math.min(95, Math.round(60 + dataRichness * 0.8));

    // Trend verdict
    if (metrics.compositeScore >= 65) metrics.verdict = 'positive';
    else if (metrics.compositeScore >= 40) metrics.verdict = 'neutral';
    else metrics.verdict = 'cautious';

    return metrics;
};

window.generateAITrendInsight = function() {
    if (window.aiInsightCache) return window.aiInsightCache;

    var m = window.calculateAITrendMetrics();

    var insight = {
        score: m.compositeScore,
        confidence: m.confidence,
        verdict: m.verdict,
        verdictLabel: m.verdict === 'positive' ? '积极趋势' : (m.verdict === 'neutral' ? '温和观望' : '谨慎关注'),
        timestamp: new Date().toLocaleString('zh-CN', { hour12: false }),

        // Section 01: Market Shift
        marketShift: '当前人才市场正处于数字化转型深化期。' +
            '在监测的 ' + m.totalJobs + ' 个核心岗位中，' +
            '约 ' + m.emergingRatio + '% 处于上升通道（如' + m.topEmergingJob + '等），' +
            '约 ' + m.decliningRatio + '% 面临结构性衰退压力（如' + m.topDecliningJob + '等）。' +
            '整体来看，技术驱动型岗位需求强劲，AI/数据/云计算相关岗位保持年均 ' + m.emergingAvgGrowth + '% 左右的增速。' +
            '传统职能岗位则加速向数字化复合型方向演化，技能迁移路径中已识别 ' + m.transitionPaths + ' 条关键转型通路。' +
            '市场呈现"冰火两重天"格局——新兴产业人才供不应求，传统岗位需加速技能升级以应对结构性替代风险。',

        // Section 02: Driving factors
        factors: [
            { icon: '🧠', title: 'AI与大模型技术爆发', desc: '大语言模型及生成式AI的指数级渗透正从根本上重塑岗位需求结构，Prompt工程、AI训练师等新岗位快速涌现' },
            { icon: '☁️', title: '云原生与数字化加速', desc: '企业上云率突破60%，DevOps、云架构师等岗位需求持续走高，传统运维向SRE/平台工程方向加速转型' },
            { icon: '📊', title: '数据驱动决策深化', desc: '数据工程师、数据分析师需求年增25%+，企业从"经验决策"向"数据决策"范式转变，数据素养成为基础能力' },
            { icon: '🔄', title: '产业升级政策推动', desc: '智能制造、新能源、数字经济等国家战略推动相关领域人才需求激增，政策红利加速产业链人才结构重塑' },
        ],

        // Section 03: Future outlook
        outlook: '展望未来12-18个月，人才市场将继续沿着"技术深化 × 产业融合"双主线演进。' +
            '短期内（3-6个月），' + m.topEmergingJob + '等热门岗位的供需缺口将进一步扩大，预计企业招聘成本上升15-20%。' +
            '中期来看（6-12个月），技能交叉型岗位（如AI产品经理、数据合规官）将成为增速最快的新品类。' +
            '长期看（12-18个月），传统岗位约有30-40%将完成技能升级转型，岗位边界日趋模糊。' +
            '未来18个月综合净增岗位预计为正面，' + m.forecastPosCount + '/' + m.forecastJobsTracked + ' 个被追踪岗位处于上升趋势。' +
            '但结构性失业风险不可忽视——技能迭代速度将成为个人与企业竞争力的核心分水岭。',

        // Section 04: Recommendations
        recommendations: [
            { title: '优先布局新兴技术赛道', hint: '重点关注AI/大模型、云原生、数据工程三大高增长方向，建立内部人才培养管道' },
            { title: '加速传统岗位技能升级', hint: '针对' + m.topDecliningJob + '等衰退岗位，制定6-12个月技能转型计划，对接迁移路径' },
            { title: '建立动态人才预警机制', hint: '持续追踪岗位生命周期变化，设置供需失衡、技能缺口等关键指标的预警阈值' },
            { title: '投资交叉技能培养', hint: '推动"技术+业务"、"开发+运维"等复合能力建设，提升组织适应性与人才流动性' },
        ],

        // Signals (right panel)
        signals: [
            { icon: 'growth', name: '新兴岗位强劲增长', level: 'HIGH', levelClass: 'high',
              detail: m.topEmergingJob + '等岗位年增速' + m.emergingAvgGrowth + '%+，供不应求态势持续' },
            { icon: 'decline', name: '传统岗位加速衰退', level: 'MEDIUM', levelClass: 'medium',
              detail: m.topDecliningJob + '等岗位年降幅' + m.decliningAvgDrop + '%，需关注结构性失业' },
            { icon: 'skill', name: '技能迁移路径清晰', level: 'HIGH', levelClass: 'high',
              detail: '已识别' + m.transitionPaths + '条关键转型通路，覆盖' + m.skillNodes + '个核心技能域' },
            { icon: 'forecast', name: '未来趋势总体向上', level: 'MEDIUM', levelClass: 'medium',
              detail: m.forecastPosCount + '/' + m.forecastJobsTracked + '追踪岗位处上升通道，净增预期正面' },
        ],

        // Top opportunities
        opportunities: (window.emergingJobsMockData || []).slice(0, 3).map(function(j, i) {
            return { rank: i + 1, name: j.name, value: '+' + (j.growthRate || j.trendValue || '—') + '%' };
        }),

        // Top risks
        risks: (window.decliningJobsMockData || []).slice(0, 3).map(function(j, i) {
            return { rank: i + 1, name: j.name, value: (j.growthRate || j.trendValue || '—') + '%' };
        }),

        // Analysis basis
        basis: [
            { label: '生命周期数据', detail: m.totalJobs + '个核心岗位全周期追踪' },
            { label: '迁移网络', detail: m.jobNodes + '节点 / ' + m.transitionPaths + '边技能演化图谱' },
            { label: '趋势预测', detail: m.forecastJobsTracked + '岗位18个月滚动预测' },
            { label: '数据置信度', detail: '综合置信度 ' + m.confidence + '%' },
        ],
    };

    window.aiInsightCache = insight;
    return insight;
};

// ── Rendering functions ──

window.renderAITrendInsight = function() {
    var insight = window.generateAITrendInsight();

    // Score ring
    var circle = document.getElementById('ai-score-circle');
    if (circle) {
        var circumference = 2 * Math.PI * 28; // ~175.93
        var dashLen = (insight.score / 100) * circumference;
        circle.setAttribute('stroke-dasharray', dashLen + ' ' + (circumference - dashLen));
    }
    var scoreNum = document.getElementById('ai-score-num');
    if (scoreNum) scoreNum.textContent = insight.score;
    var scoreBadge = document.getElementById('ai-score-badge');
    if (scoreBadge) scoreBadge.textContent = insight.verdictLabel;

    // Market shift
    var marketEl = document.getElementById('ai-content-market');
    if (marketEl) marketEl.textContent = insight.marketShift;

    // Driving factors
    var factorsGrid = document.getElementById('ai-factors-grid');
    if (factorsGrid && insight.factors) {
        factorsGrid.innerHTML = insight.factors.map(function(f) {
            return '<div class="trend-ai-factor-card"><div class="trend-ai-factor-icon">' + f.icon +
                '</div><div class="trend-ai-factor-title">' + f.title +
                '</div><div class="trend-ai-factor-desc">' + f.desc + '</div></div>';
        }).join('');
    }

    // Outlook
    var outlookEl = document.getElementById('ai-content-outlook');
    if (outlookEl) outlookEl.textContent = insight.outlook;

    // Recommendations
    var stepsList = document.getElementById('ai-steps-list');
    if (stepsList && insight.recommendations) {
        stepsList.innerHTML = insight.recommendations.map(function(r, i) {
            return '<div class="trend-ai-step"><div class="trend-ai-step-num">' + (i + 1) +
                '</div><div class="trend-ai-step-content"><div class="trend-ai-step-title">' + r.title +
                '</div><div class="trend-ai-step-hint">' + r.hint +
                '</div></div><span class="trend-ai-step-arrow">→</span></div>';
        }).join('');
    }

    // Signals
    var signalCards = document.getElementById('ai-signal-cards');
    if (signalCards && insight.signals) {
        signalCards.innerHTML = insight.signals.map(function(s) {
            return '<div class="trend-ai-signal-card"><div class="trend-ai-signal-icon ' + s.icon +
                '">' + ({ growth: '📈', decline: '📉', skill: '🔗', forecast: '🔮' })[s.icon] +
                '</div><div class="trend-ai-signal-info"><div class="trend-ai-signal-name">' + s.name +
                '</div><span class="trend-ai-signal-level ' + s.levelClass + '">' + s.level +
                '</span></div></div>';
        }).join('');
    }

    // Confidence
    var confNum = document.getElementById('ai-conf-num');
    if (confNum) confNum.innerHTML = insight.confidence + '<span class="trend-ai-conf-sub">%</span>';
    var confBar = document.getElementById('ai-conf-bar-fill');
    if (confBar) {
        setTimeout(function() { confBar.style.width = insight.confidence + '%'; }, 200);
    }

    // Top opportunities
    var oppEl = document.getElementById('ai-top-opportunities');
    if (oppEl && insight.opportunities) {
        oppEl.innerHTML = insight.opportunities.map(function(o) {
            return '<div class="trend-ai-top-item"><span class="trend-ai-top-rank">0' + o.rank +
                '</span><span class="trend-ai-top-name">' + o.name +
                '</span><span class="trend-ai-top-val" style="color:#2DD4BF">' + o.value + '</span></div>';
        }).join('');
    }

    // Top risks
    var riskEl = document.getElementById('ai-top-risks');
    if (riskEl && insight.risks) {
        riskEl.innerHTML = insight.risks.map(function(r) {
            return '<div class="trend-ai-top-item"><span class="trend-ai-top-rank risk">0' + r.rank +
                '</span><span class="trend-ai-top-name">' + r.name +
                '</span><span class="trend-ai-top-val" style="color:#f97316">' + r.value + '</span></div>';
        }).join('');
    }

    // Analysis basis
    var basisEl = document.getElementById('ai-basis-list');
    if (basisEl && insight.basis) {
        basisEl.innerHTML = insight.basis.map(function(b) {
            return '<div class="trend-ai-basis-item"><span style="color:#2DD4BF">▪</span><span>' +
                b.label + '：' + b.detail + '</span></div>';
        }).join('');
    }

    // Meta
    var tsEl = document.getElementById('ai-meta-timestamp');
    if (tsEl) tsEl.textContent = 'Generated: ' + insight.timestamp;
};

// ── Accordion toggle ──
window.toggleInsightSection = function(sectionId) {
    var body = document.getElementById('ai-body-' + sectionId);
    var arrow = document.getElementById('ai-arrow-' + sectionId);

    if (!body) return;

    var isOpen = body.style.height && body.style.height !== '0px';
    var inner = body.querySelector('.trend-ai-section-body-inner');

    if (isOpen) {
        // Collapse
        if (window.gsap) {
            window.gsap.to(body, { height: 0, duration: 0.3, ease: 'power2.inOut' });
        } else {
            body.style.height = '0px';
        }
        if (arrow) arrow.classList.remove('open');
    } else {
        // Expand
        var targetHeight = inner ? inner.scrollHeight : 200;
        if (window.gsap) {
            window.gsap.to(body, { height: targetHeight, duration: 0.35, ease: 'power2.inOut' });
        } else {
            body.style.height = targetHeight + 'px';
        }
        if (arrow) arrow.classList.add('open');
    }
};

// ── Regenerate ──
window.regenerateAIInsight = function() {
    // Clear cache
    window.aiInsightCache = null;

    // Flash feedback
    var btn = document.querySelector('.trend-ai-btn');
    if (btn) {
        btn.style.borderColor = 'rgba(45,212,191,.5)';
        btn.style.color = '#2DD4BF';
        setTimeout(function() {
            btn.style.borderColor = 'rgba(255,255,255,.12)';
            btn.style.color = 'rgba(255,255,255,.5)';
        }, 600);
    }

    // Update timestamp
    var tsEl = document.getElementById('ai-meta-timestamp');
    if (tsEl) tsEl.textContent = 'Regenerating...';

    // Slight delay for UX feedback, then re-render
    var self = this;
    setTimeout(function() {
        window.aiInsightCache = null;
        window.renderAITrendInsight();

        // Re-animate elements
        var animEls = document.querySelectorAll('.trend-ai-anim');
        animEls.forEach(function(el) {
            el.style.opacity = '0';
            el.style.transform = 'translateY(14px)';
            setTimeout(function() {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, 50);
        });

        // Re-open first section, close others
        ['market', 'factors', 'outlook', 'recommend'].forEach(function(id, idx) {
            var body = document.getElementById('ai-body-' + id);
            var arrow = document.getElementById('ai-arrow-' + id);
            if (idx === 0) {
                var inner = body ? body.querySelector('.trend-ai-section-body-inner') : null;
                if (body && inner) { body.style.height = inner.scrollHeight + 'px'; }
                if (arrow) arrow.classList.add('open');
            } else {
                if (body) body.style.height = '0px';
                if (arrow) arrow.classList.remove('open');
            }
        });
    }, 400);
};

// ── Entrance animations ──
window.animateAIEntrance = function() {
    var animEls = document.querySelectorAll('.trend-ai-anim');
    if (!animEls.length) return;

    if (window.gsap) {
        window.gsap.fromTo(animEls,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out',
              onComplete: function() {
                  // Open first accordion section after entrance
                  var body = document.getElementById('ai-body-market');
                  var arrow = document.getElementById('ai-arrow-market');
                  if (body) {
                      var inner = body.querySelector('.trend-ai-section-body-inner');
                      if (inner) { body.style.height = inner.scrollHeight + 'px'; }
                  }
                  if (arrow) arrow.classList.add('open');
              }
            });
    } else {
        animEls.forEach(function(el, i) {
            setTimeout(function() {
                el.style.transition = 'opacity .4s ease, transform .4s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, i * 80);
        });
        // Open first section
        setTimeout(function() {
            var body = document.getElementById('ai-body-market');
            var arrow = document.getElementById('ai-arrow-market');
            if (body) {
                var inner = body.querySelector('.trend-ai-section-body-inner');
                if (inner) { body.style.height = inner.scrollHeight + 'px'; }
            }
            if (arrow) arrow.classList.add('open');
        }, animEls.length * 80 + 50);
    }
};

// ── Init Phase 6 ──
window.initAIPhase6 = function() {
    window.aiInsightCache = null;
    window.renderAITrendInsight();

    // Set initial accordion states (all closed, to be animated open)
    ['market', 'factors', 'outlook', 'recommend'].forEach(function(id) {
        var body = document.getElementById('ai-body-' + id);
        if (body) body.style.height = '0px';
    });

    // Run entrance animations
    setTimeout(function() {
        window.animateAIEntrance();
    }, 200);
};

// ── Time slider ──
window.onTrendSlider = function(){
    window.trendTimeIdx = parseInt(document.getElementById('trend-time-slider').value);
    document.getElementById('slider-now').textContent = '● '+window.TREND.quarters[window.trendTimeIdx];
};

// ── Playback ──
window.toggleTrendPlay = function(){
    var btn = document.getElementById('trend-play-btn');
    if(window.trendPlaying){
        window.trendPlaying=false;clearTimeout(window.trendTimer);
        btn.classList.remove('playing');btn.textContent='▶ 趋势演化';return;
    }
    window.trendPlaying=true;btn.classList.add('playing');btn.textContent='■ 停止';
    window.trendTimeIdx=0;document.getElementById('trend-time-slider').value=0;window.onTrendSlider();
    window._trendStep();
};
window._trendStep = function(){
    if(!window.trendPlaying)return;
    document.getElementById('trend-time-slider').value=window.trendTimeIdx;window.onTrendSlider();
    if(window.trendTimeIdx<9){window.trendTimeIdx++;window.trendTimer=setTimeout(window._trendStep,800);}
    else{window.trendPlaying=false;var btn=document.getElementById('trend-play-btn');btn.classList.remove('playing');btn.textContent='▶ 趋势演化';}
};

// ── Drawer (real implementation) ──
window.openTrendDrawer = async function() {
    document.getElementById('trend-drawer-backdrop').classList.add('open');
    document.getElementById('trend-drawer').classList.add('open');
    var drawerContent = document.getElementById('drawer-insight-content');
    var drawerSummary = document.getElementById('drawer-summary');

    // Show loading
    drawerContent.innerHTML = '<span style="color:var(--text-muted)">正在加载 AI 分析...</span>';
    drawerSummary.innerHTML = '';

    // Fetch insight if not already loaded
    if (!window.trendDataState.insight || window.trendDataState.insight.data_source === 'default') {
        var API = (window.API_BASE || ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') ? 'http://127.0.0.1:5000' : location.origin));
        try {
            var resp = await fetch(API+'/api/trends/ai-insight');
            var data = await resp.json();
            if (data.code === 0) window.trendDataState.insight = data.data;
        } catch(e) {}
    }

    var ins = window.trendDataState.insight;
    if (ins) {
        drawerContent.innerHTML =
            '<div class="headline">' + (ins.headline || '趋势分析') + '</div>' +
            (ins.insights || []).map(function(i) {
                var icon = i.category === 'rising' ? '📈' : i.category === 'declining' ? '📉' : i.category === 'opportunity' ? '💡' : '⚠️';
                return '<div class="insight-item">' + icon + ' <b>' + i.text + '</b> <span style="color:var(--text-muted)">(置信度:' + (i.confidence || 0) + '%)</span></div>';
            }).join('');
        drawerSummary.innerHTML = '<p>' + (ins.summary || '') + '</p>';
    } else {
        drawerContent.innerHTML = '<div class="headline">趋势预测依据</div>' +
            '<div class="insight-item">📈 AI Agent相关岗位需求持续增长，同比增长38.6%</div>' +
            '<div class="insight-item">📉 传统大数据技能(Hadoop等)加速被Spark/Flink替代</div>' +
            '<div class="insight-item">💡 跨域融合岗位(AI+安全、AI+芯片)将大量涌现</div>' +
            '<div class="insight-item">⚠️ 部分传统开发岗位增速放缓，需关注技能升级</div>';
        drawerSummary.innerHTML = '<p>基于12,452条岗位数据的趋势分析。数据范围：2026年7月。</p>';
    }
};

window.closeTrendDrawer = function() {
    document.getElementById('trend-drawer-backdrop').classList.remove('open');
    document.getElementById('trend-drawer').classList.remove('open');
};


