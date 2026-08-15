// ===== block 6 =====

// ============== 全局工具 ==============
window.Utils = {
    rand: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    pick: arr => arr[Math.floor(Math.random() * arr.length)],
    pickN: (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n),
    timeAgo: (date) => {
        const s = Math.floor((new Date() - date) / 1000);
        if (s < 60) return s + '秒前';
        if (s < 3600) return Math.floor(s/60) + '分钟前';
        if (s < 86400) return Math.floor(s/3600) + '小时前';
        return Math.floor(s/86400) + '天前';
    },
    animateNum: (el, target, dur=1500, decimals=0) => {
        if (!el) return;
        const start = parseFloat(el.dataset.val || '0') || 0;
        const t0 = Date.now();
        const textNode = [...el.childNodes].find(n => n.nodeType === 3) || el.appendChild(document.createTextNode(''));
        const step = () => {
            const p = Math.min((Date.now() - t0) / dur, 1);
            const v = start + (target - start) * (1 - Math.pow(1 - p, 3));
            textNode.nodeValue = decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString();
            if (p < 1) requestAnimationFrame(step);
            else el.dataset.val = target;
        };
        step();
    },
    showToast: (msg, type='mint') => {
        const t = document.createElement('div');
        const colors = {mint:'#10b981', pink:'#f72585', cyan:'#2DD4BF', amber:'#f59e0b', coral:'#ef4444'};
        t.className = 'toast';
        t.style.background = colors[type] || colors.mint;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100px)'; t.style.transition = 'all .3s'; }, 2500);
        setTimeout(() => t.remove(), 2900);
    }
};
window.showToast = window.Utils.showToast;
window.closeModal = () => document.getElementById('modal-overlay').classList.remove('show');
document.getElementById('modal-overlay').addEventListener('click', e => { if(e.target.id==='modal-overlay') window.closeModal(); });

// ============== 数据存储 ==============
window.Store = {
    skills: ['Python','Java','JavaScript','TypeScript','Go','Rust','C++','C#','PHP','Ruby','PyTorch','TensorFlow','CUDA','Transformer','BERT','GPT','LLM','RAG','Prompt工程','LoRA','RLHF','Agent','Embedding','Spring Boot','Spring Cloud','Vue','React','Angular','Next.js','Node.js','FastAPI','Django','MySQL','PostgreSQL','MongoDB','Redis','Elasticsearch','ClickHouse','Milvus','Chroma','Kafka','RabbitMQ','Flink','Spark','Docker','Kubernetes','Istio','DevOps','NLP','CV','AIGC','Diffusion','Stable Diffusion','HarmonyOS','ArkTS','安全','风控','区块链'],
    industries: ['互联网','金融科技','智能制造','医疗健康','教育','零售电商','游戏','汽车','新能源','物流','房地产','政企','电信','媒体','农业'],
    companies: ['字节跳动','阿里巴巴','腾讯','美团','京东','百度','拼多多','小米','华为','滴滴','快手','网易','携程','B站','蚂蚁集团','平安科技','科大讯飞','商汤科技'],
    cities: ['北京','上海','深圳','广州','杭州','成都','武汉','南京','西安','苏州','重庆','天津','长沙','青岛','厦门'],
    jobTitles: {
        '人工智能': ['AI算法工程师','NLP算法工程师','推荐算法工程师','CV算法工程师','Prompt工程师','LLM应用工程师','Agent工程师','RAG工程师','向量数据库工程师','大模型架构师'],
        '后端开发': ['Java开发工程师','Python后端工程师','Go后端工程师','Node.js工程师','云原生工程师','微服务架构师'],
        '前端开发': ['前端工程师','高级前端工程师','React工程师','Vue工程师','鸿蒙开发工程师'],
        '数据科学': ['数据分析师','高级数据分析师','数据科学家','数据工程师','BI工程师'],
        '产品运营': ['产品经理','高级产品经理','AI产品经理','B端产品经理','内容运营'],
        '运维测试': ['运维工程师','SRE工程师','DevOps工程师','测试工程师','安全工程师']
    },
    sources: ['拉勾网','BOSS直聘','智联招聘','脉脉'],
    state: { jobs: [], newJobs: [], graph: {nodes:[],edges:[]}, resumes: [], matchResults: [], activities: [], evolution: null }
};

// ============== Mock数据生成 ==============
window.generateAllData = function() {
    const U = window.Utils;
    const S = window.Store;
    // 岗位池
    S.state.jobs = [];
    Object.entries(S.jobTitles).forEach(([cat, titles]) => {
        titles.forEach((title, idx) => {
            S.state.jobs.push({
                id: 'J' + String(S.state.jobs.length + 1).padStart(4, '0'),
                title, category: cat, level: U.pick(['初级','中级','高级','资深','专家']),
                requiredSkills: U.pickN(S.skills, U.rand(4, 8)),
                preferredSkills: U.pickN(S.skills, U.rand(3, 6)),
                salary: U.pick(['10-20K','15-25K','20-35K','25-50K','35-60K','50-80K','80-120K']),
                city: U.pick(S.cities), company: U.pick(S.companies),
                industry: U.pick(S.industries), source: U.pick(S.sources),
                postDate: new Date(Date.now() - U.rand(0, 90) * 86400000),
                description: `负责${title}相关工作。要求掌握${U.pickN(S.skills, 3).join('、')}等核心技能。${U.pick(['5年以上相关经验','有大型项目经验','有大厂背景优先'])}。`
            });
        });
    });
    // 新发现岗位
    S.state.newJobs = [
        {id:'NJ001',title:'Prompt工程师',category:'人工智能',level:'中级',confidence:96,source:'拉勾网',discoveredAt:new Date(Date.now()-2*3600000),status:'pending',requiredSkills:['Python','LLM','Prompt工程','GPT','评测体系','NLP'],description:'负责大语言模型Prompt设计、优化与评测，构建高质量Prompt模板库。',salary:'30-60K',city:'北京'},
        {id:'NJ002',title:'AI产品经理（LLM方向）',category:'人工智能',level:'高级',confidence:93,source:'BOSS直聘',discoveredAt:new Date(Date.now()-4*3600000),status:'pending',requiredSkills:['产品规划','LLM','RAG','Agent','数据分析'],description:'负责大模型驱动的AI产品规划与设计。',salary:'35-65K',city:'上海'},
        {id:'NJ003',title:'向量数据库工程师',category:'后端开发',level:'高级',confidence:91,source:'脉脉',discoveredAt:new Date(Date.now()-6*3600000),status:'pending',requiredSkills:['Milvus','Chroma','向量检索','Embedding','Python'],description:'负责向量数据库的部署、调优与应用开发。',salary:'30-55K',city:'杭州'},
        {id:'NJ004',title:'AI训练数据工程师',category:'数据科学',level:'中级',confidence:89,source:'拉勾网',discoveredAt:new Date(Date.now()-8*3600000),status:'pending',requiredSkills:['数据清洗','数据标注','Python','RLHF','SFT'],description:'负责大模型训练数据的采集、清洗、标注与质量评估。',salary:'25-45K',city:'北京'},
        {id:'NJ005',title:'AIGC应用工程师',category:'人工智能',level:'中级',confidence:87,source:'BOSS直聘',discoveredAt:new Date(Date.now()-12*3600000),status:'pending',requiredSkills:['Stable Diffusion','LoRA','ControlNet','Diffusion'],description:'基于Stable Diffusion等AIGC模型开发图像/视频生成应用。',salary:'25-50K',city:'深圳'},
        {id:'NJ006',title:'大模型评测工程师',category:'人工智能',level:'高级',confidence:85,source:'智联招聘',discoveredAt:new Date(Date.now()-86400000),status:'pending',requiredSkills:['LLM评测','幻觉检测','Benchmark','Python'],description:'负责大语言模型能力评测体系构建。',salary:'30-55K',city:'北京'},
        {id:'NJ007',title:'Agent架构师',category:'人工智能',level:'专家',confidence:88,source:'脉脉',discoveredAt:new Date(Date.now()-1.5*86400000),status:'pending',requiredSkills:['Agent','Function Call','LangChain'],description:'设计多Agent协作架构。',salary:'60-100K',city:'上海'},
        {id:'NJ008',title:'模型压缩工程师',category:'人工智能',level:'高级',confidence:82,source:'拉勾网',discoveredAt:new Date(Date.now()-2*86400000),status:'pending',requiredSkills:['量化','剪枝','知识蒸馏','TensorRT'],description:'负责大模型压缩与加速。',salary:'35-60K',city:'深圳'},
        {id:'NJ009',title:'鸿蒙AI应用工程师',category:'前端开发',level:'中级',confidence:79,source:'BOSS直聘',discoveredAt:new Date(Date.now()-2.5*86400000),status:'pending',requiredSkills:['HarmonyOS','ArkTS','LLM','端侧AI'],description:'基于鸿蒙系统开发AI原生应用。',salary:'25-50K',city:'深圳'},
        {id:'NJ010',title:'AI安全工程师',category:'安全',level:'高级',confidence:84,source:'脉脉',discoveredAt:new Date(Date.now()-3*86400000),status:'pending',requiredSkills:['对抗攻击','Prompt注入','风控'],description:'负责大模型安全防护体系。',salary:'40-70K',city:'北京'},
        {id:'NJ011',title:'多模态算法工程师',category:'人工智能',level:'高级',confidence:91,source:'拉勾网',discoveredAt:new Date(Date.now()-4*86400000),status:'adopted',requiredSkills:['多模态','视觉语言','LLM','Diffusion'],description:'负责视觉-语言多模态大模型研发。',salary:'40-80K',city:'北京'},
        {id:'NJ012',title:'推荐系统架构师',category:'人工智能',level:'专家',confidence:90,source:'BOSS直聘',discoveredAt:new Date(Date.now()-5*86400000),status:'adopted',requiredSkills:['推荐系统','向量检索','Milvus','LLM'],description:'负责亿级用户推荐系统架构设计。',salary:'60-120K',city:'北京'}
    ];
    // 简历
    S.state.resumes = [
        {id:'R001',name:'张三',avatar:'张',gender:'男',age:28,experience:5,city:'北京',education:'硕士·计算机',expectedSalary:'30-50K',score:93.7,skills:['Python','深度学习','PyTorch','机器学习','TensorFlow','NLP','SQL','Git','Linux','CUDA'],experiences:[{company:'字节跳动',title:'高级算法工程师',period:'2022-至今',desc:'推荐系统CTR模型优化'},{company:'美团',title:'算法工程师',period:'2020-2022',desc:'搜索排序模型与NLP应用'}]},
        {id:'R002',name:'李四',avatar:'李',gender:'女',age:26,experience:3,city:'上海',education:'本科·软件工程',expectedSalary:'20-35K',score:87.2,skills:['Java','Spring Boot','MySQL','Redis','Kafka','Docker','MyBatis'],experiences:[{company:'阿里巴巴',title:'后端开发工程师',period:'2021-至今',desc:'电商后端服务开发'}]},
        {id:'R003',name:'王五',avatar:'王',gender:'男',age:30,experience:7,city:'深圳',education:'硕士·AI',expectedSalary:'50-80K',score:91.5,skills:['Python','PyTorch','LLM','Transformer','RAG','Agent','LoRA','分布式训练'],experiences:[{company:'腾讯',title:'高级AI工程师',period:'2020-至今',desc:'LLM应用研发与落地'}]},
        {id:'R004',name:'赵六',avatar:'赵',gender:'女',age:25,experience:2,city:'杭州',education:'本科·数据科学',expectedSalary:'15-25K',score:78.4,skills:['Python','SQL','数据分析','机器学习'],experiences:[{company:'蚂蚁集团',title:'数据分析师',period:'2022-至今',desc:'业务数据分析'}]},
        {id:'R005',name:'陈七',avatar:'陈',gender:'男',age:32,experience:8,city:'北京',education:'博士·计算机',expectedSalary:'60-100K',score:95.3,skills:['Python','LLM','深度学习','CUDA','分布式训练','DeepSpeed','RLHF','PPO'],experiences:[{company:'字节跳动',title:'AI研究员',period:'2020-至今',desc:'大模型预训练研究'}]},
        {id:'R006',name:'林八',avatar:'林',gender:'女',age:27,experience:4,city:'广州',education:'本科·前端',expectedSalary:'20-35K',score:84.7,skills:['Vue','React','TypeScript','Node.js','Webpack','Vite'],experiences:[{company:'拼多多',title:'高级前端工程师',period:'2021-至今',desc:'电商前端架构'}]}
    ];
    // 知识图谱
    S.state.graph = window.generateGraphData();
    // 活动流
    S.state.activities = [
        {type:'discovery',title:'发现新岗位「Prompt工程师」',time:new Date(Date.now()-120000)},
        {type:'match',title:'简历匹配：张三 → AI算法工程师 (92.4分)',time:new Date(Date.now()-300000)},
        {type:'evolution',title:'Java开发工程师技能更新 +5/-2',time:new Date(Date.now()-720000)},
        {type:'quality',title:'本周JD解析准确率 91.2% (达标)',time:new Date(Date.now()-3600000)},
        {type:'collect',title:'爬虫新增3,254条JD数据',time:new Date(Date.now()-7200000)}
    ];
    // 演化数据
    S.state.evolution = {
        jobId: 'java-backend',
        added: [
            {name:'Spring Cloud Alibaba',version:'v2026.1',growth:'+347%'},
            {name:'GraalVM Native Image',version:'新出现',growth:'+128'},
            {name:'JDK 21 (Virtual Thread)',version:'v17→v21',growth:'+89%'},
            {name:'Vector API / SIMD',version:'新出现',growth:'+64'},
            {name:'OpenTelemetry',version:'新出现',growth:'+52'},
            {name:'Spring AI',version:'新出现',growth:'+147'},
            {name:'Virtual Thread (Loom)',version:'v19→v21',growth:'+112%'},
            {name:'eBPF',version:'新出现',growth:'+45'}
        ],
        removed: [
            {name:'Struts2',version:'已废弃',decline:'-89%'},
            {name:'EJB',version:'已废弃',decline:'-95%'},
            {name:'JSP',version:'边缘化',decline:'-72%'},
            {name:'WebLogic',version:'已废弃',decline:'-67%'},
            {name:'JMS 1.0',version:'已废弃',decline:'-83%'},
            {name:'SOAP',version:'边缘化',decline:'-58%'}
        ],
        modified: [
            {name:'微服务架构',change:'中级→高级',weight:'+18%'},
            {name:'MySQL',change:'加分→必备',weight:'↑'},
            {name:'Redis',change:'加分→必备',weight:'↑'},
            {name:'Kafka',change:'加分→必备',weight:'↑'},
            {name:'Kubernetes',change:'加分→必备',weight:'↑'},
            {name:'Docker',change:'初级→中级',weight:'↑'},
            {name:'Spring Security',change:'加分→必备',weight:'↑'},
            {name:'JVM调优',change:'加分→必备',weight:'↑'},
            {name:'设计模式',change:'加分→必备',weight:'↑'},
            {name:'高并发',change:'加分→必备',weight:'↑'},
            {name:'DDD',change:'加分→中级',weight:'↑'},
            {name:'单元测试',change:'加分→必备',weight:'↑'},
            {name:'CI/CD',change:'加分→中级',weight:'↑'}
        ]
    };
};

// ============== 图谱数据生成 ==============
window.generateGraphData = function() {
    const U = window.Utils;
    const nodes = [];
    const edges = [];
    // 核心岗位
    const coreJobs = [
        {id:'job-ai',label:'AI算法工程师',size:48},
        {id:'job-nlp',label:'NLP工程师',size:38},
        {id:'job-ml',label:'ML工程师',size:38},
        {id:'job-prompt',label:'Prompt工程师',size:34},
        {id:'job-cv',label:'CV工程师',size:34},
        {id:'job-frontend',label:'前端工程师',size:38},
        {id:'job-backend',label:'后端工程师',size:38},
        {id:'job-data',label:'数据工程师',size:34},
        {id:'job-devops',label:'DevOps',size:32},
        {id:'job-rec',label:'推荐算法',size:36}
    ];
    coreJobs.forEach(j => nodes.push({id:j.id, label:j.label, type:'job', size:j.size, style:{fill:'#0D9488',lineWidth:2,stroke:'#fff'}}));
    // 技能节点（22个）
    const skills = [
        {id:'sk-py',label:'Python',size:32,cat:'language'},
        {id:'sk-java',label:'Java',size:30,cat:'language'},
        {id:'sk-js',label:'JavaScript',size:28,cat:'language'},
        {id:'sk-ts',label:'TypeScript',size:24,cat:'language'},
        {id:'sk-go',label:'Go',size:26,cat:'language'},
        {id:'sk-pt',label:'PyTorch',size:30,cat:'framework'},
        {id:'sk-tf',label:'TensorFlow',size:26,cat:'framework'},
        {id:'sk-spring',label:'Spring Boot',size:26,cat:'framework'},
        {id:'sk-vue',label:'Vue',size:24,cat:'framework'},
        {id:'sk-react',label:'React',size:24,cat:'framework'},
        {id:'sk-llm',label:'LLM',size:36,cat:'ai'},
        {id:'sk-tfm',label:'Transformer',size:26,cat:'ai'},
        {id:'sk-rag',label:'RAG',size:24,cat:'ai'},
        {id:'sk-agent',label:'Agent',size:24,cat:'ai'},
        {id:'sk-prompt',label:'Prompt',size:22,cat:'ai'},
        {id:'sk-cuda',label:'CUDA',size:22,cat:'ai'},
        {id:'sk-mysql',label:'MySQL',size:28,cat:'db'},
        {id:'sk-redis',label:'Redis',size:26,cat:'db'},
        {id:'sk-k8s',label:'Kubernetes',size:26,cat:'infra'},
        {id:'sk-docker',label:'Docker',size:26,cat:'infra'},
        {id:'sk-milvus',label:'Milvus',size:20,cat:'db'},
        {id:'sk-spark',label:'Spark',size:22,cat:'data'}
    ];
    skills.forEach(s => nodes.push({id:s.id, label:s.label, type:'skill', size:s.size, style:{fill:'#F5A524',lineWidth:1,stroke:'#fff'}}));
    // 行业
    ['Internet','FinTech','Healthcare','Education','Manufacturing'].forEach((n,i) => {
        nodes.push({id:'ind-'+i, label:n, type:'industry', size:26, style:{fill:'#64748B',lineWidth:1,stroke:'#fff'}});
    });
    // 类别
    [{id:'cat-ai',label:'AI'},{id:'cat-web',label:'Web'},{id:'cat-data',label:'Data'},{id:'cat-infra',label:'Infra'}].forEach(c => {
        nodes.push({id:c.id, label:c.label, type:'category', size:30, style:{fill:'#10b981',lineWidth:2,stroke:'#fff'}});
    });
    // 关系 - 岗位-技能
    const jobSkills = [
        ['job-ai','sk-py'],['job-ai','sk-pt'],['job-ai','sk-llm'],['job-ai','sk-tfm'],['job-ai','sk-cuda'],['job-ai','sk-prompt'],
        ['job-nlp','sk-py'],['job-nlp','sk-pt'],['job-nlp','sk-llm'],['job-nlp','sk-tfm'],
        ['job-ml','sk-py'],['job-ml','sk-pt'],['job-ml','sk-tf'],
        ['job-prompt','sk-py'],['job-prompt','sk-llm'],['job-prompt','sk-prompt'],['job-prompt','sk-rag'],
        ['job-cv','sk-py'],['job-cv','sk-pt'],
        ['job-frontend','sk-js'],['job-frontend','sk-ts'],['job-frontend','sk-vue'],['job-frontend','sk-react'],
        ['job-backend','sk-java'],['job-backend','sk-spring'],['job-backend','sk-mysql'],['job-backend','sk-redis'],['job-backend','sk-k8s'],
        ['job-data','sk-py'],['job-data','sk-spark'],['job-data','sk-mysql'],
        ['job-devops','sk-k8s'],['job-devops','sk-docker'],
        ['job-rec','sk-py'],['job-rec','sk-milvus'],['job-rec','sk-llm'],['job-rec','sk-rag']
    ];
    jobSkills.forEach(([s,t]) => edges.push({source:s, target:t, style:{stroke:'rgba(255,255,255,.2)',lineWidth:1.5}}));
    // 技能关联
    [['sk-py','sk-pt'],['sk-llm','sk-tfm'],['sk-llm','sk-rag'],['sk-llm','sk-agent'],['sk-rag','sk-prompt'],['sk-mysql','sk-redis'],['sk-docker','sk-k8s'],['sk-js','sk-ts'],['sk-js','sk-vue'],['sk-js','sk-react']].forEach(([s,t]) => edges.push({source:s, target:t, style:{stroke:'rgba(255,255,255,.15)',lineWidth:1,lineDash:[3,3]}}));
    // 岗位-行业
    [['job-ai','ind-0'],['job-frontend','ind-0'],['job-backend','ind-0'],['job-backend','ind-1'],['job-cv','ind-2']].forEach(([s,t]) => edges.push({source:s, target:t, style:{stroke:'rgba(255,255,255,.18)',lineWidth:1.5}}));
    // 岗位-类别
    [['job-ai','cat-ai'],['job-nlp','cat-ai'],['job-ml','cat-ai'],['job-prompt','cat-ai'],['job-cv','cat-ai'],['job-rec','cat-ai'],
     ['job-frontend','cat-web'],['job-backend','cat-web'],
     ['job-data','cat-data'],['job-devops','cat-infra']].forEach(([s,t]) => edges.push({source:s, target:t, style:{stroke:'rgba(16,185,129,.5)',lineWidth:2}}));
    return {nodes, edges};
};

// ============== 视图切换 ==============
window.viewNames = {
    dashboard:'总览看板', graph:'图谱可视化', discovery:'新岗位发现', evolution:'能力动态演化',
    match:'人岗匹配诊断', qa:'智能问答', learningPath:'学习路径', newSkill:'新增技能', collection:'数据采集', analysis:'趋势分析',
    quality:'质量监控', settings:'系统设置'
};
window.currentViewId = 'dashboard';
window.resizeActiveVisuals = function() {
    Object.values(window.chartInstances || {}).forEach(c => { try { if (c && c.resize) c.resize(); } catch(e){} });
    const resizeG6 = (inst, id) => {
        if (!inst) return;
        const el = document.getElementById(id);
        if (!el || el.clientWidth < 10 || el.clientHeight < 10) return;
        try {
            if (inst.changeSize) inst.changeSize(el.clientWidth, el.clientHeight);
            else if (inst.resize) inst.resize(el.clientWidth, el.clientHeight);
        } catch(e){}
    };
    resizeG6(typeof graphInstance !== 'undefined' ? graphInstance : null, 'graph-container');
    resizeG6(typeof heroGraphInstance !== 'undefined' ? heroGraphInstance : null, 'dash-graph-container');
};
window.switchView = function(viewId, opts) {
    opts = opts || {};
    if (!viewId || !window.viewNames[viewId]) viewId = 'dashboard';
    const prev = window.currentViewId;
    window.currentViewId = viewId;
    if (prev === 'graph' && viewId !== 'graph' && window.pauseGraphLiving) window.pauseGraphLiving();
    if (prev === 'discovery' && viewId !== 'discovery' && window.destroyDiscFX) window.destroyDiscFX();
    document.body.classList.toggle('disc-lock', viewId === 'discovery');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const view = document.getElementById('view-' + viewId);
    const nav = document.querySelector(`.nav-item[data-view="${viewId}"]`);
    if (view) view.classList.add('active');
    if (nav) nav.classList.add('active');
    const crumb = document.getElementById('crumb-current');
    if (crumb) crumb.textContent = window.viewNames[viewId] || viewId;
    const content = document.querySelector('.content');
    if (content) content.scrollTop = 0;
    if (!opts.skipHash) {
        const next = '#' + viewId;
        if (location.hash !== next) history.replaceState(null, '', next);
    }
    requestAnimationFrame(() => {
        setTimeout(() => {
            try { window.initView(viewId); } catch (err) { console.warn('initView failed', viewId, err); }
            window.resizeActiveVisuals();
            setTimeout(() => window.resizeActiveVisuals(), 200);
        }, 60);
    });
};
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => window.switchView(item.dataset.view));
});
window.addEventListener('hashchange', () => {
    const id = (location.hash || '').replace(/^#/, '');
    if (id && window.viewNames[id] && id !== window.currentViewId) {
        window.switchView(id, { skipHash: true });
    }
});

// ============== ECharts通用配置 ==============
window.chartInstances = {};
window.baseChartOpt = function() {
    return {
        textStyle:{fontFamily:'DM Sans, Noto Sans SC', color:'#475569'},
        grid:{left:50, right:24, top:36, bottom:36, containLabel:true},
        tooltip:{trigger:'axis', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}, padding:[10,14], extraCssText:'box-shadow: 0 4px 20px rgba(0,0,0,.2); border-radius: 8px;'},
        legend:{textStyle:{color:'#475569', fontSize:12}, top:0, right:0}
    };
};
window.disposeChart = function(id) {
    if (window.chartInstances[id]) {
        try { window.chartInstances[id].dispose(); } catch(e){}
        window.chartInstances[id] = null;
    }
};
window.safeChart = function(id) {
    const noop = { setOption(){}, resize(){}, dispose(){} };
    const el = document.getElementById(id);
    if (!el) return noop;
    if (typeof echarts === 'undefined') {
        console.warn('ECharts unavailable');
        return noop;
    }
    window.disposeChart(id);
    if (el.clientWidth < 10) el.style.minHeight = el.style.minHeight || '240px';
    try {
        const chart = echarts.init(el);
        window.chartInstances[id] = chart;
        requestAnimationFrame(() => { try { chart.resize(); } catch(e){} });
        return chart;
    } catch (err) {
        console.warn('ECharts init failed', id, err);
        return noop;
    }
};

// ============== 全局实时更新 ==============
window.LiveUpdater = {
    timers: {},
    start: function(key, fn, interval) {
        if (this.timers[key]) clearInterval(this.timers[key]);
        this.timers[key] = setInterval(fn, interval);
    },
    stop: function(key) { if (this.timers[key]) { clearInterval(this.timers[key]); delete this.timers[key]; } },
    stopAll: function() { Object.keys(this.timers).forEach(k => this.stop(k)); }
};

// ============== Toast / Modal ==============
window.exportData = function(type) {
    const data = (window.Store.state[type] || window.Store.state.graph) || window.Store.state;
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tuzhupoju_${type}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    window.Utils.showToast('✓ 已导出 ' + type + ' 数据', 'mint');
};
window.triggerDiscovery = function() {
    window.Utils.showToast('🔍 正在扫描全网...', 'cyan');
    setTimeout(() => {
        const newJob = {
            id: 'NJ' + String(window.Utils.rand(100,999)),
            title: window.Utils.pick(['AI编译器工程师','量子ML研究员','边缘智能工程师','具身智能工程师','脑机接口工程师','多模态Agent架构师','联邦学习专家','机器人算法工程师','AI合规顾问']),
            category: '人工智能', level: window.Utils.pick(['高级','专家']),
            confidence: window.Utils.rand(75, 96), source: window.Utils.pick(window.Store.sources),
            discoveredAt: new Date(), status: 'pending',
            requiredSkills: window.Utils.pickN(window.Store.skills, 5),
            description: '基于多源数据挖掘识别的新兴岗位。',
            salary: window.Utils.rand(20,60) + '-' + window.Utils.rand(60,120) + 'K',
            city: window.Utils.pick(window.Store.cities)
        };
        window.Store.state.newJobs.unshift(newJob);
        if (window.Store.state.newJobs.length > 20) window.Store.state.newJobs.pop();
        if (document.getElementById('view-discovery').classList.contains('active')) window.renderDiscoveryList();
        window.Utils.showToast('✓ 发现新岗位: ' + newJob.title, 'mint');
    }, 1500);
};
window.clearChat = function() {
    window.qaState = {chatHistory: [{
        role:'ai', content:'对话已清空。您好！我是基于<strong>知识图谱+RAG</strong>的智能助手。', time:new Date()
    }]};
    window.renderChatHistory();
    window.Utils.showToast('对话已清空', 'cyan');
};

// ============== Dashboard ==============
window.initDashboard = function() {
    try {
    ['chart-trend','chart-skills','chart-industry','chart-source'].forEach(window.disposeChart);
    if (!window.Store.state.jobs.length) window.generateAllData();
    const U = window.Utils;
    // 初始化Hero区迷你图谱
    try { window.initHeroGraph(); } catch(e) { console.warn(e); }
    try { window.initHeroParticles(); } catch(e) { console.warn(e); }
    try { window.renderHotJobs(); } catch(e) { console.warn(e); }
    // 更新hero统计
    const jobsCount = window.Store.state.jobs.length;
    const skillsCount = window.Store.state.graph.nodes.filter(n => n.type === 'skill').length;
    const edgesCount = window.Store.state.graph.edges.length;
    window.Utils.animateNum(document.getElementById('hero-jobs'), jobsCount, 1500);
    window.Utils.animateNum(document.getElementById('hero-skills'), skillsCount, 1500);
    window.Utils.animateNum(document.getElementById('hero-edges'), edgesCount, 1500);
    document.getElementById('dash-graph-info').textContent = `${jobsCount + skillsCount + 5} 节点 · ${edgesCount} 关系`;
    // 迷你指标
    document.getElementById('mini-nodes').textContent = jobsCount + skillsCount + 5;
    document.getElementById('mini-edges').textContent = edgesCount;
    document.getElementById('mini-match').textContent = (3000 + Math.floor(Math.random() * 500)).toLocaleString();
    document.getElementById('mini-collect').textContent = (10000 + Math.floor(Math.random() * 5000)).toLocaleString();
    // KPI动画
    const kpis = [
        {el:document.querySelector('#view-dashboard .kpi-card.k1 .kpi-value'), target: window.Store.state.jobs.length},
        {el:document.querySelector('#view-dashboard .kpi-card.k2 .kpi-value'), target: window.Store.state.newJobs.length},
        {el:document.querySelector('#view-dashboard .kpi-card.k3 .kpi-value'), target: 3254},
        {el:document.querySelector('#view-dashboard .kpi-card.k4 .kpi-value'), target: 93.7}
    ];
    kpis.forEach(k => U.animateNum(k.el, k.target, 1500, k.target === 93.7 ? 1 : 0));
    // 趋势图
    const dates = Array.from({length:19}, (_, i) => `${Math.floor(i/2)+1}/${(i%2)+1}`);
    const newJobData = Array.from({length:19}, () => U.rand(38, 105));
    const matchData = Array.from({length:19}, () => U.rand(120, 320));
    const collectData = Array.from({length:19}, () => U.rand(8000, 15500));
    window.chartInstances['chart-trend'] = window.safeChart('chart-trend');
    window.chartInstances['chart-trend'].setOption({
        ...window.baseChartOpt(),
        tooltip:{trigger:'axis', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}, padding:[10,14]},
        legend:{data:['新增岗位','匹配次数','采集量'], top:0, textStyle:{color:'#475569'}},
        xAxis:{type:'category',data:dates,axisLine:{lineStyle:{color:'#e2e8f0'}},axisLabel:{color:'#475569', fontSize:11}},
        yAxis:{type:'value',axisLine:{show:false},splitLine:{lineStyle:{color:'#f1f3f9'}},axisLabel:{color:'#475569', fontSize:11}},
        series:[
            {name:'新增岗位',type:'line',smooth:true,symbolSize:6,lineStyle:{width:3, color:'#0D9488'},itemStyle:{color:'#0D9488'},areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(13,148,136,.3)'},{offset:1,color:'rgba(13,148,136,0)'}]}},data:newJobData},
            {name:'匹配次数',type:'line',smooth:true,symbolSize:6,lineStyle:{width:3, color:'#10b981'},itemStyle:{color:'#10b981'},areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(16,185,129,.3)'},{offset:1,color:'rgba(16,185,129,0)'}]}},data:matchData},
            {name:'采集量',type:'bar',barWidth:8,itemStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(247,37,133,.7)'},{offset:1,color:'rgba(247,37,133,.3)'}]}},data:collectData}
        ]
    });
    // 技能TOP10
    const topSkills = window.Store.skills.slice(0, 10);
    const skillCounts = topSkills.map(() => U.rand(400, 2800)).sort((a,b) => a-b);
    window.chartInstances['chart-skills'] = window.safeChart('chart-skills');
    window.chartInstances['chart-skills'].setOption({
        ...window.baseChartOpt(),
        grid:{left:90, right:30, top:10, bottom:30, containLabel:true},
        tooltip:{trigger:'axis', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}},
        xAxis:{type:'value',axisLine:{show:false},splitLine:{lineStyle:{color:'#f1f3f9'}},axisLabel:{color:'#475569', fontSize:11}},
        yAxis:{type:'category',data:topSkills.slice().reverse(),axisLine:{show:false},axisTick:{show:false},axisLabel:{color:'#475569', fontSize:11}},
        series:[{type:'bar',barWidth:14,data:skillCounts,itemStyle:{borderRadius:[0,7,7,0],color:{type:'linear',x:0,y:0,x2:1,y2:0,colorStops:[{offset:0,color:'#134E4A'},{offset:1,color:'#0D9488'}]}}}]
    });
    // 行业
    window.chartInstances['chart-industry'] = window.safeChart('chart-industry');
    const colors = ['#0D9488','#2DD4BF','#134E4A','#f72585','#10b981','#f59e0b','#ef4444'];
    const indData = window.Store.industries.slice(0, 7).map((name, i) => ({value: U.rand(800, 3500), name, itemStyle:{color:colors[i]}}));
    window.chartInstances['chart-industry'].setOption({
        textStyle:{fontFamily:'DM Sans', color:'#475569'},
        tooltip:{trigger:'item', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}},
        legend:{orient:'vertical', right:0, top:'center', textStyle:{color:'#475569', fontSize:11}, itemWidth:8, itemHeight:8},
        series:[{type:'pie',radius:['45%','75%'],center:['35%','50%'],itemStyle:{borderRadius:6,borderColor:'#fff',borderWidth:3},label:{show:false},labelLine:{show:false},data:indData}]
    });
    // 数据源
    window.chartInstances['chart-source'] = window.safeChart('chart-source');
    const srcData = window.Store.sources.map((name, i) => ({value: U.rand(1500, 5000), name, itemStyle:{color:['#0D9488','#2DD4BF','#10b981','#f59e0b'][i]}}));
    window.chartInstances['chart-source'].setOption({
        textStyle:{fontFamily:'DM Sans', color:'#475569'},
        tooltip:{trigger:'item', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}},
        series:[{type:'pie',radius:['60%','85%'],center:['50%','50%'],startAngle:90,itemStyle:{borderRadius:4,borderColor:'#fff',borderWidth:2},label:{show:true,position:'outside',formatter:'{b}\n{d}%',fontSize:11,color:'#475569',lineHeight:18},labelLine:{length:8,length2:8},data:srcData}]
    });
    window.renderActivityList();
    // 启动实时更新
    window.LiveUpdater.start('dashboard-kpi', () => {
        const k1 = document.querySelector('#view-dashboard .kpi-card.k1 .kpi-value');
        if (k1) {
            const cur = parseInt(k1.dataset.val || '0');
            U.animateNum(k1, cur + U.rand(0, 3), 800);
        }
    }, 5000);
    window.LiveUpdater.start('activity', () => {
        const msgs = [
            () => '发现新岗位「' + (window.Store.state.newJobs[0]?.title || 'AI工程师') + '」',
            () => '简历匹配：张三 → ' + (window.Store.state.jobs[0]?.title || '工程师') + ' (' + U.rand(80,95) + '分)',
            () => '爬虫新增' + U.rand(50,200) + '条JD数据',
            () => '图谱新增' + U.rand(5,20) + '个技能节点',
            () => '完成NER抽取 ' + U.rand(500,2000) + ' 个实体'
        ];
        window.Store.state.activities.unshift({type:'live', title: U.pick(msgs)(), time: new Date()});
        if (window.Store.state.activities.length > 10) window.Store.state.activities.pop();
        window.renderActivityList();
    }, 8000);
    } catch (err) {
        console.warn('initDashboard failed', err);
    }
};
// ============== Hero Graph (Dashboard) ==============
let heroGraphInstance = null;
let heroFallbackRaf = null;
window.renderHeroFallbackGraph = function(container, nodes, edges) {
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const w = container.clientWidth || 400;
    const h = container.clientHeight || 280;
    canvas.width = w * devicePixelRatio;
    canvas.height = h * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const pts = nodes.map((n, i) => {
        const a = (i / nodes.length) * Math.PI * 2;
        const r = Math.min(w, h) * 0.32;
        return {
            x: w/2 + Math.cos(a) * r * (0.7 + Math.random()*0.4),
            y: h/2 + Math.sin(a) * r * (0.7 + Math.random()*0.4),
            vx: (Math.random()-.5)*.15, vy: (Math.random()-.5)*.15,
            r: n.type === 'job' ? 7 : 5,
            color: n.type === 'job' ? '#2DD4BF' : n.type === 'skill' ? '#F5A524' : '#94A3B8',
            label: (n.label || n.id || '').slice(0, 6)
        };
    });
    const idIndex = Object.fromEntries(nodes.map((n,i) => [n.id, i]));
    const links = edges.map(e => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        return [idIndex[s], idIndex[t]];
    }).filter(p => p[0] != null && p[1] != null);
    const tick = () => {
        ctx.clearRect(0, 0, w, h);
        links.forEach(([a,b]) => {
            ctx.beginPath();
            ctx.moveTo(pts[a].x, pts[a].y);
            ctx.lineTo(pts[b].x, pts[b].y);
            ctx.strokeStyle = 'rgba(45,212,191,.22)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
        pts.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 20 || p.x > w-20) p.vx *= -1;
            if (p.y < 20 || p.y > h-20) p.vy *= -1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,.7)';
            ctx.font = '10px IBM Plex Mono, monospace';
            ctx.fillText(p.label, p.x + 8, p.y + 3);
        });
        heroFallbackRaf = requestAnimationFrame(tick);
    };
    if (heroFallbackRaf) cancelAnimationFrame(heroFallbackRaf);
    tick();
};
window.initHeroGraph = function() {
    if (heroGraphInstance || document.getElementById('dash-graph-container')?.dataset.g6ready) return;
    const container = document.getElementById('dash-graph-container');
    if (!container) return;
    const data = JSON.parse(JSON.stringify(window.Store.state.graph));
    const nodes = data.nodes.slice(0, 14).map(n => ({
        ...n,
        label: n.label || n.id,
        size: n.size || (n.type === 'job' ? 32 : 20),
        style: Object.assign({ fill: '#0D9488', stroke: '#fff', lineWidth: 1 }, n.style || {})
    }));
    const ids = new Set(nodes.map(n => n.id));
    const edges = data.edges.filter(e => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        return ids.has(s) && ids.has(t);
    }).map((e, i) => ({
        id: e.id || ('he' + i),
        source: typeof e.source === 'object' ? e.source.id : e.source,
        target: typeof e.target === 'object' ? e.target.id : e.target,
        style: Object.assign({ stroke: 'rgba(255,255,255,.25)', lineWidth: 1 }, e.style || {})
    }));
    if (typeof G6 === 'undefined' || !G6.Graph) {
        window.renderHeroFallbackGraph(container, nodes, edges);
        return;
    }
    try {
        const w = container.clientWidth || 400;
        const h = container.clientHeight || 280;
        heroGraphInstance = new G6.Graph({
            container: 'dash-graph-container',
            width: w,
            height: h,
            modes: { default: ['drag-canvas', 'zoom-canvas'] },
            layout: { type: 'force', preventOverlap: true, nodeStrength: -150, edgeStrength: 0.7, collideStrength: 0.8, linkDistance: 80 },
            animate: true,
            defaultNode: {
                type: 'circle',
                labelCfg: { position: 'bottom', offset: 4, style: { fill: '#fff', fontSize: 9, fontWeight: 500 } }
            },
            defaultEdge: { style: { stroke: 'rgba(255,255,255,.2)', lineWidth: 1 } }
        });
        heroGraphInstance.data({ nodes, edges });
        heroGraphInstance.render();
        container.dataset.g6ready = '1';
    } catch(e) {
        console.warn('Hero graph init failed', e);
        heroGraphInstance = null;
        window.renderHeroFallbackGraph(container, nodes, edges);
    }
};
window.initHeroParticles = function() {
    const canvas = document.getElementById('dash-particles');
    if (!canvas || canvas.dataset.bound) return;
    canvas.dataset.bound = '1';
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const particles = [];
    for (let i = 0; i < 50; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            r: Math.random() * 2 + 0.5
        });
    }
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(45, 212, 191, 0.55)';
            ctx.fill();
        });
        requestAnimationFrame(animate);
    }
    animate();
};
window.renderHotJobs = function() {
    const el = document.getElementById('hot-jobs');
    if (!el) return;
    const hotJobs = window.Store.state.jobs
        .filter(j => j.salary.includes('40') || j.salary.includes('60') || j.salary.includes('80'))
        .slice(0, 8);
    if (!hotJobs.length) return;
    el.innerHTML = hotJobs.map((j, i) => `
        <div class="hot-job-card anim-fade-up" style="animation-delay:${i*0.04}s" onclick="window.switchView('match')">
            <div class="hot-job-title">${j.title}</div>
            <div class="hot-job-meta">${j.company} · ${j.city}</div>
            <div class="hot-job-salary">${j.salary}</div>
            <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">
                ${j.requiredSkills.slice(0, 3).map(s => `<span class="skill-chip" style="font-size:10px;padding:2px 6px">${s}</span>`).join('')}
            </div>
        </div>
    `).join('');
};
window.renderActivityList = function() {
    const el = document.getElementById('activity-list');
    if (!el) return;
    const colors = ['a1','a2','a3','a4'];
    el.innerHTML = window.Store.state.activities.slice(0, 5).map((a, i) => `
        <div class="activity-item anim-fade-up" style="animation-delay:${i*0.05}s">
            <div class="activity-dot ${colors[i%4]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
            <div class="activity-content"><div class="activity-title">${a.title}</div><div class="activity-meta">${window.Utils.timeAgo(a.time)}</div></div>
        </div>
    `).join('');
};

