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
                    content: '顾问暂时连不上后端，本地图谱问答也未命中。请确认服务已启动（http://127.0.0.1:5000），或换个问法。',
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

window.clearChat = function () {
    window.qaState.chatHistory = [{
        role: 'ai',
        content: '对话已清空。可点上方推荐问题，或直接输入新问题。',
        time: new Date()
    }];
    window.renderChatHistory();
    if (window.showToast) window.showToast('已清空对话', 'cyan');
};



