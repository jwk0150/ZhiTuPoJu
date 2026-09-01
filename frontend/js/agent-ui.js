/* Global Agent UI (Phase 5)
 * 全局 AI 操作层：右下角悬浮入口 → 大型浮层工作台。
 * - POST /tasks 创建任务（后台执行）
 * - GET /tasks/{id}/stream（fetch 流式 SSE，自动携带 Bearer Token）
 * - HITL 确认 / 取消 / 最近对话 / 证据抽屉
 * 不保存 CoT；证据与引用全部来自后端事件。
 */
(function () {
  if (window.__AgentUI) return;

  var BASE = assetBase();
  injectCss();

  function assetBase() {
    var p = String(location.pathname || '').replace(/\\/g, '/');
    if (/\/pages\/(more|news)\//.test(p)) return '../../';
    if (/\/pages\//.test(p)) return '../';
    return '';
  }

  function injectCss() {
    if (document.getElementById('agent-ui-css')) return;
    var link = document.createElement('link');
    link.id = 'agent-ui-css';
    link.rel = 'stylesheet';
    link.href = BASE + 'css/agent-ui.css';
    document.head.appendChild(link);
  }

  var TOOL_TITLES = {
    'context.get_current': '读取职业画像',
    'job.search': '搜索岗位',
    'job.recall': '召回候选岗位',
    'job.get': '获取岗位详情',
    'match.analyze': '人岗匹配分析',
    'match.skill_gap': '分析技能差距',
    'match.learning_path': '生成学习路径',
    'match.what_if': 'What-if 模拟',
    'resume.get_text': '读取简历',
    'resume.analyze': '简历分析',
    'resume.optimize': '简历优化建议',
    'skill.get_user': '读取能力问卷',
    'skill.catalog': '读取技术目录',
    'career.evolution': '能力演化分析',
    'career.snapshot': '能力快照',
    'career.forecast': '趋势预测',
    'discovery.scan': '扫描新岗位',
    'knowledge.search': '检索知识库',
    'knowledge.ask': '知识库问答'
  };
  function toolTitle(name) { return TOOL_TITLES[name] || (name || '步骤'); }

  var S = {
    taskId: null,
    conversationId: null,
    streaming: false,
    abort: null,
    steps: {},
    evidence: {},
    openTaskId: null
  };

  /* ---------- DOM ---------- */
  function ensureUi() {
    if (document.getElementById('agent-ui-root')) return;
    var root = document.createElement('div');
    root.id = 'agent-ui-root';
    root.innerHTML =
      '<button type="button" class="agent-fab" id="agent-fab" aria-label="打开 Global AI">' +
        '<span class="agent-fab-orb"></span><span>AI</span>' +
      '</button>' +
      '<div class="agent-mask" id="agent-mask" hidden></div>' +
      '<div class="agent-shell" id="agent-shell" aria-hidden="true">' +
        '<header class="agent-head">' +
          '<div class="agent-head-title"><b>Global AI</b><small>职业发展系统操作层</small></div>' +
          '<div class="agent-head-actions">' +
            '<button type="button" class="agent-icon-btn" id="agent-new" title="新对话">＋</button>' +
            '<button type="button" class="agent-icon-btn" id="agent-close" title="关闭">×</button>' +
          '</div>' +
        '</header>' +
        '<div class="agent-body">' +
          '<aside class="agent-side">' +
            '<div class="agent-side-title">最近对话</div>' +
            '<div class="agent-side-list" id="agent-conv-list"></div>' +
          '</aside>' +
          '<section class="agent-main">' +
            '<div class="agent-chat" id="agent-chat"></div>' +
            '<div class="agent-dock" id="agent-dock" hidden></div>' +
            '<form class="agent-input" id="agent-input">' +
              '<textarea id="agent-text" rows="1" placeholder="输入你的需求，例如：帮我找适合我的 AI 产品经理岗位并分析差距…"></textarea>' +
              '<div class="agent-input-actions">' +
                '<button type="button" class="agent-btn agent-btn-stop" id="agent-stop" hidden>停止</button>' +
                '<button type="submit" class="agent-btn agent-btn-send" id="agent-send">发送</button>' +
              '</div>' +
            '</form>' +
          '</section>' +
        '</div>' +
        '<aside class="agent-drawer" id="agent-drawer" aria-hidden="true">' +
          '<div class="agent-drawer-head"><b>证据</b>' +
            '<button type="button" class="agent-icon-btn" id="agent-drawer-close">×</button></div>' +
          '<div class="agent-drawer-body" id="agent-drawer-body"></div>' +
        '</aside>' +
        '<div class="agent-hitl" id="agent-hitl" hidden>' +
          '<div class="agent-hitl-card">' +
            '<div class="agent-hitl-title">需要你的确认</div>' +
            '<div class="agent-hitl-msg" id="agent-hitl-msg"></div>' +
            '<div class="agent-hitl-actions">' +
              '<button type="button" class="agent-btn agent-btn-ghost" id="agent-hitl-no">取消</button>' +
              '<button type="button" class="agent-btn agent-btn-primary" id="agent-hitl-yes">确认执行</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);
    bind();
  }

  function bind() {
    var fab = document.getElementById('agent-fab');
    var mask = document.getElementById('agent-mask');
    var shell = document.getElementById('agent-shell');
    var closeBtn = document.getElementById('agent-close');
    var newBtn = document.getElementById('agent-new');

    function setOpen(open) {
      shell.classList.toggle('is-open', open);
      shell.setAttribute('aria-hidden', open ? 'false' : 'true');
      mask.hidden = !open;
      fab.classList.toggle('is-hidden', open);
      if (open) loadConversations();
    }
    fab.addEventListener('click', function () {
      if (!window.zhituGetToken || !window.zhituGetToken()) {
        // 本地开发环境：自动用开发账号登录，不再要求手动登录
        devAutoLogin().then(function (ok) {
          if (ok) setOpen(true);
          else if (window.showToast) window.showToast('请先登录', 'amber');
        });
        return;
      }
      setOpen(true);
    });
    closeBtn.addEventListener('click', function () { setOpen(false); });
    mask.addEventListener('click', function () { setOpen(false); });
    newBtn.addEventListener('click', function () {
      stopStream();
      S.taskId = null; S.steps = {}; S.evidence = {};
      document.getElementById('agent-chat').innerHTML = '';
      hideDock(); hideHitl();
    });

    document.getElementById('agent-input').addEventListener('submit', function (e) {
      e.preventDefault();
      var text = document.getElementById('agent-text').value.trim();
      if (!text || S.streaming) return;
      document.getElementById('agent-text').value = '';
      sendMessage(text);
    });
    document.getElementById('agent-stop').addEventListener('click', function () {
      cancelTask();
    });
    document.getElementById('agent-drawer-close').addEventListener('click', function () {
      document.getElementById('agent-drawer').classList.remove('is-open');
    });
    document.getElementById('agent-hitl-no').addEventListener('click', function () { confirmHITL(false); });
    document.getElementById('agent-hitl-yes').addEventListener('click', function () { confirmHITL(true); });
  }

  /* ---------- 发送 / SSE ---------- */
  function sendMessage(text) {
    addBubble('user', text);
    hideHitl();
    S.steps = {}; S.evidence = {};
    var payload = { message: text, page: currentPage(), tab: currentTab() };
    api('/api/global-agent/tasks', { method: 'POST', body: JSON.stringify(payload) })
      .then(function (res) {
        var data = res.data || {};
        S.taskId = data.task_id;
        S.conversationId = data.conversation_id;
        showStop(true);
        var dock = ensureDock();
        dock.innerHTML = '<div class="agent-reasoning agent-reasoning-idle">正在启动任务…</div>';
        addAssistantBubble('开始执行任务…', data.task_id);
        return streamTask(S.taskId);
      })
      .catch(function (err) {
        addBubble('system', '任务创建失败：' + (err && err.message ? err.message : err));
        showStop(false);
      });
  }

  function streamTask(taskId) {
    S.streaming = true;
    var attempts = 0;
    var MAX_ATTEMPTS = 3;
    function connect() {
      if (!S.streaming) return Promise.resolve();
      attempts += 1;
      var url = (window.API_BASE || '') + '/api/global-agent/tasks/' + taskId + '/stream';
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      S.abort = ctrl;
      return fetch(url, {
        headers: { Authorization: 'Bearer ' + (window.zhituGetToken ? window.zhituGetToken() : '') },
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        if (!res.ok || !res.body) { throw new Error('HTTP ' + res.status); }
        var reader = res.body.getReader();
        var dec = new TextDecoder();
        var buf = '';
        function pump() {
          if (!S.streaming) return Promise.resolve();
          return reader.read().then(function (r) {
            if (r.done) return;
            buf += dec.decode(r.value, { stream: true });
                      var i;
                      while ((i = buf.indexOf('\n\n')) >= 0) {
                        var block = buf.slice(0, i); buf = buf.slice(i + 2);
                        var ev = parseBlock(block);
                        if (ev) {
                          try { handleEvent(ev); }
                          catch (e) { console.error('[agent handler error]', ev.event, e); }
                        }
                      }
                      return pump();
          });
        }
        return pump();
      }).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        if (!S.streaming) return;
        if (attempts >= MAX_ATTEMPTS) {
          addBubble('system', '连接中断：' + (err && err.message ? err.message : '未知错误') + '，任务结果可通过「最近对话」查看。');
          return;
        }
        addBubble('system', '连接中断，正在重连（' + attempts + '/' + MAX_ATTEMPTS + '）…');
        return new Promise(function (resolve) { setTimeout(resolve, 1500); }).then(connect);
      });
    }
    return connect().then(function () {
      S.streaming = false;
      if (S.abort) { try { S.abort.abort(); } catch (_) {} S.abort = null; }
      showStop(false);
      hideDock();
    });
  }

  function stopStream() {
    S.streaming = false;
    if (S.abort) { try { S.abort.abort(); } catch (_) {} S.abort = null; }
    showStop(false);
  }

  function parseBlock(block) {
    var event = 'message', data = '';
    block.split('\n').forEach(function (line) {
      if (line.indexOf('event:') === 0) event = line.slice(6).trim();
      else if (line.indexOf('data:') === 0) data += line.slice(5).trim();
    });
    if (!data) return null;
    try { return { event: event, data: JSON.parse(data) }; }
    catch (_) { return null; }
  }

  /* ---------- 事件处理 ---------- */
  function handleEvent(ev) {
    var d = ev.data || {};
    switch (ev.event) {
      case 'task.started': onTaskStarted(d); break;
      case 'step.started': onStepStarted(d); break;
      case 'step.completed': onStepCompleted(d); break;
      case 'tool.completed': onToolCompleted(d); break;
      case 'reasoning': onReasoning(d); break;
      case 'evidence': onEvidence(d); break;
      case 'waiting_confirmation': onWaitingConfirmation(d); break;
      case 'task.completed': onTaskCompleted(d); break;
      case 'task.failed': onTaskFailed(d); break;
      case 'task.cancelled': onTaskCancelled(d); break;
      default: break;
    }
  }

  function onTaskStarted(d) {
    S.taskId = d.task_id || S.taskId;
    renderProgress(d);
  }
  function onStepStarted(d) {
    var idx = d.step_index;
    S.steps[idx] = { tool: d.tool_name, status: 'running' };
    renderProgress();
    setAssistantHint(toolTitle(d.tool_name));
  }
  function onStepCompleted(d) {
    var idx = d.step_index;
    if (S.steps[idx]) S.steps[idx].status = d.status || 'completed';
    renderProgress();
  }
  function onToolCompleted(d) {
    // 状态由 step.completed 驱动；这里仅更新 dock 摘要
  }
  function onReasoning(d) {
    var dock = ensureDock();
    var line = document.createElement('div');
    line.className = 'agent-reasoning';
    line.innerHTML = '<span class="agent-reasoning-dot"></span>' + esc(d.summary || '');
    dock.appendChild(line);
    dock.scrollTop = dock.scrollHeight;
  }
  function onEvidence(d) {
    if (!d.evidence_id) return;
    S.evidence[d.evidence_id] = d;
    var chips = document.getElementById('agent-evidence-chips');
    if (!chips) {
      chips = document.createElement('div');
      chips.id = 'agent-evidence-chips';
      chips.className = 'agent-evidence-chips';
      var dock = document.getElementById('agent-dock');
      if (dock) dock.appendChild(chips);
    }
    var n = Object.keys(S.evidence).length;
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'agent-ev-chip';
    chip.textContent = '依据 ' + n;
    chip.addEventListener('click', function () { openEvidence(d.evidence_id); });
    chips.appendChild(chip);
  }
  function onWaitingConfirmation(d) {
    showStop(false);
    var hitl = document.getElementById('agent-hitl');
    document.getElementById('agent-hitl-msg').textContent = d.message || '是否继续执行？';
    hitl.hidden = false;
    addBubble('system', '任务已暂停，等待你的确认。');
  }
  function onTaskCompleted(d) {
    showStop(false);
    finishAssistant(d.result && d.result.message ? d.result.message : '任务已完成。');
    renderProgressDone();
    hideHitl(); hideDock();
    loadConversations();
  }
  function onTaskFailed(d) {
    showStop(false);
    addBubble('system', '任务失败：' + esc(d.error || '未知原因'));
    hideHitl(); hideDock();
    loadConversations();
  }
  function onTaskCancelled(d) {
    showStop(false);
    addBubble('system', '任务已取消。');
    hideHitl(); hideDock();
    loadConversations();
  }

  function renderProgress(d) {
    var dock = ensureDock();
    var list = document.getElementById('agent-progress');
    if (!list) {
      list = document.createElement('div');
      list.id = 'agent-progress';
      list.className = 'agent-progress';
      dock.insertBefore(list, dock.firstChild);
    }
    list.innerHTML = '';
    var indices = Object.keys(S.steps).map(Number).sort(function (a, b) { return a - b; });
    if (!indices.length) {
      list.innerHTML = '<div class="agent-progress-empty">' + (d && d.intent ? '意图：' + esc(d.intent) : '任务启动中') + '</div>';
      return;
    }
    indices.forEach(function (idx) {
      var s = S.steps[idx];
      var row = document.createElement('div');
      row.className = 'agent-progress-item is-' + ((s && s.status) || 'pending');
      row.innerHTML = '<span class="agent-progress-dot"></span><span class="agent-progress-name">' + esc(toolTitle(s && s.tool)) + '</span>';
      list.appendChild(row);
    });
    dock.scrollTop = dock.scrollHeight;
  }
  function renderProgressDone() {
    Object.keys(S.steps).forEach(function (k) { S.steps[k].status = 'completed'; });
    renderProgress();
  }

  /* ---------- 对话渲染 ---------- */
  function addBubble(role, text) {
    var chat = document.getElementById('agent-chat');
    var b = document.createElement('div');
    b.className = 'agent-msg is-' + role;
    b.innerHTML = '<div class="agent-msg-label">' + (role === 'user' ? '你' : role === 'system' ? '系统' : 'Global AI') + '</div>' +
      '<div class="agent-msg-body">' + (typeof text === 'string' ? esc(text) : text) + '</div>';
    chat.appendChild(b);
    chat.scrollTop = chat.scrollHeight;
  }
  function addAssistantBubble(text, taskId) {
    var el = document.createElement('div');
    el.className = 'agent-msg is-assistant';
    el.innerHTML = '<div class="agent-msg-label">Global AI</div>' +
      '<div class="agent-msg-body"><div class="agent-msg-text">' + esc(text) + '</div></div>';
    if (taskId) {
      el.setAttribute('data-task', taskId);
    }
    document.getElementById('agent-chat').appendChild(el);
    document.getElementById('agent-chat').scrollTop = document.getElementById('agent-chat').scrollHeight;
    return el;
  }
  function setAssistantHint(text) {
    var msgs = document.getElementById('agent-chat').querySelectorAll('.agent-msg.is-assistant');
    var last = msgs[msgs.length - 1];
    if (!last) return;
    var t = last.querySelector('.agent-msg-text');
    if (t) t.textContent = text;
  }
  function finishAssistant(text) {
    var msgs = document.getElementById('agent-chat').querySelectorAll('.agent-msg.is-assistant');
    var last = msgs[msgs.length - 1];
    if (!last) return;
    var t = last.querySelector('.agent-msg-text');
    if (t) t.textContent = text;
  }

  /* ---------- Dock / Progress ---------- */
  function ensureDock() {
    var dock = document.getElementById('agent-dock');
    if (dock) { dock.hidden = false; return dock; }
    dock = document.createElement('div');
    dock.id = 'agent-dock';
    document.getElementById('agent-chat').appendChild(dock);
    return dock;
  }
  function hideDock() {
    var dock = document.getElementById('agent-dock');
    if (dock) dock.hidden = true;
  }

  /* ---------- HITL ---------- */
  function confirmHITL(approved) {
    if (!S.taskId) return;
    hideHitl();
    api('/api/global-agent/tasks/' + S.taskId + '/confirm', {
      method: 'POST', body: JSON.stringify({ approved: approved })
    }).catch(function (err) {
      addBubble('system', '确认请求失败：' + (err && err.message ? err.message : err));
    });
  }
  function hideHitl() { document.getElementById('agent-hitl').hidden = true; }

  function cancelTask() {
    if (!S.taskId) { stopStream(); return; }
    api('/api/global-agent/tasks/' + S.taskId + '/cancel', { method: 'POST' })
      .catch(function (err) { addBubble('system', '取消失败：' + (err && err.message ? err.message : err)); });
    addBubble('system', '正在停止任务…');
  }

  function showStop(show) {
    document.getElementById('agent-stop').hidden = !show;
    document.getElementById('agent-send').disabled = show;
  }

  /* ---------- Evidence Drawer ---------- */
  function openEvidence(eid) {
    var e = S.evidence[eid];
    if (!e) return;
    var body = document.getElementById('agent-drawer-body');
    var pct = e.relevance != null ? Math.round(Number(e.relevance) * 100) + '%' : '—';
    body.innerHTML =
      '<div class="agent-ev-head">' + esc(e.type || '证据') + '</div>' +
      (e.title ? '<div class="agent-ev-title">' + esc(e.title) + '</div>' : '') +
      '<div class="agent-ev-label">来源</div><div class="agent-ev-row">' + esc(e.source_name || '—') + '</div>' +
      '<div class="agent-ev-label">原始内容</div><div class="agent-ev-content">' + esc(e.content || '—') + '</div>' +
      '<div class="agent-ev-grid">' +
        '<div><div class="agent-ev-label">相关度</div><div>' + pct + '</div></div>' +
        '<div><div class="agent-ev-label">置信度</div><div>' + esc(e.confidence || '—') + '</div></div>' +
        '<div><div class="agent-ev-label">数据来源</div><div>' + (e.is_demo ? '演示/预测数据' : '数据库 / 真实数据') + '</div></div>' +
      '</div>' +
      (e.source_url ? '<a class="agent-ev-link" href="' + esc(e.source_url) + '" target="_blank" rel="noopener">查看原始来源 ↗</a>' : '') +
      '<div class="agent-ev-label">证据 ID</div><div class="agent-ev-id">' + esc(eid) + '</div>';
    document.getElementById('agent-drawer').classList.add('is-open');
  }

  /* ---------- Conversation ---------- */
  function loadConversations() {
    api('/api/global-agent/conversations', {}).then(function (res) {
      var list = document.getElementById('agent-conv-list');
      var convs = (res.data && res.data.conversations) || [];
      if (!convs.length) {
        list.innerHTML = '<div class="agent-conv-empty">暂无对话</div>';
        return;
      }
      list.innerHTML = '';
      convs.forEach(function (c) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'agent-conv-item';
        item.textContent = c.title || ('对话 ' + c.id);
        item.addEventListener('click', function () { openConversation(c.id); });
        list.appendChild(item);
      });
    }).catch(function () {});
  }
  function openConversation(convId) {
    api('/api/global-agent/conversations/' + convId).then(function (res) {
      var data = res.data || {};
      var chat = document.getElementById('agent-chat');
      chat.innerHTML = '';
      hideDock(); hideHitl(); stopStream();
      S.steps = {}; S.evidence = {};
      (data.messages || []).forEach(function (m) {
        if (m.role === 'tool') { addBubble('system', m.content); return; }
        if (m.role === 'user' || m.role === 'assistant') addBubble(m.role, m.content || '');
      });
      if (!(data.messages || []).length) chat.innerHTML = '<div class="agent-conv-empty">该对话暂无消息</div>';
    }).catch(function (err) {
      addBubble('system', '加载对话失败：' + (err && err.message ? err.message : err));
    });
  }

  /* ---------- 工具 ---------- */
  function isLocalDev() {
    var h = String(location.hostname || '');
    return h === 'localhost' || h === '127.0.0.1';
  }
  // 本地开发：无 token 时自动用开发账号登录（仅 localhost/127.0.0.1 生效，不引入硬编码到业务逻辑）
  function devAutoLogin() {
    if (!isLocalDev()) return Promise.resolve(false);
    var base = window.API_BASE || location.origin;
    function postLogin(u, p) {
      return fetch(base + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.code === 0) {
          try {
            localStorage.setItem('zhitu_token', d.data.token);
            localStorage.setItem('zhitu_user', JSON.stringify({
              username: d.data.username || u, role: d.data.role || 'user', loginTime: Date.now()
            }));
          } catch (_) {}
          return true;
        }
        return false;
      }).catch(function () { return false; });
    }
    return postLogin('developer', '123456').then(function (ok) {
      if (ok) return true;
      return fetch(base + '/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'developer', password: '123456' })
      }).then(function () { return postLogin('developer', '123456'); })
        .catch(function () { return false; });
    });
  }
  function api(path, options) {
    options = options || {};
    function buildHeaders() {
      var h = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
      var t = window.zhituGetToken ? window.zhituGetToken() : '';
      if (t) h.Authorization = 'Bearer ' + t;
      return h;
    }
    function doFetch(headers) {
      return fetch((window.API_BASE || '') + path, Object.assign({}, options, { headers: headers }));
    }
    return doFetch(buildHeaders()).then(function (res) {
      // 401：token 缺失/失效 → 本地自动登录后重发一次
      if (res.status === 401) {
        return devAutoLogin().then(function (ok) {
          if (!ok) throw new Error('HTTP 401');
          return doFetch(buildHeaders()).then(function (r2) {
            if (!r2.ok) throw new Error('HTTP ' + r2.status);
            return r2.json();
          });
        });
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }
  function currentPage() {
    try {
      var b = document.body;
      if (b && b.getAttribute('data-page')) return b.getAttribute('data-page');
    } catch (_) {}
    var m = /pages\/([^\/]+)\.html/.exec(location.pathname);
    return m ? m[1] : '';
  }
  function currentTab() {
    var m = /tab=([^&]+)/.exec(location.search);
    return m ? m[1] : '';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- 初始化 ---------- */
  ensureUi();
  window.__AgentUI = true;
  window.AgentUI = {
    open: function () { document.getElementById('agent-shell').classList.add('is-open'); },
    close: function () { document.getElementById('agent-shell').classList.remove('is-open'); }
  };
  // shell.js 通过 openQA 提前打开的请求：加载完成后自动展开
  if (window.__agentOpenPending) {
    window.__agentOpenPending = false;
    window.AgentUI.open();
  }
})();
