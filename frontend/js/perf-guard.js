/* 登录后页面性能护栏：离页释放图表/定时器，按需加载 G6 */
(function () {
  if (window.__zhituPerfGuard) return;
  window.__zhituPerfGuard = true;

  window.ensureG6 =
    window.ensureG6 ||
    function () {
      if (window.G6 && window.G6.Graph) return Promise.resolve(window.G6);
      if (window.__g6Loading) return window.__g6Loading;
      window.__g6Loading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@antv/g6@4.8.24/dist/g6.min.js';
        s.async = true;
        s.onload = function () {
          window.__g6Loading = null;
          if (window.G6 && window.G6.Graph) resolve(window.G6);
          else reject(new Error('G6 missing'));
        };
        s.onerror = function () {
          window.__g6Loading = null;
          reject(new Error('G6 load failed'));
        };
        document.head.appendChild(s);
      });
      return window.__g6Loading;
    };

  function disposeEcharts() {
    if (!window.echarts || typeof window.echarts.getInstanceByDom !== 'function') return;
    try {
      document.querySelectorAll('[_echarts_instance_]').forEach(function (el) {
        try {
          var inst = window.echarts.getInstanceByDom(el);
          if (inst) inst.dispose();
        } catch (_) {}
      });
    } catch (_) {}
  }

  function stopTimers() {
    try {
      if (window.destroyTalentMap) window.destroyTalentMap();
    } catch (_) {}
    try {
      if (window.destroyDiscFX) window.destroyDiscFX();
    } catch (_) {}
    try {
      if (window.destroyDisc3D) window.destroyDisc3D();
    } catch (_) {}
    try {
      if (window.trendGraphInstances) {
        Object.keys(window.trendGraphInstances).forEach(function (k) {
          var g = window.trendGraphInstances[k];
          if (g && g.destroy) {
            try {
              g.destroy();
            } catch (_) {}
          }
          window.trendGraphInstances[k] = null;
        });
      }
    } catch (_) {}
  }

  function clearQaFrame() {
    var frame = document.getElementById('qa-drawer-frame');
    if (frame && frame.getAttribute('src') && frame.getAttribute('src') !== 'about:blank') {
      try {
        frame.src = 'about:blank';
      } catch (_) {}
    }
  }

  function onLeave() {
    disposeEcharts();
    stopTimers();
    clearQaFrame();
  }

  window.addEventListener('pagehide', onLeave);
  window.addEventListener('beforeunload', onLeave);

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) return;
    document.querySelectorAll('video').forEach(function (v) {
      try {
        v.pause();
      } catch (_) {}
    });
  });
})();