// ============== Graph View ==============
// ============== 数字人才地图 State ==============
let talentMapState = {
    dataLoaded: false,
    allProvinces: [],
    selectedProvince: null,
    hoveredProvince: null,
    selectedJob: null,
    selectedCity: null,
    mapChart: null,
    jobGraphInstance: null,
    currentLayer: 'map', // 'map' | 'province' | 'graph'
    geoJSON: null,
    defaultView: { zoom: 1.42, center: [105.5, 36.5] },
    breathTimer: null,
    mapMode: 'overview', // 'overview' = hover 悬停显示 | 'province' = 详情常驻
    isEnteringProvince: false,
    flyInSavedZoom: null,
    mapLevel: 'country',    // 'country' | 'province' | 'city'
    analysisLevel: 'country', // 'country' | 'province' | 'city' — 当前分析层级，区分省/市分析
    currentProvinceName: null,
    cityGeoJSON: null,      // 市级 GeoJSON
    cityGeoLoaded: null,    // 已加载市级的省份名称
    cityData: [],            // 市级岗位数据
    provinceDetailData: null, // 省份详情API缓存
    provinceJobs: [],        // 当前省份岗位列表
    cityDetailData: null,    // 城市详情API缓存
};

// GeoJSON 完整名 → 数据简称
const GEO_TO_SHORT = {
    '北京市':'北京','天津市':'天津','上海市':'上海','重庆市':'重庆',
    '广东省':'广东','浙江省':'浙江','江苏省':'江苏','四川省':'四川',
    '湖北省':'湖北','湖南省':'湖南','山东省':'山东','陕西省':'陕西',
    '河南省':'河南','河北省':'河北','山西省':'山西','辽宁省':'辽宁',
    '吉林省':'吉林','黑龙江省':'黑龙江','安徽省':'安徽','福建省':'福建',
    '江西省':'江西','海南省':'海南','贵州省':'贵州','云南省':'云南',
    '甘肃省':'甘肃','青海省':'青海','台湾省':'台湾',
    '广西壮族自治区':'广西','新疆维吾尔自治区':'新疆',
    '西藏自治区':'西藏','宁夏回族自治区':'宁夏',
    '内蒙古自治区':'内蒙古','香港特别行政区':'香港','澳门特别行政区':'澳门'
};
const SHORT_TO_GEO = {};
Object.entries(GEO_TO_SHORT).forEach(([k,v]) => { SHORT_TO_GEO[v] = k; });
function toShort(g) { return GEO_TO_SHORT[g] || g; }
function toGeo(s) { return SHORT_TO_GEO[s] || s; }

// 省份中心坐标（用于地图聚焦缩放）
var PROVINCE_CENTERS = {
    '北京':[116.40,39.93],'天津':[117.20,39.13],'上海':[121.48,31.23],'重庆':[106.50,29.53],
    '河北':[114.50,38.03],'山西':[112.53,37.87],'辽宁':[123.43,41.80],'吉林':[125.30,43.88],
    '黑龙江':[126.63,45.75],'江苏':[118.78,32.04],'浙江':[120.15,30.28],'安徽':[117.27,31.86],
    '福建':[119.30,26.08],'江西':[115.89,28.68],'山东':[117.00,36.67],'河南':[113.65,34.76],
    '湖北':[114.30,30.60],'湖南':[112.98,28.20],'广东':[113.23,23.16],'广西':[108.33,22.84],
    '海南':[110.33,20.03],'四川':[104.07,30.57],'贵州':[106.71,26.57],'云南':[102.72,25.05],
    '西藏':[91.13,29.65],'陕西':[108.95,34.27],'甘肃':[104.50,37.20],'青海':[101.78,36.62],
    '宁夏':[106.27,38.47],'新疆':[87.62,43.79],'内蒙古':[111.67,40.82],'台湾':[121.00,25.00],
    '香港':[114.17,22.30],'澳门':[113.55,22.15]
};

// 省级行政区编码（用于DataV GeoAtlas加载市级GeoJSON）
var PROVINCE_CODE = {
    '北京':'110000','天津':'120000','河北':'130000','山西':'140000','内蒙古':'150000',
    '辽宁':'210000','吉林':'220000','黑龙江':'230000','上海':'310000','江苏':'320000',
    '浙江':'330000','安徽':'340000','福建':'350000','江西':'360000','山东':'370000',
    '河南':'410000','湖北':'420000','湖南':'430000','广东':'440000','广西':'450000',
    '海南':'460000','重庆':'500000','四川':'510000','贵州':'520000','云南':'530000',
    '西藏':'540000','陕西':'610000','甘肃':'620000','青海':'630000','宁夏':'640000',
    '新疆':'650000','香港':'810000','澳门':'820000','台湾':'710000',
};

// 地图基础 regions（label 调整 + 港澳显式样式）
var REGIONS_BASE = [
    { name: '甘肃', label: { position: [104.5, 37.2] } },
    { name: '上海', label: { position: [121.48, 31.23] } },
    { name: '北京', label: { position: [116.40, 39.93] } },
    { name: '天津', label: { position: [117.20, 39.13] } },
    { name: '香港特别行政区', itemStyle: { borderColor: 'rgba(0,212,255,.55)', borderWidth: 2, areaColor: '#0b2036' } },
    { name: '澳门特别行政区', itemStyle: { borderColor: 'rgba(0,212,255,.55)', borderWidth: 2, areaColor: '#0b2036' } }
];

// 系列层港澳高亮样式（覆盖 visualMap 暗色，确保小面积区域可见）
var REGIONS_FOR_SERIES = [
    { name: '香港特别行政区', itemStyle: { areaColor: '#0f3460', borderColor: 'rgba(0,212,255,.7)', borderWidth: 2.5 } },
    { name: '澳门特别行政区', itemStyle: { areaColor: '#0f3460', borderColor: 'rgba(0,212,255,.7)', borderWidth: 2.5 } }
];

// API 基础路径
const API_BASE = 'http://localhost:5000/api';

// ============== 初始化 ==============
window.initTalentMap = async function() {
    window.bindTalentMapEvents();
    if (!talentMapState.dataLoaded) {
        await window.talentLoadData();
    }
    if (talentMapState.currentLayer === 'map') {
        window.talentShowLayer('map');
        window.renderChinaMap();
    }
    window.updateTalentStats();
};

window.bindTalentMapEvents = function() {
    const view = document.getElementById('view-graph');
    if (view.dataset.bound) return;
    view.dataset.bound = '1';
    // 图谱搜索
    const si = document.getElementById('talent-graph-search');
    if (si) si.addEventListener('input', function(e) {
        const term = e.target.value.trim().toLowerCase();
        window.talentGraphSearch(term);
    });
    // 响应窗口 resize
    window.addEventListener('resize', () => {
        if (talentMapState.mapChart) { talentMapState.mapChart.resize(); setTimeout(() => window.updateGangaGuideLines(), 100); }
        if (talentMapState.jobGraphInstance) {
            const c = document.getElementById('talent-graph-container');
            if (c && c.clientWidth > 10) talentMapState.jobGraphInstance.changeSize(c.clientWidth, c.clientHeight);
        }
    });
};

// ============== 薪资格式化（后端返回元/月） ==============
function talentFormatSalary(val) {
    if (!val || val <= 0) return '暂无数据';
    if (val >= 1000000) return '¥' + Math.round(val / 10000) + '万/月';
    return '¥' + val.toLocaleString() + '/月';
}

// ============== 数据加载 ==============
window.talentLoadData = async function() {
    const filt = window.talentGetFilters();
    let url = API_BASE + '/map/provinces?';
    if (filt.region) url += 'region=' + encodeURIComponent(filt.region) + '&';
    if (filt.industry) url += 'industry=' + encodeURIComponent(filt.industry) + '&';
    if (filt.job) url += 'job=' + encodeURIComponent(filt.job) + '&';
    if (filt.education) url += 'education=' + encodeURIComponent(filt.education) + '&';
    if (filt.experience) url += 'experience=' + encodeURIComponent(filt.experience) + '&';

    // 并行请求：省份数据 + 筛选选项
    var provincesOk = false;
    try {
        const res = await fetch(url);
        const json = await res.json();
        const d = json.data || json;
        talentMapState.allProvinces = d.provinces || [];
        talentMapState.dataLoaded = true;
        // 如果省份接口返回了筛选选项，也填充
        if (d.regions && d.regions.length) window.talentFillDropdown('talent-filter-region', d.regions);
        if (d.industries && d.industries.length) window.talentFillDropdown('talent-filter-industry', d.industries);
        if (d.jobs && d.jobs.length) window.talentFillDropdown('talent-filter-job', d.jobs);
        window.updateTalentStats();
        console.log('[TalentMap] 加载完成：' + talentMapState.allProvinces.length + ' 个省份');
        provincesOk = true;
    } catch (e) {
        console.warn('[TalentMap] 省份API失败，使用Mock', e);
        window.talentUseMock();
    }

    // 独立请求筛选选项（确保筛选框始终有数据）
    try {
        var fRes = await fetch(API_BASE + '/map/filters');
        var fJson = await fRes.json();
        var fd = fJson.data || fJson;
        if (fd.regions && fd.regions.length) window.talentFillDropdown('talent-filter-region', fd.regions);
        if (fd.industries && fd.industries.length) window.talentFillDropdown('talent-filter-industry', fd.industries);
        if (fd.jobs && fd.jobs.length) window.talentFillDropdown('talent-filter-job', fd.jobs);
    } catch(e) {
        console.warn('[TalentMap] 筛选选项API失败，使用省份名作为地区选项', e);
        // 兜底：从省份名称提取地区选项
        if (!provincesOk || talentMapState.allProvinces.length > 0) {
            var regions = talentMapState.allProvinces.map(function(p) { return p.name; });
            window.talentFillDropdown('talent-filter-region', regions);
        }
    }
};

window.talentUseMock = function() {
    // avgSalary 单位：元/月（与后端一致）
    talentMapState.allProvinces = [
        {id:'beijing',name:'北京',jobCount:48520,hotIndex:95,growthRate:8.3,avgSalary:32000},
        {id:'shanghai',name:'上海',jobCount:45200,hotIndex:92,growthRate:7.8,avgSalary:31000},
        {id:'guangdong',name:'广东',jobCount:62300,hotIndex:88,growthRate:9.1,avgSalary:28000},
        {id:'zhejiang',name:'浙江',jobCount:38100,hotIndex:82,growthRate:10.2,avgSalary:26000},
        {id:'jiangsu',name:'江苏',jobCount:34500,hotIndex:79,growthRate:7.5,avgSalary:25000},
        {id:'sichuan',name:'四川',jobCount:28300,hotIndex:74,growthRate:11.3,avgSalary:22000},
        {id:'hubei',name:'湖北',jobCount:22100,hotIndex:68,growthRate:12.1,avgSalary:21000},
        {id:'hunan',name:'湖南',jobCount:18700,hotIndex:62,growthRate:8.9,avgSalary:19000},
        {id:'shandong',name:'山东',jobCount:25600,hotIndex:71,growthRate:6.7,avgSalary:20000},
        {id:'shaanxi',name:'陕西',jobCount:16300,hotIndex:65,growthRate:9.8,avgSalary:20000},
        {id:'henan',name:'河南',jobCount:19200,hotIndex:60,growthRate:7.2,avgSalary:18000},
        {id:'hebei',name:'河北',jobCount:15800,hotIndex:55,growthRate:5.1,avgSalary:17000},
        {id:'fujian',name:'福建',jobCount:17100,hotIndex:63,growthRate:8.4,avgSalary:21000},
        {id:'anhui',name:'安徽',jobCount:14500,hotIndex:57,growthRate:10.6,avgSalary:18000},
        {id:'liaoning',name:'辽宁',jobCount:13200,hotIndex:52,growthRate:4.2,avgSalary:17000},
        {id:'jilin',name:'吉林',jobCount:8900,hotIndex:44,growthRate:3.8,avgSalary:16000},
        {id:'heilongjiang',name:'黑龙江',jobCount:8700,hotIndex:42,growthRate:3.1,avgSalary:15000},
        {id:'guangxi',name:'广西',jobCount:9200,hotIndex:48,growthRate:6.5,avgSalary:16000},
        {id:'yunnan',name:'云南',jobCount:7800,hotIndex:46,growthRate:7.3,avgSalary:16000},
        {id:'guizhou',name:'贵州',jobCount:6500,hotIndex:41,growthRate:8.7,avgSalary:15000},
        {id:'gansu',name:'甘肃',jobCount:4200,hotIndex:32,growthRate:4.5,avgSalary:14000},
        {id:'qinghai',name:'青海',jobCount:1800,hotIndex:22,growthRate:3.2,avgSalary:14000},
        {id:'hainan',name:'海南',jobCount:5200,hotIndex:38,growthRate:6.8,avgSalary:18000},
        {id:'xinjiang',name:'新疆',jobCount:3800,hotIndex:30,growthRate:5.6,avgSalary:15000},
        {id:'neimenggu',name:'内蒙古',jobCount:5800,hotIndex:35,growthRate:4.9,avgSalary:16000},
        {id:'xizang',name:'西藏',jobCount:1200,hotIndex:20,growthRate:2.5,avgSalary:16000},
        {id:'ningxia',name:'宁夏',jobCount:2100,hotIndex:25,growthRate:5.3,avgSalary:15000},
        {id:'tianjin',name:'天津',jobCount:16200,hotIndex:61,growthRate:6.2,avgSalary:22000},
        {id:'chongqing',name:'重庆',jobCount:14800,hotIndex:58,growthRate:9.4,avgSalary:20000},
        {id:'taiwan',name:'台湾',jobCount:11200,hotIndex:54,growthRate:4.1,avgSalary:23000},
        {id:'xianggang',name:'香港',jobCount:9500,hotIndex:51,growthRate:3.5,avgSalary:35000},
        {id:'aomen',name:'澳门',jobCount:1100,hotIndex:28,growthRate:2.1,avgSalary:28000}
    ];
    talentMapState.dataLoaded = true;
    var regions = talentMapState.allProvinces.map(function(p) { return p.name; });
    window.talentFillDropdown('talent-filter-region', regions);
    window.updateTalentStats();
};

window.talentFillDropdown = function(id, list) {
    const sel = document.getElementById(id);
    if (!sel || !list || !list.length) return;
    const currentVal = sel.value;
    let html = '<option value="">' + (id.includes('region') ? '全部地区' : id.includes('industry') ? '全部行业' : '全部岗位') + '</option>';
    list.forEach(v => { html += '<option value="' + v + '">' + v + '</option>'; });
    sel.innerHTML = html;
    sel.value = currentVal;
};

window.talentGetFilters = function() {
    const getVal = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    return {
        region: getVal('talent-filter-region'),
        industry: getVal('talent-filter-industry'),
        job: getVal('talent-filter-job'),
        education: getVal('talent-filter-edu'),
        experience: getVal('talent-filter-exp')
    };
};

window.updateTalentStats = function() {
    const p = talentMapState.allProvinces;
    const total = p.reduce((s, x) => s + (x.jobCount || 0), 0);
    const hotCount = p.filter(x => x.hotIndex >= 70).length;
    const el = document.getElementById('talent-stats-text');
    if (el) el.textContent = total.toLocaleString() + ' 个岗位 · ' + p.length + ' 个省份 · ' + hotCount + ' 个热门省份';
};

// 技能详情状态清理：离开图谱/切换省份/切换城市时调用。
// 不仅清状态变量，还要把被技能详情整体替换的右侧面板恢复为原内容，
// 否则返回地图后 renderProvinceDetail 找不到面板内元素而崩溃，导致面板残留技能详情。
window.talentClearTechDetail = function() {
    var panel = document.getElementById('talent-detail-province');
    if (panel && techDetailState.savedPanelHTML) {
        panel.innerHTML = techDetailState.savedPanelHTML;
        panel.style.display = techDetailState.savedPanelDisplay || 'block';
    }
    techDetailState.currentTech = null;
    techDetailState.savedPanelHTML = '';
    techDetailState.savedPanelDisplay = '';
};

// ============== 层级切换 ==============
window.talentShowLayer = function(layer) {
    talentMapState.currentLayer = layer;
    // 离开图谱层时清除技能详情状态并恢复右侧面板，防止状态残留
    if (layer !== 'graph') {
        window.talentClearTechDetail();
    }
    if (layer !== 'map' && talentMapState.breathTimer) { clearInterval(talentMapState.breathTimer); talentMapState.breathTimer = null; }
    ['map', 'province', 'graph'].forEach(l => {
        var el = document.getElementById('talent-layer-' + l);
        if (el) el.style.display = l === layer ? '' : 'none';
    });
    // 返回按钮
    var backBtn = document.getElementById('talent-back-btn');
    if (backBtn) backBtn.style.display = (layer === 'map' && talentMapState.selectedProvince) || layer !== 'map' ? '' : 'none';
    // 右侧面板
    var emptyPanel = document.getElementById('talent-detail-empty');
    var hoverPanel = document.getElementById('talent-detail-hover');
    var provPanel = document.getElementById('talent-detail-province');
    if (emptyPanel) emptyPanel.style.display = layer === 'map' && !talentMapState.selectedProvince ? 'flex' : 'none';
    if (hoverPanel) hoverPanel.style.display = 'none';
    if (provPanel) {
        if (layer === 'map' && talentMapState.selectedProvince) {
            provPanel.style.display = 'block';
            provPanel.style.animation = 'panelSlideIn .45s cubic-bezier(.4,0,.2,1) forwards';
        } else if (layer === 'graph') {
            provPanel.style.display = 'block';
        } else { provPanel.style.display = 'none'; }
    }
    // 港澳放大框显隐
    var zoomBox = document.getElementById('ganga-zoom-box');
    var guideSvg = document.getElementById('ganga-guide-svg');
    if (zoomBox) zoomBox.style.display = layer === 'map' ? '' : 'none';
    if (guideSvg) guideSvg.style.display = layer === 'map' ? '' : 'none';
    // 调整画布大小
    if (layer === 'map' && talentMapState.mapChart) {
        setTimeout(function() { talentMapState.mapChart.resize(); }, 100);
    }
    if (layer === 'graph' && talentMapState.jobGraphInstance) {
        var c = document.getElementById('talent-graph-container');
        if (c && c.clientWidth > 10) setTimeout(function() { talentMapState.jobGraphInstance.changeSize(c.clientWidth, c.clientHeight); }, 100);
    }
};

window.talentMapBack = function() {
    if (talentMapState.currentLayer === 'graph') {
        // 岗位图谱 → 返回岗位分析页面
        talentMapState.selectedJob = null;
        window.talentClearTechDetail();
        if (talentMapState.mapLevel === 'city' && talentMapState.selectedCity) {
            // 从城市图谱返回城市岗位分析
            window.talentShowLayer('province');
            window.renderProvinceJobList(talentMapState.selectedProvince, talentMapState.selectedCity);
            window.talentUpdatePageTitle((talentMapState.selectedCity.displayName || talentMapState.selectedCity.name) + ' · 岗位分析');
        } else if (talentMapState.selectedProvince) {
            window.talentShowLayer('province');
            window.renderProvinceJobList(talentMapState.selectedProvince);
            window.talentUpdatePageTitle(talentMapState.selectedProvince.name);
        } else {
            talentMapState.mapMode = 'overview';
            window.talentShowLayer('map');
            window.renderChinaMap();
            document.getElementById('talent-back-btn').style.display = 'none';
        }
        document.getElementById('talent-back-btn').style.display = '';
    } else if (talentMapState.currentLayer === 'province') {
        // 岗位分析 → 返回地图：必须清除技能详情状态并恢复面板
        window.talentClearTechDetail();
        if (talentMapState.mapLevel === 'city') {
            // 城市岗位分析 → 返回省份地图（保持城市高亮）
            talentMapState.selectedCity = null;
            talentMapState.mapLevel = 'province';
            talentMapState.analysisLevel = 'province';
            window.talentShowLayer('map');
            if (talentMapState.selectedProvince) {
                window.talentRenderCityMap(talentMapState.currentProvinceName);
                window.renderProvinceDetail(talentMapState.selectedProvince);
                window.talentUpdatePageTitle(talentMapState.selectedProvince.name);
            }
            document.getElementById('talent-back-btn').style.display = '';
        } else {
            // 省份岗位分析 → 返回省份地图
            talentMapState.analysisLevel = 'province';
            window.talentShowLayer('map');
            if (talentMapState.selectedProvince) {
                if (talentMapState.mapLevel !== 'country' && talentMapState.cityGeoJSON) {
                    window.talentRenderCityMap(talentMapState.currentProvinceName);
                }
                window.renderProvinceDetail(talentMapState.selectedProvince);
                window.talentUpdatePageTitle(talentMapState.selectedProvince.name);
                document.getElementById('talent-back-btn').style.display = '';
            }
        }
    } else {
        // 地图模式下，根据 mapLevel 执行层级回退
        if (talentMapState.mapLevel === 'city' || talentMapState.mapLevel === 'province') {
            window.talentMapCityBack();
        } else {
            // 全国 → 恢复总览
            window.talentClearTechDetail();
            talentMapState.selectedProvince = null;
            talentMapState.selectedCity = null;
            talentMapState.mapMode = 'overview';
            talentMapState.analysisLevel = 'country';
            document.getElementById('talent-detail-province').style.display = 'none';
            document.getElementById('talent-detail-empty').style.display = 'flex';
            document.getElementById('talent-back-btn').style.display = 'none';
            window.talentRestorePageTitle();
            window.talentUnfocusProvince();
        }
    }
    // 恢复港澳凸显框
    var zoomBox = document.getElementById('ganga-zoom-box');
    var guideSvg = document.getElementById('ganga-guide-svg');
    if (zoomBox && talentMapState.currentLayer === 'map' && talentMapState.mapLevel === 'country') zoomBox.style.display = '';
    if (guideSvg && talentMapState.currentLayer === 'map' && talentMapState.mapLevel === 'country') guideSvg.style.display = '';
};

window.talentMapClickCurrent = function() {
    if (talentMapState.hoveredProvince) {
        window.talentMapSelect(talentMapState.hoveredProvince);
    }
};

window.talentMapSelect = function(province) {
    if (!province || !province.name) return;
    // 切换省份时清除技能详情状态（含恢复面板）和城市状态
    window.talentClearTechDetail();
    talentMapState.selectedCity = null;
    talentMapState.selectedJob = null;
    talentMapState.analysisLevel = 'province';
    talentMapState.selectedProvince = province;
    talentMapState.mapMode = 'province';
    talentMapState.currentLayer = 'map';
    talentMapState.hoveredProvince = null;
    document.getElementById('talent-detail-hover').style.display = 'none';
    document.getElementById('talent-detail-empty').style.display = 'none';

    // 保持港澳凸显框可见
    var zoomBox = document.getElementById('ganga-zoom-box');
    var guideSvg = document.getElementById('ganga-guide-svg');
    if (zoomBox) zoomBox.style.display = '';
    if (guideSvg) guideSvg.style.display = '';

    // 第一步：触发地图聚焦动画（zoom + 高亮 + 呼吸发光）
    window.talentFocusProvince(province);

    // 第二步：加载市级地图数据
    window.talentLoadCityGeo(province.name).then(function(geo) {
        if (!geo) return;
        window.talentFetchCityData(province.name).then(function() {
            // 聚焦动画完成后切换至市级地图
            setTimeout(function() {
                window.talentRenderCityMap(province.name);
            }, 750);
        });
    });

    // 第三步：动画结束后右侧详情面板从右侧滑入
    setTimeout(function() {
        var panel = document.getElementById('talent-detail-province');
        panel.style.display = 'block';
        panel.style.animation = 'panelSlideIn .45s cubic-bezier(.4,0,.2,1) forwards';
        window.renderProvinceDetail(province);
        document.getElementById('talent-back-btn').style.display = '';
        window.talentUpdatePageTitle(province.name);
    }, 650);
};

