/* =========================================================
 *  我的资料 / MY PROFILE
 *  数据层 + 交互逻辑
 *  - 数据按登录用户隔离存于 localStorage
 *  - 默认值从 zhitu_user（登录态）推断 + 内置 mock
 *  - 预留 window.MyProfileAPI 钩子，便于未来接后端
 * ========================================================= */
(function () {
  'use strict';

  // -----------------------------------------------------
  // 工具
  // -----------------------------------------------------
  function currentUserId() {
    try {
      var u = JSON.parse(localStorage.getItem('zhitu_user') || 'null');
      if (u && (u.username || u.user_id || u.id)) {
        return String(u.username || u.user_id || u.id);
      }
    } catch (_) {}
    return 'guest';
  }

  function readLS(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) { return fallback; }
  }
  function writeLS(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (_) { return false; }
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function initial(label) {
    var t = String(label || '').trim();
    return t ? t.slice(0, 1) : '·';
  }
  function formatPhone(p) {
    if (!p) return '—';
    var s = String(p).replace(/\D/g, '');
    if (s.length !== 11) return p;
    return s.slice(0, 3) + ' **** ' + s.slice(7);
  }
  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '.' + m + '.' + dd;
  }

  // -----------------------------------------------------
  // Mock 数据（首次访问注入；登录用户从 zhitu_user 合并）
  // -----------------------------------------------------
  var DEFAULTS = {
    userProfile: {
      name: '张三',
      gender: '男',
      phone: '13800005678',
      email: 'zhangsan@example.com',
      city: '上海市',
      currentStatus: '学生 · 正在寻找实习',
      avatar: '' // 空字符串使用首字占位
    },
    education: [
      {
        id: 'edu-1',
        school: 'XXX 大学',
        major: '计算机科学与技术',
        degree: '本科',
        startYear: 2023,
        graduateYear: 2027
      }
    ],
    careerPreference: {
      currentStatus: '学生（在读）',
      desiredJobs: ['AI 产品经理', '数据分析师', '大模型算法工程师'],
      desiredCities: ['北京', '上海', '杭州'],
      desiredIndustries: ['人工智能', '互联网', '大数据']
    },
    resume: {
      exists: true,
      updatedAt: '2026.08.26',
      status: '已完成',
      completion: 82
    }
  };

  // 标签可选池（避免用户大量手动输入）
  var POOLS = {
    'desiredJobs': [
      'AI 产品经理', '数据分析师', '大模型算法工程师', '机器学习工程师',
      '数据产品经理', '商业分析师', 'NLP 工程师', '推荐算法工程师',
      'Java 工程师', '前端工程师', '产品经理', '运营经理',
      '用户研究', '战略分析', '风控建模', '量化研究'
    ],
    'desiredCities': [
      '北京', '上海', '杭州', '深圳', '广州', '成都',
      '南京', '苏州', '武汉', '西安', '厦门', '青岛'
    ],
    'desiredIndustries': [
      '人工智能', '互联网', '大数据', '金融科技', '新能源',
      '智能制造', '生物医药', '教育', '文娱', '电商零售',
      '游戏', '智慧出行', '企业服务', '医疗健康'
    ]
  };

  // -----------------------------------------------------
  // 完成度计算：11 项加权规则，总分 100
  // -----------------------------------------------------
  function computeCompletion(d) {
    d = d || state.data;
    var p = d.userProfile, cp = d.careerPreference, ed = d.education, r = d.resume;
    var checks = [
      // 基本信息 35%（平均 7 分）
      { ok: !!(p.name && p.name.trim() && p.name !== '—'), pts: 7 },
      { ok: !!(p.gender),                                   pts: 5 },
      { ok: !!(p.phone && String(p.phone).replace(/\D/g,'').length === 11), pts: 8 },
      { ok: !!(p.email && /^\S+@\S+\.\S+$/.test(p.email)),  pts: 8 },
      { ok: !!(p.city && p.city.trim()),                    pts: 7 },
      // 求职意向 30%
      { ok: !!(cp.currentStatus && cp.currentStatus.trim()), pts: 8 },
      { ok: !!(cp.desiredJobs && cp.desiredJobs.length >= 1), pts: 8 },
      { ok: !!(cp.desiredCities && cp.desiredCities.length >= 1), pts: 7 },
      { ok: !!(cp.desiredIndustries && cp.desiredIndustries.length >= 1), pts: 7 },
      // 教育 15%
      { ok: !!(ed && ed.length >= 1 && ed[0].school && ed[0].major), pts: 15 },
      // 简历 20%
      { ok: !!(r && r.exists),                              pts: 20 }
    ];
    var sum = 0, max = 0;
    checks.forEach(function (c) { max += c.pts; if (c.ok) sum += c.pts; });
    return Math.round(sum / max * 100);
  }

  function completionText(pct) {
    if (pct >= 90) return { label: '非常完整', sub: '可优先匹配头部岗位', tone: 'high' };
    if (pct >= 70) return { label: '比较完整', sub: '补充细节可提升匹配度', tone: 'mid' };
    if (pct >= 40) return { label: '待完善',   sub: '继续补全可解锁更多推荐', tone: 'low' };
    return          { label: '刚刚开始', sub: '从基本信息开始填起', tone: 'low' };
  }

  // 临时：在 state 里加 editSnapshot
  function snapshotData()  { return JSON.parse(JSON.stringify(state.data)); }
  function restoreData(s)  { state.data = s; }

    // -----------------------------------------------------
  // 存储：按用户隔离
  // -----------------------------------------------------
  var STORE_KEY = function () { return 'zhitu_my_profile_v1__' + currentUserId(); };

  function loadAll() {
    var stored = readLS(STORE_KEY(), null);
    if (stored && typeof stored === 'object') {
      // 与默认值浅合并（保证新增字段有默认值）
      return {
        userProfile: Object.assign({}, DEFAULTS.userProfile, stored.userProfile || {}),
        education: Array.isArray(stored.education) && stored.education.length
          ? stored.education
          : DEFAULTS.education.slice(),
        careerPreference: Object.assign({}, DEFAULTS.careerPreference, stored.careerPreference || {}),
        resume: Object.assign({}, DEFAULTS.resume, stored.resume || {})
      };
    }
    // 首次访问：注入默认值；并尝试从登录用户合并姓名
    var u = readLS('zhitu_user', null);
    var seed = JSON.parse(JSON.stringify(DEFAULTS));
    if (u && u.username) {
      seed.userProfile.name = u.name || u.displayName || u.username;
    }
    writeLS(STORE_KEY(), seed);
    return seed;
  }
  function saveAll(data) {
    writeLS(STORE_KEY(), data);
    // 通知同窗口其它标签
    try { window.dispatchEvent(new CustomEvent('zhitu-profile-changed', { detail: { data: data } })); } catch (_) {}
  }

  // -----------------------------------------------------
  // API 钩子（未来接后端时只需替换这里）
  // -----------------------------------------------------
  var apiInited = false;
  function tryInitApi() {
    if (apiInited) return;
    apiInited = true;
    if (window.MyProfileAPI && typeof window.MyProfileAPI.init === 'function') {
      try { window.MyProfileAPI.init({ load: loadAll, save: saveAll }); } catch (_) {}
    }
  }
  window.MyProfileAPI = window.MyProfileAPI || {
    init: function () {},
    // 预留：远端拉取 / 远端保存
    fetchRemote: function () { return Promise.resolve(null); },
    pushRemote: function () { return Promise.resolve(true); }
  };

  // -----------------------------------------------------
  // 状态
  // -----------------------------------------------------
  var state = {
    data: loadAll(),
    editing: false,         // 是否在编辑资料态
    section: 'profile',     // 当前左侧目录
    avatarBlob: null,
    editSnapshot: null,     // 进入编辑前的数据快照（用于取消时回滚）
    lastFocus: null         // 模态打开前的焦点元素（关闭后回焦）
  };

  // -----------------------------------------------------
  // 渲染：侧边栏
  // -----------------------------------------------------
  function renderSide() {
    var p = state.data.userProfile;
    var avatarSrc = state.data.userProfile.avatar || '';
    var avatarHtml = avatarSrc
      ? '<img alt="avatar" src="' + esc(avatarSrc) + '">'
      : '<div class="mp-id-avatar-fallback">' + esc(initial(p.name)) + '</div>';

    var navItems = [
      { id: 'profile',   num: '01', label: '个人资料', en: 'PROFILE' },
      { id: 'education', num: '02', label: '教育经历', en: 'EDUCATION' },
      { id: 'career',    num: '03', label: '求职偏好', en: 'PREFERENCES' },
      { id: 'resume',    num: '04', label: '我的简历', en: 'RESUME' }
    ];
    var navHtml = navItems.map(function (n) {
      return (
        '<button class="mp-nav-item' + (state.section === n.id ? ' is-active' : '') + '" data-jump="' + n.id + '">' +
          '<span class="num">' + n.num + '</span>' +
          '<span class="label">' + n.label + '</span>' +
          '<span class="en">' + n.en + '</span>' +
        '</button>'
      );
    }).join('');

    return (
      '<aside class="mp-side">' +
        '<div class="mp-brand" aria-label="执图破局 · 我的职业档案">' +
          '<span class="mp-brand-mark">执</span>' +
          '<span class="mp-brand-name-wrap">' +
            '<span class="mp-brand-name">执图破局</span>' +
            '<span class="mp-brand-en">MY PROFILE</span>' +
          '</span>' +
        '</div>' +

        '<div class="mp-id" data-open-avatar>' +
          '<div class="mp-id-avatar" title="点击更换头像">' + avatarHtml + '</div>' +
          '<div>' +
            '<div class="mp-id-name">' + esc(p.name) + '</div>' +
            '<div class="mp-id-role">' + esc(p.currentStatus) + '</div>' +
            '<div class="mp-id-badge">寻找实习机会</div>' +
          '</div>' +
        '</div>' +

        '<div class="mp-side-divider"></div>' +

        '<nav class="mp-nav" aria-label="资料目录">' + navHtml + '</nav>' +

        '<div class="mp-side-foot">' +
          '<button class="mp-foot-link" data-jump="settings">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
            '<span class="label">账户设置</span>' +
            '<span class="en">SETTINGS</span>' +
          '</button>' +
          '<button class="mp-foot-link" data-action="logout">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
            '<span class="label">退出登录</span>' +
            '<span class="en">LOG OUT</span>' +
          '</button>' +
        '</div>' +
      '</aside>'
    );
  }

  // -----------------------------------------------------
  // 渲染：顶部 + Hero
  // -----------------------------------------------------
  function renderTopbar() {
    var saveBtn = state.editing
      ? '<button class="mp-btn mp-btn-primary" data-action="save-profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>保存修改</button>'
      : '';
    var cancelBtn = state.editing
      ? '<button class="mp-btn mp-btn-link" data-action="cancel-edit">取消</button>'
      : '';
    var editBtn = !state.editing
      ? '<button class="mp-btn mp-btn-ghost" data-action="edit-profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>编辑资料</button>'
      : '';

    var pct = computeCompletion();
    var cx = completionText(pct);
    return (
      '<div class="mp-topbar">' +
        '<div class="mp-topbar-left">' +
          '<button class="mp-topbar-back" data-action="back-home">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>' +
            '返回首页' +
          '</button>' +
          '<span class="mp-topbar-path">MY PROFILE · 我的职业档案</span>' +
        '</div>' +
        '<div class="mp-topbar-mid">' +
          '<button class="mp-completion-chip tone-' + cx.tone + '" data-jump="completion-info" title="点击查看完整度详情">' +
            '<span class="mp-completion-ring" style="--pct:' + pct + '"><span class="num">' + pct + '%</span></span>' +
            '<span class="txt">' +
              '<span class="lbl">资料完整度</span>' +
              '<span class="sub">' + cx.label + '</span>' +
            '</span>' +
          '</button>' +
        '</div>' +
        '<div class="mp-topbar-actions">' +
          editBtn + cancelBtn + saveBtn +
        '</div>' +
      '</div>'
    );
  }

  function renderHero() {
    var p = state.data.userProfile;
    var photoSrc = p.avatar || '';
    var photoHtml = photoSrc
      ? '<img alt="' + esc(p.name) + '" src="' + esc(photoSrc) + '">'
      : '<div class="mp-photo-fallback">' + esc(initial(p.name)) + '</div>';

    var infoRows = state.editing ? renderInfoEditing(p) : renderInfoReadonly(p);

    return (
      '<section class="mp-hero" id="mp-section-profile">' +
        // 装饰
        '<span class="mp-mark" style="top:64px;left:38%"></span>' +
        '<span class="mp-mark" style="bottom:120px;left:6%"></span>' +
        '<span class="mp-mark" style="top:120px;right:34%"></span>' +
        // 巨大 01 编号
        '<div class="mp-mega-num mp-hero-num">01</div>' +
        // 垂直文字
        '<div class="mp-vertical">PERSONAL INFORMATION · 基本信息</div>' +

        '<div class="mp-hero-left mp-rise mp-rise-1">' +
          '<div class="mp-eyebrow">CHAPTER · 01 / 04</div>' +
          '<h1 class="mp-h1">MY<br>PROFILE</h1>' +
          '<div class="mp-h1-zh">我的职业档案</div>' +
          '<p class="mp-hero-quote">探索职业可能，<br>让未来的自己拥有更多选择。</p>' +
        '</div>' +

        '<div class="mp-hero-right mp-rise mp-rise-2">' +
          '<div class="mp-photo" data-open-avatar>' +
            photoHtml +
            '<div class="mp-photo-sign">' + esc(p.name) + '</div>' +
          '</div>' +
          '<div class="mp-card" style="position:relative">' +
            '<div class="mp-info-list">' + infoRows + '</div>' +
          '</div>' +
        '</div>' +
      '</section>'
    );
  }

  function renderInfoReadonly(p) {
    var rows = [
      ['姓名', esc(p.name || '—')],
      ['性别', esc(p.gender || '—')],
      ['手机号', esc(formatPhone(p.phone))],
      ['邮箱', esc(p.email || '—')],
      ['所在城市', esc(p.city || '—')]
    ];
    return rows.map(function (r) {
      return (
        '<div class="mp-info-row">' +
          '<div class="mp-info-label">' + r[0] + '</div>' +
          '<div class="mp-info-value">' + r[1] + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderInfoEditing(p) {
    var genderOpts = ['男', '女', '其他', '不便透露'].map(function (g) {
      return '<option value="' + esc(g) + '"' + (p.gender === g ? ' selected' : '') + '>' + g + '</option>';
    }).join('');
    var rows = [
      ['姓名', '<input type="text" data-field="name" value="' + esc(p.name) + '" maxlength="24">'],
      ['性别', '<select data-field="gender">' + genderOpts + '</select>'],
      ['手机号', '<input type="tel" data-field="phone" value="' + esc(p.phone) + '" maxlength="11" placeholder="11位手机号">'],
      ['邮箱', '<input type="email" data-field="email" value="' + esc(p.email) + '" placeholder="name@example.com">'],
      ['所在城市', '<input type="text" data-field="city" value="' + esc(p.city) + '" maxlength="20" placeholder="如：上海市">']
    ];
    return rows.map(function (r) {
      return (
        '<div class="mp-info-row">' +
          '<div class="mp-info-label">' + r[0] + '</div>' +
          '<div class="mp-info-value">' + r[1] + '</div>' +
        '</div>'
      );
    }).join('');
  }

  // -----------------------------------------------------
  // 渲染：02 EDUCATION
  // -----------------------------------------------------
  function renderEducation() {
    var rows = state.data.education.map(function (e) {
      return (
        '<div class="mp-edu-row" data-edu-id="' + esc(e.id) + '">' +
          '<div class="mp-edu-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>' +
          '</div>' +
          '<div class="mp-edu-year">' + esc(e.startYear) + ' — ' + esc(e.graduateYear) + (Number(e.graduateYear) >= new Date().getFullYear() ? '（预计）' : '') + '</div>' +
          '<div class="mp-edu-main">' +
            '<div class="mp-edu-school">' + esc(e.school) + '</div>' +
            '<div class="mp-edu-major">' + esc(e.major) + '</div>' +
          '</div>' +
          '<div class="mp-edu-degree">' + esc(e.degree) + '</div>' +
          '<div class="mp-edu-actions">' +
            '<button class="mp-icon-btn" data-action="edit-edu" data-edu-id="' + esc(e.id) + '" title="编辑"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>' +
            '<button class="mp-icon-btn danger" data-action="del-edu" data-edu-id="' + esc(e.id) + '" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg></button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    var firstEdu = state.data.education[0] || DEFAULTS.education[0];
    return (
      '<section class="mp-section" id="mp-section-education">' +
        '<div class="mp-section-head mp-rise">' +
          '<div class="mp-section-num-block">' +
            '<div class="mp-section-num">02</div>' +
            '<div class="mp-section-tag">CHAPTER</div>' +
          '</div>' +
          '<div>' +
            '<div class="mp-section-title">教育背景</div>' +
            '<div class="mp-section-desc">记录你受过的完整教育训练 —— 院校、专业、学位、起止年份。</div>' +
          '</div>' +
        '</div>' +

        '<div class="mp-section-body">' +
          '<div class="mp-edu-card mp-rise mp-rise-2">' +
            (rows || '<div class="mp-edu-empty"><div class="mp-edu-empty-title">还没有教育经历</div><div class="mp-edu-empty-sub">从你的第一所学校开始记录</div></div>') +
            '<button class="mp-edu-add" data-action="add-edu">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
              '添加教育经历' +
            '</button>' +
          '</div>' +
          '<div class="mp-school-card mp-rise mp-rise-3">' +
            '<div class="mp-school-card-bg"></div>' +
            '<div class="mp-school-card-inner">' +
              '<div class="mp-school-card-name">' + esc(firstEdu.school).toUpperCase() + '</div>' +
              '<div class="mp-school-card-tag">' + esc(firstEdu.major) + ' · ' + esc(firstEdu.degree) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>'
    );
  }

  // -----------------------------------------------------
  // 渲染：03 CAREER
  // -----------------------------------------------------
  function renderCareer() {
    var cp = state.data.careerPreference;
    return (
      '<section class="mp-section" id="mp-section-career">' +
        '<div class="mp-section-head mp-rise">' +
          '<div class="mp-section-num-block">' +
            '<div class="mp-section-num">03</div>' +
            '<div class="mp-section-tag">CHAPTER</div>' +
          '</div>' +
          '<div>' +
            '<div class="mp-section-title">职业意向</div>' +
            '<div class="mp-section-desc">告诉人岗匹配系统，你想去哪里、做哪些事 —— 用标签点亮你的职业身份。</div>' +
          '</div>' +
        '</div>' +

        '<div class="mp-section-body single">' +
          '<div class="mp-career-card mp-rise mp-rise-2">' +
            '<div class="mp-career-row">' +
              '<div class="mp-info-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-7l-2-2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>CURRENT STATUS · 当前身份</div>' +
              '<div class="mp-tag-wrap" data-row="currentStatus">' +
                '<span class="mp-tag" data-status>' + esc(cp.currentStatus || '—') + '</span>' +
                '<button class="mp-tag-add" data-pick="currentStatus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>修改</button>' +
              '</div>' +
            '</div>' +
            '<div class="mp-career-row">' +
              '<div class="mp-info-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>DESIRED ROLES · 意向岗位</div>' +
              '<div class="mp-tag-wrap" data-row="desiredJobs">' +
                renderTagList(cp.desiredJobs, 'desiredJobs') +
                '<input class="mp-tag-input" data-tag-input="desiredJobs" placeholder="自定义 · 回车添加" maxlength="20">' +
                '<button class="mp-tag-add" data-pick="desiredJobs"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>选择</button>' +
              '</div>' +
            '</div>' +
            '<div class="mp-career-row">' +
              '<div class="mp-info-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>PREFERRED LOCATIONS · 意向城市</div>' +
              '<div class="mp-tag-wrap" data-row="desiredCities">' +
                renderTagList(cp.desiredCities, 'desiredCities') +
                '<input class="mp-tag-input" data-tag-input="desiredCities" placeholder="自定义 · 回车添加" maxlength="20">' +
                '<button class="mp-tag-add" data-pick="desiredCities"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>选择</button>' +
              '</div>' +
            '</div>' +
            '<div class="mp-career-row">' +
              '<div class="mp-info-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V3"/><path d="M21 21H3"/><path d="M7 14l4-4 4 4 6-6"/></svg>INDUSTRIES · 期望行业</div>' +
              '<div class="mp-tag-wrap" data-row="desiredIndustries">' +
                renderTagList(cp.desiredIndustries, 'desiredIndustries') +
                '<input class="mp-tag-input" data-tag-input="desiredIndustries" placeholder="自定义 · 回车添加" maxlength="20">' +
                '<button class="mp-tag-add" data-pick="desiredIndustries"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>选择</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>'
    );
  }

  function renderTagList(arr, key) {
    if (!arr || !arr.length) return '';
    return arr.map(function (t) {
      return (
        '<span class="mp-tag" data-tag="' + esc(t) + '">' + esc(t) +
          '<button class="x" data-remove="' + esc(key) + '" data-val="' + esc(t) + '" aria-label="移除">×</button>' +
        '</span>'
      );
    }).join('');
  }

  // -----------------------------------------------------
  // 渲染：04 RESUME
  // -----------------------------------------------------
  function renderResume() {
    var r = state.data.resume;
    var p = state.data.userProfile;
    var completion = r.completion || 0;

    if (!r.exists) {
      // 空状态 A
      return (
        '<section class="mp-section" id="mp-section-resume">' +
          '<div class="mp-section-head mp-rise">' +
            '<div class="mp-section-num-block">' +
              '<div class="mp-section-num">04</div>' +
              '<div class="mp-section-tag">CHAPTER</div>' +
            '</div>' +
            '<div>' +
              '<div class="mp-section-title">我的简历</div>' +
              '<div class="mp-section-desc">NO RESUME YET —— 还没有创建职业简历。开始你的第一份职业文档。</div>' +
            '</div>' +
          '</div>' +

          '<div class="mp-section-body single">' +
            '<div class="mp-resume-card mp-rise mp-rise-2" style="text-align:center;justify-content:center;padding:60px 40px">' +
              '<div class="mp-resume-info" style="text-align:center;max-width:520px;margin:0 auto">' +
                '<div class="mp-resume-kicker">NO RESUME YET</div>' +
                '<h3 class="mp-resume-title">创建我的第一份职业简历</h3>' +
                '<p style="color:var(--mp-text-on-dark-2);font-size:13px;line-height:1.7;margin:0 0 24px">从教育、意向到个人经历，5 分钟生成一份与岗位匹配的求职简历。</p>' +
                '<div class="mp-resume-actions" style="justify-content:center">' +
                  '<button class="mp-btn mp-btn-primary" data-action="resume-create">CREATE YOUR RESUME →</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>'
      );
    }

    return (
      '<section class="mp-section" id="mp-section-resume">' +
        '<div class="mp-section-head mp-rise">' +
          '<div class="mp-section-num-block">' +
            '<div class="mp-section-num">04</div>' +
            '<div class="mp-section-tag">CHAPTER</div>' +
          '</div>' +
          '<div>' +
            '<div class="mp-section-title">我的简历</div>' +
            '<div class="mp-section-desc">MY RESUME —— 我的求职简历 · 完整度 ' + completion + '%</div>' +
          '</div>' +
        '</div>' +

        '<div class="mp-section-body single">' +
          '<div class="mp-resume-card mp-rise mp-rise-2">' +
            '<div class="mp-resume-info">' +
              '<div class="mp-resume-kicker">MY RESUME</div>' +
              '<h3 class="mp-resume-title">我的求职简历</h3>' +
              '<div class="mp-resume-meta">' +
                '<div class="mp-resume-meta-item">最近更新 · <span class="num">' + esc(r.updatedAt) + '</span></div>' +
                '<div class="mp-resume-meta-item">状态 · <span class="num">' + esc(r.status) + '</span></div>' +
                '<div class="mp-resume-meta-item">完整度 · <span class="num">' + completion + '%</span></div>' +
              '</div>' +
              '<div class="mp-resume-actions">' +
                '<button class="mp-btn mp-btn-primary" data-action="resume-view">查看简历 →</button>' +
                '<button class="mp-btn mp-btn-ghost" data-action="resume-edit">编辑简历 →</button>' +
              '</div>' +
            '</div>' +
            '<div class="mp-resume-preview" aria-hidden="true">' +
              '<div class="mp-resume-preview-head">' +
                '<div class="mp-resume-preview-brand">RESUME</div>' +
                '<div class="mp-resume-preview-date">' + esc(r.updatedAt) + '</div>' +
              '</div>' +
              '<div class="mp-resume-preview-name">' + esc((p.name || 'USER').toUpperCase()) + '</div>' +
              '<div class="mp-resume-preview-role">' + esc((p.currentStatus || 'STUDENT').toUpperCase()) + '</div>' +
              '<div class="mp-resume-preview-lines">' +
                '<div class="mp-resume-preview-line"></div>' +
                '<div class="mp-resume-preview-line mid"></div>' +
                '<div class="mp-resume-preview-line short"></div>' +
                '<div class="mp-resume-preview-line mid"></div>' +
                '<div class="mp-resume-preview-line short"></div>' +
              '</div>' +
              '<div class="mp-resume-preview-score">' +
                '<div>' +
                  '<div class="pct">' + completion + '%</div>' +
                  '<div class="lbl">完整度</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<button class="mp-resume-create" data-action="resume-create">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
            '创建新的简历' +
          '</button>' +
        '</div>' +
      '</section>'
    );
  }

  // -----------------------------------------------------
  // 全量渲染
  // -----------------------------------------------------
  function render() {
    var root = document.getElementById('mp-root');
    if (!root) return;
    root.innerHTML =
      '<div class="mp-shell">' +
        renderSide() +
        '<main class="mp-main">' +
          renderTopbar() +
          renderHero() +
          renderEducation() +
          renderCareer() +
          renderResume() +
        '</main>' +
      '</div>' +
      renderModals();
    bind();
  }

  // -----------------------------------------------------
  // 模态：标签选择 / 头像 / 添加教育 / 状态选择
  // -----------------------------------------------------
  function renderModals() {
    return (
      // 标签选择模态
      '<div class="mp-modal" id="mp-modal-pick" role="dialog" aria-modal="true">' +
        '<div class="mp-modal-box">' +
          '<div class="mp-modal-head">' +
            '<div class="mp-modal-title" id="mp-pick-title">添加标签</div>' +
            '<button class="mp-modal-close" data-close-modal aria-label="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
          '</div>' +
          '<div class="mp-modal-body">' +
            '<div class="mp-pick-list" id="mp-pick-list"></div>' +
          '</div>' +
          '<div class="mp-modal-foot">' +
            '<button class="mp-btn mp-btn-link" data-close-modal>取消</button>' +
            '<button class="mp-btn mp-btn-primary" data-pick-confirm>添加</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // 当前身份 单选模态
      '<div class="mp-modal" id="mp-modal-status" role="dialog" aria-modal="true">' +
        '<div class="mp-modal-box">' +
          '<div class="mp-modal-head">' +
            '<div class="mp-modal-title">修改当前身份</div>' +
            '<button class="mp-modal-close" data-close-modal aria-label="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
          '</div>' +
          '<div class="mp-modal-body">' +
            '<div class="mp-pick-list" id="mp-status-list"></div>' +
          '</div>' +
          '<div class="mp-modal-foot">' +
            '<button class="mp-btn mp-btn-link" data-close-modal>取消</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // 头像模态
      '<div class="mp-modal" id="mp-modal-avatar" role="dialog" aria-modal="true">' +
        '<div class="mp-modal-box">' +
          '<div class="mp-modal-head">' +
            '<div class="mp-modal-title">更换头像</div>' +
            '<button class="mp-modal-close" data-close-modal aria-label="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
          '</div>' +
          '<div class="mp-modal-body">' +
            '<div class="mp-avatar-modal">' +
              '<div class="mp-avatar-preview" id="mp-avatar-preview"></div>' +
              '<div class="mp-avatar-actions">' +
                '<label class="mp-upload">' +
                  '更换头像 · 点击或拖入图片（≤2MB）' +
                  '<input type="file" id="mp-avatar-file" accept="image/*">' +
                '</label>' +
                '<button class="mp-btn mp-btn-ghost" data-avatar-remove>删除头像</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="mp-modal-foot">' +
            '<button class="mp-btn mp-btn-link" data-close-modal>取消</button>' +
            '<button class="mp-btn mp-btn-primary" data-avatar-confirm>保存</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // 教育表单模态
      '<div class="mp-modal" id="mp-modal-edu" role="dialog" aria-modal="true">' +
        '<div class="mp-modal-box">' +
          '<div class="mp-modal-head">' +
            '<div class="mp-modal-title" id="mp-edu-title">添加教育经历</div>' +
            '<button class="mp-modal-close" data-close-modal aria-label="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
          '</div>' +
          '<div class="mp-modal-body">' +
            '<div class="mp-form-grid">' +
              '<div><div class="mp-info-label">学校</div><input class="mp-input" id="mp-edu-school" placeholder="如：清华大学"></div>' +
              '<div><div class="mp-info-label">专业</div><input class="mp-input" id="mp-edu-major" placeholder="如：计算机科学与技术"></div>' +
              '<div><div class="mp-info-label">学历</div><select class="mp-input" id="mp-edu-degree"><option>本科</option><option>硕士</option><option>博士</option><option>大专</option><option>其他</option></select></div>' +
              '<div><div class="mp-info-label">在读</div><label class="mp-checkbox"><input type="checkbox" id="mp-edu-current"><span>当前仍在读</span></label></div>' +
              '<div><div class="mp-info-label">入学年份</div><input class="mp-input" id="mp-edu-start" type="number" min="1980" max="2099" placeholder="2023"></div>' +
              '<div><div class="mp-info-label">毕业年份</div><input class="mp-input" id="mp-edu-end" type="number" min="1980" max="2099" placeholder="2027"></div>' +
            '</div>' +
          '</div>' +
          '<div class="mp-modal-foot">' +
            '<button class="mp-btn mp-btn-link" data-close-modal>取消</button>' +
            '<button class="mp-btn mp-btn-primary" data-edu-confirm>保存</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Toast
      '<div class="mp-toast" id="mp-toast"></div>'
    );
  }

  // -----------------------------------------------------
  // 交互：通用
  // -----------------------------------------------------
  function openModal(id) {
    state.lastFocus = document.activeElement;
    var m = document.getElementById(id);
    if (m) {
      m.classList.add('is-open');
      document.body.classList.add('modal-open');
      // 模态内第一个可聚焦元素获焦
      setTimeout(function () {
        var f = m.querySelector('input, select, textarea, button');
        if (f) { try { f.focus(); } catch (_) {} }
      }, 30);
    }
  }
  function closeModal(id) {
    var toClose = id ? [document.getElementById(id)] : Array.prototype.slice.call(document.querySelectorAll('.mp-modal.is-open'));
    toClose.forEach(function (m) { if (m) m.classList.remove('is-open'); });
    if (!document.querySelector('.mp-modal.is-open')) {
      document.body.classList.remove('modal-open');
    }
    // 回焦到打开前
    if (!id && state.lastFocus && state.lastFocus.focus) {
      try { state.lastFocus.focus(); } catch (_) {}
      state.lastFocus = null;
    }
  }
  function toast(msg, type) {
    var t = document.getElementById('mp-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.toggle('error', type === 'error');
    t.classList.add('is-show');
    clearTimeout(window.__mpToastT);
    window.__mpToastT = setTimeout(function () { t.classList.remove('is-show'); }, 2000);
  }

  // -----------------------------------------------------
  // 交互：编辑资料
  // -----------------------------------------------------
  function enterEdit() {
    state.editSnapshot = snapshotData();
    state.editing = true;
    render();
    // 聚焦第一个输入 + 绑定 dirty/validation
    setTimeout(function () {
      var f = document.querySelector('[data-field="name"]');
      if (f) { try { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } catch (_) {} }
      bindEditListeners();
    }, 50);
  }
  function cancelEdit() {
    if (state.editSnapshot) restoreData(state.editSnapshot);
    state.editSnapshot = null;
    state.editing = false;
    render();
  }
  // ---- 编辑态：实时 dirty 校验 + 字段错误样式 ----
  function isDirty() {
    if (!state.editSnapshot) return false;
    var a = state.editSnapshot.userProfile, b = state.data.userProfile;
    return ['name','gender','phone','email','city'].some(function (k) {
      return String(a[k] || '') !== String(b[k] || '');
    });
  }
  function syncSaveBtn() {
    var btn = document.querySelector('[data-action="save-profile"]');
    if (!btn) return;
    var dirty = isDirty();
    btn.classList.toggle('is-highlight', dirty);
    btn.toggleAttribute('data-dirty', dirty);
  }
  function validateField(f) {
    var key = f.getAttribute('data-field');
    var v = (f.value || '').trim();
    var err = '';
    if (key === 'name' && !v) err = '请填写姓名';
    else if (key === 'phone' && v && v.replace(/\D/g,'').length !== 11) err = '手机号应为 11 位';
    else if (key === 'email' && v && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(v)) err = '邮箱格式不正确';
    f.classList.toggle('is-error', !!err);
    return !err;
  }
  function validateFields() {
    var fields = document.querySelectorAll('.mp-info-row [data-field]');
    var all = true;
    fields.forEach(function (f) { if (!validateField(f)) all = false; });
    return all;
  }
  function bindEditListeners() {
    var fields = document.querySelectorAll('.mp-info-row [data-field]');
    fields.forEach(function (f) {
      f.addEventListener('input', function () {
        // 实时同步到 state
        var key = f.getAttribute('data-field');
        var v = f.value;
        if (key === 'phone') v = v.replace(/\D/g,'').slice(0,11);
        state.data.userProfile[key] = v;
        validateField(f);
        syncSaveBtn();
      });
      f.addEventListener('blur', function () { validateField(f); });
    });
    syncSaveBtn();
  }

  function saveEdit() {
    if (!validateFields()) { toast('请修正标红字段', 'error'); return; }
    var p = state.data.userProfile;
    var changed = isDirty();
    p.currentStatus = p.currentStatus || DEFAULTS.userProfile.currentStatus;
    if (changed) {
      saveAll(state.data);
      // 同步刷新简历完成度
      state.data.resume.completion = Math.max(state.data.resume.completion || 0, computeCompletion());
      saveAll(state.data);
      toast('已保存');
    } else {
      toast('没有需要保存的修改');
    }
    state.editSnapshot = null;
    state.editing = false;
    render();
  }

  // -----------------------------------------------------
  // 交互：头像
  // -----------------------------------------------------
  function openAvatar() {
    renderAvatarPreview();
    openModal('mp-modal-avatar');
  }
  function renderAvatarPreview() {
    var box = document.getElementById('mp-avatar-preview');
    if (!box) return;
    var src = state.avatarBlob || state.data.userProfile.avatar;
    if (src) {
      box.innerHTML = '<img alt="" src="' + esc(src) + '">';
    } else {
      box.innerHTML = '<div class="empty">' + esc(initial(state.data.userProfile.name)) + '</div>';
    }
  }
  function handleAvatarFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('请选择图片文件', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { toast('图片需小于 2MB', 'error'); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      state.avatarBlob = e.target.result;
      renderAvatarPreview();
    };
    reader.readAsDataURL(file);
  }
  function confirmAvatar() {
    if (state.avatarBlob === null) {
      // 没动过
      closeModal('mp-modal-avatar');
      return;
    }
    if (state.avatarBlob === '') {
      state.data.userProfile.avatar = '';
    } else {
      state.data.userProfile.avatar = state.avatarBlob;
    }
    saveAll(state.data);
    state.avatarBlob = null;
    closeModal('mp-modal-avatar');
    render();
    toast('头像已更新');
  }
  function removeAvatar() {
    state.avatarBlob = '';
    renderAvatarPreview();
  }

  // -----------------------------------------------------
  // 交互：标签（多选池）
  // -----------------------------------------------------
  var pickState = { key: null, selected: [] };
  function openPick(key) {
    pickState.key = key;
    var current = (key === 'currentStatus') ? [state.data.careerPreference.currentStatus] : (state.data.careerPreference[key] || []);
    pickState.selected = current.slice();
    var pool = (key === 'currentStatus')
      ? ['学生（在读）', '应届毕业生', '求职者', '在职 - 考虑机会', '在职 - 不考虑', '海外留学生']
      : (POOLS[key] || []);
    var titleMap = { desiredJobs: '添加意向岗位', desiredCities: '添加意向城市', desiredIndustries: '添加期望行业' };
    var title = document.getElementById('mp-pick-title');
    if (title) title.textContent = titleMap[key] || '选择';

    var list = document.getElementById('mp-pick-list');
    if (!list) return;
    list.innerHTML = pool.map(function (t) {
      var on = pickState.selected.indexOf(t) >= 0;
      return '<button class="mp-pick-item' + (on ? ' is-selected' : '') + '" data-pick-val="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');

    openModal('mp-modal-pick');
  }
  function togglePickVal(v) {
    var idx = pickState.selected.indexOf(v);
    if (idx >= 0) pickState.selected.splice(idx, 1);
    else pickState.selected.push(v);
    // 更新 UI
    var list = document.getElementById('mp-pick-list');
    if (list) {
      list.querySelectorAll('[data-pick-val]').forEach(function (b) {
        var on = pickState.selected.indexOf(b.getAttribute('data-pick-val')) >= 0;
        b.classList.toggle('is-selected', on);
      });
    }
  }
  function confirmPick() {
    if (!pickState.key) return;
    if (pickState.key === 'currentStatus') {
      // 单选走不同模态，这里不会到
    } else {
      state.data.careerPreference[pickState.key] = pickState.selected.slice();
    }
    saveAll(state.data);
    closeModal('mp-modal-pick');
    render();
    toast('已更新');
  }

  // 当前身份：单选
  function openStatus() {
    var list = document.getElementById('mp-status-list');
    if (!list) return;
    var opts = ['学生（在读）', '应届毕业生', '求职者', '在职 - 考虑机会', '在职 - 不考虑', '海外留学生'];
    var cur = state.data.careerPreference.currentStatus;
    list.innerHTML = opts.map(function (t) {
      return '<button class="mp-pick-item' + (t === cur ? ' is-selected' : '') + '" data-status-val="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
    openModal('mp-modal-status');
  }
  function pickStatus(v) {
    state.data.careerPreference.currentStatus = v;
    saveAll(state.data);
    closeModal('mp-modal-status');
    render();
    toast('当前身份已更新');
  }

  // 删除标签
  function removeTag(key, val) {
    var arr = state.data.careerPreference[key] || [];
    var i = arr.indexOf(val);
    if (i >= 0) {
      arr.splice(i, 1);
      saveAll(state.data);
      render();
    }
  }

  // -----------------------------------------------------
  // 交互：教育
  // -----------------------------------------------------
  var eduFormState = { id: null };
  function openEduForm(id) {
    eduFormState.id = id || null;
    var title = document.getElementById('mp-edu-title');
    var e = id ? state.data.education.find(function (x) { return x.id === id; }) : null;
    if (title) title.textContent = id ? '编辑教育经历' : '添加教育经历';
    var s = document.getElementById('mp-edu-school');
    var m = document.getElementById('mp-edu-major');
    var d = document.getElementById('mp-edu-degree');
    var sy = document.getElementById('mp-edu-start');
    var ey = document.getElementById('mp-edu-end');
    if (e) {
      s.value = e.school || ''; m.value = e.major || '';
      d.value = e.degree || '本科';
      sy.value = e.startYear || ''; ey.value = e.graduateYear || '';
    } else {
      s.value = ''; m.value = ''; d.value = '本科'; sy.value = ''; ey.value = '';
    }
    openModal('mp-modal-edu');
  }
  function confirmEdu() {
    var s = (document.getElementById('mp-edu-school').value || '').trim();
    var m = (document.getElementById('mp-edu-major').value || '').trim();
    var d = document.getElementById('mp-edu-degree').value;
    var sy = parseInt(document.getElementById('mp-edu-start').value, 10);
    var ey = parseInt(document.getElementById('mp-edu-end').value, 10);
    if (!s) { toast('请填写学校', 'error'); return; }
    if (!m) { toast('请填写专业', 'error'); return; }
    if (!sy || !ey || sy < 1980 || ey > 2099 || ey < sy) { toast('请填写正确的起止年份', 'error'); return; }

    if (eduFormState.id) {
      var e = state.data.education.find(function (x) { return x.id === eduFormState.id; });
      if (e) { e.school = s; e.major = m; e.degree = d; e.startYear = sy; e.graduateYear = ey; }
    } else {
      state.data.education.push({
        id: 'edu-' + Date.now().toString(36),
        school: s, major: m, degree: d, startYear: sy, graduateYear: ey
      });
    }
    saveAll(state.data);
    closeModal('mp-modal-edu');
    render();
    toast(eduFormState.id ? '已更新' : '已添加');
  }
  function delEdu(id) {
    var i = state.data.education.findIndex(function (x) { return x.id === id; });
    if (i >= 0) {
      state.data.education.splice(i, 1);
      // 允许空数组：UI 层会自动渲染空状态
      saveAll(state.data);
      render();
      toast('已删除');
    }
  }

  // -----------------------------------------------------
  // 简历动作（联动到既有 resume.html）
  // -----------------------------------------------------
  function resumeView() {
    try { sessionStorage.setItem('zhitu_open_resume', '1'); } catch (_) {}
    location.href = 'resume.html?embed=1&v=20260826rx4';
  }
  function resumeEdit() {
    try { sessionStorage.setItem('zhitu_open_resume', '1'); } catch (_) {}
    location.href = 'resume.html?embed=1&mode=edit&v=20260826rx4';
  }
  function resumeCreate() {
    state.data.resume.exists = true;
    state.data.resume.updatedAt = todayISO();
    state.data.resume.status = '草稿';
    state.data.resume.completion = Math.max(state.data.resume.completion || 0, 24);
    saveAll(state.data);
    toast('已创建简历草稿');
    setTimeout(resumeEdit, 350);
  }

  // -----------------------------------------------------
  // 事件绑定
  // -----------------------------------------------------
  function bind() {
    // 返回首页
    document.querySelectorAll('[data-action="back-home"]').forEach(function (b) {
      b.addEventListener('click', function () {
        location.href = (location.pathname.indexOf('/pages/') >= 0 ? './news/index.html' : './pages/news/index.html');
      });
    });
    // 登出
    document.querySelectorAll('[data-action="logout"]').forEach(function (b) {
      b.addEventListener('click', function () {
        try { localStorage.removeItem('zhitu_user'); } catch (_) {}
        location.href = (location.pathname.indexOf('/pages/') >= 0 ? '../index.html' : './index.html');
      });
    });

    // 左侧目录
    document.querySelectorAll('[data-jump]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-jump');
        if (id === 'settings') { toast('账户设置 暂未开放', 'error'); return; }
        var el = document.getElementById('mp-section-' + id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        state.section = id;
        // 重新高亮侧边栏
        document.querySelectorAll('.mp-nav-item').forEach(function (n) {
          n.classList.toggle('is-active', n.getAttribute('data-jump') === id);
        });
      });
    });

    // 头像
    document.querySelectorAll('[data-open-avatar]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        openAvatar();
      });
    });

    // 编辑 / 取消 / 保存
    document.querySelectorAll('[data-action="edit-profile"]').forEach(function (b) {
      b.addEventListener('click', enterEdit);
    });
    document.querySelectorAll('[data-action="cancel-edit"]').forEach(function (b) {
      b.addEventListener('click', cancelEdit);
    });
    document.querySelectorAll('[data-action="save-profile"]').forEach(function (b) {
      b.addEventListener('click', saveEdit);
    });

    // 模态关闭
    document.querySelectorAll('[data-close-modal]').forEach(function (b) {
      b.addEventListener('click', function () { closeModal(); state.avatarBlob = null; });
    });
    // 模态遮罩点击关闭
    document.querySelectorAll('.mp-modal').forEach(function (m) {
      m.addEventListener('click', function (e) { if (e.target === m) { m.classList.remove('is-open'); state.avatarBlob = null; } });
    });

    // 标签 - 添加
    document.querySelectorAll('[data-pick]').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-pick');
        if (key === 'currentStatus') openStatus();
        else openPick(key);
      });
    });
    // 标签 - 池子点击
    var pickList = document.getElementById('mp-pick-list');
    if (pickList) {
      pickList.addEventListener('click', function (e) {
        var t = e.target.closest('[data-pick-val]');
        if (t) togglePickVal(t.getAttribute('data-pick-val'));
      });
    }
    // 标签 - 确认
    var pickConfirm = document.querySelector('[data-pick-confirm]');
    if (pickConfirm) pickConfirm.addEventListener('click', confirmPick);

    // 状态 - 单选
    var statusList = document.getElementById('mp-status-list');
    if (statusList) {
      statusList.addEventListener('click', function (e) {
        var t = e.target.closest('[data-status-val]');
        if (t) pickStatus(t.getAttribute('data-status-val'));
      });
    }

    // 标签 - 移除
    document.querySelectorAll('[data-remove]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        removeTag(b.getAttribute('data-remove'), b.getAttribute('data-val'));
      });
    });

    // 头像文件
    var fileIn = document.getElementById('mp-avatar-file');
    if (fileIn) {
      fileIn.addEventListener('change', function (e) {
        handleAvatarFile(e.target.files && e.target.files[0]);
      });
    }
    var avRm = document.querySelector('[data-avatar-remove]');
    if (avRm) avRm.addEventListener('click', removeAvatar);
    var avCf = document.querySelector('[data-avatar-confirm]');
    if (avCf) avCf.addEventListener('click', confirmAvatar);

    // 教育
    document.querySelectorAll('[data-action="add-edu"]').forEach(function (b) {
      b.addEventListener('click', function () { openEduForm(null); });
    });
    document.querySelectorAll('[data-action="edit-edu"]').forEach(function (b) {
      b.addEventListener('click', function () { openEduForm(b.getAttribute('data-edu-id')); });
    });
    document.querySelectorAll('[data-action="del-edu"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-edu-id');
        if (confirm('确认删除这条教育经历？')) delEdu(id);
      });
    });
    var eduCf = document.querySelector('[data-edu-confirm]');
    if (eduCf) eduCf.addEventListener('click', confirmEdu);

    // 简历
    document.querySelectorAll('[data-action="resume-view"]').forEach(function (b) {
      b.addEventListener('click', resumeView);
    });
    document.querySelectorAll('[data-action="resume-edit"]').forEach(function (b) {
      b.addEventListener('click', resumeEdit);
    });
    document.querySelectorAll('[data-action="resume-create"]').forEach(function (b) {
      b.addEventListener('click', resumeCreate);
    });

    // 滚动监听：高亮侧边栏当前 section
    setupScrollSpy();

    // 键盘：ESC 关闭模态
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var open = document.querySelector('.mp-modal.is-open');
        if (open) { closeModal(open.id); state.avatarBlob = null; }
      }
    });

    // 头像模态：拖拽上传
    var dropZone = document.querySelector('.mp-avatar-modal .mp-upload');
    if (dropZone) {
      ['dragenter','dragover'].forEach(function (ev) {
        dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add('is-drag'); });
      });
      ['dragleave','drop'].forEach(function (ev) {
        dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.remove('is-drag'); });
      });
      dropZone.addEventListener('drop', function (e) {
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) handleAvatarFile(f);
      });
    }

    // 自定义标签输入：Enter 添加 / 退格删最后一个
    document.querySelectorAll('.mp-tag-input').forEach(function (inp) {
      inp.addEventListener('keydown', function (e) {
        var key = inp.getAttribute('data-tag-input');
        if (e.key === 'Enter') {
          e.preventDefault();
          var v = (inp.value || '').trim();
          if (!v) return;
          var arr = state.data.careerPreference[key] = state.data.careerPreference[key] || [];
          if (arr.indexOf(v) < 0) arr.push(v);
          saveAll(state.data);
          render();
          toast('已添加 · ' + v);
        } else if (e.key === 'Backspace' && !inp.value) {
          var arr2 = state.data.careerPreference[key] || [];
          if (arr2.length) { arr2.pop(); saveAll(state.data); render(); }
        }
      });
    });

    // 完成度小圆环：点击滚到第一个未完成项
    var chip = document.querySelector('.mp-completion-chip');
    if (chip) {
      chip.addEventListener('click', function () {
        var d = state.data;
        // 找第一个未完成的核心项
        var p = d.userProfile, cp = d.careerPreference, ed = d.education;
        if (!p.name || p.name === '—') return enterEdit();
        if (ed && ed.length && (!ed[0].school || !ed[0].major)) {
          var el = document.getElementById('mp-section-education');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (!cp.desiredJobs || !cp.desiredJobs.length) {
          var el2 = document.getElementById('mp-section-career');
          if (el2) el2.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        toast('资料已较完整，继续保持');
      });
    }

    // 滚动渐入：IntersectionObserver 给 .mp-rise 加 .is-revealed
    setupRevealObserver();
  }

  // -----------------------------------------------------
  // 滚动渐入观察
  // -----------------------------------------------------
  var revealObserver = null;
  function setupRevealObserver() {
    if (revealObserver) return;
    if (!('IntersectionObserver' in window)) {
      // 降级：直接显示
      document.querySelectorAll('.mp-rise').forEach(function (n) { n.classList.add('is-revealed'); });
      return;
    }
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-revealed');
          revealObserver.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    document.querySelectorAll('.mp-rise').forEach(function (n) { revealObserver.observe(n); });
  }

  // -----------------------------------------------------
  // 滚动监听
  // -----------------------------------------------------
  var scrollSpyT = null;
  function setupScrollSpy() {
    var sections = ['profile', 'education', 'career', 'resume']
      .map(function (id) { return document.getElementById('mp-section-' + id); })
      .filter(Boolean);
    if (!sections.length) return;
    function onScroll() {
      if (scrollSpyT) return;
      scrollSpyT = requestAnimationFrame(function () {
        scrollSpyT = null;
        // 用 getBoundingClientRect：避免在 layout reflow 期间读到旧 offsetTop
        var probe = 180; // 距视口顶部的"激活线"
        var cur = 'profile';
        for (var i = 0; i < sections.length; i++) {
          var rect = sections[i].getBoundingClientRect();
          if (rect.top - probe <= 0) cur = sections[i].id.replace('mp-section-', '');
        }
        if (cur !== state.section) {
          state.section = cur;
          document.querySelectorAll('.mp-nav-item').forEach(function (n) {
            n.classList.toggle('is-active', n.getAttribute('data-jump') === cur);
          });
        }
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // -----------------------------------------------------
  // 启动
  // -----------------------------------------------------
  function init() {
    tryInitApi();
    render();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露最小 API 以便外部探查
  window.MyProfile = {
    getData: function () { return JSON.parse(JSON.stringify(state.data)); },
    setResume: function (patch) { Object.assign(state.data.resume, patch); saveAll(state.data); render(); },
    refresh: render
  };
})();
