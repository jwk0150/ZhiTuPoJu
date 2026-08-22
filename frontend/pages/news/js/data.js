/* =========================================================================
 * 岗位大新闻 · Mock 数据层
 * -------------------------------------------------------------------------
 * 说明：
 *   - 所有数字、趋势、来源均为「示例数据」，仅用于演示资讯中心的
 *     信息呈现方式，不代表任何真实统计或真实新闻来源。
 *   - 以后可通过 API 替换本文件，UI 层不依赖具体数据实现。
 *   - 新闻来源使用独立的 `source` 字段，且统一标注为示例性质。
 * ========================================================================= */
(function () {
  'use strict';

  /* ---------- 分类体系 ---------- */
  var CATEGORIES = [
    { key: 'all',     label: '全部' },
    { key: 'hot',     label: '岗位热点', color: '#E65F67' },
    { key: 'change',  label: '岗位变化', color: '#4A9FE8' },
    { key: 'career',  label: '新职业',   color: '#50C8C5' },
    { key: 'trend',   label: '行业趋势', color: '#42B995' },
    { key: 'policy',  label: '政策资讯', color: '#E0A45B' },
    { key: 'demand',  label: '人才需求', color: '#7A8FE0' }
  ];

  function catByKey(key) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].key === key) return CATEGORIES[i];
    }
    return CATEGORIES[0];
  }

  /* ---------- 首页 Hero 元信息 ---------- */
  var HERO = {
    date: '2026.08.21',
    issue: '042',
    heat: 92,
    heatTrend: '12.8%',
    slogan: '捕捉岗位变化，读懂就业趋势'
  };

  /* ---------- 岗位新闻列表 ---------- */
  var NEWS = [
    {
      id: 'n001',
      category: 'hot',
      title: 'AI相关岗位持续升温',
      subtitle: '企业正在寻找什么样的人才？',
      summary: 'AI、大模型等技术正在推动部分岗位的需求和技能结构发生变化，复合型能力正成为新的关注点。',
      date: '2026.08.21',
      source: '公开人才市场资讯（示例）',
      trend: { dir: 'up', value: '+18.6%' },
      heat: 92,
      readTime: '3分钟',
      tags: ['AI', '岗位趋势'],
      featured: true,
      visual: 'network',
      job: 'AI产品经理',
      duties: ['产品规划', 'AI能力设计', '用户需求分析', '团队协作'],
      skills: ['产品设计', 'AI基础', '数据分析', '业务理解'],
      industries: 8,
      relatedJobs: 1286
    },
    {
      id: 'n002',
      category: 'career',
      title: '一个你可能没听过的新职业正在出现',
      subtitle: '智能体开发员进入更多应用场景',
      summary: '随着AI智能体落地加速，一个负责设计、开发与优化智能体的新岗位正在被更多企业写进招聘需求。',
      date: '2026.08.21',
      source: '公开人才市场资讯（示例）',
      trend: { dir: 'up', value: '+25.3%' },
      heat: 78,
      readTime: '2分钟',
      tags: ['智能体', '新职业'],
      visual: 'robot',
      job: '智能体开发员',
      duties: ['智能体设计', '流程编排', '模型接入', '效果评估'],
      skills: ['Python', '提示工程', 'API集成', '问题拆解'],
      industries: 6,
      relatedJobs: 642
    },
    {
      id: 'n003',
      category: 'change',
      title: '传统岗位正在发生新的变化',
      subtitle: '数据分析师的能力边界正在扩展',
      summary: '数据驱动型岗位持续受到关注，数据分析师正在从「取数做表」走向「业务洞察」。',
      date: '2026.08.20',
      source: '公开人才市场资讯（示例）',
      trend: { dir: 'up', value: '+9.8%' },
      heat: 66,
      readTime: '2分钟',
      tags: ['数据分析', '岗位变化'],
      visual: 'data',
      job: '数据分析师',
      duties: ['数据建模', '指标设计', '业务洞察', '报告输出'],
      skills: ['SQL', '统计学', '可视化', '业务理解'],
      industries: 7,
      relatedJobs: 980
    },
    {
      id: 'n004',
      category: 'change',
      title: 'AI产品经理岗位需求持续受到关注',
      subtitle: '技术与业务复合能力成为关键',
      summary: '企业对技术理解与业务能力兼具的人才关注度提升，AI产品经理成为跨行业出现的热门岗位。',
      date: '2026.08.20',
      source: '公开人才市场资讯（示例）',
      trend: { dir: 'up', value: '+18.6%' },
      heat: 84,
      readTime: '3分钟',
      tags: ['AI', '产品经理'],
      visual: 'grid',
      job: 'AI产品经理',
      duties: ['产品规划', 'AI能力设计', '用户需求分析', '团队协作'],
      skills: ['产品设计', 'AI基础', '数据分析', '业务理解'],
      industries: 8,
      relatedJobs: 1120
    },
    {
      id: 'n005',
      category: 'career',
      title: '智能体开发员成为新兴岗位',
      subtitle: 'AI智能体相关岗位正在进入更多应用场景',
      summary: '从客服到办公，智能体正在替代一部分重复流程，配套的开发岗位随之出现并快速增长。',
      date: '2026.08.19',
      source: '公开人才市场资讯（示例）',
      trend: { dir: 'up', value: '+25.3%' },
      heat: 71,
      readTime: '2分钟',
      tags: ['智能体', 'AI'],
      visual: 'robot',
      job: '智能体开发员',
      duties: ['智能体设计', '流程编排', '模型接入', '效果评估'],
      skills: ['Python', '提示工程', 'API集成', '问题拆解'],
      industries: 6,
      relatedJobs: 642
    },
    {
      id: 'n006',
      category: 'trend',
      title: '企业AI人才需求正在发生变化',
      subtitle: '从「会AI」到「用AI做事」',
      summary: '企业对AI人才的定义正在从纯技术能力，转向能够用AI解决实际业务问题的复合能力。',
      date: '2026.08.19',
      source: '公开人才市场资讯（示例）',
      trend: { dir: 'up', value: '+15.2%' },
      heat: 73,
      readTime: '2分钟',
      tags: ['AI', '人才需求'],
      visual: 'network',
      job: 'AI应用工程师',
      duties: ['需求分析', '模型选型', '应用开发', '落地优化'],
      skills: ['工程能力', 'AI基础', '系统设计', '业务理解'],
      industries: 9,
      relatedJobs: 1340
    },
    {
      id: 'n007',
      category: 'trend',
      title: '具身智能机器人应用技术员进入真实场景',
      subtitle: '让机器人进入真实工作场景',
      summary: '仓储、制造、服务等场景正在引入具身智能机器人，负责调试与运维的技术员岗位随之升温。',
      date: '2026.08.18',
      source: '公开人才市场资讯（示例）',
      trend: { dir: 'up', value: '+22.1%' },
      heat: 69,
      readTime: '3分钟',
      tags: ['机器人', '新职业'],
      visual: 'robot',
      job: '具身智能机器人应用技术员',
      duties: ['机器人部署', '场景调试', '故障诊断', '运行维护'],
      skills: ['自动化基础', '机器人操作', '传感器知识', '现场运维'],
      industries: 5,
      relatedJobs: 517
    },
    {
      id: 'n008',
      category: 'policy',
      title: '多地发布数字技能人才培育政策',
      subtitle: '政策加速技能人才培养',
      summary: '多个地区围绕数字技能人才推出培育与补贴政策，为相关岗位的供给提供长期支撑。',
      date: '2026.08.18',
      source: '公开政策资讯（示例）',
      trend: { dir: 'up', value: '+6.4%' },
      heat: 58,
      readTime: '2分钟',
      tags: ['政策', '数字技能'],
      visual: 'doc',
      job: '数字化人才',
      duties: ['技能学习', '认证提升', '岗位实践'],
      skills: ['数字素养', '专业基础', '持续学习'],
      industries: 8,
      relatedJobs: 720
    },
    {
      id: 'n009',
      category: 'demand',
      title: '新能源行业对复合型人才需求上升',
      subtitle: '技术 + 行业认知成为加分项',
      summary: '新能源产业链扩展，电池、储能、碳管理等方向对「技术 + 行业」复合型人才的需求持续上升。',
      date: '2026.08.17',
      source: '公开人才市场资讯（示例）',
      trend: { dir: 'up', value: '+12.7%' },
      heat: 64,
      readTime: '2分钟',
      tags: ['新能源', '人才需求'],
      visual: 'bars',
      job: '储能系统工程师',
      duties: ['系统设计', '方案评估', '项目落地'],
      skills: ['电气基础', '储能技术', '项目管理'],
      industries: 5,
      relatedJobs: 890
    },
    {
      id: 'n010',
      category: 'change',
      title: '数字化转型催生新的岗位形态',
      subtitle: '数字技术正在重塑岗位边界',
      summary: '数字化相关岗位正在从单一职能，向「业务 + 数据 + 技术」的复合形态演进。',
      date: '2026.08.17',
      source: '公开人才市场资讯（示例）',
      trend: { dir: 'up', value: '+11.3%' },
      heat: 61,
      readTime: '2分钟',
      tags: ['数字化', '岗位变化'],
      visual: 'grid',
      job: '数字化转型专员',
      duties: ['需求调研', '流程梳理', '系统落地'],
      skills: ['项目管理', '数据分析', '业务理解'],
      industries: 7,
      relatedJobs: 760
    },
    {
      id: 'n011',
      category: 'demand',
      title: '智能制造领域的技能结构正在变化',
      subtitle: '产线岗位向「运维 + 数据」演进',
      summary: '智能制造推进下，一线产线岗位的技能要求正在向设备运维与数据读取方向迁移。',
      date: '2026.08.16',
      source: '公开人才市场资讯（示例）',
      trend: { dir: 'up', value: '+8.9%' },
      heat: 55,
      readTime: '2分钟',
      tags: ['智能制造', '技能结构'],
      visual: 'data',
      job: '工业机器人运维工程师',
      duties: ['设备巡检', '故障处理', '数据记录'],
      skills: ['自动化', 'PLC基础', '现场运维'],
      industries: 4,
      relatedJobs: 640
    },
    {
      id: 'n012',
      category: 'policy',
      title: '职业教育与产业需求对接加速',
      subtitle: '校企协同推动技能供给匹配',
      summary: '职业教育正加强与产业需求的对接，围绕新兴岗位展开课程与认证体系调整。',
      date: '2026.08.16',
      source: '公开政策资讯（示例）',
      trend: { dir: 'flat', value: '持平' },
      heat: 49,
      readTime: '2分钟',
      tags: ['教育', '政策'],
      visual: 'doc',
      job: '职业教育讲师',
      duties: ['课程开发', '教学实施', '产教对接'],
      skills: ['专业能力', '教学设计', '行业洞察'],
      industries: 6,
      relatedJobs: 430
    },
    {
      id: 'n013',
      category: 'career',
      title: '数字化相关新岗位正在出现',
      subtitle: '数字技术正在催生新的岗位形态',
      summary: '围绕数据、智能与连接，一批此前不存在的岗位形态正在进入招聘市场。',
      date: '2026.08.15',
      source: '公开人才市场资讯（示例）',
      trend: { dir: 'up', value: '+14.5%' },
      heat: 57,
      readTime: '2分钟',
      tags: ['数字化', '新职业'],
      visual: 'grid',
      job: '数字产品运营',
      duties: ['内容运营', '数据分析', '用户增长'],
      skills: ['运营基础', '数据分析', '工具应用'],
      industries: 7,
      relatedJobs: 810
    }
  ];

  /* ---------- 热门岗位资讯（三列卡片） ---------- */
  var HOT_JOBS = [
    {
      id: 'n004',
      job: 'AI产品经理',
      category: '岗位趋势',
      dir: 'up',
      trend: '+18.6%',
      summary: '企业对技术与业务复合能力的关注正在提升。'
    },
    {
      id: 'n003',
      job: '数据分析师',
      category: '岗位趋势',
      dir: 'up',
      trend: '+9.8%',
      summary: '数据驱动型岗位持续受到关注。'
    },
    {
      id: 'n005',
      job: '智能体开发员',
      category: '新兴岗位',
      dir: 'up',
      trend: '+25.3%',
      summary: 'AI智能体相关岗位正在进入更多应用场景。'
    }
  ];

  /* ---------- 新职业（三张大卡） ---------- */
  var CAREERS = [
    {
      id: 'n005',
      name: '智能体开发员',
      tag: 'AI',
      badge: '新兴职业',
      desc: '负责设计、开发和优化AI智能体。',
      visual: 'robot'
    },
    {
      id: 'n007',
      name: '具身智能机器人应用技术员',
      tag: '机器人',
      badge: '新职业',
      desc: '让机器人进入真实工作场景。',
      visual: 'robot'
    },
    {
      id: 'n013',
      name: '数字化相关新岗位',
      tag: '数字化',
      badge: '职业趋势',
      desc: '数字技术正在催生新的岗位形态。',
      visual: 'grid'
    }
  ];

  /* ---------- 行业岗位变化 ---------- */
  var INDUSTRIES = [
    {
      key: 'ai',
      label: 'AI',
      blurb: 'AI相关岗位需求整体上行，技能组合成为关键。',
      items: [
        { name: 'AI产品经理', dir: 'up', value: '+18.6%' },
        { name: '智能体开发员', dir: 'up', value: '+25.3%' },
        { name: 'AI应用工程师', dir: 'up', value: '+15.2%' },
        { name: '数据分析', dir: 'up', value: '+9.8%' }
      ]
    },
    {
      key: 'internet',
      label: '互联网',
      blurb: '成熟岗位趋稳，新兴方向仍在释放机会。',
      items: [
        { name: '全栈工程师', dir: 'flat', value: '持平' },
        { name: '产品经理', dir: 'up', value: '+7.1%' },
        { name: '用户增长运营', dir: 'down', value: '-4.3%' },
        { name: '前端工程师', dir: 'flat', value: '持平' }
      ]
    },
    {
      key: 'manufacturing',
      label: '智能制造',
      blurb: '产线向「运维 + 数据」方向升级。',
      items: [
        { name: '工业机器人运维', dir: 'up', value: '+13.5%' },
        { name: '数字孪生工程师', dir: 'up', value: '+11.2%' },
        { name: '供应链分析师', dir: 'up', value: '+6.8%' }
      ]
    },
    {
      key: 'energy',
      label: '新能源',
      blurb: '产业链扩展带动复合型人才需求。',
      items: [
        { name: '电池材料工程师', dir: 'up', value: '+14.2%' },
        { name: '储能系统工程师', dir: 'up', value: '+12.7%' },
        { name: '碳管理顾问', dir: 'up', value: '+9.6%' }
      ]
    },
    {
      key: 'finance',
      label: '金融',
      blurb: '科技与数据能力重塑传统岗位。',
      items: [
        { name: '金融科技产品经理', dir: 'up', value: '+10.4%' },
        { name: '量化分析师', dir: 'flat', value: '持平' },
        { name: '风控建模师', dir: 'up', value: '+8.7%' }
      ]
    },
    {
      key: 'medical',
      label: '医疗',
      blurb: 'AI 与健康数据岗位逐步落地。',
      items: [
        { name: '医疗AI应用工程师', dir: 'up', value: '+16.3%' },
        { name: '健康数据分析师', dir: 'up', value: '+11.8%' },
        { name: '数字医疗运营', dir: 'flat', value: '持平' }
      ]
    },
    {
      key: 'education',
      label: '教育',
      blurb: '教育科技岗位稳步增长，运营岗承压。',
      items: [
        { name: '教育科技产品经理', dir: 'flat', value: '持平' },
        { name: 'AI教学设计师', dir: 'up', value: '+12.1%' },
        { name: '在线课程运营', dir: 'down', value: '-3.2%' }
      ]
    }
  ];

  /* ---------- 精选文章（详情页手写内容） ---------- */
  var ARTICLES = {
    n001: {
      sections: [
        {
          h: '发生了什么？',
          p: [
            'AI、大模型等技术正在推动部分岗位的需求量和技能结构发生变化。过去一段时间，与AI相关的岗位关注度持续上升，企业在招聘和人才储备上的动作也变得更加积极。',
            '需要说明的是，本文所有数据均为「示例数据」，用于展示资讯中心的信息呈现方式，不代表任何真实统计结果。'
          ]
        },
        {
          h: '为什么值得关注？',
          p: [
            '这轮变化不再局限于少数技术岗位，而是开始向产品、运营、数据分析等更广泛的岗位蔓延。对求职者而言，理解岗位背后的能力要求变化，比单纯记住岗位名称更有价值。',
            '当一个岗位开始「跨行业」出现时，通常意味着它正在从边缘走向主流，值得持续跟踪。'
          ]
        },
        {
          h: '岗位发生了什么变化？',
          p: [
            '一些岗位正在从「单一技能」转向「技能组合」。以AI产品经理为例，除了产品规划能力，企业开始更看重对AI能力边界、数据逻辑和业务落地的理解。',
            '岗位职责正在从「执行具体任务」，逐步向「定义问题 + 组织AI完成任务」的方向演进。'
          ]
        },
        {
          h: '企业更关注哪些能力？',
          p: [
            'AI工具使用能力、业务理解、数据能力与实际应用能力，正在成为企业筛选候选人时的高频关键词。',
            '换句话说，企业越来越希望找到「既懂业务、又会用AI」的复合型人才，而不是只会单一技能的执行者。'
          ]
        },
        {
          h: '哪些行业受到影响？',
          p: [
            '互联网、金融、医疗、教育、智能制造等行业，都在不同程度地出现AI相关岗位的需求变化。',
            '这种跨行业的影响，意味着相关岗位的经验可以在不同领域之间迁移，也为求职者提供了更多选择空间。'
          ]
        }
      ],
      keyData: [
        { label: '岗位热度', value: 92, suffix: '' },
        { label: '增长', value: 18.6, suffix: '%', decimals: 1 },
        { label: '相关岗位', value: 1286, suffix: '' },
        { label: '涉及行业', value: 8, suffix: '' }
      ],
      trendPoints: [60, 68, 75, 82, 92],
      trendLabel: '过去30天 · 岗位热度',
      aiInsight: {
        short: {
          summary: 'AI相关岗位的变化，不只是岗位数量变化。',
          points: ['AI工具使用能力', '业务理解', '数据能力', '实际应用能力'],
          direction: '岗位正在从「单一技术能力」，逐渐向「技术 + 业务」方向发展。'
        },
        expanded: {
          why: 'AI工具的使用门槛降低后，会用AI的「业务型人才」反而比只会单一技能的人更稀缺，企业因此调整了对候选人的能力要求。',
          what: '岗位职责从「执行具体任务」，转向「定义问题 + 组织AI完成任务」，技能组合成为新的竞争力。',
          impact: '部分重复性工作被替代，同时催生「AI + 行业」的复合岗位，求职者的学习重点也随之改变。',
          aiView: '这不是「岗位消失」，而是「岗位定义被重写」——理解变化背后的能力逻辑，比追逐单个岗位名称更重要。'
        }
      }
    },
    n004: {
      sections: [
        {
          h: '发生了什么？',
          p: [
            'AI产品经理正在成为跨行业出现的热门岗位。企业在招聘时，越来越多地把「AI能力设计」与「产品规划」并列写进岗位职责。',
            '以下内容与数据均为「示例数据」，仅用于演示资讯中心的信息呈现方式。'
          ]
        },
        {
          h: '为什么值得关注？',
          p: [
            '这个岗位的出现，说明企业对AI的期待正在从「技术试验」转向「业务落地」。谁能把AI能力翻译成产品价值，谁就更受欢迎。'
          ]
        },
        {
          h: '岗位发生了什么变化？',
          p: [
            'AI产品经理不再只是传统产品经理的「AI版」。它需要理解模型能力边界、数据质量与用户体验之间的关系，并在三者之间做权衡。'
          ]
        },
        {
          h: '企业更关注哪些能力？',
          p: ['产品设计、AI基础、数据分析与业务理解，构成这个岗位的核心能力组合。']
        },
        {
          h: '哪些行业受到影响？',
          p: ['互联网、金融、医疗、教育、智能制造等行业，都在为AI产品经理提供新的岗位机会。']
        }
      ],
      keyData: [
        { label: '岗位热度', value: 84, suffix: '' },
        { label: '增长', value: 18.6, suffix: '%', decimals: 1 },
        { label: '相关岗位', value: 1120, suffix: '' },
        { label: '涉及行业', value: 8, suffix: '' }
      ],
      trendPoints: [55, 61, 68, 76, 84],
      trendLabel: '过去30天 · 岗位热度',
      aiInsight: {
        short: {
          summary: 'AI产品经理的核心价值，是把AI能力翻译成业务价值。',
          points: ['产品设计', 'AI基础', '数据分析', '业务理解'],
          direction: '岗位正在从「会做产品」，向「会用AI做产品」升级。'
        },
        expanded: {
          why: '企业不缺AI技术，缺的是能把AI落进业务的人，因此「产品 + AI」的复合能力变得稀缺。',
          what: '岗位重心从功能设计，转向对AI能力边界、数据逻辑与用户体验的整体设计。',
          impact: '传统产品经理需要补足AI认知，技术背景的人也需要补足业务视角，两者向中间靠拢。',
          aiView: '这不是一个新名词，而是一次能力结构的升级——边界感与业务感同样重要。'
        }
      }
    },
    n005: {
      sections: [
        {
          h: '发生了什么？',
          p: [
            '随着AI智能体在客服、办公、研发等场景落地，负责设计、开发与优化智能体的岗位开始出现并快速增长。',
            '以下内容与数据均为「示例数据」，仅用于演示资讯中心的信息呈现方式。'
          ]
        },
        {
          h: '为什么值得关注？',
          p: [
            '智能体正在从「演示」走向「日常使用」。当企业开始把它写进招聘需求，说明它已经从概念进入了生产环节。'
          ]
        },
        {
          h: '岗位发生了什么变化？',
          p: [
            '智能体开发员需要把大模型、工具调用与业务流程编排在一起，工作内容横跨技术与业务两端。'
          ]
        },
        {
          h: '企业更关注哪些能力？',
          p: ['Python、提示工程、API集成与问题拆解能力，是这个岗位最常被提到的技能标签。']
        },
        {
          h: '哪些行业受到影响？',
          p: ['客服、办公协同、电商、金融、医疗等行业的流程自动化，都在催生智能体开发岗位。']
        }
      ],
      keyData: [
        { label: '岗位热度', value: 71, suffix: '' },
        { label: '增长', value: 25.3, suffix: '%', decimals: 1 },
        { label: '相关岗位', value: 642, suffix: '' },
        { label: '涉及行业', value: 6, suffix: '' }
      ],
      trendPoints: [40, 48, 57, 63, 71],
      trendLabel: '过去30天 · 岗位热度',
      aiInsight: {
        short: {
          summary: '智能体开发，本质上是「把大模型接进真实流程」。',
          points: ['Python', '提示工程', 'API集成', '问题拆解'],
          direction: '岗位正在从「写代码」，向「编排智能体流程」演进。'
        },
        expanded: {
          why: '大模型能力提升后，瓶颈从「模型本身」转移到了「如何把它接进业务」，于是需要专门的人来编排。',
          what: '工作重心从纯编码，转向流程设计、工具调用与效果评估的组合。',
          impact: '开发者需要补足产品思维，业务人员需要补足工程认知，两类能力正在融合。',
          aiView: '这是一个「连接型」岗位——它的价值不在于模型多强，而在于把模型用好。'
        }
      }
    }
  };

  /* ---------- 相关资讯映射（详情页底部） ---------- */
  var RELATED = {
    n001: ['n004', 'n005', 'n006'],
    n004: ['n001', 'n005', 'n006'],
    n005: ['n001', 'n002', 'n006'],
    n006: ['n001', 'n004', 'n005'],
    n007: ['n005', 'n010', 'n011'],
    n002: ['n005', 'n013', 'n006'],
    n003: ['n004', 'n006', 'n010'],
    n009: ['n011', 'n010', 'n012'],
    n010: ['n013', 'n009', 'n011'],
    n011: ['n009', 'n010', 'n007'],
    n008: ['n012', 'n010', 'n006'],
    n012: ['n008', 'n013', 'n010'],
    n013: ['n010', 'n005', 'n002']
  };

  /* ---------- 文章模板生成器（非手写文章的回退） ---------- */
  function templateSections(n) {
    var topic = (n.tags && n.tags[0]) || n.title;
    return [
      {
        h: '发生了什么？',
        p: [
          n.title + '正在成为近期就业市场中被反复提及的变化之一，相关岗位的关注度、数量与技能要求都在发生变化。',
          '以下内容与数据均为「示例数据」，仅用于演示资讯中心的信息呈现方式，不代表真实统计结果。'
        ]
      },
      {
        h: '为什么值得关注？',
        p: [
          '这一变化不是孤立事件，而是与行业数字化、技术普及和用人策略调整共同作用的结果。理解变化背后的原因，比记住单个岗位名称更有意义。',
          '当一类岗位开始「跨行业」出现时，通常意味着它正从边缘走向主流，值得持续跟踪。'
        ]
      },
      {
        h: '岗位发生了什么变化？',
        p: [
          '岗位职责正在从单一的执行型任务，向「理解业务 + 组合工具」的方向演进。',
          '企业招聘时，越来越多地同时关注硬技能与软性复合能力。'
        ]
      },
      {
        h: '企业更关注哪些能力？',
        p: [
          '除了专业基础，企业开始更看重候选人的学习能力、工具应用能力与跨团队协作能力，围绕「' + topic + '」的复合能力成为新重点。'
        ]
      },
      {
        h: '哪些行业受到影响？',
        p: [
          '互联网、金融、医疗、教育、智能制造等行业，都在不同程度地出现相关岗位的需求变化。'
        ]
      }
    ];
  }

  function templateKeyData(n) {
    var growth = n.trend && n.trend.value ? parseFloat(String(n.trend.value).replace(/[^0-9.\-]/g, '')) : 0;
    return [
      { label: '岗位热度', value: n.heat || 60, suffix: '' },
      { label: '增长', value: growth, suffix: '%', decimals: 1 },
      { label: '相关岗位', value: n.relatedJobs || 800, suffix: '' },
      { label: '涉及行业', value: n.industries || 7, suffix: '' }
    ];
  }

  function templateTrendPoints(n) {
    var h = n.heat || 60;
    var start = Math.max(30, Math.round(h * 0.62));
    var p = [];
    var step = (h - start) / 4;
    for (var i = 0; i < 5; i++) {
      p.push(Math.round(start + step * i));
    }
    return p;
  }

  function templateAiInsight(n) {
    var points = (n.skills && n.skills.slice(0, 4)) || ['业务理解', '数据分析', '工具应用', '协作沟通'];
    return {
      short: {
        summary: n.title + '的核心变化，不只是数量，而是能力结构。',
        points: points,
        direction: '岗位正在从「单一技能」，逐渐向「技术 + 业务」的复合方向发展。'
      },
      expanded: {
        why: '技术门槛变化后，会用工具的「业务型人才」比只会单一技能的人更稀缺，企业因此调整了能力要求。',
        what: '岗位职责从「执行具体任务」，转向「定义问题 + 组织工具完成任务」，技能组合成为新竞争力。',
        impact: '部分重复性工作被替代，同时催生「技术 + 行业」的复合岗位，求职者的学习重点随之改变。',
        aiView: '这不是「岗位消失」，而是「岗位定义被重写」——理解能力逻辑，比追逐岗位名称更重要。'
      }
    };
  }

  function getArticle(id) {
    var n = findNews(id);
    if (!n) return null;
    var hand = ARTICLES[id];
    return {
      id: n.id,
      category: n.category,
      categoryLabel: catByKey(n.category).label,
      title: n.title,
      subtitle: n.subtitle,
      date: n.date,
      source: n.source,
      readTime: n.readTime,
      trend: n.trend,
      heat: n.heat,
      tags: n.tags,
      job: n.job,
      duties: n.duties,
      skills: n.skills,
      sections: hand ? hand.sections : templateSections(n),
      keyData: hand ? hand.keyData : templateKeyData(n),
      trendPoints: hand ? hand.trendPoints : templateTrendPoints(n),
      trendLabel: '过去30天 · 岗位热度',
      aiInsight: hand ? hand.aiInsight : templateAiInsight(n)
    };
  }

  /* ---------- 工具 ---------- */
  function findNews(id) {
    for (var i = 0; i < NEWS.length; i++) {
      if (NEWS[i].id === id) return NEWS[i];
    }
    return null;
  }

  function relatedNews(id) {
    var ids = RELATED[id] || [];
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var n = findNews(ids[i]);
      if (n) out.push(n);
    }
    return out;
  }

  function neighbors(id) {
    var idx = -1;
    for (var i = 0; i < NEWS.length; i++) {
      if (NEWS[i].id === id) { idx = i; break; }
    }
    if (idx < 0) return { prev: null, next: null };
    return {
      prev: idx > 0 ? NEWS[idx - 1] : null,
      next: idx < NEWS.length - 1 ? NEWS[idx + 1] : null
    };
  }

  window.JOB_NEWS_DATA = {
    CATEGORIES: CATEGORIES,
    HERO: HERO,
    NEWS: NEWS,
    HOT_JOBS: HOT_JOBS,
    CAREERS: CAREERS,
    INDUSTRIES: INDUSTRIES,
    catByKey: catByKey,
    findNews: findNews,
    getArticle: getArticle,
    relatedNews: relatedNews,
    neighbors: neighbors
  };
})();