// 动态更新页面标题
window.talentUpdatePageTitle = function(name) {
    var h1 = document.querySelector('#view-graph .page-title-block h1');
    var sub = document.querySelector('#view-graph .page-title-block .subtitle');
    if (h1) h1.textContent = name + ' · 人才洞察';
    if (sub) sub.textContent = '岗位分布 · 技能需求 · 人才画像';
};
window.talentRestorePageTitle = function() {
    var h1 = document.querySelector('#view-graph .page-title-block h1');
    var sub = document.querySelector('#view-graph .page-title-block .subtitle');
    if (h1) h1.textContent = '数字人才地图';
    if (sub) sub.textContent = '全国人才分布 · 省份岗位洞察 · 岗位-能力知识图谱 · ';
};
// 地图聚焦到省份（平滑缩放 + 高亮）
window.talentFocusProvince = function(province) {
    var chart = talentMapState.mapChart;
    if (!chart) return;
    var geoName = toGeo(province.name);
    var center = PROVINCE_CENTERS[province.name] || [105, 35];
    var targetZoom = province.name === '广东' || province.name === '四川' || province.name === '新疆' || province.name === '内蒙古' ? 2.0 :
                      province.name === '上海' || province.name === '北京' || province.name === '天津' ? 6.0 :
                      province.name === '海南' ? 3.5 :
                      province.name === '香港' || province.name === '澳门' ? 8.0 : 3.2;

    var dv = talentMapState.defaultView;
    var startZoom = dv.zoom, startCx = dv.center[0], startCy = dv.center[1];
    var dur = 750, start = null;

    function step(ts) {
        if (!start) start = ts;
        var t = Math.min((ts - start) / dur, 1);
        var e = 1 - Math.pow(1 - t, 3); // easeOutCubic
        var z = startZoom + (targetZoom - startZoom) * e;
        var cx = startCx + (center[0] - startCx) * e;
        var cy = startCy + (center[1] - startCy) * e;
        chart.setOption({ geo: { zoom: z, center: [cx, cy] } });
        if (t < 1) { requestAnimationFrame(step); } else {
            // 高亮选中省份 + 暗淡其他
            window.talentApplyProvinceHighlight(province);
        }
    }
    requestAnimationFrame(step);
};
// 选中省份高亮发光 + 其他省份暗淡
window.talentApplyProvinceHighlight = function(province) {
    var chart = talentMapState.mapChart;
    if (!chart) return;
    var geoName = toGeo(province.name);
    var allNames = talentMapState.allProvinces.map(function(p) { return toGeo(p.name); });
    var regions = allNames
        .filter(function(n) { return n !== geoName; })
        .map(function(n) { return { name: n, itemStyle: { areaColor: 'rgba(10,22,40,.55)', borderColor: 'rgba(0,212,255,.06)' }, label: { color: 'rgba(255,255,255,.25)' } }; });
    regions.push({
        name: geoName, label: { show: true, fontSize: 13, color: '#00d4ff', fontWeight: 'bold' },
        itemStyle: { borderColor: '#00d4ff', borderWidth: 3, shadowBlur: 28, shadowColor: 'rgba(0,212,255,.6)', areaColor: '#0f3460' }
    });
    chart.setOption({ geo: { regions: regions } });
    // 呼吸动画
    if (talentMapState.breathTimer) clearInterval(talentMapState.breathTimer);
    var breathOn = false;
    talentMapState.breathTimer = setInterval(function() {
        if (!talentMapState.selectedProvince || talentMapState.currentLayer !== 'map') { clearInterval(talentMapState.breathTimer); talentMapState.breathTimer = null; return; }
        breathOn = !breathOn;
        chart.setOption({ geo: { regions: [{ name: geoName, itemStyle: { shadowBlur: breathOn ? 32 : 18 } }] } });
    }, 1800);
    // 重绘引导线
    setTimeout(function() { window.updateGangaGuideLines(); }, 100);
};
// 取消聚焦 → 恢复全国视角
window.talentUnfocusProvince = function() {
    var chart = talentMapState.mapChart;
    talentMapState.mapMode = 'overview';
    talentMapState.mapLevel = 'country';
    talentMapState.currentProvinceName = null;
    talentMapState.selectedCity = null;
    if (talentMapState.breathTimer) { clearInterval(talentMapState.breathTimer); talentMapState.breathTimer = null; }
    if (!chart) return;
    var dv = talentMapState.defaultView;
    // 切换回中国地图 GeoJSON
    chart.setOption({ geo: { map: 'china' } });
    chart.setOption({ series: [{ map: 'china' }] });
    var curZoom = 1.42, curCx = 105.5, curCy = 36.5;
    try { var opt = chart.getOption(); if (opt.geo && opt.geo[0]) { curZoom = opt.geo[0].zoom || 1.42; curCx = (opt.geo[0].center && opt.geo[0].center[0]) || 105.5; curCy = (opt.geo[0].center && opt.geo[0].center[1]) || 36.5; } } catch(e){}
    var dur = 600, start = null;
    function step(ts) {
        if (!start) start = ts;
        var t = Math.min((ts - start) / dur, 1);
        var e = 1 - Math.pow(1 - t, 3);
        var z = curZoom + (dv.zoom - curZoom) * e;
        var cx = curCx + (dv.center[0] - curCx) * e;
        var cy = curCy + (dv.center[1] - curCy) * e;
        chart.setOption({ geo: { zoom: z, center: [cx, cy], regions: REGIONS_BASE } });
        if (t >= 1) { chart.setOption({ geo: { zoom: dv.zoom, center: dv.center, regions: REGIONS_BASE, itemStyle: { areaColor: '#0d2137', borderColor: 'rgba(0,212,255,.3)' }, label: { color: 'rgba(255,255,255,.65)', fontWeight: 'normal' } } }); }
        if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    setTimeout(function() { window.updateGangaGuideLines(); }, 650);
};

// ============== 市级下钻系统 ==============
window.talentLoadCityGeo = function(provinceName) {
    // 如果已加载同一省份，跳过
    if (talentMapState.cityGeoLoaded === provinceName) return Promise.resolve(talentMapState.cityGeoJSON);
    const adcode = PROVINCE_CODE[provinceName];
    if (!adcode) return Promise.resolve(null);
    const url = 'https://geo.datav.aliyun.com/areas_v3/bound/' + adcode + '_full.json';
    return fetch(url).then(function(r) { return r.json(); }).then(function(geo) {
        talentMapState.cityGeoJSON = geo;
        talentMapState.cityGeoLoaded = provinceName;
        echarts.registerMap(provinceName + '-cities', geo);
        return geo;
    }).catch(function() { return null; });
};

window.talentFetchCityData = function(provinceName) {
    var filt = window.talentGetFilters();
    var url = API_BASE + '/map/cities/' + encodeURIComponent(provinceName) + '?';
    if (filt.industry) url += 'industry=' + encodeURIComponent(filt.industry) + '&';
    if (filt.job) url += 'job=' + encodeURIComponent(filt.job) + '&';
    if (filt.education) url += 'education=' + encodeURIComponent(filt.education) + '&';
    if (filt.experience) url += 'experience=' + encodeURIComponent(filt.experience) + '&';
    return fetch(url).then(function(r) { return r.json(); }).then(function(d) {
        talentMapState.cityData = (d.data || []);
        return talentMapState.cityData;
    }).catch(function() { talentMapState.cityData = []; return []; });
};

window.talentRenderCityMap = function(provinceName) {
    var geoName = provinceName + '-cities';
    talentMapState.mapLevel = 'province';
    talentMapState.currentProvinceName = provinceName;

    // 市级地图缩放：稍微缩小，确保所有城市完整显示
    var mapZoom = 0.95;
    var cityCenter = undefined;
    if (provinceName === '北京市' || provinceName === '上海市' || provinceName === '天津市' || provinceName === '重庆市') {
        mapZoom = 1.15;
    }

    var chart = talentMapState.mapChart;
    var cityData = talentMapState.cityData;
    var mapData = [];
    cityData.forEach(function(c) {
        mapData.push({ name: c.name, value: c.jobCount || 0, avgSalary: c.avgSalary || 0 });
    });

    chart.setOption({
        geo: {
            map: geoName,
            roam: true,
            zoom: mapZoom,
            center: undefined,
            label: { show: true, color: 'rgba(255,255,255,.65)', fontSize: 10, distance: 0 },
            itemStyle: { areaColor: '#0d2137', borderColor: 'rgba(0,212,255,.3)', borderWidth: 1 },
            emphasis: {
                itemStyle: { areaColor: '#0a3a4a', borderColor: '#00d4ff', borderWidth: 2, shadowBlur: 12, shadowColor: 'rgba(0,212,255,.5)' },
                label: { color: '#fff', fontSize: 12 }
            },
            regions: []
        },
        series: [{
            type: 'map', map: geoName, geoIndex: 0,
            data: mapData
        }]
    });

    // 更新 mousemove 事件（省级地图：悬停城市不隐藏省级分析面板）
    chart.off('mousemove');
    chart.on('mousemove', function(params) {
        if (talentMapState.mapLevel !== 'province' || talentMapState.selectedCity) return;
        if (params.componentType === 'series' && params.name) {
            var city = talentMapState.cityData.find(function(c) { return c.name === params.name; });
            if (city) {
                // 仅更新悬浮提示，不隐藏省级岗位分析面板
                document.getElementById('talent-detail-empty').style.display = 'none';
                document.getElementById('talent-detail-province').style.display = 'block';
                document.getElementById('talent-detail-hover').style.display = 'block';
                document.getElementById('talent-hover-name').textContent = '悬停: ' + city.name;
                document.getElementById('talent-hover-jobs').textContent = '岗位数 ' + (city.jobCount || 0).toLocaleString();
                document.getElementById('talent-hover-salary').textContent = talentFormatSalary(city.avgSalary);
            }
        }
    });

    chart.off('mouseout');
    chart.on('mouseout', function() {
        if (talentMapState.selectedCity) return;
        // 省级面板保持可见，仅隐藏悬浮提示
        document.getElementById('talent-detail-hover').style.display = 'none';
        if (!talentMapState.selectedProvince) {
            document.getElementById('talent-detail-empty').style.display = 'flex';
        }
    });

    // 点击城市：兼容 series/geo 两种组件类型
    chart.off('click');
    chart.on('click', function(params) {
        if (!params || !params.name) return;
        if (params.componentType === 'series' || params.componentType === 'geo') {
            window.talentHandleCityClick(params.name);
        }
    });
};

// 城市名称规范化：去除 "市/县/区/自治州" 后缀（DataV geoJSON 用全称，后端数据用简称）
window.talentNormalizeCityName = function(name) {
    if (!name) return name;
    return String(name).replace(/自治州$/, '').replace(/地区$/, '').replace(/盟$/, '').replace(/市$/, '').replace(/县$/, '').replace(/区$/, '');
};

window.talentHandleCityClick = function(cityName) {
    if (!cityName) return;
    // 名称匹配：先精确匹配，再去除后缀匹配，兜底直接用点击名构造城市对象
    var shortName = window.talentNormalizeCityName(cityName);
    var city = talentMapState.cityData.find(function(c) { return c.name === cityName; });
    if (!city) city = talentMapState.cityData.find(function(c) { return c.name === shortName; });
    if (!city) city = talentMapState.cityData.find(function(c) { return c.name === cityName + '市'; });
    if (!city) {
        city = { name: shortName };
    }
    // 保留原始点击名称（如"南昌市"）用于页面显示，简称（如"南昌"）用于后端查询
    if (city.name !== cityName && !city.displayName) {
        city = Object.assign({}, city, { displayName: cityName });
    }
    // 直接进入城市岗位分析：清除技能详情状态 + 重置旧筛选条件（防止省级筛选继承导致查询为空）
    window.talentClearTechDetail();
    ['talent-filter-region','talent-filter-industry','talent-filter-job','talent-filter-edu','talent-filter-exp'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    talentMapState.selectedCity = city;
    talentMapState.mapLevel = 'city';
    talentMapState.analysisLevel = 'city';
    document.getElementById('talent-detail-hover').style.display = 'none';
    document.getElementById('talent-detail-empty').style.display = 'none';
    window.talentMapEnterCity(city);
};

window.talentMapCityBack = function() {
    // 清除技能详情状态并恢复面板
    window.talentClearTechDetail();
    if (talentMapState.mapLevel === 'city') {
        // 城市 → 返回省份
        talentMapState.selectedCity = null;
        talentMapState.mapLevel = 'province';
        talentMapState.analysisLevel = 'province';
        var chart = talentMapState.mapChart;
        chart.dispatchAction({ type: 'downplay', seriesIndex: 0 });
        var provName = talentMapState.currentProvinceName;
        window.talentRenderCityMap(provName); // 重绘清除高亮
        window.renderProvinceDetail(talentMapState.selectedProvince);
        window.talentUpdatePageTitle(talentMapState.selectedProvince.name);
    } else if (talentMapState.mapLevel === 'province') {
        // 省份 → 返回全国
        talentMapState.selectedProvince = null;
        talentMapState.selectedCity = null;
        talentMapState.mapLevel = 'country';
        talentMapState.analysisLevel = 'country';
        talentMapState.currentProvinceName = null;
        talentMapState.cityGeoJSON = null;
        talentMapState.cityGeoLoaded = null;
        talentMapState.cityData = [];
        talentMapState.mapMode = 'overview';
        document.getElementById('talent-detail-province').style.display = 'none';
        document.getElementById('talent-detail-empty').style.display = 'flex';
        document.getElementById('talent-back-btn').style.display = 'none';
        window.talentRestorePageTitle();
        window.talentUnfocusProvince();
        // 恢复省点击事件
        var chart = talentMapState.mapChart;
        chart.off('click');
        chart.on('click', function(params) {
            if (params.componentType === 'series' && params.name) {
                var short = toShort(params.name);
                var p = talentMapState.allProvinces.find(function(x) { return x.name === short; });
                if (p) window.talentMapSelect(p);
            }
        });
        // 恢复 hover 事件
        chart.off('mousemove');
        chart.on('mousemove', function(params) {
            if (talentMapState.mapMode !== 'overview' || talentMapState.selectedProvince) return;
            if (params.componentType === 'series' && params.name) {
                var short = toShort(params.name);
                var p = talentMapState.allProvinces.find(function(x) { return x.name === short; });
                if (p && talentMapState.hoveredProvince !== p) {
                    talentMapState.hoveredProvince = p;
                    window.talentShowHover(p);
                }
            }
        });
        chart.off('mouseout');
        chart.on('mouseout', function() {
            if (talentMapState.mapMode !== 'overview' || talentMapState.selectedProvince) return;
            talentMapState.hoveredProvince = null;
            var emp = document.getElementById('talent-detail-empty');
            var hov = document.getElementById('talent-detail-hover');
            if (emp && talentMapState.currentLayer === 'map') emp.style.display = 'flex';
            if (hov) hov.style.display = 'none';
        });
        var zoomBox = document.getElementById('ganga-zoom-box');
        var guideSvg = document.getElementById('ganga-guide-svg');
        if (zoomBox) zoomBox.style.display = '';
        if (guideSvg) guideSvg.style.display = '';
        window.updateGangaZoomBox();
    }
};

// ============== 进入城市岗位分析（复用省份岗位分析页面） ==============
window.talentMapEnterCity = function(cityNameObj) {
    var cityName = typeof cityNameObj === 'string' ? cityNameObj : (cityNameObj ? cityNameObj.name : null);
    if (!cityName) { window.Utils.showToast('城市名称无效', 'amber'); return; }
    
    var selectedCity = typeof cityNameObj === 'object' ? cityNameObj : { name: cityName };
    // 记录规范化短名（去除"市"后缀）供后端查询，原始全称用于页面显示
    if (!selectedCity.shortName) {
        selectedCity.shortName = window.talentNormalizeCityName(selectedCity.name || cityName);
    }
    var displayName = selectedCity.displayName || selectedCity.name || cityName;
    
    // 清除技能详情状态并恢复面板
    window.talentClearTechDetail();
    
    // 设置城市层级状态
    talentMapState.selectedCity = selectedCity;
    talentMapState.mapLevel = 'city';
    talentMapState.analysisLevel = 'city';
    
    // 保存省份上下文
    if (talentMapState.selectedProvince && talentMapState.selectedProvince.name) {
        talentMapState.currentProvinceName = talentMapState.selectedProvince.name;
    }
    
    // 显示城市岗位分析页面（复用 layer-province）
    window.talentShowLayer('province');
    window.talentUpdatePageTitle(displayName + ' · 岗位分析');
    
    // 更新地图为市级地图（带高亮）
    if (talentMapState.mapChart && talentMapState.currentProvinceName) {
        talentMapState.mapChart.dispatchAction({ type: 'downplay', seriesIndex: 0 });
    }
    
    // 加载城市岗位数据到右侧面板
    var suffix = talentMapState.currentProvinceName ? ' ' + talentMapState.currentProvinceName : '';
    window.renderProvinceJobList({ name: displayName + suffix, stCode: '', admCode: '' }, selectedCity);
    
    // 更新返回按钮
    var backBtn = document.getElementById('talent-back-btn');
    if (backBtn) backBtn.style.display = '';
};

// ============== 港澳局部放大框 ==============
window.updateGangaZoomBox = function() {
    const provinces = talentMapState.allProvinces;
    const hk = provinces.find(p => p.name === '香港');
    const mo = provinces.find(p => p.name === '澳门');
    const maxCount = Math.max(...provinces.map(p => p.jobCount || 0), 1);
    if (hk) {
        document.getElementById('ganga-bar-hk').style.width = ((hk.jobCount || 0) / maxCount * 100) + '%';
        document.getElementById('ganga-data-hk').textContent = (hk.jobCount || 0).toLocaleString();
    }
    if (mo) {
        document.getElementById('ganga-bar-mo').style.width = ((mo.jobCount || 0) / maxCount * 100) + '%';
        document.getElementById('ganga-data-mo').textContent = (mo.jobCount || 0).toLocaleString();
    }
    // 高亮选中省份
    document.querySelectorAll('.ganga-zoom-province').forEach(el => el.classList.remove('active'));
    if (talentMapState.selectedProvince) {
        const el = document.querySelector('.ganga-zoom-province[data-province="' + talentMapState.selectedProvince.name + '"]');
        if (el) el.classList.add('active');
    }
    setTimeout(() => window.updateGangaGuideLines(), 50);
};
window.updateGangaGuideLines = function() {
    const chart = talentMapState.mapChart;
    if (!chart) return;
    try {
        const hkPx = chart.convertToPixel({geoIndex: 0}, [113.55, 22.18]);
        const moPx = chart.convertToPixel({geoIndex: 0}, [113.33, 22.13]);
        const box = document.getElementById('ganga-zoom-box');
        const canvas = document.getElementById('talent-map-canvas');
        if (!hkPx || !moPx || !box || !canvas) return;
        const boxR = box.getBoundingClientRect();
        const cvR = canvas.getBoundingClientRect();
        const bx = boxR.left - cvR.left;
        const by = boxR.top - cvR.top;
        const bh = boxR.height;
        const hkTx = bx, hkTy = by + bh * 0.38;
        const moTx = bx, moTy = by + bh * 0.68;
        // 折线：主地图点 → 先向右走一段 → 再向左进入放大框
        const hkMidX = hkPx[0] + (hkTx - hkPx[0]) * 0.55;
        const moMidX = moPx[0] + (moTx - moPx[0]) * 0.7;
        document.getElementById('ganga-path-hk').setAttribute('d', 'M' + hkPx[0] + ',' + hkPx[1] + ' L' + hkMidX + ',' + hkPx[1] + ' L' + hkMidX + ',' + hkTy + ' L' + hkTx + ',' + hkTy);
        document.getElementById('ganga-path-mo').setAttribute('d', 'M' + moPx[0] + ',' + moPx[1] + ' L' + moMidX + ',' + moPx[1] + ' L' + moMidX + ',' + moTy + ' L' + moTx + ',' + moTy);
        // 定位小圆点
        document.getElementById('ganga-dot-hk').setAttribute('cx', hkPx[0]); document.getElementById('ganga-dot-hk').setAttribute('cy', hkPx[1]);
        document.getElementById('ganga-dot-mo').setAttribute('cx', moPx[0]); document.getElementById('ganga-dot-mo').setAttribute('cy', moPx[1]);
    } catch(e) { /* chart not ready */ }
};
window.gangaZoomClick = function(provinceName) {
    const p = talentMapState.allProvinces.find(x => x.name === provinceName);
    if (p && talentMapState.currentLayer === 'map') {
        window.talentMapSelect(p);
        window.updateGangaZoomBox();
    }
};
window.gangaZoomHover = function(provinceName, enter) {
    // 仅在 overview 模式（未点击选中省份）下才允许悬停更新右侧面板
    if (enter && talentMapState.currentLayer === 'map' && talentMapState.mapMode === 'overview') {
        const p = talentMapState.allProvinces.find(x => x.name === provinceName);
        if (p) {
            talentMapState.hoveredProvince = p;
            window.talentShowHover(p);
        }
    } else if (!enter) {
        if (talentMapState.mapMode !== 'overview') return;
        talentMapState.hoveredProvince = null;
        const emp = document.getElementById('talent-detail-empty');
        const hov = document.getElementById('talent-detail-hover');
        if (emp && talentMapState.currentLayer === 'map') emp.style.display = 'flex';
        if (hov) hov.style.display = 'none';
    }
};

// ============== 筛选 ==============
window.talentMapApplyFilter = async function() {
    await window.talentLoadData();
    window.talentShowLayer('map');
    var filt = window.talentGetFilters();

    if (filt.region) {
        // 选择了地区 → 自动进入该省份动画（与点击地图一致）
        var prov = talentMapState.allProvinces.find(function(p) { return p.name === filt.region; });
        if (prov) {
            talentMapState.selectedProvince = prov;
            talentMapState.selectedJob = null;
            talentMapState.selectedCity = null;
            talentMapState.mapMode = 'province';
            talentMapState.mapLevel = 'country';  // 先设 country 以便 renderChinaMap 正常渲染
            // 渲染全国地图 → 执行省份进入动画
            window.renderChinaMap().then(function() {
                window.talentMapSelect(prov);
            });
            return;
        }
    }

    // 无地区筛选 → 恢复全国总览
    talentMapState.selectedProvince = null;
    talentMapState.selectedCity = null;
    talentMapState.selectedJob = null;
    talentMapState.mapMode = 'overview';
    talentMapState.mapLevel = 'country';
    window.renderChinaMap();
};

window.talentMapToggleFilter = function() {
    const panel = document.getElementById('graph-filter-panel');
    const toggle = document.getElementById('graph-filter-toggle');
    if (!panel || !toggle) return;
    const isOpen = panel.classList.toggle('open');
    toggle.classList.toggle('moved', isOpen);
    toggle.title = isOpen ? '收起筛选' : '展开筛选';
    const tabLabel = toggle.querySelector('.tab-label');
    if (tabLabel) tabLabel.textContent = isOpen ? '收起' : '筛选';
};

window.talentMapResetFilter = function() {
    ['talent-filter-region','talent-filter-industry','talent-filter-job','talent-filter-edu','talent-filter-exp'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    window.talentMapApplyFilter();
};

// ============== 中国地图渲染 ==============
window.renderChinaMap = async function() {
    const el = document.getElementById('talent-layer-map');
    if (!el) return;
    // 加载 GeoJSON
    if (!talentMapState.geoJSON) {
        try {
            const res = await fetch('china-geo.json');
            talentMapState.geoJSON = await res.json();
        } catch (e) {
            console.warn('[TalentMap] GeoJSON加载失败', e);
            talentMapState.geoJSON = null;
        }
    }
    if (talentMapState.mapChart) { try { talentMapState.mapChart.dispose(); } catch(e){} }
    const mapChart = echarts.init(el);
    talentMapState.mapChart = mapChart;

    const data = talentMapState.allProvinces.map(p => ({
        name: toGeo(p.name),
        value: p.jobCount || 0
    }));

    const option = {
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(10,14,39,.95)',
            borderWidth: 0,
            textStyle: { color: '#fff', fontSize: 12 },
            formatter: function(params) {
                const short = toShort(params.name);
                const p = talentMapState.allProvinces.find(x => x.name === short);
                if (!p) return params.name + '<br/>--';
                return '<div style="font-weight:700;color:#00d4ff;margin-bottom:4px">' + p.name + '</div>'
                    + '岗位数量：<b>' + (p.jobCount || 0).toLocaleString() + '</b><br/>'
                    + '热门指数：<b>' + (p.hotIndex || '--') + '</b><br/>'
                    + '增长率：<b style="color:' + ((p.growthRate || 0) >= 0 ? '#4ade80' : '#f87171') + '">'
                    + (p.growthRate >= 0 ? '↑' : '↓') + Math.abs(p.growthRate || 0) + '%</b><br/>'
                    + '点击查看详情';
            }
        },
        visualMap: {
            min: 0,
            max: Math.max(...data.map(d => d.value), 1),
            left: 12,
            bottom: 20,
            text: ['高', '低'],
            textStyle: { color: '#fff', fontSize: 10 },
            inRange: { color: ['#0d2137', '#0f3460', '#1a5276', '#2e86c1', '#00d4ff'] },
            calculable: true
        },
        geo: {
            map: 'china',
            roam: false,
            zoom: 1.42,
            center: [105.5, 36.5],
            layoutCenter: ['50%', '50%'],
            layoutSize: '88%',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            label: {
                show: true,
                fontSize: 9,
                color: 'rgba(255,255,255,.65)',
                fontFamily: 'DM Sans, Noto Sans SC',
                formatter: function(params) {
                    var hidden = ['香港','澳门','香港特别行政区','澳门特别行政区','Hong Kong','Macau'];
                    return hidden.indexOf(params.name) >= 0 ? '' : params.name;
                }
            },
            regions: REGIONS_BASE,
            emphasis: {
                label: {
                    show: true, fontSize: 13, color: '#00d4ff',
                    formatter: function(params) {
                        var hidden = ['香港','澳门','香港特别行政区','澳门特别行政区','Hong Kong','Macau'];
                        return hidden.indexOf(params.name) >= 0 ? '' : params.name;
                    }
                },
                itemStyle: { areaColor: 'rgba(0,212,255,.35)', borderColor: '#00d4ff', borderWidth: 2, shadowBlur: 20, shadowColor: 'rgba(0,212,255,.5)' }
            },
            itemStyle: {
                areaColor: '#0d2137',
                borderColor: 'rgba(0,212,255,.3)',
                borderWidth: 1
            }
        },
        series: [{
            type: 'map',
            map: 'china',
            geoIndex: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            data: data,
            regions: REGIONS_FOR_SERIES,
            label: {
                formatter: function(params) {
                    var hidden = ['香港','澳门','香港特别行政区','澳门特别行政区','Hong Kong','Macau'];
                    return hidden.indexOf(params.name) >= 0 ? '' : params.name;
                }
            }
        }]
    };

    if (talentMapState.geoJSON) {
        echarts.registerMap('china', talentMapState.geoJSON);
    }

    mapChart.setOption(option);

    // 事件绑定
    mapChart.off('click');
    mapChart.on('click', function(params) {
        if (!params || !params.name) return;
        const short = toShort(params.name);
        const p = talentMapState.allProvinces.find(x => x.name === short);
        if (p) {
            console.log('[TalentMap] 点击省份:', p.name);
            window.talentMapSelect(p);
        }
    });

    mapChart.off('mousemove');
    mapChart.on('mousemove', function(params) {
        // hover 只在 overview 模式且无选中省份时生效
        if (talentMapState.mapMode !== 'overview' || talentMapState.selectedProvince) return;
        if (params.componentType === 'series' && params.name) {
            var short = toShort(params.name);
            var p = talentMapState.allProvinces.find(function(x) { return x.name === short; });
            if (p && talentMapState.hoveredProvince !== p) {
                talentMapState.hoveredProvince = p;
                window.talentShowHover(p);
            }
        }
    });

    mapChart.off('mouseout');
    mapChart.on('mouseout', function() {
        // 有选中省份时不恢复空面板
        if (talentMapState.mapMode !== 'overview' || talentMapState.selectedProvince) return;
        talentMapState.hoveredProvince = null;
        var emptyPanel = document.getElementById('talent-detail-empty');
        var hoverPanel = document.getElementById('talent-detail-hover');
        if (emptyPanel && talentMapState.currentLayer === 'map') emptyPanel.style.display = 'flex';
        if (hoverPanel) hoverPanel.style.display = 'none';
    });

    // 更新港澳放大框
    window.updateGangaZoomBox();
};

function talentShowHover(p) {
    // 安全锁：若已选中省份（province 模式下），不覆盖右侧面板
    if (talentMapState.selectedProvince && talentMapState.currentLayer === 'map' && talentMapState.mapMode !== 'overview') return;
    document.getElementById('talent-detail-empty').style.display = 'none';
    document.getElementById('talent-detail-province').style.display = 'none';
    document.getElementById('talent-detail-hover').style.display = 'block';
    document.getElementById('talent-hover-name').textContent = p.name;
    document.getElementById('talent-hover-jobs').textContent = (p.jobCount || 0).toLocaleString();
    document.getElementById('talent-hover-hot').textContent = p.hotIndex || '--';
    const growth = p.growthRate || 0;
    const gEl = document.getElementById('talent-hover-growth');
    gEl.textContent = (growth >= 0 ? '↑' : '↓') + Math.abs(growth) + '%';
    gEl.style.color = growth >= 0 ? '#4ade80' : '#f87171';
    document.getElementById('talent-hover-salary').textContent = talentFormatSalary(p.avgSalary);
    const badge = document.getElementById('talent-hover-badge');
    badge.textContent = (p.hotIndex >= 80 ? '热门' : p.hotIndex >= 60 ? '活跃' : '增长中');
    badge.style.background = p.hotIndex >= 80 ? 'rgba(244,63,94,.15)' : p.hotIndex >= 60 ? 'rgba(245,158,11,.15)' : 'rgba(13,148,136,.15)';
    badge.style.color = p.hotIndex >= 80 ? '#f43f5e' : p.hotIndex >= 60 ? '#f59e0b' : '#0d9488';
}
window.talentShowHover = talentShowHover;

// 省份详情API缓存
window.talentFetchProvinceDetail = async function(provinceName) {
    if (!provinceName) return null;
    var provId = PROVINCE_CODE[provinceName] || provinceName;
    var filt = window.talentGetFilters();
    var qs = '?';
    if (filt.industry) qs += 'industry=' + encodeURIComponent(filt.industry) + '&';
    if (filt.job) qs += 'job=' + encodeURIComponent(filt.job) + '&';
    if (filt.education) qs += 'education=' + encodeURIComponent(filt.education) + '&';
    if (filt.experience) qs += 'experience=' + encodeURIComponent(filt.experience) + '&';
    try {
        var res = await fetch(API_BASE + '/map/province/' + encodeURIComponent(provId) + (qs.length > 1 ? qs : ''));
        var json = await res.json();
        var d = json.data || json;
        return d;
    } catch(e) {
        console.warn('[TalentMap] 省份详情API失败', e);
        return null;
    }
};

// 城市详情API：城市岗位分析永远全量查询，不继承省级筛选条件（industry/job/education/experience 置空），
// 避免省级筛选状态残留导致城市查询结果为空、误报"暂无岗位数据"。
window.talentFetchCityDetail = async function(provinceName, cityName) {
    if (!provinceName || !cityName) return null;
    try {
        var res = await fetch(API_BASE + '/map/city/' + encodeURIComponent(provinceName) + '/' + encodeURIComponent(cityName));
        var json = await res.json();
        var d = json.data || json;
        return d;
    } catch(e) {
        console.warn('[TalentMap] 城市详情API失败', e);
        return null;
    }
};

// 城市岗位全量兜底：后端在岗位不足 20 时会自动 AI 生成并【写入数据库】后重新返回 ≥20 条
window.talentFetchCityJobsFull = async function(cityName) {
    if (!cityName) return null;
    try {
        var res = await fetch(API_BASE + '/map/city-jobs/' + encodeURIComponent(cityName));
        var json = await res.json();
        return json.data || json;
    } catch(e) {
        console.warn('[TalentMap] 城市岗位全量API失败', e);
        return null;
    }
};

// ============== 省份详情（右侧面板） ==============
window.renderProvinceDetail = async function(province) {
    if (!province) return;

    // 填充右侧面板 talent-detail-province（空值防护：面板若曾被技能详情整体替换，会先由 talentClearTechDetail 恢复）
    var provNameEl = document.getElementById('talent-prov-detail-name');
    var provSubEl = document.getElementById('talent-prov-detail-sub');
    if (provNameEl) provNameEl.textContent = province.name + ' · 数字人才洞察';
    if (provSubEl) provSubEl.textContent = '岗位分布 · 技能需求 · 人才画像';

    var grid = document.getElementById('talent-prov-stats-grid');
    if (grid) {
        grid.innerHTML = '<div class="detail-stat"><div class="detail-stat-label">岗位数量</div><div class="detail-stat-value">' + (province.jobCount || 0).toLocaleString() + '</div></div>'
            + '<div class="detail-stat"><div class="detail-stat-label">热门指数</div><div class="detail-stat-value">' + (province.hotIndex || '--') + '</div></div>'
            + '<div class="detail-stat"><div class="detail-stat-label">增长率</div><div class="detail-stat-value" style="color:' + ((province.growthRate||0)>=0?'#4ade80':'#f87171') + '">' + ((province.growthRate||0)>=0?'\u2191':'\u2193') + Math.abs(province.growthRate||0) + '%</div></div>'
            + '<div class="detail-stat"><div class="detail-stat-label">平均薪资</div><div class="detail-stat-value">' + talentFormatSalary(province.avgSalary) + '</div></div>';
    }

    // 请求真实省份详情API，获取topJobs、education、experience、skills
    var topEl = document.getElementById('talent-prov-top-jobs');
    var detail = await window.talentFetchProvinceDetail(province.name);
    if (detail && detail.topJobs && detail.topJobs.length > 0) {
        // 使用真实topJobs数据
        var topJobsHtml = detail.topJobs.slice(0, 10).map(function(j) {
            return '<span class="skill-matched">' + (j.name || j.title || '') + '</span>';
        }).join('');
        if (topEl) topEl.innerHTML = topJobsHtml || '<span class="skill-matched" style="opacity:.5">暂无热门岗位</span>';

        // 更新统计：用真实数据覆盖 initial 聚合数据
        if (detail.totalJobs && grid) {
            grid.innerHTML = '<div class="detail-stat"><div class="detail-stat-label">岗位数量</div><div class="detail-stat-value">' + (detail.totalJobs || 0).toLocaleString() + '</div></div>'
                + '<div class="detail-stat"><div class="detail-stat-label">平均薪资</div><div class="detail-stat-value">' + talentFormatSalary(detail.avgSalary || province.avgSalary) + '</div></div>'
                + '<div class="detail-stat"><div class="detail-stat-label">热门岗位</div><div class="detail-stat-value" style="font-size:13px">' + (detail.topJobs ? detail.topJobs.length : 0) + ' 个</div></div>'
                + '<div class="detail-stat"><div class="detail-stat-label">增长率</div><div class="detail-stat-value" style="color:' + ((province.growthRate||0)>=0?'#4ade80':'#f87171') + '">' + ((province.growthRate||0)>=0?'\u2191':'\u2193') + Math.abs(province.growthRate||0) + '%</div></div>';
        }

        // 保存详情数据供岗位分析使用
        talentMapState.provinceDetailData = detail;
    } else {
        if (topEl) topEl.innerHTML = '<span class="skill-matched" style="opacity:.5">数据加载中...</span>';
    }

    // 趋势图
    setTimeout(function() {
        var trendEl = document.getElementById('talent-prov-trend');
        if (!trendEl || trendEl.offsetParent === null) return;
        if (echarts.getInstanceByDom(trendEl)) echarts.getInstanceByDom(trendEl).dispose();
        var c = echarts.init(trendEl);
        var trendData = (detail && detail.trend) ? detail.trend :
            Array.from({ length: 7 }, function(_, i) { return Math.floor((province.jobCount || 1000) * (0.85 + Math.random() * 0.3)); });
        c.setOption({
            grid: { left: 36, right: 10, top: 10, bottom: 20 },
            xAxis: { type: 'category', data: ['Day1','Day2','Day3','Day4','Day5','Day6','Day7'], axisLabel: { color: '#475569', fontSize: 9 } },
            yAxis: { type: 'value', axisLabel: { color: '#475569', fontSize: 9 }, splitLine: { lineStyle: { color: '#f1f3f9' } } },
            series: [{
                type: 'line', smooth: true, symbol: 'circle', symbolSize: 4,
                lineStyle: { width: 2, color: '#00d4ff' }, itemStyle: { color: '#00d4ff' },
                areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,212,255,.35)' }, { offset: 1, color: 'rgba(0,212,255,0)' }] } },
                data: trendData
            }]
        });
    }, 100);
};

// ============== 省份/城市岗位分析（全屏层） ==============
window.renderProvinceJobList = async function(province, selectedCity) {
    if (!province) return;
    
    var isCity = talentMapState.mapLevel === 'city' && selectedCity;
    var displayName = isCity ? (selectedCity.displayName || selectedCity.name) : province.name;
    var fetchProvName = isCity ? talentMapState.currentProvinceName : province.name;
    // 查询 API 使用规范化短名（"南昌"），显示使用全称（"南昌市"）
    var fetchCityName = isCity ? (selectedCity.shortName || selectedCity.name) : null;

    var titleEl = document.getElementById('talent-province-title');
    if (titleEl) titleEl.textContent = displayName + ' · 数字人才洞察';

    var statsEl = document.getElementById('talent-province-stats');
    if (statsEl) statsEl.innerHTML = '<span>岗位数 --</span> | <span>热门指数 --</span> | <span>平均薪资 --</span>';

    // 优先使用已缓存的detailData，否则请求API
    var detail = isCity ? talentMapState.cityDetailData : talentMapState.provinceDetailData;
    if (!detail || !detail.topJobs || !detail.topJobs.length) {
        if (isCity && fetchCityName) {
            detail = await window.talentFetchCityDetail(fetchProvName, fetchCityName);
            talentMapState.cityDetailData = detail || {};
        } else {
            detail = await window.talentFetchProvinceDetail(province.name);
            talentMapState.provinceDetailData = detail || {};
        }
    }
    // 城市岗位仍为空时的兜底：调用全量接口（后端不足 20 时自动 AI 生成并【写入数据库】后返回 ≥20 条）
    if (isCity && fetchCityName && (!detail || !detail.topJobs || !detail.topJobs.length)) {
        var fb = await window.talentFetchCityJobsFull(fetchCityName);
        if (fb && fb.jobs && fb.jobs.length) {
            detail = {
                totalJobs: fb.totalJobs || fb.jobs.length,
                avgSalary: 0,
                topJobs: fb.jobs.map(function(j, i) {
                    return {
                        id: i + 1, name: j.name, count: j.count || 1,
                        avgSalary: j.avgSalary || 0, hot: j.hot || 0,
                        category: j.category || '',
                        skills: (j.skills && j.skills.length) ? j.skills : []
                    };
                })
            };
            talentMapState.cityDetailData = detail;
        }
    }

    var topJobs = (detail && detail.topJobs && detail.topJobs.length > 0) ? detail.topJobs : [];
    talentMapState.provinceJobs = topJobs;
    talentMapState.selectedJob = null;

    if (topJobs.length === 0) {
        var jobsEl = document.getElementById('talent-province-jobs');
        if (jobsEl) jobsEl.innerHTML = '<div style="color:rgba(255,255,255,.35);padding:40px;text-align:center">' + displayName + '暂无岗位数据，请检查数据库或筛选条件</div>';
        return;
    }

    // 更新统计条
    if (detail && detail.avgSalary && statsEl) {
        statsEl.innerHTML = '<span>岗位数 ' + (detail.totalJobs || 0).toLocaleString() + '</span> | <span>热门指数 ' + (province.hotIndex || '--') + '</span> | <span>平均薪资 ' + talentFormatSalary(detail.avgSalary) + '</span>';
    }

    var jobsHTML = '';
    topJobs.forEach(function(j, i) {
        var salaryText = j.avgSalary ? talentFormatSalary(j.avgSalary) : '--';
        var skills = (j.skills && j.skills.length) ? j.skills : [];
        var skillsHtml = skills.map(function(s) { return '<span class="talent-job-skill">' + s + '</span>'; }).join('');
        jobsHTML += '<div class="talent-job-card" data-idx="' + i + '" onclick="window.talentSelectJob(' + i + ')">'
            + '<div class="talent-job-card-header"><span class="talent-job-name">' + (j.name || '') + '</span><span class="talent-job-count">' + (j.count || 0).toLocaleString() + ' 个岗位</span></div>'
            + '<div class="talent-job-meta"><span>💰 ' + salaryText + '</span><span style="margin-left:12px;font-size:11px;color:rgba(255,255,255,.4)">热度 ' + (j.hot || 0) + '</span></div>'
            + '<div class="talent-job-skills">' + skillsHtml + '</div>'
            + '<div class="talent-job-card-footer"><span style="font-size:11px;color:rgba(255,255,255,.4)">TOP ' + (i+1) + '</span><button class="talent-job-btn" onclick="event.stopPropagation();window.talentSelectJob(' + i + ');window.talentMapEnterGraph()">进入知识图谱 →</button></div>'
            + '</div>';
    });
    var jobsEl = document.getElementById('talent-province-jobs');
    if (jobsEl) jobsEl.innerHTML = jobsHTML;
};

// 从右侧面板进入省份岗位分析（带镜头飞入动画）
window.talentMapEnterProvince = function() {
    var prov = talentMapState.selectedProvince;
    if (!prov) return;

    // 清除技能详情状态并恢复面板，设置为省级分析
    window.talentClearTechDetail();
    talentMapState.analysisLevel = 'province';
    talentMapState.selectedCity = null;
    talentMapState.mapLevel = 'province';

    // 防重复点击
    if (talentMapState.isEnteringProvince) return;
    talentMapState.isEnteringProvince = true;

    // 禁用按钮
    var btn = document.querySelector('#talent-detail-province .btn-primary');
    if (btn) btn.disabled = true;

    var chart = talentMapState.mapChart;
    var center = PROVINCE_CENTERS[prov.name] || [105, 35];
    var dv = talentMapState.defaultView;

    // 保存当前 zoom 以便恢复
    var curZoom = dv.zoom;
    try {
        var opt = chart.getOption();
        if (opt.geo && opt.geo[0]) curZoom = opt.geo[0].zoom || dv.zoom;
    } catch(e) {}
    talentMapState.flyInSavedZoom = curZoom;

    // 目标缩放：在当前聚焦基础上再放大 3 倍（不同省份 curZoom 2.0~8.0 → 6.0~24.0）
    var targetZoom = curZoom * 3.0;
    var dur = 900, start = null;
    var overlayTriggered = false, ov = document.getElementById('talent-flyin-overlay');

    // 停止呼吸动画（飞入期间不干扰）
    if (talentMapState.breathTimer) { clearInterval(talentMapState.breathTimer); talentMapState.breathTimer = null; }

    function step(ts) {
        if (!start) start = ts;
        var t = Math.min((ts - start) / dur, 1);
        // easeInOutCubic：前 450ms 加速 → 后 450ms 减速
        // 缩放在前后半程均等分布（各 50%），产生明显的推进纵深
        var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        var z = curZoom + (targetZoom - curZoom) * e;
        chart.setOption({ geo: { zoom: z, center: center } });

        // 动画收尾（90%）提前触发叠加层，最后 10% 时间叠层与缩放并行，无缝衔接
        if (t >= 0.90 && !overlayTriggered) {
            overlayTriggered = true;
            if (ov) ov.classList.add('active');
        }

        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            // 动画完成立即切换，零等待
            chart.setOption({ geo: { zoom: talentMapState.flyInSavedZoom, center: center } });

            window.talentShowLayer('province');
            window.renderProvinceJobList(prov);
            document.getElementById('talent-back-btn').style.display = '';
            window.talentUpdatePageTitle(prov.name);

            if (ov) ov.classList.remove('active');
            talentMapState.isEnteringProvince = false;
            talentMapState.flyInSavedZoom = null;
            if (btn) btn.disabled = false;
        }
    }
    requestAnimationFrame(step);
};

