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
    if (window.Utils && window.Utils.showToast) {
      window.Utils.showToast('发现日报将汇总本周期真实发现与高置信预测', 'mint');
    }
  };

  window.initDiscoveryHome = function () {
    document.querySelectorAll('.dh-tab[data-kind]').forEach((btn) => {
      btn.addEventListener('click', () => setKind(btn.getAttribute('data-kind')));
    });
    document.querySelectorAll('.dh-panel[data-filter]').forEach((panel) => {
      panel.addEventListener('click', () => setKind(panel.getAttribute('data-filter')));
    });

    const kindSelect = document.getElementById('discovery-kind');
    kindSelect?.addEventListener('change', () => setKind(kindSelect.value));

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
