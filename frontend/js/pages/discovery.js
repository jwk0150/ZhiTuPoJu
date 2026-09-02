// ============== Discovery View (智能体驱动 - Mission Control) ==============
window.API_BASE = window.API_BASE || ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') ? 'http://127.0.0.1:5000' : location.origin);
window.discoveryState = {
  phase: 'idle', activeStep: 0, scanning: false,
  dataSource: 'api', llmEnabled: false,
  discoveries: [], forecasts: [], reasoningChain: [],
  scanSummary: '', modelInfo: {}, drawerJobId: null,
  search: '', sort: 'confidence', category: 'all', status: 'all',
  city: 'all', minConf: 'all',   page: 1, foundPage: 1, forecastPage: 1, pageSize: 8, trackLog: []
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
    window.DiscoveryFavs && window.DiscoveryFavs.initBar();
};

window.ensureDiscoveryState = function() {
    if (!window.discoveryState) window.discoveryState = {phase:'idle',activeStep:0,scanning:false,dataSource:'api',llmEnabled:false,discoveries:[],forecasts:[],reasoningChain:[],scanSummary:'',modelInfo:{},drawerJobId:null,search:'',sort:'confidence',category:'all',status:'all',city:'all',minConf:'all',page:1,foundPage:1,forecastPage:1,pageSize:4,trackLog:[]};
    const ds = window.discoveryState;
    if (ds.city == null) ds.city = 'all';
    if (ds.minConf == null) ds.minConf = 'all';
    if (!ds.page) ds.page = 1;
    if (!ds.foundPage) ds.foundPage = 1;
    if (!ds.forecastPage) ds.forecastPage = 1;
    if (!ds.pageSize) ds.pageSize = 8;
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
        reasoning: '信号路径：标题新颖度 + 技能组合熵 + 跨行业溢出 = 综合置信度 ' + conf + '%'
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
        setTrend('kpi-discovered-trend', '+32%', true);
        setTrend('kpi-pending-trend', counts.pending ? '待处理' : '已清空', !!counts.pending);
        setTrend('kpi-adopted-trend', counts.adopted ? '已入库' : '暂无', false);
        setTrend('kpi-forecast-trend', '+28%', true);
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

    const fcCount = document.getElementById('disc-found-count');
    const ffCount = document.getElementById('disc-forecast-count');
    if (fcCount) fcCount.textContent = String(found.length);
    if (ffCount) ffCount.textContent = String(forecasts.length);
    const totalCount = document.getElementById('disc-total-count');
    if (totalCount) totalCount.textContent = String(found.length + forecasts.length);

    const activeKind = document.querySelector('.dh-tab.is-active')?.getAttribute('data-kind')
        || document.getElementById('discovery-results')?.getAttribute('data-kind')
        || document.getElementById('discovery-kind')?.value
        || 'found';
    const kind = activeKind === 'forecast' ? 'forecast' : 'found';
    if (secFound) {
        const showF = kind === 'found';
        secFound.hidden = !showF;
        secFound.style.display = showF ? '' : 'none';
    }
    if (secFc) {
        const showP = kind === 'forecast';
        secFc.hidden = !showP;
        secFc.style.display = showP ? '' : 'none';
    }
    const foundLabel = document.getElementById('disc-sec-found-label');
    const fcLabel = document.getElementById('disc-sec-forecast-label');
    if (foundLabel) foundLabel.hidden = true;
    if (fcLabel) fcLabel.style.display = kind === 'forecast' ? '' : 'none';

    const totalEl = document.getElementById('disc-total-label');
    if (totalEl) {
        totalEl.textContent = kind === 'forecast'
            ? '共 ' + forecasts.length + ' 个预测岗位'
            : '共 ' + found.length + ' 个真实发现';
    }

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
        const delay = skipAnim ? 0 : Math.min(i * 45, 280);
        const skillsAll = j.requiredSkills || j.core_skills || [];
        const skills = skillsAll.slice(0, 3);
        const more = Math.max(0, skillsAll.length - 3);
        const growth = j.growth_pct || j.growth || Math.max(12, Math.round((conf - 40) * 1.8));
        const eta = j.eta_months || '6–12';
        const firstSeen = j.freshness || (j.discoveredAt || j.discovered_at
            ? new Date(j.discoveredAt || j.discovered_at).toISOString().slice(0, 7)
            : '近周期');
        const insight = (j.reasoning || j.insight || '').trim().replace(/^信号路径[：:]\s*/, '').replace(/^Mock 路径[：:]\s*/, '');
        const insightShort = insight
            ? (insight.length > 32 ? insight.slice(0, 32) + '…' : insight)
            : (isForecast
                ? '预计未来 ' + eta + ' 个月进入增长阶段'
                : '近周期首次持续出现于真实招聘数据');
        const ctx = (j.industry || '互联网') + ' · ' + (j.category || j.direction || '综合');
        const chips = skills.map((s) => '<span class="skill-chip">' + s + '</span>').join('')
            + (more ? '<span class="skill-chip">+' + more + '</span>' : '');
        const trend = isForecast
            ? '<div class="dh-trend"><span class="heat">置信 ' + conf + '%</span><span>窗口 ' + eta + ' 月</span></div>'
            : '<div class="dh-trend"><span class="heat">热度 ' + conf + '</span><span class="up">↑ ' + growth + '%</span><span>' + firstSeen + '</span></div>';
        const tag = isForecast
            ? '<span class="dh-tag is-pred">未来预测</span>'
            : '<span class="dh-tag is-real">真实发现</span>';
        const cardCls = 'job-card dh-card ' + (isForecast ? 'is-forecast' : 'is-real') + (skipAnim ? ' no-enter-anim' : '');
        return '<article class="' + cardCls + '" data-job-id="' + j.id + '" data-kind="' + (isForecast ? 'forecast' : 'found') + '" style="' + (skipAnim ? '' : 'animation-delay:' + delay + 'ms') + '" role="button" tabindex="0" onclick="window.selectDiscoveryJob(\'' + j.id + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();window.selectDiscoveryJob(\'' + j.id + '\')}">' +
            '<div class="dh-card-top">' + tag + '<span class="dh-card-go" aria-hidden="true">→</span></div>' +
            '<h3 class="dh-card-title disc-proto-title">' + (j.title || '未命名岗位') + '</h3>' +
            '<p class="dh-card-ctx">' + ctx + '</p>' +
            '<div class="dh-skills">' + chips + '</div>' +
            trend +
            '<p class="dh-insight-line"><em>洞察</em>' + insightShort + '</p>' +
            '</article>';
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
    if (window._discActiveJob && window._discActiveJob.id) {
        document.querySelectorAll('#discovery-results .job-card').forEach((c) => {
            c.classList.toggle('is-selected', c.getAttribute('data-job-id') === window._discActiveJob.id);
        });
    }
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
        const r = await fetch((window.API_BASE || ((location.hostname === '127.0.0.1' || location.hostname === 'localhost') ? 'http://127.0.0.1:5000' : location.origin)) + '/api/agent/chat', {
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

window.selectDiscoveryJob = function(id) {
    window.ensureDiscoveryState();
    const all = [...(window.discoveryState.discoveries||[]), ...(window.discoveryState.forecasts||[])];
    const job = all.find(j => j.id === id);
    if (!job) return;
    const isForecast = !!(job.is_forecast || job.status === 'forecast');
    try {
      sessionStorage.setItem('zhitu_disc_job', JSON.stringify(job));
      sessionStorage.setItem('zhitu_disc_lane', isForecast ? 'forecast' : 'found');
    } catch (e) {}
    location.href = 'discovery-detail.html?id=' + encodeURIComponent(job.id) + '&v=fix25';
};

window.showDiscoveryDetail = function(id) {
    window.selectDiscoveryJob(id);
};

window.auditDiscoveryJob = function(id) {
    window.ensureDiscoveryState();
    const job = (window.discoveryState.discoveries || []).find(j => j.id === id);
    if (!job) { window.Utils.showToast('仅发现岗位支持审核', 'amber'); return; }
    // 首页进入详情页；研判动作在详情模块内完成
    window.selectDiscoveryJob(id);
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
    if (title) title.textContent = (mode === 'audit' ? '研判 · ' : '') + (job.title||'岗位详情');
    const kicker = document.getElementById('disc-drawer-kicker');
    if (kicker) kicker.textContent = isForecast ? '未来预测 · AI 衍生方向' : '真实发现 · 岗位库信号';
    drawer.classList.toggle('is-forecast', !!isForecast);
    if (body) {
        const list = arr => (arr&&arr.length) ? '<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6">'+arr.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>' : '<p style="font-size:13px;color:var(--text-muted)">--</p>';
        const chips = arr => (arr&&arr.length) ? '<div style="display:flex;flex-wrap:wrap;gap:6px">'+arr.map(s=>'<span class="skill-chip">'+esc(s)+'</span>').join('')+'</div>' : '<p style="font-size:13px;color:var(--text-muted)">--</p>';
        const auditBanner = (mode === 'audit' && (job.status === 'pending' || !job.status))
            ? '<div class="disc-audit-banner"><b>人工研判</b><p>请核对定义、技能与证据后，决定是否入库或拒绝。</p></div>'
            : '';
        const pathHtml = '<div class="disc-path">'+
            '<span>已有岗位</span><i>→</i><span>技能融合</span><i>→</i>'+
            '<span>'+esc(job.title||'当前岗位')+'</span>'+
            (isForecast ? '<i>→</i><span>未来衍生</span>' : '')+
            '</div>';
        body.innerHTML = auditBanner +
            '<div class="disc-drawer-identity">'+
                '<div class="kv"><label>类型</label><span>'+(isForecast?'未来预测':'真实发现')+'</span></div>'+
                '<div class="kv"><label>方向</label><span>'+esc(job.category||'--')+'</span></div>'+
                '<div class="kv"><label>级别</label><span>'+esc(job.level||'--')+'</span></div>'+
                '<div class="kv"><label>置信度</label><span style="color:'+confColor+'">'+conf+'%</span></div>'+
                '<div class="kv"><label>城市</label><span>'+esc(job.city||'--')+'</span></div>'+
                '<div class="kv"><label>薪资</label><span>'+esc(job.salary||'--')+'</span></div>'+
                '<div class="kv"><label>来源</label><span>'+esc(job.source||'岗位库扫描')+'</span></div>'+
                (isForecast?'<div class="kv"><label>预计窗口</label><span style="color:var(--amber)">'+esc(job.eta_months||'6-12')+' 个月</span></div>':'')+
                '<div class="kv"><label>状态</label><span>'+statusLabel+'</span></div>'+
            '</div>'+
            '<div class="disc-drawer-section" data-panel="overview"><h4>岗位概览</h4><p>'+(esc(job.definition||job.description)||'--')+'</p></div>'+
            '<div class="disc-drawer-section" data-panel="overview"><h4>核心职责</h4>'+list(job.responsibilities||job.duties)+'</div>'+
            '<div class="disc-drawer-section" data-panel="overview"><h4>典型场景</h4>'+list(job.scenarios||job.use_cases)+'</div>'+
            '<div class="disc-drawer-section" data-panel="skills" hidden><h4>核心技能</h4>'+chips(skills)+'</div>'+
            '<div class="disc-drawer-section" data-panel="trend" hidden><h4>发展趋势</h4>'+
                '<div class="disc-quality-grid">'+
                    '<div class="q-cell"><label>热度/置信</label><span style="color:'+confColor+'">'+conf+'%</span></div>'+
                    '<div class="q-cell"><label>样本量</label><span>'+esc(job.sample_size||job.evidence_count||'--')+'</span></div>'+
                    '<div class="q-cell"><label>新鲜度</label><span>'+esc(job.freshness||(job.discoveredAt? new Date(job.discoveredAt).toLocaleDateString():'--'))+'</span></div>'+
                    '<div class="q-cell"><label>覆盖度</label><span>'+esc(job.coverage||'--')+'</span></div>'+
                '</div>'+
            '</div>'+
            '<div class="disc-drawer-section" data-panel="related" hidden><h4>演化路径</h4>'+pathHtml+
                (isForecast ? '<div style="margin-top:10px"><h4>预测驱动力</h4>'+list(job.drivers)+'</div>' : '')+
            '</div>'+
            '<div class="disc-drawer-section" data-panel="evidence" hidden><h4>'+(isForecast?'预测依据':'发现依据')+'</h4>'+
                '<p style="font-size:13px;line-height:1.6">'+
                    (job.evidence_company? '来源主体：'+esc(job.evidence_company)+' · ' : '')+
                    (job.city? esc(job.city)+' · ' : '')+
                    (job.source? esc(job.source) : '多源招聘库新兴度评分')+
                '</p>'+
                (job.reasoning ? '<p style="margin-top:8px;font-size:12px;color:var(--text-muted)">'+esc(job.reasoning)+'</p>' : '')+
            '</div>';
        const tabs = document.getElementById('disc-drawer-tabs');
        if (tabs) {
            tabs.querySelectorAll('button').forEach((b) => {
                b.classList.toggle('is-active', b.getAttribute('data-tab') === 'overview');
                b.onclick = () => {
                    const tab = b.getAttribute('data-tab');
                    tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('is-active', x === b));
                    body.querySelectorAll('[data-panel]').forEach((sec) => {
                        sec.hidden = sec.getAttribute('data-panel') !== tab;
                    });
                };
            });
        }
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


/* extracted for discovery */