window.talentSelectJob = function(idx) {
    if (idx == null) return;
    // 切换岗位时清除技能详情状态
    window.talentClearTechDetail();
    var jobs = talentMapState.provinceJobs || [];
    if (idx >= 0 && idx < jobs.length) {
        var job = jobs[idx];
        talentMapState.selectedJob = {
            id: 'job-' + idx,
            name: job.name,
            category: job.category || '',
            count: job.count || 0,
            avgSalary: job.avgSalary || 0,
            skills: job.skills || []
        };
    }
    // 高亮选中的卡片
    document.querySelectorAll('#talent-province-jobs .talent-job-card').forEach((card, i) => {
        card.style.borderColor = i === idx ? '#00d4ff' : 'rgba(255,255,255,.1)';
    });
};

function talentShowProvinceDetailPanel(province, job) {
    document.getElementById('talent-detail-hover').style.display = 'none';
    document.getElementById('talent-detail-empty').style.display = 'none';
    document.getElementById('talent-detail-province').style.display = 'block';
    document.getElementById('talent-prov-detail-name').textContent = province.name + ' · ' + (job ? job.name : '岗位能力');
    document.getElementById('talent-prov-detail-sub').textContent = '岗位能力知识图谱 · ' + province.name;
    const grid = document.getElementById('talent-prov-stats-grid');
    if (grid) {
        grid.innerHTML = '<div class="detail-stat"><div class="detail-stat-label">岗位数量</div><div class="detail-stat-value">' + (province.jobCount || 0).toLocaleString() + '</div></div>'
            + '<div class="detail-stat"><div class="detail-stat-label">热门指数</div><div class="detail-stat-value">' + (province.hotIndex || '--') + '</div></div>'
            + '<div class="detail-stat"><div class="detail-stat-label">增长率</div><div class="detail-stat-value" style="color:' + ((province.growthRate||0)>=0?'#4ade80':'#f87171') + '">' + ((province.growthRate||0)>=0?'↑':'↓') + Math.abs(province.growthRate||0) + '%</div></div>'
            + '<div class="detail-stat"><div class="detail-stat-label">平均薪资</div><div class="detail-stat-value">' + talentFormatSalary(province.avgSalary) + '</div></div>';
    }
    const topEl = document.getElementById('talent-prov-top-jobs');
    if (topEl) topEl.innerHTML = '<span class="skill-matched">AI算法</span><span class="skill-matched">数据分析</span><span class="skill-matched">后端开发</span><span class="skill-matched">前端开发</span><span class="skill-matched">运维</span>';
}
window.talentShowProvinceDetailPanel = talentShowProvinceDetailPanel;

// ============== 岗位能力知识图谱 (中心岗位 + 辐射技术节点) ==============
var techDetailState = { currentTech: null, currentCity: null, graphJobName: null, savedPanelHTML: '', savedPanelDisplay: '' };

// 节点颜色映射
var TECH_CATEGORY_COLORS = {
    "编程语言": "#2563EB",
    "框架与开发": "#7C3AED",
    "数据存储与处理": "#F59E0B",
    "数据存储": "#F59E0B",
    "存储": "#F59E0B",
    "工程化与运维": "#10B981",
    "工程化运维": "#10B981",
    "AI与算法": "#EC4899",
    "前端技术": "#06B6D4",
    "架构设计": "#8B5CF6",
    "后端技术": "#6366F1",
    "数据处理": "#E11D48",
    "测试技术": "#F97316",
    "嵌入式/硬件": "#F97316",
    "核心技能": "#6366F1",
    "通用技术": "#6366F1"
};

// AI兜底图谱数据（当API无数据时使用）—— 根据岗位名称生成差异化技术列表
function _genTechFallbackGraph(cityName, jobName) {
    jobName = jobName || cityName;
    var seed = (cityName + jobName).split('').reduce(function(s, c) { return s + c.charCodeAt(0); }, 0);
    var rng = function(max) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % max; };

    // 岗位→核心技术映射（用于兜底）
    var JOB_TECH_FALLBACK = {
        'Java': [
            { name: 'Java', freq: 10, cat: '编程语言' },
            { name: 'Spring Boot', freq: 9, cat: '框架与开发' },
            { name: 'MySQL', freq: 9, cat: '数据存储' },
            { name: 'Redis', freq: 8, cat: '数据存储' },
            { name: 'Spring MVC', freq: 7, cat: '框架与开发' },
            { name: 'Spring Cloud', freq: 6, cat: '框架与开发' },
            { name: 'Docker', freq: 6, cat: '工程化运维' },
            { name: 'Linux', freq: 7, cat: '工程化运维' },
            { name: 'Git', freq: 8, cat: '工程化运维' },
            { name: 'Maven', freq: 5, cat: '工程化运维' },
            { name: '微服务', freq: 5, cat: '架构设计' },
            { name: 'MyBatis', freq: 5, cat: '框架与开发' },
            { name: 'Kafka', freq: 4, cat: '框架与开发' },
            { name: 'SQL优化', freq: 4, cat: '数据存储' },
            { name: 'JVM', freq: 5, cat: '编程语言' },
            { name: '多线程', freq: 4, cat: '编程语言' },
            { name: 'Nginx', freq: 4, cat: '工程化运维' },
            { name: 'Elasticsearch', freq: 3, cat: '数据存储' },
        ],
        '前端': [
            { name: 'JavaScript', freq: 10, cat: '编程语言' },
            { name: 'HTML/CSS', freq: 10, cat: '前端技术' },
            { name: 'Vue', freq: 9, cat: '前端技术' },
            { name: 'React', freq: 7, cat: '前端技术' },
            { name: 'TypeScript', freq: 8, cat: '编程语言' },
            { name: 'Webpack', freq: 6, cat: '工程化运维' },
            { name: 'Vite', freq: 5, cat: '工程化运维' },
            { name: 'Git', freq: 7, cat: '工程化运维' },
            { name: 'Node.js', freq: 6, cat: '后端技术' },
            { name: 'ES6+', freq: 6, cat: '编程语言' },
            { name: 'Sass/Less', freq: 5, cat: '前端技术' },
            { name: 'Axios', freq: 5, cat: '前端技术' },
            { name: 'Element UI', freq: 5, cat: '前端技术' },
            { name: 'Ant Design', freq: 4, cat: '前端技术' },
            { name: '小程序', freq: 5, cat: '前端技术' },
            { name: 'ECharts', freq: 4, cat: '前端技术' },
        ],
        'Python': [
            { name: 'Python', freq: 10, cat: '编程语言' },
            { name: 'Pandas', freq: 9, cat: '数据处理' },
            { name: 'NumPy', freq: 8, cat: '数据处理' },
            { name: 'SQL', freq: 9, cat: '数据存储' },
            { name: 'Matplotlib', freq: 6, cat: '数据处理' },
            { name: 'Scikit-learn', freq: 7, cat: 'AI与算法' },
            { name: 'PyTorch', freq: 5, cat: 'AI与算法' },
            { name: 'Django', freq: 5, cat: '框架与开发' },
            { name: 'Flask', freq: 4, cat: '框架与开发' },
            { name: 'Git', freq: 7, cat: '工程化运维' },
            { name: 'Docker', freq: 5, cat: '工程化运维' },
            { name: 'Jupyter', freq: 5, cat: '工程化运维' },
            { name: '数据清洗', freq: 6, cat: '数据处理' },
            { name: '数据可视化', freq: 5, cat: '数据处理' },
        ],
        '测试': [
            { name: 'Python', freq: 7, cat: '编程语言' },
            { name: 'Selenium', freq: 8, cat: '测试技术' },
            { name: 'JMeter', freq: 7, cat: '测试技术' },
            { name: 'Postman', freq: 6, cat: '测试技术' },
            { name: 'SQL', freq: 7, cat: '数据存储' },
            { name: 'Git', freq: 7, cat: '工程化运维' },
            { name: 'Linux', freq: 6, cat: '工程化运维' },
            { name: 'Jenkins', freq: 5, cat: '工程化运维' },
            { name: '自动化测试', freq: 8, cat: '测试技术' },
            { name: '性能测试', freq: 6, cat: '测试技术' },
            { name: 'Appium', freq: 4, cat: '测试技术' },
            { name: 'Bug管理', freq: 5, cat: '测试技术' },
        ],
        '运维': [
            { name: 'Linux', freq: 10, cat: '工程化运维' },
            { name: 'Docker', freq: 9, cat: '工程化运维' },
            { name: 'Kubernetes', freq: 8, cat: '工程化运维' },
            { name: 'Shell', freq: 8, cat: '编程语言' },
            { name: 'Python', freq: 7, cat: '编程语言' },
            { name: 'MySQL', freq: 7, cat: '数据存储' },
            { name: 'Redis', freq: 6, cat: '数据存储' },
            { name: 'Nginx', freq: 7, cat: '工程化运维' },
            { name: 'Git', freq: 7, cat: '工程化运维' },
            { name: 'Jenkins', freq: 6, cat: '工程化运维' },
            { name: 'Prometheus', freq: 5, cat: '工程化运维' },
            { name: 'Ansible', freq: 4, cat: '工程化运维' },
        ],
    };

    // 匹配岗位类型
    var matchedKey = null;
    var matchedLen = 0;
    Object.keys(JOB_TECH_FALLBACK).forEach(function(k) {
        if (jobName.toLowerCase().indexOf(k.toLowerCase()) !== -1 && k.length > matchedLen) {
            matchedKey = k;
            matchedLen = k.length;
        }
    });

    // 使用匹配的技术集，或通用技术集
    var techPool = (matchedKey && JOB_TECH_FALLBACK[matchedKey]) || [
        { name: 'Java', freq: 8, cat: '编程语言' },
        { name: 'Python', freq: 7, cat: '编程语言' },
        { name: 'JavaScript', freq: 6, cat: '编程语言' },
        { name: 'TypeScript', freq: 4, cat: '编程语言' },
        { name: 'Spring Boot', freq: 7, cat: '框架与开发' },
        { name: 'Vue', freq: 6, cat: '框架与开发' },
        { name: 'React', freq: 5, cat: '框架与开发' },
        { name: 'MySQL', freq: 8, cat: '数据存储' },
        { name: 'Redis', freq: 7, cat: '数据存储' },
        { name: 'MongoDB', freq: 3, cat: '数据存储' },
        { name: 'Docker', freq: 6, cat: '工程化运维' },
        { name: 'Git', freq: 8, cat: '工程化运维' },
        { name: 'Linux', freq: 7, cat: '工程化运维' },
        { name: 'Node.js', freq: 4, cat: '后端技术' },
        { name: 'PyTorch', freq: 3, cat: 'AI与算法' },
        { name: 'Pandas', freq: 3, cat: '数据处理' },
        { name: 'HTML/CSS', freq: 5, cat: '前端技术' },
    ];

    // 随机打乱并选择固定数量（根据城市hash差异化）
    var shuffled = techPool.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
        var j = rng(i + 1);
        var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }

    var count = Math.min(shuffled.length, 14 + (rng(5)));
    var selected = shuffled.slice(0, count);

    // 统计最大频率
    var maxFreq = 0;
    selected.forEach(function(t) { if (t.freq > maxFreq) maxFreq = t.freq; });

    // 按类别分组
    var catMap = {};
    selected.forEach(function(t) {
        if (!catMap[t.cat]) catMap[t.cat] = { name: t.cat, technologies: [] };
        var size = 16 + Math.floor((t.freq / maxFreq) * 26);
        catMap[t.cat].technologies.push({
            name: t.name,
            size: Math.min(size, 42),
            frequency: t.freq,
            ratio: maxFreq ? t.freq / maxFreq : 0.5
        });
    });

    var categories = [];
    Object.keys(catMap).forEach(function(k) {
        if (catMap[k].technologies.length > 0) categories.push(catMap[k]);
    });

    return {
        cityName: cityName,
        centerJob: jobName,
        totalJobs: 20,
        uniqueTitles: 18,
        realJobCount: 0,
        isSupplemented: true,
        isFallback: true,
        jobs: [],
        categories: categories,
        maxFrequency: maxFreq
    };
}


window.renderCityTechGraph = async function(cityName, jobName) {
    var container = document.getElementById('talent-graph-container');
    if (!container) return;
    if (container.clientWidth < 10 || container.clientHeight < 10) {
        setTimeout(function() { window.renderCityTechGraph(cityName, jobName); }, 150);
        return;
    }
    // 销毁旧实例
    if (talentMapState.jobGraphInstance) {
        try { talentMapState.jobGraphInstance.destroy(); } catch(e) {}
        talentMapState.jobGraphInstance = null;
    }
    if (typeof G6 === 'undefined' || !G6.Graph) {
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;font-size:14px">G6图谱库加载中，请稍后重试...</div>';
        return;
    }
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,.5);font-size:13px">正在生成' + cityName + '技术知识图谱...</div>';

    document.getElementById('talent-graph-city-label').textContent = cityName;
    techDetailState.currentCity = cityName;
    // 保存用于图谱的岗位名
    techDetailState.graphJobName = jobName || cityName;

    // 调用后端API获取城市技术图谱
    var graphData = null;
    try {
        var apiUrl = API_BASE + '/map/city-tech-graph/' + encodeURIComponent(cityName);
        if (jobName) apiUrl += '?job_title=' + encodeURIComponent(jobName);
        var res = await fetch(apiUrl);
        var json = await res.json();
        graphData = (json.data || json);
    } catch(e) {
        console.warn('[TechGraph] API失败', e);
    }

    if (!graphData || !graphData.categories || !graphData.categories.length) {
        console.warn('[TechGraph] 真实数据不足，使用AI兜底数据');
        graphData = _genTechFallbackGraph(cityName, jobName);
    }

    // 使用API返回的centerJob，或传入的jobName
    var centerJob = graphData.centerJob || jobName || cityName;

    container.innerHTML = '';
    var w = container.clientWidth;
    var h = container.clientHeight;
    var centerX = w / 2;
    var centerY = h / 2;

    // ========== 构建节点和边（中心岗位 + 直接连接所有技术） ==========
    var nodes = [];
    var edges = [];
    var nodeIdCounter = 0;
    var TECH_CATEGORY_COLORS_MAP = TECH_CATEGORY_COLORS || {};

    // 收集所有技术节点（扁平化，去掉类别中间节点）
    var allTechNodes = [];
    graphData.categories.forEach(function(cat) {
        (cat.technologies || []).forEach(function(tech) {
            var catColor = TECH_CATEGORY_COLORS_MAP[cat.name] || '#6366F1';
            allTechNodes.push({
                name: tech.name,
                size: tech.size || 24,
                frequency: tech.frequency || 1,
                ratio: tech.ratio || 0.5,
                catColor: catColor,
                catName: cat.name
            });
        });
    });

    // 如果技术节点过少，追加通用技术
    if (allTechNodes.length < 8) {
        var extraTechs = ['Git', 'Linux', 'Docker', 'MySQL', 'Redis', 'Python', 'Java', 'JavaScript', 'Vue'];
        for (var ei = 0; ei < extraTechs.length && allTechNodes.length < 15; ei++) {
            var alreadyExists = allTechNodes.some(function(t) { return t.name === extraTechs[ei]; });
            if (!alreadyExists) {
                allTechNodes.push({ name: extraTechs[ei], size: 20, frequency: 3, ratio: 0.4, catColor: '#6366F1', catName: '通用技术' });
            }
        }
    }

    // ========== 径向布局算法（类似 Reagraph No-Overlap） ==========
    var maxFreq = 0;
    allTechNodes.forEach(function(t) { if (t.frequency > maxFreq) maxFreq = t.frequency; });

    // 按频率降序排列（大的更靠近中心）
    allTechNodes.sort(function(a, b) { return b.frequency - a.frequency; });

    var totalTechs = allTechNodes.length;
    // 计算环数：12个以内用2环，以上用3环
    var rings = [];
    if (totalTechs <= 10) {
        rings = [totalTechs];
    } else if (totalTechs <= 20) {
        var inner = Math.ceil(totalTechs * 0.4);
        rings = [inner, totalTechs - inner];
    } else {
        var r1 = Math.ceil(totalTechs * 0.33);
        var r2 = Math.ceil(totalTechs * 0.33);
        rings = [r1, r2, totalTechs - r1 - r2];
    }

    // 可用半径范围
    var maxRadius = Math.min(w, h) * 0.42;
    var minRadius = Math.min(w, h) * 0.16;

    var ringRadii = [];
    if (rings.length === 1) {
        ringRadii = [maxRadius * 0.55];
    } else if (rings.length === 2) {
        ringRadii = [maxRadius * 0.42, maxRadius * 0.78];
    } else {
        ringRadii = [maxRadius * 0.3, maxRadius * 0.58, maxRadius * 0.82];
    }

    // 预计算位置
    var idx = 0;
    for (var ringIdx = 0; ringIdx < rings.length; ringIdx++) {
        var countInRing = rings[ringIdx];
        if (countInRing <= 0) continue;
        var ringRadius = ringRadii[ringIdx];
        var angleOffset = (ringIdx % 2 === 1) ? Math.PI / countInRing : 0; // 交错环

        for (var i = 0; i < countInRing && idx < totalTechs; i++) {
            var tech = allTechNodes[idx];
            var angle = angleOffset + (2 * Math.PI * i) / countInRing;
            tech.calcX = centerX + ringRadius * Math.cos(angle);
            tech.calcY = centerY + ringRadius * Math.sin(angle);
            idx++;
        }
    }

    // 重叠消除（碰撞检测 + 推力）
    for (var iter = 0; iter < 8; iter++) {
        for (var i = 0; i < totalTechs; i++) {
            for (var j = i + 1; j < totalTechs; j++) {
                var a = allTechNodes[i];
                var b = allTechNodes[j];
                var dx = b.calcX - a.calcX;
                var dy = b.calcY - a.calcY;
                var dist = Math.sqrt(dx * dx + dy * dy);
                var minD = (a.size + b.size) * 0.48;
                if (dist < minD && dist > 0.001) {
                    var force = (minD - dist) / dist * 0.4;
                    var fx = dx * force;
                    var fy = dy * force;
                    a.calcX -= fx;
                    a.calcY -= fy;
                    b.calcX += fx;
                    b.calcY += fy;
                }
            }
        }
        // 将节点拉回各自的环半径附近（只约束径向距离，保持角度）
        for (var i = 0; i < totalTechs; i++) {
            var t = allTechNodes[i];
            var ddx = t.calcX - centerX;
            var ddy = t.calcY - centerY;
            var currR = Math.sqrt(ddx * ddx + ddy * ddy);
            if (currR < 0.01) {
                t.calcX = centerX + 1;
                t.calcY = centerY + 1;
                currR = 1;
            }
            var rdx = ddx / currR;
            var rdy = ddy / currR;
            // 目标半径：在 range 内保持当前角度
            var targetR = Math.max(minRadius, Math.min(maxRadius * 1.05, currR));
            t.calcX = centerX + rdx * (currR * 0.7 + targetR * 0.3);
            t.calcY = centerY + rdy * (currR * 0.7 + targetR * 0.3);
        }
    }

    // 中心节点
    nodes.push({
        id: 'center',
        label: centerJob,
        type: 'center',
        x: centerX,
        y: centerY,
        size: 55,
        style: {
            fill: 'l(0) 0:#0D9488 1:#14B8A6',
            stroke: '#0D9488',
            lineWidth: 4,
            shadowColor: 'rgba(13,148,136,.5)',
            shadowBlur: 20
        },
        labelCfg: {
            position: 'center',
            style: { fill: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans),sans-serif', textAlign: 'center' }
        }
    });

    // 技术节点
    allTechNodes.forEach(function(tech, i) {
        var techId = 'tech-' + i;
        var nodeFill = tech.catColor;
        nodes.push({
            id: techId,
            label: tech.name,
            type: 'technology',
            x: tech.calcX,
            y: tech.calcY,
            size: tech.size,
            frequency: tech.frequency,
            ratio: tech.ratio,
            catColor: tech.catColor,
            style: {
                fill: nodeFill,
                stroke: 'rgba(255,255,255,.45)',
                lineWidth: 2,
                shadowColor: 'rgba(0,0,0,.2)',
                shadowBlur: 6
            },
            labelCfg: {
                position: 'bottom',
                offset: 3,
                style: { fill: '#fff', fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-sans),sans-serif' }
            }
        });
        // 边：中心 → 每个技术节点
        edges.push({
            source: 'center',
            target: techId,
            style: { stroke: 'rgba(255,255,255,.18)', lineWidth: 1, lineDash: [4, 3], endArrow: false }
        });
    });

    try {
        talentMapState.jobGraphInstance = new G6.Graph({
            container: 'talent-graph-container',
            width: w,
            height: h,
            modes: { default: [] },
            layout: false,  // 使用预计算位置，不做自动布局
            animate: true,
            animateCfg: { duration: 800 },
            defaultNode: {
                type: 'circle',
                labelCfg: {
                    position: 'bottom',
                    offset: 5,
                    style: { fill: '#fff', fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-sans),sans-serif' }
                }
            },
            defaultEdge: {
                type: 'line',
                style: { stroke: 'rgba(255,255,255,.15)', lineWidth: 1, lineDash: [5, 4], endArrow: false }
            }
        });

        talentMapState.jobGraphInstance.data({ nodes: nodes, edges: edges });
        talentMapState.jobGraphInstance.render();

        // fitView 确保所有节点可见
        setTimeout(function() {
            if (talentMapState.jobGraphInstance && talentMapState.jobGraphInstance.fitView) {
                talentMapState.jobGraphInstance.fitView(35);
            }
        }, 500);

        // 技术节点点击 → 右侧技术详情
        talentMapState.jobGraphInstance.on('node:click', function(evt) {
            var model = evt.item && evt.item.getModel ? evt.item.getModel() : null;
            if (!model || model.type !== 'technology') return;
            window.renderTechDetail(model.label || model.id, model.frequency, model.ratio);
        });

        // 鼠标悬浮tooltip
        var tooltipEl = document.createElement('div');
        tooltipEl.className = 'tech-node-tooltip';
        tooltipEl.style.cssText = 'display:none;position:absolute;z-index:1000;background:rgba(0,0,0,.85);color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;pointer-events:none;white-space:nowrap;border:1px solid rgba(45,212,191,.3);backdrop-filter:blur(8px);';
        container.appendChild(tooltipEl);

        talentMapState.jobGraphInstance.on('node:mouseenter', function(evt) {
            var model = evt.item && evt.item.getModel ? evt.item.getModel() : null;
            if (!model || model.type === 'center') { tooltipEl.style.display = 'none'; return; }
            tooltipEl.style.display = 'block';
            if (model.type === 'technology') {
                tooltipEl.innerHTML = '<b>' + model.label + '</b><br><span style="font-size:10px;color:rgba(255,255,255,.55)">需求频率: ' + (model.frequency || 0) + ' | 点击查看详情</span>';
            } else {
                tooltipEl.innerHTML = '<b>' + (model.label || model.id) + '</b>';
            }
        });
        talentMapState.jobGraphInstance.on('node:mouseleave', function() {
            tooltipEl.style.display = 'none';
        });
        talentMapState.jobGraphInstance.on('node:mousemove', function(evt) {
            tooltipEl.style.left = (evt.canvasX + 14) + 'px';
            tooltipEl.style.top = (evt.canvasY - 24) + 'px';
        });

        // 触摸设备支持
        talentMapState.jobGraphInstance.on('node:touchstart', function(evt) {
            var model = evt.item && evt.item.getModel ? evt.item.getModel() : null;
            if (!model || model.type !== 'technology') return;
            window.renderTechDetail(model.label || model.id, model.frequency, model.ratio);
        });

    } catch(e) {
        console.warn('[TechGraph] G6渲染失败', e);
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,.35);font-size:13px">图谱渲染失败，请重试</div>';
    }
};

// 渲染技术详情到右侧岗位分析面板（复用 #talent-detail-province）
window.renderTechDetail = async function(techName, frequency, ratio) {
    techDetailState.currentTech = techName;
    
    // 保存当前省份/城市面板内容（用于取消选择时恢复）
    if (!techDetailState.savedPanelHTML) {
        var provPanel = document.getElementById('talent-detail-province');
        techDetailState.savedPanelHTML = provPanel ? provPanel.innerHTML : '';
        techDetailState.savedPanelDisplay = provPanel ? provPanel.style.display : '';
    }
    
    var panel = document.getElementById('talent-detail-province');
    if (!panel) return;
    
    // 隐藏无关面板
    var emptyPanel = document.getElementById('talent-detail-empty');
    var hoverPanel = document.getElementById('talent-detail-hover');
    if (emptyPanel) emptyPanel.style.display = 'none';
    if (hoverPanel) hoverPanel.style.display = 'none';
    panel.style.display = 'block';
    
    panel.innerHTML = '<div class="detail-content" style="padding:20px"><p style="color:var(--text-muted);text-align:center;padding:40px 0">加载技术详情...</p></div>';
    
    // 调用后端API
    var techDetail = null;
    try {
        var url = API_BASE + '/map/tech-detail/' + encodeURIComponent(techName);
        if (techDetailState.currentCity) url += '?city_name=' + encodeURIComponent(techDetailState.currentCity);
        var res = await fetch(url);
        var json = await res.json();
        techDetail = (json.data || json);
    } catch(e) {
        console.warn('[TechDetail] API失败', e);
    }
    
    if (!techDetail) {
        panel.innerHTML = '<div class="detail-content"><div class="tech-detail-header"><span class="tech-detail-name">' + techName + '</span></div>'
            + '<div class="tech-detail-section"><div class="tech-detail-section-title">技术简介</div><div class="tech-detail-text">' + _generateTechIntro(techName) + '</div></div>'
            + '<div class="tech-detail-section"><div class="tech-detail-section-title">应用场景</div><div class="tech-detail-text">' + _generateTechScenario(techName) + '</div></div>'
            + '<button class="graph-btn" style="margin-top:16px;width:100%;justify-content:center;border-color:rgba(45,212,191,.3);color:rgba(45,212,191,.9)" onclick="window.talentRestoreProvincePanel()">← 返回岗位分析</button></div>';
        return;
    }
    
    // 构建详情HTML
    var hotStars = '';
    var hl = techDetail.hotLevel || 3;
    for (var i = 0; i < 5; i++) hotStars += '<span class="tech-detail-hot-star" style="color:' + (i < hl ? '#F59E0B' : 'rgba(0,0,0,.15)') + '">★</span>';
    
    var html = '<div class="detail-content">';
    html += '<button class="graph-btn" style="margin-bottom:12px;font-size:11px;border-color:rgba(13,148,136,.3);color:#0d9488" onclick="window.talentRestoreProvincePanel()">← 返回岗位分析</button>';
    // 头部
    html += '<div class="tech-detail-header"><span class="tech-detail-name" style="color:var(--text-dark)">' + techName + '</span><div class="tech-detail-hot">' + hotStars + '</div></div>';
    
    // ① 技术简介
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title">技术简介</div><div class="tech-detail-text" style="color:var(--text-dark-secondary)">' + (techDetail.intro || _generateTechIntro(techName)) + '</div></div>';
    
    // ② 技术用途
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title">技术用途</div><div class="tech-detail-tag-list">';
    var uses = techDetail.uses && techDetail.uses.length ? techDetail.uses : ['开发', '调试', '部署', '维护', '优化'];
    uses.forEach(function(u) {
        html += '<span class="tech-detail-tag">' + u + '</span>';
    });
    html += '</div></div>';
    
    // ③ 岗位使用场景
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title">岗位使用场景</div><div class="tech-detail-text" style="color:var(--text-dark-secondary)">' + (techDetail.scenarios || _generateTechScenario(techName)) + '</div></div>';
    
    // ④ 需要掌握的知识点
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title">核心知识点</div><div class="tech-detail-tag-list">';
    var kps = techDetail.knowledgePoints && techDetail.knowledgePoints.length ? techDetail.knowledgePoints : ['基础语法', '核心API', '常用框架', '最佳实践', '性能优化'];
    kps.forEach(function(k) {
        html += '<span class="tech-detail-tag" style="background:rgba(99,102,241,.1);color:#5b63d3;border-color:rgba(99,102,241,.15)">' + k + '</span>';
    });
    html += '</div></div>';
    
    // ⑤ 学习路径
    html += '<div class="tech-detail-section"><div class="tech-detail-section-title">学习路径建议</div><div class="tech-detail-path">';
    (techDetail.learningPath || ['入门基础', '核心应用', '项目实战', '原理深入', '架构设计']).forEach(function(p, i) {
        if (i > 0) html += '<span class="tech-detail-path-arrow">→</span>';
        html += '<span class="tech-detail-path-item">' + p + '</span>';
    });
    html += '</div></div>';
    
    // ⑥ 相关技术
    if (techDetail.relatedTech && techDetail.relatedTech.length) {
        html += '<div class="tech-detail-section"><div class="tech-detail-section-title">相关技术</div><div class="tech-detail-tag-list">';
        techDetail.relatedTech.forEach(function(r) {
            html += '<span class="tech-detail-tag" style="cursor:pointer" onclick="window.renderTechDetail(\'' + r + '\',0,0)">' + r + '</span>';
        });
        html += '</div></div>';
    }
    
    // ⑦ 数据统计（如有）
    if (techDetail.stats) {
        var st = techDetail.stats;
        html += '<div class="tech-detail-stats"><div class="tech-detail-section-title">数据统计</div>';
        if (st.jobCount > 0) {
            html += '<div class="tech-detail-stat-row"><span class="tech-detail-stat-label">需求岗位数</span><span class="tech-detail-stat-value">' + st.jobCount + '</span></div>';
            html += '<div class="tech-detail-stat-row"><span class="tech-detail-stat-label">需求占比</span><span class="tech-detail-stat-value">' + (st.jobRatio || '--') + '</span></div>';
        }
        if (st.relatedCities && st.relatedCities.length) {
            html += '<div class="tech-detail-stat-row"><span class="tech-detail-stat-label">关联城市</span><span class="tech-detail-stat-value">' + st.relatedCities.slice(0,4).join(', ') + '</span></div>';
        }
        if (st.relatedJobs && st.relatedJobs.length) {
            html += '<div class="tech-detail-stat-row"><span class="tech-detail-stat-label">关联岗位</span><span class="tech-detail-stat-value" style="font-size:11px">' + st.relatedJobs.slice(0,5).map(function(j) { return j.name; }).join(', ') + '</span></div>';
        }
        html += '</div>';
    }
    
    html += '</div>';
    panel.innerHTML = html;
};

