/**
 * 趋势分析 Mock 数据层
 *
 * 设计原则：
 *   1. 数据逻辑自洽 —— 上升的技能持续上升，衰退的技能持续衰退
 *   2. 各数据集之间联动 —— 岗位趋势、技能排行、Heatmap 使用同一套底层数据
 *   3. 后续替换为真实 API 时，只需改为 fetch() 调用，页面组件不用改
 */

// ─── 时间轴 ───
const QUARTERS = [
  '2024 Q1','2024 Q2','2024 Q3','2024 Q4',
  '2025 Q1','2025 Q2','2025 Q3','2025 Q4',
  '2026 Q1','2026 Q2'
];
const MONTHS_12 = [
  '2025-08','2025-09','2025-10','2025-11','2025-12',
  '2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'
];

// ─── 岗位趋势（5条主线） ───
const JOB_TRENDS = {
  'AI Agent 工程师': {
    color: '#2563EB',
    quarterly:  [72,88,104,128, 156,192,236,288, 342,412],
    growthRate: 38.6,
    category: '人工智能',
  },
  '大模型应用工程师': {
    color: '#7C3AED',
    quarterly:  [70,84,102,124, 152,188,232,276, 318,386],
    growthRate: 34.2,
    category: '人工智能',
  },
  '数据工程师': {
    color: '#0EA5E9',
    quarterly:  [172,188,204,222, 238,256,274,292, 308,326],
    growthRate: 8.4,
    category: '大数据',
  },
  '云原生工程师': {
    color: '#16A34A',
    quarterly:  [148,162,174,188, 202,218,232,246, 262,276],
    growthRate: 9.8,
    category: '云计算',
  },
  '算法工程师': {
    color: '#F59E0B',
    quarterly:  [218,214,206,198, 188,178,170,162, 156,148],
    growthRate: -3.2,
    category: '人工智能',
  },
};

// ─── 技能趋势（月度 × 12项技能） ───
const SKILL_MONTHLY = {
  'RAG':                [18,21,24,28,    32,37,43,50,    58,65,72,76],
  'LLM':                [22,25,28,32,    36,41,46,52,    58,61,65,68],
  'Agent':              [12,14,17,20,    23,28,34,41,    49,55,60,64],
  'GraphRAG':           [3, 4, 5, 7,     9, 12,16,22,    28,34,39,43],
  'Tool Calling':       [6, 7, 9, 11,    14,18,23,29,    35,40,44,48],
  '向量数据库':          [14,16,18,21,    24,28,32,37,    42,46,49,52],
  'Kubernetes':          [38,39,41,43,    45,47,49,51,    53,54,55,56],
  'Python':              [58,59,61,62,    64,65,67,68,    70,71,72,73],
  'Docker':              [48,47,46,45,    44,42,41,39,    38,36,35,34],
  'SQL':                 [52,51,50,49,    48,47,46,45,    44,43,42,41],
  'Hadoop':              [44,41,38,36,    33,30,27,24,    21,19,17,16],
  'Prompt Engineering':  [10,14,19,25,    32,38,42,45,    46,44,42,40],
};

// ─── 技能生命周期 ───
const SKILL_LIFECYCLE = [
  { name:'RAG',           stage:'growth',   growth:42.7, heat:82, color:'#16A34A' },
  { name:'LLM',           stage:'growth',   growth:38.2, heat:78, color:'#16A34A' },
  { name:'Agent',         stage:'growth',   growth:34.8, heat:71, color:'#16A34A' },
  { name:'GraphRAG',      stage:'emerging', growth:68.3, heat:45, color:'#2563EB' },
  { name:'Tool Calling',   stage:'emerging', growth:52.1, heat:38, color:'#2563EB' },
  { name:'向量数据库',      stage:'growth',   growth:28.6, heat:65, color:'#16A34A' },
  { name:'Kubernetes',    stage:'mature',   growth:5.2,  heat:88, color:'#7C3AED' },
  { name:'Python',        stage:'mature',   growth:3.1,  heat:92, color:'#7C3AED' },
  { name:'Docker',        stage:'decline',  growth:-8.4, heat:60, color:'#F59E0B' },
  { name:'Hadoop',        stage:'decline',  growth:-18.2,heat:35, color:'#DC2626' },
  { name:'Prompt Engineering', stage:'mature', growth:2.8, heat:68, color:'#7C3AED' },
  { name:'SQL',           stage:'mature',   growth:-1.5, heat:85, color:'#7C3AED' },
];

