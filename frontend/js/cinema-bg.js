/* 平台页面统一背景注入：视频背景 + 暗角 + 噪点 + 深色电影风覆盖 */
(function () {
  function base() {
    const path = String(location.pathname || '').replace(/\\/g, '/');
    if (/\/pages\/more\//.test(path)) return '../../';
    if (/\/pages\//.test(path)) return '../';
    return '';
  }

  const B = base();

  // 1) 背景层
  if (!document.getElementById('cinema-bg')) {
    const stage = document.createElement('div');
    stage.id = 'cinema-bg';
    stage.className = 'cinema-bg';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML =
      '<video class="cinema-bg-video" src="' + B + 'assets/bg/scene3.mp4" muted playsinline autoplay loop></video>' +
      '<div class="cinema-vignette"></div>' +
      '<div class="grain"></div>';
    document.body.insertBefore(stage, document.body.firstChild);
  }

  // 2) 深色电影风覆盖样式
  if (document.getElementById('cinema-theme')) return;
  const style = document.createElement('style');
  style.id = 'cinema-theme';
  style.textContent = [
    /* 背景层 */
    '.cinema-bg{position:fixed;inset:0;z-index:-1;overflow:hidden;background:#06070a;pointer-events:none;}',
    '.cinema-bg-video{width:100%;height:100%;object-fit:cover;filter:brightness(.62) saturate(1.05);}',
    '.cinema-bg .cinema-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 48%,transparent 34%,rgba(0,0,0,.22) 72%,rgba(0,0,0,.72) 100%),linear-gradient(90deg,rgba(0,0,0,.6),transparent 24%,transparent 72%,rgba(0,0,0,.5)),linear-gradient(180deg,rgba(0,0,0,.4),transparent 30%,transparent 68%,rgba(0,0,0,.56));}',
    '.cinema-bg .grain{position:absolute;inset:0;pointer-events:none;opacity:.12;mix-blend-mode:soft-light;background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 240 240\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'240\' height=\'240\' filter=\'url(%23n)\' opacity=\'.75\'/%3E%3C/svg%3E");}',

    /* 让视频透出 */
    'html,body{background:transparent !important;}',
    '.app-frame{background:transparent !important;}',
    '.main-column{background:transparent !important;}',
    '.page-main{background:transparent !important;}',

    /* page-polish 玻璃变量 → 深色 */
    'body[data-page="insight"] .page-main,body[data-page="discovery"] .page-main{--glass-card:rgba(255,255,255,0.06);--glass-border:rgba(255,255,255,0.14);--glass-shadow:0 12px 32px rgba(0,0,0,0.32);}',

    /* 卡片统一深色玻璃 */
    '.card,.kpi-card,.job-card,.graph-filter,.graph-detail,.match-resume,.match-job-card,.evo-list,.evo-stat,.source-card,.quality-card,.proto-stat,.proto-banner,.header,.icon-btn,.btn,.btn-ghost,.module-card,.home-quick,.home-panel{background:rgba(255,255,255,0.06) !important;border:1px solid rgba(255,255,255,0.12) !important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);}',
    '.btn-primary{background:linear-gradient(135deg,#1FC8D9,#1EA8E8) !important;border-color:transparent !important;color:#fff !important;}',

    '.home-kpi{background:rgba(255,255,255,0.04) !important;border:1px solid rgba(255,255,255,0.1) !important;}',
    '.home-banner{background:radial-gradient(ellipse 50% 80% at 88% 40%,rgba(31,200,217,0.14),transparent 60%),linear-gradient(115deg,rgba(15,25,36,0.85),rgba(20,30,42,0.7) 50%,rgba(12,20,30,0.85)) !important;border:1px solid rgba(255,255,255,0.12) !important;}',
    '.filter-pill{background:rgba(255,255,255,0.06) !important;border:1px solid rgba(255,255,255,0.12) !important;}',
    '.change-item{background:rgba(255,255,255,0.05) !important;}',
    '.match-format,.match-summary-badge,.match-profile-chip,.match-path-node{background:rgba(255,255,255,0.06) !important;border-color:rgba(255,255,255,0.12) !important;color:var(--text-secondary) !important;}',
    '.match-gap-item,.path-deliverable{background:rgba(255,255,255,0.05) !important;border-color:rgba(255,255,255,0.1) !important;}',
    '.match-skeleton{background:rgba(255,255,255,0.08) !important;}',
    '.match-error{background:rgba(245,158,11,0.12) !important;border-color:rgba(245,158,11,0.3) !important;color:#fcd34d !important;}',
    '.upload-zone{background:rgba(255,255,255,0.05) !important;border-color:rgba(45,212,191,0.35) !important;}',
    '.proto-search input,.proto-select{background:rgba(255,255,255,0.06) !important;border-color:rgba(255,255,255,0.14) !important;color:var(--text-dark) !important;}',
    '#view-discovery .job-card.disc-proto.is-forecast,#view-discovery .disc-proto.is-forecast{background:rgba(240,180,41,0.08) !important;border-color:rgba(240,180,41,0.4) !important;}',
    '#view-discovery .proto-sec-head{border-bottom-color:rgba(255,255,255,0.12) !important;}',
    'body[data-page="insight"] .trend-hero{background:radial-gradient(ellipse 50% 80% at 90% 30%,rgba(31,200,217,0.16),transparent 55%),linear-gradient(115deg,rgba(15,25,36,0.85),rgba(18,28,40,0.75) 50%,rgba(12,20,30,0.85)) !important;border:1px solid rgba(255,255,255,0.14) !important;}',

    /* 输入 / 搜索 */
    '.topbar-search,.header-search input{background:rgba(255,255,255,0.06) !important;border-color:rgba(255,255,255,0.14) !important;color:var(--text-dark) !important;}',

    /* 图表容器暗色 */
    '.graph-canvas{background:radial-gradient(ellipse at 30% 20%,#0d1a18 0%,#080d15 55%,#06070a 100%) !important;}',

    /* 滚动条 */
    '::-webkit-scrollbar{width:8px;height:8px}',
    '::-webkit-scrollbar-track{background:transparent}',
    '::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.16);border-radius:4px}'
  ].join('\n');
  document.head.appendChild(style);
})();