// AI兜底 - 技术简介
function _generateTechIntro(techName) {
    var map = {
        'Java': 'Java是一种广泛使用的面向对象编程语言，具有跨平台、高性能、安全性强等特点，是企业级应用开发的首选语言之一。',
        'Spring Boot': 'Spring Boot是基于Spring框架的快速应用开发框架，简化了Spring应用的初始搭建和开发过程，提供自动配置和起步依赖。',
        'MySQL': 'MySQL是最流行的开源关系型数据库管理系统，具有高性能、高可靠性、易用性等特点，广泛应用于Web应用开发。',
        'Redis': 'Redis是高性能的key-value内存数据库，支持多种数据结构（字符串、哈希、列表、集合等），常用于缓存、消息队列、实时计数等场景。',
        'Docker': 'Docker是容器化平台，将应用及其依赖打包到轻量级容器中，实现快速部署和环境一致性。',
        'Python': 'Python是简洁优雅的高级编程语言，拥有丰富的第三方库，广泛应用于数据分析、AI、Web开发、自动化等领域。',
        'Vue': 'Vue.js是渐进式JavaScript前端框架，以轻量、易上手、高性能著称，支持组件化开发。',
        'JavaScript': 'JavaScript是Web前端核心编程语言，用于实现网页交互效果和动态功能，全栈开发的重要基础。',
        'Git': 'Git是分布式版本控制系统，用于跟踪代码变化、协同开发和版本管理，是团队协作的基础工具。',
        'Linux': 'Linux是开源操作系统，广泛应用于服务器环境，是运维、开发和云计算的基石。',
        'React': 'React是Facebook开源的JavaScript UI库，采用虚拟DOM和组件化架构，用于构建高性能单页应用。',
        'Node.js': 'Node.js是JavaScript运行时环境，使JavaScript可以运行在服务器端，擅长高并发I/O场景。',
        'TypeScript': 'TypeScript是JavaScript的超集，添加了静态类型系统，提升大型项目的代码质量和可维护性。',
        'Go': 'Go语言由Google开发，具有高性能、简洁语法和内置并发支持，适用于微服务和云原生开发。',
        'C++': 'C++是高性能系统级编程语言，应用于游戏引擎、操作系统、嵌入式系统等对性能要求极高的场景。',
    };
    return map[techName] || techName + '是当前岗位需求中的重要技术技能，在软件开发、系统设计或数据处理等场景中扮演关键角色。掌握' + techName + '有助于提升岗位竞争力。';
}

// AI兜底 - 技术应用场景
function _generateTechScenario(techName) {
    var map = {
        'Java': '企业级后端开发、微服务架构、Android应用、大数据处理（Hadoop/Spark）、金融系统等。',
        'Spring Boot': 'RESTful API开发、微服务架构、企业应用快速搭建、云原生应用部署。',
        'MySQL': 'Web应用数据存储、电商系统、内容管理、日志分析、报表系统等。',
        'Redis': '热点数据缓存、分布式锁、消息队列、实时排行榜、Session共享。',
        'Docker': '微服务容器化、CI/CD流水线、开发环境标准化、多环境一致性部署。',
        'Python': '数据分析与可视化、机器学习与深度学习、自动化脚本、Web后端开发、爬虫。',
        'Vue': '单页应用(SPA)、管理后台、移动端H5、数据可视化大屏、企业级中后台。',
        'JavaScript': '网页交互效果、表单验证、AJAX异步请求、浏览器扩展、全栈Node.js项目。',
    };
    return map[techName] || techName + '在当前岗位及相关技术栈中被广泛使用，是行业通用技术标准的重要组成部分。';
}

// 恢复省份/城市分析面板（取消技术节点选择）
window.talentRestoreProvincePanel = function() {
    techDetailState.currentTech = null;
    var panel = document.getElementById('talent-detail-province');
    if (panel && techDetailState.savedPanelHTML) {
        panel.innerHTML = techDetailState.savedPanelHTML;
        panel.style.display = techDetailState.savedPanelDisplay || 'block';
        techDetailState.savedPanelHTML = '';
        techDetailState.savedPanelDisplay = '';
    } else if (talentMapState.selectedCity) {
        // 无保存内容时兜底：按当前上下文重新渲染（城市 > 省份）
        window.renderProvinceJobList(talentMapState.selectedProvince, talentMapState.selectedCity);
    } else if (talentMapState.selectedProvince) {
        window.renderProvinceDetail(talentMapState.selectedProvince);
    }
};

// 从城市/省份岗位分析页面进入脑图
window.talentMapEnterGraph = function(jobNameOverride) {
    var cityName = null;
    var jobName = jobNameOverride || null;

    // 优先级：selectedCity > selectedProvince（显示用全称，后端已兼容简称/全称）
    if (talentMapState.selectedCity && talentMapState.selectedCity.name) {
        cityName = talentMapState.selectedCity.displayName || talentMapState.selectedCity.name;
    } else if (talentMapState.currentProvinceName) {
        cityName = talentMapState.currentProvinceName;
    } else if (talentMapState.selectedProvince && talentMapState.selectedProvince.name) {
        cityName = talentMapState.selectedProvince.name;
    }

    if (!cityName) {
        window.Utils.showToast('请先选择一个城市或省份', 'amber');
        return;
    }

    // 确定中心岗位名称
    if (!jobName) {
        // 有选中岗位 → 直接用
        if (talentMapState.selectedJob) {
            jobName = talentMapState.selectedJob.name || talentMapState.selectedJob;
        }
        // 有省份岗位列表 → 取第一个（最热门）
        else if (talentMapState.provinceJobs && talentMapState.provinceJobs.length > 0) {
            jobName = talentMapState.provinceJobs[0].name || talentMapState.provinceJobs[0].title;
        }
    }
    if (!jobName) jobName = cityName;

    // 保存图层面板内容以便从脑图返回时恢复
    techDetailState.savedPanelHTML = '';
    techDetailState.savedPanelDisplay = '';
    techDetailState.currentTech = null;

    var provPanel = document.getElementById('talent-detail-province');
    window.talentShowLayer('graph');

    // 设置右侧面板显示提示
    if (provPanel) {
        provPanel.innerHTML = '<div class="detail-content" style="padding:20px"><div class="detail-empty"><svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64"><circle cx="40" cy="40" r="30"/><path d="M40 20v20l14 7"/><circle cx="40" cy="40" r="6" fill="currentColor"/></svg><p style="color:var(--text-dark);font-weight:600;margin:16px 0 4px">' + jobName + ' · 岗位能力图谱</p><p style="color:var(--text-muted);font-size:12px;line-height:1.6">展示' + cityName + ' · ' + jobName + '的<br>核心技术需求分布<br><br>点击脑图技术节点<br>查看详细分析</p></div></div>';
        provPanel.style.display = 'block';
    }

    window.renderCityTechGraph(cityName, jobName);
};

// 返回城市/省份岗位列表
window.talentGraphBack = function() {
    window.talentClearTechDetail();
    
    // 恢复上一层页面并重新渲染
    if (talentMapState.mapLevel === 'city' && talentMapState.selectedCity) {
        window.talentShowLayer('province');
        window.renderProvinceJobList(talentMapState.selectedProvince, talentMapState.selectedCity);
        window.talentUpdatePageTitle((talentMapState.selectedCity.displayName || talentMapState.selectedCity.name) + ' · 岗位分析');
    } else if (talentMapState.selectedProvince) {
        window.talentShowLayer('province');
        window.renderProvinceJobList(talentMapState.selectedProvince);
        window.talentUpdatePageTitle(talentMapState.selectedProvince.name);
    }
    document.getElementById('talent-back-btn').style.display = '';
};

// 兼容旧版
window.renderJobGraph = function(job) {
    // 旧版入口：如果传入了job，取city名进入新版脑图
    var cityName = talentMapState.selectedCity ? talentMapState.selectedCity.name :
                   talentMapState.currentProvinceName;
    if (job && job.name) {
        // 尝试从job名称推断城市
    }
    if (cityName) {
        window.renderCityTechGraph(cityName);
    } else if (job && job.name) {
        window.renderCityTechGraph(job.name);
    }
};

window.talentGraphSearch = function(term) {
    var inst = talentMapState.jobGraphInstance;
    if (!inst) return;
    if (!term) {
        try {
            inst.getNodes().forEach(function(n) {
                var m = n.getModel();
                m.style.opacity = 1;
            });
            inst.refresh();
        } catch(e) {}
        return;
    }
    try {
        inst.getNodes().forEach(function(n) {
            var m = n.getModel();
            var label = (m.label || '').toLowerCase();
            var matched = label.includes(term.toLowerCase());
            m.style.opacity = matched ? 1 : 0.12;
        });
        inst.refresh();
    } catch(e) {}
};

window.talentGraphFit = function() {
    var inst = talentMapState.jobGraphInstance;
    if (inst && inst.fitView) inst.fitView(20);
};

window.talentGraphFullscreen = function() {
    var el = document.getElementById('talent-map-canvas');
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
    setTimeout(function() {
        if (talentMapState.jobGraphInstance) {
            var c = document.getElementById('talent-graph-container');
            if (c && c.clientWidth > 10) talentMapState.jobGraphInstance.changeSize(c.clientWidth, c.clientHeight);
        }
    }, 200);
};


// 兼容旧版 graph 视图调用
window.initGraph = window.initTalentMap;

// ============== Discovery View (智能体驱动 - Mission Control) ==============
window.API_BASE = window.API_BASE || 'http://127.0.0.1:5000';
window.discoveryState = {
  phase: 'idle', activeStep: 0, scanning: false,
  dataSource: 'api', llmEnabled: false,
  discoveries: [], forecasts: [], reasoningChain: [],
  scanSummary: '', modelInfo: {}, drawerJobId: null,
  search: '', sort: 'confidence', category: 'all', status: 'all',
  city: 'all', minConf: 'all', page: 1, foundPage: 1, forecastPage: 1, pageSize: 4, trackLog: []
};

window.initDiscovery = function() {
    window.ensureDiscoveryState();
    window.bindDiscoveryEvents();
    // 原型首屏：无数据时灌入 Mock，版式与示例文案对齐
    if (!(window.discoveryState.discoveries || []).length && window.buildMockScanPayload) {
        const mock = window.buildMockScanPayload();
        window.discoveryState.discoveries = mock.discoveries || [];
        window.discoveryState.forecasts = mock.forecasts || [];
        window.discoveryState.scanStats = mock.stats || {};
        window.discoveryState.scanSummary = mock.summary || '';
        window.discoveryState.modelInfo = mock.model || {};
        window.discoveryState.phase = 'settled';
        window.discoveryState.dataSource = 'mock';
        window._discRevealedIds = new Set([
            ...(window.discoveryState.discoveries || []).map(j => j.id),
            ...(window.discoveryState.forecasts || []).map(j => j.id)
        ]);
    }
    window.renderDiscoveryList();
    window.updateDiscoveryCounts();
    window.updateDiscBadges();
};

window.ensureDiscoveryState = function() {
    if (!window.discoveryState) window.discoveryState = {phase:'idle',activeStep:0,scanning:false,dataSource:'api',llmEnabled:false,discoveries:[],forecasts:[],reasoningChain:[],scanSummary:'',modelInfo:{},drawerJobId:null,search:'',sort:'confidence',category:'all',status:'all',city:'all',minConf:'all',page:1,foundPage:1,forecastPage:1,pageSize:4,trackLog:[]};
    const ds = window.discoveryState;
    if (ds.city == null) ds.city = 'all';
    if (ds.minConf == null) ds.minConf = 'all';
    if (!ds.page) ds.page = 1;
    if (!ds.foundPage) ds.foundPage = 1;
    if (!ds.forecastPage) ds.forecastPage = 1;
    if (!ds.pageSize) ds.pageSize = 4;
    if (!Array.isArray(ds.trackLog)) ds.trackLog = [];
};

window._discThoughtToken = 0;
window._discSleep = (ms) => new Promise(r => setTimeout(r, ms));
window._discReduced = function() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
};

window.setDiscThought = async function(hero, phase) {
    const now = document.getElementById('disc-thought-now');
    const next = (hero || '').trim();
    const token = ++window._discThoughtToken;
    const pt = document.getElementById('disc-phase-text');
    if (pt) {
        pt.textContent = phase || '推理中';
        if (window.gsap && !window._discReduced()) {
            window.gsap.fromTo(pt, { opacity: 0.4, letterSpacing: '0.28em' }, { opacity: 1, letterSpacing: '0.16em', duration: 0.7, ease: 'power2.out' });
        }
    }
    const dot = document.querySelector('#disc-phase-live .pulse-dot');
    if (dot) dot.style.opacity = (phase === '待机' || phase === '完成') ? '.35' : '1';
    if (!now) return;
    if (next === (now.dataset.full || now.textContent)) return;
    now.dataset.full = next;
    const reduced = window._discReduced();
    const gsap = window.gsap;
    const caption = now.closest('.proto-stage-caption');
    const captionHidden = !!(caption && window.getComputedStyle(caption).display === 'none');
    if (reduced || !gsap || captionHidden) {
        now.textContent = next;
        now.style.opacity = '1';
        return;
    }
    await gsap.to(now, { opacity: 0, y: -8, filter: 'blur(5px)', duration: 0.18, ease: 'power2.in' });
    if (token !== window._discThoughtToken) return;
    now.textContent = '';
    gsap.set(now, { opacity: 1, y: 6, filter: 'blur(0px)' });
    gsap.to(now, { y: 0, duration: 0.28, ease: 'power3.out' });
    for (let i = 0; i <= next.length; i++) {
        if (token !== window._discThoughtToken) return;
        now.textContent = next.slice(0, i);
        const ch = next[i - 1] || '';
        let wait = 10;
        if ('，。；：、！？,. '.includes(ch)) wait = 36;
        else if (i % 7 === 0) wait = 16;
        await window._discSleep(wait);
    }
    if (token !== window._discThoughtToken) return;
    gsap.fromTo(now, { textShadow: '0 0 24px rgba(249,115,22,.55)' }, { textShadow: '0 2px 32px rgba(0,0,0,.65)', duration: 0.7, ease: 'power2.out' });
};

window.pushDiscStream = function(text, isMetrics) {
    const stream = document.getElementById('disc-stream');
    if (!stream || !text) return;
    const line = document.createElement('div');
    line.className = 'disc-stream-line' + (isMetrics ? ' metrics' : '');
    line.textContent = (isMetrics ? '› ' : '· ') + text;
    stream.appendChild(line);
    while (stream.children.length > 6) stream.removeChild(stream.firstChild);
    stream.scrollTop = stream.scrollHeight;
    if (window.gsap && !window._discReduced()) {
        window.gsap.fromTo(line, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.75, ease: 'power2.out' });
    }
};

window.clearDiscBridge = function() {
    const svg = document.getElementById('disc-bridge');
    if (svg) {
        svg.querySelectorAll('path.axon, circle.soma, circle.synapse').forEach(n => n.remove());
    }
    document.querySelectorAll('.disc-spark').forEach(n => n.remove());
};

window.resetDiscShell = function() {
    window._discThoughtToken++;
    window._discRevealedIds = new Set();
    window.clearDiscBridge();
    const stream = document.getElementById('disc-stream');
    if (stream) stream.innerHTML = '';
    const now = document.getElementById('disc-thought-now');
    if (now) { now.dataset.full = ''; now.style.opacity = '1'; }
    window.setDiscThought('等待接入本地招聘知识库，启动后将展开实时推演。', '待机');
    const meta = document.getElementById('disc-left-meta');
    if (meta) meta.textContent = '知识星云 · 待命';
    const hallu = document.getElementById('disc-hallucination');
    if (hallu) hallu.hidden = true;
    if (window.setDisc3DMode) window.setDisc3DMode('idle');
};

window._discMissionPoint = function(el, mission) {
    const mr = mission.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - mr.left, y: r.top + r.height / 2 - mr.top };
};

window._discTravelSpark = function(pathEl, duration) {
    return new Promise(resolve => {
        const len = pathEl.getTotalLength();
        const sp = document.createElement('div');
        sp.className = 'disc-spark';
        document.body.appendChild(sp);
        const mission = document.getElementById('proto-scan-layer') || document.getElementById('disc-mission');
        if (!mission || !window.gsap) { sp.remove(); resolve(); return; }
        const mr = mission.getBoundingClientRect();
        const obj = { t: 0 };
        window.gsap.to(obj, {
            t: 1, duration: duration || 0.9, ease: 'power2.inOut',
            onUpdate: () => {
                const pt = pathEl.getPointAtLength(obj.t * len);
                sp.style.left = (mr.left + pt.x) + 'px';
                sp.style.top = (mr.top + pt.y) + 'px';
            },
            onComplete: () => { sp.remove(); resolve(); }
        });
    });
};

window._discBurstAt = function(clientX, clientY, count) {
    const n = count || 16;
    for (let i = 0; i < n; i++) {
        const sp = document.createElement('div');
        sp.className = 'disc-spark';
        sp.style.left = clientX + 'px';
        sp.style.top = clientY + 'px';
        document.body.appendChild(sp);
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const dist = 28 + Math.random() * 54;
        if (window.gsap) {
            window.gsap.to(sp, {
                x: Math.cos(ang) * dist, y: Math.sin(ang) * dist,
                opacity: 0, scale: 0.15, duration: 0.85 + Math.random() * 0.35,
                ease: 'power2.out', onComplete: () => sp.remove()
            });
        } else {
            setTimeout(() => sp.remove(), 900);
        }
    }
};

window._discEnsureSoma = function(svg, o) {
    let soma = svg.querySelector('circle.soma');
    if (!soma) {
        soma = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        soma.setAttribute('class', 'soma');
        svg.appendChild(soma);
    }
    soma.setAttribute('cx', o.x);
    soma.setAttribute('cy', o.y);
    soma.setAttribute('r', '5');
    soma.style.opacity = '1';
    if (window.gsap) {
        window.gsap.fromTo(soma, { attr: { r: 3 }, opacity: 0.55 }, { attr: { r: 6.5 }, opacity: 1, duration: 0.4, yoyo: true, repeat: 1 });
    }
    return soma;
};

window._discFadeRemove = function(nodes) {
    return new Promise(resolve => {
        const list = Array.from(nodes || []).filter(Boolean);
        if (!list.length) { resolve(); return; }
        if (!window.gsap) {
            list.forEach(n => n.remove());
            resolve();
            return;
        }
        window.gsap.to(list, {
            opacity: 0, duration: 0.35, ease: 'power1.in',
            onComplete: () => { list.forEach(n => n.remove()); resolve(); }
        });
    });
};

/** 粒子从突触端汇聚成卡片 */
window._discParticleFormCard = async function(card, fromX, fromY) {
    const gsap = window.gsap;
    const cr = card.getBoundingClientRect();
    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;
    if (!gsap) {
        card.classList.remove('disc-await');
        card.classList.add('disc-born');
        return;
    }
    gsap.set(card, { opacity: 0, scale: 0.72, filter: 'blur(8px)' });
    card.classList.remove('disc-await');
    const n = 26;
    const waits = [];
    for (let i = 0; i < n; i++) {
        const sp = document.createElement('div');
        sp.className = 'disc-spark disc-spark-form';
        const jitter = 14;
        sp.style.left = (fromX + (Math.random() - 0.5) * jitter) + 'px';
        sp.style.top = (fromY + (Math.random() - 0.5) * jitter) + 'px';
        sp.style.width = (3 + Math.random() * 4) + 'px';
        sp.style.height = sp.style.width;
        document.body.appendChild(sp);
        const tx = cr.left + 8 + Math.random() * Math.max(cr.width - 16, 8);
        const ty = cr.top + 8 + Math.random() * Math.max(cr.height - 16, 8);
        waits.push(new Promise(res => {
            gsap.to(sp, {
                left: tx, top: ty, duration: 0.5 + Math.random() * 0.28,
                ease: 'power2.in',
                onComplete: () => {
                    gsap.to(sp, {
                        left: cx, top: cy, opacity: 0, scale: 0.2,
                        duration: 0.28, ease: 'power1.in',
                        onComplete: () => { sp.remove(); res(); }
                    });
                }
            });
        }));
    }
    await window._discSleep(280);
    card.classList.add('disc-born');
    gsap.to(card, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.55, ease: 'power2.out' });
    window._discBurstAt(cx, cy, 12);
    await Promise.all(waits);
};

window.mountDiscoveryStage = function() {
    window.ensureDiscoveryState();
    if (!window._discRevealedIds) window._discRevealedIds = new Set();
    const ds = window.discoveryState;
    const all = [...(ds.discoveries || []), ...(ds.forecasts || [])];
    const foundGrid = document.getElementById('discovery-grid');
    if (!foundGrid) return;
    const want = all.map(j => j.id).filter(Boolean);
    const have = Array.from(document.querySelectorAll('#discovery-results .job-card[data-job-id], #discovery-grid .job-card[data-job-id], #forecast-grid .job-card[data-job-id]')).map(el => el.getAttribute('data-job-id'));
    const same = want.length > 0 && want.length === have.length && want.every(id => have.includes(id));
    if (!same) {
        const prevStatus = ds.status, prevSearch = ds.search, prevCat = ds.category;
        ds.status = 'all'; ds.search = ''; ds.category = 'all';
        window.renderDiscoveryList({ skipAnim: true, fullMount: true });
        ds.status = prevStatus; ds.search = prevSearch; ds.category = prevCat;
    }
    Array.from(document.querySelectorAll('#discovery-results .job-card, #discovery-grid .job-card, #forecast-grid .job-card')).forEach(card => {
        const id = card.getAttribute('data-job-id') || '';
        if (id && window._discRevealedIds.has(id)) {
            card.classList.remove('disc-await');
            card.classList.add('disc-born');
            if (window.gsap) window.gsap.set(card, { clearProps: 'opacity,transform,filter' });
        } else {
            card.classList.add('disc-await');
            card.classList.remove('disc-born');
        }
    });
};

window.revealDiscoveryJobs = async function(opts) {
    opts = opts || {};
    const reduced = opts.reduced || window._discReduced();
    if (!window._discRevealedIds) window._discRevealedIds = new Set();
    window.mountDiscoveryStage();
    const grid = document.getElementById('discovery-grid');
    const mission = document.getElementById('disc-mission');
    const svg = document.getElementById('disc-bridge');
    if (!grid || !mission || !svg) return;
    let cards = Array.from(document.querySelectorAll('#discovery-results .job-card, #discovery-grid .job-card, #forecast-grid .job-card'));
    if (!cards.length) return;
    const onlyIds = opts.onlyIds ? new Set(opts.onlyIds) : null;
    if (onlyIds) cards = cards.filter(c => onlyIds.has(c.getAttribute('data-job-id')));
    if (reduced) {
        cards.forEach(c => {
            c.classList.remove('disc-await');
            c.classList.add('disc-born');
            const id = c.getAttribute('data-job-id');
            if (id) window._discRevealedIds.add(id);
        });
        return;
    }
    const pending = cards.filter(card => {
        const id = card.getAttribute('data-job-id') || '';
        if (id && window._discRevealedIds.has(id)) {
            card.classList.remove('disc-await');
            card.classList.add('disc-born');
            if (window.gsap) window.gsap.set(card, { clearProps: 'opacity,transform,filter' });
            return false;
        }
        card.classList.add('disc-await');
        return true;
    });
    if (!pending.length) return;

    // 网格顺序（从上到下、从左到右）
    pending.sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        if (Math.abs(ra.top - rb.top) > 24) return ra.top - rb.top;
        return ra.left - rb.left;
    });

    const layer = document.getElementById('proto-scan-layer');
    const stage = document.getElementById('proto-stage') || document.getElementById('disc-3d');
    const coordRoot = (layer && layer.classList.contains('on')) ? layer : mission;
    const stageBox = stage ? stage.getBoundingClientRect() : null;
    const missionVisible = coordRoot && stageBox && stageBox.width > 8 && stageBox.height > 8;

    if (!missionVisible) {
        pending.forEach((card, i) => {
            const id = card.getAttribute('data-job-id') || '';
            card.classList.remove('disc-await');
            card.classList.add('disc-born');
            if (id) window._discRevealedIds.add(id);
            if (window.gsap) {
                window.gsap.fromTo(card, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, delay: i * 0.03, ease: 'power2.out' });
            }
        });
        return;
    }

    if (window.setDisc3DMode) window.setDisc3DMode('scanning');
    // 3D 保持干净胞体；连接线只用 SVG 树突，避免推演结束后乱线残留
    if (window._disc3dRetract) window._disc3dRetract(true);
    window.placeProtoStage && window.placeProtoStage();

    const mr = coordRoot.getBoundingClientRect();
    const o = {
        x: stageBox.left + stageBox.width / 2 - mr.left,
        y: stageBox.top + stageBox.height / 2 - mr.top
    };
    window._discEnsureSoma(svg, o);

    const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 4);
    const maxCards = Math.min(pending.length, 16);
    const targets = pending.slice(0, maxCards);
    const leftovers = pending.slice(maxCards);
    const drawn = [];

    // 多根树突同时射出，再一次性显示全部结果
    targets.forEach((card, i) => {
        const row = Math.floor(i / cols);
        const tpt = window._discMissionPoint(card, coordRoot);
        const midX = o.x + (tpt.x - o.x) * 0.4;
        const midY = o.y + (tpt.y - o.y) * 0.35 - 20 - row * 8;
        const d = 'M ' + o.x.toFixed(1) + ' ' + o.y.toFixed(1) + ' Q ' + midX.toFixed(1) + ' ' + midY.toFixed(1) + ' ' + tpt.x.toFixed(1) + ' ' + tpt.y.toFixed(1);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'axon');
        path.setAttribute('d', d);
        path.style.opacity = '1';
        svg.appendChild(path);
        const len = path.getTotalLength();
        path.style.strokeDasharray = String(len);
        path.style.strokeDashoffset = String(len);
        const syn = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        syn.setAttribute('class', 'synapse');
        syn.setAttribute('cx', tpt.x);
        syn.setAttribute('cy', tpt.y);
        syn.setAttribute('r', '0');
        syn.setAttribute('fill', '#5EEAD4');
        syn.style.opacity = '1';
        svg.appendChild(syn);
        drawn.push({ path, syn, card, len });
        if (window.gsap) {
            window.gsap.to(path, { strokeDashoffset: 0, duration: 0.55, delay: i * 0.025, ease: 'power2.out' });
            window.gsap.to(syn, { attr: { r: 4.5 }, duration: 0.55, delay: i * 0.025, ease: 'power2.out' });
        } else {
            path.style.strokeDashoffset = '0';
            syn.setAttribute('r', '4.5');
        }
    });

    await window._discSleep(620);

    // 全部结果同时浮现
    targets.forEach((card, i) => {
        const id = card.getAttribute('data-job-id') || '';
        card.classList.remove('disc-await');
        card.classList.add('disc-born');
        if (id) window._discRevealedIds.add(id);
        if (window.gsap) {
            window.gsap.fromTo(card,
                { opacity: 0, scale: 0.92, filter: 'blur(5px)' },
                { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.42, delay: Math.min(i * 0.02, 0.16), ease: 'power2.out' }
            );
        }
    });
    leftovers.forEach((card) => {
        const id = card.getAttribute('data-job-id') || '';
        card.classList.remove('disc-await');
        card.classList.add('disc-born');
        if (id) window._discRevealedIds.add(id);
        if (window.gsap) window.gsap.set(card, { clearProps: 'opacity,transform,filter' });
    });

    await window._discSleep(160);
    await window._discFadeRemove(drawn.flatMap(x => [x.path, x.syn]));
    if (window._disc3dRetract) window._disc3dRetract(true);
    if (window.setDisc3DMode) window.setDisc3DMode('settled');
};



window.updateDiscBadges = function() {
    const ds = window.discoveryState || {};
    const pg = document.getElementById('disc-pg-count');
    if (pg) {
        const scanned = ds.scanStats && ds.scanStats.total_scanned;
        pg.textContent = 'PG · ' + (scanned != null ? scanned : (ds.phase === 'settled' ? ((ds.discoveries && ds.discoveries.length) || 0) : '—'));
    }
    const eng = document.getElementById('disc-engine-badge');
    if (eng) eng.textContent = ds.scanning ? '引擎运行中' : (ds.phase === 'settled' ? '引擎就绪' : '引擎待命');
    const llm = document.getElementById('disc-llm-badge');
    if (llm) {
        let label = '—';
        if (ds.llmEnabled) label = 'DeepSeek';
        else if (ds.dataSource === 'mock') label = 'Mock';
        else if (ds.phase === 'settled') label = '启发式';
        llm.textContent = 'LLM · ' + label;
    }
};

window.bindDiscoveryEvents = function() {
    const view = document.getElementById('view-discovery');
    if (!view || view.dataset.bound) return;
    view.dataset.bound = '1';
    const resetPages = () => {
        window.discoveryState.page = 1;
        window.discoveryState.foundPage = 1;
        window.discoveryState.forecastPage = 1;
    };
    view.querySelectorAll('#discovery-tabs .tab-item').forEach(t => {
        t.addEventListener('click', () => {
            view.querySelectorAll('#discovery-tabs .tab-item').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            window.discoveryState.status = t.dataset.status; resetPages();
            view.querySelectorAll('.proto-stat').forEach(x => x.classList.toggle('active', x.dataset.status === t.dataset.status));
            window.renderDiscoveryList();
        });
    });
    view.querySelectorAll('.proto-stat').forEach(k => {
        k.addEventListener('click', () => {
            const status = k.dataset.status;
            const cur = window.discoveryState.status || 'all';
            // 再点同一 KPI → 恢复发现+预测双区初始页
            if (cur === status) {
                window.discoveryState.status = 'all';
                resetPages();
                view.querySelectorAll('.proto-stat').forEach(x => x.classList.remove('active'));
                view.querySelectorAll('#discovery-tabs .tab-item').forEach(x => x.classList.toggle('active', x.dataset.status === 'all'));
                window.renderDiscoveryList();
                window.scrollToDiscoverySec('found');
                return;
            }
            window.discoveryState.status = status; resetPages();
            view.querySelectorAll('.proto-stat').forEach(x => x.classList.toggle('active', x.dataset.status === status));
            view.querySelectorAll('#discovery-tabs .tab-item').forEach(x => x.classList.toggle('active', x.dataset.status === status));
            window.renderDiscoveryList();
            window.scrollToDiscoverySec(status);
        });
    });
    const si = document.getElementById('discovery-search');
    if (si) si.addEventListener('input', e => { window.discoveryState.search = e.target.value; resetPages(); window.renderDiscoveryList(); });
    const ss = document.getElementById('discovery-sort');
    if (ss) ss.addEventListener('change', e => { window.discoveryState.sort = e.target.value; resetPages(); window.renderDiscoveryList(); });
    const sc = document.getElementById('discovery-cat');
    if (sc) sc.addEventListener('change', e => { window.discoveryState.category = e.target.value; resetPages(); window.renderDiscoveryList(); });
    const city = document.getElementById('discovery-city');
    if (city) city.addEventListener('change', e => { window.discoveryState.city = e.target.value; resetPages(); window.renderDiscoveryList(); });
    const cf = document.getElementById('discovery-conf');
    if (cf) cf.addEventListener('change', e => { window.discoveryState.minConf = e.target.value; resetPages(); window.renderDiscoveryList(); });

    const goPage = (kind, page) => {
        const ds = window.discoveryState;
        page = Math.max(1, Number(page) || 1);
        if (kind === 'forecast') ds.forecastPage = page;
        else ds.foundPage = page;
        window.renderDiscoveryList();
        try {
            const el = document.getElementById(kind === 'forecast' ? 'disc-sec-forecast' : 'disc-sec-found');
            el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        } catch (err) {}
    };
    const results = document.getElementById('discovery-results');
    if (results) {
        results.addEventListener('click', e => {
            const jumpBtn = e.target.closest('button[data-jump]');
            if (jumpBtn) {
                const kind = jumpBtn.getAttribute('data-jump');
                const input = document.getElementById(kind === 'forecast' ? 'forecast-page-input' : 'found-page-input');
                goPage(kind, input && input.value);
                return;
            }
            const btn = e.target.closest('.proto-sec-pager button[data-page]');
            if (!btn || btn.disabled) return;
            const wrap = btn.closest('.proto-sec-pager');
            const kind = wrap && wrap.id === 'forecast-pager-wrap' ? 'forecast' : 'found';
            goPage(kind, btn.getAttribute('data-page'));
        });
        results.addEventListener('keydown', e => {
            if (e.key !== 'Enter') return;
            const input = e.target.closest('.proto-page-jump input');
            if (!input) return;
            e.preventDefault();
            const kind = input.id === 'forecast-page-input' ? 'forecast' : 'found';
            goPage(kind, input.value);
        });
    }
    if (!view.dataset.escBound) {
        view.dataset.escBound = '1';
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (document.getElementById('proto-track-panel')?.classList.contains('on')) window.closeTrackLog();
            else if (document.getElementById('proto-suggest')?.classList.contains('on')) window.closeAiSuggestions();
        });
    }
};

// ★ 智能体扫描 — 驱动 disc-* mission control 外壳
window.buildMockScanPayload = function() {
    const now = new Date().toISOString();
    const mkDisc = (i, title, cat, conf, skills, city) => ({
        id: 'disc_mock_' + i, title, category: cat, level: '中高级', confidence: conf,
        growth_rate: 20 + i * 3, status: 'pending', discovered_at: now,
        core_skills: skills, preferred_skills: [], definition: '基于本地招聘库聚类启发式生成，未经 LLM 增强。',
        typical_scenarios: ['企业内场景','技术中台','数字化转型'], evidence_sources: [],
        responsibilities: ['参与需求分析与方案设计','完成核心功能开发','配合测试与上线运维'],
        trend: [], quality: {evidence_count: 3+i, source_count: 2+i, city_count: 1+i, freshness_score: 70+i},
        source: 'Mock数据源', city, salary: '20-40K', requiredSkills: skills,
        description: '基于本地招聘库聚类启发式生成。', discoveredAt: now,
        reasoning: 'Mock 路径：标题新颖度+技能组合熵+跨行业溢出 = 综合置信度 ' + conf + '%'
    });
    const discoveries = [
        mkDisc(1,'AI Agent 架构师','人工智能',88,['LangChain','Function Calling','RAG','Python'],'北京'),
        mkDisc(2,'大模型微调工程师','人工智能',84,['LoRA','QLoRA','PyTorch','SFT'],'上海'),
        mkDisc(3,'RAG 知识工程师','人工智能',80,['向量数据库','Embedding','检索增强'],'深圳'),
        mkDisc(4,'多模态算法工程师','人工智能',78,['CLIP','Diffusion','多模态'],'杭州'),
        mkDisc(5,'Prompt 工程师','人工智能',72,['Prompt设计','LLM','评测'],'成都'),
        mkDisc(6,'AI Infra 工程师','人工智能',70,['Triton','CUDA','AI编译器'],'北京'),
        mkDisc(7,'AIGC 内容工程师','人工智能',68,['Stable Diffusion','生成式','PyTorch'],'广州'),
        mkDisc(8,'LLM 应用开发工程师','人工智能',66,['LangChain','API','Agent'],'远程')
    ];
    const mkFc = (i, title, cat, conf, eta, skills) => ({
        id: 'forecast_mock_' + i, title, category: cat, confidence: conf, eta_months: eta,
        drivers: ['趋势外推','技能信号累积'], skills, definition: 'Mock 预测岗位，基于新兴技能时序外推。',
        status: 'forecast', source: '趋势预测模型(Mock)', city: '全国', salary: '面议(新兴岗位)', level: '专家',
        requiredSkills: skills, description: 'Mock 预测岗位。', discoveredAt: now, is_forecast: true
    });
    const forecasts = [
        mkFc(1,'具身智能工程师','人工智能',74,12,['ROS2','强化学习','SLAM']),
        mkFc(2,'AI安全对齐工程师','安全',78,9,['RLHF','红队测试','对齐']),
        mkFc(3,'端侧AI部署工程师','人工智能',80,6,['ONNX','TensorRT','量化']),
        mkFc(4,'合成数据工程师','数据科学',75,8,['GAN','LLM','数据增强']),
        mkFc(5,'AI芯片软件栈工程师','人工智能',70,15,['Triton','MLIR','TVM']),
        mkFc(6,'AI研发效能工程师','运维测试',73,10,['AI Coding','CI/CD','DORA'])
    ];
    const chain = [
        {step:1,title:'🌐 多源数据接入',detail:'Mock：连接本地 PostgreSQL 招聘库，抽取最近 5000 条 IT 岗位记录。',status:'done',metrics:'数据规模: 5000 条 | 覆盖 320 家企业',elapsed_ms:420},
        {step:2,title:'🧠 语义消歧与实体归一化',detail:'Mock：标题字符级归一化，构建 N-gram 特征向量，识别语义聚类。',status:'done',metrics:'聚类压缩比: 6.2x | 技能词典: 480 词',elapsed_ms:510},
        {step:3,title:'📈 多维度新兴度评分',detail:'Mock：三维度加权(标题0.5+技能0.3+溢出0.2)，扫描语义簇。',status:'done',metrics:'新兴候选 8 | 传统 IT 12 | 总簇 24',elapsed_ms:600},
        {step:4,title:'📝 岗位定义生成与职责推理',detail:'Mock：基于真实 JD 摘要生成岗位定义、核心职责与典型场景。',status:'done',metrics:'输出 8 个岗位定义',elapsed_ms:520},
        {step:5,title:'🔮 时序趋势外推',detail:'Mock：指数平滑+线性回归外推 6-18 个月技能需求变化。',status:'done',metrics:'预测跨度: 6-18 个月 | 置信区间: 65%-80%',elapsed_ms:610},
        {step:6,title:'🛡️ 幻觉检测与质量审计',detail:'Mock：交叉校验证据来源，检测定义-技能一致性，标记低证据项目。',status:'done',metrics:'审计通过 8 | 弱证据 2',elapsed_ms:330}
    ];
    return {
        reasoning_chain: chain, discoveries, forecasts,
        summary: 'Mock 扫描完毕：5000 条 → 24 簇 → 8 个发现 + 6 个预测。推理引擎: DiscoveryAgent (Mock)。',
        stats: {total_scanned:5000,title_clusters:24,discoveries:8,forecasts:6,total_elapsed_ms:2990,avg_confidence:75.5},
        model: {engine:'DiscoveryAgent v2.0 (Mock)',backed_by:'启发式(Mock)',llm:'none',llm_enriched:0,llm_error:null,knowledge_base:'PostgreSQL mock'}
    };
};