// ─── 能力结构 Heatmap（11技能 × 3年） ───
const HEATMAP_SKILLS = ['Python','RAG','LLM','Agent','SQL','Docker','Kubernetes','GraphRAG','Tool Calling','向量数据库','Hadoop'];
const HEATMAP_YEARS = ['2024','2025','2026'];
const HEATMAP_DATA = [
  //2024                                    2025                                    2026
  [70, 15, 12,  8, 80, 75, 62,  3,  6, 20, 72],  // 2024
  [72, 42, 38, 28, 72, 60, 70, 16, 23, 38, 48],  // 2025
  [73, 72, 68, 64, 58, 42, 75, 42, 48, 52, 28],  // 2026
];

// ─── 能力变化事件 ───
const ABILITY_CHANGES = [
  { id:1,  job:'AI Agent 工程师',     ability:'Tool Calling',     type:'add',    desc:'Agent 工作流编排核心能力',              time:'2026-08-11 10:32' },
  { id:2,  job:'大模型应用工程师',      ability:'GraphRAG',        type:'add',    desc:'从 RAG 升级为知识图谱增强检索',            time:'2026-08-11 09:48' },
  { id:3,  job:'数据工程师',           ability:'实时流处理',        type:'modify', desc:'Flink 权重↑，传统批处理权重↓',            time:'2026-08-11 09:12' },
  { id:4,  job:'算法工程师',           ability:'Hadoop',          type:'remove',  desc:'需求下降 -12%，被 Spark / Flink 替代',     time:'2026-08-10 16:45' },
  { id:5,  job:'云原生工程师',          ability:'eBPF',           type:'add',    desc:'内核可观测性成为云原生新标配',               time:'2026-08-10 14:20' },
  { id:6,  job:'AI Agent 工程师',     ability:'Multi-Agent',     type:'add',    desc:'从单 Agent 向多 Agent 协作演进',            time:'2026-08-10 11:08' },
  { id:7,  job:'前端开发工程师',        ability:'WebAssembly',     type:'add',    desc:'高性能前端运行时需求上升',                  time:'2026-08-09 15:30' },
  { id:8,  job:'Java 开发工程师',      ability:'Spring AI',       type:'add',    desc:'Java 生态融合 AI 能力的标志性框架',          time:'2026-08-09 10:15' },
  { id:9,  job:'大模型应用工程师',      ability:'Prompt Engineering',type:'modify', desc:'从独立技能变为 Tool Calling 的子技能',     time:'2026-08-08 14:50' },
  { id:10, job:'数据工程师',           ability:'SQL',             type:'modify', desc:'需求稳定，但更强调与 Python/Spark 配合',       time:'2026-08-08 09:22' },
];

// ─── 未来预测（3个预测对象） ───
const FORECASTS = {
  'AI Agent 工程师': {
    historical: QUARTERS.map((q,i) => [q, JOB_TRENDS['AI Agent 工程师'].quarterly[i]]),
    predicted:  [
      ['2026 Q3',142],['2026 Q4',158],['2027 Q1',175],['2027 Q2',192],
      ['2027 Q3',208],['2027 Q4',225],
    ],
    lowerBound: [126,138,150,162,174,186],
    upperBound: [158,178,200,222,242,264],
    confidence: 91,
    growth6m:  32,
    growth12m: 48,
    growth18m: 63,
  },
  'RAG': {
    historical: MONTHS_12.map((m,i) => [m, SKILL_MONTHLY['RAG'][i]]),
    predicted: [
      ['2026-08',82],['2026-09',88],['2026-10',94],['2026-11',100],
      ['2026-12',106],['2027-01',112],
    ],
    lowerBound: [76,80,84,88,92,96],
    upperBound: [88,96,104,112,120,128],
    confidence: 88,
    growth6m:  28,
    growth12m: 42,
    growth18m: 55,
  },
  '大模型应用工程师': {
    historical: QUARTERS.map((q,i) => [q, JOB_TRENDS['大模型应用工程师'].quarterly[i]]),
    predicted: [
      ['2026 Q3',128],['2026 Q4',145],['2027 Q1',162],['2027 Q2',180],
      ['2027 Q3',198],['2027 Q4',215],
    ],
    lowerBound: [112,125,138,152,166,180],
    upperBound: [144,165,186,208,230,250],
    confidence: 88,
    growth6m:  27,
    growth12m: 41,
    growth18m: 54,
  },
};

