(function () {
  if (window.Shell && typeof window.Shell.mount === 'function') {
    window.Shell.mount({
      pageId: 'home',
      title: '工作台',
      subtitle: '执图破局 · 数字人才图谱平台',
      homeTopbar: true
    });
  }

  document.querySelectorAll('[data-page-href]').forEach(function (el) {
    const key = el.getAttribute('data-page-href');
    if (window.PAGE_HREF && window.PAGE_HREF[key]) {
      el.setAttribute('href', window.PAGE_HREF[key]);
    }
  });

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function formatNum(n, decimals) {
    if (decimals > 0) return n.toFixed(decimals);
    return Math.round(n).toLocaleString('en-US');
  }

  function animateCount(el, target, opts) {
    opts = opts || {};
    const decimals = opts.decimals || 0;
    if (reduce) {
      el.textContent = formatNum(target, decimals);
      return;
    }
    const start = performance.now();
    const duration = opts.duration || 1000;
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = formatNum(target * eased, decimals);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  document.querySelectorAll('.home-kpi-value[data-count]').forEach(function (el) {
    animateCount(el, Number(el.getAttribute('data-count') || 0));
  });
  document.querySelectorAll('.home-kpi-value [data-count]').forEach(function (el) {
    animateCount(el, Number(el.getAttribute('data-count') || 0) / 10, { decimals: 1 });
  });

  const qaBtn = document.getElementById('home-open-qa');
  if (qaBtn) {
    qaBtn.addEventListener('click', function () {
      if (window.Shell && window.Shell.openQA) window.Shell.openQA();
    });
  }

  // Cycle skill bubbles labels for living feel
  const bubbleTexts = [
    ['数据分析', '人工智能', '产品设计'],
    ['云计算', '前端开发', '算法工程'],
    ['用户研究', '数据治理', '智能制造']
  ];
  const bubbles = Array.from(document.querySelectorAll('.home-bubble'));
  if (bubbles.length === 3 && !reduce) {
    let bi = 0;
    window.setInterval(function () {
      bi = (bi + 1) % bubbleTexts.length;
      bubbles.forEach(function (el, i) {
        el.style.opacity = '0';
        window.setTimeout(function () {
          el.textContent = bubbleTexts[bi][i];
          el.style.opacity = '';
        }, 220);
      });
    }, 4200);
  }

  function initTrendChart() {
    if (typeof echarts === 'undefined') return false;
    const el = document.getElementById('home-trend-chart');
    if (!el) return true;
    if (window.echarts.getInstanceByDom && window.echarts.getInstanceByDom(el)) return true;
    const chart = echarts.init(el);
    chart.setOption({
      animation: !reduce,
      grid: { left: 36, right: 16, top: 24, bottom: 32 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderColor: '#D5E8F0',
        textStyle: { color: '#14324A', fontSize: 12 }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: ['05-01', '05-02', '05-03', '05-04', '05-05', '05-06', '05-07'],
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.18)' } },
        axisTick: { show: false },
        axisLabel: { color: 'rgba(232,242,248,0.55)', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)', type: 'dashed' } },
        axisLabel: { color: 'rgba(232,242,248,0.55)', fontSize: 11 }
      },
      series: [{
        name: '匹配量',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        data: [820, 932, 901, 1034, 1190, 1280, 1420],
        lineStyle: { width: 3, color: '#1EA8E8' },
        itemStyle: { color: '#fff', borderColor: '#1EA8E8', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(30,168,232,0.28)' },
              { offset: 1, color: 'rgba(30,168,232,0.02)' }
            ]
          }
        }
      }]
    });
    window.addEventListener('resize', function () { chart.resize(); });
    return true;
  }

  if (!initTrendChart()) {
    var tries = 0;
    var timer = window.setInterval(function () {
      tries += 1;
      if (initTrendChart() || tries > 40) window.clearInterval(timer);
    }, 50);
  }
})();