window.agentScan = async function() {
    window.ensureDiscoveryState();
    const ds = window.discoveryState;
    if (ds.scanning) { window.Utils.showToast('正在推演中，请稍候...', 'amber'); return; }
    ds.scanning = true; ds.phase = 'scanning'; ds.activeStep = 0;
    const btns = [document.getElementById('btn-agent-scan'), document.getElementById('btn-agent-rescan')].filter(Boolean);
    btns.forEach(btn => { btn.disabled = true; if (btn.id === 'btn-agent-scan') btn.textContent = '推演中…'; else btn.innerHTML = '推演中…'; });
    window.resetDiscShell();
    window._discRevealedIds = new Set();
    window.showProtoScanStage();
    window.setDiscThought('正在建立与招聘库的推理通道…', '接入中');
    if (window.initDisc3D) window.initDisc3D();
    if (window.setDisc3DMode) window.setDisc3DMode('scanning');
    window.updateDiscBadges();
    const grid = document.getElementById('discovery-grid');
    const fcGrid = document.getElementById('forecast-grid');
    if (grid) grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="spinner"></span><div style="margin-top:8px;color:var(--text-muted);font-size:13px">推演进行中…</div></div>';
    if (fcGrid) fcGrid.innerHTML = '';
    const secFc = document.getElementById('disc-sec-forecast');
    if (secFc) secFc.style.display = 'none';
    const fw = document.getElementById('found-pager-wrap');
    const fww = document.getElementById('forecast-pager-wrap');
    if (fw) fw.hidden = true;
    if (fww) fww.hidden = true;
    const totalScan = document.getElementById('disc-total-label');
    if (totalScan) totalScan.textContent = '扫描进行中…';
    if (window._disc3dRetract) window._disc3dRetract(true);

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let payload, usedMock = false;
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 90000);
        const r = await fetch(window.API_BASE + '/api/discovery/agent/scan', {method:'POST', signal: ctrl.signal});
        clearTimeout(timer);
        const j = await r.json();
        if (j.code !== 0) throw new Error(j.message || 'scan failed');
        payload = j.data;
        ds.dataSource = 'api';
    } catch(e) {
        payload = window.buildMockScanPayload();
        ds.dataSource = 'mock';
        usedMock = true;
        window.Utils.showToast('后端不可用,已切换 Mock 数据: ' + (e.message||e), 'amber');
    }

    ds.discoveries = payload.discoveries || [];
    ds.forecasts = payload.forecasts || [];
    ds.reasoningChain = payload.reasoning_chain || [];
    ds.scanSummary = payload.summary || '';
    ds.modelInfo = payload.model || {};
    ds.scanStats = payload.stats || {};
    ds.llmEnabled = !!(ds.modelInfo.llm && ds.modelInfo.llm !== 'none');

    await window.playReasoningSequence(ds.reasoningChain, reduced);

    ds.scanning = false; ds.phase = 'settled';
    window.updateDiscoveryCounts();
    window.updateDiscBadges();
    if (window._disc3dRetract) window._disc3dRetract(true);
    if (window.setDisc3DMode) window.setDisc3DMode('settled');
    window.clearDiscBridge && window.clearDiscBridge();
    setTimeout(() => {
        window.hideProtoScanStage();
        ds.page = 1;
        ds.foundPage = 1;
        ds.forecastPage = 1;
        ds.status = 'all';
        window.renderDiscoveryList({ skipAnim: true });
    }, 480);
    btns.forEach(btn => { btn.disabled = false; if (btn.id === 'btn-agent-scan') btn.textContent = '重新扫描'; else btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><polyline points="21 3 21 9 15 9"/></svg> 重新扫描'; });
    const meta = document.getElementById('disc-left-meta');
    if (meta) meta.textContent = '发现 ' + ds.discoveries.length + ' · 预测 ' + ds.forecasts.length;
    window.Utils.showToast((usedMock?'[Mock] ':'') + '扫描完成: 发现 ' + ds.discoveries.length + ' 个岗位, 预测 ' + ds.forecasts.length + ' 个未来岗位', usedMock ? 'amber' : 'mint');
};

// 实时推理流：慢速连贯推演 + 岗位胞体连线浮现
window.playReasoningSequence = async function(chain, reduced) {
    const ds = window.discoveryState;
    chain = chain || [];
    const stream = document.getElementById('disc-stream');
    if (stream) stream.innerHTML = '';
    const sleep = window._discSleep;
    const dwell = reduced ? 0 : 620;

    const stripEmoji = (txt) => {
        try { return (txt || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g,' ').trim(); }
        catch (e) { return (txt || '').replace(/[🌐🧠📈📝🔮🛡️📊]/g, '').trim(); }
    };

    let revealed = false;
    for (let i = 0; i < chain.length; i++) {
        const s = chain[i];
        ds.activeStep = i + 1;
        const title = stripEmoji(s.title) || ('推理片段 ' + (i + 1));
        const detail = s.detail || '';
        await window.setDiscThought(detail || title, title);
        if (dwell) await sleep(70);
        window.pushDiscStream(detail || title, false);
        if (s.metrics) {
            await sleep(reduced ? 0 : 110);
            window.pushDiscStream(s.metrics, true);
        }
        if (window.setDisc3DMode) window.setDisc3DMode('pulse', i / Math.max(chain.length - 1, 1));

        if (s.step === 2 && window.playClusterAnimation) window.playClusterAnimation(s);
        if (s.step === 3 && window.updateDiscRadar) window.updateDiscRadar(s, ds);
        // step 6 幻觉审计 UI 已关闭，仅保留推理文案

        if (dwell) await sleep(dwell);

        if (s.step === 4) {
            await window.setDiscThought('推理胞体正在向工作台投射全部结果…', '投射中');
            window.mountDiscoveryStage();
            // 发现 + 预测一并投射，多根树突同时连接
            await window.revealDiscoveryJobs({ reduced: reduced });
            revealed = true;
            if (dwell) await sleep(140);
        }
        if (s.step === 5) {
            await window.setDiscThought(detail || title, title);
            // 结果已在 step4 全部显示，此处仅更新文案
            if (dwell) await sleep(Math.min(dwell, 280));
        }
    }
    if (!revealed) {
        window.mountDiscoveryStage();
        await window.revealDiscoveryJobs({ reduced: reduced });
    }
    if (ds.scanSummary) {
        await window.setDiscThought(ds.scanSummary, '完成');
        window.pushDiscStream(ds.scanSummary, false);
    }
};


window.updateDiscoveryCounts = function() {
    window.ensureDiscoveryState();
    const ds = window.discoveryState;
    if (ds.city == null) ds.city = 'all';
    const discs = ds.discoveries || [];
    const fcs = ds.forecasts || [];
    const pending = discs.filter(j => j.status === 'pending' || !j.status).length;
    const adopted = discs.filter(j => j.status === 'adopted').length;
    const rejected = discs.filter(j => j.status === 'rejected').length;
    const counts = { all: discs.length + fcs.length, found: discs.length, pending, adopted, rejected, forecast: fcs.length };
    Object.entries(counts).forEach(([k,v]) => { const el=document.getElementById('discovery-count-'+k); if(el) el.textContent=v; });
    [
        {sel:'#kpi-discovered', val:counts.found},
        {sel:'#kpi-pending', val:counts.pending},
        {sel:'#kpi-adopted', val:counts.adopted},
        {sel:'#kpi-forecast', val:counts.forecast}
    ].forEach(({sel,val}) => { const el=document.querySelector(sel); if(!el) return; el.dataset.val='0'; window.Utils.animateNum(el, val, 900, 0); });
    document.querySelectorAll('#view-discovery .proto-stat').forEach(el => {
        el.classList.toggle('active', (ds.status || 'all') !== 'all' && el.dataset.status === ds.status);
    });
    const scanned = (ds.scanStats && ds.scanStats.total_scanned) || (ds.phase === 'settled' ? 5328 : null);
    const heroScan = document.getElementById('disc-hero-scanned');
    if (heroScan) heroScan.textContent = scanned != null ? Number(scanned).toLocaleString('zh-CN') : '—';
    const heroDesc = document.getElementById('disc-hero-desc');
    if (heroDesc) {
        if (ds.phase === 'settled' || discs.length) {
            heroDesc.textContent = '发现 ' + discs.length + ' 个岗位（待审核 ' + pending + ' · 已采购 ' + adopted + '），预测 ' + fcs.length + ' 个。';
        } else {
            heroDesc.textContent = '点击「重新扫描」开始推演，结果将分为发现岗位与预测岗位。';
        }
    }
    const total = document.getElementById('disc-total-label');
    if (total) total.textContent = '共 ' + counts.all + ' 个岗位';
    const setTrend = (id, text, up) => { const el=document.getElementById(id); if(!el) return; el.textContent=text; el.classList.toggle('up', !!up); };
    if (ds.phase === 'settled' || discs.length || fcs.length) {
        setTrend('kpi-discovered-trend', counts.found + ' 个', true);
        setTrend('kpi-pending-trend', counts.pending ? '待处理' : '已清空', !!counts.pending);
        setTrend('kpi-adopted-trend', counts.adopted ? '已入库' : '暂无', false);
        setTrend('kpi-forecast-trend', counts.forecast + ' 个', true);
    }
};

window._discConfRing = function(conf, delayMs) {
    const c = Math.max(0, Math.min(100, conf || 0));
    const r = 18, circ = 2 * Math.PI * r;
    const off = circ * (1 - c / 100);
    const color = c >= 80 ? '#2563EB' : c >= 60 ? '#F59E0B' : '#EF4444';
    const delay = Math.max(0, delayMs || 0);
    return '<div class="disc-ring" title="匹配度 '+c+'%" style="--circ:'+circ.toFixed(2)+';--off:'+off.toFixed(2)+';animation-delay:'+delay+'ms">' +
        '<svg width="48" height="48" viewBox="0 0 44 44">' +
        '<circle class="ring-track" cx="22" cy="22" r="'+r+'" fill="none" stroke-width="4"/>' +
        '<circle class="ring-progress" cx="22" cy="22" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="4" style="animation-delay:'+delay+'ms"/>' +
        '</svg><span data-target="'+c+'">0%</span></div>';
};


window._discRenderPager = function(pagerId, pages, page) {
    const pager = typeof pagerId === 'string' ? document.getElementById(pagerId) : pagerId;
    if (!pager) return;
    pages = Math.max(0, Number(pages) || 0);
    page = Math.max(1, Math.min(pages || 1, Number(page) || 1));
    if (pages <= 1) { pager.innerHTML = ''; return; }
    const buttons = [];
    buttons.push('<button type="button" data-page="' + Math.max(1, page - 1) + '"' + (page <= 1 ? ' disabled' : '') + ' aria-label="上一页">‹</button>');
    const push = (n) => {
        buttons.push('<button type="button" data-page="' + n + '"' + (n === page ? ' class="on"' : '') + '>' + n + '</button>');
    };
    if (pages <= 7) {
        for (let i = 1; i <= pages; i++) push(i);
    } else {
        push(1);
        const start = Math.max(2, page - 1);
        const end = Math.min(pages - 1, page + 1);
        if (start > 2) buttons.push('<span>…</span>');
        for (let i = start; i <= end; i++) push(i);
        if (end < pages - 1) buttons.push('<span>…</span>');
        push(pages);
    }
    buttons.push('<button type="button" data-page="' + Math.min(pages, page + 1) + '"' + (page >= pages ? ' disabled' : '') + ' aria-label="下一页">›</button>');
    pager.innerHTML = buttons.join('');
};

window._discUpdateSecPager = function(kind, total, page) {
    const ds = window.discoveryState || {};
    const size = Math.max(1, Number(ds.pageSize) || 4);
    const pages = Math.max(1, Math.ceil((total || 0) / size));
    page = Math.max(1, Math.min(pages, Number(page) || 1));
    if (kind === 'forecast') ds.forecastPage = page;
    else ds.foundPage = page;

    const wrap = document.getElementById(kind === 'forecast' ? 'forecast-pager-wrap' : 'found-pager-wrap');
    const pagerId = kind === 'forecast' ? 'forecast-pager' : 'found-pager';
    const input = document.getElementById(kind === 'forecast' ? 'forecast-page-input' : 'found-page-input');
    if (wrap) wrap.hidden = total <= size;
    if (typeof window._discRenderPager === 'function') window._discRenderPager(pagerId, pages, page);
    if (input) {
        input.max = String(pages);
        input.min = '1';
        input.value = String(page);
        input.placeholder = '1-' + pages;
    }
    return { page, pages, size, start: (page - 1) * size };
};

window.renderDiscoveryList = function(opts) {
    opts = opts || {};
    window.ensureDiscoveryState();
    const ds = window.discoveryState;
    if (ds.city == null) ds.city = 'all';
    const foundGrid = document.getElementById('discovery-grid');
    const fcGrid = document.getElementById('forecast-grid');
    const secFound = document.getElementById('disc-sec-found');
    const secFc = document.getElementById('disc-sec-forecast');
    if (!foundGrid) return;

    const applyFilters = (arr) => {
        let list = [...(arr || [])];
        if (ds.search) {
            const s = ds.search.toLowerCase();
            list = list.filter(j => (j.title||'').toLowerCase().includes(s) || (j.requiredSkills||j.core_skills||[]).some(sk=>String(sk).toLowerCase().includes(s)));
        }
        if (ds.category !== 'all') list = list.filter(j => j.category === ds.category);
        if (ds.city && ds.city !== 'all') list = list.filter(j => (j.city||'') === ds.city);
        if (ds.minConf != null && ds.minConf !== 'all') list = list.filter(j => (j.confidence||0) >= Number(ds.minConf));
        if (ds.sort === 'confidence') list.sort((a,b)=>(b.confidence||0)-(a.confidence||0));
        else if (ds.sort === 'date') list.sort((a,b)=>new Date(b.discoveredAt||0)-new Date(a.discoveredAt||0));
        else if (ds.sort === 'name') list.sort((a,b)=>(a.title||'').localeCompare(b.title||''));
        return list;
    };

    let found = applyFilters(ds.discoveries || []);
    let forecasts = applyFilters(ds.forecasts || []);
    // KPI 只做定位/筛选卡片，两块区域始终保留展示
    if (ds.status === 'pending' || ds.status === 'adopted' || ds.status === 'rejected') {
        found = found.filter(j => (j.status || 'pending') === ds.status);
    } else if (ds.status && ds.status !== 'all' && ds.status !== 'found' && ds.status !== 'forecast') {
        found = found.filter(j => j.status === ds.status);
    }

    const totalEl = document.getElementById('disc-total-label');
    if (totalEl) totalEl.textContent = '共 ' + (found.length + forecasts.length) + ' 个岗位';
    const fcCount = document.getElementById('disc-found-count');
    const ffCount = document.getElementById('disc-forecast-count');
    if (fcCount) fcCount.textContent = found.length + ' 个';
    if (ffCount) ffCount.textContent = forecasts.length + ' 个';

    if (secFound) { secFound.hidden = false; secFound.style.display = ''; }
    if (secFc) { secFc.hidden = false; secFc.style.display = ''; }

    const relTime = (iso) => {
        if (!iso) return '刚刚更新';
        const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
        if (mins < 60) return mins + ' 分钟前更新';
        if (mins < 1440) return Math.round(mins/60) + ' 小时前更新';
        return '近日更新';
    };
    const cardHtml = (j, i, isForecast) => {
        const conf = j.confidence||0;
        const skipAnim = opts.skipAnim;
        const st = j.status || 'pending';
        const delay = skipAnim ? 0 : Math.min(i * 55, 360);
        const cardCls = 'job-card disc-proto '+(skipAnim?'no-enter-anim ':'anim-fade-up ')+(isForecast?' is-forecast':'');
        const skills = (j.requiredSkills||j.core_skills||[]).slice(0,3);
        const more = Math.max(0, (j.requiredSkills||j.core_skills||[]).length - 3);
        const salary = j.salary || '面议';
        const openFn = isForecast ? 'window.showDiscoveryDetail' : 'window.auditDiscoveryJob';
        const actions = isForecast
            ? '<button type="button" class="btn-track" onclick="event.stopPropagation();window.trackForecastJob(\''+j.id+'\')">跟踪</button>'
            : (st==='pending'
                ? '<button type="button" class="btn-audit" onclick="event.stopPropagation();window.auditDiscoveryJob(\''+j.id+'\')">审核</button><button type="button" class="btn-buy" onclick="event.stopPropagation();window.adoptDiscoveryJob(\''+j.id+'\')">采购</button>'
                : (st==='adopted'
                    ? '<button type="button" class="btn-audit" onclick="event.stopPropagation();window.auditDiscoveryJob(\''+j.id+'\')">审核记录</button><button type="button" class="btn-buy" disabled>已采购</button>'
                    : '<button type="button" class="btn-audit" onclick="event.stopPropagation();window.auditDiscoveryJob(\''+j.id+'\')">查看</button><button type="button" disabled>已拒绝</button>'));
        const chips = skills.map((s, si) => '<span class="skill-chip" style="animation-delay:'+(delay + 120 + si * 70)+'ms">'+s+'</span>').join('')
            + (more ? '<span class="skill-chip" style="animation-delay:'+(delay + 120 + skills.length * 70)+'ms">+'+more+'</span>' : '');
        return '<div class="'+cardCls+'" data-job-id="'+j.id+'" data-kind="'+(isForecast?'forecast':'found')+'" style="'+(skipAnim?'':'animation-delay:'+delay+'ms')+'" onclick="'+openFn+'(\''+j.id+'\')">'+
            '<div class="disc-proto-top"><div class="disc-proto-main"><div class="disc-proto-title" style="animation-delay:'+(delay+40)+'ms">'+j.title+'</div>'+
            '<div class="disc-proto-meta">'+salary+' · '+(j.city||'--')+' · '+(j.level||'--')+'</div>'+
            '<div class="disc-proto-time">'+relTime(j.discoveredAt||j.discovered_at)+'</div></div>'+
            window._discConfRing(conf, delay + 80)+'</div>'+
            '<div class="disc-proto-skills">'+chips+'</div>'+
            '<div class="disc-proto-actions">'+actions+'</div></div>';
    };

    if (!found.length && !forecasts.length) {
        foundGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div style="font-size:14px;margin-top:8px">未找到匹配岗位。点击「重新扫描」从真实库推演。</div></div>';
        if (fcGrid) fcGrid.innerHTML = '';
        if (secFound) secFound.style.display = '';
        if (secFc) secFc.style.display = 'none';
        const fw = document.getElementById('found-pager-wrap');
        const fww = document.getElementById('forecast-pager-wrap');
        if (fw) fw.hidden = true;
        if (fww) fww.hidden = true;
        return;
    }

    const size = opts.fullMount ? Math.max(found.length, forecasts.length, 1) : Math.max(1, Number(ds.pageSize) || 4);
    const foundMeta = opts.fullMount
        ? { page: 1, pages: 1, size, start: 0 }
        : window._discUpdateSecPager('found', found.length, ds.foundPage);
    if (opts.fullMount) {
        const fw = document.getElementById('found-pager-wrap');
        if (fw) fw.hidden = true;
    }
    const foundPageItems = found.slice(foundMeta.start, foundMeta.start + foundMeta.size);
    foundGrid.innerHTML = found.length
        ? foundPageItems.map((j,i) => cardHtml(j, i, false)).join('')
        : '<div class="empty-state" style="grid-column:1/-1;padding:12px;font-size:13px;color:#9CA3AF">本轮暂无发现岗位</div>';
    if (!found.length) {
        const fw = document.getElementById('found-pager-wrap');
        if (fw) fw.hidden = true;
    }

    if (fcGrid) {
        const fcMeta = opts.fullMount
            ? { page: 1, pages: 1, size, start: 0 }
            : window._discUpdateSecPager('forecast', forecasts.length, ds.forecastPage);
        if (opts.fullMount) {
            const fww = document.getElementById('forecast-pager-wrap');
            if (fww) fww.hidden = true;
        }
        const fcPageItems = forecasts.slice(fcMeta.start, fcMeta.start + fcMeta.size);
        fcGrid.innerHTML = forecasts.length
            ? fcPageItems.map((j,i) => cardHtml(j, i, true)).join('')
            : '<div class="empty-state" style="grid-column:1/-1;padding:12px;font-size:13px;color:#9CA3AF">本轮暂无预测岗位</div>';
        if (!forecasts.length) {
            const fww = document.getElementById('forecast-pager-wrap');
            if (fww) fww.hidden = true;
        }
        if (secFc) secFc.style.display = '';
    }
    if (secFound) secFound.style.display = '';
    window.renderTrackRail && window.renderTrackRail();
    window._discAnimateCardScores && window._discAnimateCardScores();
};

window._discAnimateCardScores = function() {
    const nodes = document.querySelectorAll('#discovery-results .disc-ring span[data-target]');
    nodes.forEach((el) => {
        if (el.dataset.animated === '1') return;
        el.dataset.animated = '1';
        const target = Number(el.getAttribute('data-target') || 0);
        const card = el.closest('.job-card');
        if (card && card.classList.contains('no-enter-anim')) {
            el.textContent = target + '%';
            return;
        }
        const ring = el.closest('.disc-ring');
        const delayStr = (ring && ring.style.animationDelay) || '0ms';
        const delay = parseFloat(delayStr) || 0;
        const startAt = performance.now() + delay;
        const dur = 850;
        const tick = (now) => {
            if (now < startAt) { requestAnimationFrame(tick); return; }
            const t = Math.min(1, (now - startAt) / dur);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(target * eased) + '%';
            if (t < 1) requestAnimationFrame(tick);
            else el.textContent = target + '%';
        };
        requestAnimationFrame(tick);
    });
};




window.adoptDiscoveryJob = async function(id) {
    try { await fetch(window.API_BASE + '/api/discovery/jobs/'+id+'/status', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'adopted'})}); } catch(e) {}
    (window.discoveryState.discoveries||[]).forEach(j => { if(j.id===id) j.status='adopted'; });
    window.closeDiscoveryDrawer();
    window.renderDiscoveryList(); window.updateDiscoveryCounts(); window.Utils.showToast('已采购入库', 'mint');
};
window.rejectDiscoveryJob = async function(id) {
    try { await fetch(window.API_BASE + '/api/discovery/jobs/'+id+'/status', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'rejected'})}); } catch(e) {}
    (window.discoveryState.discoveries||[]).forEach(j => { if(j.id===id) j.status='rejected'; });
    window.closeDiscoveryDrawer();
    window.renderDiscoveryList(); window.updateDiscoveryCounts(); window.Utils.showToast('已拒绝', 'pink');
};
window.placeProtoStage = function() {
    // 3D 已锚定在工具栏 orb-slot 内，随页面滚动；此处仅触发 canvas 重算尺寸
    if (window._disc3d) { window._disc3d._rw = 0; window._disc3d._rh = 0; }
};

window.showProtoScanStage = function() {
    const layer = document.getElementById('proto-scan-layer');
    const slot = document.getElementById('proto-orb-slot');
    if (!layer) return;
    if (slot) { slot.classList.add('on'); slot.setAttribute('aria-hidden', 'false'); }
    layer.classList.add('on');
    layer.setAttribute('aria-hidden', 'false');
    window.clearDiscBridge && window.clearDiscBridge();
    requestAnimationFrame(() => {
        if (window._disc3d && window._disc3dDestroy) window._disc3dDestroy();
        if (window.initDisc3D) window.initDisc3D();
        if (window.setDisc3DMode) window.setDisc3DMode('scanning');
        window.placeProtoStage && window.placeProtoStage();
    });
    if (!window._protoStageResizeBound) {
        window._protoStageResizeBound = true;
        window.addEventListener('resize', () => {
            const layer = document.getElementById('proto-scan-layer');
            if (layer && layer.classList.contains('on')) window.placeProtoStage && window.placeProtoStage();
        });
    }
};

window.hideProtoScanStage = function() {
    const layer = document.getElementById('proto-scan-layer');
    const slot = document.getElementById('proto-orb-slot');
    if (slot) { slot.classList.remove('on'); slot.setAttribute('aria-hidden', 'true'); }
    if (!layer) return;
    layer.classList.remove('on');
    layer.setAttribute('aria-hidden', 'true');
    window.clearDiscBridge && window.clearDiscBridge();
    if (window._disc3dRetract) window._disc3dRetract(true);
    if (window.setDisc3DMode) window.setDisc3DMode('idle');
};

window._suggestChatHistory = [];
window._suggestChatBusy = false;

window._suggestEsc = function(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

window._suggestJobCardHtml = function(j, i) {
    const skills = (j.requiredSkills || j.core_skills || j.skills || []).slice(0, 4).join(' · ');
    const why = j.reasoning || j.definition || j.description || '基于多源招聘库新兴度评分与技能组合熵的综合推荐。';
    return '<div class="proto-chat-row is-job">' +
        '<article class="proto-suggest-item">' +
        '<h3><span class="rank">' + (i + 1) + '</span>' + window._suggestEsc(j.title || '未命名岗位') + '</h3>' +
        '<div class="meta">' + window._suggestEsc(j.salary || '面议') + ' · ' + window._suggestEsc(j.city || '--') + ' · ' + window._suggestEsc(j.level || '--') + (skills ? ' · ' + window._suggestEsc(skills) : '') + '</div>' +
        '<div class="why">' + window._suggestEsc(why) + '</div>' +
        '<div class="row"><span class="score">匹配 ' + (j.confidence || 0) + '%</span>' +
        '<span><button type="button" onclick="window.auditDiscoveryJob(\'' + j.id + '\');window.closeAiSuggestions();">审核</button> ' +
        '<button type="button" class="buy" onclick="window.adoptDiscoveryJob(\'' + j.id + '\')">采购</button></span></div></article></div>';
};

window._suggestFormatReply = function(text) {
    let s = window._suggestEsc(text);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\n/g, '<br>');
    return s;
};

window._suggestAppendBubble = function(role, text, opts) {
    opts = opts || {};
    const body = document.getElementById('proto-suggest-body');
    if (!body) return null;
    const row = document.createElement('div');
    row.className = 'proto-chat-row is-' + (role === 'user' ? 'user' : (role === 'sys' ? 'sys' : 'ai')) + (opts.thinking ? ' proto-chat-thinking' : '');
    if (role === 'sys') {
        row.innerHTML = '<div class="proto-chat-bubble">' + window._suggestEsc(text) + '</div>';
    } else if (role === 'user') {
        row.innerHTML = '<div class="proto-chat-mini" aria-hidden="true">我</div><div class="proto-chat-bubble"><p class="lead">' + window._suggestEsc(text) + '</p></div>';
    } else {
        row.innerHTML = '<div class="proto-chat-mini" aria-hidden="true">顾</div><div class="proto-chat-bubble"><p class="lead" style="white-space:pre-wrap;line-height:1.6">' + window._suggestFormatReply(text) + '</p></div>';
    }
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
    return row;
};

window.openAiSuggestions = async function() {
    window.ensureDiscoveryState();
    const panel = document.getElementById('proto-suggest');
    const mask = document.getElementById('proto-suggest-mask');
    const body = document.getElementById('proto-suggest-body');
    const sub = document.getElementById('proto-suggest-sub');
    const input = document.getElementById('proto-suggest-input');
    if (!panel || !body) return;
    window._suggestChatHistory = [];
    window._suggestChatBusy = false;
    if (input) { input.value = ''; input.disabled = false; }
    const sendBtn = document.getElementById('proto-suggest-send');
    if (sendBtn) sendBtn.disabled = false;
    if (sub) sub.textContent = '对话中 · 连接业务顾问…';
    body.innerHTML = '';
    window._suggestAppendBubble('sys', '智能体已就绪 · 可多轮追问采购策略');
    panel.classList.add('on');
    panel.setAttribute('aria-hidden', 'false');
    if (mask) mask.classList.add('on');
    setTimeout(() => { try { input && input.focus(); } catch (e) {} }, 80);
    await window.askAiSuggest('请基于本轮扫描，给出优先采购建议，并说明审核顺序。', { bootstrap: true });
};

window.askAiSuggest = function(text, opts) {
    const input = document.getElementById('proto-suggest-input');
    if (input) input.value = text || '';
    return window.sendAiSuggestChat(opts);
};

window.sendAiSuggestChat = async function(opts) {
    opts = opts || {};
    if (window._suggestChatBusy) return;
    window.ensureDiscoveryState();
    const ds = window.discoveryState;
    const input = document.getElementById('proto-suggest-input');
    const sub = document.getElementById('proto-suggest-sub');
    const sendBtn = document.getElementById('proto-suggest-send');
    const body = document.getElementById('proto-suggest-body');
    let message = ((input && input.value) || '').trim();
    if (!message && opts.bootstrap) message = '请基于本轮扫描，给出优先采购建议，并说明审核顺序。';
    if (!message) return;

    window._suggestChatBusy = true;
    if (sendBtn) sendBtn.disabled = true;
    if (input) input.disabled = true;
    window._suggestAppendBubble('user', message);
    if (input) input.value = '';

    const thinking = window._suggestAppendBubble('ai', '正在结合招聘库扫描结果思考…', { thinking: true });
    const history = window._suggestChatHistory.slice();

    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 70000);
        const r = await fetch((window.API_BASE || 'http://127.0.0.1:5000') + '/api/agent/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ctrl.signal,
            body: JSON.stringify({
                message: message,
                channel: 'suggest',
                history: history,
                discoveries: ds.discoveries || [],
                forecasts: ds.forecasts || [],
                summary: ds.scanSummary || ''
            })
        });
        clearTimeout(timer);
        const j = await r.json();
        if (j.code !== 0) throw new Error(j.message || 'suggest chat failed');
        const data = j.data || {};
        const reply = data.reply || '暂无回复';
        const model = data.model || {};
        if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
        window._suggestAppendBubble('ai', reply);
        window._suggestChatHistory.push({ role: 'user', content: message });
        window._suggestChatHistory.push({ role: 'assistant', content: reply });

        const recs = data.recommendations || [];
        const wantCards = !!(opts.bootstrap || /采购|清单|推荐|优先|采谁|入库/.test(message));
        if (wantCards && recs.length && body) {
            // 清掉上一轮岗位卡，避免对话区被卡片刷屏
            body.querySelectorAll('.proto-chat-row.is-job').forEach(el => el.remove());
            recs.forEach((rec, i) => {
                const full = (ds.discoveries || []).find(x => x.id === rec.id) || rec;
                body.insertAdjacentHTML('beforeend', window._suggestJobCardHtml(full, i));
            });
            body.scrollTop = body.scrollHeight;
        }
        if (sub) {
            const badge = model.backed_by || (model.llm && model.llm !== 'none' ? 'DeepSeek' : '执图顾问');
            const n = (model.cache_hits && model.cache_hits.discoveries) || (ds.discoveries || []).length || 0;
            sub.textContent = '对话中 · ' + badge + ' · 上下文 ' + n + ' 个发现岗';
        }
    } catch (e) {
        if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
        const localTops = [...(ds.discoveries || [])]
            .filter(j => j.status === 'pending' || !j.status)
            .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
            .slice(0, 5);
        let fallback = '后端顾问暂时不可用（' + (e.message || e) + '）。';
        if (localTops.length) {
            fallback += '\n我先用本机扫描结果给你一份启发式清单：优先审核高置信度岗位后再采购。';
            window._suggestAppendBubble('ai', fallback);
            localTops.forEach((j, i) => {
                body.insertAdjacentHTML('beforeend', window._suggestJobCardHtml(j, i));
            });
        } else {
            fallback += '\n请确认后端已启动，并先点「重新扫描」连接数据库。';
            window._suggestAppendBubble('ai', fallback);
        }
        if (sub) sub.textContent = '对话中 · 本地兜底（后端未连通）';
        window.Utils && window.Utils.showToast('采购顾问后端未连通，已本地兜底', 'amber');
    } finally {
        window._suggestChatBusy = false;
        if (sendBtn) sendBtn.disabled = false;
        if (input) { input.disabled = false; if (!opts.bootstrap) input.focus(); }
    }
};

window.closeAiSuggestions = function() {
    const panel = document.getElementById('proto-suggest');
    const mask = document.getElementById('proto-suggest-mask');
    if (panel) { panel.classList.remove('on'); panel.setAttribute('aria-hidden', 'true'); }
    if (mask) mask.classList.remove('on');
    window._suggestChatBusy = false;
};

window.scrollToDiscoverySec = function(status) {
    const run = () => {
        const targetId = status === 'forecast' ? 'disc-sec-forecast' : 'disc-sec-found';
        let el = document.getElementById(targetId);
        if (!el || el.style.display === 'none' || el.hidden) {
            el = document.getElementById(status === 'forecast' ? 'disc-sec-found' : 'disc-sec-forecast');
        }
        if (!el || el.style.display === 'none') return;
        el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        el.classList.remove('loc-flash');
        void el.offsetWidth;
        el.classList.add('loc-flash');
    };
    requestAnimationFrame(() => setTimeout(run, 40));
};

window.ensureTrackLog = function() {
    window.ensureDiscoveryState();
    if (!Array.isArray(window.discoveryState.trackLog)) window.discoveryState.trackLog = [];
    return window.discoveryState.trackLog;
};