// ─── 预测岗位 TOP 5 ───
// 预测岗位均为趋势外推产生的「市面上尚不存在」的新岗位（演示口径：全网招聘无在招记录）
const FORECAST_JOBS = [
  { rank:1, name:'多智能体社会编排师',      growth:63, confidence:91, sparkline:[3,5,8,12,18,26,36,49,64,82]  },
  { rank:2, name:'世界模型训练师',         growth:47, confidence:88, sparkline:[2,4,7,11,17,25,35,47,61,78]  },
  { rank:3, name:'神经符号推理架构师',      growth:39, confidence:84, sparkline:[1,3,5,8,12,18,25,34,44,56]   },
  { rank:4, name:'具身智能伦理审计师',      growth:35, confidence:82, sparkline:[2,3,5,8,12,17,23,31,40,51]   },
  { rank:5, name:'自主智能体仿真工程师',    growth:32, confidence:79, sparkline:[1,2,4,6,9,13,19,26,34,44]    },
];

// ─── AI 洞察文本 ───
const AI_INSIGHT = {
  summary: `过去 12 个月，AI Agent 相关岗位需求持续增长，同比增长 38.6%。\n\n其中 Tool Calling、RAG、向量数据库等能力增长最为明显，成为 AI Agent 岗位的核心能力三角。\n\n根据当前趋势：\n\n① AI Agent 工程师需求预计在未来 6-18 个月继续保持强劲增长\n② GraphRAG 正从萌芽期进入快速增长阶段，预计 12 个月内成为主流需求\n③ 单纯 Prompt Engineering 的增长趋于稳定，正被 Tool Calling 和 Agent 编排能力取代\n④ Hadoop 等传统大数据技能持续衰退，被 Spark/Flink/实时流处理替代`,
  basis: [
    { label:'历史岗位数量',    value:'3,742 条 AI Agent 相关 JD', },
    { label:'技能出现频率',    value:'RAG 76%、LLM 68%、Agent 64%', },
    { label:'同比增长率',      value:'AI Agent +38.6%、大模型应用 +34.2%', },
    { label:'岗位-技能关联度',  value:'AI Agent ↔ RAG 0.87、LLM 0.82', },
    { label:'时间序列趋势',    value:'连续 6 个季度正增长', },
    { label:'能力图谱变化',    value:'新增 Tool Calling / GraphRAG / Multi-Agent', },
  ],
  confidence: 87.4,
  dataRange: '2024 Q1 – 2026 Q2',
  sampleSize: 38780,
};

// ─── KPI 数据 ───
const KPI_DATA = {
  emergingJobs:    { value:24, change:18.6, label:'较上周期' },
  highGrowthSkills:{ value:38, change:26.4, label:'近12个月' },
  abilityChanges:  { value:126, added:74, removed:21, modified:31 },
  forecastConf:    { value:87.4, level:'HIGH' },
};

// ─── 筛选选项 ───
const FILTER_OPTIONS = {
  industries: ['全部行业','人工智能','大数据','云计算','软件开发','物联网'],
  jobTypes:   ['全部','AI Agent 工程师','大模型应用工程师','数据工程师','云原生工程师','算法工程师'],
  techStacks: ['全部','Python','Java','AI / LLM','RAG','Cloud Native','Big Data'],
  timeRanges: ['近6个月','近1年','近2年','全部'],
};
