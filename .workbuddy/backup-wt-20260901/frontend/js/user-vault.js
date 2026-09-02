/* 执图破局 · 用户级本地仓（简历版本 / 收藏）—— 按登录用户隔离 */
(function (global) {
  'use strict';

  function currentUserId() {
    try {
      var u = JSON.parse(localStorage.getItem('zhitu_user') || 'null');
      if (u && (u.username || u.user_id || u.id)) return String(u.username || u.user_id || u.id);
    } catch (_) {}
    return 'guest';
  }

  function scoped(base) {
    return base + '__' + currentUserId();
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (_) {
      return false;
    }
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  var KEYS = {
    matchResume: 'zhitu_match_resume_v1',
    vaultResumes: 'zhitu_vault_resumes_v1',
    matchFavs: 'zhitu_match_favs_v1',
    newsFavs: 'jobnews_favs',
    newsMeta: 'jobnews_fav_meta',
    discFavs: 'zhitu_disc_favs',
    discMeta: 'zhitu_disc_fav_meta'
  };

  function matchResumeKey() { return scoped(KEYS.matchResume); }
  function vaultResumesKey() { return scoped(KEYS.vaultResumes); }
  function matchFavsKey() { return scoped(KEYS.matchFavs); }

  function emit(type, detail) {
    try {
      global.dispatchEvent(new CustomEvent('zhitu-vault-changed', { detail: Object.assign({ type: type }, detail || {}) }));
    } catch (_) {}
  }

  function sourceLabel(src) {
    if (src === 'resume-builder' || src === 'explore') return '简历探索 · 初稿';
    if (src === 'upload') return '自行上传';
    if (src === 'optimize' || src === 'match-edit') return '优化版本';
    if (src === 'import') return '导入';
    if (src === 'demo') return '演示简历';
    return src || '本地';
  }

  function activeVersion(item) {
    if (!item) return null;
    var vers = item.versions || [];
    if (!vers.length) {
      return {
        id: item.id,
        label: '初稿',
        source: item.source,
        createdAt: item.createdAt || item.updatedAt,
        sections: item.sections || [],
        text: item.text || '',
        fileName: item.fileName
      };
    }
    var cur = vers.find(function (v) { return v.id === item.currentVersionId; });
    return cur || vers[vers.length - 1];
  }

  function normalizeItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var created = raw.createdAt || raw.updatedAt || Date.now();
    var versions = Array.isArray(raw.versions) ? raw.versions.slice() : null;
    if (!versions || !versions.length) {
      versions = [{
        id: raw.currentVersionId || (raw.id + '-v1') || uid('ver'),
        label: raw.source === 'optimize' ? '优化稿' : '初稿',
        source: raw.source || 'resume-builder',
        createdAt: created,
        sections: raw.sections || [],
        text: raw.text || '',
        fileName: raw.fileName || raw.name || '简历.txt',
        parentVersionId: null
      }];
    }
    var curId = raw.currentVersionId || versions[versions.length - 1].id;
    var act = versions.find(function (v) { return v.id === curId; }) || versions[versions.length - 1];
    return {
      id: raw.id || uid('VR'),
      name: raw.name || act.fileName || '未命名简历',
      source: raw.source || act.source || 'resume-builder',
      createdAt: created,
      updatedAt: raw.updatedAt || act.createdAt || created,
      fileName: act.fileName || raw.fileName || '简历.txt',
      size: raw.size || (act.text ? act.text.length : 0),
      sections: act.sections || [],
      text: act.text || '',
      versions: versions,
      currentVersionId: curId
    };
  }

  function listVaultResumes() {
    var list = readJson(vaultResumesKey(), []);
    if (!Array.isArray(list)) list = [];
    return list.map(normalizeItem).filter(Boolean);
  }

  function writeVaultResumes(list) {
    writeJson(vaultResumesKey(), list);
    emit('resume');
  }

  function getVaultResume(id) {
    return listVaultResumes().find(function (r) { return String(r.id) === String(id); }) || null;
  }

  function earliestResume() {
    var list = listVaultResumes();
    if (!list.length) return null;
    return list.slice().sort(function (a, b) {
      return (a.createdAt || 0) - (b.createdAt || 0);
    })[0];
  }

  function toPayloadFromItem(item, version) {
    var v = version || activeVersion(item);
    return {
      id: item.id,
      versionId: v && v.id,
      source: (v && v.source) || item.source,
      updatedAt: item.updatedAt,
      createdAt: item.createdAt,
      fileName: (v && v.fileName) || item.fileName,
      size: item.size || 0,
      sections: (v && v.sections) || item.sections || [],
      text: (v && v.text) || item.text || '',
      versions: item.versions,
      currentVersionId: item.currentVersionId
    };
  }

  /* 新建 / 覆盖当前版本指针（非优化追加） */
  function upsertVaultResume(payload) {
    if (!payload) return null;
    var list = listVaultResumes();
    var now = Date.now();
    var id = payload.id || uid('VR');
    var idx = list.findIndex(function (r) { return r.id === id; });
    if (idx < 0 && payload.fileName && payload.source) {
      idx = list.findIndex(function (r) {
        return r.fileName === payload.fileName && r.source === payload.source && !(payload.asNewVersion);
      });
    }

    if (payload.asNewVersion && (payload.baseId || payload.parentId || idx >= 0)) {
      return addOptimizedVersion(payload.baseId || payload.parentId || id, payload);
    }

    var ver = {
      id: payload.versionId || uid('ver'),
      label: payload.versionLabel || (payload.source === 'upload' ? '上传稿' : '初稿'),
      source: payload.source || 'resume-builder',
      createdAt: payload.createdAt || now,
      sections: payload.sections || [],
      text: payload.text || '',
      fileName: payload.fileName || '简历.txt',
      parentVersionId: null
    };

    if (idx >= 0) {
      var old = list[idx];
      // 同族更新：若明确要求覆盖当前版本内容，则改当前版本；否则保持版本列表并更新当前指针内容为新初稿替换
      var versions = (old.versions || []).slice();
      if (!versions.length) versions = [ver];
      else {
        // 探索再生成：追加一版「新初稿」并切过去
        if (payload.source === 'resume-builder' || payload.source === 'explore') {
          ver.label = '探索初稿';
          versions.push(ver);
        } else {
          var cur = versions.find(function (v) { return v.id === old.currentVersionId; }) || versions[versions.length - 1];
          Object.assign(cur, {
            sections: ver.sections,
            text: ver.text,
            fileName: ver.fileName,
            source: ver.source,
            createdAt: cur.createdAt || ver.createdAt
          });
          ver = cur;
        }
      }
      list[idx] = normalizeItem({
        id: old.id,
        name: payload.fileName || old.name,
        source: old.source || payload.source,
        createdAt: old.createdAt || now,
        updatedAt: now,
        fileName: ver.fileName,
        size: payload.size || (ver.text && ver.text.length) || 0,
        sections: ver.sections,
        text: ver.text,
        versions: versions,
        currentVersionId: ver.id
      });
    } else {
      list.unshift(normalizeItem({
        id: id,
        name: payload.fileName || '未命名简历',
        source: payload.source || 'resume-builder',
        createdAt: payload.createdAt || now,
        updatedAt: now,
        fileName: ver.fileName,
        size: payload.size || (ver.text && ver.text.length) || 0,
        sections: ver.sections,
        text: ver.text,
        versions: [ver],
        currentVersionId: ver.id
      }));
    }
    if (list.length > 40) list = list.slice(0, 40);
    writeVaultResumes(list);
    return list.find(function (r) { return r.id === id; }) || list[0];
  }

  /* 基于原简历追加优化版本（历史保留） */
  function addOptimizedVersion(baseId, payload) {
    var list = listVaultResumes();
    var idx = list.findIndex(function (r) { return String(r.id) === String(baseId); });
    var now = Date.now();
    if (idx < 0) {
      payload = Object.assign({}, payload, { id: baseId || uid('VR'), source: payload.source || 'optimize', asNewVersion: false });
      delete payload.asNewVersion;
      return upsertVaultResume(payload);
    }
    var item = list[idx];
    var versions = (item.versions || []).slice();
    var parent = activeVersion(item);
    var n = versions.filter(function (v) { return v.source === 'optimize' || v.source === 'match-edit'; }).length + 1;
    var ver = {
      id: payload.versionId || uid('ver'),
      label: payload.versionLabel || ('优化 v' + n),
      source: payload.source || 'optimize',
      createdAt: now,
      sections: payload.sections || [],
      text: payload.text || '',
      fileName: payload.fileName || item.fileName,
      parentVersionId: parent && parent.id
    };
    versions.push(ver);
    list[idx] = normalizeItem({
      id: item.id,
      name: item.name,
      source: item.source,
      createdAt: item.createdAt,
      updatedAt: now,
      fileName: ver.fileName,
      size: payload.size || (ver.text && ver.text.length) || 0,
      sections: ver.sections,
      text: ver.text,
      versions: versions,
      currentVersionId: ver.id
    });
    writeVaultResumes(list);
    return list[idx];
  }

  function setCurrentVersion(resumeId, versionId) {
    var list = listVaultResumes();
    var idx = list.findIndex(function (r) { return String(r.id) === String(resumeId); });
    if (idx < 0) return null;
    var item = list[idx];
    var ver = (item.versions || []).find(function (v) { return String(v.id) === String(versionId); });
    if (!ver) return null;
    list[idx] = normalizeItem(Object.assign({}, item, {
      currentVersionId: ver.id,
      sections: ver.sections,
      text: ver.text,
      fileName: ver.fileName || item.fileName,
      updatedAt: Date.now()
    }));
    writeVaultResumes(list);
    return list[idx];
  }

  function removeVaultResume(id) {
    var list = listVaultResumes().filter(function (r) { return r.id !== String(id); });
    writeVaultResumes(list);
  }

  function removeResumeVersion(resumeId, versionId) {
    var list = listVaultResumes();
    var idx = list.findIndex(function (r) { return String(r.id) === String(resumeId); });
    if (idx < 0) return;
    var item = list[idx];
    var versions = (item.versions || []).filter(function (v) { return String(v.id) !== String(versionId); });
    if (!versions.length) {
      list.splice(idx, 1);
    } else {
      var cur = versions.find(function (v) { return v.id === item.currentVersionId; }) || versions[versions.length - 1];
      list[idx] = normalizeItem(Object.assign({}, item, {
        versions: versions,
        currentVersionId: cur.id,
        sections: cur.sections,
        text: cur.text,
        updatedAt: Date.now()
      }));
    }
    writeVaultResumes(list);
  }

  /* ---- 匹配用当前简历 ---- */
  function loadMatchResume() {
    var v = readJson(matchResumeKey(), null);
    if (v) return v;
    return readJson(KEYS.matchResume, null);
  }

  function saveMatchResume(payload) {
    if (!payload) return false;
    payload.updatedAt = Date.now();
    payload.userId = currentUserId();
    writeJson(matchResumeKey(), payload);
    writeJson(KEYS.matchResume, payload);
    if ((payload.asNewVersion || payload.source === 'optimize') && payload.baseId) {
      addOptimizedVersion(payload.baseId, payload);
    } else {
      upsertVaultResume(payload);
    }
    return true;
  }

  /* ---- 人岗匹配收藏 ---- */
  function loadMatchFavs() {
    var map = readJson(matchFavsKey(), {});
    return map && typeof map === 'object' ? map : {};
  }

  function saveMatchFavs(map) {
    writeJson(matchFavsKey(), map || {});
    emit('match-fav');
  }

  function toggleMatchFav(job) {
    if (!job || !job.id) return false;
    var map = loadMatchFavs();
    var id = String(job.id);
    if (map[id]) {
      delete map[id];
      saveMatchFavs(map);
      return false;
    }
    map[id] = {
      id: id,
      title: job.title || job.name || '收藏岗位',
      company: job.company || job.company_name || '',
      city: job.city || '',
      salary: job.salary || job.salary_range || '',
      match: job.match_score || job.score || null,
      savedAt: Date.now(),
      source: 'match'
    };
    saveMatchFavs(map);
    return true;
  }

  function listNewsFavs() {
    var scopedList = readJson(scoped(KEYS.newsFavs), null);
    var list = Array.isArray(scopedList) ? scopedList : readJson(KEYS.newsFavs, []);
    if (!Array.isArray(list)) list = [];
    var meta = readJson(KEYS.newsMeta, {}) || {};
    return list.map(function (id) {
      var m = meta[String(id)] || {};
      return {
        id: String(id),
        title: m.title || ('新闻收藏 #' + id),
        source: 'news',
        savedAt: m.savedAt || 0,
        href: 'news/detail.html?id=' + encodeURIComponent(id)
      };
    });
  }

  function listDiscoveryFavs() {
    var ids = readJson(KEYS.discFavs, []);
    if (!Array.isArray(ids)) ids = [];
    var meta = readJson(KEYS.discMeta, {}) || {};
    return ids.map(function (id) {
      var m = meta[String(id)] || {};
      var lane = m.lane === 'forecast' ? 'discovery-forecast' : 'discovery';
      return {
        id: String(id),
        title: m.title || '发现岗位',
        lane: m.lane || 'found',
        conf: m.conf || 0,
        source: lane,
        href: 'discovery-detail.html?id=' + encodeURIComponent(id)
      };
    });
  }

  function listMatchFavItems() {
    var map = loadMatchFavs();
    return Object.keys(map).map(function (k) {
      var j = map[k];
      return {
        id: j.id,
        title: j.title,
        company: j.company,
        city: j.city,
        salary: j.salary,
        match: j.match,
        savedAt: j.savedAt,
        source: 'match',
        href: 'match.html?v=vault&job=' + encodeURIComponent(j.id)
      };
    }).sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
  }

  function snapshot() {
    return {
      userId: currentUserId(),
      resumes: listVaultResumes(),
      favs: {
        news: listNewsFavs(),
        discovery: listDiscoveryFavs().filter(function (x) { return x.lane !== 'forecast'; }),
        forecast: listDiscoveryFavs().filter(function (x) { return x.lane === 'forecast'; }),
        match: listMatchFavItems()
      }
    };
  }

  function mkDemo(id, name, source, createdAt, sections, optVersions) {
    var text = sections.map(function (s) { return '【' + s.label + '】\n' + s.content; }).join('\n\n');
    var v1 = {
      id: id + '-v1',
      label: source === 'upload' ? '上传稿' : '初稿',
      source: source,
      createdAt: createdAt,
      sections: sections,
      text: text,
      fileName: name,
      parentVersionId: null
    };
    var versions = [v1];
    var cur = v1;
    if (optVersions && optVersions.length) {
      optVersions.forEach(function (ov, i) {
        var sec = ov.sections || sections;
        var t = sec.map(function (s) { return '【' + s.label + '】\n' + s.content; }).join('\n\n');
        var ver = {
          id: id + '-v' + (i + 2),
          label: ov.label || ('优化 v' + (i + 1)),
          source: 'optimize',
          createdAt: createdAt + (i + 1) * 3600000,
          sections: sec,
          text: t,
          fileName: name,
          parentVersionId: versions[versions.length - 1].id
        };
        versions.push(ver);
        cur = ver;
      });
    }
    return normalizeItem({
      id: id,
      name: name,
      source: source,
      createdAt: createdAt,
      updatedAt: cur.createdAt,
      fileName: name,
      size: cur.text.length,
      sections: cur.sections,
      text: cur.text,
      versions: versions,
      currentVersionId: cur.id
    });
  }

  /* 演示用测试简历（每人仓只种一次） */
  function ensureDemoResumes() {
    var flagKey = scoped('zhitu_vault_demo_seeded_v2');
    if (localStorage.getItem(flagKey) === '1') {
      // 仍保证 Java 演示稿存在
      if (getVaultResume('VR-demo-java')) return listVaultResumes();
    }
    var list = listVaultResumes();
    var byId = {};
    list.forEach(function (r) { byId[r.id] = r; });
    var now = Date.now();
    var demos = [
      mkDemo('VR-demo-java', '张三_Java后端开发.txt', 'demo', now - 86400000 * 5, [
        { id: 'basic', label: '个人信息', content: '张三\nJava 后端开发工程师\n电话：138-0000-0000\n邮箱：zhangsan@example.com', ai_suggestion: '' },
        { id: 'education', label: '教育经历', content: '某大学 · 计算机科学与技术 · 本科\n2019.09 - 2023.06', ai_suggestion: '' },
        { id: 'projects', label: '项目经历', content: '1. Java 高并发订单系统：主导核心交易链路，响应下降 40%，日均 500w+。\n2. Spring Boot 营销平台：独立搭建活动配置与发放服务。\n3. MySQL 慢查询优化专项：QPS 提升 3 倍。', ai_suggestion: '' },
        { id: 'work', label: '工作经历', content: '暂无正式工作经历', ai_suggestion: '' },
        { id: 'skills', label: '专业技能', content: 'Java（精通）、Spring Boot（熟练）、MySQL（熟练）、Redis（了解）、系统设计（熟悉）', ai_suggestion: '' },
        { id: 'summary', label: '自我评价', content: '3 年 Java 后端开发经验，工程基础扎实，希望在容器化、微服务方向进一步深入。', ai_suggestion: '' }
      ], [{
        label: 'AI 优化 · 个人信息',
        sections: [
          { id: 'basic', label: '个人信息', content: '张三\nJava 后端开发工程师（杭州 / 期望 25-35K）\n电话：138-0000-0000\n邮箱：zhangsan.dev@gmail.com', ai_suggestion: '' },
          { id: 'education', label: '教育经历', content: '某大学 · 计算机科学与技术 · 本科\n2019.09 - 2023.06', ai_suggestion: '' },
          { id: 'projects', label: '项目经历', content: '1. Java 高并发订单系统：主导核心交易链路，响应下降 40%，日均 500w+。\n2. Spring Boot 营销平台：独立搭建活动配置与发放服务。\n3. MySQL 慢查询优化专项：QPS 提升 3 倍。', ai_suggestion: '' },
          { id: 'work', label: '工作经历', content: '暂无正式工作经历', ai_suggestion: '' },
          { id: 'skills', label: '专业技能', content: 'Java（精通）、Spring Boot（熟练）、MySQL（熟练）、Redis（了解）、系统设计（熟悉）', ai_suggestion: '' },
          { id: 'summary', label: '自我评价', content: '3 年 Java 后端开发经验，工程基础扎实，希望在容器化、微服务方向进一步深入。', ai_suggestion: '' }
        ]
      }]),
      mkDemo('VR-demo-fe', '李四_前端开发.txt', 'resume-builder', now - 86400000 * 3, [
        { id: 'basic', label: '个人信息', content: '李四\n前端开发工程师\n电话：139-1111-2222\n邮箱：lisi@example.com', ai_suggestion: '' },
        { id: 'education', label: '教育经历', content: '某高校 · 软件工程 · 本科\n2020.09 - 2024.06', ai_suggestion: '' },
        { id: 'projects', label: '项目经历', content: '1. 数据看板：React + ECharts，首屏 1.2s。\n2. 组件库：封装 20+ 业务组件，覆盖 3 条产品线。', ai_suggestion: '' },
        { id: 'work', label: '工作经历', content: '某互联网公司 · 前端实习 · 2023.07-2023.12', ai_suggestion: '' },
        { id: 'skills', label: '专业技能', content: 'JavaScript、TypeScript、React、Vue、CSS', ai_suggestion: '' },
        { id: 'summary', label: '自我评价', content: '关注体验与工程化，熟悉中后台与可视化场景。', ai_suggestion: '' }
      ]),
      mkDemo('VR-demo-data', '王五_数据分析.txt', 'upload', now - 86400000 * 2, [
        { id: 'basic', label: '个人信息', content: '王五\n数据分析师\n电话：137-3333-4444', ai_suggestion: '' },
        { id: 'education', label: '教育经历', content: '某大学 · 统计学 · 硕士', ai_suggestion: '' },
        { id: 'projects', label: '项目经历', content: '用户增长漏斗分析：定位流失节点，转化 +12%。', ai_suggestion: '' },
        { id: 'work', label: '工作经历', content: '某零售集团 · 数据分析 · 2022-至今', ai_suggestion: '' },
        { id: 'skills', label: '专业技能', content: 'SQL、Python、Tableau、A/B Test', ai_suggestion: '' },
        { id: 'summary', label: '自我评价', content: '擅长用数据讲故事，推动业务决策。', ai_suggestion: '' }
      ]),
      mkDemo('VR-demo-ai', '赵六_AI应用.txt', 'resume-builder', now - 86400000, [
        { id: 'basic', label: '个人信息', content: '赵六\nAI 应用开发工程师\n电话：136-5555-6666', ai_suggestion: '' },
        { id: 'education', label: '教育经历', content: '某高校 · 人工智能 · 本科', ai_suggestion: '' },
        { id: 'projects', label: '项目经历', content: 'RAG 知识库助手：召回准确率 86%，客服人效 +30%。', ai_suggestion: '' },
        { id: 'work', label: '工作经历', content: '暂无正式工作经历', ai_suggestion: '' },
        { id: 'skills', label: '专业技能', content: 'Python、LangChain、Prompt、FastAPI', ai_suggestion: '' },
        { id: 'summary', label: '自我评价', content: '关注 LLM 落地与评测闭环。', ai_suggestion: '' }
      ])
    ];
    demos.forEach(function (d) {
      if (!byId[d.id]) list.push(d);
      else {
        // 刷新演示稿内容，保留用户其它简历
        var i = list.findIndex(function (x) { return x.id === d.id; });
        if (i >= 0) list[i] = d;
      }
    });
    // 按创建时间升序展示时，演示稿靠前；存储仍按 updated 写入
    writeVaultResumes(list);
    try { localStorage.setItem(flagKey, '1'); } catch (_) {}
    return list;
  }

  global.ZhituVault = {
    currentUserId: currentUserId,
    scoped: scoped,
    sourceLabel: sourceLabel,
    activeVersion: activeVersion,
    loadMatchResume: loadMatchResume,
    saveMatchResume: saveMatchResume,
    listVaultResumes: listVaultResumes,
    getVaultResume: getVaultResume,
    earliestResume: earliestResume,
    upsertVaultResume: upsertVaultResume,
    addOptimizedVersion: addOptimizedVersion,
    setCurrentVersion: setCurrentVersion,
    removeVaultResume: removeVaultResume,
    removeResumeVersion: removeResumeVersion,
    toPayloadFromItem: toPayloadFromItem,
    ensureDemoResumes: ensureDemoResumes,
    loadMatchFavs: loadMatchFavs,
    saveMatchFavs: saveMatchFavs,
    toggleMatchFav: toggleMatchFav,
    listNewsFavs: listNewsFavs,
    listDiscoveryFavs: listDiscoveryFavs,
    listMatchFavItems: listMatchFavItems,
    snapshot: snapshot,
    KEYS: KEYS
  };
})(window);