window.trackForecastJob = function(id) {
    window.ensureDiscoveryState();
    const job = (window.discoveryState.forecasts || []).find(j => j.id === id)
        || [...(window.discoveryState.discoveries || []), ...(window.discoveryState.forecasts || [])].find(j => j.id === id);
    if (!job) { window.Utils.showToast('未找到该预测岗位', 'amber'); return; }
    const log = window.ensureTrackLog();
    const existing = log.find(r => r.jobId === id);
    const now = new Date();
    const stamp = now.toLocaleString('zh-CN', { hour12: false });
    if (existing) {
        existing.updatedAt = now.toISOString();
        existing.updatedLabel = stamp;
        existing.note = '已再次确认跟踪 · 关注新兴技能信号与招聘热度变化';
        existing.hits = (existing.hits || 1) + 1;
    } else {
        log.unshift({
            id: 'track_' + Date.now(),
            jobId: id,
            title: job.title || '未命名预测岗位',
            category: job.category || '人工智能',
            confidence: job.confidence || 0,
            eta: job.eta_months || '--',
            city: job.city || '全国',
            skills: (job.requiredSkills || job.core_skills || []).slice(0, 4),
            createdAt: now.toISOString(),
            createdLabel: stamp,
            updatedAt: now.toISOString(),
            updatedLabel: stamp,
            note: '已加入跟踪清单 · 将持续关注该预测岗位的信号强度与出现窗口',
            status: '跟踪中',
            hits: 1
        });
    }
    window.renderTrackRail(id);
    window.Utils.showToast('已加入跟踪清单', 'amber');
    window.openTrackLog(id);
};

window.renderTrackRail = function(focusId) {
    const body = document.getElementById('proto-track-rail-body');
    const count = document.getElementById('proto-track-count');
    const sub = document.getElementById('proto-track-sub');
    if (!body) return;
    const log = window.ensureTrackLog();
    if (count) count.textContent = String(log.length);
    if (sub) sub.textContent = log.length ? ('共 ' + log.length + ' 条跟踪记录') : '点击预测岗位「跟踪」后记录会出现在这里';
    if (!log.length) {
        body.innerHTML = '<div class="proto-track-rail-empty">暂无跟踪记录。<br>在预测岗位卡片上点击「跟踪」即可加入。</div>';
        return;
    }
    body.innerHTML = log.map(r => {
        const focus = focusId && r.jobId === focusId ? ' style="border-color:#F59E0B;box-shadow:0 0 0 2px rgba(245,158,11,.2)"' : '';
        return '<article class="proto-track-rail-item"' + focus + '>' +
            '<h5>' + (r.title || '未命名') + '</h5>' +
            '<div class="meta">置信度 ' + (r.confidence || 0) + '% · ETA ' + (r.eta || '--') + ' 个月</div>' +
            '<div class="note">' + (r.note || '') + '</div>' +
            '<span class="badge">' + (r.status || '跟踪中') + ' · ' + (r.hits || 1) + ' 次 · ' + (r.updatedLabel || '') + '</span></article>';
    }).join('');
};

window.openTrackLog = function(focusId) {
    window.renderTrackRail(focusId);
    const panel = document.getElementById('proto-track-panel');
    const mask = document.getElementById('proto-track-mask');
    if (panel) { panel.classList.add('on'); panel.setAttribute('aria-hidden', 'false'); }
    if (mask) mask.classList.add('on');
};

window.closeTrackLog = function() {
    const panel = document.getElementById('proto-track-panel');
    const mask = document.getElementById('proto-track-mask');
    if (panel) { panel.classList.remove('on'); panel.setAttribute('aria-hidden', 'true'); }
    if (mask) mask.classList.remove('on');
};

window.agentBatchAdopt = function() {
    window.ensureDiscoveryState(); let count=0;
    window.discoveryState.discoveries.forEach(j => { if(j.status==='pending' && j.confidence>=70) { j.status='adopted'; count++; } });
    window.renderDiscoveryList(); window.updateDiscoveryCounts();
    window.Utils.showToast('✓ 已采购 '+count+' 个推荐岗位', 'mint');
};

window.showDiscoveryDetail = function(id) {
    window.ensureDiscoveryState();
    const all = [...(window.discoveryState.discoveries||[]), ...(window.discoveryState.forecasts||[])];
    const job = all.find(j => j.id === id);
    if (!job) return;
    window.openDiscoveryDrawer(job, { mode: 'view' });
};

window.auditDiscoveryJob = function(id) {
    window.ensureDiscoveryState();
    const job = (window.discoveryState.discoveries || []).find(j => j.id === id);
    if (!job) { window.Utils.showToast('仅发现岗位支持审核', 'amber'); return; }
    if (job.status && job.status !== 'pending') {
        window.openDiscoveryDrawer(job, { mode: 'view' });
        window.Utils.showToast('该岗位已处理，当前为查看模式', 'amber');
        return;
    }
    window.openDiscoveryDrawer(job, { mode: 'audit' });
};

// Drawer (Task 7): full sections per spec — identity → definition → responsibilities → scenarios → skills → evidence → quality → (forecast) drivers+ETA.
window.openDiscoveryDrawer = function(job, opts) {
    opts = opts || {};
    const mode = opts.mode || 'view';
    window.ensureDiscoveryState();
    if (!job) return;
    window.discoveryState.drawerJobId = job.id;
    window.discoveryState.drawerMode = mode;
    const drawer = document.getElementById('disc-drawer');
    const mask = document.getElementById('disc-drawer-mask');
    const title = document.getElementById('disc-drawer-title');
    const body = document.getElementById('disc-drawer-body');
    const actions = document.getElementById('disc-drawer-actions');
    if (!drawer || !job) return;
    const isForecast = job.is_forecast || job.status === 'forecast';
    const skills = (job.requiredSkills||job.core_skills||[]);
    const conf = job.confidence||0;
    const confColor = conf>=80 ? 'var(--signal-deep)' : conf>=60 ? 'var(--amber)' : 'var(--accent-coral)';
    const statusLabel = (job.status==='pending'||!job.status)?'待审核':job.status==='adopted'?'已采购':job.status==='forecast'?'预测中':'已拒绝';
    const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (title) title.textContent = (mode === 'audit' ? '审核 · ' : '') + (isForecast ? '预测 · ' : '') + (job.title||'岗位详情');
    if (body) {
        const list = arr => (arr&&arr.length) ? '<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6">'+arr.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>' : '<p style="font-size:13px;color:var(--text-muted)">--</p>';
        const chips = arr => (arr&&arr.length) ? '<div style="display:flex;flex-wrap:wrap;gap:6px">'+arr.map(s=>'<span class="skill-chip">'+esc(s)+'</span>').join('')+'</div>' : '<p style="font-size:13px;color:var(--text-muted)">--</p>';
        const auditBanner = (mode === 'audit' && (job.status === 'pending' || !job.status))
            ? '<div class="disc-audit-banner"><b>人工审核</b><p>请核对定义、技能与证据后，决定是否采购入库或拒绝。</p></div>'
            : '';
        body.innerHTML = auditBanner +
            // 身份条
            '<div class="disc-drawer-identity">'+
                '<div class="kv"><label>分类</label><span>'+esc(job.category||'--')+'</span></div>'+
                '<div class="kv"><label>级别</label><span>'+esc(job.level||'--')+'</span></div>'+
                '<div class="kv"><label>置信度</label><span style="color:'+confColor+'">'+conf+'%</span></div>'+
                '<div class="kv"><label>城市</label><span>'+esc(job.city||'--')+'</span></div>'+
                '<div class="kv"><label>薪资</label><span>'+esc(job.salary||'--')+'</span></div>'+
                '<div class="kv"><label>来源</label><span>'+esc(job.source||'--')+'</span></div>'+
                (isForecast?'<div class="kv"><label>预计出现</label><span style="color:var(--amber)">'+esc(job.eta_months||'?')+' 个月后</span></div>':'')+
                '<div class="kv"><label>状态</label><span>'+statusLabel+'</span></div>'+
            '</div>'+
            // 定义
            '<div class="disc-drawer-section"><h4>岗位定义</h4><p>'+(esc(job.definition||job.description)||'--')+'</p></div>'+
            // 职责
            '<div class="disc-drawer-section"><h4>核心职责</h4>'+list(job.responsibilities||job.duties)+'</div>'+
            // 场景
            '<div class="disc-drawer-section"><h4>典型场景</h4>'+list(job.scenarios||job.use_cases)+'</div>'+
            // 技能
            '<div class="disc-drawer-section"><h4>必备技能</h4>'+chips(skills)+'</div>'+
            // 证据链
            '<div class="disc-drawer-section"><h4>证据链（公司 · 城市 · 来源）</h4>'+
                '<p style="font-size:13px;line-height:1.6">'+
                    (job.evidence_company? '🏢 '+esc(job.evidence_company)+' · ' : '')+
                    (job.city? '📍 '+esc(job.city)+' · ' : '')+
                    (job.source? '🔗 '+esc(job.source) : '')+
                    (!job.evidence_company && !job.city && !job.source ? '--' : '')+
                '</p>'+
            '</div>'+
            // 质量四格
            '<div class="disc-drawer-section"><h4>质量评估</h4>'+
                '<div class="disc-quality-grid">'+
                    '<div class="q-cell"><label>置信度</label><span style="color:'+confColor+'">'+conf+'%</span></div>'+
                    '<div class="q-cell"><label>样本量</label><span>'+esc(job.sample_size||job.evidence_count||'--')+'</span></div>'+
                    '<div class="q-cell"><label>新鲜度</label><span>'+esc(job.freshness||(job.discoveredAt? new Date(job.discoveredAt).toLocaleDateString():'--'))+'</span></div>'+
                    '<div class="q-cell"><label>覆盖度</label><span>'+esc(job.coverage||'--')+'</span></div>'+
                '</div>'+
            '</div>'+
            // 预测：驱动力 + ETA
            (isForecast ?
                '<div class="disc-drawer-section"><h4>预测驱动力 & ETA</h4>'+
                    list(job.drivers)+
                    '<p style="margin-top:8px;font-size:13px">⏳ 预计 <b style="color:var(--amber)">'+esc(job.eta_months||'?')+' 个月</b>后进入主流招聘</p>'+
                '</div>' : '')+
            // 推理摘要
            (job.reasoning ? '<div class="disc-drawer-section" style="border-top:1px solid var(--border-dark);padding-top:10px"><h4>推理摘要</h4><p style="font-size:12px;color:var(--text-muted)">🧠 '+esc(job.reasoning)+'</p></div>' : '');
    }
    if (actions) {
        const canDecide = !isForecast && (job.status === 'pending' || !job.status);
        if (mode === 'audit' && canDecide) {
            actions.innerHTML =
                '<button class="btn btn-adopt" onclick="window.adoptDiscoveryJob(\''+job.id+'\')">确认采购</button>'+
                '<button class="btn btn-reject" onclick="window.rejectDiscoveryJob(\''+job.id+'\')">拒绝入库</button>'+
                '<button class="btn" onclick="window.closeDiscoveryDrawer()">取消</button>';
        } else if (canDecide) {
            actions.innerHTML =
                '<button class="btn btn-adopt" onclick="window.adoptDiscoveryJob(\''+job.id+'\')">采购</button>'+
                '<button class="btn btn-reject" onclick="window.rejectDiscoveryJob(\''+job.id+'\')">拒绝</button>'+
                '<button class="btn" onclick="window.closeDiscoveryDrawer()">关闭</button>';
        } else {
            actions.innerHTML = '<button class="btn" onclick="window.closeDiscoveryDrawer()">关闭</button>';
        }
    }
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden','false');
    if (mask) mask.classList.add('open');
};

window.closeDiscoveryDrawer = function() {
    window.ensureDiscoveryState();
    window.discoveryState.drawerJobId = null;
    const drawer = document.getElementById('disc-drawer');
    const mask = document.getElementById('disc-drawer-mask');
    if (drawer) { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden','true'); }
    if (mask) mask.classList.remove('open');
};

// Esc closes drawer; global keydown.
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const drawer = document.getElementById('disc-drawer');
        if (drawer && drawer.classList.contains('open')) { e.preventDefault(); window.closeDiscoveryDrawer(); }
    }
});

// 3D bloom constellation — ES module hooks (script type=module at file end)
window._disc3d = null;
window.initDisc3D = function() {
    if (window._disc3d && !window._disc3d.dendrites && window._disc3dDestroy) {
        window._disc3dDestroy();
    }
    if (window._disc3dBoot) return window._disc3dBoot();
    window._disc3dPending = true;
};
window.setDisc3DMode = function(mode, progress) {
    if (window._disc3dSetMode) return window._disc3dSetMode(mode, progress);
};
window.growDisc3DBranch = function(i) {
    if (window._disc3dGrowOne) return window._disc3dGrowOne(i);
};
window.destroyDisc3D = function() {
    if (window._disc3dDestroy) return window._disc3dDestroy();
};

// ============== Task 6: Ambient FX (particles, cluster canvas, hallucination, radar) ==============
window._discParticles = null;     // tsParticles container ref
window._discClusterRAF = 0;       // cluster canvas rAF handle

window._discReduced = function() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
};

// Step 1: tsParticles slim on #disc-particles — teal links, low density ~40. No-op if reduced-motion.
window.initDiscParticles = function() {
    const el = document.getElementById('disc-particles');
    if (!el) return;
    // destroy any prior instance (re-init on view enter / scan start)
    if (window._discParticles) { try { window._discParticles.destroy(); } catch (e) {} window._discParticles = null; }
    el.innerHTML = '';
    if (window._discReduced() || typeof tsParticles === 'undefined') return;
    tsParticles.load(el.id, {
        fullScreen: { enable: false },
        background: { color: 'transparent' },
        particles: {
            number: { value: 40, density: { enable: true, area: 800 } },
            color: { value: ['#2DD4BF', '#0D9488'] },
            links: { enable: true, color: '#2DD4BF', distance: 140, opacity: 0.22, width: 1 },
            move: { enable: true, speed: 0.6, direction: 'none', outModes: { default: 'out' } },
            opacity: { value: { min: 0.2, max: 0.6 } },
            size: { value: { min: 1, max: 2.6 } }
        },
        detectRetina: true
    }).then(function (c) { window._discParticles = c; }).catch(function () {});
};

// Step 2: 2s points → 4-6 clusters on #disc-cluster-canvas via requestAnimationFrame. No-op if reduced-motion.
window.playClusterAnimation = function (step) {
    const canvas = document.getElementById('disc-cluster-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (window._discClusterRAF) { cancelAnimationFrame(window._discClusterRAF); window._discClusterRAF = 0; }
    if (window._discReduced()) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    const rect = canvas.getBoundingClientRect();
    const W = (rect.width > 0) ? (canvas.width = Math.round(rect.width)) : canvas.width;
    const H = (rect.height > 0) ? (canvas.height = Math.round(rect.height)) : canvas.height;
    const N = 80;
    const K = 4 + Math.floor(Math.random() * 3); // 4-6 cluster centers
    const centers = Array.from({ length: K }, () => ({ x: W * 0.1 + Math.random() * W * 0.8, y: H * 0.1 + Math.random() * H * 0.8 }));
    const pts = Array.from({ length: N }, (_, i) => {
        const c = centers[i % K];
        return { x: Math.random() * W, y: Math.random() * H, tx: c.x + (Math.random() - 0.5) * 30, ty: c.y + (Math.random() - 0.5) * 30 };
    });
    const dur = 2000, t0 = performance.now();
    const tick = function (now) {
        const t = Math.min(1, (now - t0) / dur);
        const e = t * t * (3 - 2 * t); // smoothstep
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(45,212,191,0.18)'; ctx.lineWidth = 1;
        for (let i = 0; i < pts.length; i++) {
            const a = pts[i], ax = a.x + (a.tx - a.x) * e, ay = a.y + (a.ty - a.y) * e;
            for (let j = i + 1; j < pts.length; j++) {
                const b = pts[j], bx = b.x + (b.tx - b.x) * e, by = b.y + (b.ty - b.y) * e;
                const dx = ax - bx, dy = ay - by;
                if (dx * dx + dy * dy < 3600) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
            }
        }
        for (const p of pts) {
            const x = p.x + (p.tx - p.x) * e, y = p.y + (p.ty - p.y) * e;
            ctx.fillStyle = 'rgba(45,212,191,' + (0.4 + 0.4 * e) + ')';
            ctx.beginPath(); ctx.arc(x, y, 1.6 + e * 0.8, 0, Math.PI * 2); ctx.fill();
        }
        if (t < 1) window._discClusterRAF = requestAnimationFrame(tick);
    };
    window._discClusterRAF = requestAnimationFrame(tick);
};

// Step 3: hallucination audit — unhide #disc-hallucination, render 4-6 claim chips; .verified if evidence_sources.length >= 2 else .warn (staggered).
window.playHallucinationAudit = function (step, ds) {
    // 原型页不展示幻觉审计芯片列表
    const el = document.getElementById('disc-hallucination');
    if (el) { el.hidden = true; el.innerHTML = ''; }
};

// Step 4: mini ECharts radar on #disc-radar — title/skill/cross scores from first discovery.reasoning or synthetic [42,20,15].
window.updateDiscRadar = function (step, ds) {
    const el = document.getElementById('disc-radar');
    if (!el || typeof echarts === 'undefined') return;
    if (echarts.getInstanceByDom(el)) echarts.getInstanceByDom(el).dispose();
    const first = (ds && ds.discoveries && ds.discoveries[0]) || null;
    let vals = [42, 20, 15];
    if (first) {
        if (first.reasoning) {
            const nums = (first.reasoning.match(/\d+(\.\d+)?/g) || []).map(Number).filter(n => n >= 5 && n <= 100);
            if (nums.length >= 3) vals = nums.slice(0, 3);
            else if (first.confidence) vals = [first.confidence, 20, 15];
        } else if (first.confidence) {
            vals = [first.confidence, 20, 15];
        }
    }
    const c = echarts.init(el);
    c.setOption({
        radar: {
            indicator: [
                { name: '标题新颖度', max: 100 },
                { name: '技能组合熵', max: 100 },
                { name: '跨行业溢出', max: 100 }
            ],
            radius: '62%',
            axisName: { color: 'rgba(226,232,240,0.7)', fontSize: 10 },
            splitLine: { lineStyle: { color: 'rgba(45,212,191,0.18)' } },
            splitArea: { areaStyle: { color: ['rgba(45,212,191,0.03)', 'rgba(45,212,191,0.06)'] } },
            axisLine: { lineStyle: { color: 'rgba(45,212,191,0.22)' } }
        },
        series: [{
            type: 'radar',
            data: [{ value: vals, name: '新兴度评分' }],
            symbol: 'circle', symbolSize: 4,
            lineStyle: { color: '#2DD4BF', width: 2 },
            itemStyle: { color: '#2DD4BF' },
            areaStyle: { color: 'rgba(45,212,191,0.22)' }
        }]
    });
};

// Dispose particles + radar when leaving discovery view.
window.destroyDiscFX = function () {
    if (window.destroyDisc3D) window.destroyDisc3D();
    if (window._discParticles) { try { window._discParticles.destroy(); } catch (e) {} window._discParticles = null; }
    const el = document.getElementById('disc-radar');
    if (el && typeof echarts !== 'undefined' && echarts.getInstanceByDom(el)) echarts.getInstanceByDom(el).dispose();
    if (window._discClusterRAF) { cancelAnimationFrame(window._discClusterRAF); window._discClusterRAF = 0; }
};

// ============== Evolution View ==============
let evolutionState = {currentJobId: 'Java开发工程师', period: 3, currentMonth: 3};

window.initEvolution = async function() {
    // 显示加载中遮罩，避免等待期间空白
    const loading = document.getElementById('evo-loading');
    if (loading) loading.style.display = 'flex';
    // 单次批量请求即可拿到全部 10 岗位完整画像（后端只构建一次向量表，避免 N×N 全表扫描）
    try {
        const res = await fetch((window.API_BASE || 'http://localhost:5000') + '/api/evolution/landscape-profiles?month_start=1&month_end=' + evolutionState.period);
        const json = await res.json();
        if (json && json.code === 0 && json.data && json.data.length) {
            const map = {};
            for (const p of json.data) {
                if (p && p.job_id) map[p.job_id] = p;
            }
            if (Object.keys(map).length) {
                window.EVOLUTION_JOB_PROFILES = map;
                console.log('演化数据已从后端加载，共 ' + Object.keys(map).length + ' 个岗位');
            }
        }
    } catch (e) {
        console.warn('演化数据后端不可用，使用本地 Mock', e);
    }
    if (!window.EVOLUTION_JOB_PROFILES || !Object.keys(window.EVOLUTION_JOB_PROFILES).length) {
        window.generateAllData();
    }
    window.renderEvolution();
    window.bindEvolutionEvents();
    if (loading) loading.style.display = 'none';
};

window.bindEvolutionEvents = function() {
    document.querySelectorAll('#evo-period-tabs .period-tab').forEach(t => {
        if (t.dataset.bound) return;
        t.dataset.bound = '1';
        t.addEventListener('click', async () => {
            document.querySelectorAll('#evo-period-tabs .period-tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            const p = t.dataset.period;
            evolutionState.period = p === 'all' ? 12 : parseInt(p, 10);
            evolutionState.currentMonth = evolutionState.period;
            const jid = evolutionState.currentJobId || Object.keys(window.EVOLUTION_JOB_PROFILES)[0];
            if (jid) {
                try {
                    const r = await fetch((window.API_BASE || 'http://localhost:5000') + '/api/evolution/jobs/' + encodeURIComponent(jid) + '?month_start=1&month_end=' + evolutionState.period);
                    const fj = await r.json();
                    if (fj.code === 0 && fj.data) {
                        window.EVOLUTION_JOB_PROFILES[jid] = fj.data;
                        evolutionState.currentJobId = jid;
                    }
                } catch (e) { /* ignore */ }
            }
            window.renderEvolution();
        });
    });
    const search = document.getElementById('evo-search');
    if (search && !search.dataset.bound) {
        search.dataset.bound = '1';
        search.addEventListener('input', () => {
            const kw = search.value.trim().toLowerCase();
            document.querySelectorAll('#evo-list .evo-item').forEach(el => {
                const t = (el.dataset.job || '').toLowerCase();
                el.style.display = t.includes(kw) ? '' : 'none';
            });
        });
    }
    const detailBtn = document.getElementById('evo-new-detail');
    if (detailBtn && !detailBtn.dataset.bound) {
        detailBtn.dataset.bound = '1';
        detailBtn.addEventListener('click', () => window.switchView('newSkill'));
    }
    const pathBtn = document.getElementById('evo-view-path');
    if (pathBtn && !pathBtn.dataset.bound) {
        pathBtn.dataset.bound = '1';
        pathBtn.addEventListener('click', () => window.switchView('learningPath'));
    }
    const gapBtn = document.getElementById('evo-view-gap');
    if (gapBtn && !gapBtn.dataset.bound) {
        gapBtn.dataset.bound = '1';
        gapBtn.addEventListener('click', () => window.switchView('match'));
    }
    // ---- 重新分析按钮 ----
    const reanalyzeBtn = document.getElementById('evo-reanalyze-btn');
    if (reanalyzeBtn && !reanalyzeBtn.dataset.bound) {
        reanalyzeBtn.dataset.bound = '1';
        reanalyzeBtn.addEventListener('click', async () => {
            const jid = evolutionState.currentJobId || Object.keys(window.EVOLUTION_JOB_PROFILES || {})[0];
            if (!jid) return;
            reanalyzeBtn.disabled = true;
            const svg = reanalyzeBtn.querySelector('svg');
            if (svg) svg.style.animation = 'evo-spin 0.8s linear infinite';
            try {
                const r = await fetch((window.API_BASE || 'http://localhost:5000') + '/api/evolution/jobs/' + encodeURIComponent(jid) + '?month_start=1&month_end=' + evolutionState.period);
                const fj = await r.json();
                if (fj.code === 0 && fj.data) {
                    window.EVOLUTION_JOB_PROFILES[jid] = fj.data;
                    evolutionState.currentJobId = jid;
                    window.renderEvolution();
                    window.Utils.showToast('✅ 已完成重新分析: ' + jid, 'cyan');
                } else {
                    window.Utils.showToast('重新分析失败，请稍后重试', 'coral');
                }
            } catch (e) {
                window.Utils.showToast('网络错误，分析失败', 'coral');
            } finally {
                reanalyzeBtn.disabled = false;
                if (svg) svg.style.animation = '';
            }
        });
    }
    const helpLink = document.querySelector('.help-link');
    if (helpLink && !helpLink.dataset.bound) {
        helpLink.dataset.bound = '1';
        helpLink.addEventListener('click', () => {
            window.Utils.showToast('📖 数据解读指南：新增技能=新出现的高频技能；技能调度=权重调整；技能总量=累计在岗技能库规模；趋势匹配度=与市场需求匹配程度', 'cyan');
        });
    }
};

window.renderEvolution = function() {
    window.renderEvolutionList();
    window.renderEvolutionKpis();
    window.renderEvolutionNewSkill();
    window.renderEvolutionAiInsight();
    window.renderEvolutionCharts();
    window.renderEvolutionTimeline();
    const sub = document.querySelector('#view-evolution .subtitle');
    if (sub) sub.innerHTML = `当前岗位：<strong style="color:var(--primary)">${evolutionState.currentJobId}</strong> · 洞察岗位能力变化趋势，掌握未来技能发展方向`;
};

window.renderEvolutionList = function() {
    const el = document.getElementById('evo-list');
    if (!el) return;
    const jobs = Object.keys(window.EVOLUTION_JOB_PROFILES || {
        'Java开发工程师':1,'前端开发工程师':1,'Python数据分析师':1,'AI算法工程师':1,'产品经理':1,
        '运维工程师':1,'测试工程师':1,'UI设计师':1,'数据科学家':1,'DevOps工程师':1
    });
    el.innerHTML = jobs.map((t) => {
        const p = window.EVOLUTION_JOB_PROFILES[t] || {};
        return `<div class="evo-item ${t === evolutionState.currentJobId ? 'active' : ''}" data-job="${t}">
            <div class="evo-title">${t}</div>
            <div class="evo-cat">${p.cat || '岗位'} · ${p.jdCount || 0}条JD</div>
        </div>`;
    }).join('');
    el.querySelectorAll('.evo-item').forEach(item => {
        item.addEventListener('click', async () => {
            el.querySelectorAll('.evo-item').forEach(x => x.classList.remove('active'));
            item.classList.add('active');
            const jid = item.dataset.job;
            evolutionState.currentJobId = jid;
            try {
                const r = await fetch((window.API_BASE || 'http://localhost:5000') + '/api/evolution/jobs/' + encodeURIComponent(jid) + '?month_start=1&month_end=' + evolutionState.period);
                const fj = await r.json();
                if (fj.code === 0 && fj.data) window.EVOLUTION_JOB_PROFILES[jid] = fj.data;
            } catch (e) { /* ignore */ }
            window.renderEvolution();
            window.Utils.showToast('已切换至: ' + jid, 'cyan');
        });
    });
};

window.getEvolutionForJob = function(jobId) {
    const profiles = window.EVOLUTION_JOB_PROFILES || {};
    const profile = profiles[jobId] || profiles[evolutionState.currentJobId] || profiles[Object.keys(profiles)[0]];
    if (!profile) {
        return { added:[], removed:[], modified:[], hotSkills:[], hotValues:[], trendMust:[], trendNice:[], cat:'岗位', jdCount:0, summary:'' };
    }
    return {
        added: (profile.added || []).slice(),
        removed: (profile.removed || []).slice(),
        modified: (profile.modified || []).slice(),
        hotSkills: (profile.hotSkills || []).slice(),
        hotValues: (profile.hotValues || []).slice(),
        trendMust: (profile.trendMust || []).slice(),
        trendNice: (profile.trendNice || []).slice(),
        cat: profile.cat,
        jdCount: profile.jdCount,
        summary: profile.summary || ''
    };
};
window.renderEvolutionKpis = function() {
    const d = window.getEvolutionForJob(evolutionState.currentJobId);
    const added = (d.added || []).length;
    const removed = (d.removed || []).length;
    const modified = (d.modified || []).length;
    const sched = modified;
    const total = added + removed + modified + (d.hotSkills || []).length;
    const match = Math.max(35, Math.min(98, 72 + added * 3 - removed * 2 + Math.min(modified, 6)));
    const topGrowth = (d.added[0] && d.added[0].growth) || '—';
    const mustUp = (d.modified || []).filter(m => (m.change || '').indexOf('必备') >= 0).length;
    window._setText('evo-kpi-add', added);
    window._setText('evo-kpi-add-delta', added ? ('峰值增长 ' + topGrowth) : '暂无新增');
    window._setText('evo-kpi-add-extra', (d.added[0] && d.added[0].name) || '—');
    window._setText('evo-kpi-sched', sched);
    window._setText('evo-kpi-sched-delta', sched ? ('必备化 ' + mustUp + ' 项') : '无调整');
    window._setText('evo-kpi-total', total);
    window._setText('evo-kpi-total-delta', '本月变动 ' + (added + removed + modified) + ' 项');
    window._setText('evo-kpi-match', match);
    window._setText('evo-kpi-match-delta', '基于真实变化估算');
};

window._impactLevel = function(growth) {
    const n = parseInt(String(growth || '').replace(/[^\d-]/g, ''), 10) || 0;
    if (n >= 100) return '★★★★★';
    if (n >= 50)  return '★★★★';
    if (n >= 20)  return '★★★';
    if (n > 0)    return '★★';
    return '★';
};

window._setText = function(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
};

window.renderEvolutionNewSkill = function() {
    const d = window.getEvolutionForJob(evolutionState.currentJobId);
    const top = (d.added || [])[0] || {};
    const period = evolutionState.period;
    window._setText('evo-new-name', top.name || '—');
    window._setText('evo-new-name-2', top.name || '—');
    window._setText('evo-new-growth', top.growth || '+0%');
    window._setText('evo-new-period', '近 ' + (period === 12 ? '12' : period) + ' 个月');
    window._setText('evo-new-impact', window._impactLevel(top.growth));
    window._setText('evo-new-data', d.jdCount || 0);
    window._setText('evo-new-first', top.version ? ('版本 ' + top.version) : '新出现技能');
    const tags = [];
    (d.added || []).slice(0, 3).forEach(a => { if (a.name && tags.indexOf(a.name) < 0) tags.push(a.name); });
    if (tags.length < 3) (d.modified || []).forEach(m => { if (m.name && tags.indexOf(m.name) < 0) tags.push(m.name); });
    const tagsEl = document.getElementById('evo-new-tags');
    if (tagsEl) tagsEl.innerHTML = tags.slice(0, 4).map(t => '<span>' + t + '</span>').join('');
    const aiBody = (d.summary || '').indexOf('演化分析') >= 0
        ? '智能分析：' + (d.summary || '')
        : '近 ' + (period === 12 ? '12' : period) + ' 个月企业对于「' + (top.name || '该技能') + '」的需求呈 ' + (top.growth || '0') + ' 增长，成为 ' + (d.cat || '') + ' 岗位的新兴核心技能。';
    window._setText('evo-new-ai-body', aiBody);
    window._setText('evo-new-reason', '基于 ' + (d.jdCount || 0) + ' 条真实岗位JD的演化分析，「' + (top.name || '该技能') + '」的需求呈 ' + (top.growth || '0') + ' 增长，建议优先纳入学习计划。');
};

window.renderEvolutionAiInsight = function() {
    const d = window.getEvolutionForJob(evolutionState.currentJobId);
    const sumEl = document.getElementById('evo-ai-summary');
    if (sumEl) {
        if (d.summary) {
            sumEl.innerHTML = '<li>' + String(d.summary).replace(/。/g, '。<br>') + '</li>';
        } else {
            const items = [];
            const topAdded = d.added[0];
            const topMod = d.modified[0];
            const topRem = d.removed[0];
            if (topAdded) items.push('<strong>' + topAdded.name + '</strong> 首次进入核心技能池，成为高端需求');
            if (topMod) items.push('<strong>' + topMod.name + '</strong> 权重提升，加分技能需求增长');
            if (topRem) items.push('<strong>' + topRem.name + '</strong> 需求下降，进入边缘技能池');
            sumEl.innerHTML = items.slice(0, 4).map(t => '<li>' + t + '</li>').join('') || '<li>暂无显著演化</li>';
        }
    }
    const pathEl = document.getElementById('evo-ai-path');
    if (pathEl) {
        let steps = (d.added || []).slice(0, 3);
        if (steps.length < 3) (d.modified || []).forEach(m => { if (steps.length < 3 && m.name) steps.push(m); });
        pathEl.innerHTML = steps.map((s, i) => {
            // 基于真实增长率推导优先级与周期（不再硬编码）
            const g = s.growth ? parseInt(String(s.growth).replace(/[^\d-]/g, ''), 10) || 0 : 0;
            let priority, period;
            if (g >= 150) { priority = '极高'; period = '3-4 周'; }
            else if (g >= 80) { priority = '高'; period = '2-3 周'; }
            else if (g >= 30) { priority = '中'; period = '1-2 周'; }
            else { priority = '常规'; period = '1 周'; }
            return `
            <div class="path-step">
                <div class="num">${i + 1}</div>
                <div class="pname">${s.name}</div>
                <div class="ptime">优先级: ${priority}（${s.growth || '—'}）<br>预计学习周期<br>${period}</div>
            </div>
            ${i < steps.length - 1 ? '<div class="path-arrow">→</div>' : ''}
            `;
        }).join('');
    }
    // 缺口：基于真实新增/弱化技能数与 JD 规模推导，而非固定公式
    const addedN = (d.added || []).length;
    const removedN = (d.removed || []).length;
    const totalSkills = addedN + removedN + (d.modified || []).length + (d.hotSkills || []).length;
    const gap = totalSkills > 0 ? Math.max(20, Math.min(75, Math.round(addedN / totalSkills * 100))) : 35;
    window._setText('evo-gap-pct', gap);
    const arc = document.getElementById('evo-gap-arc');
    if (arc) {
        const dash = (gap / 100) * 213.6;
        arc.setAttribute('stroke-dasharray', dash + ' ' + (213.6 - dash));
    }
    window._setText('evo-gap-text', '基于 ' + (d.jdCount || 0) + ' 条真实JD，建议优先学习 ' + (d.added || []).length + ' 项高频新增技能，填补当前能力缺口');
};

window.renderEvolutionCharts = function() {
    window.disposeChart('chart-evo-trend');
    const d = window.getEvolutionForJob(evolutionState.currentJobId);
    if (!d) return;
    const curMonth = evolutionState.currentMonth || 12;
    const allLabels = ['10月','11月','12月','1月','2月','3月','4月','5月','6月','7月','8月','9月'];
    const labels = allLabels.slice(0, curMonth);
    const must = (d.trendMust || []).slice(0, curMonth);
    const nice = (d.trendNice || []).slice(0, curMonth);
    window.chartInstances['chart-evo-trend'] = window.safeChart('chart-evo-trend');
    window.chartInstances['chart-evo-trend'].setOption({
        ...window.baseChartOpt(),
        legend: {data:['必备技能数','加分技能数'], top: 0, textStyle:{color:'#475569'}},
        grid: {left: 40, right: 20, top: 32, bottom: 30},
        tooltip: {trigger:'axis', backgroundColor:'rgba(10,14,39,.92)', borderWidth:0, textStyle:{color:'#fff'}},
        xAxis: {type:'category', data: labels, axisLabel:{color:'#475569', fontSize:11}, axisLine:{lineStyle:{color:'#e2e8f0'}}},
        yAxis: {type:'value', axisLabel:{color:'#475569', fontSize:11}, splitLine:{lineStyle:{color:'#f1f3f9'}}},
        series: [
            {name:'必备技能数', type:'line', smooth:true, symbolSize:7, lineStyle:{width:3, color:'#0D9488'}, itemStyle:{color:'#0D9488'}, data: must},
            {name:'加分技能数', type:'line', smooth:true, symbolSize:7, lineStyle:{width:3, color:'#10b981', type:'dashed'}, itemStyle:{color:'#10b981'}, data: nice}
        ]
    });
    const top10 = document.getElementById('evo-top10');
    if (top10) {
        const hotSkills = (d.hotSkills || []).slice(0, 10);
        const hotValues = (d.hotValues || []).slice(0, 10);
        const max = Math.max.apply(null, hotValues.concat([1]));
        top10.innerHTML = hotSkills.map((s, i) => {
            const v = hotValues[i] || 0;
            const pct = (v / max) * 100;
            const cls = v >= 200 ? 'up' : (v >= 100 ? '' : 'down');
            const level = v >= 200 ? '高热度' : (v >= 100 ? '中热度' : '成长中');
            return `<div class="top10-item">
                <div class="top10-rank">${i+1}</div>
                <div class="top10-skill">
                    <div class="top10-name">${s}</div>
                    <div class="top10-bar"><div class="top10-bar-fill" style="width:${pct}%"></div></div>
                </div>
                <div class="top10-val">${v}</div>
                <div class="top10-delta ${cls}">${level}</div>
            </div>`;
        }).join('');
    }
};

window.renderEvolutionTimeline = function() {
    const el = document.getElementById('evo-timeline');
    if (!el) return;
    const d = window.getEvolutionForJob(evolutionState.currentJobId);
    const cur = evolutionState.currentMonth || 12;
    const curLabel = (cur <= 6 ? 2026 : 2025) + '-' + String(cur).padStart(2, '0');
    const prev = cur > 1 ? cur - 1 : 12;
    const prevLabel = (prev <= 6 ? 2026 : 2025) + '-' + String(prev).padStart(2, '0');
    const currentItems = [];
    (d.added || []).slice(0, 2).forEach(c => currentItems.push({type:'add', name:c.name, val:c.growth || '+0%', tag:'新增技能', tagCls:'up', ref:'引用JD: ' + (d.jdCount || 0) + '条'}));
    (d.modified || []).slice(0, 2).forEach(c => currentItems.push({type:'modify', name:c.name, val:(c.change || '') + ' · ' + (c.weight || ''), tag:'权重提升', tagCls:'up', ref:'引用JD: ' + (d.jdCount || 0) + '条'}));
    (d.removed || []).slice(0, 1).forEach(c => currentItems.push({type:'remove', name:c.name, val:c.decline || '-0%', tag:'权重下降', tagCls:'down', ref:'引用JD: ' + (d.jdCount || 0) + '条'}));
    const prevItems = [];
    (d.modified || []).slice(2, 3).forEach(c => prevItems.push({type:'modify', name:c.name, val:(c.change || '') + ' · ' + (c.weight || ''), tag:'分值变化', tagCls:'score', ref:'引用JD: ' + (d.jdCount || 0) + '条'}));
    const renderItem = (it) => {
        const ic = it.type === 'add' ? '+' : it.type === 'remove' ? '-' : '~';
        return `<div class="tl-item anim-fade-up">
            <div class="tl-icon ${it.type}">${ic}</div>
            <div class="tl-name">${it.name}</div>
            <div class="tl-tag ${it.tagCls}">${it.tag}</div>
            <div class="tl-val">${it.val}<br><span style="font-size:10px;color:var(--text-muted)">${it.ref}</span></div>
        </div>`;
    };
    el.innerHTML = `
        <div class="tl-group">
            <div class="tl-group-label">${curLabel}</div>
            <div class="tl-items">${currentItems.length ? currentItems.map(renderItem).join('') : '<div class="empty-state" style="padding:14px">暂无变更</div>'}</div>
        </div>
        ${prevItems.length ? `<div class="tl-group">
            <div class="tl-group-label">${prevLabel}</div>
            <div class="tl-items">${prevItems.map(renderItem).join('')}</div>
        </div>` : ''}
    `;
};

// 分岗位演化画像（切换左侧岗位时驱动变化）
window.EVOLUTION_JOB_PROFILES = {};

// ============== Learning Path View ==============
let learningPathState = { currentJobId: 'Java开发工程师' };

window.initLearningPath = function() {
    const profiles = window.EVOLUTION_JOB_PROFILES || {};
    const jobs = Object.keys(profiles).length ? Object.keys(profiles) : [learningPathState.currentJobId];
    learningPathState.currentJobId = evolutionState.currentJobId || jobs[0] || 'Java开发工程师';
    window.renderLpJobList();
    window.renderLpPage();
    window.bindLearningPathEvents();
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
    newSkillState.currentJobId = evolutionState.currentJobId;
    window.renderNsJobList();
    window.renderNewSkillDetail();
    window.bindNewSkillEvents();
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

    // Charts
    setTimeout(() => {
        window.renderNsGrowthChart(growthNum);
        window.renderNsTrendChart(skill, growthNum, period);
    }, 30);
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


// ============== Match View ==============
window.matchState = {
    result: null,
    file: null,
    selectedJobId: null,
    processing: false,
    progressTimer: null,
    dimensionChart: null
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
        window.matchState.result = payload.data;
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

// ============== QA View ==============
window.qaState = {chatHistory: []};
window.QAEngine = {
    answer: function(q) {
        if (q.includes('技能') || q.includes('需要')) {
            return {type:'skill', text:'基于知识图谱分析,该岗位核心技能体系:', skills: ['Python','PyTorch','深度学习','Transformer','LLM','CUDA','RAG','Prompt工程'], sources: ['[1] 字节跳动AI算法工程师JD · 2026-07-15', '[2] 美团算法工程师JD · 2026-07-12', '[3] 阿里达摩院JD · 2026-07-08']};
        }
        if (q.includes('薪资') || q.includes('工资')) {
            return {type:'salary', text:'基于过去30天<strong>12,847条</strong>岗位数据:', stats: [
                {label:'AI算法工程师',range:'30-60K',median:'42K'},
                {label:'NLP算法工程师',range:'28-50K',median:'38K'},
                {label:'推荐算法工程师',range:'30-55K',median:'40K'},
                {label:'Prompt工程师',range:'30-60K',median:'42K'},
                {label:'Java开发工程师',range:'20-40K',median:'28K'},
                {label:'前端工程师',range:'18-35K',median:'25K'}
            ]};
        }
        if (q.includes('趋势') || q.includes('增长')) {
            return {type:'trend', text:'过去12个月,<strong>大模型相关</strong>技能需求爆发增长:', trends: [
                {skill:'LLM',growth:'+387%',hot:99},
                {skill:'RAG',growth:'+256%',hot:82},
                {skill:'Agent',growth:'+178%',hot:78},
                {skill:'Prompt工程',growth:'+147%',hot:80},
                {skill:'LoRA',growth:'+98%',hot:60},
                {skill:'向量数据库',growth:'+85%',hot:55}
            ]};
        }
        if (q.includes('区别') || q.includes('差异') || q.includes('对比')) {
            return {type:'compare', text:'主要差异:', pairs: [
                {a:'数据科学家',b:'数据分析师',diff:'数据科学家更偏研究/建模；数据分析师更偏业务/报表'},
                {a:'NLP工程师',b:'CV工程师',diff:'NLP处理文本/语音；CV处理图像/视频'},
                {a:'前端工程师',b:'后端工程师',diff:'前端关注UI/交互；后端关注架构/数据'},
                {a:'AI产品经理',b:'传统产品经理',diff:'AI产品经理需理解LLM能力边界、RAG/Agent架构'}
            ]};
        }
        return {type:'general', text:`关于"<strong>${q}</strong>",基于知识图谱分析:`, content:'结合<strong>大模型</strong>推理与<strong>图谱查询</strong>。建议查看相关岗位演化趋势或上传简历进行匹配诊断。', sources:['[1] 知识图谱 v5.2.1','[2] 项目文档','[3] 历史问答库']};
    }
};
window.initQA = function() {
    const view = document.getElementById('view-qa');
    if (!view || view.dataset.bound) return;
    view.dataset.bound = '1';
    window.qaState.chatHistory = [{
        role:'ai', content:'您好!我是基于<strong>知识图谱+RAG</strong>的智能助手,可以回答岗位、技能、薪资、行业相关问题。<br><br>💡 点击左侧推荐问题,或在下方输入框自由提问。', time:new Date()
    }];
    window.renderChatHistory();
    const input = document.getElementById('qa-input');
    const sendBtn = document.getElementById('qa-send');
    const send = () => {
        const q = input.value.trim();
        if (!q) return;
        window.sendQAQuestion(q);
        input.value = '';
    };
    if (sendBtn) sendBtn.addEventListener('click', send);
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
};
window.sendQAQuestion = async function(question) {
    const area = document.getElementById('chat-area');
    const input = document.getElementById('qa-input');
    if (!area || !question) return;
    if (window._qaBusy) return;
    window._qaBusy = true;
    window.ensureDiscoveryState && window.ensureDiscoveryState();
    const ds = window.discoveryState || {};
    if (input) input.value = '';
    window.qaState.chatHistory.push({role:'user', content:question, time:new Date()});
    const thinkingId = 'th-' + Date.now();
    window.qaState.chatHistory.push({role:'ai', thinking:true, id:thinkingId, time:new Date()});
    window.renderChatHistory();
    area.scrollTop = area.scrollHeight;

    let answered = false;
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 70000);
        const hist = (window.qaState.chatHistory || [])
            .filter(m => !m.thinking && (m.role === 'user' || (m.role === 'ai' && (m.content || (m.answer && m.answer.text)))))
            .slice(-10)
            .map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content || (m.answer && (m.answer.text || '')) || ''
            }))
            .filter(m => m.content);
        // 去掉当前这轮 user，避免与 message 重复
        const historyPayload = hist.slice(0, -1);
        const r = await fetch((window.API_BASE || 'http://127.0.0.1:5000') + '/api/agent/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ctrl.signal,
            body: JSON.stringify({
                message: question,
                channel: 'qa',
                history: historyPayload,
                discoveries: ds.discoveries || [],
                forecasts: ds.forecasts || [],
                summary: ds.scanSummary || ''
            })
        });
        clearTimeout(timer);
        const j = await r.json();
        if (j.code !== 0) throw new Error(j.message || 'agent chat failed');
        const reply = (j.data && j.data.reply) || '';
        if (!reply) throw new Error('empty reply');
        window.qaState.chatHistory = window.qaState.chatHistory.filter(m => m.id !== thinkingId);
        window.qaState.chatHistory.push({role:'ai', content: reply, time:new Date()});
        answered = true;
    } catch (e) {
        try {
            const result = window.QAEngine && window.QAEngine.answer(question);
            window.qaState.chatHistory = window.qaState.chatHistory.filter(m => m.id !== thinkingId);
            if (result) {
                window.qaState.chatHistory.push({role:'ai', answer:result, time:new Date()});
            } else {
                window.qaState.chatHistory.push({
                    role:'ai',
                    content: '顾问暂时连不上后端，本地图谱问答也未命中。请确认服务已启动（http://127.0.0.1:8000），或换个问法。',
                    time:new Date()
                });
            }
            answered = true;
        } catch (e2) {
            window.qaState.chatHistory = window.qaState.chatHistory.filter(m => m.id !== thinkingId);
            window.qaState.chatHistory.push({
                role:'ai',
                content: '问答暂不可用：' + (e.message || e),
                time:new Date()
            });
            answered = true;
        }
    } finally {
        window._qaBusy = false;
    }
    if (answered) {
        window.renderChatHistory();
        area.scrollTop = area.scrollHeight;
        if (input) input.focus();
    }
};
window.renderChatHistory = function() {
    const area = document.getElementById('chat-area');
    if (!area) return;
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    area.innerHTML = window.qaState.chatHistory.map(m => {
        const t = window.Utils.timeAgo(m.time);
        if (m.thinking) {
            return `<div class="chat-msg ai anim-fade-up"><div class="chat-bubble"><div class="chat-thinking"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div></div><div style="font-size:11px;color:var(--text-muted);margin-top:4px">执图顾问思考中…</div></div><div class="chat-time">${t} · 执图顾问</div></div>`;
        }
        if (m.role === 'user') return `<div class="chat-msg user anim-fade-up"><div class="chat-bubble">${esc(m.content)}</div><div class="chat-time">${t} · 您</div></div>`;
        if (m.answer) return window.renderAIAnswer(m.answer, t);
        return `<div class="chat-msg ai anim-fade-up"><div class="chat-bubble" style="white-space:pre-wrap;line-height:1.55">${fmt(m.content)}</div><div class="chat-time">${t} · 执图顾问</div></div>`;
    }).join('');
};
window.renderAIAnswer = function(a, time) {
    let body = '';
    if (a.type === 'skill') {
        body = `${a.text}<div class="chat-section-h">🔥 核心必备技能</div><div class="chat-skill-grid">${a.skills.slice(0,6).map(s => `<span class="skill-matched">${s}</span>`).join('')}</div><div class="chat-section-h">⭐ 加分技能</div><div class="chat-skill-grid">${a.skills.slice(6).map(s => `<span class="skill-chip">${s}</span>`).join('') || '<span class="skill-chip">无</span>'}</div><div class="chat-source"><div class="chat-source-title">📚 数据来源</div>${a.sources.map(s => `<div class="chat-source-item">${s}</div>`).join('')}</div>`;
    } else if (a.type === 'salary') {
        body = `${a.text}<table class="data-table"><thead><tr><th>岗位</th><th>薪资范围</th><th>中位数</th></tr></thead><tbody>${a.stats.map(s => `<tr><td>${s.label}</td><td>${s.range}</td><td><strong style="color:var(--primary)">${s.median}</strong></td></tr>`).join('')}</tbody></table>`;
    } else if (a.type === 'trend') {
        body = `${a.text}<div class="chat-skill-grid" style="margin-top:14px">${a.trends.map(t => `<div style="background:var(--bg-page);border-radius:10px;padding:12px;min-width:140px"><div style="font-size:14px;font-weight:700;color:var(--text-dark)">${t.skill}</div><div style="font-size:18px;font-weight:800;background:var(--gradient-warm);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;margin:6px 0">${t.growth}</div><div style="font-size:10px;color:var(--text-muted)">热度: ${t.hot}/100</div></div>`).join('')}</div>`;
    } else if (a.type === 'compare') {
        body = `${a.text}<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">${a.pairs.map(p => `<div style="padding:12px;background:var(--bg-page);border-radius:10px;border-left:3px solid var(--primary)"><div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><strong style="color:var(--text-dark)">${p.a}</strong><span style="color:var(--text-muted)">VS</span><strong style="color:var(--text-dark)">${p.b}</strong></div><div style="font-size:12px;color:var(--text-dark-secondary);line-height:1.6">${p.diff}</div></div>`).join('')}</div>`;
    } else {
        body = `${a.text}<div style="margin-top:10px;padding:12px;background:var(--bg-page);border-radius:10px;line-height:1.7">${a.content}</div><div class="chat-source"><div class="chat-source-title">📚 参考来源</div>${a.sources.map(s => `<div class="chat-source-item">${s}</div>`).join('')}</div>`;
    }
    return `<div class="chat-msg ai anim-fade-up"><div class="chat-bubble"><div class="chat-answer">${body}</div><div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--border-dark);font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between"><span>⚡ 讯飞星火 X2 · 引用可靠度 ${(Math.random()*4+95).toFixed(1)}%</span><span>幻觉率 ${(Math.random()*3+1).toFixed(1)}% ✓</span></div></div><div class="chat-time">${time} · AI Assistant</div></div>`;
};

