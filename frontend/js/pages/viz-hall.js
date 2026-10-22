/* 可视化大厅 · 高级图型 + 点击放大 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var charts = {};
  var builders = {};
  var titles = {
    city: '城市热度',
    skill: '能力结构',
    match: '匹配得分',
    role: '职类占比',
    salary: '薪资区间',
    supply: '供需对比'
  };
  var timers = [];
  var lightboxChart = null;
  var lightboxKey = null;
  var state = { ingest: 128400000, graph: 18420, match: 960 };

  var CITIES = ['上海', '北京', '深圳', '杭州', '成都', '广州', '南京', '武汉'];
  var ROLES = ['算法', '后端', '前端', '数据', '产品', '应用'];
  var SKILLS = ['Python', 'RAG', 'Agent', 'FastAPI', '向量', '特征', '评测', '图谱'];
  var SALARY = ['8-12k', '12-18k', '18-25k', '25-35k', '35k+'];
  var PALETTE = ['#A88B4E', '#C84738', '#3D8B7A', '#5B7C99', '#C4A86B', '#8B6B4A', '#6B8F71', '#B86B5A'];

  function $(id) { return document.getElementById(id); }

  function formatBytes(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MB';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + ' KB';
    return Math.floor(n) + ' B';
  }

  function formatInt(n) {
    return Math.floor(n).toLocaleString('zh-CN');
  }

  function softAxis(large) {
    return {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#6B7280', fontSize: large ? 13 : 11 },
      splitLine: { lineStyle: { color: 'rgba(168,139,78,.1)', type: 'dashed' } }
    };
  }

  function tip() {
    return {
      backgroundColor: 'rgba(255,252,246,.97)',
      borderColor: 'rgba(168,139,78,.3)',
      borderWidth: 1,
      textStyle: { color: '#2A2A2A', fontSize: 12 },
      extraCssText: 'box-shadow:0 12px 32px rgba(72,48,12,.12);border-radius:8px;'
    };
  }

  function grad(c0, c1, vertical) {
    return new echarts.graphic.LinearGradient(
      0, 0,
      vertical ? 0 : 1,
      vertical ? 1 : 0,
      [{ offset: 0, color: c0 }, { offset: 1, color: c1 }]
    );
  }

  function paint(key) {
    if (!builders[key] || !charts[key]) return;
    charts[key].setOption(builders[key](false), true);
    if (lightboxKey === key && lightboxChart) {
      lightboxChart.setOption(builders[key](true), true);
    }
  }

  function buildByteTrack() {
    var track = $('vh-byte-track');
    if (!track) return;
    var parts = [];
    for (var i = 0; i < 14; i++) {
      parts.push(CITIES[i % CITIES.length] + ' · ' + ROLES[i % ROLES.length]);
      parts.push('<span class="vh-sep">·</span>');
      parts.push('<b>' + formatBytes(state.ingest + i * 24000) + '</b>');
      parts.push('<span class="vh-sep">·</span>');
      parts.push(SKILLS[i % SKILLS.length]);
      parts.push('<span class="vh-sep">·</span>');
    }
    var html = parts.join(' ');
    track.innerHTML = html + html;
  }

  function paintMetrics() {
    document.querySelectorAll('[data-byte]').forEach(function (el) {
      var key = el.getAttribute('data-byte');
      if (key === 'ingest') el.textContent = formatBytes(state.ingest);
      else if (key === 'graph') el.textContent = formatInt(state.graph);
      else if (key === 'match') el.textContent = formatInt(state.match);
    });
  }

  function tickBytes() {
    state.ingest += 8000 + Math.random() * 32000;
    if (Math.random() > 0.5) state.graph += 1;
    if (Math.random() > 0.65) state.match += 1;
    paintMetrics();
    timers.push(window.setTimeout(tickBytes, reduceMotion ? 3200 : 1400));
  }

  /* —— 城市热度：双环极坐标 —— */
  function initCity() {
    var el = $('vh-chart-city');
    if (!el || !window.echarts) return;
    charts.city = echarts.init(el);
    var values = CITIES.map(function (_, i) {
      return 48 + Math.round(Math.random() * 42) + (i % 3) * 2;
    });
    var values2 = values.map(function (v) {
      return Math.max(20, Math.round(v * (0.55 + Math.random() * 0.25)));
    });

    builders.city = function (large) {
      var fs = large ? 13 : 11;
      var r = large ? ['22%', '78%'] : ['20%', '74%'];
      return {
        tooltip: Object.assign({ trigger: 'item' }, tip()),
        polar: { radius: r, center: ['50%', '52%'] },
        angleAxis: {
          type: 'category',
          data: CITIES,
          startAngle: 72,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#5C6370', fontSize: fs, margin: large ? 14 : 10 }
        },
        radiusAxis: {
          min: 0,
          max: 100,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: false },
          splitLine: { lineStyle: { color: 'rgba(168,139,78,.14)', type: 'dashed' } }
        },
        series: [
          {
            type: 'bar',
            coordinateSystem: 'polar',
            roundCap: true,
            barWidth: large ? 16 : 11,
            barGap: '-55%',
            z: 2,
            data: values.map(function (v, i) {
              return {
                value: v,
                itemStyle: {
                  color: grad(PALETTE[i % PALETTE.length], 'rgba(255,255,255,.12)', true),
                  shadowBlur: large ? 16 : 10,
                  shadowColor: PALETTE[i % PALETTE.length] + '55'
                }
              };
            }),
            animationDuration: reduceMotion ? 0 : 1000
          },
          {
            type: 'bar',
            coordinateSystem: 'polar',
            roundCap: true,
            barWidth: large ? 10 : 7,
            z: 1,
            data: values2.map(function (v, i) {
              return {
                value: v,
                itemStyle: {
                  color: 'rgba(168,139,78,.18)',
                  borderColor: PALETTE[i % PALETTE.length],
                  borderWidth: 1,
                  opacity: 0.7
                }
              };
            })
          }
        ]
      };
    };

    paint('city');
    timers.push(window.setInterval(function () {
      values = values.map(function (v) {
        return Math.max(30, Math.min(98, Math.round(v + (Math.random() * 6 - 3))));
      });
      values2 = values.map(function (v) {
        return Math.max(18, Math.round(v * (0.5 + Math.random() * 0.28)));
      });
      paint('city');
    }, reduceMotion ? 4200 : 3000));
  }

  /* —— 能力结构：双层雷达 —— */
  function initSkill() {
    var el = $('vh-chart-skill');
    if (!el || !window.echarts) return;
    charts.skill = echarts.init(el);
    var market = SKILLS.map(function () { return 60 + Math.round(Math.random() * 30); });
    var self = SKILLS.map(function () { return 48 + Math.round(Math.random() * 40); });

    builders.skill = function (large) {
      return {
        tooltip: Object.assign({ trigger: 'item' }, tip()),
        legend: {
          bottom: large ? 8 : 0,
          itemWidth: 12,
          itemHeight: 8,
          textStyle: { color: '#6B7280', fontSize: large ? 13 : 11 },
          data: ['市场', '画像']
        },
        radar: {
          indicator: SKILLS.map(function (name) { return { name: name, max: 100 }; }),
          radius: large ? '68%' : '58%',
          center: ['50%', large ? '48%' : '46%'],
          shape: 'polygon',
          axisName: { color: '#5C6370', fontSize: large ? 13 : 11, fontWeight: 500 },
          splitNumber: 4,
          splitLine: { lineStyle: { color: 'rgba(168,139,78,.18)', width: 1.2 } },
          splitArea: {
            areaStyle: {
              color: [
                'rgba(168,139,78,.04)',
                'rgba(255,255,255,.55)',
                'rgba(168,139,78,.06)',
                'rgba(255,255,255,.6)'
              ]
            }
          },
          axisLine: { lineStyle: { color: 'rgba(168,139,78,.22)' } }
        },
        series: [{
          type: 'radar',
          symbol: 'circle',
          symbolSize: large ? 7 : 5,
          data: [
            {
              name: '市场',
              value: market,
              lineStyle: { width: 2.2, color: '#A88B4E', shadowBlur: 8, shadowColor: 'rgba(168,139,78,.35)' },
              itemStyle: { color: '#A88B4E', borderColor: '#fff', borderWidth: 1 },
              areaStyle: {
                color: new echarts.graphic.RadialGradient(0.5, 0.5, 0.85, [
                  { offset: 0, color: 'rgba(168,139,78,.4)' },
                  { offset: 1, color: 'rgba(168,139,78,.03)' }
                ])
              }
            },
            {
              name: '画像',
              value: self,
              lineStyle: { width: 2.2, color: '#C84738', shadowBlur: 8, shadowColor: 'rgba(200,71,56,.3)' },
              itemStyle: { color: '#C84738', borderColor: '#fff', borderWidth: 1 },
              areaStyle: {
                color: new echarts.graphic.RadialGradient(0.5, 0.5, 0.85, [
                  { offset: 0, color: 'rgba(200,71,56,.28)' },
                  { offset: 1, color: 'rgba(200,71,56,.02)' }
                ])
              }
            }
          ]
        }]
      };
    };

    paint('skill');
    timers.push(window.setInterval(function () {
      market = market.map(function (v) {
        return Math.max(42, Math.min(98, Math.round(v + (Math.random() * 5 - 2.5))));
      });
      self = self.map(function (v) {
        return Math.max(36, Math.min(96, Math.round(v + (Math.random() * 5 - 2.5))));
      });
      paint('skill');
    }, reduceMotion ? 5200 : 3800));
  }

  /* —— 匹配得分：仪表 + 面积 —— */
  function initMatch() {
    var el = $('vh-chart-match');
    if (!el || !window.echarts) return;
    charts.match = echarts.init(el);
    var xs = [];
    var ys = [];
    for (var i = 0; i < 14; i++) {
      xs.push((i * 2) + ':00');
      ys.push(66 + Math.round(Math.random() * 22));
    }

    builders.match = function (large) {
      var last = ys[ys.length - 1];
      var avg = Math.round(ys.reduce(function (a, b) { return a + b; }, 0) / ys.length);
      return {
        tooltip: Object.assign({
          trigger: 'axis',
          valueFormatter: function (v) { return v + '%'; }
        }, tip()),
        grid: {
          left: large ? 52 : 42,
          right: large ? 28 : 14,
          top: large ? 36 : 28,
          bottom: large ? 40 : 30
        },
        graphic: [{
          type: 'group',
          right: large ? 36 : 18,
          top: large ? 28 : 16,
          children: [
            {
              type: 'text',
              style: {
                text: String(last),
                fill: '#C84738',
                font: (large ? '700 36px ' : '700 22px ') + 'serif',
                textAlign: 'right'
              }
            },
            {
              type: 'text',
              top: large ? 40 : 26,
              style: {
                text: '当前 · 均 ' + avg,
                fill: '#8B7340',
                font: (large ? '12px ' : '10px ') + 'sans-serif',
                textAlign: 'right'
              }
            }
          ]
        }],
        xAxis: {
          type: 'category',
          data: xs,
          boundaryGap: false,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#6B7280', fontSize: large ? 12 : 10, interval: 1 }
        },
        yAxis: Object.assign({
          type: 'value',
          min: 40,
          max: 100,
          axisLabel: { color: '#6B7280', formatter: '{value}%', fontSize: large ? 12 : 11 }
        }, softAxis(large)),
        series: [{
          type: 'line',
          smooth: 0.5,
          symbol: 'none',
          lineStyle: {
            width: large ? 3.2 : 2.6,
            color: grad('#C84738', '#A88B4E', false),
            shadowBlur: 18,
            shadowColor: 'rgba(200,71,56,.35)'
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(200,71,56,.34)' },
              { offset: 0.5, color: 'rgba(168,139,78,.12)' },
              { offset: 1, color: 'rgba(255,255,255,0)' }
            ])
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: 'rgba(168,139,78,.45)', type: 'dashed', width: 1 },
            label: {
              formatter: '均线',
              color: '#8B7340',
              fontSize: 10
            },
            data: [{ yAxis: avg }]
          },
          markPoint: {
            symbol: 'circle',
            symbolSize: large ? 14 : 11,
            itemStyle: {
              color: '#C84738',
              borderColor: '#fff',
              borderWidth: 2,
              shadowBlur: 14,
              shadowColor: 'rgba(200,71,56,.45)'
            },
            label: { show: false },
            data: [{ coord: [xs[xs.length - 1], last] }]
          },
          data: ys
        }]
      };
    };

    paint('match');
    timers.push(window.setInterval(function () {
      var next = Math.max(52, Math.min(96, ys[ys.length - 1] + Math.round(Math.random() * 7 - 3.5)));
      ys.push(next);
      ys.shift();
      paint('match');
      if (Math.random() > 0.4) state.match += 1;
      paintMetrics();
    }, reduceMotion ? 7000 : 4500));
  }

  /* —— 职类：南丁格尔 + 中心环 —— */
  function initRole() {
    var el = $('vh-chart-role');
    if (!el || !window.echarts) return;
    charts.role = echarts.init(el);
    var data = ROLES.map(function (name, i) {
      return { name: name, value: 16 + Math.round(Math.random() * 28) + (5 - i) };
    });

    builders.role = function (large) {
      var total = data.reduce(function (a, b) { return a + b.value; }, 0);
      return {
        color: PALETTE,
        tooltip: Object.assign({ trigger: 'item' }, tip()),
        graphic: [{
          type: 'text',
          left: 'center',
          top: 'center',
          style: {
            text: total + '\n岗位',
            fill: '#5C4A28',
            font: (large ? '600 18px ' : '600 13px ') + 'sans-serif',
            textAlign: 'center',
            lineHeight: large ? 24 : 18
          }
        }],
        series: [{
          type: 'pie',
          roseType: 'area',
          radius: large ? ['28%', '72%'] : ['24%', '68%'],
          center: ['50%', '52%'],
          startAngle: 70,
          padAngle: 2,
          itemStyle: {
            borderRadius: 8,
            borderColor: 'rgba(255,252,246,.95)',
            borderWidth: 2,
            shadowBlur: large ? 16 : 12,
            shadowColor: 'rgba(72,48,12,.12)'
          },
          label: {
            color: '#5C6370',
            fontSize: large ? 13 : 11,
            formatter: large ? '{b}\n{d}%' : '{b}'
          },
          labelLine: {
            length: large ? 16 : 10,
            length2: large ? 12 : 8,
            lineStyle: { color: 'rgba(168,139,78,.45)' }
          },
          data: data,
          animationType: 'scale',
          animationEasing: 'cubicOut'
        }]
      };
    };

    paint('role');
    timers.push(window.setInterval(function () {
      data = data.map(function (d) {
        return {
          name: d.name,
          value: Math.max(10, Math.min(50, Math.round(d.value + (Math.random() * 3.5 - 1.5))))
        };
      });
      paint('role');
    }, reduceMotion ? 5200 : 4000));
  }

  /* —— 薪资：轨道条 —— */
  function initSalary() {
    var el = $('vh-chart-salary');
    if (!el || !window.echarts) return;
    charts.salary = echarts.init(el);
    var values = [18, 36, 46, 30, 15];

    builders.salary = function (large) {
      return {
        grid: {
          left: large ? 72 : 58,
          right: large ? 40 : 30,
          top: large ? 24 : 14,
          bottom: large ? 28 : 18
        },
        tooltip: Object.assign({ trigger: 'axis', axisPointer: { type: 'none' } }, tip()),
        xAxis: Object.assign({ type: 'value', max: 60, splitNumber: 3 }, softAxis(large)),
        yAxis: {
          type: 'category',
          data: SALARY,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#5C6370', fontSize: large ? 13 : 11 }
        },
        series: [{
          type: 'bar',
          data: values.map(function (v, i) {
            return {
              value: v,
              itemStyle: {
                borderRadius: 24,
                color: grad(PALETTE[i % PALETTE.length], 'rgba(255,255,255,.3)', false),
                shadowBlur: large ? 12 : 8,
                shadowColor: PALETTE[i % PALETTE.length] + '44'
              }
            };
          }),
          barWidth: large ? 18 : 13,
          showBackground: true,
          backgroundStyle: {
            color: 'rgba(168,139,78,.08)',
            borderRadius: 24
          },
          label: {
            show: true,
            position: 'right',
            color: '#8B7340',
            fontSize: large ? 13 : 11,
            fontWeight: 650
          }
        }]
      };
    };

    paint('salary');
    timers.push(window.setInterval(function () {
      values = values.map(function (v) {
        return Math.max(10, Math.min(55, Math.round(v + (Math.random() * 3.5 - 1.5))));
      });
      paint('salary');
    }, reduceMotion ? 4800 : 3400));
  }

  /* —— 供需：柱 + 面积 —— */
  function initSupply() {
    var el = $('vh-chart-supply');
    if (!el || !window.echarts) return;
    charts.supply = echarts.init(el);
    var cities = CITIES.slice(0, 6);
    var demand = cities.map(function () { return 44 + Math.round(Math.random() * 40); });
    var supply = cities.map(function () { return 32 + Math.round(Math.random() * 38); });

    builders.supply = function (large) {
      return {
        color: ['#A88B4E', '#3D8B7A'],
        grid: {
          left: large ? 48 : 40,
          right: large ? 20 : 12,
          top: large ? 40 : 32,
          bottom: large ? 36 : 28
        },
        legend: {
          top: 0,
          right: 2,
          itemWidth: 12,
          itemHeight: 8,
          icon: 'roundRect',
          textStyle: { color: '#6B7280', fontSize: large ? 13 : 11 },
          data: ['岗位', '人才']
        },
        tooltip: Object.assign({ trigger: 'axis' }, tip()),
        xAxis: {
          type: 'category',
          data: cities,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#6B7280', fontSize: large ? 12 : 11 }
        },
        yAxis: Object.assign({ type: 'value', splitNumber: 4 }, softAxis(large)),
        series: [
          {
            name: '岗位',
            type: 'bar',
            barWidth: large ? 18 : 12,
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              color: grad('rgba(168,139,78,.75)', 'rgba(168,139,78,.15)', true)
            },
            data: demand,
            z: 1
          },
          {
            name: '人才',
            type: 'line',
            smooth: 0.4,
            symbol: 'circle',
            symbolSize: large ? 9 : 7,
            lineStyle: { width: large ? 3 : 2.4, color: '#3D8B7A', shadowBlur: 10, shadowColor: 'rgba(61,139,122,.35)' },
            itemStyle: { color: '#3D8B7A', borderColor: '#fff', borderWidth: 2 },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(61,139,122,.28)' },
                { offset: 1, color: 'rgba(61,139,122,0)' }
              ])
            },
            data: supply,
            z: 2
          }
        ]
      };
    };

    paint('supply');
    timers.push(window.setInterval(function () {
      demand = demand.map(function (v) {
        return Math.max(22, Math.min(95, Math.round(v + (Math.random() * 5 - 2.5))));
      });
      supply = supply.map(function (v) {
        return Math.max(18, Math.min(90, Math.round(v + (Math.random() * 5 - 2.5))));
      });
      paint('supply');
    }, reduceMotion ? 5000 : 3600));
  }

  /* —— 灯箱 —— */
  function openLightbox(key) {
    if (!builders[key]) return;
    var box = $('vh-lightbox');
    var title = $('vh-lightbox-title');
    var host = $('vh-lightbox-chart');
    if (!box || !host) return;
    lightboxKey = key;
    if (title) title.textContent = titles[key] || key;
    box.hidden = false;
    document.body.classList.add('vh-lightbox-open');
    if (lightboxChart) {
      lightboxChart.dispose();
      lightboxChart = null;
    }
    requestAnimationFrame(function () {
      lightboxChart = echarts.init(host);
      lightboxChart.setOption(builders[key](true), true);
    });
  }

  function closeLightbox() {
    var box = $('vh-lightbox');
    if (box) box.hidden = true;
    document.body.classList.remove('vh-lightbox-open');
    lightboxKey = null;
    if (lightboxChart) {
      lightboxChart.dispose();
      lightboxChart = null;
    }
  }

  function bindLightbox() {
    document.querySelectorAll('.vh-panel[data-panel]').forEach(function (panel) {
      panel.addEventListener('click', function () {
        openLightbox(panel.getAttribute('data-panel'));
      });
      panel.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(panel.getAttribute('data-panel'));
        }
      });
    });
    var box = $('vh-lightbox');
    if (box) {
      box.querySelectorAll('[data-vh-close]').forEach(function (el) {
        el.addEventListener('click', closeLightbox);
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightboxKey) closeLightbox();
    });
  }

  function onResize() {
    Object.keys(charts).forEach(function (k) {
      if (charts[k]) charts[k].resize();
    });
    if (lightboxChart) lightboxChart.resize();
  }

  function initVizHall() {
    var root = document.querySelector('.vh-root');
    if (root) {
      requestAnimationFrame(function () { root.classList.add('is-ready'); });
    }
    buildByteTrack();
    paintMetrics();
    tickBytes();
    initCity();
    initSkill();
    initMatch();
    initRole();
    initSalary();
    initSupply();
    bindLightbox();
    window.addEventListener('resize', onResize);
  }

  window.initVizHall = initVizHall;
})();
