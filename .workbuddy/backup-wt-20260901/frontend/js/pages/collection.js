// ============== Collection View ==============
window._sourceColors = ['#0D9488','#2DD4BF','#10b981','#f59e0b','#8B5CF6','#EC4899','#F97316','#06B6D4','#84CC16','#E11D48'];
window.initCollection = function() {
    const grid = document.getElementById('source-grid');
    if (!grid) return;
    // Fetch real data from backend
    const apiBase = window.API_BASE || ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') ? 'http://127.0.0.1:5000' : location.origin);
    fetch(apiBase + '/api/collection/sources')
        .then(r => r.json())
        .then(resp => {
            const sources = (resp.data || []).map((s, i) => ({
                name: s.name || 'unknown',
                color: window._sourceColors[i % window._sourceColors.length],
                short: (s.name || '??').substring(0, 4).toUpperCase(),
                desc: s.description || (s.total_count + ' 条岗位记录'),
                today: s.today_count || 0,
                success: s.success_rate || 0,
                latency: '-',
                status: 'running',
                statusText: s.active_count + ' 条活跃'
            }));
            if (sources.length === 0) {
                grid.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)">暂无数据源，请先启动爬虫采集数据</div>';
                return;
            }
            // Render cards
            grid.innerHTML = sources.map((s, i) => `
                <div class="source-card anim-fade-up" style="animation-delay:${i*0.05}s" onclick="window.openSourceDetail('${s.name}')">
                    <div class="source-head"><div class="source-icon" style="background:${s.color}">${s.short}</div><div class="status-pill ${s.status}"><span class="dot"></span>${s.statusText}</div></div>
                    <div class="source-name">${s.name}</div>
                    <div class="source-desc">${s.desc}</div>
                    <div class="source-stats"><div><div class="source-stat-val">${s.today.toLocaleString()}</div><div class="source-stat-label">总采集量</div></div><div><div class="source-stat-val">${s.success}%</div><div class="source-stat-label">完整度</div></div><div><div class="source-stat-val">${s.latency}</div><div class="source-stat-label">状态</div></div></div>
                    <div class="source-foot"><button class="btn" onclick="event.stopPropagation()">刷新</button><button class="btn" onclick="event.stopPropagation();window.openSourceDetail('${s.name}', 'config')">配置</button><button class="btn btn-primary" onclick="event.stopPropagation();window.openSourceDetail('${s.name}', 'logs')">详情</button></div>
                </div>
            `).join('');

            // Update KPI cards
            const total = sources.reduce((a,b) => a+b.today, 0);
            const collectTotal = document.getElementById('collect-total');
            if (collectTotal) collectTotal.textContent = total.toLocaleString();
            const collectKpi = document.querySelector('#view-collection .kpi-card.k2 .kpi-value');
            if (collectKpi) {
                collectKpi.dataset.val = '0';
                window.Utils && window.Utils.animateNum && window.Utils.animateNum(collectKpi, total, 1000);
            }
            // Update source count KPI
            const sourceCntKpi = document.querySelector('#view-collection .kpi-card.k1 .kpi-value');
            if (sourceCntKpi) {
                sourceCntKpi.innerHTML = sources.length + '<span class="kpi-unit">个</span>';
            }
            const qualityKpi = document.querySelector('#view-collection .kpi-card.k3 .kpi-value');
            if (qualityKpi) {
                const avgQ = sources.length ? (sources.reduce((a,b) => a+b.success, 0) / sources.length).toFixed(1) : '0';
                qualityKpi.innerHTML = avgQ + '<span class="kpi-unit">%</span>';
            }

            // Chart
            window.disposeChart('chart-collect');
            window.chartInstances['chart-collect'] = window.safeChart('chart-collect');
            const showSources = sources.slice(0, 8);
            window.chartInstances['chart-collect'].setOption({
                ...window.baseChartOpt(),
                legend:{data:showSources.map(s=>s.name), top:0, textStyle:{color:'#475569',fontSize:10}},
                xAxis:{type:'category',data:['总量'],axisLabel:{color:'#475569',fontSize:11},axisLine:{lineStyle:{color:'#e2e8f0'}}},
                yAxis:{type:'value',axisLabel:{color:'#475569',fontSize:11},splitLine:{lineStyle:{color:'#f1f3f9'}}},
                series: showSources.map((s,i) => ({
                    name:s.name, type:'bar', stack:'a', barWidth:40,
                    itemStyle:{color:window._sourceColors[i % window._sourceColors.length]},
                    data:[s.today]
                }))
            });
        })
        .catch(() => {
            grid.innerHTML = '<div style="text-align:center;padding:60px;color:var(--accent-coral)">无法连接后端，请确认服务已启动</div>';
        });

    // Fetch summary
    fetch(apiBase + '/api/collection/summary')
        .then(r => r.json())
        .then(resp => {
            const d = resp.data || {};
            const miniEl = document.getElementById('mini-collect');
            if (miniEl && d.total_collected) miniEl.textContent = d.total_collected.toLocaleString();
        }).catch(() => {});

    // Log (real summary)
    const logEl = document.getElementById('collect-log');
    if (logEl) {
        logEl.innerHTML = [
            ['--:--','INFO','正在从数据库加载采集统计...',''],
            ['--:--','INFO','数据源详情请点击卡片查看',''],
        ].map(([t,l,m,c]) => `<div style="color:${c==='mint'?'var(--accent-mint)':c==='amber'?'var(--accent-amber)':c==='coral'?'var(--accent-coral)':'var(--text-dark-secondary)'}">[${t}] [${l}] ${m}</div>`).join('');

        fetch(apiBase + '/api/collection/summary')
            .then(r => r.json())
            .then(resp => {
                const d = resp.data || {};
                const fresh = d.freshness || {};
                const logs = [
                    ['NOW','INFO','数据库连接成功 · ' + (d.total_collected || 0).toLocaleString() + ' 条岗位记录','mint'],
                    ['NOW','INFO','数据源: ' + (d.source_count || 0) + ' 个 · 覆盖 ' + (d.city_count || 0) + ' 城 · ' + (d.company_count || 0) + ' 企',''],
                    ['NOW','INFO','数据新鲜度: 近7天 ' + (fresh.fresh || 0) + ' 条 · 7-30天 ' + (fresh.aging || 0) + ' 条 · 30天+ ' + (fresh.stale || 0) + ' 条',''],
                    ['NOW','INFO','平均完整度: ' + (d.avg_quality_score || 0) + '%','mint'],
                ];
                if (logEl) logEl.innerHTML = logs.map(([t,l,m,c]) => `<div style="color:${c==='mint'?'var(--accent-mint)':c==='amber'?'var(--accent-amber)':c==='coral'?'var(--accent-coral)':'var(--text-dark-secondary)'}">[${t}] [${l}] ${m}</div>`).join('');
            }).catch(() => {});
    }
};

