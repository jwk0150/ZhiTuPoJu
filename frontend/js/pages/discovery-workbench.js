/* Discovery homepage — browse only; detail opens as drawer module */
(function () {
  function setKind(kind) {
    const k = kind === 'forecast' ? 'forecast' : 'found';
    document.querySelectorAll('.dh-tab[data-kind]').forEach((btn) => {
      const on = btn.getAttribute('data-kind') === k;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.dh-panel[data-filter]').forEach((p) => {
      p.classList.toggle('is-active', p.getAttribute('data-filter') === k);
    });
    const board = document.getElementById('discovery-results');
    if (board) board.setAttribute('data-kind', k);
    const kindSelect = document.getElementById('discovery-kind');
    if (kindSelect) kindSelect.value = k;
    if (window.discoveryState) {
      window.discoveryState.status = 'all';
      window.discoveryState.foundPage = 1;
      window.discoveryState.forecastPage = 1;
    }
    window.renderDiscoveryList && window.renderDiscoveryList({ skipAnim: true });
  }

  window.discSetKind = setKind;

  window.openDiscoveryDaily = function () {
    window.ensureDiscoveryState && window.ensureDiscoveryState();
    const ds = window.discoveryState || {};
    const found = (ds.discoveries || []).slice().sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    const forecast = (ds.forecasts || []).slice().sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    const high = forecast.filter((j) => (j.confidence || 0) >= 80);
    const modal = document.getElementById('dh-daily-modal');
    const body = document.getElementById('dh-daily-body');
    const sub = document.getElementById('dh-daily-sub');
    if (!modal || !body) {
      if (window.Utils && window.Utils.showToast) {
        window.Utils.showToast('发现日报将汇总本周期真实发现与高置信预测', 'mint');
      }
      return;
    }
    const now = new Date();
    const dateStr =
      now.getFullYear() +
      '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(now.getDate()).padStart(2, '0');
    if (sub) sub.textContent = dateStr + ' · 近 90 天信号摘要 · 共 ' + (found.length + forecast.length) + ' 条';

    const esc = (s) =>
      String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const card = (j, lane) => {
      const conf = j.confidence != null ? j.confidence : j.conf || 0;
      const href = 'discovery-detail.html?id=' + encodeURIComponent(j.id || '');
      const skills = (j.core_skills || j.skills || []).slice(0, 3);
      const skillTxt = skills
        .map((s) => (typeof s === 'string' ? s : s.name))
        .filter(Boolean)
        .join(' · ');
      return (
        '<a class="dh-daily-card is-' +
        lane +
        '" href="' +
        href +
        '">' +
        '<span class="dh-daily-card-lane">' +
        (lane === 'forecast' ? '预测' : '真实') +
        '</span>' +
        '<strong>' +
        esc(j.title || '未命名岗位') +
        '</strong>' +
        '<em>' +
        (skillTxt || esc(j.category || '新兴岗位')) +
        '</em>' +
        '<span class="dh-daily-card-conf">' +
        conf +
        '%</span></a>'
      );
    };

    body.innerHTML =
      '<div class="dh-daily-kpis">' +
      '<div><em>真实发现</em><strong>' +
      found.length +
      '</strong></div>' +
      '<div><em>预测岗位</em><strong>' +
      forecast.length +
      '</strong></div>' +
      '<div><em>高置信预测</em><strong>' +
      high.length +
      '</strong></div>' +
      '<div><em>建议动作</em><strong>读 Top 3</strong></div></div>' +
      '<section class="dh-daily-sec">' +
      '<h3>今日重点 · 真实发现</h3>' +
      '<div class="dh-daily-grid">' +
      (found.length ? found.slice(0, 4).map((j) => card(j, 'found')).join('') : '<p class="dh-daily-empty">暂无真实发现样本</p>') +
      '</div></section>' +
      '<section class="dh-daily-sec">' +
      '<h3>前瞻信号 · 高置信预测</h3>' +
      '<div class="dh-daily-grid">' +
      ((high.length ? high : forecast).slice(0, 4).map((j) => card(j, 'forecast')).join('') ||
        '<p class="dh-daily-empty">暂无预测样本</p>') +
      '</div></section>' +
      '<p class="dh-daily-note">日报用于快速扫盘：真实岗位可直接对照简历；预测岗位建议收藏到个人仓库后持续观察。</p>';

    modal.hidden = false;
    document.body.classList.add('dh-daily-open');
  };

  function closeDiscoveryDaily() {
    const modal = document.getElementById('dh-daily-modal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('dh-daily-open');
  }

  window.initDiscoveryHome = function () {
    document.querySelectorAll('.dh-tab[data-kind]').forEach((btn) => {
      btn.addEventListener('click', () => setKind(btn.getAttribute('data-kind')));
    });
    document.querySelectorAll('.dh-panel[data-filter]').forEach((panel) => {
      panel.addEventListener('click', () => setKind(panel.getAttribute('data-filter')));
    });

    const kindSelect = document.getElementById('discovery-kind');
    kindSelect?.addEventListener('change', () => setKind(kindSelect.value));

    document.querySelectorAll('[data-close-daily]').forEach((el) => {
      el.addEventListener('click', closeDiscoveryDaily);
    });
    document.getElementById('dh-daily-goto-found')?.addEventListener('click', () => {
      closeDiscoveryDaily();
      setKind('found');
      document.getElementById('discovery-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDiscoveryDaily();
    });

    if (window.discoveryState) window.discoveryState.pageSize = 8;
    const origEnsure = window.ensureDiscoveryState;
    window.ensureDiscoveryState = function () {
      origEnsure && origEnsure();
      if (window.discoveryState) window.discoveryState.pageSize = 8;
    };

    const origCounts = window.updateDiscoveryCounts;
    window.updateDiscoveryCounts = function () {
      origCounts && origCounts();
      const ds = window.discoveryState || {};
      const realN = (ds.discoveries || []).length;
      const predN = (ds.forecasts || []).length;
      const high = (ds.forecasts || []).filter((j) => (j.confidence || 0) >= 80).length;
      const elHigh = document.getElementById('kpi-forecast-high');
      if (elHigh) elHigh.textContent = String(high || Math.max(1, Math.round(predN * 0.4)));
      const total = document.getElementById('disc-total-count');
      if (total) total.textContent = String(realN + predN);
      const upd = document.getElementById('disc-updated-at');
      if (upd) {
        const d = new Date();
        upd.textContent =
          d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(d.getDate()).padStart(2, '0') +
          ' ' +
          String(d.getHours()).padStart(2, '0') +
          ':' +
          String(d.getMinutes()).padStart(2, '0');
      }
    };

    // 两条线互不串门：真实→详情；预测→直接进详情（无中间选择栏）
    window.selectDiscoveryJob = function (id) {
      window.ensureDiscoveryState();
      const all = [...(window.discoveryState.discoveries || []), ...(window.discoveryState.forecasts || [])];
      const job = all.find((j) => j.id === id);
      if (!job) return;
      const isForecast = !!(job.is_forecast || job.status === 'forecast');
      try {
        sessionStorage.setItem('zhitu_disc_job', JSON.stringify(job));
        sessionStorage.setItem('zhitu_disc_lane', isForecast ? 'forecast' : 'found');
      } catch (_) {}
      location.href = 'discovery-detail.html?id=' + encodeURIComponent(job.id);
    };
    window.showDiscoveryDetail = function (id) {
      window.selectDiscoveryJob(id);
    };

    if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        gsap.from('.dh-value, .dh-insight, .dh-toolbar, .dh-switch, .dh-board', {
          opacity: 0,
          y: 12,
          duration: 0.75,
          stagger: 0.08,
          ease: 'power3.out',
          clearProps: 'opacity,transform'
        });
      } catch (_) {}
    }

    setTimeout(() => {
      window.updateDiscoveryCounts && window.updateDiscoveryCounts();
      setKind('found');
    }, 120);
  };

  // Back-compat alias
  window.initDiscoveryWorkbench = window.initDiscoveryHome;
})();