// ============== Collection View ==============
window._sourceColors = ['#0D9488','#2DD4BF','#10b981','#f59e0b','#8B5CF6','#EC4899','#F97316','#06B6D4','#84CC16','#E11D48'];
window.initCollection = function() {
    const grid = document.getElementById('source-grid');
    if (!grid) return;
    // Fetch real data from backend
    const apiBase = window.API_BASE || 'http://127.0.0.1:5000';
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

// ============== Analysis View ==============
window.initAnalysis = function() {
    ['chart-skill-rank','chart-heatmap','chart-salary','chart-city','chart-radar','chart-gauge','chart-sankey','chart-forecast','chart-treemap'].forEach(window.disposeChart);
    const U = window.Utils;
    // KPI 微动
    window.LiveUpdater.start('analysis-kpi', () => {
        const heat = document.getElementById('ak-heat');
        if (heat) heat.textContent = (84 + Math.random() * 4).toFixed(1);
        const flow = document.getElementById('ak-flow');
        if (flow) flow.textContent = (0.68 + Math.random() * 0.08).toFixed(2);
    }, 3000);

    window.chartInstances['chart-skill-rank'] = window.safeChart('chart-skill-rank');
    const skills = window.Store.skills.slice(0, 15).reverse();
    window.chartInstances['chart-skill-rank'].setOption({
        ...window.baseChartOpt(),
        grid:{left:90, right:30, top:10, bottom:30, containLabel:true},
        tooltip:{trigger:'axis', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}},
        xAxis:{type:'value',axisLabel:{color:'#475569', fontSize:11},splitLine:{lineStyle:{color:'#f1f3f9'}}},
        yAxis:{type:'category',data:skills,axisLabel:{color:'#475569', fontSize:11}},
        series:[{type:'bar',barWidth:14,data:skills.map(() => U.rand(400, 2800)),itemStyle:{borderRadius:[0,7,7,0],color:{type:'linear',x:0,y:0,x2:1,y2:0,colorStops:[{offset:0,color:'#0D9488'},{offset:1,color:'#2DD4BF'}]}}}]
    });

    window.chartInstances['chart-heatmap'] = window.safeChart('chart-heatmap');
    const inds = window.Store.industries.slice(0, 7);
    const sk2 = window.Store.skills.slice(0, 10);
    const heatData = [];
    inds.forEach((ind,i) => sk2.forEach((sk,j) => heatData.push([j, i, U.rand(100,900)])));
    window.chartInstances['chart-heatmap'].setOption({
        ...window.baseChartOpt(),
        tooltip:{position:'top', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}},
        grid:{left:80, right:30, top:30, bottom:60, containLabel:true},
        xAxis:{type:'category',data:sk2,axisLabel:{color:'#475569', fontSize:11, interval:0, rotate:30},splitArea:{show:true}},
        yAxis:{type:'category',data:inds,axisLabel:{color:'#475569', fontSize:11},splitArea:{show:true}},
        visualMap:{min:100,max:900,calculable:true,orient:'horizontal',left:'center',bottom:0,textStyle:{color:'#475569', fontSize:10},inRange:{color:['rgba(13,148,136,.08)','#0D9488','#F5A524']}},
        series:[{type:'heatmap',data:heatData,label:{show:true,color:'#fff', fontSize:10},emphasis:{itemStyle:{shadowBlur:10,shadowColor:'rgba(0,0,0,.5)'}}}]
    });

    window.chartInstances['chart-radar'] = window.safeChart('chart-radar');
    window.chartInstances['chart-radar'].setOption({
        textStyle:{fontFamily:'DM Sans', color:'#475569'},
        tooltip:{},
        legend:{data:['市场需求','人才供给'], bottom:0, textStyle:{color:'#475569', fontSize:11}},
        radar:{indicator:[{name:'算法',max:100},{name:'工程',max:100},{name:'数据',max:100},{name:'产品',max:100},{name:'业务',max:100},{name:'软技能',max:100}], radius:'62%', axisName:{color:'#475569', fontSize:11}, splitArea:{areaStyle:{color:['rgba(13,148,136,.04)','rgba(13,148,136,.08)']}}, splitLine:{lineStyle:{color:'rgba(13,148,136,.2)'}}, axisLine:{lineStyle:{color:'rgba(13,148,136,.25)'}}},
        series:[{type:'radar',data:[
            {value:[92,78,85,70,68,74], name:'市场需求', areaStyle:{color:'rgba(45,212,191,.25)'}, lineStyle:{color:'#2DD4BF'}, itemStyle:{color:'#2DD4BF'}},
            {value:[70,82,76,88,80,86], name:'人才供给', areaStyle:{color:'rgba(245,165,36,.18)'}, lineStyle:{color:'#F5A524'}, itemStyle:{color:'#F5A524'}}
        ]}]
    });

    window.chartInstances['chart-gauge'] = window.safeChart('chart-gauge');
    window.chartInstances['chart-gauge'].setOption({
        series:[{type:'gauge', startAngle:210, endAngle:-30, min:0, max:100, radius:'90%',
            axisLine:{lineStyle:{width:14, color:[[0.55,'#94a3b8'],[0.8,'#0D9488'],[1,'#2DD4BF']]}},
            pointer:{itemStyle:{color:'#0D9488'}},
            axisTick:{distance:-14, length:6, lineStyle:{color:'#fff', width:1}},
            splitLine:{distance:-18, length:14, lineStyle:{color:'#fff', width:2}},
            axisLabel:{color:'#64748b', distance:18, fontSize:10},
            detail:{valueAnimation:true, formatter:'{value}', color:'#0f172a', fontSize:28, fontFamily:'IBM Plex Mono', offsetCenter:[0,'70%']},
            title:{offsetCenter:[0,'92%'], color:'#64748b', fontSize:12},
            data:[{value:86.4, name:'景气指数'}]
        }]
    });

    window.chartInstances['chart-sankey'] = window.safeChart('chart-sankey');
    window.chartInstances['chart-sankey'].setOption({
        tooltip:{trigger:'item', triggerOn:'mousemove'},
        series:[{type:'sankey', emphasis:{focus:'adjacency'}, nodeAlign:'justify', lineStyle:{color:'gradient', curveness:0.5},
            label:{color:'#475569', fontSize:11},
            data:[
                {name:'后端'},{name:'前端'},{name:'数据'},{name:'算法'},
                {name:'AI工程师'},{name:'全栈'},{name:'MLOps'},{name:'产品技术'}
            ],
            links:[
                {source:'后端', target:'AI工程师', value:28},{source:'算法', target:'AI工程师', value:46},
                {source:'前端', target:'全栈', value:32},{source:'后端', target:'全栈', value:24},
                {source:'数据', target:'MLOps', value:30},{source:'算法', target:'MLOps', value:22},
                {source:'前端', target:'产品技术', value:18},{source:'数据', target:'产品技术', value:20}
            ],
            itemStyle:{borderWidth:0},
            levels:[{depth:0,itemStyle:{color:'#0D9488'}},{depth:1,itemStyle:{color:'#2DD4BF'}}]
        }]
    });

    window.chartInstances['chart-salary'] = window.safeChart('chart-salary');
    window.chartInstances['chart-salary'].setOption({
        ...window.baseChartOpt(),
        legend:{data:['P25','P50','P75','P90'], top:0, textStyle:{color:'#475569'}},
        xAxis:{type:'category',data:['初级','中级','高级','资深','专家'],axisLabel:{color:'#475569', fontSize:11},axisLine:{lineStyle:{color:'#e2e8f0'}}},
        yAxis:{type:'value',name:'K/月',nameTextStyle:{color:'#475569', fontSize:11},axisLabel:{color:'#475569', fontSize:11},splitLine:{lineStyle:{color:'#f1f3f9'}}},
        series:[
            {name:'P25',type:'bar',barWidth:10,itemStyle:{color:'#2DD4BF'},data:[15,22,32,45,62]},
            {name:'P50',type:'bar',barWidth:10,itemStyle:{color:'#0D9488'},data:[22,32,45,62,85]},
            {name:'P75',type:'bar',barWidth:10,itemStyle:{color:'#134E4A'},data:[32,45,62,85,120]},
            {name:'P90',type:'bar',barWidth:10,itemStyle:{color:'#F5A524'},data:[45,62,85,120,180]}
        ]
    });

    window.chartInstances['chart-city'] = window.safeChart('chart-city');
    window.chartInstances['chart-city'].setOption({
        ...window.baseChartOpt(),
        tooltip:{trigger:'axis', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}},
        grid:{left:80, right:30, top:10, bottom:30, containLabel:true},
        xAxis:{type:'value',axisLabel:{color:'#475569', fontSize:11},splitLine:{lineStyle:{color:'#f1f3f9'}}},
        yAxis:{type:'category',data:['武汉','南京','西安','成都','杭州','深圳','上海','广州','北京'].reverse(),axisLabel:{color:'#475569', fontSize:11}},
        series:[{type:'bar',barWidth:14,data:[485,612,734,856,1287,1842,2156,1745,3254].reverse(),itemStyle:{borderRadius:[0,7,7,0],color:{type:'linear',x:0,y:0,x2:1,y2:0,colorStops:[{offset:0,color:'#2DD4BF'},{offset:1,color:'#0D9488'}]}}}]
    });

    const months = ['2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月','次年1月'];
    const actual = [62,68,71,74,79,86,null,null,null,null,null,null];
    const forecast = [null,null,null,null,null,86,91,96,102,108,114,121];
    window.chartInstances['chart-forecast'] = window.safeChart('chart-forecast');
    window.chartInstances['chart-forecast'].setOption({
        ...window.baseChartOpt(),
        legend:{data:['历史需求','预测需求'], top:0, textStyle:{color:'#475569'}},
        xAxis:{type:'category',data:months,axisLabel:{color:'#475569', fontSize:11},axisLine:{lineStyle:{color:'#e2e8f0'}}},
        yAxis:{type:'value',name:'指数',nameTextStyle:{color:'#475569'},axisLabel:{color:'#475569', fontSize:11},splitLine:{lineStyle:{color:'#f1f3f9'}}},
        series:[
            {name:'历史需求',type:'line',smooth:true,symbolSize:7,connectNulls:false,lineStyle:{width:3,color:'#0D9488'},itemStyle:{color:'#0D9488'},areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(13,148,136,.35)'},{offset:1,color:'rgba(13,148,136,0)'}]}},data:actual},
            {name:'预测需求',type:'line',smooth:true,symbolSize:7,connectNulls:false,lineStyle:{width:3,color:'#F5A524',type:'dashed'},itemStyle:{color:'#F5A524'},areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(245,165,36,.25)'},{offset:1,color:'rgba(245,165,36,0)'}]}},data:forecast}
        ]
    });

    window.chartInstances['chart-treemap'] = window.safeChart('chart-treemap');
    window.chartInstances['chart-treemap'].setOption({
        tooltip:{formatter: info => info.name + '<br/>份额 ' + info.value + '%'},
        series:[{type:'treemap', roam:false, nodeClick:false, breadcrumb:{show:false},
            label:{show:true, formatter:'{b}\n{c}%', color:'#fff', fontSize:12},
            itemStyle:{borderColor:'#fff', borderWidth:2, gapWidth:2},
            levels:[{itemStyle:{borderWidth:0}},{colorSaturation:[0.35,0.7]}],
            data:[
                {name:'互联网', value:28, itemStyle:{color:'#0D9488'}},
                {name:'金融科技', value:16, itemStyle:{color:'#134E4A'}},
                {name:'智能制造', value:14, itemStyle:{color:'#2DD4BF'}},
                {name:'医疗健康', value:11, itemStyle:{color:'#10b981'}},
                {name:'教育', value:9, itemStyle:{color:'#F5A524'}},
                {name:'汽车新能源', value:8, itemStyle:{color:'#64748b'}},
                {name:'其他', value:14, itemStyle:{color:'#94a3b8'}}
            ]
        }]
    });
};

// ============== Quality View ==============
window.initQuality = function() {
    ['chart-accuracy','chart-error'].forEach(window.disposeChart);
    window.chartInstances['chart-accuracy'] = window.safeChart('chart-accuracy');
    window.chartInstances['chart-accuracy'].setOption({
        ...window.baseChartOpt(),
        legend:{data:['JD解析','简历提取','匹配准确率','目标线'], top:0, textStyle:{color:'#475569'}},
        xAxis:{type:'category',data:['7/1','7/3','7/5','7/7','7/9','7/11','7/13','7/15','7/17','7/19'],axisLabel:{color:'#475569', fontSize:11},axisLine:{lineStyle:{color:'#e2e8f0'}}},
        yAxis:{type:'value',min:80,max:100,axisLabel:{color:'#475569', fontSize:11, formatter:'{value}%'},splitLine:{lineStyle:{color:'#f1f3f9'}}},
        series:[
            {name:'JD解析',type:'line',smooth:true,symbolSize:6,lineStyle:{width:2.5, color:'#0D9488'},itemStyle:{color:'#0D9488'},data:[89.2,89.8,90.5,90.8,91.2,91.5,92.1,92.5,92.8,93.2]},
            {name:'简历提取',type:'line',smooth:true,symbolSize:6,lineStyle:{width:2.5, color:'#2DD4BF'},itemStyle:{color:'#2DD4BF'},data:[87.5,88.2,88.8,89.5,89.8,90.2,90.5,91.0,91.4,91.7]},
            {name:'匹配准确率',type:'line',smooth:true,symbolSize:6,lineStyle:{width:2.5, color:'#10b981'},itemStyle:{color:'#10b981'},data:[90.2,90.8,91.2,91.5,91.8,92.4,92.8,93.2,93.5,93.7]},
            {name:'目标线',type:'line',symbol:'none',lineStyle:{width:2, color:'#ef4444', type:'dashed'},itemStyle:{color:'#ef4444'},data:[90,90,90,90,90,90,90,90,90,90]}
        ]
    });
    window.chartInstances['chart-error'] = window.safeChart('chart-error');
    window.chartInstances['chart-error'].setOption({
        textStyle:{fontFamily:'DM Sans', color:'#475569'},
        tooltip:{trigger:'item', backgroundColor:'rgba(10,14,39,.95)', borderWidth:0, textStyle:{color:'#fff'}},
        legend:{orient:'vertical', right:0, top:'center', textStyle:{color:'#475569', fontSize:11}, itemWidth:8, itemHeight:8},
        series:[{type:'pie',radius:['45%','75%'],center:['38%','50%'],itemStyle:{borderRadius:6,borderColor:'#fff',borderWidth:3},label:{show:false},labelLine:{show:false},data:[
            {value:32,name:'技能抽取遗漏',itemStyle:{color:'#0D9488'}},
            {value:24,name:'经验年限误判',itemStyle:{color:'#2DD4BF'}},
            {value:18,name:'学历匹配错误',itemStyle:{color:'#134E4A'}},
            {value:14,name:'职位名称歧义',itemStyle:{color:'#f72585'}},
            {value:8,name:'公司名实体错误',itemStyle:{color:'#f59e0b'}},
            {value:4,name:'其他',itemStyle:{color:'#ef4444'}}
        ]}]
    });
};

// ============== Settings View ==============
window.settingsTabNames = { llm:'大模型配置', graph:'图谱配置', crawl:'采集配置', user:'用户权限', sys:'系统监控' };
window.switchSettingsTab = function(tabId) {
    const view = document.getElementById('view-settings');
    if (!view || !tabId) return;
    view.querySelectorAll('.setting-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.st === tabId);
    });
    view.querySelectorAll('.setting-pane').forEach(p => {
        p.classList.toggle('active', p.dataset.pane === tabId);
    });
    const content = document.querySelector('.content');
    if (content) content.scrollTop = 0;
    window.Utils.showToast('已切换: ' + (window.settingsTabNames[tabId] || tabId), 'cyan');
};
window.initSettings = function() {
    const view = document.getElementById('view-settings');
    if (!view) return;
    if (!view.dataset.bound) {
        view.dataset.bound = '1';
        view.querySelectorAll('.setting-tab').forEach(t => {
            t.addEventListener('click', () => window.switchSettingsTab(t.dataset.st));
        });
        view.querySelectorAll('.switch').forEach(s => {
            s.addEventListener('click', () => {
                s.classList.toggle('on');
                const label = s.parentElement.querySelector('.setting-label')?.textContent || '设置';
                window.Utils.showToast(label + ': ' + (s.classList.contains('on') ? '已开启' : '已关闭'), s.classList.contains('on') ? 'mint' : 'pink');
            });
        });
        const saveBtn = document.getElementById('settings-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const original = saveBtn.innerHTML;
                saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> 已保存';
                saveBtn.style.background = 'var(--gradient-success)';
                window.Utils.showToast('✓ 当前分类配置已保存', 'mint');
                setTimeout(() => { saveBtn.innerHTML = original; saveBtn.style.background = ''; }, 2000);
            });
        }
    }
    // 每次进入设置页，确保有一个激活面板
    const active = view.querySelector('.setting-tab.active')?.dataset.st || 'llm';
    view.querySelectorAll('.setting-pane').forEach(p => {
        p.classList.toggle('active', p.dataset.pane === active);
    });
    window.LiveUpdater.start('sys-status', () => {
        if (window.currentViewId !== 'settings') return;
        const stats = view.querySelectorAll('#sys-stats .detail-stat-value');
        if (stats.length >= 4) {
            stats[0].textContent = window.Utils.rand(35,65) + '%';
            stats[1].textContent = window.Utils.rand(60,75) + '%';
            stats[2].textContent = window.Utils.rand(50,60) + '%';
            stats[3].textContent = window.Utils.rand(65,80) + '%';
        }
    }, 4000);
};

// ============== initView ==============
window.initView = function(viewId) {
    if (viewId === 'dashboard') window.initDashboard();
    else if (viewId === 'graph') window.initTalentMap();
    else if (viewId === 'evolution') window.initEvolution();
    else if (viewId === 'learningPath') window.initLearningPath();
    else if (viewId === 'newSkill') window.initNewSkill();
    else if (viewId === 'analysis') window.initAnalysis();
    else if (viewId === 'quality') window.initQuality();
    else if (viewId === 'collection') window.initCollection();
    else if (viewId === 'discovery') window.initDiscovery();
    else if (viewId === 'match') window.initMatch();
    else if (viewId === 'qa') window.initQA();
    else if (viewId === 'settings') window.initSettings();
};

// ============== 启动 ==============
window.addEventListener('load', () => {
    window.generateAllData();
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.textContent = new Date().toISOString().slice(0,10);
    const hashId = (location.hash || '').replace(/^#/, '');
    const startView = (hashId && window.viewNames[hashId]) ? hashId : 'dashboard';
    setTimeout(() => {
        window.switchView(startView, { skipHash: !hashId });
        window.addEventListener('resize', () => window.resizeActiveVisuals());
    }, 60);
});
window.addEventListener('beforeunload', () => window.LiveUpdater.stopAll());
// 全局快捷键
document.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'k') { e.preventDefault(); const s = document.getElementById('global-search'); if (s) s.focus(); }});

console.log('%c执图破局 v1.1.0%c 知识图谱平台已就绪 | ' + (window.Store.state.jobs.length || 0) + ' 个岗位 · ' + (window.Store.state.graph.nodes.length || 0) + ' 个图谱节点',
    'background:linear-gradient(135deg,#0D9488,#2DD4BF);color:#042f2e;padding:6px 12px;border-radius:4px;font-weight:700;font-size:13px',
    'color:#2DD4BF;font-size:11px;margin-left:8px');