// ============== Source Detail Page ==============
window.sourceDetailData = {
    '拉勾网': {
        color:'#0D9488', short:'LG', desc:'互联网/AI/产品岗位 · 技术岗位权威源',
        config: {
            '爬虫类型': 'Scrapy + Selenium',
            '入口URL': 'https://www.lagou.com/wn/jobs',
            '请求间隔': '2-5秒（随机）',
            '并发数': '8',
            '代理池': 'scrapy-rotating-proxies · 50个',
            'Cookie策略': '自动登录 + 持久化',
            '反爬处理': 'User-Agent轮换 + Referer伪造',
            '存储格式': 'JSON + MySQL',
            '调度周期': '每30分钟',
            '数据保留': '90天'
        },
        logs: [
            {t:'14:23:12', l:'SUCCESS', m:'爬取任务完成 · 共 4,287 条', dur:'8m 24s'},
            {t:'14:18:33', l:'INFO', m:'启动爬虫 · 普通模式', dur:'0.1s'},
            {t:'14:15:42', l:'INFO', m:'检查代理池 · 48/50 可用', dur:'1.2s'},
            {t:'14:12:18', l:'INFO', m:'开始抓取列表页 · 共 215 页', dur:'0s'},
            {t:'14:11:55', l:'WARN', m:'第 187 页加载慢 · 切换代理', dur:'3.2s'},
            {t:'14:08:32', l:'INFO', m:'入库 MySQL · 1,247 条', dur:'4.1s'},
            {t:'14:05:14', l:'INFO', m:'NER 抽取 · 5,124 个实体', dur:'6.8s'},
            {t:'13:58:00', l:'INFO', m:'ETL 标准化 · 完成', dur:'2.3s'},
            {t:'13:45:21', l:'SUCCESS', m:'上一批次 · 4,124 条', dur:'7m 51s'},
            {t:'13:30:11', l:'INFO', m:'健康检查 · 通过', dur:'0.5s'}
        ]
    },
    'BOSS直聘': {
        color:'#2DD4BF', short:'BOSS', desc:'全行业岗位 · 实时招聘数据 · Playwright动态渲染',
        config: {
            '爬虫类型': 'Playwright (Chromium)',
            '入口URL': 'https://www.zhipin.com/web/geek/job',
            '请求间隔': '3-7秒（随机）',
            '并发数': '4',
            '代理池': '高质量住宅代理 · 35个',
            '登录方式': '扫码 + Cookie池',
            '反爬处理': '浏览器指纹伪装 + 行为模拟',
            '存储格式': 'JSON + MySQL',
            '调度周期': '每15分钟',
            '数据保留': '60天'
        },
        logs: [
            {t:'14:23:08', l:'INFO', m:'处理第 1247 页 · Playwright渲染', dur:'2.4s'},
            {t:'14:21:55', l:'SUCCESS', m:'完成第 1246 页', dur:'2.1s'},
            {t:'14:18:33', l:'INFO', m:'启动 Chromium · 隐身模式', dur:'3.2s'},
            {t:'14:15:42', l:'INFO', m:'生成新指纹 · 完成', dur:'0.8s'},
            {t:'14:12:18', l:'WARN', m:'触发验证码 · 切换代理中', dur:'5.4s'},
            {t:'14:08:32', l:'INFO', m:'解析 DOM · 1,287 个职位', dur:'1.9s'},
            {t:'14:05:14', l:'INFO', m:'提取详情页 · 字段标准化', dur:'3.5s'},
            {t:'13:58:00', l:'INFO', m:'数据写入 · MySQL 3,548 条', dur:'5.1s'},
            {t:'13:45:21', l:'SUCCESS', m:'上一批次完成', dur:'12m 18s'},
            {t:'13:30:11', l:'ERROR', m:'Cookie失效 · 重新登录', dur:'8.2s'}
        ]
    },
    '智联招聘': {
        color:'#10b981', short:'ZL', desc:'传统行业+互联网 · 校招/社招全覆盖',
        config: {
            '爬虫类型': 'Scrapy + Requests',
            '入口URL': 'https://sou.zhaopin.com/',
            '请求间隔': '1-3秒（随机）',
            '并发数': '10',
            '代理池': '数据中心代理 · 45个',
            '登录方式': '无（公开数据）',
            '反爬处理': 'UA轮换 + IP轮换',
            '存储格式': 'JSON + MySQL',
            '调度周期': '每60分钟',
            '数据保留': '180天'
        },
        logs: [
            {t:'14:22:56', l:'WARN', m:'触发反爬 · 切换代理', dur:'2.1s'},
            {t:'14:20:33', l:'SUCCESS', m:'批次完成 · 2,983 条', dur:'15m 22s'},
            {t:'14:18:14', l:'INFO', m:'过滤重复 · 删除 124 条', dur:'0.6s'},
            {t:'14:15:42', l:'INFO', m:'质量评分 · 通过 1,247 / 1,289', dur:'1.8s'},
            {t:'14:12:18', l:'INFO', m:'开始抓取列表页', dur:'0s'},
            {t:'14:08:32', l:'INFO', m:'入库 · 字段标准化', dur:'3.4s'},
            {t:'14:05:14', l:'INFO', m:'NER 实体抽取 · 8,124 个', dur:'8.9s'},
            {t:'13:58:00', l:'INFO', m:'ETL 转换', dur:'1.5s'},
            {t:'13:45:21', l:'SUCCESS', m:'上一批次 · 2,854 条', dur:'14m 18s'},
            {t:'13:30:11', l:'INFO', m:'健康检查 · 通过', dur:'0.3s'}
        ]
    },
    '脉脉': {
        color:'#f59e0b', short:'MM', desc:'中高端岗位 · 行业评论 · 薪资数据',
        config: {
            '爬虫类型': 'Playwright (Firefox)',
            '入口URL': 'https://maimai.cn/feed/news',
            '请求间隔': '5-10秒（保守）',
            '并发数': '2',
            '代理池': '高质量代理 · 15个',
            '登录方式': '手机号+验证码',
            '反爬处理': '慢速 + 行为模拟',
            '存储格式': 'JSON + MongoDB',
            '调度周期': '每120分钟',
            '数据保留': '90天'
        },
        logs: [
            {t:'14:22:18', l:'ERROR', m:'登录失败 · 验证码错误 · 已暂停', dur:'8.5s'},
            {t:'14:18:33', l:'WARN', m:'触发人机验证 · 暂停采集', dur:'0s'},
            {t:'14:15:42', l:'INFO', m:'获取新验证码 · 等待中', dur:'12.4s'},
            {t:'14:12:18', l:'INFO', m:'Cookie即将过期 · 准备重新登录', dur:'0s'},
            {t:'14:08:32', l:'INFO', m:'上一批次 · 2,029 条', dur:'18m 42s'},
            {t:'14:05:14', l:'SUCCESS', m:'行业评论抓取 · 完成', dur:'6.5s'},
            {t:'13:58:00', l:'INFO', m:'数据清洗 · 匿名化处理', dur:'2.1s'},
            {t:'13:45:21', l:'INFO', m:'薪资数据提取 · 4,128 条', dur:'5.3s'},
            {t:'13:30:11', l:'SUCCESS', m:'用户动态 · 抓取完成', dur:'8.7s'},
            {t:'13:00:00', l:'INFO', m:'健康检查 · 通过', dur:'0.4s'}
        ]
    }
};
window.openSourceDetail = function(sourceName, tab) {
    tab = tab || 'overview';
    const detail = window.sourceDetailData[sourceName];
    if (!detail) return;
    const data = window.sourceDetailData[sourceName];
    const stats = window.Store.state.activities.filter(a => a.title.includes(sourceName)).length || Math.floor(Math.random()*50+10);
    const detailPage = document.getElementById('collection-detail-page');
    const listPage = document.getElementById('collection-list-page');
    if (!detailPage || !listPage) return;
    // 切换子页面
    listPage.classList.remove('active');
    detailPage.classList.add('active');
    // 配置项HTML
    let configHtml = '';
    Object.entries(data.config).forEach(([k, v]) => {
        configHtml += `<div class="config-row"><label>${k}</label><input type="text" class="config-input" value="${v}"></div>`;
    });
    // 日志HTML
    let logHtml = '';
    data.logs.forEach(log => {
        logHtml += `<div class="log-row">
            <span class="log-time">${log.t}</span>
            <span class="log-level ${log.l}">${log.l}</span>
            <span class="log-msg">${log.m}</span>
            <span class="log-duration">${log.dur}</span>
        </div>`;
    });
    // 概览HTML - 详细信息卡片
    const sampleJobs = window.Store.state.jobs.filter(j => j.source === sourceName).slice(0, 5);
    const samplesHtml = sampleJobs.length ? sampleJobs.map(j => `
        <div class="job-card" style="margin-bottom:10px;padding:14px">
            <div style="font-size:14px;font-weight:600;color:var(--text-dark)">${j.title}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${j.company} · ${j.city} · ${j.salary}</div>
            <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">
                ${j.requiredSkills.slice(0,4).map(s => `<span class="skill-chip" style="font-size:10px;padding:2px 6px">${s}</span>`).join('')}
            </div>
        </div>
    `).join('') : '<div style="color:var(--text-muted);font-size:13px">暂无样本数据</div>';
    detailPage.innerHTML = `
        <button class="breadcrumb-back" onclick="window.closeSourceDetail()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            返回数据源列表
        </button>
        <div class="source-detail-page page-enter">
            <div class="source-detail-head">
                <div class="source-detail-icon" style="background:${data.color}">${data.short}</div>
                <div class="source-detail-info">
                    <div class="source-detail-name">${sourceName}</div>
                    <div class="source-detail-desc">${data.desc}</div>
                </div>
                <div class="status-pill ${data.logs[0].l === 'ERROR' ? 'error' : 'running'}">
                    <span class="dot"></span>
                    ${data.logs[0].l === 'ERROR' ? '已暂停' : '运行中'}
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px">
                <div class="detail-stat"><div class="detail-stat-label">今日采集</div><div class="detail-stat-value">${(2000 + Math.floor(Math.random()*3000)).toLocaleString()}</div></div>
                <div class="detail-stat"><div class="detail-stat-label">成功率</div><div class="detail-stat-value">${(88 + Math.random()*10).toFixed(1)}%</div></div>
                <div class="detail-stat"><div class="detail-stat-label">平均延迟</div><div class="detail-stat-value">${(1 + Math.random()*3).toFixed(1)}s</div></div>
                <div class="detail-stat"><div class="detail-stat-label">最近活跃</div><div class="detail-stat-value">${Math.floor(Math.random()*5+1)}分钟前</div></div>
            </div>
            <div class="source-detail-tabs">
                <div class="source-tab ${tab === 'overview' ? 'active' : ''}" onclick="window.switchSourceTab('overview')">概览</div>
                <div class="source-tab ${tab === 'config' ? 'active' : ''}" onclick="window.switchSourceTab('config')">配置</div>
                <div class="source-tab ${tab === 'logs' ? 'active' : ''}" onclick="window.switchSourceTab('logs')">运行日志</div>
                <div class="source-tab ${tab === 'samples' ? 'active' : ''}" onclick="window.switchSourceTab('samples')">样本数据</div>
            </div>
            <div id="source-tab-content">
                ${tab === 'overview' ? `
                    <div class="row cols-2">
                        <div class="card"><div class="card-header"><div class="card-title">📈 采集趋势（7天）</div></div><div class="card-body"><div class="chart" id="chart-source-detail"></div></div></div>
                        <div class="card"><div class="card-header"><div class="card-title">🎯 状态分布</div></div><div class="card-body"><div class="chart" id="chart-source-status"></div></div></div>
                    </div>
                ` : tab === 'config' ? configHtml : tab === 'logs' ? logHtml : samplesHtml}
            </div>
        </div>
    `;
    window.currentSourceTab = tab;
    window.Utils.showToast('已进入 ' + sourceName + ' 详情', 'cyan');
    // 渲染图表
    if (tab === 'overview') {
        setTimeout(() => {
            const trendEl = document.getElementById('chart-source-detail');
            if (trendEl && !echarts.getInstanceByDom(trendEl)) {
                const c = echarts.init(trendEl);
                c.setOption({
                    ...window.baseChartOpt(),
                    tooltip:{trigger:'axis', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}},
                    xAxis:{type:'category',data:['7/13','7/14','7/15','7/16','7/17','7/18','7/19'],axisLabel:{color:'#475569', fontSize:11},axisLine:{lineStyle:{color:'#e2e8f0'}}},
                    yAxis:{type:'value',axisLabel:{color:'#475569', fontSize:11},splitLine:{lineStyle:{color:'#f1f3f9'}}},
                    series:[{type:'line',smooth:true,symbolSize:8,lineStyle:{width:3, color:data.color},itemStyle:{color:data.color},areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:data.color+'66'},{offset:1,color:data.color+'00'}]}},data:Array.from({length:7}, () => 2000 + Math.floor(Math.random()*2500))}]
                });
            }
            const statusEl = document.getElementById('chart-source-status');
            if (statusEl && !echarts.getInstanceByDom(statusEl)) {
                const c = echarts.init(statusEl);
                c.setOption({
                    textStyle:{fontFamily:'DM Sans', color:'#475569'},
                    tooltip:{trigger:'item', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}},
                    legend:{orient:'vertical', right:0, top:'center', textStyle:{color:'#475569', fontSize:11}},
                    series:[{type:'pie',radius:['45%','75%'],center:['35%','50%'],itemStyle:{borderRadius:6,borderColor:'#fff',borderWidth:3},label:{show:false},data:[
                        {value: Math.floor(Math.random()*500+3500), name:'成功', itemStyle:{color:'#10b981'}},
                        {value: Math.floor(Math.random()*150+150), name:'反爬触发', itemStyle:{color:'#f59e0b'}},
                        {value: Math.floor(Math.random()*50+30), name:'失败', itemStyle:{color:'#ef4444'}}
                    ]}]
                });
            }
        }, 80);
    }
    // 滚动到顶部
    document.querySelector('.content').scrollTop = 0;
};
window.closeSourceDetail = function() {
    document.getElementById('collection-detail-page').classList.remove('active');
    document.getElementById('collection-list-page').classList.add('active');
};
window.switchSourceTab = function(tab) {
    document.querySelectorAll('.source-detail-tabs .source-tab').forEach(t => t.classList.remove('active'));
    const tabNames = {overview:'概览', config:'配置', logs:'运行日志', samples:'样本数据'};
    const targetText = tabNames[tab];
    document.querySelectorAll('.source-detail-tabs .source-tab').forEach(t => {
        if (t.textContent.trim() === targetText) t.classList.add('active');
    });
    const sourceName = document.querySelector('.source-detail-name')?.textContent;
    if (sourceName) window.openSourceDetail(sourceName, tab);
};


